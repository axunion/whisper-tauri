# Whisper Local - アーキテクチャ設計

システム構成とデータフローの詳細

---

## システム概要図

```
+---------------------------------------------------------------------+
|                       Whisper Local (SolidJS)                       |
+---------------------------------------------------------------------+
|  フロントエンド (SolidJS + TypeScript)                              |
|  +-------------+ +---------------+ +------------------------+       |
|  |   App.tsx   | |   Primitives  | |      Components       |       |
|  |  (ルート)   | |createWhisper  | | FileSelector          |       |
|  |             | |createSettings | | ProgressBar           |       |
|  |             | |createRecording| | ResultViewer          |       |
|  |             | |createToast    | | ModelSelector         |       |
|  +-------------+ +---------------+ +------------------------+       |
|                         |                                           |
|              Tauri API Bridge (invoke/listen)                       |
+---------------------------------------------------------------------+
|  バックエンド (Rust + Tauri 2)                                      |
|  +--------------------+ +---------------------+                     |
|  |   whisper module   | |   recording module  |                     |
|  | commands.rs        | | capture.rs          |                     |
|  | process.rs         | | commands.rs         |                     |
|  | types.rs           | | types.rs            |                     |
|  | error.rs           | |                     |                     |
|  +--------------------+ +---------------------+                     |
|                         |                                           |
|                    whisper-rs (whisper.cpp)                         |
+---------------------------------------------------------------------+
```

---

## レイヤー構成

### 1. プレゼンテーション層 (フロントエンド)

```
src/
├── components/           # UIコンポーネント
│   ├── ui/              # 基本UI (Kobalte)
│   ├── transcription/   # 文字起こし関連
│   └── recording/       # 録音関連
├── primitives/          # 状態管理
├── lib/                 # ユーティリティ
├── types/               # 型定義
└── i18n/                # 多言語対応
```

**責務:**
- ユーザーインターフェース
- 状態管理
- Tauri APIとの通信
- エラー表示

### 2. IPC層 (Tauri Bridge)

```typescript
// コマンド呼び出し
invoke<T>(command: string, args?: object): Promise<T>

// イベント購読
listen<T>(event: string, handler: (payload: T) => void): Promise<UnlistenFn>
```

**責務:**
- フロントエンド ↔ バックエンド通信
- 型安全なデータ変換
- エラー伝搬

### 3. アプリケーション層 (Rust バックエンド)

```
src-tauri/src/
├── whisper/
│   ├── commands.rs      # Tauriコマンド
│   ├── process.rs       # 文字起こし処理
│   ├── types.rs         # 型定義
│   └── error.rs         # エラー型
└── recording/
    ├── commands.rs      # 録音コマンド
    ├── capture.rs       # 音声キャプチャ
    └── types.rs         # 型定義
```

**責務:**
- ビジネスロジック
- 外部ライブラリ (whisper-rs) との連携
- ファイルI/O
- 非同期タスク管理

---

## データフロー

### 1. 文字起こしフロー

```
[ユーザー]
    │
    ▼ ファイル選択
[FileSelector]
    │
    ▼ startTranscription(filePath, modelPath)
[createWhisper] ─────────────────────────────────────┐
    │                                                │
    ▼ invoke("transcribe_audio", {...})              │
[Tauri IPC]                                          │
    │                                                │
    ▼                                                │
[commands.rs] transcribe_audio()                     │
    │                                                │
    ▼                                                │
[process.rs] TranscriptionTask::run()                │
    │                                                │
    ├──▶ emit("whisper:progress", progress) ─────────┤
    │                                                │
    ▼                                                ▼
[whisper-rs] WhisperContext::full()          [ProgressBar]
    │                                                │
    ▼                                                │
[process.rs] 完了                                    │
    │                                                │
    ▼ emit("whisper:result", result) ────────────────┤
[Tauri IPC]                                          │
    │                                                ▼
    ▼                                          [ResultViewer]
[createWhisper] setResult()
```

### 2. モデルダウンロードフロー

```
[ユーザー]
    │
    ▼ モデル選択 (未ダウンロード)
[ModelSelector]
    │
    ▼ downloadModel(modelId)
[createWhisper]
    │
    ▼ invoke("download_model", { modelId })
[Tauri IPC]
    │
    ▼
[commands.rs] download_model()
    │
    ├──▶ emit("model:download-progress", progress) ──┐
    │                                                │
    ▼                                                ▼
[reqwest] ストリーミングダウンロード          [ProgressBar]
    │
    ▼ 完了
[commands.rs] ダウンロードパス返却
    │
    ▼
[createWhisper] モデル一覧更新
```

### 3. 録音フロー

