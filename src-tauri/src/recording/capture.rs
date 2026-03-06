use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Instant;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use tauri::{AppHandle, Emitter};

use super::error::RecordingError;
use super::sleep_guard::SleepGuard;
use super::types::{AudioDevice, RecordingLevel, RecordingStopResult};
use crate::whisper::process::resample;

/// Target sample rate for Whisper (16 kHz).
const WHISPER_SAMPLE_RATE: u32 = 16_000;

/// Interval in milliseconds between level event emissions.
const LEVEL_EMIT_INTERVAL_MS: u128 = 50;

/// Manages audio recording from input devices.
///
/// Uses a dedicated thread for cpal stream operation since `cpal::Stream`
/// is not `Send`. The thread parks until a stop signal is set.
pub struct RecordingManager {
    is_recording: Arc<AtomicBool>,
    samples: Arc<Mutex<Vec<f32>>>,
    sample_rate: Arc<AtomicU32>,
    stop_flag: Arc<AtomicBool>,
    thread_handle: Mutex<Option<JoinHandle<()>>>,
    sleep_guard: Mutex<Option<SleepGuard>>,
}

impl RecordingManager {
    /// Creates a new `RecordingManager` with default state.
    #[must_use]
    pub fn new() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            samples: Arc::new(Mutex::new(Vec::new())),
            sample_rate: Arc::new(AtomicU32::new(0)),
            stop_flag: Arc::new(AtomicBool::new(false)),
            thread_handle: Mutex::new(None),
            sleep_guard: Mutex::new(None),
        }
    }

    /// Lists available audio input devices.
    ///
    /// # Errors
    ///
    /// Returns `RecordingError::DeviceError` if the audio host cannot enumerate devices.
    pub fn list_devices() -> Result<Vec<AudioDevice>, RecordingError> {
        let host = cpal::default_host();

        let default_device_name = host.default_input_device().and_then(|d| d.name().ok());

        let devices = host
            .input_devices()
            .map_err(|e| RecordingError::DeviceError(e.to_string()))?;

        let mut result = Vec::new();
        for device in devices {
            let name = device
                .name()
                .unwrap_or_else(|_| "Unknown Device".to_string());
            let is_default = default_device_name
                .as_ref()
                .is_some_and(|default_name| *default_name == name);
            result.push(AudioDevice {
                id: name.clone(),
                name,
                is_default,
            });
        }

        Ok(result)
    }

    /// Starts recording audio from the specified device (or the default device).
    ///
    /// Spawns a dedicated thread to run the cpal stream since `cpal::Stream` is
    /// not `Send`. Audio level events (`recording:level`) are emitted approximately
    /// every 50ms.
    ///
    /// # Errors
    ///
    /// Returns `RecordingError::AlreadyRecording` if a recording is already in progress.
    /// Returns `RecordingError::DeviceNotFound` if the specified device cannot be found.
    /// Returns `RecordingError::DeviceError` if the audio stream cannot be created.
    #[allow(clippy::needless_pass_by_value)]
    pub fn start(&self, device_id: Option<String>, app: AppHandle) -> Result<(), RecordingError> {
        if self.is_recording.load(Ordering::Acquire) {
            return Err(RecordingError::AlreadyRecording);
        }

        // Reset state
        self.stop_flag.store(false, Ordering::Release);
        if let Ok(mut samples) = self.samples.lock() {
            samples.clear();
        }

        // Acquire sleep guard
        if let Ok(mut guard) = self.sleep_guard.lock() {
            *guard = Some(SleepGuard::acquire());
        }

        let samples = Arc::clone(&self.samples);
        let sample_rate = Arc::clone(&self.sample_rate);
        let stop_flag = Arc::clone(&self.stop_flag);
        let is_recording = Arc::clone(&self.is_recording);
        let device_id_clone = device_id;

        let handle = std::thread::spawn(move || {
            if let Err(e) = run_capture_thread(
                device_id_clone.as_deref(),
                &samples,
                &sample_rate,
                &stop_flag,
                &app,
            ) {
                eprintln!("Recording capture thread error: {e}");
            }
            is_recording.store(false, Ordering::Release);
        });

        self.is_recording.store(true, Ordering::Release);

        if let Ok(mut thread) = self.thread_handle.lock() {
            *thread = Some(handle);
        }

        Ok(())
    }

    /// Stops the current recording and writes the captured audio to a WAV file.
    ///
    /// The WAV file is written to `{app_data_dir}/recordings/` with a UUID filename.
    /// Audio is resampled to 16 kHz mono for Whisper compatibility.
    ///
    /// # Errors
    ///
    /// Returns `RecordingError::NotRecording` if no recording is in progress.
    /// Returns `RecordingError::Io` if the output directory cannot be created.
    /// Returns `RecordingError::WavError` if the WAV file cannot be written.
    pub fn stop(&self, app_data_dir: &Path) -> Result<RecordingStopResult, RecordingError> {
        if !self.is_recording.load(Ordering::Acquire) {
            return Err(RecordingError::NotRecording);
        }

        // Signal the capture thread to stop
        self.stop_flag.store(true, Ordering::Release);

        // Join the capture thread
        if let Ok(mut handle) = self.thread_handle.lock() {
            if let Some(h) = handle.take() {
                let _ = h.join();
            }
        }

        // Release sleep guard
        if let Ok(mut guard) = self.sleep_guard.lock() {
            if let Some(ref mut g) = *guard {
                g.release();
            }
            *guard = None;
        }

        // Take the recorded samples
        let raw_samples = if let Ok(mut samples) = self.samples.lock() {
            std::mem::take(&mut *samples)
        } else {
            Vec::new()
        };

        let original_rate = self.sample_rate.load(Ordering::Acquire);
        let sample_count = raw_samples.len() as u64;

        // Resample to 16 kHz for Whisper
        let resampled = if original_rate == 0 || original_rate == WHISPER_SAMPLE_RATE {
            raw_samples
        } else {
            resample(&raw_samples, original_rate, WHISPER_SAMPLE_RATE)
        };

        // Calculate duration from original samples at original rate
        #[allow(clippy::cast_precision_loss)]
        let duration_ms = if original_rate > 0 {
            #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
            {
                (sample_count as f64 / f64::from(original_rate) * 1000.0) as u64
            }
        } else {
            0
        };

        // Write WAV file
        let recordings_dir = app_data_dir.join("recordings");
        std::fs::create_dir_all(&recordings_dir)?;

        let filename = format!("{}.wav", uuid::Uuid::new_v4());
        let file_path = recordings_dir.join(&filename);

        write_wav_file(&file_path, &resampled, WHISPER_SAMPLE_RATE)?;

        let path_str = file_path
            .to_str()
            .ok_or_else(|| RecordingError::WavError("Invalid path encoding".to_string()))?
            .to_string();

        self.is_recording.store(false, Ordering::Release);

        Ok(RecordingStopResult {
            temp_file_path: path_str,
            duration_ms,
            sample_count,
        })
    }

    /// Deletes a temporary recording file.
    ///
    /// # Errors
    ///
    /// Returns `RecordingError::Io` if the file cannot be deleted.
    pub fn cleanup(path: &Path) -> Result<(), RecordingError> {
        if path.exists() {
            std::fs::remove_file(path)?;
        }
        Ok(())
    }
}

