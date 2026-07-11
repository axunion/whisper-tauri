# AI テキスト処理 (text_processing)

Source: `src-tauri/src/text_processing/` (`models.rs` / `server.rs` / `inference.rs` / `commands.rs` / `extract.rs`)

ローカル LLM (llama-server 子プロセス) による要約・本文整形・タイトル生成。ネットワークは loopback (`127.0.0.1`) のみ。

## モデル

| ID | ファイル (GGUF Q4_K_M) | 既定の取得元 |
|---|---|---|
| `gemma-4-e2b` | `google_gemma-4-E2B-it-Q4_K_M.gguf` | `huggingface.co/bartowski/google_gemma-4-E2B-it-GGUF` |
| `qwen3.5-4b` | `Qwen3.5-4B-Q4_K_M.gguf` | `huggingface.co/unsloth/Qwen3.5-4B-GGUF` |

- 保存先: `{app_data}/text-models/`。取得元は設定キー `textModelDownloadBaseUrl` で差し替え可
- 廃止モデルのクリーンアップ機構 (`LEGACY_MODEL_IDS` 等) は削除済み (2026-07 確認)。モデル廃止時の運用は [binary-updates.md](binary-updates.md) の「モデルの廃止」を参照 (残存ファイルの掃除は `scripts/dev-reset.sh` 側で対応)

### サンプリングパラメータ (`models.rs::sampling_params`)

モデル公式推奨値をリクエストごとに送信する (タスク別の独自チューニングはしない。根拠: tuning.md の「公式推奨 = 標準」)。

| モデル | temperature | top_p | top_k | min_p | 出典 |
|---|---|---|---|---|---|
| `gemma-4-e2b` | 1.0 | 0.95 | 64 | 未指定 (サーバー既定) | Gemma 4 model card (全用途共通) |
| `qwen3.5-4b` | 0.7 | 0.8 | 20 | 0.0 | Qwen3.5-4B model card (non-thinking 一般) |

公式が推奨を出していない項目 (repeat_penalty 等) はリクエストに含めず llama-server 既定に委ねる。`max_tokens` のみタスク/入力長に応じてアプリ側で決める。

## llama-server ライフサイクル (`server.rs::LlamaServerManager`)

- バイナリ: `{app_data}/bin/llama-server[.exe]`、`LLAMA_SERVER_VERSION` (= `b9950`, 2026-07-11 更新) を `llama-server.version` マーカーで管理。取得元は `github.com/ggml-org/llama.cpp` Releases (設定キー `textServerDownloadUrl` で差し替え可)
- 起動: 空きポートで `--ctx-size 8192 --jinja --chat-template-kwargs {"enable_thinking":false}` を付けて spawn。`--jinja` + kwargs は Qwen3.5 の thinking モード無効化 (対応しないモデルでは無視される)。ctx は 4096 → 8192 に拡大済み (2026-07-11: 漢字密度の高い 4,000 字チャンクで `exceed_context_size_error` になる余地があったため)
- ヘルスチェック: `GET /health` が `{"status":"ok"}` を返すまで 1 秒間隔でポーリング (最大 120 秒)
- 停止契機は次の 3 つのみ: **アプリ終了** (`lib.rs` の `RunEvent::Exit` → `shutdown()`)、**モデル切替**、**生存しているが無応答のときの再起動** (`begin_task` 内の quick health check 失敗時)。アイドル自動停止は無い (未配線だった `idle_timeout` 機構は削除済み、2026-07 確認)
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
- `chunk_text` は全チャンク ≤ 4,000 字を保証する: `。` で収まらない場合は `、`/改行 → 固定長の順にフォールバック分割 (2026-07-11 修正。句点なしの長い文字起こしが 1 リクエストで送られ ctx 超過 400 になるバグがあった)

## コマンド一覧

`text_processing_list_models` / `_download_model` / `_delete_model` / `_download_server` / `_delete_server` / `_check_server` / `_server_status` / `_summarize` / `_generate_title` / `_clean_text` / `_cancel` / `get/set_text_processing_model_url` / `get/set_text_processing_server_url`

`text_processing_chat` は開発用 (`/dev` の LLM Tester 専用)。ユーザー向け機能ではない。

共通前処理 `begin_task`: task id 発行 → 初期進捗 emit → サーバー起動保証 (無応答なら再起動) → キャンセル対応。
