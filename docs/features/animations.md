# アニメーション・ビジュアル強化

**カテゴリ**: UX改善 | **優先度**: 完了

UIの視覚的な洗練とマイクロインタラクションを実装する。

---

## 目的

- スムーズなアニメーション
- 視覚的フィードバックの強化
- UIの統一感と機能美の追求

---

## テスト要件

アニメーションは視覚的確認が主のため、ユニットテストは最小限。

### 手動確認項目

| 項目 | 確認内容 |
|------|---------|
| slideUp | トーストが下から上にスライドインする |
| fadeIn | ページ遷移時にコンテンツがフェードインする |
| spin | モデル読み込み中にスピナーが回転する |
| progressStripe | プログレスバーにストライプアニメーションがある |
| スクロールバー | カスタムスタイルのスクロールバーが表示される |

---

## 実装内容

### 1. アニメーション定義

`src/styles/animations.css` に以下のアニメーションを定義：

| アニメーション | 説明 | 用途 |
|--------------|------|------|
| slide-up | 下から上にスライドイン | トースト表示 |
| fade-in | フェードイン | ページ遷移 |
| spin | 360度回転 | ローディングスピナー |
| progress-stripe | 斜めストライプの移動 | プログレスバー |

### 2. CSSクラス

| クラス | 説明 |
|-------|------|
| `.animate-slide-up` | スライドアップアニメーション（0.3s ease-out） |
| `.animate-fade-in` | フェードインアニメーション（0.2s ease-out） |
| `.animate-spin` | 回転アニメーション（1s linear infinite） |
| `.progress-stripe` | プログレスバーのストライプ効果（0.5s linear infinite） |

### 3. index.css 更新

- `@import './styles/animations.css'` を追加
- スクロールバーのカスタムスタイル（6px幅、バイオレット系）

### 4. アニメーション適用先

| コンポーネント | アニメーション |
|--------------|--------------|
| 全ページ（Dashboard, Transcription, History, Settings, DevMenu） | `animate-fade-in` |
| `Progress` コンポーネント | `progress-stripe` |
| `ModelStatus` ローディング | `animate-spin`（SVGスピナー） |

### 5. UIバランス調整

| コンポーネント | 変更内容 |
|--------------|---------|
| `AppLayout` | 下部余白追加（`pb-16`） |
| `QuickActions` | ボタンをグリッド均等幅に |
| `ModelStatus` バッジ | `min-w-24` で幅統一 |
| `ModelSelector` アクションエリア | `w-28` 固定幅 |
| `Button` sm サイズ | `px-3` → `px-4` で余裕確保 |
| `Badge` | `py-0.5` → `py-1` で縦バランス改善 |
| `RecentHistory` 行 | `py-2` → `py-3` で行間に余裕 |
| Settings Progress 表示 | ボタン幅（`w-28`）と統一 |

---

## 作成・変更ファイル

| ファイル | 説明 |
|---------|------|
| `src/styles/animations.css` | 新規作成 — アニメーション定義 |
| `src/index.css` | import追加、スクロールバースタイル |
| `src/components/ui/Progress.tsx` | ストライプアニメーション追加 |
| `src/components/ui/Button.tsx` | sm サイズの余白調整 |
| `src/components/ui/Badge.tsx` | 縦余白調整 |
| `src/components/dashboard/Dashboard.tsx` | フェードイン追加 |
| `src/components/dashboard/QuickActions.tsx` | グリッドレイアウト化 |
| `src/components/dashboard/ModelStatus.tsx` | スピナー追加、行余白・バッジ幅統一 |
| `src/components/dashboard/RecentHistory.tsx` | 行間余白調整 |
| `src/components/transcription/ModelSelector.tsx` | アクションエリア幅統一 |
| `src/components/layout/AppLayout.tsx` | 下部余白追加 |
| `src/pages/Transcription.tsx` | フェードイン追加 |
| `src/pages/History.tsx` | フェードイン追加 |
| `src/pages/Settings.tsx` | フェードイン追加、Progress幅統一 |
| `src/pages/DevMenu.tsx` | フェードイン追加 |

---

## 完了条件

- [x] トーストがスライドインする
- [x] プログレスバーがストライプアニメーションする
- [x] 読み込み中のスピナーが回転する
- [x] ページ遷移時にフェードインする
- [x] ボタン・バッジのサイズが統一されている
- [x] 下部に適切な余白がある
