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

# 検証（スラッシュコマンド）
/verify frontend   # フロントエンドのみ (fe も可)
/verify backend    # バックエンドのみ (be も可)
/verify all        # 全チェック（デフォルト）
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
│   ├── ui/              # solid-ui ベースの共通UIコンポーネント (Button, Progress, Card, Badge, Sidebar, Select, Label, Separator, AlertDialog)
│   ├── layout/          # レイアウト (AppSidebar, AppLayout)
│   ├── dashboard/       # ダッシュボード (Dashboard, QuickActions, RecentHistory, ModelStatus)
│   └── transcription/   # 文字起こし関連 (FileSelector, ModelSelector, TranscriptionProgress, ResultViewer)
├── pages/               # ページコンポーネント (Transcription, Settings, DevMenu)
├── primitives/          # SolidJS 状態管理 (createWhisper, createSettings, createTheme)
├── lib/                 # ユーティリティ (utils.ts - cn())
├── types/               # TypeScript 型定義 (whisper.ts, settings.ts)
└── test/                # テストセットアップ
```

### ルーティング (@solidjs/router)

| パス | コンポーネント | 説明 |
|------|--------------|------|
| `/` | Dashboard | ダッシュボード（初期画面） |
| `/transcription` | Transcription | 文字起こし画面 |
| `/settings` | Settings | 設定画面（一般設定・モデル管理） |
| `/dev` | DevMenu | 開発メニュー（DEVのみ） |

`AppLayout` が全ページ共通のサイドバーレイアウトを提供。サイドバーは `collapsible="icon"` でアイコンのみに折りたたみ可能。

### Backend (src-tauri/src/)

```
src-tauri/src/
└── whisper/             # 文字起こしモジュール
    ├── commands.rs      # Tauri コマンド
    ├── process.rs       # whisper-rs 実行ロジック
    ├── models.rs        # モデル管理
    ├── types.rs         # 型定義
    └── error.rs         # エラー型
```

### IPC イベント (Rust → TypeScript)

| イベント | 用途 |
|---------|------|
| `whisper:progress` | 文字起こし進捗 |
| `whisper:result` | 文字起こし結果 |
| `model:download-progress` | Whisperモデル DL進捗 |

## 実装計画

MVP（Step 1〜7）は完了済み。詳細は `docs/IMPLEMENTATION_PLAN.md` を参照。

追加機能は `docs/features/` を参照（順不同）。

完了済み:
- ダッシュボード（サイドバーレイアウト + ルーティング）
- 設定永続化（設定プリミティブ + 設定画面UI + テーマ適用）

推奨（未実装）:
- ファイル変換、エクスポート、エラーハンドリング、履歴管理、プロダクトビルド

## モデル設定

| モデル | サイズ | デフォルト | 説明 |
|--------|-------|-----------|------|
| large-v3-turbo | 1.6GB | **Yes** | 推奨。高品質かつ高速、日本語精度に優れる |
| medium | 1.5GB | No | Turbo の動作が重い場合の代替 |
| small | 466MB | No | 低スペックマシン向け、品質は控えめ |

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
