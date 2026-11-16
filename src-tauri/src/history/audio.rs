//! Recording audio kept alongside history entries.
//!
//! A recording's WAV moves from `recordings/` (untranscribed) to
//! `audio/{history_id}.wav` once its transcription is saved. The path is
//! derived from the entry id, so the database holds no reference to it.

use std::path::{Path, PathBuf};

use crate::recording::capture::recordings_dir;

use super::error::HistoryError;
use super::types::StorageStats;

fn audio_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("audio")
}

/// Returns where the audio of entry `id` lives, whether or not it exists.
///
/// The id becomes a file name, so only a UUID is accepted: it cannot carry a
/// path separator or `..`.
///
/// # Errors
///
/// Returns `HistoryError::NotFound` if `id` is not a UUID.
fn audio_path(app_data_dir: &Path, id: &str) -> Result<PathBuf, HistoryError> {
    let uuid = uuid::Uuid::parse_str(id).map_err(|_| HistoryError::NotFound(id.to_string()))?;
    Ok(audio_dir(app_data_dir).join(format!("{uuid}.wav")))
}

/// Returns the audio file of entry `id`, if it has one.
#[must_use]
pub(crate) fn existing_audio(app_data_dir: &Path, id: &str) -> Option<PathBuf> {
    audio_path(app_data_dir, id)
        .ok()
        .filter(|path| path.is_file())
}

/// Gives entry `to_id` a copy of the audio of entry `from_id` — a
/// re-transcription is a new entry over the same recording.
///
/// # Errors
///
/// Returns `HistoryError::NotFound` if either id is not a UUID, or
/// `HistoryError::Io` if the source has no audio or the copy fails.
pub(crate) fn copy_audio(
    app_data_dir: &Path,
    from_id: &str,
    to_id: &str,
) -> Result<(), HistoryError> {
    let source = audio_path(app_data_dir, from_id)?;
    let target = audio_path(app_data_dir, to_id)?;
    // Copying a file onto itself truncates it.
    if source == target {
        return Ok(());
    }
    if let Err(e) = std::fs::copy(&source, &target) {
        // A partial file would pass for the entry's audio.
        let _ = std::fs::remove_file(&target);
        return Err(e.into());
    }
    Ok(())
}

/// Moves an untranscribed recording to become the audio of entry `id`.
///
/// `recording_path` must resolve to a file directly inside the recordings
/// directory. It is canonicalized before the check because comparing path
/// components literally would accept a `..` escape.
///
/// # Errors
///
/// Returns `HistoryError::NotFound` if `id` is not a UUID, or
/// `HistoryError::Io` if the path is outside the recordings directory or the
/// file cannot be moved.
pub(crate) fn attach_recording(
    app_data_dir: &Path,
    id: &str,
    recording_path: &Path,
) -> Result<(), HistoryError> {
    let target = audio_path(app_data_dir, id)?;

    let real_path = std::fs::canonicalize(recording_path)?;
    let real_recordings_dir = std::fs::canonicalize(recordings_dir(app_data_dir))?;
    if real_path.parent() != Some(real_recordings_dir.as_path()) {
        return Err(HistoryError::Io(std::io::Error::new(
            std::io::ErrorKind::PermissionDenied,
            "path is outside the recordings directory",
        )));
    }

    std::fs::create_dir_all(audio_dir(app_data_dir))?;
    std::fs::rename(&real_path, &target)?;
    Ok(())
}

/// Deletes the audio of entry `id`, if it has any. An id that is not a UUID
/// cannot have audio, so there is nothing to delete.
///
/// # Errors
///
/// Returns `HistoryError::Io` if the file exists but cannot be deleted.
pub(crate) fn delete_audio(app_data_dir: &Path, id: &str) -> Result<(), HistoryError> {
    let Ok(path) = audio_path(app_data_dir, id) else {
        return Ok(());
    };
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.into()),
    }
}

/// Lists the WAV files directly inside `dir`; a missing directory is empty.
fn wav_files(dir: &Path) -> Result<Vec<PathBuf>, HistoryError> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(e.into()),
    };
    let mut files = Vec::new();
    for entry in entries {
        let path = entry?.path();
        if path.is_file() && path.extension().is_some_and(|ext| ext == "wav") {
            files.push(path);
        }
    }
    Ok(files)
}

