# Step 3: モデル管理（Rust）

**Phase 1: MVP** | 必須

Whisperモデルの一覧取得とダウンロード機能を実装する。

---

## 目的

- 利用可能なモデル一覧を提供
- Baseモデルをアプリにバンドル（デフォルトモデル）
- HuggingFaceからオプションモデルをダウンロード
- ダウンロード進捗をフロントエンドに通知

---

## テスト要件

### Rust (cargo test)

`src-tauri/src/whisper/models.rs`:

| テスト | 内容 |
|-------|------|
| get_model_url | デフォルトベースURLで正しいURLを生成する |
| get_model_url | カスタムベースURLで正しいURLを生成する |
| get_model_filename | `ggml-{id}.bin` 形式のファイル名を生成する |
| get_model_list | 空でないリストを返す |
| get_model_list | 全モデル（base, small, medium, large）が含まれる |
| get_model_list | tinyモデルが含まれない |
| get_model_list | baseモデルが bundled: true である |
| get_default_base_url | HuggingFaceのURLを返す |

`src-tauri/src/whisper/commands.rs`:

| テスト | 内容 |
|-------|------|
| get_models_dir | アプリデータディレクトリ配下のmodelsを返す |
| get_bundled_model_path | バンドルされたモデルのパスを返す |

---

## 実装内容

### 1. モデル定義モジュール

`src-tauri/src/whisper/models.rs` を作成し、以下を実装：

#### モデル一覧

| ID | 名前 | サイズ | バンドル | 説明 |
|----|------|--------|----------|------|
| base | Base | 142MB | **Yes** | バランス型。デフォルトモデル |
| small | Small | 466MB | No | 中程度の品質と速度 |
| medium | Medium | 1.5GB | No | 高品質。処理時間は長め |
| large | Large | 2.9GB | No | 最高品質。要高性能マシン |

**注意**: tinyモデルは除外（品質が低いため）

#### 関数

| 関数 | 説明 |
|------|------|
| `get_model_list()` | ModelInfo の Vec を返す |
| `get_model_url(model_id, base_url)` | ダウンロードURLを生成（base_url + ファイル名） |
| `get_model_filename(model_id)` | ファイル名 `ggml-{id}.bin` を生成 |
| `is_bundled(model_id)` | バンドルモデルかどうかを返す |
| `get_default_base_url()` | デフォルトのベースURL（HuggingFace）を返す |

### 2. Tauriコマンド

`src-tauri/src/whisper/commands.rs` に以下のコマンドを実装：

#### get_available_models
- 戻り値: `Result<Vec<ModelInfo>, String>`
- 処理: モデル一覧を取得し、各モデルのダウンロード状態を確認
- バンドルモデル（base）は常に `downloaded: true`, `bundled: true`
- ダウンロード済みモデルは `downloaded: true`, `bundled: false`

#### download_model
- 引数: `model_id: String`, `base_url: Option<String>`
- 戻り値: `Result<String, String>` (保存パス)
- 処理:
  1. バンドルモデルの場合はエラーを返す（ダウンロード不要）
  2. base_url が None の場合はデフォルト（HuggingFace）を使用
  3. アプリデータディレクトリに `models` フォルダを作成
  4. reqwest でストリーミングダウンロード
  5. 進捗を `model:download-progress` イベントで通知
  6. ファイルに書き込み

#### delete_model
- 引数: `model_id: String`
- 戻り値: `Result<(), String>`
- 処理: モデルファイルを削除（バンドルモデルは削除不可）

### 3. モデル保存場所

**バンドルモデル（base）:**
- `src-tauri/resources/ggml-base.bin` にモデルファイルを配置
- Tauri設定: `tauri.conf.json` の `bundle.resources` に追加
- 実行時パス: `app.path().resource_dir()` から取得

**ダウンロードモデル（small, medium, large）:**
- `app.path().app_data_dir()` 配下の `models` ディレクトリ
- macOS: `~/Library/Application Support/com.whisper-tauri.app/models/`

### 4. Tauri設定

`src-tauri/tauri.conf.json` に追加：

```json
{
  "bundle": {
    "resources": [
      "resources/ggml-base.bin"
    ]
  }
}
```

### 5. lib.rs へのコマンド登録

`invoke_handler` に上記3つのコマンドを登録。

---

## 作成ファイル

| ファイル | 説明 |
|---------|------|
| `src-tauri/src/whisper/models.rs` | モデル定義（**テスト含む、先に作成**） |
| `src-tauri/src/whisper/commands.rs` | Tauriコマンド |
| `src-tauri/src/whisper/mod.rs` | モジュール更新 |
| `src-tauri/src/lib.rs` | コマンド登録 |
| `src-tauri/resources/ggml-base.bin` | バンドルモデル（142MB） |
| `src-tauri/tauri.conf.json` | bundle.resources 追加 |

---

## 技術的注意点

- **バンドルモデル**: ggml-base.bin（142MB）をGitで管理せず、ビルド前に配置する
- **ダウンロードURL**: カスタムURL対応（社内ホスティング等）
- ダウンロード中のネットワークエラーハンドリング
- 大きなファイル（最大2.9GB）のストリーミング処理
- ダウンロード進捗の適切な頻度での通知（UIがフリーズしない程度）

### ダウンロードURL設定

デフォルトはHuggingFace:
```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/
```

カスタムURLを使用する場合、ベースURLを指定。ファイル名は自動的に追加される:
```
{base_url}/ggml-{model_id}.bin
```

例: `https://internal.example.com/models/` → `https://internal.example.com/models/ggml-small.bin`

### バンドルモデルの準備

ビルド前に以下のコマンドでBaseモデルをダウンロード：

```bash
mkdir -p src-tauri/resources
curl -L -o src-tauri/resources/ggml-base.bin \
  https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin
```

**注意**: `src-tauri/resources/ggml-base.bin` は `.gitignore` に追加し、Git管理対象外とする。

---

## 完了条件

- [ ] `cargo test` で全テストが通る
- [ ] DevToolsで `get_available_models` が動作する
- [ ] モデルダウンロードが動作する
- [ ] 進捗イベントが発火する

---

## 次のステップ

[Step 4: whisper-rs統合](./step-04.md)
