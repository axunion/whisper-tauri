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

## モデル選定

### 候補（GGUF形式、日本語対応）

| モデル | サイズ | 特徴 |
|--------|--------|------|
| Qwen2 0.5B | ~400MB | 最軽量、日本語対応 |
| TinyLlama 1.1B | ~600MB | Llama互換、軽量 |
| Qwen2 1.5B | ~1GB | バランス型 |
| Phi-3 Mini 3.8B | ~2GB | 高性能 |

**注**: 最終的なモデル選定は実装時に検証して決定。

### ダウンロード設定

- デフォルトURL: HuggingFace
- カスタムURL対応（社内ホスティング用）
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

---

## 実装内容

### Backend (Rust)

1. **テキスト処理モジュール** (`src-tauri/src/text-processing/`)
   - llama.cppバインディングの統合
   - モデル管理（ダウンロード、削除、一覧）
   - 推論実行

2. **Tauriコマンド**
   - `text:list_models` - 利用可能なモデル一覧
   - `text:download_model` - モデルダウンロード
   - `text:delete_model` - モデル削除
   - `text:proofread` - 校正実行
   - `text:summarize` - 要約実行

3. **IPCイベント**
   - `text:download-progress` - ダウンロード進捗
   - `text:inference-progress` - 推論進捗

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
| llama-cpp-rs または llama-cpp-2 | llama.cppバインディング |

### 既存機能との連携

- Whisperモデル管理と同様のUI/UXパターンを踏襲
- 設定永続化（tauri-plugin-store）を使用
- 履歴機能: 履歴データに対して校正・要約を実行

---

## 作成ファイル

| ファイル | 説明 |
|----------|------|
| `src-tauri/src/text-processing/` | テキスト処理モジュール（Rust） |
| `src/types/text-processing.ts` | 型定義 |
| `src/primitives/createTextProcessing.ts` | SolidJS Primitive |
| `src/components/text-processing/` | UIコンポーネント |

---

## 完了条件

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

- llama.cppのビルドにはCMakeが必要（ビルド手順をドキュメント化）
- GPU対応はオプション（初期実装はCPUのみでも可）
- メモリ使用量に注意（軽量モデルを推奨）
