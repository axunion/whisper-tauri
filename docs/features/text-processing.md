# テキスト処理（校正・要約）

**カテゴリ**: 高度な機能 | **優先度**: 任意

ローカルで動作する言語モデルを使用して、文字起こし結果の校正・要約を行う機能。

---

## 目的

- 校正: 文法修正（誤字脱字、助詞の誤り）+ 表記統一（漢字/ひらがな、数字表記）
- 要約: 長文の要約生成
- オフライン環境での動作（プライバシー重視）

---

## アーキテクチャ

### サブプロセスアプローチ

llama.cppのRustバインディングを直接統合するとクラッシュリスクがあるため、**llama-server**をサブプロセスとして起動し、OpenAI互換HTTP APIで通信する。

```
┌─────────────────────┐                    ┌──────────────────────┐
│   Tauri アプリ      │       HTTP         │  llama-server        │
│   (メインプロセス)   │ ──────────────►    │  (サブプロセス)       │
│                     │                    │                      │
│  - サーバー起動     │ POST /v1/chat/     │  - モデルロード済み   │
│  - HTTP通信        │   completions      │  - Metal/CPU 推論    │
│  - 結果をUIに表示   │ ◄──────────────    │  - SSE ストリーミング │
│                     │   SSE stream       │                      │
└─────────────────────┘                    └──────────────────────┘
```

### llama-server

- llama.cpp プロジェクト公式の HTTP サーバー（ggml-org/llama.cpp）
- OpenAI 互換 API（`/v1/chat/completions`）を提供
- ストリーミング対応（Server-Sent Events）
- Metal（Apple Silicon GPU）/ CPU 自動検出
- プラットフォーム別ビルド済みバイナリ: macOS ARM64/x64, Windows x64/ARM64, Linux x64

### メリット

- クラッシュ隔離（サーバーがクラッシュしてもアプリは継続）
- メモリ管理（プロセス終了でOSが完全回収）
- 実装の簡素化（OpenAI互換APIのみ、バインディング不要）
- GPU自動活用（llama-server が Metal/CUDA を自動検出）
- 公式メンテナンス（毎日リリース、活発な開発）

---

## モデル選定

### 方針

文字起こし結果の校正・要約が主な用途。日本語テキストの品質を確保するには**最低4Bパラメータ**が必要。1Bクラスは日本語の校正・要約で実用的な品質に達しないため提供しない。

### 使用モデル（GGUF Q4_K_M）

| カテゴリ | モデル | サイズ | 特徴 |
|----------|--------|--------|------|
| **推奨** | Qwen3.5-4B-Q4_K_M.gguf | ~2.7GB | 2026年3月リリース。201言語対応、日本語ベンチマーク（JMMLU, Shaberi）で高評価。Unsloth Dynamic 2.0量子化 |
| 代替 | gemma-3-4b-it-Q4_K_M.gguf | ~2.7GB | 実績豊富。CJKトークナイザ最適化。安定性重視の場合 |

**注**:
- デフォルトは Qwen3.5-4B。Gemma 3 4B は代替として設定画面から選択可能
- 両モデルとも3GB以下に収まり、デスクトップ環境で実用的
- llama-server は両モデルのアーキテクチャを完全サポート

### ダウンロード設定

- **モデル**: HuggingFace（カスタムURL対応）
  - Qwen3.5: `https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/`
  - Gemma 3: `https://huggingface.co/bartowski/google_gemma-3-4b-it-GGUF/resolve/main/`
- **llama-server**: GitHub Releases（カスタムURL対応）
  - `https://github.com/ggml-org/llama.cpp/releases/`
- **バージョン固定**: llama-server はリリースが頻繁なため、動作確認済みのバージョンをアプリに紐付ける（定数で管理）
- Whisperモデルと同様の設定方式

---

## 機能

### 1. 校正

文法修正と表記統一を1つの機能として提供する。

- 誤字脱字の修正
- 助詞・接続詞の誤り修正
- 不自然な表現の修正
- 漢字/ひらがな、数字表記（全角/半角）等の表記統一

### 2. 要約

- 文字起こし結果の要約生成
- 要約の長さ指定（短/中/長）
- 箇条書き形式オプション

---

## プロンプト設計

### モデル非依存の設計

