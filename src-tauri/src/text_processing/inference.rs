use std::sync::Arc;

use once_cell::sync::Lazy;
use tauri::{AppHandle, Emitter};

use super::error::TextProcessingError;
use super::types::{ChatMessage, InferenceProgress, SummaryLength, SummaryOptions};
use crate::whisper::process::{CancellationToken, TaskManager};
use futures_util::StreamExt;

/// Global inference task manager for cancellation.
pub static INFERENCE_TASK_MANAGER: Lazy<TaskManager> = Lazy::new(TaskManager::new);

/// Maximum characters (Unicode scalar values) per chunk for text splitting.
/// For Japanese text (~3 bytes per char in UTF-8), this corresponds to ~12KB.
const MAX_CHUNK_CHARS: usize = 4000;

/// Builds chat messages for a simple chat response (dev testing).
#[must_use]
pub fn build_chat_messages(text: &str) -> Vec<ChatMessage> {
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

/// Builds chat messages for summarization.
#[must_use]
pub fn build_summarize_messages(text: &str, options: &SummaryOptions) -> Vec<ChatMessage> {
    let length_instruction = match options.length {
        SummaryLength::Short => "1-2文の短い要約",
        SummaryLength::Medium => "3-5文の中程度の要約",
        SummaryLength::Long => "段落レベルの詳細な要約",
    };

    let format_instruction = if options.bullet_points {
        "箇条書き形式で出力してください。"
    } else {
        "文章形式で出力してください。"
    };

    let system_prompt = format!(
        concat!(
            "あなたは日本語テキストの要約専門家です。以下のルールに従ってテキストを要約してください:\n",
            "1. {length}を生成する\n",
            "2. {format}\n",
            "3. 要約結果のテキストのみを出力し、説明や注釈は一切含めない\n",
            "4. 元のテキストの重要なポイントを漏らさない"
        ),
        length = length_instruction,
        format = format_instruction,
    );

    vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_prompt,
        },
        ChatMessage {
            role: "user".to_string(),
            content: text.to_string(),
        },
    ]
}

