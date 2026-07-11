use std::sync::Arc;

use once_cell::sync::Lazy;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use super::error::TextProcessingError;
use super::models::SamplingParams;
use super::types::{ChatMessage, InferenceProgress};
use crate::whisper::process::{CancellationToken, TaskManager};
use futures_util::StreamExt;

/// Global inference task manager for cancellation.
pub(crate) static INFERENCE_TASK_MANAGER: Lazy<TaskManager> = Lazy::new(TaskManager::new);

/// Maximum characters (Unicode scalar values) per chunk for text splitting.
/// For Japanese text (~3 bytes per char in UTF-8), this corresponds to ~12KB.
const MAX_CHUNK_CHARS: usize = 4000;

/// Upper bound on `max_tokens` for any single request (summary buckets and
/// the clean-text cap).
pub(crate) const MAX_OUTPUT_TOKENS: u32 = 4096;

// A full chunk (worst case ~1 token/char for kanji-dense Japanese) plus the
// output budget must fit in the server context, or long requests fail with
// HTTP 400 exceed_context_size_error.
const _: () =
    assert!(MAX_CHUNK_CHARS + MAX_OUTPUT_TOKENS as usize <= super::server::SERVER_CTX_SIZE);

/// Builds chat messages for a simple chat response (dev testing).
#[must_use]
pub(crate) fn build_chat_messages(text: &str) -> Vec<ChatMessage> {
    vec![
        ChatMessage {
            role: "system".to_string(),
            content: "You are a helpful assistant. Respond concisely.".to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: text.to_string(),
        },
    ]
}

/// Per-input tuning knobs for structured summarization.
///
/// Returned by [`summary_params_for_length`] so the prompt's `keyPoints` size
/// hint and the request's `max_tokens` scale with the transcription length.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct SummaryParams {
    pub(crate) key_points_min: u32,
    pub(crate) key_points_max: u32,
    pub(crate) max_tokens: u32,
}

/// Derives [`SummaryParams`] from the original transcription length.
///
/// Long inputs naturally cover more sub-topics, so we widen the keyPoints
/// range and grow `max_tokens` to fit the bigger JSON response. The buckets
/// are coarse on purpose — finer tuning chases LLM noise rather than real
/// signal.
#[must_use]
pub(crate) fn summary_params_for_length(text_chars: usize) -> SummaryParams {
    if text_chars < 1_500 {
        SummaryParams {
            key_points_min: 2,
            key_points_max: 4,
            max_tokens: 2_048,
        }
    } else if text_chars < 5_000 {
        SummaryParams {
            key_points_min: 3,
            key_points_max: 6,
            max_tokens: 2_048,
        }
    } else if text_chars < 15_000 {
        SummaryParams {
            key_points_min: 5,
            key_points_max: 10,
            max_tokens: 3_072,
        }
    } else {
        SummaryParams {
            key_points_min: 7,
            key_points_max: 15,
            max_tokens: MAX_OUTPUT_TOKENS,
        }
    }
}

