# Step 3: モデル管理（Rust）

**Phase 1: MVP** | 必須

Whisperモデルの一覧取得とダウンロード機能を実装する。

---

## 目的

- 利用可能なモデル一覧を提供
- 全モデルをダウンロード方式（アプリにはバンドルしない）
- 初回使用時または設定画面からダウンロード
- ダウンロードURLはデフォルト（HuggingFace）+ カスタム設定可能
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
| get_model_list | baseモデルが default: true である |
| get_default_base_url | HuggingFaceのURLを返す |

`src-tauri/src/whisper/commands.rs`:

| テスト | 内容 |
|-------|------|
| get_models_dir | アプリデータディレクトリ配下のmodelsを返す |
| get_model_path | 指定モデルのパスを返す |
| check_model_exists | ダウンロード済みか確認できる |

---

## 実装内容

### 1. モデル定義モジュール

`src-tauri/src/whisper/models.rs` を作成し、以下を実装：

#### モデル一覧

| ID | 名前 | サイズ | デフォルト | 説明 |
|----|------|--------|-----------|------|
| base | Base | 142MB | **Yes** | バランス型。初回推奨モデル |
| small | Small | 466MB | No | 中程度の品質と速度 |
| medium | Medium | 1.5GB | No | 高品質。処理時間は長め |
| large | Large | 2.9GB | No | 最高品質。要高性能マシン |

**注意**:
- tinyモデルは除外（品質が低いため）
- 全モデルがダウンロード方式（バンドルなし）

#### 関数

| 関数 | 説明 |
|------|------|
| `get_model_list()` | ModelInfo の Vec を返す |
| `get_model_url(model_id, base_url)` | ダウンロードURLを生成（base_url + ファイル名） |
| `get_model_filename(model_id)` | ファイル名 `ggml-{id}.bin` を生成 |
| `is_default_model(model_id)` | デフォルト推奨モデルかどうかを返す |
| `get_default_base_url()` | デフォルトのベースURL（HuggingFace）を返す |

### 2. Tauriコマンド

`src-tauri/src/whisper/commands.rs` に以下のコマンドを実装：

#### get_available_models
- 戻り値: `Result<Vec<ModelInfo>, String>`
- 処理: モデル一覧を取得し、各モデルのダウンロード状態を確認
- ダウンロード済みモデルは `downloaded: true`

#### check_model_exists
- 引数: `model_id: String`
- 戻り値: `Result<bool, String>`
- 処理: 指定モデルがダウンロード済みか確認

#### download_model
- 引数: `model_id: String`, `base_url: Option<String>`
- 戻り値: `Result<String, String>` (保存パス)
- 処理:
  1. base_url が None の場合はデフォルト（HuggingFace）を使用
  2. アプリデータディレクトリに `models` フォルダを作成
  3. reqwest でストリーミングダウンロード
  4. 進捗を `model:download-progress` イベントで通知
  5. ファイルに書き込み

#### delete_model
- 引数: `model_id: String`
- 戻り値: `Result<(), String>`
- 処理: モデルファイルを削除

#### get_model_download_url / set_model_download_url
- カスタムダウンロードURLの取得・設定

### 3. モデル保存場所

全モデルが `app.path().app_data_dir()` 配下の `models` ディレクトリに保存：
- macOS: `~/Library/Application Support/com.whisper-tauri/models/`
- Windows: `%APPDATA%/com.whisper-tauri/models/`

### 4. lib.rs へのコマンド登録

`invoke_handler` に上記コマンドを登録。

---

## 作成ファイル

| ファイル | 説明 |
|---------|------|
| `src-tauri/src/whisper/models.rs` | モデル定義（**テスト含む、先に作成**） |
| `src-tauri/src/whisper/commands.rs` | Tauriコマンド |
| `src-tauri/src/whisper/mod.rs` | モジュール更新 |
| `src-tauri/src/lib.rs` | コマンド登録 |

---

## 技術的注意点

- ダウンロード中のネットワークエラーハンドリング
- 大きなファイル（最大2.9GB）のストリーミング処理
- ダウンロード進捗の適切な頻度での通知（UIがフリーズしない程度）
- 初回使用時にモデルが無い場合、ダウンロード確認ダイアログを表示

### ダウンロードURL設定

| 項目 | 値 |
|------|-----|
| デフォルトURL | `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/` |
| カスタムURL | 設定で自由に指定可能 |

**URL構成**:
```
{base_url}/ggml-{model_id}.bin
```

例: `https://internal.example.com/models/` → `https://internal.example.com/models/ggml-small.bin`

---

## 完了条件

- [ ] `cargo test` で全テストが通る
- [ ] DevToolsで `get_available_models` が動作する
- [ ] モデルダウンロードが動作する
- [ ] 進捗イベントが発火する
- [ ] カスタムダウンロードURLが設定できる
- [ ] モデルの存在確認ができる

---

## 次のステップ

[Step 4: whisper-rs統合](./step-04.md)
