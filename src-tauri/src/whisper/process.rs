use std::borrow::Cow;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};
use std::time::Instant;

use once_cell::sync::Lazy;
use tauri::{AppHandle, Emitter};
use whisper_rs::{
    FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters, WhisperVadContext,
    WhisperVadContextParams, WhisperVadParams,
};

use super::error::WhisperError;
use super::types::{TranscriptionProgress, TranscriptionResult, TranscriptionSegment};

/// Target sample rate for Whisper (16 kHz).
const WHISPER_SAMPLE_RATE: u32 = 16_000;

/// Converts a sample count to milliseconds at the given sample rate.
#[inline]
#[must_use]
fn samples_to_ms(samples: usize, sample_rate: u32) -> u64 {
    #[allow(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        clippy::cast_precision_loss
    )]
    {
        (samples as f64 / f64::from(sample_rate) * 1000.0) as u64
    }
}

/// Converts milliseconds to a sample count at the given sample rate.
#[inline]
#[must_use]
fn ms_to_samples(ms: u64, sample_rate: u32) -> usize {
    #[allow(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        clippy::cast_precision_loss
    )]
    {
        (ms as f64 / 1000.0 * f64::from(sample_rate)) as usize
    }
}

/// Converts centiseconds (1cs = 10ms) to a sample count at the given sample rate.
#[inline]
#[must_use]
fn centiseconds_to_samples<T: Into<f64>>(cs: T, sample_rate: u32) -> usize {
    #[allow(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        clippy::cast_precision_loss
    )]
    {
        (cs.into() / 100.0 * f64::from(sample_rate)) as usize
    }
}

/// Converts centiseconds (Whisper segment timestamps) to milliseconds.
///
/// Negative values are clamped to 0 — Whisper occasionally reports slightly
/// negative timestamps at the very start of an utterance.
#[inline]
#[must_use]
fn centiseconds_to_ms(cs: i64) -> u64 {
    #[allow(clippy::cast_sign_loss)]
    {
        (cs * 10).max(0) as u64
    }
}

/// Token for cancelling an in-progress transcription.
pub(crate) struct CancellationToken {
    cancelled: AtomicBool,
}

impl Default for CancellationToken {
    fn default() -> Self {
        Self::new()
    }
}

impl CancellationToken {
    /// Creates a new cancellation token in the non-cancelled state.
    #[must_use]
    pub fn new() -> Self {
        Self {
            cancelled: AtomicBool::new(false),
        }
    }

    /// Signals cancellation.
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
    }

    /// Returns `true` if cancellation has been requested.
    #[must_use]
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }
}

/// Manages active transcription tasks and their cancellation tokens.
pub(crate) struct TaskManager {
    tasks: RwLock<HashMap<String, Arc<CancellationToken>>>,
}

impl Default for TaskManager {
    fn default() -> Self {
        Self::new()
    }
}

impl TaskManager {
    /// Creates a new empty task manager.
    #[must_use]
    pub fn new() -> Self {
        Self {
            tasks: RwLock::new(HashMap::new()),
        }
    }

    /// Registers a task and returns its cancellation token.
    ///
    /// # Panics
    ///
    /// Panics if the internal lock is poisoned.
    #[allow(clippy::expect_used)]
    pub fn create_task(&self, task_id: &str) -> Arc<CancellationToken> {
        let token = Arc::new(CancellationToken::new());
        self.tasks
            .write()
            .expect("TaskManager lock poisoned")
            .insert(task_id.to_string(), Arc::clone(&token));
        token
    }

    /// Cancels the task with the given ID.
    ///
    /// Returns `true` if the task existed and was cancelled.
    ///
    /// # Panics
    ///
    /// Panics if the internal lock is poisoned.
    #[allow(clippy::expect_used)]
    pub fn cancel_task(&self, task_id: &str) -> bool {
        let tasks = self.tasks.read().expect("TaskManager lock poisoned");
        if let Some(token) = tasks.get(task_id) {
            token.cancel();
            true
        } else {
            false
        }
    }

    /// Removes a completed or cancelled task.
    ///
    /// # Panics
    ///
    /// Panics if the internal lock is poisoned.
    #[allow(clippy::expect_used)]
    pub fn remove_task(&self, task_id: &str) {
        self.tasks
            .write()
            .expect("TaskManager lock poisoned")
            .remove(task_id);
    }
}

