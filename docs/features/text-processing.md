# テキスト処理（校正・要約）

**カテゴリ**: 高度な機能 | **優先度**: 任意

ローカルで動作する言語モデルを使用して、文字起こし結果の校正・要約を行う機能。

---

## 目的

- 文法修正（誤字脱字、助詞の誤りなど）
- 表記統一（漢字/ひらがな、数字表記など）
- 長文の要約生成
- オフライン環境での動作（プライバシー重視）

---

## アーキテクチャ

### サブプロセスアプローチ

llama.cppのRustバインディングを直接統合するとクラッシュリスクがあるため、**llama-server**をサブプロセスとして起動し、HTTP APIで通信する。

```
┌─────────────────────┐       HTTP        ┌──────────────────────┐
│   Tauri アプリ      │ ───────────────► │  llama-server        │
│   (メインプロセス)   │                   │  (サブプロセス)       │
│                     │ POST /completion  │                      │
│  - サーバー起動     │ ◄─────────────── │  - モデルロード済み   │
│  - HTTP通信        │      JSON         │  - 推論実行          │
│  - 結果をUIに表示   │                   │                      │
└─────────────────────┘                   └──────────────────────┘
```

### llama-serverとは

- llama.cppプロジェクト公式のHTTPサーバー
- OpenAI互換API（`/v1/chat/completions`等）を提供
- ストリーミング対応（Server-Sent Events）
- プラットフォーム別ビルド済みバイナリあり（5-20MB）

### メリット

- クラッシュ隔離（サーバーがクラッシュしてもアプリは継続）
- メモリ管理（プロセス終了でOSが完全回収）
- 実装の簡素化（HTTP通信のみ、バインディング不要）
- 公式メンテナンス（llama.cppチームが更新）

---

## モデル選定

### 用途

文字起こし結果の校正・要約が主な用途のため、高度な推論能力は不要。軽量かつ日本語対応を重視。

### 使用モデル（GGUF Q4_K_M）

| カテゴリ | モデル | サイズ | 特徴 |
|----------|--------|--------|------|
| 軽量 | google_gemma-3-1b-it-Q4_K_M.gguf | ~800MB | 校正・要約の最小構成 |
| 高品質 | google_gemma-3-4b-it-Q4_K_M.gguf | ~2.5GB | バランス型、高品質な日本語処理 |

**注**:
- Gemma 3 は Google 最新の軽量モデルで、多言語対応が強化されている
- 初回使用推奨は軽量版（1B）、高品質が必要な場合は 4B を使用

### ダウンロード設定

- **モデル**: HuggingFace（カスタムURL対応）
- **llama-server**: GitHub Releases（カスタムURL対応）
- Whisperモデルと同様の設定方式

---

## 機能

### 1. 文法修正

- 誤字脱字の修正
- 助詞・接続詞の誤り修正
- 不自然な表現の修正

### 2. 表記統一

- 漢字/ひらがな統一
- 数字表記統一（全角/半角、漢数字）
- 記号統一

### 3. 要約

- 文字起こし結果の要約生成
- 要約の長さ指定（短/中/長）
- 箇条書き形式オプション

---

## プロンプト設計

### Gemma 3 の特徴

- **制御トークン**: `<start_of_turn>`, `<end_of_turn>`, `user`, `model`
- **system role 非対応**: システム指示は user メッセージ内に含める
- **参考**: [Google AI - Gemma formatting](https://ai.google.dev/gemma/docs/core/prompt-structure)

### 設計方針

| 項目 | 方針 |
|------|------|
| 出力制限 | 結果のみ出力させ、説明を抑制 |
| 停止トークン | `<end_of_turn>` で応答終了を検出 |
| temperature | 低め（0.2-0.4）で安定出力 |

---

## テスト要件

### TypeScript (Vitest)

| テスト | 内容 |
|--------|------|
| プロンプト生成 | 校正用プロンプトが正しく生成される |
| プロンプト生成 | 要約用プロンプトが正しく生成される |
| 結果パース | モデル出力から結果を正しく抽出 |

### Rust (cargo test)

| テスト | 内容 |
|--------|------|
| モデル一覧 | 利用可能なモデル一覧を返す |
| モデルパス | モデルファイルパスを正しく解決 |
| ダウンロードURL | カスタムURL設定が反映される |
| サーバーパス | llama-serverバイナリパスを正しく解決 |

---

## 実装内容

### Backend (Rust)

1. **テキスト処理モジュール** (`src-tauri/src/text_processing/`)
   - llama-server管理（起動・停止・ヘルスチェック）
   - モデル管理（ダウンロード、削除、一覧）
   - HTTP通信による推論リクエスト

2. **Tauriコマンド**
   - `text:list_models` - 利用可能なモデル一覧
   - `text:download_model` - モデルダウンロード
   - `text:delete_model` - モデル削除
   - `text:download_server` - llama-serverダウンロード
   - `text:proofread` - 校正実行
   - `text:summarize` - 要約実行

3. **IPCイベント**
   - `text:download-progress` - ダウンロード進捗
   - `text:inference-progress` - 推論進捗（ストリーミング）

### Frontend (TypeScript)

1. **型定義** (`src/types/text-processing.ts`)
   - TextModel, TextConfig, ProofreadResult, SummaryResult

2. **Primitives** (`src/primitives/createTextProcessing.ts`)
   - モデル管理状態
   - 校正・要約の実行と結果管理

3. **UIコンポーネント**
   - TextModelManager - モデルのダウンロード・削除
   - ProofreadPanel - 校正結果表示・差分ビュー
   - SummaryPanel - 要約結果表示

---

## 依存関係

### Rust crates

| Crate | 用途 |
|-------|------|
| reqwest | HTTP通信（llama-serverとのAPI通信） |
| serde_json | JSON シリアライズ/デシリアライズ |

### 外部バイナリ

| バイナリ | 用途 | ダウンロード元 |
|---------|------|---------------|
| llama-server | LLM推論サーバー | GitHub Releases |

### 既存機能との連携

- Whisperモデル管理と同様のUI/UXパターンを踏襲
- 設定永続化（tauri-plugin-store）を使用
- 履歴機能: 履歴データに対して校正・要約を実行

---

## 作成ファイル

| ファイル | 説明 |
|----------|------|
| `src-tauri/src/text_processing/` | テキスト処理モジュール（Rust） |
| `src/types/text-processing.ts` | 型定義 |
| `src/primitives/createTextProcessing.ts` | SolidJS Primitive |
| `src/components/text-processing/` | UIコンポーネント |

---

## 完了条件

- [ ] llama-serverをダウンロードできる
- [ ] llama-serverを起動・停止できる
- [ ] モデルをダウンロードできる
- [ ] ダウンロード済みモデルを一覧表示できる
- [ ] モデルを削除できる
- [ ] カスタムダウンロードURLを設定できる
- [ ] 文法修正が動作する
- [ ] 表記統一が動作する
- [ ] 要約機能が動作する
- [ ] `pnpm test` で全テストが通る
- [ ] `cargo test` で全テストが通る

---

## 実装上の注意

- llama-serverはアプリ起動時ではなく、初回使用時に起動（リソース節約）
- アプリ終了時にllama-serverプロセスを確実に終了させる
- GPU対応はオプション（初期実装はCPUのみでも可）
- メモリ使用量に注意（軽量モデルを推奨）
- ポート競合時のエラーハンドリング
