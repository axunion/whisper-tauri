# Step 4: whisper-rs 統合

**Phase 1: MVP** | 必須

whisper-rsを使った文字起こし機能を実装する。

---

## 目的

- whisper-rsライブラリの統合
- 非同期文字起こし処理
- キャンセル機能
- 進捗通知

---

## テスト要件

### Rust (cargo test)

`src-tauri/src/whisper/process.rs`:

| テスト | 内容 |
|-------|------|
| CancellationToken::new | 初期状態は cancelled = false |
| CancellationToken::cancel | cancel() 後は is_cancelled() = true |
| TaskManager::create_task | タスクを作成できる |
| TaskManager::cancel_task | 存在するタスクをキャンセルできる |
| TaskManager::cancel_task | 存在しないタスクは false を返す |
| TaskManager::remove_task | タスクを削除できる |
| resample | 異なるサンプルレートを変換できる |

`src-tauri/src/whisper/error.rs`:

| テスト | 内容 |
|-------|------|
| WhisperError::display | 各エラーが適切なメッセージを返す |

---

## 実装内容

### 1. 追加依存パッケージ

`src-tauri/Cargo.toml` に追加：

| パッケージ | バージョン | 用途 |
|-----------|----------|------|
| whisper-rs | 0.15 | Whisper.cppのRustバインディング |
| hound | 3 | WAVファイル読み込み |
| once_cell | 1 | グローバル状態管理 |

### 2. エラー型定義

`src-tauri/src/whisper/error.rs` に `WhisperError` 列挙型を定義：

| バリアント | 説明 |
|-----------|------|
| FileNotFound | ファイルが見つからない |
| FileReadError | ファイル読み込みエラー |
| UnsupportedFormat | サポートされていない形式 |
| ModelNotFound | モデルが見つからない |
| ModelLoadError | モデル読み込みエラー |
| TranscriptionError | 文字起こしエラー |
| Cancelled | キャンセルされた |

### 3. 処理モジュール

`src-tauri/src/whisper/process.rs` に以下を実装：

#### CancellationToken
- `AtomicBool` を使用したキャンセルトークン
- `new()`, `cancel()`, `is_cancelled()` メソッド

#### TaskManager
- `RwLock<HashMap<String, CancellationToken>>` でタスクを管理
- `create_task()`, `cancel_task()`, `remove_task()` メソッド

#### load_wav_file
- houndでWAVファイルを読み込み
- ステレオの場合はモノラルに変換
- 16kHz以外の場合はリサンプリング
- 戻り値: `Vec<f32>`（正規化された音声サンプル）

#### transcribe
- 引数: モデルパス、音声サンプル、タスクID、キャンセルトークン、AppHandle
- WhisperContextを作成してモデルを読み込み
- 進捗コールバックで `whisper:progress` イベントを発火
- セグメントごとの結果を収集
- 戻り値: `TranscriptionResult`

### 4. Tauriコマンド追加

#### transcribe_audio
- 引数: `audio_path: String`, `model_path: String`
- 処理:
  1. UUIDでタスクIDを生成
  2. キャンセルトークンを作成
  3. WAVファイルを読み込み
  4. `spawn_blocking` で文字起こしを実行（UIブロックを防ぐ）
  5. 結果を返す
- 戻り値: `Result<TranscriptionResult, String>`

#### cancel_transcription
- 引数: `task_id: String`
- 処理: TaskManagerでタスクをキャンセル
- 戻り値: `Result<bool, String>`

### 5. グローバルTaskManager

`once_cell::sync::Lazy` で `TASK_MANAGER` をグローバルに保持。

---

## 作成/編集ファイル

| ファイル | 説明 |
|---------|------|
| `src-tauri/src/whisper/error.rs` | エラー型定義（**テスト含む、先に作成**） |
| `src-tauri/src/whisper/process.rs` | 文字起こし処理（**テスト含む、先に作成**） |
| `src-tauri/src/whisper/commands.rs` | コマンド追加 |
| `src-tauri/src/whisper/mod.rs` | モジュール更新 |
| `src-tauri/Cargo.toml` | 依存追加 |

---

## 技術的注意点

- whisper-rsはネイティブコンパイルが必要（初回ビルドは5-10分程度）
- macOSではAccelerateフレームワークが使用される
- 文字起こしはCPU集約的なため `spawn_blocking` で別スレッド実行
- キャンセル処理は次のセグメント処理前にチェックされる

---

## 完了条件

- [ ] `cargo test` で全テストが通る
- [ ] WAVファイルの文字起こしができる
- [ ] 進捗イベントが発火する
- [ ] キャンセルが機能する

---

## 次のステップ

[Step 5: 状態管理プリミティブ](./step-05.md)