/// Global task manager instance.
pub(crate) static TASK_MANAGER: Lazy<TaskManager> = Lazy::new(TaskManager::new);

/// Resamples audio data using linear interpolation.
///
/// Converts from `from_rate` Hz to `to_rate` Hz.
#[must_use]
pub(crate) fn resample(samples: &[f32], from_rate: u32, to_rate: u32) -> Vec<f32> {
    if from_rate == to_rate || samples.is_empty() {
        return samples.to_vec();
    }

    let ratio = f64::from(from_rate) / f64::from(to_rate);
    #[allow(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        clippy::cast_precision_loss
    )]
    let output_len = (samples.len() as f64 / ratio) as usize;
    let mut output = Vec::with_capacity(output_len);

    for i in 0..output_len {
        #[allow(clippy::cast_precision_loss)]
        let src_idx = i as f64 * ratio;
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        let idx = src_idx as usize;
        #[allow(clippy::cast_possible_truncation, clippy::cast_precision_loss)]
        let frac = (src_idx - idx as f64) as f32;

        let sample = if idx + 1 < samples.len() {
            samples[idx] * (1.0 - frac) + samples[idx + 1] * frac
        } else if idx < samples.len() {
            samples[idx]
        } else {
            0.0
        };

        output.push(sample);
    }

    output
}

/// Loads a WAV file and returns 16 kHz mono f32 samples.
///
/// # Errors
///
/// Returns an error if the file cannot be found, read, or has an unsupported format.
pub(crate) fn load_wav_file(path: &Path) -> Result<Vec<f32>, WhisperError> {
    if !path.exists() {
        return Err(WhisperError::FileNotFound(path.display().to_string()));
    }

    let reader = hound::WavReader::open(path)
        .map_err(|e| WhisperError::FileReadError(format!("{}: {e}", path.display())))?;

    let spec = reader.spec();

    // Read samples as f32
    let raw_samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Int => {
            #[allow(clippy::cast_precision_loss)]
            let max_val = (1_i64 << (u32::from(spec.bits_per_sample) - 1)) as f32;
            reader
                .into_samples::<i32>()
                .map(|s| {
                    #[allow(clippy::cast_precision_loss)]
                    let val =
                        s.map_err(|e| WhisperError::FileReadError(e.to_string()))? as f32 / max_val;
                    Ok(val)
                })
                .collect::<Result<Vec<f32>, WhisperError>>()?
        }
        hound::SampleFormat::Float => reader
            .into_samples::<f32>()
            .map(|s| s.map_err(|e| WhisperError::FileReadError(e.to_string())))
            .collect::<Result<Vec<f32>, WhisperError>>()?,
    };

    // Convert stereo to mono
    let mono_samples = if spec.channels == 2 {
        raw_samples
            .chunks(2)
            .map(|chunk| {
                if chunk.len() == 2 {
                    (chunk[0] + chunk[1]) / 2.0
                } else {
                    chunk[0]
                }
            })
            .collect()
    } else if spec.channels == 1 {
        raw_samples
    } else {
        return Err(WhisperError::UnsupportedFormat(format!(
            "{} channels not supported",
            spec.channels
        )));
    };

    // Resample to 16 kHz if needed
    let samples = if spec.sample_rate == WHISPER_SAMPLE_RATE {
        mono_samples
    } else {
        resample(&mono_samples, spec.sample_rate, WHISPER_SAMPLE_RATE)
    };

    Ok(samples)
}

/// Maps timestamps from a concatenated speech buffer back to the original audio timeline.
struct TimestampMap {
    /// Each entry: (start in concat buffer, start in original audio, length) — all in samples.
    segments: Vec<(usize, usize, usize)>,
}

impl TimestampMap {
    /// Converts a millisecond timestamp in the concatenated buffer to the original timeline.
    fn to_original_ms(&self, concat_ms: u64) -> u64 {
        let concat_sample = ms_to_samples(concat_ms, WHISPER_SAMPLE_RATE);
        let mut acc = 0_usize;
        for &(_, orig_start, len) in &self.segments {
            if concat_sample < acc + len {
                let offset = concat_sample - acc;
                return samples_to_ms(orig_start + offset, WHISPER_SAMPLE_RATE);
            }
            acc += len;
        }
        // Past end — return end of last segment
        if let Some(&(_, orig_start, len)) = self.segments.last() {
            return samples_to_ms(orig_start + len, WHISPER_SAMPLE_RATE);
        }
        concat_ms
    }
}