/// Deletes the audio of every entry.
///
/// # Errors
///
/// Returns `HistoryError::Io` if the directory cannot be read or a file
/// cannot be deleted.
pub(crate) fn delete_all_audio(app_data_dir: &Path) -> Result<(), HistoryError> {
    for path in wav_files(&audio_dir(app_data_dir))? {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

/// Lists untranscribed recordings, except `keep` — the recording the current
/// session still holds, if any.
fn pending_recordings(
    app_data_dir: &Path,
    keep: Option<&Path>,
) -> Result<Vec<PathBuf>, HistoryError> {
    let keep = keep.and_then(|path| std::fs::canonicalize(path).ok());
    let mut files = wav_files(&recordings_dir(app_data_dir))?;
    if keep.is_some() {
        files.retain(|path| std::fs::canonicalize(path).ok() != keep);
    }
    Ok(files)
}

/// Deletes untranscribed recordings, except `keep`.
///
/// # Errors
///
/// Returns `HistoryError::Io` if the directory cannot be read or a file
/// cannot be deleted.
pub(crate) fn delete_pending_recordings(
    app_data_dir: &Path,
    keep: Option<&Path>,
) -> Result<(), HistoryError> {
    for path in pending_recordings(app_data_dir, keep)? {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

fn usage(files: &[PathBuf]) -> Result<(u64, u64), HistoryError> {
    let mut bytes = 0;
    for path in files {
        bytes += std::fs::metadata(path)?.len();
    }
    Ok((files.len() as u64, bytes))
}

/// Reports how much disk the kept audio and the untranscribed recordings use.
///
/// `keep` is left out of the pending count for the same reason
/// [`delete_pending_recordings`] spares it: the count is what that delete
/// would remove.
///
/// # Errors
///
/// Returns `HistoryError::Io` if a directory or file cannot be read.
pub(crate) fn storage_stats(
    app_data_dir: &Path,
    keep: Option<&Path>,
) -> Result<StorageStats, HistoryError> {
    let (audio_count, audio_bytes) = usage(&wav_files(&audio_dir(app_data_dir))?)?;
    let (pending_recording_count, pending_recording_bytes) =
        usage(&pending_recordings(app_data_dir, keep)?)?;
    Ok(StorageStats {
        audio_count,
        audio_bytes,
        pending_recording_count,
        pending_recording_bytes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    const ID: &str = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const OTHER_ID: &str = "550e8400-e29b-41d4-a716-446655440000";

    fn has_audio(app_data_dir: &Path, id: &str) -> bool {
        existing_audio(app_data_dir, id).is_some()
    }

    /// Creates an app data dir holding one untranscribed recording.
    fn setup() -> (TempDir, PathBuf) {
        let dir = TempDir::new().expect("create temp dir");
        let recordings = recordings_dir(dir.path());
        std::fs::create_dir_all(&recordings).expect("create recordings dir");
        let recording = recordings.join("rec.wav");
        std::fs::write(&recording, b"12345").expect("write recording");
        (dir, recording)
    }

    #[test]
    fn attach_moves_the_recording_to_the_entry() {
        let (dir, recording) = setup();
        assert!(!has_audio(dir.path(), ID));

        attach_recording(dir.path(), ID, &recording).expect("attach");

        assert!(has_audio(dir.path(), ID));
        assert!(!recording.exists());
        assert!(!has_audio(dir.path(), OTHER_ID));
    }

    #[test]
    fn attach_rejects_an_id_that_is_not_a_uuid() {
        let (dir, recording) = setup();

        let err = attach_recording(dir.path(), "../escape", &recording).expect_err("must reject");

        assert!(matches!(err, HistoryError::NotFound(_)));
        assert!(recording.exists());
    }

    #[test]
    fn attach_rejects_a_file_outside_the_recordings_directory() {
        let (dir, _recording) = setup();
        let outside = dir.path().join("outside.wav");
        std::fs::write(&outside, b"x").expect("write outside file");

        let err = attach_recording(dir.path(), ID, &outside).expect_err("must reject");

        assert!(matches!(err, HistoryError::Io(_)));
        assert!(outside.exists());
        assert!(!has_audio(dir.path(), ID));
    }

    #[test]
    fn attach_rejects_a_dot_dot_escape_from_the_recordings_directory() {
        let (dir, _recording) = setup();
        std::fs::write(dir.path().join("outside.wav"), b"x").expect("write outside file");
        let escaping = recordings_dir(dir.path()).join("..").join("outside.wav");

        let err = attach_recording(dir.path(), ID, &escaping).expect_err("must reject");

        assert!(matches!(err, HistoryError::Io(_)));
    }

    #[test]
    fn copy_audio_gives_the_new_entry_its_own_file() {
        let (dir, recording) = setup();
        attach_recording(dir.path(), ID, &recording).expect("attach");

        copy_audio(dir.path(), ID, OTHER_ID).expect("copy");
        delete_audio(dir.path(), ID).expect("delete the original");

        let copied = existing_audio(dir.path(), OTHER_ID).expect("copy survives");
        assert_eq!(std::fs::read(copied).expect("read"), b"12345");
    }

    #[test]
    fn copy_audio_onto_the_same_entry_leaves_the_audio_intact() {
        let (dir, recording) = setup();
        attach_recording(dir.path(), ID, &recording).expect("attach");

        copy_audio(dir.path(), ID, ID).expect("copy onto itself");

        let audio = existing_audio(dir.path(), ID).expect("audio survives");
        assert_eq!(std::fs::read(audio).expect("read"), b"12345");
    }

    #[test]
    fn copy_audio_fails_when_the_source_has_no_audio() {
        let (dir, _recording) = setup();

        let err = copy_audio(dir.path(), ID, OTHER_ID).expect_err("must fail");

        assert!(matches!(err, HistoryError::Io(_)));
        assert!(!has_audio(dir.path(), OTHER_ID));
    }

    #[test]
    fn delete_audio_removes_only_that_entry() {
        let (dir, recording) = setup();
        attach_recording(dir.path(), ID, &recording).expect("attach");
        let second = recordings_dir(dir.path()).join("second.wav");
        std::fs::write(&second, b"x").expect("write recording");
        attach_recording(dir.path(), OTHER_ID, &second).expect("attach");

        delete_audio(dir.path(), ID).expect("delete");

        assert!(!has_audio(dir.path(), ID));
        assert!(has_audio(dir.path(), OTHER_ID));
    }

    #[test]
    fn delete_audio_succeeds_when_the_entry_has_none() {
        let (dir, _recording) = setup();
        delete_audio(dir.path(), ID).expect("delete with no audio");
    }

    #[test]
    fn delete_all_audio_leaves_untranscribed_recordings() {
        let (dir, recording) = setup();
        attach_recording(dir.path(), ID, &recording).expect("attach");
        let pending = recordings_dir(dir.path()).join("pending.wav");
        std::fs::write(&pending, b"x").expect("write recording");

        delete_all_audio(dir.path()).expect("delete all");

        assert!(!has_audio(dir.path(), ID));
        assert!(pending.exists());
    }

    #[test]
    fn delete_pending_recordings_keeps_the_one_in_use() {
        let (dir, recording) = setup();
        let orphan = recordings_dir(dir.path()).join("orphan.wav");
        std::fs::write(&orphan, b"x").expect("write recording");

        delete_pending_recordings(dir.path(), Some(&recording)).expect("delete pending");

        assert!(recording.exists());
        assert!(!orphan.exists());

        delete_pending_recordings(dir.path(), None).expect("delete pending");
        assert!(!recording.exists());
    }

    #[test]
    fn storage_stats_counts_audio_and_pending_recordings_separately() {
        let (dir, recording) = setup();
        attach_recording(dir.path(), ID, &recording).expect("attach");
        std::fs::write(recordings_dir(dir.path()).join("pending.wav"), b"123")
            .expect("write recording");

        let stats = storage_stats(dir.path(), None).expect("stats");

        assert_eq!(
            stats,
            StorageStats {
                audio_count: 1,
                audio_bytes: 5,
                pending_recording_count: 1,
                pending_recording_bytes: 3,
            }
        );
    }

    #[test]
    fn attach_replaces_the_existing_audio_of_the_entry() {
        let (dir, recording) = setup();
        attach_recording(dir.path(), ID, &recording).expect("attach");
        let second = recordings_dir(dir.path()).join("second.wav");
        std::fs::write(&second, b"xyz").expect("write recording");

        attach_recording(dir.path(), ID, &second).expect("attach again");

        assert!(has_audio(dir.path(), ID));
        assert!(!second.exists());
        let stats = storage_stats(dir.path(), None).expect("stats");
        assert_eq!(stats.audio_count, 1);
        assert_eq!(stats.audio_bytes, 3);
    }

    #[cfg(unix)]
    #[test]
    fn attach_rejects_a_symlink_in_recordings_that_points_outside_it() {
        let (dir, _recording) = setup();
        let outside = dir.path().join("outside.wav");
        std::fs::write(&outside, b"x").expect("write outside file");
        let link = recordings_dir(dir.path()).join("link.wav");
        std::os::unix::fs::symlink(&outside, &link).expect("create symlink");

        let err = attach_recording(dir.path(), ID, &link).expect_err("must reject");

        assert!(matches!(err, HistoryError::Io(_)));
        assert!(outside.exists());
        assert!(!has_audio(dir.path(), ID));
    }

    #[test]
    fn delete_all_audio_ignores_files_that_are_not_wav() {
        let (dir, recording) = setup();
        attach_recording(dir.path(), ID, &recording).expect("attach");
        let notes = audio_dir(dir.path()).join("notes.txt");
        std::fs::write(&notes, b"x").expect("write notes");

        delete_all_audio(dir.path()).expect("delete all");

        assert!(!has_audio(dir.path(), ID));
        assert!(notes.exists());
    }

    #[test]
    fn delete_audio_touches_nothing_for_an_id_that_is_not_a_uuid() {
        let (dir, recording) = setup();

        delete_audio(dir.path(), "../recordings/rec").expect("nothing to delete");

        assert!(recording.exists());
    }

    #[test]
    fn storage_stats_leaves_out_the_recording_in_use() {
        let (dir, recording) = setup();
        std::fs::write(recordings_dir(dir.path()).join("orphan.wav"), b"123")
            .expect("write recording");

        let stats = storage_stats(dir.path(), Some(&recording)).expect("stats");

        assert_eq!(stats.pending_recording_count, 1);
        assert_eq!(stats.pending_recording_bytes, 3);
    }

    #[test]
    fn storage_stats_is_zero_before_anything_was_recorded() {
        let dir = TempDir::new().expect("create temp dir");
        assert_eq!(
            storage_stats(dir.path(), None).expect("stats"),
            StorageStats {
                audio_count: 0,
                audio_bytes: 0,
                pending_recording_count: 0,
                pending_recording_bytes: 0,
            }
        );
    }
}
