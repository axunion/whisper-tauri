# CLAUDE.md

## Project Overview

Whisper Tauri - ローカル音声文字起こしデスクトップアプリ。Whisperモデルをローカル実行し、音声データを外部送信しない。

## Tech Stack

- **Frontend**: SolidJS + TypeScript + Vite + Tailwind CSS v4
- **UI**: solid-ui (Kobalte + Corvu、コピー＆ペースト方式) — https://www.solid-ui.com/docs
- **Backend**: Rust + Tauri 2 + whisper-rs
- **State**: SolidJS Primitives (createSignal, createStore)
- **Persistence**: tauri-plugin-store / SQLite (履歴)
- **Package Manager**: pnpm

## 開発コマンド

```bash
pnpm tauri dev                  # 開発サーバー
pnpm test / cargo test          # テスト (src-tauri/ で実行)
pnpm lint / cargo clippy        # Lint
pnpm format / cargo fmt         # Format
pnpm typecheck                  # 型チェック (tsc --noEmit)
pnpm tauri build                # ビルド

/verify [frontend|backend|all]  # 検証（コミット前に必ず実行）
/refactor-fe <対象>              # FEリファクタリング
/refactor-be <対象>              # BEリファクタリング
/i18n                            # i18n品質チェック
```

## アーキテクチャ

### Frontend (src/)

```
src/
├── components/    # ui/, layout/, dashboard/, dev/, history/, transcription/
├── pages/         # Dashboard, Transcription, History, Settings, DevMenu
├── primitives/    # 状態管理プリミティブ
├── i18n/          # 多言語対応（日/英）
├── lib/           # ユーティリティ
├── types/         # 型定義
└── styles/        # カスタムCSS
```

`AppLayout` + `@solidjs/router` でサイドバーレイアウト。`collapsible="icon"` で折りたたみ可能。

### Backend (src-tauri/src/)

```
src-tauri/src/
├── whisper/          # 文字起こし（whisper-rs）
├── converter/        # ファイル変換（ffmpeg）
├── history/          # 履歴管理（SQLite）
├── recording/        # リアルタイム録音（cpal）
└── text_processing/  # テキスト処理（llama-server + LLM）
```

各モジュールは `commands.rs` / `types.rs` / `error.rs` / `mod.rs` の共通構成。

## 型定義

TypeScript型 (`src/types/`) と Rust型 (`src-tauri/src/*/types.rs`) は一致させる。
`#[serde(rename_all = "camelCase")]` で snake_case → camelCase 変換。

## ワークフロールール

1. **実装完了時**: ユーザー確認 → `/verify` → コミット
2. **コミット**: 勝手にしない。英語で記述
3. **TDD遵守**: テスト可能な実装では先にテストを書く。UIの視覚確認は例外
4. **TypeScript Strict**: `noUncheckedIndexedAccess` / `noImplicitOverride` / `exactOptionalPropertyTypes` 有効
