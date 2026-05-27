use serde_json::{json, Value};

use super::error::NotionError;
use super::types::{
    NotionDatabaseInfo, NotionMetaField, NotionPagePayload, NotionPageRef, NotionSummary,
};

const NOTION_BASE_URL: &str = "https://api.notion.com/v1";
const NOTION_VERSION: &str = "2022-06-28";

const MAX_BLOCKS: usize = 100;
const MAX_BLOCK_CHARS: usize = 2000;
const MAX_TITLE_CHARS: usize = 2000;

const REQUEST_TIMEOUT_SECS: u64 = 30;

fn truncate_chars(s: &str, max_chars: usize) -> String {
    if s.chars().count() <= max_chars {
        s.to_string()
    } else {
        s.chars().take(max_chars).collect()
    }
}

fn chunk_string(s: &str, max_chars: usize) -> Vec<String> {
    if s.is_empty() {
        return Vec::new();
    }
    let mut chunks: Vec<String> = Vec::new();
    let mut current = String::new();
    let mut count: usize = 0;
    for ch in s.chars() {
        current.push(ch);
        count += 1;
        if count >= max_chars {
            chunks.push(std::mem::take(&mut current));
            count = 0;
        }
    }
    if !current.is_empty() {
        chunks.push(current);
    }
    chunks
}

const META_CALLOUT_EMOJI: &str = "📋";

fn rich_text_array(content: &str) -> Value {
    if content.is_empty() {
        json!([])
    } else {
        json!([{"type": "text", "text": {"content": truncate_chars(content, MAX_BLOCK_CHARS)}}])
    }
}

fn paragraph_block(content: &str) -> Value {
    json!({
        "object": "block",
        "type": "paragraph",
        "paragraph": {"rich_text": rich_text_array(content)},
    })
}

fn heading1_block(content: &str) -> Value {
    json!({
        "object": "block",
        "type": "heading_1",
        "heading_1": {"rich_text": rich_text_array(content)},
    })
}

fn heading2_block(content: &str) -> Value {
    json!({
        "object": "block",
        "type": "heading_2",
        "heading_2": {"rich_text": rich_text_array(content)},
    })
}

fn bulleted_item_block(content: &str) -> Value {
    json!({
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {"rich_text": rich_text_array(content)},
    })
}

/// Builds a single callout block containing every metadata field as
/// `Label: Value` lines joined by `\n`. Returns `None` when the input is
/// empty so the caller can skip emitting an empty block.
#[must_use]
pub fn build_meta_callout(fields: &[NotionMetaField]) -> Option<Value> {
    if fields.is_empty() {
        return None;
    }
    let content = fields
        .iter()
        .map(|f| format!("{}: {}", f.label, f.value))
        .collect::<Vec<_>>()
        .join("\n");
    Some(json!({
        "object": "block",
        "type": "callout",
        "callout": {
            "icon": {"type": "emoji", "emoji": META_CALLOUT_EMOJI},
            "rich_text": rich_text_array(&content),
        },
    }))
}

/// Expands a structured summary into Notion blocks. The headline (when
/// present) becomes a leading `heading_1`; each non-empty section then
/// emits a `heading_2` (label text supplied by the caller in their locale)
/// followed by `paragraph` / `bulleted_list_item` children. Empty sections
/// (empty string, empty vec) are skipped entirely.
#[must_use]
pub fn build_summary_blocks(summary: &NotionSummary) -> Vec<Value> {
    let mut blocks: Vec<Value> = Vec::new();

    if !summary.headline.is_empty() {
        blocks.push(heading1_block(&summary.headline));
    }

    if !summary.tldr.is_empty() {
        blocks.push(heading2_block(&summary.labels.tldr));
        blocks.push(paragraph_block(&summary.tldr));
    }

    if !summary.key_points.is_empty() {
        blocks.push(heading2_block(&summary.labels.key_points));
        for point in &summary.key_points {
            blocks.push(bulleted_item_block(point));
        }
    }

    if !summary.action_items.is_empty() {
        blocks.push(heading2_block(&summary.labels.action_items));
        for item in &summary.action_items {
            let line = match &item.due {
                Some(due) if !due.is_empty() => {
                    format!("{} ({}: {})", item.what, summary.labels.due, due)
                }
                _ => item.what.clone(),
            };
            blocks.push(bulleted_item_block(&line));
        }
    }

    if !summary.keywords.is_empty() {
        blocks.push(heading2_block(&summary.labels.keywords));
        blocks.push(paragraph_block(&summary.keywords.join(", ")));
    }

    blocks
}