/// Builds chat messages for structured summarization.
///
/// The model is expected to return a JSON object matching [`summary_json_schema`].
/// The system prompt only describes the semantic shape of each field — the
/// formatting itself is enforced by `response_format` on the request body.
///
/// `key_points_min` / `key_points_max` are embedded into the prompt so the
/// number of bullet points scales with input length (see
/// [`summary_params_for_length`]).
#[must_use]
pub(crate) fn build_summarize_messages(
    text: &str,
    key_points_min: u32,
    key_points_max: u32,
) -> Vec<ChatMessage> {
    let system = format!(
        "あなたは文字起こしテキストを構造化要約にまとめる専門家です。指定された JSON スキーマに従って出力してください。各フィールドの役割と書き方:\n\
        \n\
        - headline: 内容を一言で表す短いタイトル (15〜30文字目安、文末記号なし)。\n\
        \n\
        - tldr: 全体を 1〜2 文 (合計 80〜150文字程度) でまとめた**総括の段落**。何の話だったかを最初の 1 文で要約し、必要なら 2 文目で補足する。読者がここだけ読めば概要が分かるリード文。箇条書きや改行は使わない。**keyPoints と内容を重複させない**: tldr は全体像、keyPoints は個別のサブトピック。\n\
        \n\
        - keyPoints: 議論や説明のサブトピックを箇条書きにした配列。各項目は名詞句または短い文 (30〜80文字程度)。**目安は {key_points_min}〜{key_points_max} 個**だが、入力に応じて自然に増減して構わない。**tldr の言い換えではなく、tldr では触れなかった具体的な論点・話題・事実を 1 件ずつ取り出す**。**内容が重複する場合は項目数を下回ってよい** — 同じ趣旨の項目を 2 つ以上書かない。\n\
        \n\
        - keywords: 重要な名詞句を 5〜8 個ほど含む配列。一般名詞より固有名詞や専門用語を優先する。\n\
        \n\
        - actionItems: **本当に明確に発話されたタスクや依頼のみ**を含む配列。次のルールを厳守する:\n\
          1. **多くの音声では空配列が正解**。独白、朗読、講演、雑談、インタビュー、説明動画など、誰かに具体的な作業や納期を依頼していない録音では、必ず空配列 `[]` を返す。\n\
          2. 「〜について話します」「〜を検討したい」「〜が課題だ」などの**話題提示や感想は actionItem ではない**。「〜をやってください」「〜を金曜までに送って」など、明確な指示・依頼・約束のみを抽出する。\n\
          3. 1 件だけ抽出するくらいなら空配列にする方が良い。少しでも「これは action item か?」と迷う内容は含めない。\n\
          4. what (タスク内容) は必須、due (期日) は発話で**明示されている場合のみ**埋める。文脈から推測した値や、不明な値は省略する。担当者の推定は行わない (スキーマにも含まない)。\n\
        \n\
        入力と同じ言語で出力してください。"
    );

    vec![
        ChatMessage {
            role: "system".to_string(),
            content: system,
        },
        ChatMessage {
            role: "user".to_string(),
            content: text.to_string(),
        },
    ]
}

/// Returns the JSON schema enforced for structured summarization responses.
///
/// Used as the `json_schema` payload of OpenAI-compatible `response_format`.
/// llama.cpp's server converts this into a grammar internally. Keep field
/// names in sync with [`super::types::StructuredSummary`].
#[must_use]
pub(crate) fn summary_json_schema() -> Value {
    json!({
        "type": "object",
        "additionalProperties": false,
        "required": ["headline", "tldr", "keywords", "actionItems", "keyPoints"],
        "properties": {
            "headline": { "type": "string" },
            "tldr": { "type": "string" },
            "keywords": {
                "type": "array",
                "items": { "type": "string" }
            },
            "actionItems": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": false,
                    "required": ["what"],
                    "properties": {
                        "what": { "type": "string" },
                        "due": { "type": "string" }
                    }
                }
            },
            "keyPoints": {
                "type": "array",
                "items": { "type": "string" }
            }
        }
    })
}

/// Builds the `response_format` payload for structured summarization.
#[must_use]
pub(crate) fn summary_response_format() -> Value {
    json!({
        "type": "json_schema",
        "json_schema": {
            "name": "structured_summary",
            "strict": true,
            "schema": summary_json_schema(),
        }
    })
}

