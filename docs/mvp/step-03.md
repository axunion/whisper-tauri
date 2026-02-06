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
| get_model_list | 全モデル（large-v3-turbo, medium, small）が含まれる |
| get_model_list | tiny, baseモデルが含まれない |
| get_default_base_url | HuggingFaceのURLを返す |
| get_recommended_model_id | RAM 16GB+で large-v3-turbo を返す |
| get_recommended_model_id | RAM 8GB未満で small を返す |
| get_recommended_model_id | RAM 8GB+/4コア未満で medium を返す |

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
| large-v3-turbo | Large v3 Turbo | 1.6GB | **Yes** | 推奨。高品質かつ高速。日本語精度に優れる |
| medium | Medium | 1.5GB | No | Turbo の動作が重い場合の代替。品質と速度のバランス |
| small | Small | 466MB | No | 低スペックマシン向け。品質は控えめ |

**注意**:
- tiny, base は日本語精度が低いため除外
- large-v3-turbo は large-v3 の蒸留モデル（同等品質で大幅に高速）
- small, medium は Large v3 Turbo の動作が重い環境向けの選択肢
- 全モデルがダウンロード方式（バンドルなし）

#### システム推奨ロジック

`sysinfo` crate でシステム情報を取得し、`ModelInfo` に `recommended: true` をセットする。

| 条件 | 推奨モデル | 理由 |
|------|-----------|------|
| RAM 16GB+ or Apple Silicon | large-v3-turbo | Metal 加速 / 十分なメモリ |
| RAM 8GB+ かつ 4コア以上 | large-v3-turbo | 実用的な速度で動作 |
| RAM 8GB+ かつ 4コア未満 | medium | CPU リソース不足の可能性 |
| RAM 8GB 未満 | small | メモリ制約 |

**判定に使う情報**:
- `sysinfo::System::total_memory()` — 搭載 RAM
- `sysinfo::System::cpus().len()` — CPU コア数
- `std::env::consts::ARCH` — `aarch64` なら Apple Silicon と判定

**注意**: 推奨はあくまで目安。ユーザーは自由に他のモデルを選択できる。

#### 関数

| 関数 | 説明 |
|------|------|
| `get_model_list()` | ModelInfo の Vec を返す（`recommended` はデフォルト判定） |
| `get_model_list_with_recommendation()` | システム情報を元に `recommended` をセットした一覧を返す |
| `get_recommended_model_id()` | システム情報から推奨モデルIDを返す |
| `get_model_url(model_id, base_url)` | ダウンロードURLを生成（base_url + ファイル名） |
| `get_model_filename(model_id)` | ファイル名 `ggml-{id}.bin` を生成 |
| `get_default_base_url()` | デフォルトのベースURL（HuggingFace）を返す |

### 2. Tauriコマンド

`src-tauri/src/whisper/commands.rs` に以下のコマンドを実装：

#### get_available_models
- 戻り値: `Result<Vec<ModelInfo>, String>`
- 処理: モデル一覧を取得し、各モデルのダウンロード状態と推奨を確認
- ダウンロード済みモデルは `downloaded: true`
- システム情報に基づき推奨モデルに `recommended: true` をセット

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
- 大きなファイル（最大1.6GB）のストリーミング処理
- ダウンロード進捗の適切な頻度での通知（UIがフリーズしない程度）
- 初回使用時にモデルが無い場合、ダウンロード確認ダイアログを表示
- `sysinfo` crate を使用（RAM・CPU 取得）。Cargo.toml に追加が必要

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
