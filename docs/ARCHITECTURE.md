# Whisper Tauri - アーキテクチャ設計

システム構成とデータフローの詳細

---

## システム概要図

```
+-------------------------------------------------------------------------+
|                       Whisper Tauri (SolidJS)                           |
+-------------------------------------------------------------------------+
|  フロントエンド (SolidJS + TypeScript)                                  |
|  +-------------+ +------------------+ +-----------------------------+   |
|  |   App.tsx   | |    Primitives    | |        Components          |   |
|  | (ルーティング)| |createWhisper    | | layout/    (Sidebar等)     |   |
|  |             | |createSettings   | | dashboard/ (QuickActions等) |   |
|  |             | |createRecording  | | transcription/ (結果表示等) |   |
|  |             | |createToast      | | history/   (履歴一覧等)     |   |
|  |             | |createHistory    | | text-processing/ (校正等)   |   |
|  |             | |createTextProc   | | dev/       (開発メニュー)   |   |
|  |             | |createConverter  | | ui/        (Button等)       |   |
|  +-------------+ +------------------+ +-----------------------------+   |
|                         |                                               |
|              Tauri API Bridge (invoke/listen)                           |
+-------------------------------------------------------------------------+
|  バックエンド (Rust + Tauri 2)                                          |
|  +----------------+ +----------------+ +----------------+               |
|  | whisper module | |converter module| | history module |               |
|  | commands.rs    | | ffmpeg.rs      | | db.rs          |               |
|  | process.rs     | | downloader.rs  | | search.rs      |               |
|  | types.rs       | | types.rs       | | types.rs       |               |
|  +----------------+ +----------------+ +----------------+               |
|  +----------------+ +------------------+                                |
|  |recording module| |text_proc module |                                |
|  | capture.rs     | | server.rs       |                                |
|  | commands.rs    | | commands.rs     |                                |
|  +----------------+ +------------------+                                |
|                         |                                               |
|      whisper-rs    /    cpal    /   rusqlite   /   llama-server        |
+-------------------------------------------------------------------------+
```

---

## レイヤー構成

### 1. プレゼンテーション層 (フロントエンド)

```
src/
├── components/           # UIコンポーネント
│   ├── ui/              # solid-ui ベースの共通UI
│   ├── layout/          # レイアウト (Sidebar, AppLayout)
│   ├── dashboard/       # ダッシュボード
│   ├── transcription/   # 文字起こし関連
│   ├── recording/       # 録音関連
│   ├── history/         # 履歴関連
│   ├── text-processing/ # テキスト処理 (校正・要約)
│   └── dev/             # 開発メニュー (DEV only)
├── pages/               # ページコンポーネント
├── primitives/          # 状態管理
├── lib/                 # ユーティリティ
├── types/               # 型定義
└── i18n/                # 多言語対応
```

**UIコンポーネント方針**:
- [solid-ui](https://www.solid-ui.com/) のコンポーネントを `components/ui/` にコピーして使用
- デフォルトスタイルを可能な限り維持し、統一感を保つ

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
├── recording/
│   ├── commands.rs      # 録音コマンド
│   ├── capture.rs       # 音声キャプチャ
│   └── types.rs         # 型定義
├── converter/
│   ├── commands.rs      # 変換コマンド
│   ├── ffmpeg.rs        # ffmpeg連携
│   ├── downloader.rs    # ffmpegダウンローダー
│   └── types.rs         # 型定義
├── history/
│   ├── commands.rs      # 履歴コマンド
│   ├── db.rs            # SQLite操作
│   ├── search.rs        # FTS5全文検索
│   └── types.rs         # 型定義
└── text_processing/
    ├── commands.rs      # テキスト処理コマンド
    ├── server.rs        # llama-server管理
    └── types.rs         # 型定義
```

**責務:**
- ビジネスロジック
- 外部ライブラリ (whisper-rs, rusqlite等) との連携
- ファイルI/O
- 非同期タスク管理
- サブプロセス管理 (llama-server)

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
  samples: Float32Array | null;
}

// createHistory - 履歴状態
interface HistoryState {
  entries: HistoryEntry[];
  searchQuery: string;
  isLoading: boolean;
}

// createTextProcessing - テキスト処理状態
interface TextProcessingState {
  models: TextModel[];
  isServerRunning: boolean;
  isProcessing: boolean;
  result: ProofreadResult | SummaryResult | null;
}

// createFileConverter - ファイル変換状態
interface ConverterState {
  isConverting: boolean;
  progress: number;
  ffmpegAvailable: boolean;
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

1. **ストリーミング文字起こし** - リアルタイム処理（録音中に逐次文字起こし）
2. **バッチ処理** - 複数ファイル一括処理
3. **クラウド同期** - オプトイン方式での履歴同期
4. **プラグインシステム** - カスタム後処理

### 拡張ポイント

- `primitives/` - 新しい状態管理の追加
- `components/` - 新しいUIの追加
- `pages/` - 新しいページの追加
- `src-tauri/src/` - 新しいRustモジュールの追加

### 計画済みの機能

詳細は [features/](./features/) を参照:

- ダッシュボード・サイドバーレイアウト
- ファイル変換（ffmpegによるMP3/MP4等の変換）
- 履歴管理・全文検索
- テキスト処理（ローカルSLMによる校正・要約）
- リアルタイム録音
- 多言語対応（i18n）
- キーボードショートカット