llama-server の `/v1/chat/completions` エンドポイントを使用するため、モデル固有のテンプレート（ChatML, Gemma形式等）は**サーバー側で自動適用**される。バックエンドからはOpenAI互換の messages 配列を送るだけでよい。

```json
{
  "messages": [
    {"role": "system", "content": "...システム指示..."},
    {"role": "user", "content": "...校正/要約対象テキスト..."}
  ],
  "temperature": 0.3,
  "max_tokens": 4096,
  "stream": true
}
```

### 設計方針

| 項目 | 方針 |
|------|------|
| API形式 | OpenAI互換 `/v1/chat/completions`（messages配列） |
| 出力制限 | systemメッセージで「結果のみ出力、説明不要」と指示 |
| temperature | 低め（0.2〜0.4）で安定出力 |
| ストリーミング | SSE で逐次出力、UIにリアルタイム反映 |
| コンテキスト長 | 入力テキストが長い場合は分割して処理（後述） |

### 長文の分割処理

モデルのコンテキスト長（デフォルト4096トークン）を超える入力に対応:

1. テキストを文単位で分割（句点区切り）
2. コンテキスト長の70%以内に収まるチャンクに分ける（プロンプト分を確保）
3. 各チャンクを順次処理し、結果を結合
4. 要約の場合: 各チャンクの要約を生成 → 最終要約を生成（階層的要約）

---

## サーバーライフサイクル

### 起動タイミング

- アプリ起動時ではなく、**初回の校正/要約リクエスト時**に起動（リソース節約）
- 起動後は一定時間アイドル状態が続いたら自動停止（デフォルト5分）

### 起動フロー

1. ランダムポートを選択（ポート競合回避）
2. llama-server をサブプロセスとして起動（`--port`, `--model`, `--ctx-size` 指定）
3. `/health` エンドポイントでヘルスチェック（最大30秒、1秒間隔でポーリング）
4. ヘルスチェック成功で「準備完了」

### 停止

- アプリ終了時に `Child::kill()` で確実に停止
- アイドルタイムアウト時にグレースフルシャットダウン
- プロセスIDを保持し、孤児プロセスを防止

### キャンセル

- 推論中のリクエストは HTTP 接続を切断することでキャンセル
- UIに「キャンセル」ボタンを表示（Whisper の文字起こしキャンセルと同様のUX）

---

## テスト要件

### TypeScript (Vitest)

| テスト | 内容 |
|--------|------|
| プロンプト生成 | 校正用 messages 配列が正しく生成される |
| プロンプト生成 | 要約用 messages 配列が正しく生成される |
| 長文分割 | テキストが正しくチャンクに分割される |
| 結果パース | SSE ストリームから結果を正しく抽出 |

### Rust (cargo test)

| テスト | 内容 |
|--------|------|
| モデル一覧 | 利用可能なモデル一覧を返す |
| モデルパス | モデルファイルパスを正しく解決 |
| ダウンロードURL | カスタムURL設定が反映される |
| サーバーパス | llama-serverバイナリパスを正しく解決 |
| ポート選択 | ランダムポートが割り当てられる |
| サーバー起動 | ヘルスチェックが正しく動作する |

---

## 実装内容

### Backend (Rust)

1. **テキスト処理モジュール** (`src-tauri/src/text_processing/`)
   - `mod.rs` - モジュールエクスポート
   - `commands.rs` - Tauriコマンド
   - `types.rs` - 型定義（serde, camelCase変換）
   - `error.rs` - エラー型（thiserror）
   - `server.rs` - llama-server ライフサイクル管理
   - `inference.rs` - HTTP通信・SSEパース・推論リクエスト
   - `models.rs` - モデル定義・パス解決

2. **Tauriコマンド**
   - `text_processing_list_models` - 利用可能なモデル一覧
   - `text_processing_download_model` - モデルダウンロード
   - `text_processing_delete_model` - モデル削除
   - `text_processing_download_server` - llama-serverダウンロード
   - `text_processing_proofread` - 校正実行
   - `text_processing_summarize` - 要約実行
   - `text_processing_cancel` - 推論キャンセル
   - `text_processing_server_status` - サーバー状態確認
   - `get_text_processing_download_url` / `set_text_processing_download_url` - カスタムURL

