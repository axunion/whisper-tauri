# エラーハンドリング強化

**カテゴリ**: 基本機能強化 | **優先度**: 推奨

構造化されたエラーハンドリングシステムを構築する。

---

## 目的

- エラーカテゴリの定義
- ユーザーフレンドリーなエラーメッセージ
- Rustエラー型とTypeScriptエラー型の統一

---

## テスト要件

### TypeScript (Vitest)

`src/lib/__tests__/errors.test.ts`:

| テスト | 内容 |
|-------|------|
| getErrorCategory | FILE_* コードは 'file' カテゴリを返す |
| getErrorCategory | MODEL_* コードは 'model' カテゴリを返す |
| getErrorCategory | NETWORK_* コードは 'network' カテゴリを返す |
| getErrorCategory | CANCELLED は 'cancelled' カテゴリを返す |
| isRecoverable | MODEL_LOAD_ERROR は false を返す |
| isRecoverable | その他は true を返す |
| parseError | 文字列エラーを AppError に変換する |
| parseError | オブジェクトエラーを AppError に変換する |
| parseError | unknown エラーを UNKNOWN_ERROR に変換する |
| getErrorMessage | 各コードに対応するメッセージを返す |

`src/components/__tests__/ErrorDisplay.test.tsx`:

| テスト | 内容 |
|-------|------|
| render | エラーメッセージが表示される |
| render | 詳細がある場合は詳細も表示される |
| onDismiss | 閉じるボタンでコールバックが呼ばれる |
| onRetry | recoverable 時に再試行ボタンが表示される |

---

## 実装内容

### 1. エラー型定義

`src/types/errors.ts` に以下を定義：

#### ErrorCategory

| カテゴリ | 説明 |
|---------|------|
| file | ファイル関連エラー |
| model | モデル関連エラー |
| process | 処理関連エラー |
| network | ネットワーク関連エラー |
| cancelled | キャンセル |
| unknown | 不明なエラー |

#### ErrorCode

| コード | 説明 |
|-------|------|
| FILE_NOT_FOUND | ファイルが見つからない |
| FILE_READ_ERROR | ファイル読み込みエラー |
| UNSUPPORTED_FORMAT | サポートされていない形式 |
| MODEL_NOT_FOUND | モデルが見つからない |
| MODEL_LOAD_ERROR | モデル読み込みエラー |
| MODEL_DOWNLOAD_ERROR | モデルダウンロードエラー |
| TRANSCRIPTION_ERROR | 文字起こしエラー |
| NETWORK_ERROR | ネットワークエラー |
| CANCELLED | キャンセル |
| UNKNOWN_ERROR | 不明なエラー |

#### AppError

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| code | ErrorCode | エラーコード |
| category | ErrorCategory | エラーカテゴリ |
| message | string | ユーザー向けメッセージ |
| details? | string | 詳細情報 |
| recoverable | boolean | 復旧可能かどうか |

### 2. エラーユーティリティ

`src/lib/errors.ts` に以下の関数を実装：

| 関数 | 説明 |
|------|------|
| `getErrorCategory(code)` | コードからカテゴリを取得 |
| `isRecoverable(code)` | 復旧可能かどうかを判定 |
| `parseError(error)` | unknown型からAppErrorに変換 |
| `getErrorMessage(code)` | コードからメッセージを取得 |

### 3. ErrorDisplayコンポーネント

`src/components/ErrorDisplay.tsx` を作成：

| Props | 型 | 説明 |
|-------|-----|------|
| error | `AppError \| null` | エラー情報 |
| onDismiss | `() => void` | 閉じるボタンクリック時 |
| onRetry? | `() => void` | 再試行ボタンクリック時 |

機能:
- エラーメッセージと詳細の表示
- 閉じるボタン
- 復旧可能な場合は再試行ボタン

### 4. createWhisperの更新

- error状態の型を `string | null` から `AppError | null` に変更
- catchブロックで `parseError()` を使用

---

## 作成ファイル

| ファイル | 説明 |
|---------|------|
| `src/lib/__tests__/errors.test.ts` | **テスト（先に作成）** |
| `src/components/__tests__/ErrorDisplay.test.tsx` | **テスト（先に作成）** |
| `src/types/errors.ts` | エラー型定義 |
| `src/lib/errors.ts` | エラーユーティリティ |
| `src/components/ErrorDisplay.tsx` | エラー表示 |

---

## 完了条件

- [ ] `pnpm test` で全テストが通る
- [ ] エラーが構造化された形式で表示される
- [ ] ネットワークエラー時に適切なメッセージが出る
- [ ] キャンセル時に適切なメッセージが出る