/// Builds chat messages for condensing one chunk of a long transcription.
///
/// Used as the intermediate step of two-pass summarization: each chunk is
/// reduced to a plain-text paragraph, then the combined output is fed to
/// [`build_summarize_messages`] for the final structured pass.
#[must_use]
pub(crate) fn build_chunk_condense_messages(text: &str) -> Vec<ChatMessage> {
    vec![
        ChatMessage {
            role: "system".to_string(),
            content: concat!(
                "あなたは文字起こしテキストの一部を簡潔な要旨にまとめる専門家です。以下のルールに従ってください:\n",
                "1. 元のテキストの主要な事実・話題・依頼事項を残す\n",
                "2. 不要な相づちや繰り返しは省く\n",
                "3. 200〜400 文字程度の平文 (箇条書きや見出しなし) で出力する\n",
                "4. 入力と同じ言語で出力する"
            )
            .to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: text.to_string(),
        },
    ]
}

/// Builds chat messages for title generation.
#[must_use]
pub(crate) fn build_title_messages(text: &str) -> Vec<ChatMessage> {
    vec![
        ChatMessage {
            role: "system".to_string(),
            content: concat!(
                "あなたはテキストから短いタイトルを生成する専門家です。以下のルールに従ってください:\n",
                "1. テキストの内容を表す15-30文字程度のタイトルを1つだけ生成する\n",
                "2. タイトルのみを出力し、説明や記号は含めない\n",
                "3. 日本語のテキストには日本語のタイトル、英語のテキストには英語のタイトルを生成する"
            )
            .to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: text.to_string(),
        },
    ]
}

/// Builds chat messages for text cleanup (filler removal, punctuation, paragraphs).
#[must_use]
pub(crate) fn build_clean_text_messages(text: &str) -> Vec<ChatMessage> {
    vec![
        ChatMessage {
            role: "system".to_string(),
            content: concat!(
                "あなたは日本語の文字起こしテキストを読みやすく整形する専門家です。以下のルールに従ってください:\n",
                "1. フィラー（えーと、あのー、まあ、えー、うーん等）を除去する\n",
                "2. 言い直しや繰り返しを整理する\n",
                "3. 適切な句読点（。、）を補い、文を整える\n",
                "4. 意味のまとまりごとに段落を分ける\n",
                "5. 元の内容や意味は変更しない\n",
                "6. 整形後のテキストのみを出力する"
            )
            .to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: text.to_string(),
        },
    ]
}

/// Boundary preference for chunk splitting: sentence enders first, then
/// clause/line breaks. Parts still oversized after the last tier are
/// hard-split at a fixed width.
const SEPARATOR_TIERS: [&[char]; 2] = [&['。'], &['、', '\n']];

/// Splits text into chunks at sentence boundaries (Japanese period `。`).
///
/// Every chunk is guaranteed to be at most `max_chars` Unicode characters:
/// a sentence that exceeds `max_chars` (or text with no `。` at all — Whisper
/// output can lack punctuation entirely) falls back to `、`/newline
/// boundaries, then to a fixed-width split. Without this guarantee, an
/// unsplittable transcript is sent as one request and overflows the server
/// context (`HTTP 400 exceed_context_size_error`).
#[must_use]
pub(crate) fn chunk_text(text: &str, max_chars: usize) -> Vec<String> {
    if text.chars().count() <= max_chars {
        return vec![text.to_string()];
    }
    pack(text, max_chars, &SEPARATOR_TIERS)
}

/// Packs `text` into chunks of at most `max_chars`, splitting at the first
/// tier's separators; oversized parts fall through to the next tier, then to
/// a fixed-width split once the tiers are exhausted.
fn pack(text: &str, max_chars: usize, tiers: &[&[char]]) -> Vec<String> {
    let Some((separators, rest)) = tiers.split_first() else {
        let chars: Vec<char> = text.chars().collect();
        return chars
            .chunks(max_chars)
            .map(|c| c.iter().collect())
            .collect();
    };

    let mut chunks = Vec::new();
    let mut current = String::new();
    let mut current_chars: usize = 0;

    for part in text.split_inclusive(*separators) {
        let part_chars = part.chars().count();
        if part_chars > max_chars {
            if !current.is_empty() {
                chunks.push(std::mem::take(&mut current));
                current_chars = 0;
            }
            chunks.extend(pack(part, max_chars, rest));
            continue;
        }
        if current_chars + part_chars > max_chars && !current.is_empty() {
            chunks.push(std::mem::take(&mut current));
            current_chars = 0;
        }
        current.push_str(part);
        current_chars += part_chars;
    }

    if !current.is_empty() {
        chunks.push(current);
    }

    chunks
}