/// Runs standalone Silero VAD and extracts speech-only audio.
///
/// Returns the concatenated speech samples and a timestamp mapping, or `None`
/// if VAD detected no speech at all. Errors are propagated to the caller
/// rather than falling back to VAD-less processing, so a broken VAD model
/// surfaces instead of silently changing the transcription path.
fn preprocess_with_vad(
    samples: &[f32],
    vad_model_path: &str,
) -> Result<Option<(Vec<f32>, TimestampMap)>, WhisperError> {
    let mut vad_params = WhisperVadParams::default();
    vad_params.set_threshold(0.3);
    vad_params.set_speech_pad(100);

    let mut vad_ctx = WhisperVadContext::new(vad_model_path, WhisperVadContextParams::default())
        .map_err(|e| WhisperError::ModelLoadError(format!("VAD model: {e}")))?;

    let vad_segments = vad_ctx
        .segments_from_samples(vad_params, samples)
        .map_err(|e| WhisperError::TranscriptionError(format!("VAD failed: {e}")))?;

    let mut concat = Vec::new();
    let mut mapping = Vec::new();

    for seg in vad_segments {
        // VAD timestamps are in centiseconds (1cs = 10ms).
        let start_sample = centiseconds_to_samples(seg.start, WHISPER_SAMPLE_RATE);
        let end_sample = centiseconds_to_samples(seg.end, WHISPER_SAMPLE_RATE).min(samples.len());

        if start_sample >= end_sample || start_sample >= samples.len() {
            continue;
        }

        let len = end_sample - start_sample;
        mapping.push((concat.len(), start_sample, len));
        concat.extend_from_slice(&samples[start_sample..end_sample]);
    }

    if mapping.is_empty() {
        return Ok(None);
    }

    Ok(Some((concat, TimestampMap { segments: mapping })))
}