#[must_use]
pub fn build_divider_block() -> Value {
    json!({"object": "block", "type": "divider", "divider": {}})
}

/// Splits free-form text into paragraph blocks without imposing a total cap.
/// Long lines are subdivided at `MAX_BLOCK_CHARS`; blank lines are dropped
/// since Notion already lays out adjacent paragraph blocks with vertical
/// breathing room — inserting empty paragraphs creates visible gap blocks
/// the user would have to delete by hand. Excess blocks are handled later
/// by `split_children_for_create` (initial POST + chunked PATCH appends).
fn body_paragraph_blocks(text: &str) -> Vec<Value> {
    if text.is_empty() {
        return Vec::new();
    }
    let mut blocks = Vec::new();
    for line in text.split('\n') {
        if line.is_empty() {
            continue;
        }
        // Fast path: lines that fit in one block skip the chunk_string Vec
        // allocation, which matters for transcripts with many short lines.
        if line.chars().count() <= MAX_BLOCK_CHARS {
            blocks.push(paragraph_block(line));
            continue;
        }
        for chunk in chunk_string(line, MAX_BLOCK_CHARS) {
            blocks.push(paragraph_block(&chunk));
        }
    }
    blocks
}

/// Assembles the full ordered child block sequence for a Notion page:
/// meta callout → summary blocks → divider (only when both upper and body
/// sections exist) → body paragraphs.
#[must_use]
pub fn build_create_page_children(payload: &NotionPagePayload) -> Vec<Value> {
    let mut children: Vec<Value> = Vec::new();

    if let Some(callout) = build_meta_callout(&payload.meta) {
        children.push(callout);
    }

    if let Some(summary) = payload.summary.as_ref() {
        children.extend(build_summary_blocks(summary));
    }

    let body_blocks = body_paragraph_blocks(&payload.body_text);
    if !body_blocks.is_empty() {
        if !children.is_empty() {
            children.push(build_divider_block());
        }
        children.extend(body_blocks);
    }

    children
}

/// Splits an unbounded children list into the slice that fits in the initial
/// `POST /pages` call (first `MAX_BLOCKS`) and any remaining 100-chunk batches
/// suitable for `PATCH /v1/blocks/{page_id}/children`.
///
/// The tail is moved (not cloned) into the appendix batches — for long
/// transcripts that can be hundreds of `Value` trees worth of allocations.
#[must_use]
pub fn split_children_for_create(mut children: Vec<Value>) -> (Vec<Value>, Vec<Vec<Value>>) {
    if children.len() <= MAX_BLOCKS {
        return (children, Vec::new());
    }
    let rest = children.split_off(MAX_BLOCKS);
    let mut appendices: Vec<Vec<Value>> = Vec::new();
    let mut iter = rest.into_iter();
    loop {
        let batch: Vec<Value> = iter.by_ref().take(MAX_BLOCKS).collect();
        if batch.is_empty() {
            break;
        }
        appendices.push(batch);
    }
    (children, appendices)
}

fn build_title_properties(title_property: &str, title: &str) -> Value {
    let truncated = truncate_chars(title, MAX_TITLE_CHARS);
    json!({
        title_property: {
            "title": [{"type": "text", "text": {"content": truncated}}]
        }
    })
}

/// Extracts database name and the title-typed property name from a Notion
/// database response.
///
/// # Errors
///
/// Returns [`NotionError::InvalidResponse`] when the response shape is
/// unexpected, or [`NotionError::NoTitleProperty`] when no property has
/// `type == "title"`.
pub fn parse_database_response(value: &Value) -> Result<NotionDatabaseInfo, NotionError> {
    let id = value
        .get("id")
        .and_then(Value::as_str)
        .ok_or(NotionError::InvalidResponse)?
        .to_string();

    let title = value
        .get("title")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(|item| item.get("plain_text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("")
        })
        .unwrap_or_default();

    let properties = value
        .get("properties")
        .and_then(Value::as_object)
        .ok_or(NotionError::InvalidResponse)?;

    let title_property = properties
        .iter()
        .find(|(_, v)| v.get("type").and_then(Value::as_str) == Some("title"))
        .map(|(k, _)| k.clone())
        .ok_or(NotionError::NoTitleProperty)?;

    Ok(NotionDatabaseInfo {
        id,
        title,
        title_property,
    })
}

