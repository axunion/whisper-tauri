# キーボードショートカット

**カテゴリ**: UX改善 | **優先度**: 任意

パワーユーザー向けのキーボードショートカット機能を実装する。

---

## 目的

- 効率的な操作のためのショートカット
- ショートカットヘルプ

---

## テスト要件

### TypeScript (Vitest)

`src/primitives/__tests__/createKeyboardShortcuts.test.ts`:

| テスト | 内容 |
|-------|------|
| register | ショートカットを登録できる |
| unregister | ショートカットを解除できる |
| keydown | 登録したショートカットが発火する |
| keydown | ctrl修飾キーが正しく判定される |
| keydown | INPUT内では発火しない |
| keydown | TEXTAREA内では発火しない |
| keydown | when条件がfalseの場合は発火しない |
| formatShortcut | macOS形式で表示される |
| formatShortcut | Windows形式で表示される |

---

## 実装内容

### 1. ショートカットプリミティブ

`src/primitives/createKeyboardShortcuts.ts` に以下を実装：

#### Shortcut型

| プロパティ | 型 | 説明 |
|-----------|-----|------|
| key | string | キー（例: 'o', 'Enter', 'Escape'） |
| ctrl? | boolean | Ctrl/Cmd修飾キー |
| action | () => void | 実行する処理 |
| description | string | 説明文 |
| when? | () => boolean | 有効条件 |

#### 関数

| 関数 | 説明 |
|------|------|
| register(shortcuts) | ショートカットを登録 |
| unregister() | ショートカットを解除 |
| formatShortcut(shortcut) | 表示用文字列を生成（例: "⌘ + O"） |

### 2. 動作仕様

- `keydown` イベントをリッスン
- 入力フィールド（INPUT, TEXTAREA）内では無効
- macOSでは `metaKey`、その他は `ctrlKey` を使用
- `when` 条件が設定されている場合は条件を評価
- `onCleanup` でイベントリスナーを解除

### 3. ショートカット一覧

| ショートカット | アクション |
|--------------|-----------|
| `Cmd/Ctrl + O` | ファイル選択 |
| `Cmd/Ctrl + Enter` | 文字起こし開始 |
| `Cmd/Ctrl + C` | 結果コピー（結果表示時） |
| `Escape` | キャンセル（処理中のみ） |

---

## 作成ファイル

| ファイル | 説明 |
|---------|------|
| `src/primitives/__tests__/createKeyboardShortcuts.test.ts` | **テスト（先に作成）** |
| `src/primitives/createKeyboardShortcuts.ts` | ショートカット |

---

## 技術的注意点

- `navigator.platform` でmacOSを判定
- イベントの `preventDefault()` でブラウザデフォルト動作を防止
- 条件付きショートカットは `when` プロパティで制御

---

## 完了条件

- [ ] `pnpm test` で全テストが通る
- [ ] 各ショートカットが動作する
- [ ] 入力フィールド内では無効
