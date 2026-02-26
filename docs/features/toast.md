# トースト通知システム

**カテゴリ**: UX改善 | **優先度**: **完了**

操作結果のフィードバック用トースト通知。

---

## 目的

- 操作結果のフィードバック
- エラー通知
- 成功通知

---

## 実装方式

solid-ui の Toast コンポーネント（Kobalte Toast ベース）を使用。

- `createToast` プリミティブや `ToastContext` は不要（Kobalte `toaster` シングルトンが代替）
- `toast.success/error/info` ヘルパーをどこからでも import 可能

---

## 使用方法

```ts
import { toast } from "~/lib/toast";

// 成功通知（3秒後に自動消去）
toast.success("コピーしました");

// エラー通知（5秒後に自動消去）
toast.error("エラーが発生しました");

// 情報通知（3秒後に自動消去）
toast.info("処理を開始しました");
```

---

## ファイル構成

| ファイル | 説明 |
|---------|------|
| `src/components/ui/toast.tsx` | solid-ui Toast コンポーネント（Kobalte ラッパー） |
| `src/lib/toast.ts` | `toast.success/error/info` ヘルパー |
| `src/lib/__tests__/toast.test.ts` | ヘルパーテスト |
| `src/components/ui/__tests__/toast.test.tsx` | UI テスト |

---

## 完了条件

- [x] `pnpm test` で全テストが通る
- [x] トーストが表示・自動消去される
- [x] 手動で閉じられる
- [x] success/error/info が正しく表示される
