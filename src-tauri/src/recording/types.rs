use serde::{Deserialize, Serialize};

/// An available audio input device.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AudioDevice {
    /// Unique device identifier.
    pub id: String,
    /// Human-readable device name.
    pub name: String,
    /// Whether this is the system default input device.
    pub is_default: bool,
}

/// Real-time audio level information emitted during recording.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecordingLevel {
    /// RMS level (0.0 - 1.0).
    pub level: f32,
    /// Peak level (0.0 - 1.0).
    pub peak_level: f32,
}

/// Result returned when recording is stopped.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecordingStopResult {
    /// Path to the temporary WAV file.
    pub temp_file_path: String,
    /// Duration of the recording in milliseconds.
    pub duration_ms: u64,
    /// Total number of samples recorded (before resampling).
    pub sample_count: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn audio_device_serializes_to_camel_case() {
        let device = AudioDevice {
            id: "device-1".to_string(),
            name: "Built-in Microphone".to_string(),
            is_default: true,
        };

        let json = serde_json::to_string(&device).expect("Failed to serialize");
        assert!(json.contains("\"isDefault\":true"));
        assert!(json.contains("\"id\":\"device-1\""));
        assert!(json.contains("\"name\":\"Built-in Microphone\""));
    }

    #[test]
    fn audio_device_deserializes_from_camel_case() {
        let json = r#"{"id":"dev-2","name":"USB Mic","isDefault":false}"#;
        let device: AudioDevice = serde_json::from_str(json).expect("Failed to deserialize");
        assert_eq!(device.id, "dev-2");
        assert_eq!(device.name, "USB Mic");
        assert!(!device.is_default);
    }

    #[test]
    fn recording_level_serializes_to_camel_case() {
        let level = RecordingLevel {
            level: 0.5,
            peak_level: 0.8,
        };

        let json = serde_json::to_string(&level).expect("Failed to serialize");
        assert!(json.contains("\"peakLevel\":"));
        assert!(json.contains("\"level\":"));
    }

    #[test]
    fn recording_level_deserializes_from_camel_case() {
        let json = r#"{"level":0.3,"peakLevel":0.9}"#;
        let level: RecordingLevel = serde_json::from_str(json).expect("Failed to deserialize");
        assert!((level.level - 0.3).abs() < f32::EPSILON);
        assert!((level.peak_level - 0.9).abs() < f32::EPSILON);
    }

    #[test]
    fn recording_stop_result_serializes_to_camel_case() {
        let result = RecordingStopResult {
            temp_file_path: "/tmp/recording.wav".to_string(),
            duration_ms: 5000,
            sample_count: 80_000,
        };

        let json = serde_json::to_string(&result).expect("Failed to serialize");
        assert!(json.contains("\"tempFilePath\":\"/tmp/recording.wav\""));
        assert!(json.contains("\"durationMs\":5000"));
        assert!(json.contains("\"sampleCount\":80000"));
    }

    #[test]
    fn recording_stop_result_deserializes_from_camel_case() {
        let json = r#"{"tempFilePath":"/tmp/rec.wav","durationMs":3000,"sampleCount":48000}"#;
        let result: RecordingStopResult =
            serde_json::from_str(json).expect("Failed to deserialize");
        assert_eq!(result.temp_file_path, "/tmp/rec.wav");
        assert_eq!(result.duration_ms, 3000);
        assert_eq!(result.sample_count, 48000);
    }
}
