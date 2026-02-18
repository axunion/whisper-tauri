# 設定永続化

**カテゴリ**: 基本機能強化 | **優先度**: **完了**

設定の永続化を行うプリミティブと設定画面UIを実装する。

---

## 目的

- アプリ設定の管理
- tauri-plugin-storeによる永続化
- リアクティブな設定変更

---

## テスト要件

### TypeScript (Vitest)

`src/primitives/__tests__/createSettings.test.ts`:

| テスト | 内容 |
|-------|------|
| 初期状態 | デフォルト設定で初期化される |
| 初期状態 | isLoaded が false |
| load | ストアから設定を読み込む |
| load | 保存された設定がマージされる |
| load | 読み込み後に isLoaded が true |
| load | ストアが空の場合はデフォルト設定 |
| update | 設定を部分更新できる |
| update | ストアに保存される |
| reset | デフォルト設定にリセットされる |
| reset | ストアが更新される |
| language | 言語設定を取得できる |
| theme | テーマ設定を取得できる |
| outputFormat | 出力形式設定を取得できる |

---

## 実装内容

### 1. 設定型定義

`src/types/settings.ts` に以下を定義：

#### AppSettings

| プロパティ | 型 | デフォルト値 | 説明 |
|-----------|-----|-------------|------|
| language | `'ja' \| 'en'` | `'ja'` | 言語設定 |
| outputFormat | `'txt' \| 'srt' \| 'vtt'` | `'txt'` | デフォルト出力形式 |
| theme | `'light' \| 'dark' \| 'system'` | `'system'` | テーマ設定 |

### 2. 設定プリミティブ

`src/primitives/createSettings.ts` に以下を実装：

#### 状態

| プロパティ | 説明 |
|-----------|------|
| settings() | 全設定を取得 |
| language() | 言語設定を取得 |
| theme() | テーマ設定を取得 |
| outputFormat() | 出力形式設定を取得 |
| isLoaded() | 読み込み完了フラグ |

#### アクション

| メソッド | 説明 |
|---------|------|
| load() | ストアから設定を読み込み |
| update(partial) | 設定を部分更新して保存 |
| reset() | デフォルト設定にリセット |

### 3. ストレージ

- ストアパス: `settings.json`
- キー: `app_settings`
- `@tauri-apps/plugin-store` の `LazyStore` クラスを使用

---

### 4. テーマ適用

`src/primitives/createTheme.ts`:

- `applyThemeToDOM(theme)`: `<html>` に `dark` クラスと `data-kb-theme` を設定
- `applyTheme(accessor)`: リアクティブラッパー。`system` 選択時は `prefers-color-scheme` 変化もリッスン
- `AppLayout` で起動時に適用、`Settings` でテーマ変更時に即反映

---

## 設定画面 UI

`src/pages/Settings.tsx` に以下の構成で実装:

- **一般設定**: 言語 / 出力形式 / テーマ（Select コンポーネント）
- **モデル管理**: モデル一覧表示、ダウンロード / 削除操作
- **リセット**: デフォルト設定に戻す

使用 solid-ui コンポーネント: Select, Label, Separator, AlertDialog

---

## 作成ファイル

| ファイル | 説明 |
|---------|------|
| `src/types/settings.ts` | 設定型定義 |
| `src/primitives/createSettings.ts` | 設定プリミティブ |
| `src/primitives/createTheme.ts` | テーマ適用プリミティブ |
| `src/primitives/__tests__/createSettings.test.ts` | 設定テスト |
| `src/primitives/__tests__/createTheme.test.ts` | テーマテスト |
| `src/components/ui/Select.tsx` | solid-ui Select |
| `src/components/ui/Label.tsx` | solid-ui Label |
| `src/components/ui/Separator.tsx` | solid-ui Separator |
| `src/components/ui/AlertDialog.tsx` | solid-ui AlertDialog |
| `src/pages/Settings.tsx` | 設定画面 |

---

## 完了条件

- [x] `pnpm test` でテストが通る
- [x] 設定が保存される
- [x] アプリ再起動後も設定が保持される
- [x] 設定画面 UI が実装されている