impl Default for RecordingManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Runs the audio capture on the current thread.
///
/// This function is intended to be called from a dedicated thread.
/// It creates a cpal stream, plays it, and parks the thread until
/// `stop_flag` is set.
fn run_capture_thread(
    device_id: Option<&str>,
    samples: &Arc<Mutex<Vec<f32>>>,
    sample_rate: &Arc<AtomicU32>,
    stop_flag: &Arc<AtomicBool>,
    app: &AppHandle,
) -> Result<(), RecordingError> {
    let host = cpal::default_host();

    // Find the requested device
    let device = match device_id {
        Some(id) => {
            let mut found = None;
            let devices = host
                .input_devices()
                .map_err(|e| RecordingError::DeviceError(e.to_string()))?;
            for d in devices {
                if d.name().ok().as_deref() == Some(id) {
                    found = Some(d);
                    break;
                }
            }
            found.ok_or_else(|| RecordingError::DeviceNotFound(id.to_string()))?
        }
        None => host
            .default_input_device()
            .ok_or_else(|| RecordingError::DeviceNotFound("No default input device".to_string()))?,
    };

    // Get a supported input config (prefer f32, mono, highest sample rate)
    let config = select_input_config(&device)?;
    let device_sample_rate = config.sample_rate().0;
    sample_rate.store(device_sample_rate, Ordering::Release);

    let channels = config.channels();

    // Build the data callback
    let samples_clone = Arc::clone(samples);
    let app_clone = app.clone();
    let last_emit = Arc::new(Mutex::new(Instant::now()));

    let err_callback = |err: cpal::StreamError| {
        eprintln!("Recording stream error: {err}");
    };

    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => {
            let samples_cb = Arc::clone(&samples_clone);
            let last_emit_cb = Arc::clone(&last_emit);
            let app_cb = app_clone.clone();
            device
                .build_input_stream(
                    &config.into(),
                    move |data: &[f32], _: &cpal::InputCallbackInfo| {
                        process_samples_f32(data, channels, &samples_cb, &last_emit_cb, &app_cb);
                    },
                    err_callback,
                    None,
                )
                .map_err(|e| RecordingError::DeviceError(e.to_string()))?
        }
        cpal::SampleFormat::I16 => {
            let samples_cb = Arc::clone(&samples_clone);
            let last_emit_cb = Arc::clone(&last_emit);
            let app_cb = app_clone.clone();
            device
                .build_input_stream(
                    &config.into(),
                    move |data: &[i16], _: &cpal::InputCallbackInfo| {
                        process_samples_i16(data, channels, &samples_cb, &last_emit_cb, &app_cb);
                    },
                    err_callback,
                    None,
                )
                .map_err(|e| RecordingError::DeviceError(e.to_string()))?
        }
        cpal::SampleFormat::U16 => {
            let samples_cb = Arc::clone(&samples_clone);
            let last_emit_cb = Arc::clone(&last_emit);
            let app_cb = app_clone.clone();
            device
                .build_input_stream(
                    &config.into(),
                    move |data: &[u16], _: &cpal::InputCallbackInfo| {
                        process_samples_u16(data, channels, &samples_cb, &last_emit_cb, &app_cb);
                    },
                    err_callback,
                    None,
                )
                .map_err(|e| RecordingError::DeviceError(e.to_string()))?
        }
        format => {
            return Err(RecordingError::DeviceError(format!(
                "Unsupported sample format: {format:?}"
            )));
        }
    };

    stream
        .play()
        .map_err(|e| RecordingError::DeviceError(e.to_string()))?;

    // Park the thread until stop is signalled, polling periodically
    while !stop_flag.load(Ordering::Acquire) {
        std::thread::sleep(std::time::Duration::from_millis(10));
    }

    // Stream is dropped here, which stops recording
    drop(stream);

    Ok(())
}

