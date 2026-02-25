# 開発メニュー

**カテゴリ**: 開発支援 | **優先度**: 任意

開発ビルド時のみ表示されるデバッグ・管理用メニューを実装する。

---

## 目的

- 開発時のデバッグ効率向上
- テストデータ・キャッシュの管理

---

## アクセス方法

- `pnpm tauri dev` 実行時のみサイドバーにリンク表示
- 本番ビルドではルート自体が登録されず、コードもバンドルから除外される
- `import.meta.env.DEV`（Vite がビルド時に静的置換）で判定

---

## 機能一覧

### 1. キャッシュクリア

各種キャッシュ・データの削除（AlertDialog 確認付き）：

| 対象 | 説明 |
|-----|------|
| 履歴 | 文字起こし履歴をすべて削除 |
| 設定 | 設定をデフォルトにリセット |
| FFmpeg | バンドル済み FFmpeg バイナリを削除（バンドル時のみ表示） |

### 2. モデル管理

ダウンロード済みモデルの管理（AlertDialog 確認付き）：

| 操作 | 説明 |
|-----|------|
| 一覧表示 | ダウンロード済みモデルとサイズ |
| 個別削除 | 選択したモデルを削除 |
| 全削除 | すべてのモデルを一括削除 |

### 3. デバッグログ表示

console 出力をリアルタイム捕捉・表示：

| 項目 | 説明 |
|-----|------|
| ログレベル | DEBUG / INFO / WARN / ERROR |
| フィルタ | レベル閾値でフィルタ可能 |
| 表示形式 | タイムスタンプ付きリスト（等幅フォント） |
| 操作 | クリア、クリップボードにコピー |

---

## テスト要件

### TypeScript (Vitest)

`src/components/dev/__tests__/DevMenu.test.tsx`:

| テスト | 内容 |
|-------|------|
| 表示制御 | PROD環境ではフォールバックメッセージ表示 |
| セクション表示 | Cache Clear / Model Manager / Debug Log の各セクションが表示される |
| ボタン表示 | Clear / Copy / Clear History / Reset Settings ボタンが存在する |
| 初期化 | マウント時に loadModels / loadEntries が呼ばれる |

`src/primitives/__tests__/createDevLog.test.ts`:

| テスト | 内容 |
|-------|------|
| ログ捕捉 | console.log/info/warn/error を対応レベルで捕捉 |
| パススルー | 元の console メソッドにも出力される |
| フィルタ | レベル閾値によるフィルタリング |
| クリア・コピー | ログのクリアとクリップボードコピー |
| dispose | 元の console メソッドが復元される |

---

## 実装内容

### 1. プロダクション除外

`App.tsx` でルート登録を `import.meta.env.DEV` で条件分岐。Vite がビルド時に `false` へ静的置換するため、`lazy(() => import("~/pages/DevMenu"))` がデッドコードとなりツリーシェイキングで除外される。

```typescript
// App.tsx
const DevMenu = import.meta.env.DEV
  ? lazy(() => import("~/pages/DevMenu"))
  : undefined;

// ルート登録
<Show when={DevMenu}>
  {(Comp) => <Route path="/dev" component={Comp()} />}
</Show>
```

多重ガード:
- **ルート登録**: プロダクションでは Route 自体が存在しない
- **サイドバー**: `AppSidebar` で `import.meta.env.DEV` チェック
- **ページ内**: `DevMenu` コンポーネント内でも `<Show when={import.meta.env.DEV}>` でガード

### 2. コンポーネント構成

| コンポーネント | 説明 |
|--------------|------|
| `DevMenu` (`src/pages/DevMenu.tsx`) | メインコンテナ（条件付きレンダリング） |
| `CacheClear` | キャッシュクリアUI（制御式 AlertDialog） |
| `ModelManager` | モデル管理UI（個別削除 + 全削除） |
| `DebugLog` | ログ表示パネル |
| `createDevLog` (`src/primitives/`) | console 捕捉プリミティブ |

### 3. メニュー配置

- サイドバーに「Dev」リンク（`/dev`）
- 開発ビルド時のみ表示（`import.meta.env.DEV`）

---

## 依存機能

| 機能 | 必須 | 理由 |
|-----|------|------|
| 履歴管理 | No | キャッシュクリアで使用 |
| 設定永続化 | No | 設定リセットで使用 |
| モデル管理 | No | モデル削除で使用 |

---

## 作成ファイル

| ファイル | 説明 |
|---------|------|
| `src/primitives/createDevLog.ts` | console 捕捉プリミティブ |
| `src/primitives/__tests__/createDevLog.test.ts` | createDevLog テスト |
| `src/components/dev/DebugLog.tsx` | ログ表示パネル |
| `src/components/dev/CacheClear.tsx` | キャッシュクリアUI |
| `src/components/dev/ModelManager.tsx` | モデル管理UI |
| `src/components/dev/index.ts` | バレルエクスポート |
| `src/components/dev/__tests__/DevMenu.test.tsx` | DevMenu ページテスト |
| `src/pages/DevMenu.tsx` | ページ（スタブから修正） |

---

## 完了条件

- [x] `pnpm test` でテストが通る
- [x] 開発ビルドでのみ開発メニューが表示される
- [x] 本番ビルドではルート未登録・コードがバンドルから除外される
- [x] キャッシュクリアが動作する（履歴削除・設定リセット・FFmpeg削除）
- [x] モデル管理が動作する（個別削除・全削除）
- [x] デバッグログが表示される（捕捉・フィルタ・クリア・コピー）
