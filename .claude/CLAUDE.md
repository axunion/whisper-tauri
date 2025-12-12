# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Whisper Tauri - ローカル音声文字起こしデスクトップアプリケーション。音声データをサーバーに送信せず、Whisperモデルをローカル実行する。

**Status**: 計画段階（実装前）。`docs/` にある実装計画に従って開発を進める。

## Tech Stack

- **Frontend**: SolidJS + TypeScript + Vite + Tailwind CSS
- **UI Components**: Kobalte (Headless UI)
- **Backend**: Rust + Tauri 2
- **Audio Processing**: whisper-rs (whisper.cpp bindings)
- **State Management**: SolidJS Primitives (createSignal, createStore)
- **Persistence**: tauri-plugin-store
- **Package Manager**: pnpm

## Development Commands

```bash
# Development server
pnpm tauri dev

# Frontend tests
pnpm test

# Rust tests
cd src-tauri && cargo test

# Lint
pnpm lint          # Frontend (Biome)
cargo clippy       # Backend (Clippy)

# Format
pnpm format        # Frontend (Biome)
cargo fmt          # Backend (rustfmt)

# Build
pnpm tauri build

# Install git hooks (after clone)
pnpm lefthook install
```

## Code Quality

### Pre-commit Hooks (lefthook)

Automatically runs on commit:
- `pnpm lint` - Frontend linting
- `pnpm format` - Frontend formatting
- `cargo fmt --check` - Rust formatting check
- `cargo clippy` - Rust linting

Automatically runs on push:
- `pnpm test:run` - Frontend tests
- `cargo test` - Rust tests

### TypeScript Strict Mode

Enabled with additional strict options:
- `noUncheckedIndexedAccess` - Safer array/object access
- `noImplicitOverride` - Explicit override keyword
- `exactOptionalPropertyTypes` - Stricter optional properties

## Architecture

### Frontend (src/)

- `components/ui/` - Kobalte-based UI components
- `components/transcription/` - Transcription-related components
- `components/recording/` - Recording-related components
- `primitives/` - SolidJS state management (createWhisper, createSettings, etc.)
- `lib/` - Utilities (export, errors)
- `types/` - TypeScript type definitions

### Backend (src-tauri/src/)

- `whisper/` - Transcription module (commands.rs, process.rs, types.rs, error.rs)
- `recording/` - Recording module (capture.rs, commands.rs, types.rs)

### IPC Events (Rust → TypeScript)

| Event | Purpose |
|-------|---------|
| `whisper:progress` | Transcription progress |
| `whisper:result` | Transcription result |
| `model:download-progress` | Model download progress |
| `recording:level` | Recording audio level |

## Implementation Plan

MVP実装は `docs/mvp/step-01.md` から `step-07.md` まで順番に進める。
追加機能は `docs/features/` を参照（順不同）。

詳細は `docs/IMPLEMENTATION_PLAN.md` を参照。

## Model Configuration

| Model | Size | Bundled | Description |
|-------|------|---------|-------------|
| base | 142MB | **Yes** | Default model, bundled with app |
| small | 466MB | No | Optional download |
| medium | 1.5GB | No | Optional download |
| large | 2.9GB | No | Optional download |

**Note**: tiny model is excluded due to low quality.

### Model Download URL

Default: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/`

Custom URL can be specified for internal hosting. The download URL is constructed as:
```
{base_url}/ggml-{model_id}.bin
```

## Type Definitions

TypeScript型 (`src/types/`) と Rust型 (`src-tauri/src/*/types.rs`) は一致させる必要がある。
`#[serde(rename_all = "camelCase")]` を使用してRust snake_case → TypeScript camelCase 変換。

## Testing Policy

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

### テストコマンド

```bash
# フロントエンドテスト
pnpm test

# Rustテスト
cd src-tauri && cargo test

# 特定ファイルのテスト
pnpm test src/lib/export.test.ts
```

### 例外

- Step 1（プロジェクト基盤セットアップ）はテスト環境構築そのものなのでTDD対象外
- UIコンポーネントの視覚的確認はテストより手動確認を優先する場合がある

## Workflow Rules

1. **作業完了時のコミット確認**: 作業が完了したら、必ずコミットするかどうかユーザーに確認する。勝手にコミットしない。
2. **計画との乖離の記録**: 計画書（`docs/mvp/` または `docs/features/`）の通りに実装できない部分が発生した場合、該当する計画書ファイルにその内容を追記する。
3. **実装単位での確認**: ひとつのステップまたは機能の実装が完了したら作業を止め、ユーザーの確認を要請する。次のステップに勝手に進まない。
4. **コミットメッセージは英語**: コミットメッセージは必ず英語で記述する。
5. **TDD遵守**: テスト可能な実装では、必ず先にテストを書いてから実装する。