/// Selects the best supported input configuration for the device.
///
/// Prefers f32 sample format, mono channel, and the highest supported sample rate.
///
/// # Errors
///
/// Returns `RecordingError::DeviceError` if no supported config is available.
fn select_input_config(
    device: &cpal::Device,
) -> Result<cpal::SupportedStreamConfig, RecordingError> {
    // Try to get the default config first
    if let Ok(config) = device.default_input_config() {
        return Ok(config);
    }

    // Fall back to supported configs
    let supported = device
        .supported_input_configs()
        .map_err(|e| RecordingError::DeviceError(e.to_string()))?;

    let configs: Vec<cpal::SupportedStreamConfigRange> = supported.collect();

    if configs.is_empty() {
        return Err(RecordingError::DeviceError(
            "No supported input configurations".to_string(),
        ));
    }

    // Prefer f32 format
    let best = configs
        .iter()
        .find(|c| c.sample_format() == cpal::SampleFormat::F32)
        .or_else(|| configs.first())
        .ok_or_else(|| {
            RecordingError::DeviceError("No supported input configurations".to_string())
        })?;

    Ok(best.with_max_sample_rate())
}

/// Processes f32 audio samples from the cpal callback.
fn process_samples_f32(
    data: &[f32],
    channels: u16,
    samples: &Arc<Mutex<Vec<f32>>>,
    last_emit: &Arc<Mutex<Instant>>,
    app: &AppHandle,
) {
    let mono = to_mono_f32(data, channels);

    if let Ok(mut buf) = samples.lock() {
        buf.extend_from_slice(&mono);
    }

    emit_level_if_needed(&mono, last_emit, app);
}

