# Step 1: プロジェクト基盤セットアップ

**Phase 1: MVP** | 必須

Tauri 2 + SolidJS の基本構成とテスト環境を確立する。

---

## 目的

- Tauri 2 + SolidJS プロジェクトの基本構成を作成
- Vitest + SolidJS Testing Library によるテスト環境をセットアップ
- Tailwind CSS + Kobalte の設定
- Tauriプラグインの有効化

---

## 実装内容

### 1. プロジェクト作成

`pnpm create tauri-app` で SolidJS + TypeScript テンプレートを使用してプロジェクトを作成する。

### 2. 依存パッケージ

#### フロントエンド

- `@tauri-apps/plugin-dialog` - ファイル選択ダイアログ
- `@tauri-apps/plugin-fs` - ファイル操作
- `@tauri-apps/plugin-store` - 設定永続化
- `@kobalte/core` - アクセシブルなUIコンポーネント
- `solid-icons` - アイコン

#### 開発依存

- `tailwindcss`, `postcss`, `autoprefixer` - スタイリング
- `vitest`, `@solidjs/testing-library`, `jsdom` - テスト環境

### 3. 設定ファイル

| ファイル | 内容 |
|---------|------|
| `tailwind.config.js` | `./src/**/*.{ts,tsx}` をcontent対象に設定 |
| `postcss.config.js` | Tailwind + Autoprefixer を設定 |
| `vitest.config.ts` | jsdom環境、グローバル設定、セットアップファイル指定 |

### 4. テストセットアップ

`src/test/setup.ts` で以下のTauri APIをモック化：

- `@tauri-apps/api/core` - invoke
- `@tauri-apps/api/event` - listen, emit
- `@tauri-apps/plugin-dialog` - open, save
- `@tauri-apps/plugin-fs` - readFile, writeFile
- `@tauri-apps/plugin-store` - Store

### 5. Rust依存パッケージ

`src-tauri/Cargo.toml` に追加：

- `tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-store` - Tauriプラグイン
- `tokio` (full features) - 非同期ランタイム
- `reqwest` (stream features) - HTTPクライアント
- `serde`, `serde_json` - シリアライズ
- `thiserror` - エラー型
- `uuid` (v4) - UUID生成
- `futures-util` - 非同期ユーティリティ

### 6. Tauriプラグイン登録

`src-tauri/src/lib.rs` で各プラグインを登録し、`capabilities/default.json` で必要な権限を許可する。

### 7. CSS設定

`src/index.css` にTailwindディレクティブ（base, components, utilities）を追加。

---

## 作成/編集ファイル

| ファイル | 操作 | 説明 |
|---------|------|------|
| `package.json` | 編集 | 依存追加、スクリプト追加 |
| `tailwind.config.js` | 新規 | Tailwind設定 |
| `postcss.config.js` | 新規 | PostCSS設定 |
| `vitest.config.ts` | 新規 | Vitest設定 |
| `src/test/setup.ts` | 新規 | テストセットアップ |
| `src/index.css` | 編集 | Tailwindディレクティブ |
| `src-tauri/Cargo.toml` | 編集 | 依存追加 |
| `src-tauri/src/lib.rs` | 編集 | プラグイン登録 |
| `src-tauri/capabilities/default.json` | 編集 | 権限追加 |

---

## 完了条件

- [ ] `pnpm tauri dev` でウィンドウが表示される
- [ ] `pnpm test` が実行できる（空のテストスイート）
- [ ] `cd src-tauri && cargo test` が実行できる
- [ ] Tailwind CSSが適用されている

---

## 実装時の差異

### Tailwind CSS v4 への変更

計画書ではTailwind CSS v3を想定していたが、実装時にはTailwind CSS v4がインストールされた。v4では設定方法が変更されている：

| 計画 | 実際の実装 |
|------|------------|
| `tailwind.config.js` を作成 | 不要（v4ではCSS-firstアプローチ） |
| `@tailwind base/components/utilities` ディレクティブ | `@import "tailwindcss"` を使用 |
| `tailwindcss` パッケージのみ | `@tailwindcss/postcss` パッケージも必要 |

`postcss.config.js` は以下のように設定：

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
    autoprefixer: {},
  },
};
```

---

## 次のステップ

[Step 2: 型システム構築](./step-02.md)