```
[ユーザー]
    │
    ▼ 録音開始
[RecordingPanel]
    │
    ▼ startRecording(deviceId)
[createRecording]
    │
    ▼ invoke("start_recording", { deviceId })
[Tauri IPC]
    │
    ▼
[commands.rs] start_recording()
    │
    ▼
[capture.rs] AudioCapture::start()
    │
    ├──▶ emit("recording:level", level) ─────────────┐
    │                                                │
    ▼                                                ▼
[cpal] オーディオストリーム                   [AudioVisualizer]
    │
    │ stopRecording()
    ▼
[capture.rs] AudioCapture::stop()
    │
    ▼ WAVファイル保存
[createRecording] setRecordedFile()
    │
    ▼ 文字起こしフローへ
```

---

## 状態管理

### Primitives (SolidJS)

```typescript
// createWhisper - 文字起こし状態
interface WhisperState {
  models: ModelInfo[];
  selectedModel: ModelInfo | null;
  file: FileInfo | null;
  progress: TranscriptionProgress | null;
  result: TranscriptionResult | null;
  isProcessing: boolean;
  error: AppError | null;
}

// createSettings - 設定状態
interface SettingsState {
  language: 'ja' | 'en';
  outputFormat: 'txt' | 'srt' | 'vtt';
  theme: 'light' | 'dark' | 'system';
  modelDir: string;
}

// createRecording - 録音状態
interface RecordingState {
  devices: AudioDevice[];
  selectedDevice: AudioDevice | null;
  isRecording: boolean;
  level: number;
  recordedFile: string | null;
}
```

### 状態遷移図 (文字起こし)

```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
┌─────────┐    ┌─────────┐    ┌────────────┐    ┌───────────┐
│  Idle   │───▶│ Loading │───▶│ Processing │───▶│ Completed │
└─────────┘    └─────────┘    └────────────┘    └───────────┘
     ▲              │               │                 │
     │              │               │                 │
     │              ▼               ▼                 │
     │         ┌─────────┐    ┌─────────┐            │
     └─────────│  Error  │◀───│Cancelled│◀───────────┘
               └─────────┘    └─────────┘
```

---

## エラーハンドリング

### エラーカテゴリ

```typescript
enum ErrorCategory {
  File = 'file',           // ファイル関連
  Model = 'model',         // モデル関連
  Process = 'process',     // 処理関連
  Network = 'network',     // ネットワーク関連
  Permission = 'permission', // 権限関連
  Unknown = 'unknown',     // 不明
}
```

### エラーフロー

```
[Rust] Error発生
    │
    ▼ thiserror でエラー型定義
[whisper/error.rs] WhisperError
    │
    ▼ serde でJSON化
[commands.rs] Result<T, String>
    │
    ▼ Tauri IPC
[フロントエンド]
    │
    ▼ parseError()
[lib/errors.ts] AppError
    │
    ├──▶ [Toast] エラー通知
    │
    └──▶ [ErrorDisplay] 詳細表示
```

---

## セキュリティ

### Tauri Capabilities

```json
{
  "permissions": [
    "core:default",
    "dialog:allow-open",
    "dialog:allow-save",
    "fs:allow-read",
    "fs:allow-write",
    "shell:default",
    "store:default"
  ]
}
```

### ファイルアクセス制限

- ユーザーが明示的に選択したファイルのみアクセス
- モデルは専用ディレクトリに保存
- 一時ファイルは使用後削除

---

## パフォーマンス考慮

### フロントエンド

- SolidJSの細粒度リアクティビティ活用
- 大きなリストは仮想化 (必要時)
- 遅延ローディング (録音モジュールなど)

### バックエンド

- 非同期タスク (tokio)
- ストリーミングダウンロード
- キャンセル可能な処理
- WAVファイルの効率的な読み込み

---

## テスト戦略

### ユニットテスト

| 対象 | テストツール | カバレッジ目標 |
|------|-------------|--------------|
| TypeScript ユーティリティ | Vitest | 90% |
| TypeScript コンポーネント | Vitest + Testing Library | 80% |
| Rust モジュール | cargo test | 80% |

### 統合テスト

- Tauri APIモック (`src/test/setup.ts`)
- E2Eテストは手動確認

---

## 将来の拡張性

### 検討中の機能

1. **ストリーミング文字起こし** - リアルタイム処理
2. **バッチ処理** - 複数ファイル一括処理
3. **クラウド同期** - オプトイン方式
4. **プラグインシステム** - カスタム後処理

### 拡張ポイント

- `primitives/` - 新しい状態管理の追加
- `components/` - 新しいUIの追加
- `src-tauri/src/` - 新しいRustモジュールの追加