/// Extracts page ID and URL from a Notion page-creation response.
///
/// Falls back to a Notion-style URL derived from the page ID when `url` is
/// missing — that field is documented as always present on page objects, but
/// being defensive here keeps a successful page creation from surfacing as a
/// UI error if the API contract drifts.
///
/// # Errors
///
/// Returns [`NotionError::InvalidResponse`] when `id` is missing.
pub fn parse_page_response(value: &Value) -> Result<NotionPageRef, NotionError> {
    let page_id = value
        .get("id")
        .and_then(Value::as_str)
        .ok_or(NotionError::InvalidResponse)?
        .to_string();
    let url = value.get("url").and_then(Value::as_str).map_or_else(
        || format!("https://www.notion.so/{}", page_id.replace('-', "")),
        String::from,
    );
    Ok(NotionPageRef {
        page_id,
        url,
        partial: false,
    })
}

async fn execute_request(req: reqwest::RequestBuilder) -> Result<Value, NotionError> {
    let response = req.send().await?;
    let status = response.status();
    let text = response.text().await.map_err(NotionError::from)?;
    let body = serde_json::from_str::<Value>(&text).unwrap_or(Value::Null);
    if !status.is_success() {
        // Use Notion's structured `message` field when present; otherwise fall back to
        // the status line only. The raw response body is intentionally not echoed into
        // the user-facing error string (defense-in-depth: avoids widening the leak
        // surface if Notion ever starts reflecting request data in error bodies). The
        // raw body is logged to stderr so non-JSON gateway errors (HTML 429/502/504)
        // remain diagnosable during development.
        if body.get("message").is_none() && !text.is_empty() {
            eprintln!("[notion] error response body (HTTP {status}): {text}");
        }
        let message = body
            .get("message")
            .and_then(Value::as_str)
            .map_or_else(|| format!("HTTP {status}"), String::from);
        return Err(NotionError::Api {
            status: status.as_u16(),
            message,
        });
    }
    if body.is_null() {
        return Err(NotionError::InvalidResponse);
    }
    Ok(body)
}

fn build_client() -> Result<reqwest::Client, NotionError> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(NotionError::from)
}

/// Fetches database metadata to verify connectivity and discover the title
/// property name.
///
/// # Errors
///
/// Returns a [`NotionError`] when the HTTP request fails, the API returns a
/// non-2xx status, or the response cannot be parsed.
pub async fn fetch_database(
    token: &str,
    database_id: &str,
) -> Result<NotionDatabaseInfo, NotionError> {
    let client = build_client()?;
    let url = format!("{NOTION_BASE_URL}/databases/{database_id}");
    let req = client
        .get(&url)
        .bearer_auth(token)
        .header("Notion-Version", NOTION_VERSION);
    let body = execute_request(req).await?;
    parse_database_response(&body)
}

async fn append_block_children(
    client: &reqwest::Client,
    token: &str,
    block_id: &str,
    children: &[Value],
) -> Result<(), NotionError> {
    let body = json!({"children": children});
    let req = client
        .patch(format!("{NOTION_BASE_URL}/blocks/{block_id}/children"))
        .bearer_auth(token)
        .header("Notion-Version", NOTION_VERSION)
        .json(&body);
    execute_request(req).await?;
    Ok(())
}

