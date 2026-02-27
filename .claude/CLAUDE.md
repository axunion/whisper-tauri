# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Whisper Tauri - ローカル音声文字起こしデスクトップアプリケーション。音声データをサーバーに送信せず、Whisperモデルをローカル実行する。

**Status**: MVP完了。追加機能の実装フェーズ。

## Tech Stack

- **Frontend**: SolidJS + TypeScript + Vite + Tailwind CSS v4
- **UI Components**: solid-ui (Kobalte + Corvu ベース、shadcn/ui ポート)
- **Backend**: Rust + Tauri 2
- **Audio Processing**: whisper-rs (whisper.cpp bindings)
- **State Management**: SolidJS Primitives (createSignal, createStore)
- **Persistence**: tauri-plugin-store
- **Package Manager**: pnpm

### UI方針 (solid-ui)

[solid-ui](https://www.solid-ui.com/) を使用し、デザインの統一性を保つ。

- **方式**: コピー＆ペースト（npmパッケージではない）
- **ベース**: Kobalte + Corvu + Tailwind CSS
- **原則**: solid-ui のデフォルトスタイルを可能な限り使用し、カスタマイズは最小限に
- **参照**: https://www.solid-ui.com/docs

## 開発コマンド

```bash
# 開発サーバー
pnpm tauri dev

# テスト
pnpm test                     # フロントエンド
cd src-tauri && cargo test    # バックエンド

# Lint
pnpm lint          # フロントエンド (Biome)
cargo clippy       # バックエンド (Clippy)

# Format
pnpm format        # フロントエンド (Biome)
cargo fmt          # バックエンド (rustfmt)

# ビルド
pnpm tauri build

# 型チェック
pnpm typecheck     # TypeScript (tsc --noEmit)

# Git hooks インストール（clone後）
pnpm lefthook install

# スラッシュコマンド
/verify frontend   # フロントエンド検証 (fe も可)
/verify backend    # バックエンド検証 (be も可)
/verify all        # 全チェック（デフォルト）
/refactor-fe <対象>  # フロントエンドリファクタリング
/refactor-be <対象>  # バックエンドリファクタリング
/i18n                # i18n品質チェック＆改善
```

## コード品質

### Pre-commit Hooks (lefthook)

コミット時に自動実行:
- `pnpm lint` - フロントエンド lint
- `pnpm format` - フロントエンド format
- `cargo fmt --check` - Rust format チェック
- `cargo clippy` - Rust lint

プッシュ時に自動実行:
- `pnpm test:run` - フロントエンドテスト
- `cargo test` - Rust テスト

### TypeScript Strict Mode

追加の厳格オプションを有効化:
- `noUncheckedIndexedAccess` - 配列/オブジェクトアクセスの安全性向上
- `noImplicitOverride` - 明示的な override キーワード
- `exactOptionalPropertyTypes` - オプショナルプロパティの厳格化

## アーキテクチャ

### Frontend (src/)

```
src/
├── components/
│   ├── ui/              # solid-ui ベースの共通UIコンポーネント
│   ├── layout/          # レイアウト
│   ├── dashboard/       # ダッシュボード
│   ├── dev/             # 開発メニュー
│   ├── history/         # 履歴管理
│   └── transcription/   # 文字起こし関連
├── pages/               # ページコンポーネント
├── primitives/          # SolidJS 状態管理プリミティブ
├── i18n/                # 多言語対応（辞書・Provider・useI18n）
├── lib/                 # ユーティリティ関数
├── types/               # TypeScript 型定義
└── test/                # テストセットアップ
```

### ルーティング (@solidjs/router)

| パス | コンポーネント | 説明 |
|------|--------------|------|
| `/` | Dashboard | ダッシュボード（初期画面） |
| `/transcription` | Transcription | 文字起こし画面 |
| `/history` | History | 履歴管理画面 |
| `/settings` | Settings | 設定画面（一般設定・モデル管理・ツール管理） |
| `/dev` | DevMenu | 開発メニュー（DEVのみ） |

`AppLayout` が全ページ共通のサイドバーレイアウトを提供。サイドバーは `collapsible="icon"` でアイコンのみに折りたたみ可能。

### Backend (src-tauri/src/)

```
src-tauri/src/
├── whisper/             # 文字起こしモジュール
├── converter/           # ファイル変換モジュール（ffmpeg）
└── history/             # 履歴管理モジュール（SQLite）
```

各モジュールは `commands.rs` / `types.rs` / `error.rs` / `mod.rs` の共通構成に従う。

### IPC イベント (Rust → TypeScript)

| イベント | 用途 |
|---------|------|
| `whisper:progress` | 文字起こし進捗 |
| `whisper:result` | 文字起こし結果 |
| `model:download-progress` | Whisperモデル DL進捗 |
| `ffmpeg:download-progress` | ffmpeg DL進捗 |

## 実装計画

MVP（Step 1〜7）は完了済み。詳細は `docs/IMPLEMENTATION_PLAN.md` を参照。

追加機能は `docs/features/` を参照（順不同）。

完了済み:
- ダッシュボード（サイドバーレイアウト + ルーティング）
- 設定永続化（設定プリミティブ + 設定画面UI + テーマ適用）
- ファイル変換（ffmpegダウンロード + 音声/動画→WAV変換 + UI統合）
- モデル速度情報（ハードウェア別の処理時間目安をダッシュボード・設定画面に表示）
- エラーハンドリング強化（構造化エラー型 + ErrorDisplayコンポーネント + 全3プリミティブ対応）
- 開発メニュー（キャッシュクリア + モデル管理 + デバッグログ）
- エクスポート（TXT/SRT/VTT形式）
- 履歴管理（SQLite永続化 + Sheet詳細表示）
- トースト通知（操作結果フィードバック）
- 多言語対応（i18n — 日本語/英語切り替え、I18nProvider + useI18n パターン）

推奨（未実装）:
- プロダクトビルド

## モデル設定

| モデル | サイズ | デフォルト | 説明 |
|--------|-------|-----------|------|
| large-v3-turbo | 1.6GB | **Yes** | 推奨。高品質かつ高速、日本語精度に優れる |
| medium | 1.5GB | No | Turbo の動作が重い場合の代替 |
| small | 466MB | No | 低スペックマシン向け、品質は控えめ |

### 速度目安（音声1分あたり）

`ModelInfo.speedNote` フィールドでダッシュボード・設定画面に表示。`models.rs::get_speed_note()` がアーキテクチャに基づき返す。

| モデル | Apple Silicon (aarch64) | Intel Mac (x86_64) |
|--------|------------------------|---------------------|
| large-v3-turbo | ~5-15s/min | ~30-90s/min |
| medium | ~5-18s/min | ~30-90s/min |
| small | ~2-5s/min | ~10-30s/min |

### ダウンロードURL

デフォルト: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/`

カスタムURLは設定画面で指定可能。URL構成:
```
{base_url}/ggml-{model_id}.bin
```

## 既知の問題・ワークアラウンド

### whisper-rs 0.15.1: `set_abort_callback_safe` の UB バグ

`set_abort_callback_safe` に直接クロージャを渡すと、FFI トランポリン関数の型不一致により未定義動作が発生する。

**ワークアラウンド** (`src-tauri/src/whisper/process.rs`):

```rust
// NG: trampoline::<ConcreteClosureType> と Box<dyn> の不一致で UB
params.set_abort_callback_safe(move || token.is_cancelled());

// OK: F = Box<dyn FnMut() -> bool> にすることでトランポリンの型が一致
let abort_fn: Box<dyn FnMut() -> bool> = Box::new(move || token.is_cancelled());
params.set_abort_callback_safe(abort_fn);
```

**解消条件**: whisper-rs の修正版リリース後にワークアラウンドを除去可能。

## 型定義

TypeScript型 (`src/types/`) と Rust型 (`src-tauri/src/*/types.rs`) は一致させる必要がある。
`#[serde(rename_all = "camelCase")]` を使用して Rust snake_case → TypeScript camelCase 変換。

## テスト方針

TDD（テスト駆動開発）アプローチを採用する。

### 原則

1. **テスト先行**: 実装の前にテストを書く
2. **フルスタック**: TypeScript (Vitest) と Rust (cargo test) の両方でテストを書く
3. **完了条件**: 全テストがパスしなければ実装完了とみなさない

### 例外

- UIコンポーネントの視覚的確認はテストより手動確認を優先する場合がある

## ワークフロールール

1. **実装完了時**: ユーザー確認 → ドキュメント更新 → コミット
2. **コミット**: 勝手にしない。英語で記述
3. **計画との乖離**: 計画書通りに実装できない場合、該当計画書に追記
4. **TDD遵守**: テスト可能な実装では先にテストを書く
5. **計画書**: `docs/` 内は具体的コードを記載せず簡潔に。新規追加時は `README.md` と `IMPLEMENTATION_PLAN.md` も更新
6. **i18n同期**: UIに表示される文字列を追加・変更・削除した場合、必ず以下を反映する:
   - `src/i18n/types.ts` の `Dictionary` インターフェースにキーを追加/削除
   - `src/i18n/dictionaries/` 内の**すべてのロケールファイル**に翻訳を追加/削除
   - コンポーネント側で `t("key")` を使用（ハードコード文字列を残さない）
   - プレースホルダー（`{count}` 等）はすべてのロケールで一致させる