/// Parses an SSE data line and extracts the token content.
///
/// Expected format: `data: {"choices":[{"delta":{"content":"token"}}]}`
/// Returns `None` for non-data lines, `[DONE]` markers, or parse errors.
#[must_use]
pub(crate) fn parse_sse_line(line: &str) -> Option<String> {
    let data = line.strip_prefix("data: ")?;
    if data.trim() == "[DONE]" {
        return None;
    }

    let json: serde_json::Value = serde_json::from_str(data).ok()?;
    json.get("choices")?
        .get(0)?
        .get("delta")?
        .get("content")?
        .as_str()
        .map(std::string::ToString::to_string)
}

/// Builds the chat-completions request body.
///
/// Sampling fields come from the model's official recommendation
/// ([`super::models::sampling_params`]); when `None` (unknown model), they
/// are omitted entirely so llama-server defaults apply. `top_k` / `min_p`
/// are llama-server extensions to the OpenAI-compatible endpoint.
#[must_use]
pub(crate) fn build_request_body(
    messages: &[ChatMessage],
    sampling: Option<SamplingParams>,
    max_tokens: u32,
    stream: bool,
) -> Value {
    let mut body = json!({
        "messages": messages,
        "max_tokens": max_tokens,
        "stream": stream,
    });
    if let Some(s) = sampling {
        body["temperature"] = json!(s.temperature);
        body["top_p"] = json!(s.top_p);
        body["top_k"] = json!(s.top_k);
        if let Some(min_p) = s.min_p {
            body["min_p"] = json!(min_p);
        }
    }
    body
}

/// Sends a chat-completions request to the local llama-server and validates
/// the response status. Shared by the streaming and non-streaming inference
/// paths — the request body (including the `stream` flag) is built by callers.
async fn send_chat_request(
    port: u16,
    body: &Value,
) -> Result<reqwest::Response, TextProcessingError> {
    let url = format!("http://127.0.0.1:{port}/v1/chat/completions");
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(TextProcessingError::from)?;

    let response = client
        .post(&url)
        .json(body)
        .send()
        .await
        .map_err(TextProcessingError::from)?;

    if !response.status().is_success() {
        return Err(TextProcessingError::InferenceError(format!(
            "HTTP {}",
            response.status()
        )));
    }

    Ok(response)
}

/// Runs a streaming inference request against the llama-server.
///
/// # Errors
///
/// Returns an error if the HTTP request fails or is cancelled.
pub(crate) async fn run_inference(
    port: u16,
    messages: &[ChatMessage],
    sampling: Option<SamplingParams>,
    max_tokens: u32,
    task_id: &str,
    token: &Arc<CancellationToken>,
    app: &AppHandle,
) -> Result<String, TextProcessingError> {
    let body = build_request_body(messages, sampling, max_tokens, true);

    let response = send_chat_request(port, &body).await?;

    let mut accumulated = String::new();
    let mut stream = response.bytes_stream();

    let mut buffer = String::new();

    while let Some(chunk) = stream.next().await {
        if token.is_cancelled() {
            return Err(TextProcessingError::Cancelled);
        }

        let chunk = chunk.map_err(TextProcessingError::from)?;
        let text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&text);

        // Process complete lines
        while let Some(newline_pos) = buffer.find('\n') {
            let line = buffer[..newline_pos].trim().to_string();
            buffer = buffer[newline_pos + 1..].to_string();

            if let Some(content) = parse_sse_line(&line) {
                accumulated.push_str(&content);
                emit_progress(app, task_id, &content, &accumulated, false);
            }
        }
    }

    emit_progress(app, task_id, "", &accumulated, true);

    Ok(accumulated)
}