/// Creates a new page in the configured database.
///
/// When the total child block count exceeds Notion's per-request 100-block
/// limit, the first 100 ride along with the page-creation `POST`, and the
/// remainder is sent in 100-block PATCH batches against the new page. If any
/// append batch fails the page is still considered created, but
/// [`NotionPageRef::partial`] is set so the UI can warn the user.
///
/// # Errors
///
/// Returns a [`NotionError`] when the initial page-creation request fails,
/// the API returns a non-2xx status, or the response cannot be parsed.
/// Append-batch failures are absorbed into `partial` and do not surface here.
pub async fn create_page(
    token: &str,
    database_id: &str,
    title_property: &str,
    payload: &NotionPagePayload,
) -> Result<NotionPageRef, NotionError> {
    let client = build_client()?;
    let children = build_create_page_children(payload);
    let (initial, appendices) = split_children_for_create(children);

    let body = json!({
        "parent": {"database_id": database_id},
        "properties": build_title_properties(title_property, &payload.title),
        "children": initial,
    });
    let req = client
        .post(format!("{NOTION_BASE_URL}/pages"))
        .bearer_auth(token)
        .header("Notion-Version", NOTION_VERSION)
        .json(&body);
    let response_body = execute_request(req).await?;
    let mut page_ref = parse_page_response(&response_body)?;

    for batch in appendices {
        if let Err(err) = append_block_children(&client, token, &page_ref.page_id, &batch).await {
            eprintln!("Warning: Notion append_block_children failed: {err}");
            page_ref.partial = true;
            break;
        }
    }

    Ok(page_ref)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notion::types::{NotionActionItem, NotionSummaryLabels};

    fn test_labels() -> NotionSummaryLabels {
        NotionSummaryLabels {
            tldr: "TL;DR".to_string(),
            key_points: "Key Points".to_string(),
            action_items: "Action Items".to_string(),
            keywords: "Keywords".to_string(),
            due: "due".to_string(),
        }
    }

    #[test]
    fn truncate_keeps_short_string() {
        assert_eq!(truncate_chars("hello", 10), "hello");
    }

    #[test]
    fn truncate_cuts_long_string_by_chars() {
        let text: String = "あ".repeat(10);
        assert_eq!(truncate_chars(&text, 3), "あああ");
    }

    #[test]
    fn chunk_string_returns_empty_for_empty_input() {
        assert!(chunk_string("", 10).is_empty());
    }

    #[test]
    fn chunk_string_returns_single_chunk_when_short() {
        assert_eq!(chunk_string("abc", 10), vec!["abc".to_string()]);
    }

    #[test]
    fn chunk_string_splits_long_input_at_max_chars() {
        let text: String = "x".repeat(2500);
        let chunks = chunk_string(&text, 1000);
        assert_eq!(chunks.len(), 3);
        assert_eq!(chunks[0].chars().count(), 1000);
        assert_eq!(chunks[1].chars().count(), 1000);
        assert_eq!(chunks[2].chars().count(), 500);
    }

    #[test]
    fn build_title_properties_uses_property_name_as_key() {
        let props = build_title_properties("Name", "Hello");
        assert_eq!(props["Name"]["title"][0]["text"]["content"], "Hello");
    }

    #[test]
    fn build_title_properties_truncates_long_title() {
        let props = build_title_properties("Name", &"x".repeat(MAX_TITLE_CHARS + 100));
        let title = props["Name"]["title"][0]["text"]["content"]
            .as_str()
            .expect("title content");
        assert_eq!(title.chars().count(), MAX_TITLE_CHARS);
    }

    #[test]
    fn parse_database_response_extracts_title_and_property() {
        let value = json!({
            "id": "abc",
            "title": [{"plain_text": "My DB"}],
            "properties": {
                "Date": {"type": "date"},
                "名前": {"type": "title"}
            }
        });
        let info = parse_database_response(&value).expect("ok");
        assert_eq!(info.id, "abc");
        assert_eq!(info.title, "My DB");
        assert_eq!(info.title_property, "名前");
    }

    #[test]
    fn parse_database_response_concatenates_multi_part_title() {
        let value = json!({
            "id": "abc",
            "title": [{"plain_text": "Hello "}, {"plain_text": "World"}],
            "properties": {
                "Name": {"type": "title"}
            }
        });
        let info = parse_database_response(&value).expect("ok");
        assert_eq!(info.title, "Hello World");
    }

    #[test]
    fn parse_database_response_errors_when_no_title_property() {
        let value = json!({
            "id": "abc",
            "title": [],
            "properties": {
                "Date": {"type": "date"}
            }
        });
        match parse_database_response(&value) {
            Err(NotionError::NoTitleProperty) => {}
            other => panic!("expected NoTitleProperty, got {other:?}"),
        }
    }

    #[test]
    fn parse_database_response_errors_when_id_missing() {
        let value = json!({
            "title": [],
            "properties": {"Name": {"type": "title"}}
        });
        match parse_database_response(&value) {
            Err(NotionError::InvalidResponse) => {}
            other => panic!("expected InvalidResponse, got {other:?}"),
        }
    }

    #[test]
    fn parse_page_response_extracts_id_and_url() {
        let value = json!({
            "id": "page-id",
            "url": "https://www.notion.so/Page-page-id"
        });
        let page_ref = parse_page_response(&value).expect("ok");
        assert_eq!(page_ref.page_id, "page-id");
        assert_eq!(page_ref.url, "https://www.notion.so/Page-page-id");
    }

    #[test]
    fn parse_page_response_falls_back_when_url_missing() {
        let value = json!({"id": "11111111-2222-3333-4444-555555555555"});
        let page_ref = parse_page_response(&value).expect("ok");
        assert_eq!(page_ref.page_id, "11111111-2222-3333-4444-555555555555");
        assert_eq!(
            page_ref.url,
            "https://www.notion.so/11111111222233334444555555555555".to_string(),
        );
    }

    #[test]
    fn parse_page_response_errors_when_id_missing() {
        let value = json!({"url": "https://www.notion.so/Page"});
        match parse_page_response(&value) {
            Err(NotionError::InvalidResponse) => {}
            other => panic!("expected InvalidResponse, got {other:?}"),
        }
    }

    #[test]
    fn parse_page_response_sets_partial_false() {
        let value = json!({"id": "p", "url": "https://www.notion.so/p"});
        let page_ref = parse_page_response(&value).expect("ok");
        assert!(!page_ref.partial);
    }

    #[test]
    fn build_meta_callout_returns_none_for_empty_input() {
        assert!(build_meta_callout(&[]).is_none());
    }

    #[test]
    fn build_meta_callout_concatenates_fields_with_newlines() {
        let fields = vec![
            NotionMetaField {
                label: "録音日時".to_string(),
                value: "2026-05-21".to_string(),
            },
            NotionMetaField {
                label: "モデル".to_string(),
                value: "large-v3-turbo".to_string(),
            },
        ];
        let block = build_meta_callout(&fields).expect("some");
        assert_eq!(block["type"], "callout");
        let content = block["callout"]["rich_text"][0]["text"]["content"]
            .as_str()
            .expect("content");
        assert_eq!(content, "録音日時: 2026-05-21\nモデル: large-v3-turbo");
    }

    #[test]
    fn build_meta_callout_uses_clipboard_emoji() {
        let fields = vec![NotionMetaField {
            label: "x".to_string(),
            value: "y".to_string(),
        }];
        let block = build_meta_callout(&fields).expect("some");
        assert_eq!(block["callout"]["icon"]["type"], "emoji");
        assert_eq!(block["callout"]["icon"]["emoji"], META_CALLOUT_EMOJI);
    }

    #[test]
    fn build_meta_callout_truncates_when_combined_exceeds_block_limit() {
        let fields = vec![NotionMetaField {
            label: "L".to_string(),
            value: "x".repeat(MAX_BLOCK_CHARS + 100),
        }];
        let block = build_meta_callout(&fields).expect("some");
        let content = block["callout"]["rich_text"][0]["text"]["content"]
            .as_str()
            .expect("content");
        assert_eq!(content.chars().count(), MAX_BLOCK_CHARS);
    }

    #[test]
    fn build_summary_blocks_returns_empty_when_all_sections_empty() {
        let summary = NotionSummary::default();
        assert!(build_summary_blocks(&summary).is_empty());
    }

    #[test]
    fn build_summary_blocks_emits_heading1_for_headline() {
        let summary = NotionSummary {
            headline: "The Headline".to_string(),
            tldr: "lead".to_string(),
            labels: test_labels(),
            ..Default::default()
        };
        let blocks = build_summary_blocks(&summary);
        assert_eq!(blocks[0]["type"], "heading_1");
        assert_eq!(
            blocks[0]["heading_1"]["rich_text"][0]["text"]["content"],
            "The Headline"
        );
        assert_eq!(blocks[1]["type"], "heading_2");
    }

    #[test]
    fn build_summary_blocks_uses_localized_labels() {
        let summary = NotionSummary {
            tldr: "lead".to_string(),
            action_items: vec![NotionActionItem {
                what: "go".to_string(),
                due: Some("tomorrow".to_string()),
            }],
            labels: NotionSummaryLabels {
                tldr: "要点".to_string(),
                key_points: "重要トピック".to_string(),
                action_items: "アクションアイテム".to_string(),
                keywords: "キーワード".to_string(),
                due: "期日".to_string(),
            },
            ..Default::default()
        };
        let blocks = build_summary_blocks(&summary);
        assert_eq!(
            blocks[0]["heading_2"]["rich_text"][0]["text"]["content"],
            "要点"
        );
        assert_eq!(
            blocks[2]["heading_2"]["rich_text"][0]["text"]["content"],
            "アクションアイテム"
        );
        assert_eq!(
            blocks[3]["bulleted_list_item"]["rich_text"][0]["text"]["content"],
            "go (期日: tomorrow)"
        );
    }

    #[test]
    fn build_summary_blocks_renders_tldr_as_paragraph() {
        let summary = NotionSummary {
            tldr: "Short lead.".to_string(),
            labels: test_labels(),
            ..Default::default()
        };
        let blocks = build_summary_blocks(&summary);
        assert_eq!(blocks.len(), 2);
        assert_eq!(blocks[0]["type"], "heading_2");
        assert_eq!(
            blocks[0]["heading_2"]["rich_text"][0]["text"]["content"],
            "TL;DR"
        );
        assert_eq!(blocks[1]["type"], "paragraph");
        assert_eq!(
            blocks[1]["paragraph"]["rich_text"][0]["text"]["content"],
            "Short lead."
        );
    }

    #[test]
    fn build_summary_blocks_renders_keypoints_as_bulleted_list() {
        let summary = NotionSummary {
            key_points: vec!["a".to_string(), "b".to_string()],
            labels: test_labels(),
            ..Default::default()
        };
        let blocks = build_summary_blocks(&summary);
        assert_eq!(blocks.len(), 3);
        assert_eq!(
            blocks[0]["heading_2"]["rich_text"][0]["text"]["content"],
            "Key Points"
        );
        assert_eq!(blocks[1]["type"], "bulleted_list_item");
        assert_eq!(
            blocks[1]["bulleted_list_item"]["rich_text"][0]["text"]["content"],
            "a"
        );
        assert_eq!(
            blocks[2]["bulleted_list_item"]["rich_text"][0]["text"]["content"],
            "b"
        );
    }

    #[test]
    fn build_summary_blocks_renders_action_items_with_due_inline() {
        let summary = NotionSummary {
            action_items: vec![
                NotionActionItem {
                    what: "send report".to_string(),
                    due: Some("2026-06-01".to_string()),
                },
                NotionActionItem {
                    what: "follow up".to_string(),
                    due: None,
                },
            ],
            labels: test_labels(),
            ..Default::default()
        };
        let blocks = build_summary_blocks(&summary);
        assert_eq!(blocks.len(), 3);
        assert_eq!(
            blocks[0]["heading_2"]["rich_text"][0]["text"]["content"],
            "Action Items"
        );
        assert_eq!(
            blocks[1]["bulleted_list_item"]["rich_text"][0]["text"]["content"],
            "send report (due: 2026-06-01)"
        );
        assert_eq!(
            blocks[2]["bulleted_list_item"]["rich_text"][0]["text"]["content"],
            "follow up"
        );
    }

    #[test]
    fn build_summary_blocks_renders_keywords_as_comma_joined_paragraph() {
        let summary = NotionSummary {
            keywords: vec!["alpha".to_string(), "beta".to_string(), "gamma".to_string()],
            labels: test_labels(),
            ..Default::default()
        };
        let blocks = build_summary_blocks(&summary);
        assert_eq!(blocks.len(), 2);
        assert_eq!(
            blocks[0]["heading_2"]["rich_text"][0]["text"]["content"],
            "Keywords"
        );
        assert_eq!(
            blocks[1]["paragraph"]["rich_text"][0]["text"]["content"],
            "alpha, beta, gamma"
        );
    }

    #[test]
    fn build_summary_blocks_skips_empty_sections() {
        let summary = NotionSummary {
            headline: String::new(),
            tldr: "lead".to_string(),
            key_points: vec![],
            action_items: vec![],
            keywords: vec!["solo".to_string()],
            labels: test_labels(),
        };
        let blocks = build_summary_blocks(&summary);
        assert_eq!(blocks.len(), 4);
        assert_eq!(
            blocks[0]["heading_2"]["rich_text"][0]["text"]["content"],
            "TL;DR"
        );
        assert_eq!(
            blocks[2]["heading_2"]["rich_text"][0]["text"]["content"],
            "Keywords"
        );
    }

    #[test]
    fn build_divider_block_has_required_shape() {
        let block = build_divider_block();
        assert_eq!(block["object"], "block");
        assert_eq!(block["type"], "divider");
        assert!(block["divider"].is_object());
    }

    #[test]
    fn body_paragraph_blocks_drops_blank_lines() {
        // Blank lines between paragraphs render as empty Notion blocks the
        // user has to clean up by hand, so we collapse them away.
        let blocks = body_paragraph_blocks("a\n\nb");
        assert_eq!(blocks.len(), 2);
        assert_eq!(
            blocks[0]["paragraph"]["rich_text"][0]["text"]["content"],
            "a"
        );
        assert_eq!(
            blocks[1]["paragraph"]["rich_text"][0]["text"]["content"],
            "b"
        );
    }

    #[test]
    fn body_paragraph_blocks_does_not_truncate_long_input() {
        use std::fmt::Write;
        let text = (0..150).fold(String::new(), |mut acc, i| {
            let _ = writeln!(acc, "line{i}");
            acc
        });
        let blocks = body_paragraph_blocks(&text);
        assert!(blocks.len() > MAX_BLOCKS);
    }

    #[test]
    fn build_create_page_children_orders_meta_summary_divider_body() {
        let payload = NotionPagePayload {
            title: "T".to_string(),
            meta: vec![NotionMetaField {
                label: "M".to_string(),
                value: "v".to_string(),
            }],
            summary: Some(NotionSummary {
                tldr: "lead".to_string(),
                labels: test_labels(),
                ..Default::default()
            }),
            body_text: "body line".to_string(),
        };
        let children = build_create_page_children(&payload);
        assert_eq!(children[0]["type"], "callout");
        assert_eq!(children[1]["type"], "heading_2");
        assert_eq!(children[2]["type"], "paragraph");
        assert_eq!(children[3]["type"], "divider");
        assert_eq!(children[4]["type"], "paragraph");
        assert_eq!(
            children[4]["paragraph"]["rich_text"][0]["text"]["content"],
            "body line"
        );
    }

    #[test]
    fn build_create_page_children_omits_divider_when_no_body() {
        let payload = NotionPagePayload {
            title: "T".to_string(),
            meta: vec![NotionMetaField {
                label: "M".to_string(),
                value: "v".to_string(),
            }],
            body_text: String::new(),
            ..Default::default()
        };
        let children = build_create_page_children(&payload);
        assert!(children
            .iter()
            .all(|b| b["type"].as_str() != Some("divider")));
    }

    #[test]
    fn build_create_page_children_omits_divider_when_no_meta_or_summary() {
        let payload = NotionPagePayload {
            title: "T".to_string(),
            body_text: "body".to_string(),
            ..Default::default()
        };
        let children = build_create_page_children(&payload);
        assert!(children
            .iter()
            .all(|b| b["type"].as_str() != Some("divider")));
        assert_eq!(children[0]["type"], "paragraph");
    }

    #[test]
    fn split_children_for_create_returns_initial_only_when_under_100() {
        let children: Vec<Value> = (0..50).map(|_| paragraph_block("x")).collect();
        let (initial, rest) = split_children_for_create(children);
        assert_eq!(initial.len(), 50);
        assert!(rest.is_empty());
    }

    #[test]
    fn split_children_for_create_splits_at_100_for_101_blocks() {
        let children: Vec<Value> = (0..101).map(|_| paragraph_block("x")).collect();
        let (initial, rest) = split_children_for_create(children);
        assert_eq!(initial.len(), MAX_BLOCKS);
        assert_eq!(rest.len(), 1);
        assert_eq!(rest[0].len(), 1);
    }

    #[test]
    fn split_children_for_create_chunks_into_multiple_appendices() {
        let children: Vec<Value> = (0..250).map(|_| paragraph_block("x")).collect();
        let (initial, rest) = split_children_for_create(children);
        assert_eq!(initial.len(), MAX_BLOCKS);
        assert_eq!(rest.len(), 2);
        assert_eq!(rest[0].len(), MAX_BLOCKS);
        assert_eq!(rest[1].len(), 50);
    }
}
