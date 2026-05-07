use serde_json::{json, Value};

use super::error::NotionError;
use super::types::{NotionDatabaseInfo, NotionPagePayload, NotionPageRef};

const NOTION_BASE_URL: &str = "https://api.notion.com/v1";
const NOTION_VERSION: &str = "2022-06-28";

const MAX_BLOCKS: usize = 100;
const MAX_BLOCK_CHARS: usize = 2000;
const MAX_TITLE_CHARS: usize = 2000;
const TRUNCATION_MARKER: &str = "…(truncated)";

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

/// Splits text into Notion paragraph block contents.
///
/// Each newline becomes a new paragraph; lines longer than the per-block
/// character limit are split into multiple consecutive paragraphs. The total
/// number of paragraphs is capped to satisfy Notion's children-array limit;
/// excess content is replaced by a truncation marker.
#[must_use]
pub fn split_into_blocks(text: &str) -> Vec<String> {
    let mut blocks: Vec<String> = Vec::new();
    if text.is_empty() {
        return blocks;
    }
    for line in text.split('\n') {
        if line.is_empty() {
            blocks.push(String::new());
            continue;
        }
        for chunk in chunk_string(line, MAX_BLOCK_CHARS) {
            blocks.push(chunk);
        }
    }
    if blocks.len() > MAX_BLOCKS {
        blocks.truncate(MAX_BLOCKS - 1);
        blocks.push(TRUNCATION_MARKER.to_string());
    }
    blocks
}

#[must_use]
pub fn build_create_page_body(
    database_id: &str,
    title_property: &str,
    payload: &NotionPagePayload,
) -> Value {
    let title = truncate_chars(&payload.title, MAX_TITLE_CHARS);
    let blocks = split_into_blocks(&payload.body_text);

    let children: Vec<Value> = blocks
        .into_iter()
        .map(|block_text| {
            let rich_text = if block_text.is_empty() {
                json!([])
            } else {
                json!([{"type": "text", "text": {"content": block_text}}])
            };
            json!({
                "object": "block",
                "type": "paragraph",
                "paragraph": {"rich_text": rich_text}
            })
        })
        .collect();

    json!({
        "parent": {"database_id": database_id},
        "properties": {
            title_property: {
                "title": [{"type": "text", "text": {"content": title}}]
            }
        },
        "children": children,
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
    Ok(NotionPageRef { page_id, url })
}

async fn execute_request(req: reqwest::RequestBuilder) -> Result<Value, NotionError> {
    let response = req.send().await?;
    let status = response.status();
    let text = response.text().await.map_err(NotionError::from)?;
    let body = serde_json::from_str::<Value>(&text).unwrap_or(Value::Null);
    if !status.is_success() {
        let message = body.get("message").and_then(Value::as_str).map_or_else(
            || {
                if text.is_empty() {
                    format!("HTTP {status}")
                } else {
                    text.clone()
                }
            },
            String::from,
        );
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

/// Creates a new page in the configured database.
///
/// # Errors
///
/// Returns a [`NotionError`] when the HTTP request fails, the API returns a
/// non-2xx status, or the response cannot be parsed.
pub async fn create_page(
    token: &str,
    database_id: &str,
    title_property: &str,
    payload: &NotionPagePayload,
) -> Result<NotionPageRef, NotionError> {
    let client = build_client()?;
    let body = build_create_page_body(database_id, title_property, payload);
    let req = client
        .post(format!("{NOTION_BASE_URL}/pages"))
        .bearer_auth(token)
        .header("Notion-Version", NOTION_VERSION)
        .json(&body);
    let response_body = execute_request(req).await?;
    parse_page_response(&response_body)
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn split_into_blocks_preserves_blank_lines() {
        let text = "line1\n\nline3";
        let blocks = split_into_blocks(text);
        assert_eq!(blocks, vec!["line1", "", "line3"]);
    }

    #[test]
    fn split_into_blocks_handles_empty_text() {
        assert!(split_into_blocks("").is_empty());
    }

    #[test]
    fn split_into_blocks_caps_at_max_blocks() {
        use std::fmt::Write;
        let text = (0..150).fold(String::new(), |mut acc, i| {
            let _ = writeln!(acc, "line{i}");
            acc
        });
        let blocks = split_into_blocks(&text);
        assert_eq!(blocks.len(), MAX_BLOCKS);
        assert_eq!(blocks.last().map(String::as_str), Some(TRUNCATION_MARKER));
    }

    #[test]
    fn split_into_blocks_subdivides_oversized_lines() {
        let long_line: String = "y".repeat(MAX_BLOCK_CHARS * 2 + 5);
        let blocks = split_into_blocks(&long_line);
        assert_eq!(blocks.len(), 3);
        assert_eq!(blocks[0].chars().count(), MAX_BLOCK_CHARS);
        assert_eq!(blocks[1].chars().count(), MAX_BLOCK_CHARS);
        assert_eq!(blocks[2].chars().count(), 5);
    }

    #[test]
    fn build_create_page_body_has_required_shape() {
        let payload = NotionPagePayload {
            title: "Hello".to_string(),
            body_text: "first\nsecond".to_string(),
        };
        let body = build_create_page_body("db-id", "Name", &payload);
        assert_eq!(body["parent"]["database_id"], "db-id");
        assert_eq!(
            body["properties"]["Name"]["title"][0]["text"]["content"],
            "Hello"
        );
        let children = body["children"].as_array().expect("children");
        assert_eq!(children.len(), 2);
        assert_eq!(children[0]["type"], "paragraph");
        assert_eq!(
            children[0]["paragraph"]["rich_text"][0]["text"]["content"],
            "first"
        );
    }

    #[test]
    fn build_create_page_body_uses_empty_rich_text_for_blank_lines() {
        let payload = NotionPagePayload {
            title: "T".to_string(),
            body_text: "a\n\nb".to_string(),
        };
        let body = build_create_page_body("db", "Name", &payload);
        let children = body["children"].as_array().expect("children");
        assert_eq!(children.len(), 3);
        assert!(children[1]["paragraph"]["rich_text"]
            .as_array()
            .expect("rich_text array")
            .is_empty());
    }

    #[test]
    fn build_create_page_body_truncates_long_title() {
        let payload = NotionPagePayload {
            title: "x".repeat(MAX_TITLE_CHARS + 100),
            body_text: String::new(),
        };
        let body = build_create_page_body("db", "Name", &payload);
        let title = body["properties"]["Name"]["title"][0]["text"]["content"]
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
}