/// Runs a non-streaming inference request and returns the full response text.
///
/// Used for tasks where partial JSON output is meaningless (e.g. structured
/// summarization). An optional `response_format` payload is forwarded
/// verbatim to the llama-server `/v1/chat/completions` endpoint so the model
/// is constrained to match a JSON schema. Progress events are emitted only at
/// start (handled by the caller) and on completion.
///
/// # Errors
///
/// Returns an error if the HTTP request fails, the response status is not
/// success, the body is not a valid OpenAI-compatible chat completion, or
/// the task is cancelled.
#[allow(clippy::too_many_arguments)]
pub(crate) async fn run_inference_blocking(
    port: u16,
    messages: &[ChatMessage],
    sampling: Option<SamplingParams>,
    max_tokens: u32,
    response_format: Option<Value>,
    task_id: &str,
    token: &Arc<CancellationToken>,
    app: &AppHandle,
) -> Result<String, TextProcessingError> {
    if token.is_cancelled() {
        return Err(TextProcessingError::Cancelled);
    }

    let mut body = build_request_body(messages, sampling, max_tokens, false);
    if let Some(format) = response_format {
        body["response_format"] = format;
    }

    let response = send_chat_request(port, &body).await?;

    if token.is_cancelled() {
        return Err(TextProcessingError::Cancelled);
    }

    let payload: Value = response.json().await.map_err(TextProcessingError::from)?;
    let content = payload
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(Value::as_str)
        .ok_or_else(|| {
            TextProcessingError::InferenceError("missing choices[0].message.content".to_string())
        })?
        .to_string();

    emit_progress(app, task_id, "", &content, true);

    Ok(content)
}

/// Emits an `InferenceProgress` event. Borrowing-friendly wrapper so callers
/// don't repeat the event-name string or build the payload by hand.
fn emit_progress(app: &AppHandle, task_id: &str, token: &str, accumulated: &str, done: bool) {
    let _ = app.emit(
        "text-processing:inference-progress",
        InferenceProgress {
            task_id: task_id.to_string(),
            token: token.to_string(),
            accumulated_text: accumulated.to_string(),
            done,
        },
    );
}

/// Emits the initial empty-payload progress event so the frontend receives
/// the taskId immediately and can wire up cancellation before any streamed
/// tokens arrive. Domain-named to keep the generic `emit_progress` private.
pub(super) fn emit_initial_progress(app: &AppHandle, task_id: &str) {
    emit_progress(app, task_id, "", "", false);
}

/// Default chunk size for text processing.
#[must_use]
pub(crate) fn default_max_chunk_chars() -> usize {
    MAX_CHUNK_CHARS
}