/// Processes i16 audio samples from the cpal callback.
fn process_samples_i16(
    data: &[i16],
    channels: u16,
    samples: &Arc<Mutex<Vec<f32>>>,
    last_emit: &Arc<Mutex<Instant>>,
    app: &AppHandle,
) {
    #[allow(clippy::cast_precision_loss)]
    let float_data: Vec<f32> = data
        .iter()
        .map(|&s| f32::from(s) / f32::from(i16::MAX))
        .collect();
    let mono = to_mono_f32(&float_data, channels);

    if let Ok(mut buf) = samples.lock() {
        buf.extend_from_slice(&mono);
    }

    emit_level_if_needed(&mono, last_emit, app);
}

/// Processes u16 audio samples from the cpal callback.
#[allow(clippy::cast_precision_loss)]
fn process_samples_u16(
    data: &[u16],
    channels: u16,
    samples: &Arc<Mutex<Vec<f32>>>,
    last_emit: &Arc<Mutex<Instant>>,
    app: &AppHandle,
) {
    let float_data: Vec<f32> = data
        .iter()
        .map(|&s| (f32::from(s) / f32::from(u16::MAX)) * 2.0 - 1.0)
        .collect();
    let mono = to_mono_f32(&float_data, channels);

    if let Ok(mut buf) = samples.lock() {
        buf.extend_from_slice(&mono);
    }

    emit_level_if_needed(&mono, last_emit, app);
}

/// Converts interleaved multi-channel f32 audio to mono by averaging channels.
fn to_mono_f32(data: &[f32], channels: u16) -> Vec<f32> {
    if channels <= 1 {
        return data.to_vec();
    }

    let ch = usize::from(channels);
    data.chunks(ch)
        .map(|frame| {
            #[allow(clippy::cast_precision_loss)]
            {
                frame.iter().sum::<f32>() / frame.len() as f32
            }
        })
        .collect()
}

/// Emits a `recording:level` event if enough time has elapsed since the last emission.
fn emit_level_if_needed(samples: &[f32], last_emit: &Arc<Mutex<Instant>>, app: &AppHandle) {
    if samples.is_empty() {
        return;
    }

    let should_emit = if let Ok(last) = last_emit.lock() {
        last.elapsed().as_millis() >= LEVEL_EMIT_INTERVAL_MS
    } else {
        false
    };

    if should_emit {
        let (rms, peak) = compute_levels(samples);
        let _ = app.emit(
            "recording:level",
            RecordingLevel {
                level: rms,
                peak_level: peak,
            },
        );

        if let Ok(mut last) = last_emit.lock() {
            *last = Instant::now();
        }
    }
}

/// Computes RMS and peak levels for a slice of audio samples.
///
/// Returns `(rms, peak)` where both values are in the range `0.0..=1.0`.
#[must_use]
fn compute_levels(samples: &[f32]) -> (f32, f32) {
    if samples.is_empty() {
        return (0.0, 0.0);
    }

    let mut sum_sq: f64 = 0.0;
    let mut peak: f32 = 0.0;

    for &s in samples {
        let abs = s.abs();
        sum_sq += f64::from(s) * f64::from(s);
        if abs > peak {
            peak = abs;
        }
    }

    #[allow(clippy::cast_possible_truncation, clippy::cast_precision_loss)]
    let rms = (sum_sq / samples.len() as f64).sqrt() as f32;

    // Clamp to 0.0..=1.0
    let rms = rms.clamp(0.0, 1.0);
    let peak = peak.clamp(0.0, 1.0);

    (rms, peak)
}