/// Builds chat messages for title generation.
#[must_use]
pub fn build_title_messages(text: &str) -> Vec<ChatMessage> {
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

/// Builds chat messages for keyword extraction.
#[must_use]
pub fn build_keywords_messages(text: &str) -> Vec<ChatMessage> {
    vec![
        ChatMessage {
            role: "system".to_string(),
            content: concat!(
                "あなたはテキストからキーワードを抽出する専門家です。以下のルールに従ってください:\n",
                "1. テキストの主要なトピック・キーワードを5-10個抽出する\n",
                "2. 各キーワードはカンマ区切りで1行で出力する\n",
                "3. キーワードのみを出力し、番号や説明は含めない\n",
                "4. 固有名詞、専門用語、重要な概念を優先する"
            )
            .to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: text.to_string(),
        },
    ]
}

/// Builds chat messages for action item extraction.
#[must_use]
pub fn build_action_items_messages(text: &str) -> Vec<ChatMessage> {
    vec![
        ChatMessage {
            role: "system".to_string(),
            content: concat!(
                "あなたは会議録からアクションアイテムを抽出する専門家です。以下のルールに従ってください:\n",
                "1. テキストからアクションアイテム（タスク、やるべきこと、決定事項）を抽出する\n",
                "2. 各アイテムを「- 」で始まる箇条書きで出力する\n",
                "3. アクションアイテムのみを出力し、説明や前置きは含めない\n",
                "4. アクションアイテムが見つからない場合は「アクションアイテムはありません」とだけ出力する\n",
                "5. 担当者や期限が明確な場合はそれも含める"
            )
            .to_string(),
        },
        ChatMessage {
            role: "user".to_string(),
            content: text.to_string(),
        },
    ]
}

/// Splits text into chunks at sentence boundaries (Japanese period `。`).
///
/// Each chunk is at most `max_chars` Unicode characters. If a sentence exceeds
/// `max_chars`, it is included as its own chunk.
#[must_use]
pub fn chunk_text(text: &str, max_chars: usize) -> Vec<String> {
    if text.chars().count() <= max_chars {
        return vec![text.to_string()];
    }

    let mut chunks = Vec::new();
    let mut current = String::new();
    let mut current_chars: usize = 0;

    for sentence in text.split_inclusive('。') {
        let sentence_chars = sentence.chars().count();
        if current_chars + sentence_chars > max_chars && !current.is_empty() {
            chunks.push(current.clone());
            current.clear();
            current_chars = 0;
        }
        current.push_str(sentence);
        current_chars += sentence_chars;
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
pub fn parse_sse_line(line: &str) -> Option<String> {
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

/// Runs a streaming inference request against the llama-server.
///
/// # Errors
///
/// Returns an error if the HTTP request fails or is cancelled.
pub async fn run_inference(
    port: u16,
    messages: &[ChatMessage],
    temperature: f64,
    task_id: &str,
    token: &Arc<CancellationToken>,
    app: &AppHandle,
) -> Result<String, TextProcessingError> {
    let url = format!("http://127.0.0.1:{port}/v1/chat/completions");
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .map_err(TextProcessingError::from)?;

    let body = serde_json::json!({
        "messages": messages,
        "temperature": temperature,
        "max_tokens": 4096,
        "stream": true,
    });

    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(TextProcessingError::from)?;

    if !response.status().is_success() {
        return Err(TextProcessingError::InferenceError(format!(
            "HTTP {}",
            response.status()
        )));
    }

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
                let _ = app.emit(
                    "text-processing:inference-progress",
                    InferenceProgress {
                        task_id: task_id.to_string(),
                        token: content,
                        accumulated_text: accumulated.clone(),
                        done: false,
                    },
                );
            }
        }
    }

    // Emit final done event
    let _ = app.emit(
        "text-processing:inference-progress",
        InferenceProgress {
            task_id: task_id.to_string(),
            token: String::new(),
            accumulated_text: accumulated.clone(),
            done: true,
        },
    );

    Ok(accumulated)
}

/// Default chunk size for text processing.
#[must_use]
pub fn default_max_chunk_chars() -> usize {
    MAX_CHUNK_CHARS
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
        let options = SummaryOptions::default();
        let messages = build_summarize_messages("テスト文章", &options);
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "system");
        assert_eq!(messages[1].role, "user");
    }

    #[test]
    fn summarize_short_mentions_short() {
        let options = SummaryOptions {
            length: SummaryLength::Short,
            bullet_points: false,
        };
        let messages = build_summarize_messages("text", &options);
        assert!(messages[0].content.contains("短い"));
    }

    #[test]
    fn summarize_long_mentions_detailed() {
        let options = SummaryOptions {
            length: SummaryLength::Long,
            bullet_points: false,
        };
        let messages = build_summarize_messages("text", &options);
        assert!(messages[0].content.contains("詳細"));
    }

    #[test]
    fn summarize_bullet_points_mentioned() {
        let options = SummaryOptions {
            length: SummaryLength::Medium,
            bullet_points: true,
        };
        let messages = build_summarize_messages("text", &options);
        assert!(messages[0].content.contains("箇条書き"));
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
    fn chunk_text_no_period_returns_single_chunk() {
        let text = "句点のない長いテキスト";
        let chunks = chunk_text(text, 5);
        // Without periods, the entire text is one chunk
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], text);
    }

    #[test]
    fn chunk_text_empty_returns_single_empty() {
        let chunks = chunk_text("", 100);
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0], "");
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

    // --- build_keywords_messages ---

    #[test]
    fn keywords_messages_has_system_and_user() {
        let messages = build_keywords_messages("テスト文章");
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "system");
        assert_eq!(messages[1].role, "user");
    }

    #[test]
    fn keywords_system_contains_keyword_instructions() {
        let messages = build_keywords_messages("test");
        assert!(messages[0].content.contains("キーワード"));
    }

    // --- build_action_items_messages ---

    #[test]
    fn action_items_messages_has_system_and_user() {
        let messages = build_action_items_messages("テスト文章");
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].role, "system");
        assert_eq!(messages[1].role, "user");
    }

    #[test]
    fn action_items_system_contains_action_instructions() {
        let messages = build_action_items_messages("test");
        assert!(messages[0].content.contains("アクションアイテム"));
    }
}
