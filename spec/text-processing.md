# AI テキスト処理 (text_processing)

Source: `src-tauri/src/text_processing/` (`models.rs` / `server.rs` / `inference.rs` / `commands.rs` / `extract.rs`)

ローカル LLM (llama-server 子プロセス) による要約・本文整形・タイトル生成。ネットワークは loopback (`127.0.0.1`) のみ。

## モデル

| ID | ファイル (GGUF Q4_K_M) | 既定の取得元 |
|---|---|---|
| `gemma-4-e2b` | `google_gemma-4-E2B-it-Q4_K_M.gguf` | `huggingface.co/bartowski/google_gemma-4-E2B-it-GGUF` |
| `qwen3.5-4b` | `Qwen3.5-4B-Q4_K_M.gguf` | `huggingface.co/unsloth/Qwen3.5-4B-GGUF` |

- 保存先: `{app_data}/text-models/`。取得元は設定キー `textModelDownloadBaseUrl` で差し替え可
- `LEGACY_MODEL_IDS` / `legacy_model_filename` は廃止モデルのクリーンアップ機構 (現在は空 = 動作しない)。運用手順は [binary-updates.md](binary-updates.md) の「モデルの廃止」

## llama-server ライフサイクル (`server.rs::LlamaServerManager`)

- バイナリ: `{app_data}/bin/llama-server[.exe]`、`LLAMA_SERVER_VERSION` (= `b8672`) を `llama-server.version` マーカーで管理。取得元は `github.com/ggml-org/llama.cpp` Releases (設定キー `textServerDownloadUrl` で差し替え可)
- 起動: 空きポートで `--ctx-size 4096 --jinja --chat-template-kwargs {"enable_thinking":false}` を付けて spawn。`--jinja` + kwargs は Qwen3.5 の thinking モード無効化 (対応しないモデルでは無視される)
- ヘルスチェック: `GET /health` が `{"status":"ok"}` を返すまで 1 秒間隔でポーリング (最大 120 秒)
- 停止契機は次の 3 つのみ: **アプリ終了** (`lib.rs` の `RunEvent::Exit` → `shutdown()`)、**モデル切替**、**生存しているが無応答のときの再起動** (`begin_task` 内の quick health check 失敗時)
  - `idle_timeout` (300 秒) / `should_idle_stop()` はフィールドと API のみ存在し、呼び出すスケジューラが未配線のため**アイドル自動停止は現在動作しない** (仕様として扱わない)
- `kill_on_drop(true)` で子プロセスのリークを防止

## 推論 (`inference.rs`)

- OpenAI 互換 `POST http://127.0.0.1:{port}/v1/chat/completions`
- ストリーミング (SSE パース → `text-processing:inference-progress` を emit) とブロッキングの 2 系統
- キャンセル: whisper と同じ `TaskManager` 機構 (`INFERENCE_TASK_MANAGER`)。`text_processing_cancel` で中断
- システムプロンプトは日本語 (summarize / title / clean_text)

### 構造化要約 (`text_processing_summarize`)

- `response_format` に JSON Schema を指定して構造化出力を強制。スキーマ: `headline` / `tldr` / `keyPoints` / `keywords` / `actionItems[{what, due}]` (トップレベル 5 フィールドは required。`actionItems` 要素内は `what` のみ required で `due` は任意)
- 入力長に応じて keyPoints 数の目安と `max_tokens` (2,048〜4,096) をバケット切替 (`summary_params_for_length`)
- 長文は 2-pass: `chunk_text` が `。` 境界で最大 4,000 字 (`MAX_CHUNK_CHARS`) に分割 → 各チャンクを condense → 結合して最終要約

## コマンド一覧

`text_processing_list_models` / `_download_model` / `_delete_model` / `_get_legacy_models` / `_download_server` / `_delete_server` / `_check_server` / `_server_status` / `_summarize` / `_generate_title` / `_clean_text` / `_cancel` / `get/set_text_processing_model_url` / `get/set_text_processing_server_url`

`text_processing_chat` は開発用 (`/dev` の LLM Tester 専用)。ユーザー向け機能ではない。

共通前処理 `begin_task`: task id 発行 → 初期進捗 emit → サーバー起動保証 (無応答なら再起動) → キャンセル対応。