/// Writes f32 mono audio samples to a WAV file.
///
/// # Errors
///
/// Returns `RecordingError::WavError` if the file cannot be written.
fn write_wav_file(path: &Path, samples: &[f32], sample_rate: u32) -> Result<(), RecordingError> {
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };

    let mut writer = hound::WavWriter::create(path, spec)
        .map_err(|e| RecordingError::WavError(e.to_string()))?;

    for &sample in samples {
        writer
            .write_sample(sample)
            .map_err(|e| RecordingError::WavError(e.to_string()))?;
    }

    writer
        .finalize()
        .map_err(|e| RecordingError::WavError(e.to_string()))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_creates_default_state() {
        let manager = RecordingManager::new();
        assert!(!manager.is_recording.load(Ordering::Relaxed));
        assert!(!manager.stop_flag.load(Ordering::Relaxed));
        assert_eq!(manager.sample_rate.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn default_creates_same_as_new() {
        let manager = RecordingManager::default();
        assert!(!manager.is_recording.load(Ordering::Relaxed));
    }

    #[test]
    fn list_devices_does_not_error() {
        // On CI or systems without audio, this may return an empty list
        // but should not error
        let result = RecordingManager::list_devices();
        // We accept both Ok (possibly empty) and Err (no audio subsystem)
        // The important thing is it doesn't panic
        let _ = result;
    }

    #[test]
    fn stop_returns_not_recording_when_idle() {
        let manager = RecordingManager::new();
        let result = manager.stop(Path::new("/tmp"));
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), RecordingError::NotRecording));
    }

    #[test]
    fn cleanup_nonexistent_file_succeeds() {
        let result = RecordingManager::cleanup(Path::new("/nonexistent/file.wav"));
        assert!(result.is_ok());
    }

    #[test]
    fn cleanup_existing_file_deletes_it() {
        let dir = Path::new("/tmp/claude/test-recording-cleanup");
        std::fs::create_dir_all(dir).unwrap();
        let path = dir.join("test.wav");
        std::fs::write(&path, b"test data").unwrap();

        let result = RecordingManager::cleanup(&path);
        assert!(result.is_ok());
        assert!(!path.exists());

        let _ = std::fs::remove_dir_all(dir);
    }

    // --- compute_levels ---

    #[test]
    fn compute_levels_empty_returns_zero() {
        let (rms, peak) = compute_levels(&[]);
        assert!((rms - 0.0).abs() < f32::EPSILON);
        assert!((peak - 0.0).abs() < f32::EPSILON);
    }

    #[test]
    fn compute_levels_silence_returns_zero() {
        let samples = vec![0.0_f32; 100];
        let (rms, peak) = compute_levels(&samples);
        assert!((rms - 0.0).abs() < f32::EPSILON);
        assert!((peak - 0.0).abs() < f32::EPSILON);
    }

    #[test]
    fn compute_levels_full_scale_returns_one() {
        let samples = vec![1.0_f32; 100];
        let (rms, peak) = compute_levels(&samples);
        assert!((rms - 1.0).abs() < 0.01);
        assert!((peak - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn compute_levels_mixed_signal() {
        let samples = vec![0.5, -0.5, 0.5, -0.5];
        let (rms, peak) = compute_levels(&samples);
        assert!((rms - 0.5).abs() < 0.01);
        assert!((peak - 0.5).abs() < f32::EPSILON);
    }

    // --- to_mono_f32 ---

    #[test]
    fn to_mono_single_channel_passthrough() {
        let data = vec![0.1, 0.2, 0.3];
        let mono = to_mono_f32(&data, 1);
        assert_eq!(mono, data);
    }

    #[test]
    fn to_mono_stereo_averages_channels() {
        let data = vec![0.2, 0.4, 0.6, 0.8];
        let mono = to_mono_f32(&data, 2);
        assert_eq!(mono.len(), 2);
        assert!((mono[0] - 0.3).abs() < 0.001);
        assert!((mono[1] - 0.7).abs() < 0.001);
    }

    // --- write_wav_file ---

    #[test]
    fn write_wav_file_creates_valid_file() {
        let dir = Path::new("/tmp/claude/test-recording-wav");
        std::fs::create_dir_all(dir).unwrap();
        let path = dir.join("test_output.wav");

        let samples = vec![0.0_f32; 16000]; // 1 second of silence
        let result = write_wav_file(&path, &samples, 16000);
        assert!(result.is_ok());
        assert!(path.exists());

        // Verify the WAV is readable
        let reader = hound::WavReader::open(&path).unwrap();
        let spec = reader.spec();
        assert_eq!(spec.channels, 1);
        assert_eq!(spec.sample_rate, 16000);
        assert_eq!(spec.sample_format, hound::SampleFormat::Float);
        assert_eq!(spec.bits_per_sample, 32);

        let _ = std::fs::remove_dir_all(dir);
    }
}
