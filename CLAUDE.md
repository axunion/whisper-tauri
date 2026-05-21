# CLAUDE.md

## Project Overview

Whisper Tauri - ローカル音声文字起こしデスクトップアプリ。Whisperモデルをローカル実行し、音声データを外部送信しない。

## Tech Stack

- **Frontend**: SolidJS + TypeScript + Vite + Tailwind CSS v4
- **UI**: solid-ui (Kobalte ベース、コピー＆ペースト方式) — https://www.solid-ui.com/docs
- **Backend**: Rust + Tauri 2 + whisper-rs
- **State**: SolidJS Primitives (createSignal, createStore)
- **Persistence**: tauri-plugin-store / SQLite (履歴)
- **Package Manager**: pnpm

## 開発コマンド

```bash
pnpm tauri dev                  # 開発サーバー
pnpm test:run / cargo test      # テスト（pnpm test は対話モード、単発実行は test:run）
pnpm check / cargo clippy       # Biome (lint + format) + tsc / Rust lint
pnpm fix / cargo fmt            # 自動修正
pnpm typecheck                  # 型チェック単体 (tsc --noEmit)
pnpm tauri build                # ビルド

/verify [frontend|backend|all]  # 検証（コミット前に必ず実行）
/refactor-fe <対象>              # FEリファクタリング
/refactor-be <対象>              # BEリファクタリング
/add-command <mod> <cmd>        # Tauriコマンド追加（FE/BE一貫生成）
/add-module <name>              # 新規バックエンドモジュール作成
/i18n                            # i18n品質チェック
/release [version]              # リリースドライブ（タグpush→CI監視）
```

## アーキテクチャ

### Frontend (src/)

```
src/
├── components/    # ui, layout, dashboard, onboarding, settings, history, transcription, text-processing, dev
├── pages/         # Transcription, History, Settings, DevMenu
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
├── lib.rs / main.rs   # エントリポイント・invoke_handler 登録
├── download.rs        # 汎用ダウンロード共通
├── paths.rs           # アプリディレクトリ解決
├── settings.rs        # tauri-plugin-store ラッパー
├── whisper/           # 文字起こし (whisper-rs)
├── converter/         # ファイル変換 (ffmpeg)
├── history/           # 履歴 (SQLite)
├── recording/         # リアルタイム録音 (cpal)
├── text_processing/   # テキスト処理 (llama-server + LLM)
└── notion/            # Notion API 連携 (reqwest)
```

ドメインモジュールは基本 `commands.rs` / `types.rs` / `error.rs` / `mod.rs` の共通構成。実装規模が大きい `text_processing` 等は `extract.rs` / `inference.rs` / `models.rs` / `server.rs` を追加で持つ。

## 型定義

TypeScript型 (`src/types/`) と Rust型 (`src-tauri/src/*/types.rs`) は一致させる。
`#[serde(rename_all = "camelCase")]` で snake_case → camelCase 変換。

## ワークフロールール

- **TDD遵守**: テスト可能な実装では先にテストを書く。UIの視覚確認は例外
- **TypeScript Strict**: `noUncheckedIndexedAccess` / `noImplicitOverride` / `exactOptionalPropertyTypes` 有効

## Git Commit Style

- imperative の英文タイトル 1 行。Conventional Commits prefix (`feat:` / `fix:` 等) や AX-Tag は付けない
- **変更が非自明な場合** (新機能 / 設計判断 / リファクタの why / 既存挙動の修正) は 1 行空けて本文 2〜3 段落で書く:
  - 何を変えたか (主要 hunks の要約)
  - なぜ変えたか (背景・代替案を退けた理由)
  - スコープ外として残した項目 / 後追いタスク
- マージ後の `docs/improvements.md` の Status 更新が含まれる場合は本文末尾で軽く触れる
- 過去の良例: `7a48eed` (saving + permission)、`574f270` (legacy cleanup)、`416803b` (model drop) を参照

## ルール (`.claude/rules/`)

該当パスに編集が入ると system reminder として自動挿入されるプロジェクト固有ルール群。

| ファイル | 用途 |
|---|---|
| `error-handling.md` | Rust `error.rs` の prefix 命名と FE `errors.ts::PREFIX_MAP` の同期 |
| `i18n.md` | UI 文字列追加・変更時の `types.ts` / 全 locale / `t("...")` 同期 |
| `ipc-events.md` | Rust → TS イベント名 (`whisper:progress` 等) のリファレンス |
| `tauri-permissions.md` | `@tauri-apps/plugin-*` 利用時の `capabilities/default.json` permission チェック |
| `tuning.md` | チューニング方針 — 標準設定を優先、独自整形で弱点を隠さない |
| `ui-design.md` | Glassmorphism / `SectionRow` / `Separator` など UI 共通ルール |
| `workarounds.md` | 既知バグの workaround (whisper-rs FFI UB / `SOURCE_DATE_EPOCH` 等) |
