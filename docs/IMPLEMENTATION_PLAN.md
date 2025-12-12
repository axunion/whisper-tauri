# Whisper Local - 実装計画書

ローカル音声文字起こしデスクトップアプリケーションの実装計画書

---

## プロジェクト概要

### 目的

プライバシー重視のローカル音声文字起こしアプリ。音声データをサーバーに送信せず、Whisperモデルをローカル実行する。

### 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | **SolidJS** + TypeScript + Vite |
| UIコンポーネント | **Kobalte** (Headless UI) + Tailwind CSS |
| バックエンド | Rust + Tauri 2 |
| 音声処理 | whisper-rs (whisper.cpp バインディング) |
| 状態管理 | SolidJS Primitives (createSignal, createStore) |
| 永続化 | tauri-plugin-store |
| パッケージマネージャ | pnpm |

---

## ドキュメント構成

```
docs/
├── IMPLEMENTATION_PLAN.md   # 本ファイル
├── ARCHITECTURE.md          # アーキテクチャ設計
├── mvp/                     # MVP実装ステップ（順番に進める）
│   ├── step-01.md
│   ├── step-02.md
│   ├── ...
│   └── step-07.md
└── features/                # 追加機能（順不同）
    ├── README.md
    ├── export.md
    ├── error-handling.md
    └── ...
```

---

## MVP（Step 1-7）

**目標**: 「音声ファイルを選んで、文字起こし結果を見る」ができる状態

### ステップ一覧

| Step | 内容 | 詳細 |
|------|------|------|
| 1 | プロジェクト基盤セットアップ | [step-01.md](./mvp/step-01.md) |
| 2 | 型システム構築 | [step-02.md](./mvp/step-02.md) |
| 3 | モデル管理（Rust） | [step-03.md](./mvp/step-03.md) |
| 4 | whisper-rs統合 | [step-04.md](./mvp/step-04.md) |
| 5 | 状態管理プリミティブ | [step-05.md](./mvp/step-05.md) |
| 6 | 基本UIコンポーネント | [step-06.md](./mvp/step-06.md) |
| 7 | メインアプリ統合 | [step-07.md](./mvp/step-07.md) |

### MVP完了条件

- [ ] `pnpm tauri dev` でアプリが起動する
- [ ] WAVファイルを選択できる
- [ ] モデルをダウンロードできる
- [ ] 文字起こしが実行され、結果が表示される

---

## 追加機能

MVP完了後、必要に応じて実装する機能です。
順序は問わず、優先度や必要性に応じて選択してください。

詳細は [features/README.md](./features/README.md) を参照。

### 一覧

| 機能 | 説明 | 優先度 |
|------|------|--------|
| [ファイル変換](./features/file-conversion.md) | 音声/動画ファイルをWAVに変換 | 推奨 |
| [エクスポート](./features/export.md) | TXT/SRT/VTT形式で結果を保存 | 推奨 |
| [エラーハンドリング](./features/error-handling.md) | 構造化されたエラー表示 | 推奨 |
| [設定永続化](./features/settings.md) | アプリ設定の保存・復元 | 推奨 |
| [多言語対応](./features/i18n.md) | 日本語/英語の切り替え | 任意 |
| [トースト通知](./features/toast.md) | 操作結果のフィードバック | 任意 |
| [キーボードショートカット](./features/keyboard-shortcuts.md) | パワーユーザー向け操作 | 任意 |
| [アニメーション](./features/animations.md) | UIの視覚的強化 | 任意 |
| [リアルタイム録音](./features/recording.md) | マイクから直接文字起こし | 任意 |

---

## 開発の進め方

### テスト方針（TDD）

本プロジェクトはTDD（テスト駆動開発）アプローチを採用する。

| 原則 | 説明 |
|------|------|
| テスト先行 | 実装の前にテストを書く |
| フルスタック | TypeScript (Vitest) と Rust (cargo test) の両方でテスト |
| 完了条件 | 全テストがパスしなければ実装完了とみなさない |

**例外**:
- Step 1（プロジェクト基盤セットアップ）はテスト環境構築そのものなのでTDD対象外
- UIコンポーネントの視覚的確認は手動確認を優先する場合がある

### 基本原則

1. **MVPを最優先で完了させる**
   - Step 1 から順番に進める
   - 各Step完了ごとにテストと動作確認

2. **追加機能は必要に応じて選択**
   - 全てを実装する必要はない
   - ユーザーフィードバックを見て優先度を調整

### 推奨フロー（TDD）

```
1. Step の目的を確認
2. テスト要件を確認
3. テストファイルを作成（この時点では失敗する）
4. 実装を行う
5. テスト実行（pnpm test / cargo test）
6. テストがパスすることを確認
7. 動作確認
8. 完了条件をチェック
9. 次の Step へ（MVP完了後は features へ）
```

---

## ディレクトリ構造

```
whisper-tauri/
├── src/                              # フロントエンド (SolidJS)
│   ├── components/
│   │   ├── transcription/            # 文字起こし関連
│   │   ├── recording/                # 録音関連
│   │   └── ui/                       # Kobalte + カスタムUI
│   ├── primitives/                   # SolidJS状態管理
│   ├── lib/                          # ユーティリティ
│   ├── types/                        # 型定義
│   ├── i18n/                         # 多言語対応
│   ├── styles/                       # スタイル
│   ├── test/                         # テストセットアップ
│   └── App.tsx
│
├── src-tauri/                        # バックエンド (Rust)
│   ├── src/
│   │   ├── whisper/                  # 文字起こしモジュール
│   │   └── recording/                # 録音モジュール
│   └── Cargo.toml
│
└── docs/                             # ドキュメント
    ├── IMPLEMENTATION_PLAN.md
    ├── ARCHITECTURE.md
    ├── mvp/
    └── features/
```

---

## 主要な依存パッケージ

### フロントエンド (npm)

| パッケージ | 用途 |
|-----------|------|
| solid-js | UIフレームワーク |
| @tauri-apps/api | Tauri API |
| @tauri-apps/plugin-dialog | ファイルダイアログ |
| @tauri-apps/plugin-fs | ファイル操作 |
| @tauri-apps/plugin-store | 設定永続化 |
| @kobalte/core | アクセシブルUIコンポーネント |
| solid-icons | アイコン |
| tailwindcss | スタイリング |
| vitest | テスト |
| @solidjs/testing-library | コンポーネントテスト |

### バックエンド (Cargo)

| パッケージ | 用途 |
|-----------|------|
| tauri | アプリフレームワーク |
| tauri-plugin-dialog | ファイルダイアログ |
| tauri-plugin-fs | ファイル操作 |
| tauri-plugin-store | 設定永続化 |
| whisper-rs | Whisper.cppバインディング |
| hound | WAVファイル読み込み |
| tokio | 非同期ランタイム |
| reqwest | HTTPクライアント |
| serde | シリアライズ |
| thiserror | エラー型 |

---

## Tauri IPC イベント一覧

| イベント名 | 方向 | 用途 |
|-----------|------|------|
| `whisper:progress` | Rust → TS | 文字起こし進捗 |
| `whisper:result` | Rust → TS | 文字起こし結果 |
| `model:download-progress` | Rust → TS | モデルDL進捗 |
| `recording:level` | Rust → TS | 録音音量 |