3. **IPCイベント**
   - `text-processing:download-progress` - ダウンロード進捗
   - `text-processing:inference-progress` - 推論進捗（ストリーミングテキスト）

### Frontend (TypeScript)

1. **型定義** (`src/types/text-processing.ts`)
   - TextModel, TextProcessingConfig, ProofreadResult, SummaryResult
   - TextDownloadProgress, InferenceProgress

2. **Primitives** (`src/primitives/createTextProcessing.ts`)
   - モデル管理状態（一覧、ダウンロード進捗）
   - サーバー状態管理
   - 校正・要約の実行と結果管理（ストリーミング対応）
   - キャンセル機能

3. **UIコンポーネント** (`src/components/text-processing/`)
   - TextModelManager - モデルのダウンロード・削除（設定画面内）
   - ProofreadPanel - 校正結果表示・差分ビュー
   - SummaryPanel - 要約結果表示

---

## 依存関係

### Rust crates

| Crate | 用途 | 備考 |
|-------|------|------|
| reqwest | HTTP通信（llama-serverとのAPI通信） | 既存依存 |
| serde_json | JSON シリアライズ/デシリアライズ | 既存依存 |
| tokio | サブプロセス管理・非同期IO | 既存依存 |

新規 crate の追加は不要。既存の依存関係で実装可能。

### 外部バイナリ

| バイナリ | 用途 | ダウンロード元 | サイズ |
|---------|------|---------------|--------|
| llama-server | LLM推論サーバー | GitHub Releases (ggml-org/llama.cpp) | ~5-20MB |

### 既存機能との連携

- Whisperモデル管理と同様のUI/UXパターンを踏襲
- 設定永続化（tauri-plugin-store）を使用
- 履歴機能: 履歴データに対して校正・要約を実行
- エラーハンドリング: 既存の AppError / parseError パターンに従う

---

## 作成ファイル

| ファイル | 説明 |
|----------|------|
| `src-tauri/src/text_processing/mod.rs` | モジュールエクスポート |
| `src-tauri/src/text_processing/commands.rs` | Tauriコマンド |
| `src-tauri/src/text_processing/types.rs` | Rust型定義 |
| `src-tauri/src/text_processing/error.rs` | エラー型 |
| `src-tauri/src/text_processing/server.rs` | llama-server管理 |
| `src-tauri/src/text_processing/inference.rs` | 推論リクエスト・SSEパース |
| `src-tauri/src/text_processing/models.rs` | モデル定義・パス解決 |
| `src/types/text-processing.ts` | TypeScript型定義 |
| `src/primitives/createTextProcessing.ts` | SolidJS Primitive |
| `src/components/text-processing/` | UIコンポーネント |

---

## 完了条件

- [x] llama-serverをダウンロードできる
- [x] llama-serverを起動・停止できる（ランダムポート + ヘルスチェック）
- [x] アイドルタイムアウトで自動停止する
- [x] アプリ終了時にサーバープロセスが確実に終了する
- [x] モデルをダウンロードできる（進捗表示付き）
- [x] ダウンロード済みモデルを一覧表示できる
- [x] モデルを削除できる
- [x] カスタムダウンロードURLを設定できる
- [x] 校正が動作する（文法修正 + 表記統一）
- [x] 要約が動作する（長さ指定 + 箇条書きオプション）
- [x] 長文入力時の分割処理が動作する
- [x] ストリーミング出力がUIにリアルタイム反映される
- [x] 推論をキャンセルできる
- [x] `pnpm test` で全テストが通る
- [x] `cargo test` で全テストが通る

---

## 実装上の注意

- llama-serverはアプリ起動時ではなく、初回使用時に起動（リソース節約）
- アプリ終了時にllama-serverプロセスを確実に終了させる（`Child::kill()`）
- **ランダムポート**を使用し、ポート競合を回避する
- GPU対応: llama-server が Metal/CUDA を自動検出するため、特別な実装は不要
- メモリ使用量に注意（4Bモデルで約3-4GB RAM使用）
- **タイムアウト**: 推論リクエストに最大120秒のタイムアウトを設定
- **llama-server バージョン**: 動作確認済みバージョンを定数で固定（`LLAMA_SERVER_VERSION`）
- 孤児プロセス防止: PIDを保持し、起動前に既存プロセスの有無を確認
