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
| ベース | Kobalte + Tailwind CSS |
| 配置先 | `src/components/ui/` |

**原則**:
- solid-ui のデフォルトスタイルを可能な限り使用
- カスタマイズは最小限に抑え、統一感を維持
- 必要なコンポーネントのみをコピーして使用

### Kobalte / Corvu の使い分け

solid-ui のコンポーネントは、ベースとなるライブラリが3種類に分かれる。

| ベース | 説明 | 対象コンポーネント例 |
|--------|------|---------------------|
| **Kobalte** (`@kobalte/core`) | ヘッドレスUIプリミティブ。アクセシビリティ対応済み | Button, Progress, Dialog, Select, Tabs 等 |
| **Corvu** (`@corvu/*`) | 個別パッケージで提供されるUIプリミティブ | Drawer, Resizable, OTP Field, Calendar |
| **なし** | 純粋な HTML + Tailwind CSS のスタイリングのみ | Card, Badge, Skeleton, Table, Alert |

**MVP では Corvu は不要。** MVP で使用する4コンポーネントのベースは以下の通り：

| コンポーネント | ベース | 必要なパッケージ |
|--------------|--------|----------------|
| Button | Kobalte | `@kobalte/core`（インストール済み） |
| Progress | Kobalte | `@kobalte/core`（インストール済み） |
| Card | なし | Tailwind CSS のみ |
| Badge | なし | Tailwind CSS のみ |

将来的に Drawer 等を追加する場合のみ Corvu パッケージをインストールする。

---

## テスト要件

### TypeScript (Vitest)

UIコンポーネントは視覚的確認が主だが、ロジックを含む部分はテストする。
Card, Badge は純粋なスタイリングのみのためテスト対象外。

`src/components/ui/__tests__/Button.test.tsx`:

| テスト | 内容 |
|-------|------|
| render | 正常にレンダリングされる |
| variant | variant props に応じてスタイルが変わる |
| disabled | disabled 時にクリックが無効になる |

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

### 1. solid-ui セットアップ

