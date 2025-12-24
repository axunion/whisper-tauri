# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Whisper Tauri - ローカル音声文字起こしデスクトップアプリケーション。音声データをサーバーに送信せず、Whisperモデルをローカル実行する。

**Status**: Step 1 完了。Step 2（型システム構築）から再開。

MVP は Step 1〜7 の順で進める。詳細は `docs/IMPLEMENTATION_PLAN.md` を参照。

### 仕様変更（当初計画からの変更点）

1. **モデル構成**: tiny 除外、全モデルをダウンロード方式（バンドルなし）
2. **ダウンロードURL**: 社内ホスティング用にカスタマイズ可能（モデル、ffmpeg）
3. **コード品質**: Biome, Clippy, lefthook, TypeScript strict mode 追加
4. **ffmpeg**: 初回使用時にダウンロード（バンドルなし）、GPL版
5. **UI**: solid-ui 採用（デフォルトスタイルで統一）

## Tech Stack

- **Frontend**: SolidJS + TypeScript + Vite + Tailwind CSS
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

# Git hooks インストール（clone後）
pnpm lefthook install
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

- `components/ui/` - solid-ui ベースの共通UIコンポーネント
- `components/layout/` - レイアウト (Sidebar, AppLayout)
- `components/dashboard/` - ダッシュボード
- `components/transcription/` - 文字起こし関連
- `components/recording/` - 録音関連
- `components/history/` - 履歴関連
- `components/text-processing/` - テキスト処理 (校正・要約)
- `components/dev/` - 開発メニュー (DEV only)
- `pages/` - ページコンポーネント
- `primitives/` - SolidJS 状態管理 (createWhisper, createSettings 等)
- `lib/` - ユーティリティ (export, errors)
- `types/` - TypeScript 型定義
- `i18n/` - 多言語対応
- `styles/` - スタイル定義

### Backend (src-tauri/src/)

- `whisper/` - 文字起こしモジュール (commands.rs, process.rs, types.rs, error.rs)
- `recording/` - 録音モジュール (capture.rs, commands.rs, types.rs)
- `converter/` - ファイル変換モジュール (ffmpeg.rs, downloader.rs, types.rs)
- `history/` - 履歴モジュール (db.rs, search.rs, types.rs)
- `text_processing/` - テキスト処理モジュール (server.rs, commands.rs, types.rs)

### IPC イベント (Rust → TypeScript)

| イベント | 用途 |
|---------|------|
| `whisper:progress` | 文字起こし進捗 |
| `whisper:result` | 文字起こし結果 |
| `model:download-progress` | Whisperモデル DL進捗 |
| `recording:level` | 録音音量 |
| `text:download-progress` | SLMモデル DL進捗 |
| `text:inference-progress` | テキスト処理進捗 |
| `ffmpeg:download-progress` | ffmpeg DL進捗 |

## 実装計画

MVP実装は `docs/mvp/step-01.md` から `step-07.md` まで順番に進める。
追加機能は `docs/features/` を参照（順不同）。

詳細は `docs/IMPLEMENTATION_PLAN.md` を参照。

## モデル設定

| モデル | サイズ | デフォルト | 説明 |
|--------|-------|-----------|------|
| base | 142MB | **Yes** | 初回使用推奨 |
| small | 466MB | No | 中程度の品質・速度 |
| medium | 1.5GB | No | 高品質、処理時間長め |
| large | 2.9GB | No | 最高品質、要高性能マシン |

**注意**:
- tiny は品質が低いため除外
- 全モデルがダウンロード方式（バンドルなし）

### ダウンロードURL

デフォルト: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/`

カスタムURLは設定画面で指定可能。URL構成:
```
{base_url}/ggml-{model_id}.bin
```

## ffmpeg 設定

ffmpeg は初回使用時にダウンロード（GPL版）。アプリにはバンドルしない。

### ダウンロードURL

| プラットフォーム | デフォルトURL |
|----------------|--------------|
| Windows | `https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/` |
| macOS | 自前ホスト推奨（evermeet.cx は不安定な場合あり） |

カスタムURLは設定画面で指定可能（社内サーバーからの配布等）。

## 型定義

TypeScript型 (`src/types/`) と Rust型 (`src-tauri/src/*/types.rs`) は一致させる必要がある。
`#[serde(rename_all = "camelCase")]` を使用して Rust snake_case → TypeScript camelCase 変換。

## テスト方針

TDD（テスト駆動開発）アプローチを採用する。

### 原則

1. **テスト先行**: 実装の前にテストを書く
2. **フルスタック**: TypeScript (Vitest) と Rust (cargo test) の両方でテストを書く
3. **完了条件**: 全テストがパスしなければ実装完了とみなさない

### 開発フロー

```
1. 計画書のテスト要件を確認
2. テストファイルを作成（この時点では失敗する）
3. 実装を行う
4. テストがパスすることを確認
5. 完了条件をチェック
```

### 例外

- Step 1（プロジェクト基盤セットアップ）はテスト環境構築そのものなのでTDD対象外
- UIコンポーネントの視覚的確認はテストより手動確認を優先する場合がある

## ワークフロールール

1. **コミット確認**: 作業完了時、コミットするかユーザーに確認する。勝手にコミットしない
2. **計画との乖離記録**: 計画書通りに実装できない場合、該当する計画書に追記する
3. **実装単位での確認**: ステップ/機能の実装完了後、ユーザー確認を要請する。次へ勝手に進まない
4. **コミットメッセージ**: 英語で記述
5. **TDD遵守**: テスト可能な実装では、先にテストを書く
6. **計画書記述ルール**: `docs/` 内は具体的コードを記載せず、シンプルで最低限の内容に
7. **計画書追加時の整合性**: 新規追加時は以下も更新：
   - `docs/features/README.md`
   - `docs/IMPLEMENTATION_PLAN.md`
   - 関連する計画書への相互参照
