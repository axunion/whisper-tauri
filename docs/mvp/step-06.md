# Step 6: 基本UIコンポーネント

**Phase 1: MVP** | 必須

Kobalteを使ったアクセシブルなUIコンポーネントと、文字起こし用コンポーネントを構築する。

---

## 目的

- アクセシブルなUIコンポーネントの作成
- 文字起こしワークフロー用コンポーネント
- Kobalte + Tailwind CSSでのスタイリング

---

## テスト要件

### TypeScript (Vitest)

UIコンポーネントは視覚的確認が主だが、ロジックを含む部分はテストする。

`src/components/ui/__tests__/Button.test.tsx`:

| テスト | 内容 |
|-------|------|
| render | 正常にレンダリングされる |
| disabled | disabled 時にクリックが無効になる |
| loading | loading 時にスピナーが表示される |

`src/components/ui/__tests__/Progress.test.tsx`:

| テスト | 内容 |
|-------|------|
| render | 正常にレンダリングされる |
| percentage | value/max からパーセントを正しく計算する |

`src/components/transcription/__tests__/ResultViewer.test.tsx`:

| テスト | 内容 |
|-------|------|
| render | 結果テキストが表示される |
| render | 言語と長さが表示される |

---

## 実装内容

### 1. 基本UIコンポーネント（src/components/ui/）

#### Button

Kobalteの `Button` をラップしたコンポーネント。

| Props | 型 | 説明 |
|-------|-----|------|
| variant | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | スタイルバリアント |
| size | `'sm' \| 'md' \| 'lg'` | サイズ |
| disabled | `boolean` | 無効状態 |
| loading | `boolean` | ローディング状態（スピナー表示） |
| onClick | `() => void` | クリックハンドラ |

#### Progress

Kobalteの `Progress` をラップしたコンポーネント。

| Props | 型 | 説明 |
|-------|-----|------|
| value | `number` | 現在値 |
| max | `number` | 最大値（デフォルト: 100） |
| label | `string` | ラベル |
| showValue | `boolean` | パーセント表示 |

### 2. 文字起こしコンポーネント（src/components/transcription/）

#### FileSelector

ファイル選択UI。

| Props | 型 | 説明 |
|-------|-----|------|
| file | `FileInfo \| null` | 選択中のファイル |
| onFileSelect | `(file: FileInfo) => void` | ファイル選択時のコールバック |
| onFileClear | `() => void` | クリア時のコールバック |
| disabled | `boolean` | 無効状態 |

機能:
- ドロップゾーン表示（未選択時）
- `@tauri-apps/plugin-dialog` の `open` でファイル選択
- 対応形式: WAV, MP3, M4A, FLAC, OGG
- 選択済みファイルの表示とクリアボタン

#### ModelSelector

モデル選択UI。

| Props | 型 | 説明 |
|-------|-----|------|
| models | `ModelInfo[]` | モデル一覧 |
| selectedModel | `ModelInfo \| null` | 選択中のモデル |
| downloadProgress | `DownloadProgress \| null` | ダウンロード進捗 |
| isDownloading | `boolean` | ダウンロード中フラグ |
| onSelectModel | `(model: ModelInfo) => void` | モデル選択時のコールバック |
| onDownloadModel | `(modelId: string) => void` | ダウンロードボタンクリック時のコールバック |

機能:
- モデル一覧をカード形式で表示
- ダウンロード済みモデルにチェックマーク
- 未ダウンロードモデルにダウンロードボタン
- ダウンロード中はプログレスバー表示
- ダウンロード済みモデルのみ選択可能

#### ProgressBar

文字起こし進捗表示。

| Props | 型 | 説明 |
|-------|-----|------|
| progress | `TranscriptionProgress \| null` | 進捗情報 |
| onCancel | `() => void` | キャンセルボタンクリック時のコールバック |

機能:
- 進捗バーとパーセント表示
- 経過時間の表示（MM:SS形式）
- キャンセルボタン

#### ResultViewer

文字起こし結果表示。

| Props | 型 | 説明 |
|-------|-----|------|
| result | `TranscriptionResult` | 文字起こし結果 |

機能:
- テキスト表示（スクロール可能）
- コピーボタン（`navigator.clipboard.writeText`）
- 言語と長さの表示

### 3. インデックスファイル

各ディレクトリに `index.ts` を作成してエクスポート。

---

## 作成ファイル

| ファイル | 説明 |
|---------|------|
| `src/components/ui/__tests__/Button.test.tsx` | **テスト（先に作成）** |
| `src/components/ui/__tests__/Progress.test.tsx` | **テスト（先に作成）** |
| `src/components/transcription/__tests__/ResultViewer.test.tsx` | **テスト（先に作成）** |
| `src/components/ui/Button.tsx` | ボタン |
| `src/components/ui/Progress.tsx` | プログレスバー |
| `src/components/ui/index.ts` | UIエクスポート |
| `src/components/transcription/FileSelector.tsx` | ファイル選択 |
| `src/components/transcription/ModelSelector.tsx` | モデル選択 |
| `src/components/transcription/ProgressBar.tsx` | 進捗表示 |
| `src/components/transcription/ResultViewer.tsx` | 結果表示 |
| `src/components/transcription/index.ts` | エクスポート |

---

## 技術的注意点

- Kobalteコンポーネントはアクセシビリティ対応済み
- `splitProps` でローカルpropsとその他を分離
- Tailwind CSSのクラスは条件分岐で動的に適用
- solid-icons からアイコンをインポート（FiUpload, FiFile, FiX, FiDownload, FiCheck, FiCopy, FiPlay）

---

## 完了条件

- [ ] `pnpm test` で全テストが通る
- [ ] 各コンポーネントがレンダリングされる
- [ ] ファイル選択ダイアログが開く
- [ ] モデル選択UIが動作する
- [ ] プログレスバーが表示される

---

## 次のステップ

[Step 7: メインアプリ統合](./step-07.md)
