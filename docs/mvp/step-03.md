# Step 3: モデル管理（Rust）

**Phase 1: MVP** | 必須

Whisperモデルの一覧取得とダウンロード機能を実装する。

---

## 目的

- 利用可能なモデル一覧を提供
- HuggingFaceからモデルをダウンロード
- ダウンロード進捗をフロントエンドに通知

---

## テスト要件

### Rust (cargo test)

`src-tauri/src/whisper/models.rs`:

| テスト | 内容 |
|-------|------|
| get_model_url | 正しいHuggingFace URLを生成する |
| get_model_filename | `ggml-{id}.bin` 形式のファイル名を生成する |
| get_model_list | 空でないリストを返す |
| get_model_list | 全モデル（tiny, base, small, medium, large）が含まれる |

`src-tauri/src/whisper/commands.rs`:

| テスト | 内容 |
|-------|------|
| get_models_dir | アプリデータディレクトリ配下のmodelsを返す |

---

## 実装内容

### 1. モデル定義モジュール

`src-tauri/src/whisper/models.rs` を作成し、以下を実装：

#### モデル一覧

| ID | 名前 | サイズ | 説明 |
|----|------|--------|------|
| tiny | Tiny | 75MB | 最も軽量。低品質だが高速 |
| base | Base | 142MB | バランス型。一般的な用途に適切 |
| small | Small | 466MB | 中程度の品質と速度 |
| medium | Medium | 1.5GB | 高品質。処理時間は長め |
| large | Large | 2.9GB | 最高品質。要高性能マシン |

#### 関数

| 関数 | 説明 |
|------|------|
| `get_model_list()` | ModelInfo の Vec を返す |
| `get_model_url(model_id)` | HuggingFace のダウンロードURLを生成 |
| `get_model_filename(model_id)` | ファイル名 `ggml-{id}.bin` を生成 |

### 2. Tauriコマンド

`src-tauri/src/whisper/commands.rs` に以下のコマンドを実装：

#### get_available_models
- 戻り値: `Result<Vec<ModelInfo>, String>`
- 処理: モデル一覧を取得し、各モデルのダウンロード状態を確認
- モデルファイルが存在する場合は `downloaded: true` と `path` を設定

#### download_model
- 引数: `model_id: String`
- 戻り値: `Result<String, String>` (保存パス)
- 処理:
  1. アプリデータディレクトリに `models` フォルダを作成
  2. reqwest でストリーミングダウンロード
  3. 進捗を `model:download-progress` イベントで通知
  4. ファイルに書き込み

#### delete_model
- 引数: `model_id: String`
- 戻り値: `Result<(), String>`
- 処理: モデルファイルを削除

### 3. モデル保存場所

- `app.path().app_data_dir()` 配下の `models` ディレクトリ
- macOS: `~/Library/Application Support/com.whisper-tauri/models/`

### 4. lib.rs へのコマンド登録

`invoke_handler` に上記3つのコマンドを登録。

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

---

## 完了条件

- [ ] `cargo test` で全テストが通る
- [ ] DevToolsで `get_available_models` が動作する
- [ ] モデルダウンロードが動作する
- [ ] 進捗イベントが発火する

---

## 次のステップ

[Step 4: whisper-rs統合](./step-04.md)