/// Transcribes audio samples using a Whisper model.
///
/// Emits `whisper:progress` events during processing.
///
/// # Errors
///
/// Returns an error if the model cannot be loaded, transcription fails,
/// or the task is cancelled.
pub(crate) fn transcribe(
    model_path: &str,
    samples: &[f32],
    task_id: &str,
    token: &Arc<CancellationToken>,
    app: &AppHandle,
    language: Option<&str>,
    vad_model_path: Option<&str>,
) -> Result<TranscriptionResult, WhisperError> {
    let start = Instant::now();

    // WORKAROUND: whisper.cpp's built-in VAD ignores custom vad_params set
    // via FullParams. Standalone VAD gives us control over detection sensitivity.
    let (audio, timestamp_map): (Cow<[f32]>, Option<TimestampMap>) =
        if let Some(vad_path) = vad_model_path {
            if let Some((extracted, map)) = preprocess_with_vad(samples, vad_path)? {
                (Cow::Owned(extracted), Some(map))
            } else {
                // No speech detected — return empty result
                let dur = samples_to_ms(samples.len(), WHISPER_SAMPLE_RATE);
                return Ok(TranscriptionResult {
                    task_id: task_id.to_string(),
                    text: String::new(),
                    segments: Vec::new(),
                    language: language.unwrap_or("ja").to_string(),
                    duration: dur,
                });
            }
        } else {
            (Cow::Borrowed(samples), None)
        };

    // VAD preprocessing and model loading both run before whisper's abort
    // callback is installed, so cancellation has to be polled explicitly here
    // or a cancel issued during them is not observed until they finish.
    if token.is_cancelled() {
        return Err(WhisperError::Cancelled);
    }

    // Load model
    let ctx = WhisperContext::new_with_params(model_path, WhisperContextParameters::default())
        .map_err(|e| WhisperError::ModelLoadError(e.to_string()))?;

    let mut state = ctx
        .create_state()
        .map_err(|e| WhisperError::ModelLoadError(e.to_string()))?;

    if token.is_cancelled() {
        return Err(WhisperError::Cancelled);
    }

    // Configure parameters
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 5 });
    params.set_language(language);
    params.set_print_progress(false);
    params.set_print_realtime(false);
    params.set_print_timestamps(false);
    params.set_print_special(false);

    #[allow(clippy::cast_possible_wrap, clippy::cast_possible_truncation)]
    let n_threads = std::thread::available_parallelism().map_or(4, |n| n.get().min(8) as i32);
    params.set_n_threads(n_threads);

    // Progress callback (% updates).
    let task_id_cb = task_id.to_string();
    let app_cb = app.clone();
    params.set_progress_callback_safe(move |progress| {
        let elapsed_ms = u64::try_from(start.elapsed().as_millis()).unwrap_or(u64::MAX);
        let _ = app_cb.emit(
            "whisper:progress",
            TranscriptionProgress {
                task_id: task_id_cb.clone(),
                progress: f64::from(progress),
                elapsed_ms,
            },
        );
    });

    // Abort callback for cancellation.
    // WORKAROUND: whisper-rs 0.15.1〜0.16.0 `set_abort_callback_safe` has a bug
    // where the trampoline is monomorphized as `trampoline::<F>` (concrete type)
    // but the actual user_data is `Box<dyn FnMut() -> bool>`. By pre-boxing the
    // closure so that `F = Box<dyn FnMut() -> bool>`, the trampoline type matches
    // the data layout. Verified against whisper-rs 0.16.0 source; bug still
    // present. Remove once whisper-rs releases a fix.
    let token_cb = Arc::clone(token);
    let abort_fn: Box<dyn FnMut() -> bool> = Box::new(move || token_cb.is_cancelled());
    params.set_abort_callback_safe(abort_fn);

    // Run transcription on the (possibly VAD-filtered) audio
    let result = state.full(params, &audio);

    // Check cancellation after transcription completes
    if token.is_cancelled() {
        return Err(WhisperError::Cancelled);
    }

    result.map_err(|e| WhisperError::TranscriptionError(e.to_string()))?;

    let (mut segments, full_text) = collect_segments(&state)?;

    // Remap timestamps to the original audio timeline when VAD was used
    if let Some(ref map) = timestamp_map {
        for seg in &mut segments {
            seg.start = map.to_original_ms(seg.start);
            seg.end = map.to_original_ms(seg.end);
        }
    }

    // Detect language from state
    let lang_id = state.full_lang_id_from_state();
    let language = whisper_rs::get_lang_str(lang_id)
        .unwrap_or("ja")
        .to_string();

    // Audio duration from ORIGINAL sample count (not the VAD-filtered audio)
    let audio_duration_ms = samples_to_ms(samples.len(), WHISPER_SAMPLE_RATE);

    Ok(TranscriptionResult {
        task_id: task_id.to_string(),
        text: full_text.trim().to_string(),
        segments,
        language,
        duration: audio_duration_ms,
    })
}