/// Computes `max_tokens` for clean-up tasks, scaled to input length.
///
/// Cleanup reformats existing text, so the output length is roughly proportional
/// to the input. A 1.5× factor leaves room for added punctuation and paragraph
/// breaks; 256 is a floor for very short inputs; [`MAX_OUTPUT_TOKENS`] caps the
/// output so the prompt + response stay within the server context.
#[must_use]
pub(crate) fn clean_text_max_tokens(text: &str) -> u32 {
    #[allow(
        clippy::cast_precision_loss,
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss
    )]
    let approx = (text.chars().count() as f64 * 1.5) as u32 + 256;
    approx.min(MAX_OUTPUT_TOKENS)
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- build_chat_messages ---

    #[test]
    fn chat_messages_has_system_and_user() {
        let messages = build_chat_messages("hello");
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "system");
        assert_eq!(messages[1].role, "user");
        assert_eq!(messages[1].content, "hello");
    }

    // --- build_summarize_messages ---

    #[test]
    fn summarize_messages_has_system_and_user() {
        let messages = build_summarize_messages("テスト文章", 2, 4);
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "system");
        assert_eq!(messages[1].role, "user");
        assert_eq!(messages[1].content, "テスト文章");
    }

    #[test]
    fn summarize_system_describes_structured_fields() {
        let messages = build_summarize_messages("text", 2, 4);
        let system = &messages[0].content;
        // The prompt defers formatting to the JSON schema and only describes
        // the semantic shape of each field.
        assert!(system.contains("headline"));
        assert!(system.contains("tldr"));
        assert!(system.contains("keywords"));
        assert!(system.contains("actionItems"));
        assert!(system.contains("keyPoints"));
        // No more markdown-style instructions or example blocks.
        assert!(!system.contains("### 見出し"));
        assert!(!system.contains("<example>"));
        // Quality guard: tldr / keyPoints are explicitly separated and
        // actionItems is biased toward empty arrays.
        assert!(system.contains("総括"));
        assert!(system.contains("サブトピック"));
        assert!(system.contains("空配列"));
        // Assignee inference is explicitly off the table.
        assert!(system.contains("担当者の推定は行わない"));
    }

    #[test]
    fn summarize_system_embeds_key_points_range() {
        let messages = build_summarize_messages("text", 5, 10);
        assert!(messages[0].content.contains("5〜10 個"));
    }

    #[test]
    fn summary_params_scale_with_length() {
        // Below 1500 chars: 2–4 keyPoints, 2048 tokens.
        let p = summary_params_for_length(500);
        assert_eq!(p.key_points_min, 2);
        assert_eq!(p.key_points_max, 4);
        assert_eq!(p.max_tokens, 2_048);

        // 1500–5000: 3–6, 2048.
        let p = summary_params_for_length(3_000);
        assert_eq!(p.key_points_min, 3);
        assert_eq!(p.key_points_max, 6);
        assert_eq!(p.max_tokens, 2_048);

        // 5000–15000: 5–10, 3072.
        let p = summary_params_for_length(10_000);
        assert_eq!(p.key_points_min, 5);
        assert_eq!(p.key_points_max, 10);
        assert_eq!(p.max_tokens, 3_072);

        // >=15000: 7–15, 4096.
        let p = summary_params_for_length(50_000);
        assert_eq!(p.key_points_min, 7);
        assert_eq!(p.key_points_max, 15);
        assert_eq!(p.max_tokens, 4_096);
    }

    #[test]
    fn summary_params_bucket_boundaries() {
        // Boundaries: <1500, <5000, <15000, >=15000.
        assert_eq!(summary_params_for_length(0).max_tokens, 2_048);
        assert_eq!(summary_params_for_length(1_499).key_points_max, 4);
        assert_eq!(summary_params_for_length(1_500).key_points_max, 6);
        assert_eq!(summary_params_for_length(4_999).key_points_max, 6);
        assert_eq!(summary_params_for_length(5_000).key_points_max, 10);
        assert_eq!(summary_params_for_length(14_999).key_points_max, 10);
        assert_eq!(summary_params_for_length(15_000).key_points_max, 15);
    }

    #[test]
    fn summary_json_schema_has_all_required_fields() {
        let schema = summary_json_schema();
        let required = schema["required"].as_array().expect("required array");
        let names: Vec<&str> = required.iter().filter_map(Value::as_str).collect();
        assert_eq!(
            names,
            vec!["headline", "tldr", "keywords", "actionItems", "keyPoints"]
        );

        let action_props = &schema["properties"]["actionItems"]["items"]["properties"];
        assert!(action_props.get("who").is_none(), "who must not be present");
        assert!(action_props.get("what").is_some());
        assert!(action_props.get("due").is_some());

        let action_required = schema["properties"]["actionItems"]["items"]["required"]
            .as_array()
            .expect("action_items required");
        let action_required_names: Vec<&str> =
            action_required.iter().filter_map(Value::as_str).collect();
        assert_eq!(action_required_names, vec!["what"]);
    }

    #[test]
    fn summary_response_format_wraps_schema() {
        let format = summary_response_format();
        assert_eq!(format["type"], "json_schema");
        assert_eq!(format["json_schema"]["name"], "structured_summary");
        assert_eq!(format["json_schema"]["strict"], true);
        assert!(format["json_schema"]["schema"].is_object());
    }

    // --- chunk_text ---

    #[test]
    fn chunk_text_short_returns_single_chunk() {
        let chunks = chunk_text("短い文章です。", 100);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], "短い文章です。");
    }

    #[test]
    fn chunk_text_long_splits_at_period() {
        let text = "一つ目の文。二つ目の文。三つ目の文。";
        // Set max_chars small enough to force splitting (text is 18 chars)
        let chunks = chunk_text(text, 7);
        assert!(chunks.len() > 1);
        // Each chunk should end with 。 (except possibly the last)
        for chunk in &chunks[..chunks.len() - 1] {
            assert!(chunk.ends_with('。'), "chunk should end with 。: {chunk}");
        }
    }

    #[test]
    fn chunk_text_no_period_still_respects_max_chars() {
        // Regression: text without 。 used to be sent as one giant chunk and
        // overflow the server context.
        let text = "句点のない長いテキスト";
        let chunks = chunk_text(text, 5);
        assert!(chunks.len() > 1);
        for chunk in &chunks {
            assert!(chunk.chars().count() <= 5, "oversized chunk: {chunk}");
        }
        assert_eq!(chunks.concat(), text);
    }

    #[test]
    fn chunk_text_oversized_sentence_prefers_comma_boundaries() {
        let text = "あいうえお、かきくけこ、さしすせそ。";
        let chunks = chunk_text(text, 8);
        for chunk in &chunks {
            assert!(chunk.chars().count() <= 8, "oversized chunk: {chunk}");
        }
        // Boundaries land after 、 rather than mid-phrase.
        assert_eq!(chunks[0], "あいうえお、");
        assert_eq!(chunks.concat(), text);
    }

    #[test]
    fn chunk_text_oversized_run_without_separators_hard_splits() {
        let text: String = "あ".repeat(23);
        let chunks = chunk_text(&text, 10);
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].chars().count(), 10);
        assert_eq!(chunks[2].chars().count(), 3);
        assert_eq!(chunks.concat(), text);
    }

    #[test]
    fn chunk_text_long_transcript_without_periods_reconstructs() {
        // Realistic failure case: a long filler-heavy transcript with 、 but
        // no 。 must produce bounded chunks with no content loss.
        let text = "えーと本日はですね、あのー機械学習の話を、まあしたいと思います、".repeat(400);
        let chunks = chunk_text(&text, 4000);
        assert!(chunks.len() > 1);
        for chunk in &chunks {
            assert!(chunk.chars().count() <= 4000);
        }
        assert_eq!(chunks.concat(), text);
    }

    #[test]
    fn chunk_text_empty_returns_single_empty() {
        let chunks = chunk_text("", 100);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], "");
    }

    // --- build_request_body ---

    #[test]
    fn request_body_includes_sampling_params() {
        let messages = build_chat_messages("hi");
        let sampling = SamplingParams {
            temperature: 0.7,
            top_p: 0.8,
            top_k: 20,
            min_p: Some(0.0),
        };
        let body = build_request_body(&messages, Some(sampling), 512, true);
        assert_eq!(body["temperature"], 0.7);
        assert_eq!(body["top_p"], 0.8);
        assert_eq!(body["top_k"], 20);
        assert_eq!(body["min_p"], 0.0);
        assert_eq!(body["max_tokens"], 512);
        assert_eq!(body["stream"], true);
    }

    #[test]
    fn request_body_omits_min_p_when_unrecommended() {
        let messages = build_chat_messages("hi");
        let sampling = SamplingParams {
            temperature: 1.0,
            top_p: 0.95,
            top_k: 64,
            min_p: None,
        };
        let body = build_request_body(&messages, Some(sampling), 256, false);
        assert_eq!(body["temperature"], 1.0);
        assert!(body.get("min_p").is_none());
        assert_eq!(body["stream"], false);
    }

    #[test]
    fn request_body_without_sampling_defers_to_server_defaults() {
        let messages = build_chat_messages("hi");
        let body = build_request_body(&messages, None, 128, true);
        assert!(body.get("temperature").is_none());
        assert!(body.get("top_p").is_none());
        assert!(body.get("top_k").is_none());
        assert!(body.get("min_p").is_none());
        assert_eq!(body["max_tokens"], 128);
    }

    // --- parse_sse_line ---

    #[test]
    fn parse_sse_line_extracts_token() {
        let line = r#"data: {"choices":[{"delta":{"content":"hello"}}]}"#;
        assert_eq!(parse_sse_line(line), Some("hello".to_string()));
    }

    #[test]
    fn parse_sse_line_done_returns_none() {
        let line = "data: [DONE]";
        assert_eq!(parse_sse_line(line), None);
    }

    #[test]
    fn parse_sse_line_non_data_returns_none() {
        assert_eq!(parse_sse_line("event: message"), None);
        assert_eq!(parse_sse_line(""), None);
        assert_eq!(parse_sse_line(": comment"), None);
    }

    #[test]
    fn parse_sse_line_no_content_returns_none() {
        let line = r#"data: {"choices":[{"delta":{}}]}"#;
        assert_eq!(parse_sse_line(line), None);
    }

    #[test]
    fn parse_sse_line_invalid_json_returns_none() {
        let line = "data: {invalid json}";
        assert_eq!(parse_sse_line(line), None);
    }

    #[test]
    fn parse_sse_line_empty_content() {
        let line = r#"data: {"choices":[{"delta":{"content":""}}]}"#;
        assert_eq!(parse_sse_line(line), Some(String::new()));
    }

    // --- build_title_messages ---

    #[test]
    fn title_messages_has_system_and_user() {
        let messages = build_title_messages("テスト文章");
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "system");
        assert_eq!(messages[1].role, "user");
        assert_eq!(messages[1].content, "テスト文章");
    }

    #[test]
    fn title_system_contains_title_instructions() {
        let messages = build_title_messages("test");
        assert!(messages[0].content.contains("タイトル"));
    }

    // --- build_clean_text_messages ---

    #[test]
    fn clean_text_messages_has_system_and_user() {
        let messages = build_clean_text_messages("テスト文章");
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "system");
        assert_eq!(messages[1].role, "user");
    }

    #[test]
    fn clean_text_system_contains_instructions() {
        let messages = build_clean_text_messages("test");
        assert!(messages[0].content.contains("整形"));
    }

    // --- clean_text_max_tokens ---

    #[test]
    fn clean_text_max_tokens_short_input_uses_floor() {
        // 10 chars × 1.5 = 15, +256 = 271 (above 256 floor, below cap)
        assert_eq!(clean_text_max_tokens("1234567890"), 271);
    }

    #[test]
    fn clean_text_max_tokens_scales_with_length() {
        // 1000 chars × 1.5 + 256 = 1756
        let text: String = "あ".repeat(1000);
        assert_eq!(clean_text_max_tokens(&text), 1756);
    }

    #[test]
    fn clean_text_max_tokens_caps_at_4096() {
        // 4000 chars × 1.5 + 256 = 6256 → capped to 4096
        let text: String = "x".repeat(4000);
        assert_eq!(clean_text_max_tokens(&text), 4096);
    }

    #[test]
    fn clean_text_max_tokens_empty_returns_floor() {
        assert_eq!(clean_text_max_tokens(""), 256);
    }
}
