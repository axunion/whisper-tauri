use serde_json::Value;

const RELEASES_LATEST_URL: &str =
    "https://api.github.com/repos/axunion/whisper-tauri/releases/latest";
const REQUEST_TIMEOUT_SECS: u64 = 10;

#[derive(Debug, thiserror::Error)]
pub enum UpdateError {
    #[error("HTTP error: {0}")]
    Http(String),
    #[error("Invalid response from GitHub API")]
    InvalidResponse,
}

impl From<reqwest::Error> for UpdateError {
    fn from(err: reqwest::Error) -> Self {
        Self::Http(err.to_string())
    }
}

impl From<UpdateError> for String {
    fn from(err: UpdateError) -> Self {
        err.to_string()
    }
}

fn parse_tag_name(body: &Value) -> Result<String, UpdateError> {
    body.get("tag_name")
        .and_then(Value::as_str)
        .filter(|tag| !tag.is_empty())
        .map(str::to_string)
        .ok_or(UpdateError::InvalidResponse)
}

/// Fetch the latest release tag (e.g. "v0.2.0") from the GitHub Releases API.
///
/// User-initiated only — never called automatically, per the privacy
/// principle that network access is limited to model downloads and
/// explicit user actions.
///
/// # Errors
///
/// Returns an error string when the request fails (offline, timeout,
/// non-2xx status) or the response has no usable `tag_name`.
#[tauri::command]
pub async fn check_latest_version() -> Result<String, String> {
    let client = reqwest::Client::builder()
        // GitHub API rejects requests without a User-Agent (403)
        .user_agent(concat!("whisper-tauri/", env!("CARGO_PKG_VERSION")))
        .timeout(std::time::Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(UpdateError::from)?;

    let response = client
        .get(RELEASES_LATEST_URL)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(UpdateError::from)?;

    let status = response.status();
    if !status.is_success() {
        return Err(UpdateError::Http(format!("status {}", status.as_u16())).into());
    }

    let body: Value = response.json().await.map_err(UpdateError::from)?;
    parse_tag_name(&body).map_err(Into::into)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn http_display() {
        let err = UpdateError::Http("connection refused".to_string());
        assert_eq!(err.to_string(), "HTTP error: connection refused");
    }

    #[test]
    fn invalid_response_display() {
        let err = UpdateError::InvalidResponse;
        assert_eq!(err.to_string(), "Invalid response from GitHub API");
    }

    #[test]
    fn converts_to_string() {
        let err = UpdateError::Http("status 404".to_string());
        let s: String = err.into();
        assert_eq!(s, "HTTP error: status 404");
    }

    #[test]
    fn parse_tag_name_returns_tag() {
        let body = json!({ "tag_name": "v0.2.0", "html_url": "ignored" });
        assert_eq!(parse_tag_name(&body).unwrap(), "v0.2.0");
    }

    #[test]
    fn parse_tag_name_rejects_missing_field() {
        let body = json!({ "message": "Not Found" });
        assert!(matches!(
            parse_tag_name(&body),
            Err(UpdateError::InvalidResponse)
        ));
    }

    #[test]
    fn parse_tag_name_rejects_non_string_tag() {
        let body = json!({ "tag_name": 123 });
        assert!(matches!(
            parse_tag_name(&body),
            Err(UpdateError::InvalidResponse)
        ));
    }

    #[test]
    fn parse_tag_name_rejects_empty_tag() {
        let body = json!({ "tag_name": "" });
        assert!(matches!(
            parse_tag_name(&body),
            Err(UpdateError::InvalidResponse)
        ));
    }
}
