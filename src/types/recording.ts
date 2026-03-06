export interface AudioDevice {
  id: string;
  name: string;
  isDefault: boolean;
}

export interface RecordingLevel {
  level: number;
  peakLevel: number;
}

export interface RecordingStopResult {
  tempFilePath: string;
  durationMs: number;
  sampleCount: number;
}