/// Collects segments from the Whisper state.
fn collect_segments(
    state: &whisper_rs::WhisperState,
) -> Result<(Vec<TranscriptionSegment>, String), WhisperError> {
    let mut segments = Vec::new();
    let mut full_text = String::new();

    for segment in state.as_iter() {
        let text = segment
            .to_str_lossy()
            .map_err(|e| WhisperError::TranscriptionError(e.to_string()))?
            .to_string();

        if text.trim().is_empty() {
            continue;
        }

        let t0 = segment.start_timestamp();
        let t1 = segment.end_timestamp();

        full_text.push_str(&text);

        let start_ms = centiseconds_to_ms(t0);
        let end_ms = centiseconds_to_ms(t1);

        segments.push(TranscriptionSegment {
            start: start_ms,
            end: end_ms,
            text,
        });
    }

    Ok((segments, full_text))
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- CancellationToken ---

    #[test]
    fn cancellation_token_new_is_not_cancelled() {
        let token = CancellationToken::new();
        assert!(!token.is_cancelled());
    }

    #[test]
    fn cancellation_token_cancel_sets_cancelled() {
        let token = CancellationToken::new();
        token.cancel();
        assert!(token.is_cancelled());
    }

    // --- TaskManager ---

    #[test]
    fn task_manager_create_task_returns_token() {
        let manager = TaskManager::new();
        let token = manager.create_task("task-1");
        assert!(!token.is_cancelled());
    }

    #[test]
    fn task_manager_cancel_task_existing() {
        let manager = TaskManager::new();
        let token = manager.create_task("task-1");
        let cancelled = manager.cancel_task("task-1");
        assert!(cancelled);
        assert!(token.is_cancelled());
    }

    #[test]
    fn task_manager_cancel_task_nonexistent() {
        let manager = TaskManager::new();
        let cancelled = manager.cancel_task("no-such-task");
        assert!(!cancelled);
    }

    #[test]
    fn task_manager_remove_task() {
        let manager = TaskManager::new();
        manager.create_task("task-1");
        manager.remove_task("task-1");
        // After removal, cancel should return false
        let cancelled = manager.cancel_task("task-1");
        assert!(!cancelled);
    }

    // --- resample ---

    #[test]
    fn resample_same_rate_returns_copy() {
        let input = vec![1.0, 2.0, 3.0, 4.0];
        let output = resample(&input, 44100, 44100);
        assert_eq!(output, input);
    }

    #[test]
    fn resample_empty_returns_empty() {
        let input: Vec<f32> = vec![];
        let output = resample(&input, 44100, 16000);
        assert!(output.is_empty());
    }

    #[test]
    fn resample_downsamples_correctly() {
        // 48kHz -> 16kHz (3:1 ratio)
        // 12 samples at 48kHz -> 4 samples at 16kHz
        #[allow(clippy::cast_precision_loss)]
        let input: Vec<f32> = (0..12).map(|i| i as f32).collect();
        let output = resample(&input, 48000, 16000);
        assert_eq!(output.len(), 4);
        // First sample should be at source index 0
        assert!((output[0] - 0.0).abs() < f32::EPSILON);
        // Second sample should be at source index 3
        assert!((output[1] - 3.0).abs() < f32::EPSILON);
    }

    #[test]
    fn resample_upsamples_correctly() {
        // 8kHz -> 16kHz (1:2 ratio)
        let input = vec![0.0, 1.0, 2.0, 3.0];
        let output = resample(&input, 8000, 16000);
        assert_eq!(output.len(), 8);
        // First sample
        assert!((output[0] - 0.0).abs() < f32::EPSILON);
        // Interpolated sample between 0.0 and 1.0
        assert!((output[1] - 0.5).abs() < 0.01);
    }

    // --- load_wav_file ---

    #[test]
    fn load_wav_file_not_found() {
        let result = load_wav_file(Path::new("/nonexistent/audio.wav"));
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), WhisperError::FileNotFound(_)));
    }

    #[test]
    fn load_wav_file_reads_mono_16bit_wav() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("test_mono.wav");

        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut writer = hound::WavWriter::create(&path, spec).unwrap();
        for i in 0..16000_i16 {
            writer.write_sample(i % 100).unwrap();
        }
        writer.finalize().unwrap();

        let samples = load_wav_file(&path).unwrap();
        // 16kHz mono -> no conversion needed
        assert_eq!(samples.len(), 16000);
    }

    #[test]
    fn load_wav_file_converts_stereo_to_mono() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("test_stereo.wav");

        let spec = hound::WavSpec {
            channels: 2,
            sample_rate: 16000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut writer = hound::WavWriter::create(&path, spec).unwrap();
        for _ in 0..100 {
            writer.write_sample(1000_i16).unwrap(); // left
            writer.write_sample(3000_i16).unwrap(); // right
        }
        writer.finalize().unwrap();

        let samples = load_wav_file(&path).unwrap();
        assert_eq!(samples.len(), 100);
        // Average of 1000/32768 and 3000/32768
        let expected = (1000.0 + 3000.0) / 2.0 / 32768.0;
        assert!((samples[0] - expected).abs() < 0.001);
    }

    #[test]
    fn load_wav_file_resamples_to_16khz() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("test_48k.wav");

        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 48000,
            bits_per_sample: 16,
            sample_format: hound::SampleFormat::Int,
        };

        let mut writer = hound::WavWriter::create(&path, spec).unwrap();
        for i in 0..48000_i32 {
            #[allow(clippy::cast_possible_truncation)]
            writer.write_sample((i % 100) as i16).unwrap();
        }
        writer.finalize().unwrap();

        let samples = load_wav_file(&path).unwrap();
        // 48000 samples at 48kHz -> 16000 samples at 16kHz
        assert_eq!(samples.len(), 16000);
    }
}
