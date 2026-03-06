# リアルタイム録音機能

**カテゴリ**: 高度な機能 | **ステータス**: 完了

マイク入力からの文字起こし機能。録音 → 一時WAV保存 → 既存transcribe_audioで文字起こし。

---

## 実装概要

### データの流れ

```
録音開始 → cpal Stream (専用スレッド) → Vec<f32>蓄積
    → 録音停止 → リサンプリング(16kHz mono) → 一時WAV保存
    → [WAVとして保存?] → 文字起こし開始 → 完了後一時ファイル削除
```

### アーキテクチャ上の決定

- **データ受け渡し**: 一時ファイル経由（長時間録音のJSON膨張回避）
- **レベル取得**: イベント方式 `recording:level`（既存パターンとの一貫性）
- **cpal Stream**: 非Send のため専用スレッドで管理
- **スリープ防止**: macOS で `caffeinate -d` コマンドにより録音中のスリープを抑制
- **UI**: Transcription.tsx にファイル/録音のタブ切り替え

### 構成ファイル

#### バックエンド (src-tauri/src/recording/)

| ファイル | 説明 |
|---------|------|
| `mod.rs` | モジュール定義 |
| `types.rs` | AudioDevice, RecordingLevel, RecordingStopResult |
| `error.rs` | RecordingError enum (thiserror) |
| `capture.rs` | RecordingManager (cpal録音・WAV書き出し) |
| `sleep_guard.rs` | SleepGuard (caffeinate, macOSのみ) |
| `commands.rs` | Tauriコマンド (4コマンド) |

#### フロントエンド

| ファイル | 説明 |
|---------|------|
| `src/types/recording.ts` | TypeScript 型定義 |
| `src/primitives/createRecording.ts` | 録音プリミティブ |
| `src/components/ui/Tabs.tsx` | solid-ui Tabs コンポーネント |
| `src/components/transcription/AudioLevelMeter.tsx` | レベルメーター |
| `src/components/transcription/RecordingPanel.tsx` | 録音UI |

### Tauriコマンド

| コマンド | 説明 |
|---------|------|
| `list_audio_devices` | デバイス一覧取得 |
| `start_recording` | 録音開始 |
| `stop_recording` | 録音停止、一時WAVパス返却 |
| `cleanup_recording` | 一時ファイル削除 |

### IPCイベント

| イベント | 用途 |
|---------|------|
| `recording:level` | 録音レベル (50ms間隔、RMS + peak) |

---

## 完了条件

- [x] `cargo test` で全テスト通過 (193 tests)
- [x] `pnpm test` で全テスト通過 (296 tests)
- [x] clippy, lint, typecheck, build 全パス
- [x] マイクデバイス一覧が取得できる
- [x] 録音が開始・停止できる
- [x] 録音データを文字起こしできる
- [x] WAVエクスポートが動作する
