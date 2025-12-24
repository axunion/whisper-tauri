# Step 6: 基本UIコンポーネント

**Phase 1: MVP** | 必須

solid-ui を使ったUIコンポーネントと、文字起こし用コンポーネントを構築する。

---

## 目的

- solid-ui ベースのUIコンポーネントのセットアップ
- 文字起こしワークフロー用コンポーネント
- デザインの統一性を保つ

---

## UI方針

[solid-ui](https://www.solid-ui.com/) を使用する。

| 項目 | 内容 |
|------|------|
| ライブラリ | solid-ui（shadcn/ui の SolidJS ポート） |
| 方式 | コピー＆ペースト（npmパッケージではない） |
| ベース | Kobalte + Corvu + Tailwind CSS |
| 配置先 | `src/components/ui/` |

**原則**:
- solid-ui のデフォルトスタイルを可能な限り使用
- カスタマイズは最小限に抑え、統一感を維持
- 必要なコンポーネントのみをコピーして使用

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

solid-ui から必要なコンポーネントをコピーして使用する。

#### solid-ui セットアップ

1. [solid-ui Tauri ガイド](https://www.solid-ui.com/docs/installation/tauri) に従ってセットアップ
2. 依存パッケージのインストール（Kobalte, Corvu, tailwind-merge, class-variance-authority 等）
3. Tailwind CSS 設定の更新

#### 使用するコンポーネント（MVP）

| コンポーネント | 用途 |
|--------------|------|
| Button | アクション実行 |
| Progress | 進捗表示 |
| Card | コンテンツ区切り |
| Badge | ステータス表示 |

**注意**: solid-ui のデフォルトスタイルをそのまま使用し、カスタマイズは最小限に

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

- solid-ui コンポーネントはアクセシビリティ対応済み（Kobalte ベース）
- solid-ui のデフォルトスタイルを維持し、統一感を保つ
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
