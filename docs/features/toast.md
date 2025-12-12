# トースト通知システム

**カテゴリ**: UX改善 | **優先度**: 任意

操作結果のフィードバック用トースト通知を実装する。

---

## 目的

- 操作結果のフィードバック
- エラー通知
- 成功通知

---

## テスト要件

### TypeScript (Vitest)

`src/primitives/__tests__/createToast.test.ts`:

| テスト | 内容 |
|-------|------|
| 初期状態 | toasts が空配列 |
| success | success タイプのトーストが追加される |
| error | error タイプのトーストが追加される |
| info | info タイプのトーストが追加される |
| dismiss | 指定IDのトーストが削除される |
| 自動消去 | 指定時間後にトーストが削除される |

`src/components/ui/__tests__/Toaster.test.tsx`:

| テスト | 内容 |
|-------|------|
| render | トースト一覧が表示される |
| render | タイプに応じたスタイルが適用される |
| onDismiss | 閉じるボタンでコールバックが呼ばれる |

---

## 実装内容

### 1. トーストプリミティブ

`src/primitives/createToast.ts` に以下を実装：

#### Toast型

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| id | string | ユニークID |
| type | `'success' \| 'error' \| 'info'` | トーストタイプ |
| message | string | メッセージ |

#### ToastPrimitive

| メソッド | 説明 |
|---------|------|
| toasts() | 現在のトースト一覧 |
| success(message) | 成功トーストを表示（3秒後に自動消去） |
| error(message) | エラートーストを表示（5秒後に自動消去） |
| info(message) | 情報トーストを表示（3秒後に自動消去） |
| dismiss(id) | 指定IDのトーストを消去 |

### 2. Toasterコンポーネント

`src/components/ui/Toaster.tsx` を作成：

| Props | 型 | 説明 |
|-------|-----|------|
| toasts | `Toast[]` | トースト一覧 |
| onDismiss | `(id: string) => void` | 消去コールバック |

機能:
- `<Portal>` を使用して画面右下に固定表示
- タイプ別のスタイル（success: 緑、error: 赤、info: 青）
- 閉じるボタン

### 3. ToastContext

`src/primitives/ToastContext.tsx` を作成：

- ToastProviderでアプリをラップ
- useToast()フックでプリミティブを取得
- Toasterコンポーネントを自動レンダリング

### 4. 使用例

- コピー成功時: `toast.success('コピーしました')`
- エラー時: `toast.error('エラーが発生しました')`
- 情報表示: `toast.info('処理を開始しました')`

---

## 作成ファイル

| ファイル | 説明 |
|---------|------|
| `src/primitives/__tests__/createToast.test.ts` | **テスト（先に作成）** |
| `src/components/ui/__tests__/Toaster.test.tsx` | **テスト（先に作成）** |
| `src/primitives/createToast.ts` | トーストプリミティブ |
| `src/components/ui/Toaster.tsx` | Toasterコンポーネント |
| `src/primitives/ToastContext.tsx` | コンテキスト |

---

## 完了条件

- [ ] `pnpm test` で全テストが通る
- [ ] トーストが表示・自動消去される
- [ ] 手動で閉じられる
- [ ] success/error/info が正しく表示される
