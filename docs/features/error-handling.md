# エラーハンドリング強化

**カテゴリ**: 基本機能強化 | **優先度**: 推奨 | **ステータス**: 完了

構造化されたエラーハンドリングシステムを構築する。

---

## 目的

- エラーカテゴリの定義
- ユーザーフレンドリーなエラーメッセージ
- Rustエラー文字列のプレフィックスマッチングによるフロントエンド側分類

---

## スコープ

全3プリミティブ（createWhisper, createFfmpegDownloader, createFileConverter）を対象に、`error` 状態を `string | null` から `AppError | null` に変更。Rust 側は変更なし。

---

## 実装内容

### 1. エラー型定義

`src/types/errors.ts` に ErrorCategory, ErrorCode, AppError を定義。

### 2. エラーユーティリティ

`src/lib/errors.ts` に以下の関数を実装：

| 関数 | 説明 |
|------|------|
| `getErrorCategory(code)` | コードからカテゴリを取得 |
| `isRecoverable(code)` | 復旧可能かどうかを判定 |
| `parseError(error)` | unknown型からAppErrorに変換 |
| `getErrorMessage(code)` | コードからメッセージを取得 |

### 3. ErrorDisplayコンポーネント

`src/components/ErrorDisplay.tsx`: カテゴリバッジ + メッセージ + 詳細 + 再試行/閉じるボタン

### 4. プリミティブ更新

3つのプリミティブの catch ブロックで `parseError()` を使用。

### 5. UI更新

Transcription.tsx と Settings.tsx のエラー表示を ErrorDisplay に置換。

---

## 作成・変更ファイル

| ファイル | 操作 |
|---------|------|
| `src/types/errors.ts` | NEW |
| `src/types/index.ts` | MODIFY |
| `src/lib/errors.ts` | NEW |
| `src/lib/__tests__/errors.test.ts` | NEW |
| `src/components/ErrorDisplay.tsx` | NEW |
| `src/components/__tests__/ErrorDisplay.test.tsx` | NEW |
| `src/primitives/createWhisper.ts` | MODIFY |
| `src/primitives/createFfmpegDownloader.ts` | MODIFY |
| `src/primitives/createFileConverter.ts` | MODIFY |
| `src/primitives/__tests__/createWhisper.test.ts` | MODIFY |
| `src/primitives/__tests__/createFfmpegDownloader.test.ts` | MODIFY |
| `src/primitives/__tests__/createFileConverter.test.ts` | MODIFY |
| `src/pages/Transcription.tsx` | MODIFY |
| `src/pages/Settings.tsx` | MODIFY |

---

## 完了条件

- [x] `pnpm test` で全テストが通る
- [x] エラーが構造化された形式で表示される
- [x] ネットワークエラー時に適切なメッセージが出る
- [x] キャンセル時に適切なメッセージが出る