[solid-ui Tauri ガイド](https://www.solid-ui.com/docs/installation/tauri) に従いつつ、以下を実施する。

#### 依存パッケージのインストール

```
# 実行時依存（cn() ユーティリティ用）
pnpm add class-variance-authority clsx tailwind-merge

# 開発時依存（Tailwind プラグイン）
pnpm add -D @kobalte/tailwindcss tw-animate-css
```

`@kobalte/core` はインストール済み。Corvu は MVP では不要。

#### パスエイリアス `~/` の設定

solid-ui コンポーネントは `~/lib/utils` のようなインポートを使用する。

- `tsconfig.json` に `paths` を追加
- `vite.config.ts` に `resolve.alias` を追加

#### `cn()` ユーティリティの作成

`src/lib/utils.ts` に `cn()` 関数を作成。全 solid-ui コンポーネントがこれを使用する。

```typescript
import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

#### Tailwind CSS v4 テーマ設定

`src/index.css` に以下を追加する。本プロジェクトは Tailwind v4 を使用しており、CSS ファースト設定（`tailwind.config.js` 不要）で構成する。

必要な設定:
- `@import "tw-animate-css"` - アニメーションユーティリティ
- `@plugin "@kobalte/tailwindcss"` - Kobalte の `data-*` 属性に対応する Tailwind バリアント
- `@custom-variant dark (...)` - ダークモード対応（Kobalte の `data-kb-theme` 属性）
- `@theme { ... }` - solid-ui のデザイントークン（カラー、radius、フォント等）
- CSS カスタムプロパティ（`:root` / `.dark`） - OKLCH 色空間でのカラー定義

テーマ変数の具体的な値は [solid-ui のデフォルトテーマ](https://www.solid-ui.com/docs/dark-mode) を参照。

### 2. 基本UIコンポーネント（src/components/ui/）

solid-ui から必要なコンポーネントをコピーして使用する。

| コンポーネント | ベース | 用途 |
|--------------|--------|------|
| Button | Kobalte | アクション実行。`class-variance-authority` でバリアント管理（default, destructive, outline, secondary, ghost, link） |
| Progress | Kobalte | 進捗表示。CSS変数 `--kb-progress-fill-width` を使用 |
| Card | Tailwind | コンテンツ区切り。`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` をエクスポート |
| Badge | Tailwind | ステータス表示。`class-variance-authority` でバリアント管理（default, secondary, outline） |

**注意**: solid-ui のデフォルトスタイルをそのまま使用し、カスタマイズは最小限に

### 3. 文字起こしコンポーネント（src/components/transcription/）

#### FileSelector

ファイル選択UI。

| Props | 型 | 説明 |
|-------|-----|------|
| file | `FileInfo \| null` | 選択中のファイル |
| onFileSelect | `(file: FileInfo) => void` | ファイル選択時のコールバック |
| onFileClear | `() => void` | クリア時のコールバック |
| disabled | `boolean` | 無効状態 |

機能:
- ドロップゾーン表示（未選択時）- クリック時に `@tauri-apps/plugin-dialog` の `open` でファイル選択ダイアログを表示
- 対応形式: WAV, MP3, M4A, FLAC, OGG
- 選択済みファイルの表示とクリアボタン

**注意**: ドラッグ＆ドロップによるファイル投入は MVP スコープ外。クリックによるファイル選択のみ対応する。

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

#### TranscriptionProgress

文字起こし進捗表示。

| Props | 型 | 説明 |
|-------|-----|------|
| progress | `TranscriptionProgress \| null` | 進捗情報 |
| onCancel | `() => void` | キャンセルボタンクリック時のコールバック |

機能:
- 進捗バーとパーセント表示（solid-ui Progress を内部で使用）
- 経過時間の表示（MM:SS形式）
- キャンセルボタン

#### ResultViewer

文字起こし結果表示。

| Props | 型 | 説明 |
|-------|-----|------|
| result | `TranscriptionResult` | 文字起こし結果 |

機能:
- テキスト表示（スクロール可能）
- コピーボタン（`@tauri-apps/plugin-clipboard-manager` を使用）
- 言語と長さの表示

**注意**: クリップボード操作は `navigator.clipboard.writeText` ではなく `@tauri-apps/plugin-clipboard-manager` を使用する。`navigator.clipboard` はセキュアコンテキスト（HTTPS）が前提であり、Tauri のローカル環境での動作が保証されない。

### 4. インデックスファイル

各ディレクトリに `index.ts` を作成してエクスポート。

---

## 作成ファイル

| ファイル | 説明 |
|---------|------|
| `src/lib/utils.ts` | `cn()` ユーティリティ |
| `src/index.css` | テーマ変数の追加（既存ファイルの更新） |
| `src/components/ui/__tests__/Button.test.tsx` | **テスト（先に作成）** |
| `src/components/ui/__tests__/Progress.test.tsx` | **テスト（先に作成）** |
| `src/components/transcription/__tests__/ResultViewer.test.tsx` | **テスト（先に作成）** |
| `src/components/ui/Button.tsx` | ボタン（Kobalte ベース） |
| `src/components/ui/Progress.tsx` | プログレスバー（Kobalte ベース） |
| `src/components/ui/Card.tsx` | カード（Tailwind のみ） |
| `src/components/ui/Badge.tsx` | バッジ（Tailwind のみ） |
| `src/components/ui/index.ts` | UIエクスポート |
| `src/components/transcription/FileSelector.tsx` | ファイル選択 |
| `src/components/transcription/ModelSelector.tsx` | モデル選択 |
| `src/components/transcription/TranscriptionProgress.tsx` | 進捗表示 |
| `src/components/transcription/ResultViewer.tsx` | 結果表示 |
| `src/components/transcription/index.ts` | エクスポート |

設定ファイルの更新:
- `tsconfig.json` - パスエイリアス追加
- `vite.config.ts` - パスエイリアス追加
- `package.json` - 依存パッケージ追加

---

## 技術的注意点

- Kobalte ベースのコンポーネント（Button, Progress）はアクセシビリティ対応済み
- solid-ui のデフォルトスタイルを維持し、統一感を保つ
- `splitProps` でローカル props とその他を分離
- Tailwind CSS のクラスは `cn()` で条件付きマージ
- アイコンは `solid-icons/fi` からインポート（FiUpload, FiFile, FiX, FiDownload, FiCheck, FiCopy, FiPlay）
- Tailwind v4 のテーマ設定は CSS 内（`@theme`, CSS カスタムプロパティ）で行い、`tailwind.config.js` は使用しない

---

## 完了条件

- [x] `pnpm test` で全テストが通る
- [x] solid-ui セットアップ完了（依存パッケージ、テーマ変数、`cn()` ユーティリティ）
- [x] 各コンポーネントがレンダリングされる（テストで確認）

**注意**: ファイル選択ダイアログやモデル選択UIの動作確認は Tauri 環境が必要なため、Step 7（メインアプリ統合）で確認する。

---

## 次のステップ

[Step 7: メインアプリ統合](./step-07.md)
