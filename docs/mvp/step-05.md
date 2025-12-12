# Step 5: 状態管理プリミティブ

**Phase 1: MVP** | 必須

SolidJSのリアクティブプリミティブでTauri通信を抽象化する。

---

## 目的

- 文字起こし状態をリアクティブに管理
- Tauri APIとの通信を抽象化
- テスト可能な設計

---

## テスト要件

### TypeScript (Vitest)

`src/primitives/__tests__/createWhisper.test.ts`:

| テスト | 内容 |
|-------|------|
| 初期状態 | models, selectedModel, file, result, error が空/null |
| 初期状態 | isProcessing, isDownloading が false |
| loadModels | `get_available_models` を invoke する |
| loadModels | 結果を models 状態に設定する |
| loadModels | エラー時に error 状態を設定する |
| selectModel | ダウンロード済みモデルを選択できる |
| selectModel | 未ダウンロードモデルは選択できない |
| setFile | ファイル情報を設定できる |
| downloadModel | `download_model` を invoke する |
| downloadModel | 完了後に loadModels を呼び出す |
| startTranscription | file と model が null の場合は何もしない |
| startTranscription | `transcribe_audio` を invoke する |
| startTranscription | isProcessing を true/false に設定する |
| cancelTranscription | `cancel_transcription` を invoke する |
| reset | file, result, error をクリアする |
| clearError | error を null にする |

---

## 実装内容

### 1. WhisperPrimitive インターフェース

`src/primitives/createWhisper.ts` に以下のインターフェースを定義・実装：

#### 状態（Accessor）

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| models | `ModelInfo[]` | モデル一覧 |
| selectedModel | `ModelInfo \| null` | 選択中のモデル |
| file | `FileInfo \| null` | 選択中のファイル |
| progress | `TranscriptionProgress \| null` | 文字起こし進捗 |
| downloadProgress | `DownloadProgress \| null` | ダウンロード進捗 |
| result | `TranscriptionResult \| null` | 文字起こし結果 |
| isProcessing | `boolean` | 処理中フラグ |
| isDownloading | `boolean` | ダウンロード中フラグ |
| error | `string \| null` | エラーメッセージ |

#### アクション

| メソッド | 説明 |
|---------|------|
| `loadModels()` | モデル一覧を取得 |
| `selectModel(model)` | モデルを選択（ダウンロード済みのみ） |
| `setFile(file)` | ファイルを設定 |
| `downloadModel(modelId)` | モデルをダウンロード |
| `startTranscription()` | 文字起こしを開始 |
| `cancelTranscription()` | 文字起こしをキャンセル |
| `reset()` | 状態をリセット |
| `clearError()` | エラーをクリア |

### 2. イベントリスナー

`createEffect` と `onCleanup` を使用して以下のイベントを購読：

| イベント | 処理 |
|---------|------|
| `whisper:progress` | progress状態を更新 |
| `model:download-progress` | downloadProgress状態を更新 |

### 3. Tauri API呼び出し

`@tauri-apps/api/core` の `invoke` を使用：

| コマンド | タイミング |
|---------|----------|
| `get_available_models` | loadModels時 |
| `download_model` | downloadModel時 |
| `transcribe_audio` | startTranscription時 |
| `cancel_transcription` | cancelTranscription時 |

---

## 作成ファイル

| ファイル | 説明 |
|---------|------|
| `src/primitives/__tests__/createWhisper.test.ts` | **テスト（先に作成）** |
| `src/primitives/createWhisper.ts` | 文字起こしプリミティブ |
| `src/primitives/index.ts` | エクスポート |

---

## 技術的注意点

- `createRoot` でテスト時のリアクティブコンテキストを作成
- イベントリスナーは `onCleanup` で必ず解除
- エラーハンドリングはすべてのasync処理で行う
- `selectModel` はダウンロード済みモデルのみ受け付ける

---

## 完了条件

- [ ] `pnpm test` で全テストが通る
- [ ] モデル読み込みが動作する
- [ ] 文字起こし開始・キャンセルが動作する
- [ ] 進捗更新がリアクティブに反映される

---

## 次のステップ

[Step 6: 基本UIコンポーネント](./step-06.md)
