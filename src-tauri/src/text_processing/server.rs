use std::path::Path;
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};

use super::error::TextProcessingError;
use super::models;

/// Server context window in tokens (`--ctx-size`). Sized so a worst-case
/// chunk (kanji-dense Japanese approaches ~1 token/char) plus the output
/// budget always fit — see the assertion next to
/// [`super::inference::MAX_OUTPUT_TOKENS`].
pub(crate) const SERVER_CTX_SIZE: usize = 8192;

/// Health check polling interval in milliseconds.
const HEALTH_CHECK_INTERVAL_MS: u64 = 1000;

/// Maximum health check wait time in seconds.
const HEALTH_CHECK_MAX_WAIT_SECS: u64 = 120;

/// Manages the llama-server subprocess lifecycle.
pub struct LlamaServerManager {
    child: Option<Child>,
    port: Option<u16>,
    model_id: Option<String>,
}

impl Default for LlamaServerManager {
    fn default() -> Self {
        Self::new()
    }
}

impl LlamaServerManager {
    /// Creates a new server manager in the stopped state.
    #[must_use]
    pub(crate) fn new() -> Self {
        Self {
            child: None,
            port: None,
            model_id: None,
        }
    }

    /// Returns whether the server is currently running.
    ///
    /// Checks the child process with `try_wait()` to detect crashes.
    /// If the process has exited, internal state is cleaned up automatically.
    #[must_use]
    pub(crate) fn is_running(&mut self) -> bool {
        let Some(ref mut child) = self.child else {
            return false;
        };
        match child.try_wait() {
            Ok(Some(_)) | Err(_) => {
                // Process exited or error checking — clean up
                self.child = None;
                self.port = None;
                self.model_id = None;
                false
            }
            Ok(None) => true, // Still running
        }
    }

    /// Returns the port the server is listening on, if running.
    #[must_use]
    pub(crate) fn port(&self) -> Option<u16> {
        self.port
    }

    /// Returns the model ID loaded on the server, if running.
    #[must_use]
    pub(crate) fn model_id(&self) -> Option<&str> {
        self.model_id.as_deref()
    }

    /// Starts the llama-server subprocess.
    ///
    /// # Errors
    ///
    /// Returns an error if the server binary is not found or fails to start.
    pub(crate) async fn start(
        &mut self,
        app_data_dir: &Path,
        model_id: &str,
    ) -> Result<u16, TextProcessingError> {
        // Stop existing server if running with a different model
        if self.is_running() {
            if self.model_id.as_deref() == Some(model_id) {
                return self.port.ok_or(TextProcessingError::ServerNotRunning);
            }
            self.stop().await?;
        }

        let server_path = models::llama_server_path(app_data_dir);
        if !server_path.exists() {
            return Err(TextProcessingError::ServerStartFailed(
                "llama-server binary not found. Please download it first.".to_string(),
            ));
        }

        let model_path = models::text_model_path(app_data_dir, model_id)
            .ok_or_else(|| TextProcessingError::ModelNotFound(model_id.to_string()))?;
        if !model_path.exists() {
            return Err(TextProcessingError::ModelNotFound(model_id.to_string()));
        }

        // Find a free port
        let port = find_free_port()?;

        // Spawn llama-server subprocess
        // --jinja + --chat-template-kwargs: disables Qwen3.5 thinking mode
        // (ignored by models that don't use enable_thinking in their template)
        let mut child = Command::new(&server_path)
            .args([
                // Passed explicitly rather than relying on llama.cpp's default:
                // it also honours `LLAMA_ARG_HOST`, so an inherited environment
                // could otherwise publish the server on every interface.
                "--host",
                "127.0.0.1",
                "--port",
                &port.to_string(),
                "--model",
                &model_path.to_string_lossy(),
                "--ctx-size",
                &SERVER_CTX_SIZE.to_string(),
                "--threads",
                &num_threads().to_string(),
                "--jinja",
                "--chat-template-kwargs",
                r#"{"enable_thinking":false}"#,
            ])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::piped())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| {
                TextProcessingError::ServerStartFailed(format!("Failed to spawn server: {e}"))
            })?;

        // Drain stderr to log for debugging server crashes
        if let Some(stderr) = child.stderr.take() {
            tokio::spawn(async move {
                let reader = BufReader::new(stderr);
                let mut lines = reader.lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    eprintln!("[llama-server] {line}");
                }
            });
        }

        // Wait for health check before publishing the server as usable. On
        // failure the child is killed here — leaving it in `self.child` would
        // keep a multi-GB process alive that `is_running` reports as healthy.
        if let Err(e) = wait_for_health(port, &mut child).await {
            let _ = child.kill().await;
            let _ = child.wait().await;
            return Err(e);
        }

        self.child = Some(child);
        self.port = Some(port);
        self.model_id = Some(model_id.to_string());

        Ok(port)
    }

    /// Stops the server subprocess.
    ///
    /// # Errors
    ///
    /// Returns an error if the process cannot be killed.
    pub(crate) async fn stop(&mut self) -> Result<(), TextProcessingError> {
        if let Some(mut child) = self.child.take() {
            child.kill().await.map_err(TextProcessingError::from)?;
            let _ = child.wait().await;
        }
        self.port = None;
        self.model_id = None;
        Ok(())
    }

    /// Stops the server, ignoring any errors (for app shutdown).
    pub(crate) async fn shutdown(&mut self) {
        let _ = self.stop().await;
    }
}

/// Finds a free TCP port by binding to port 0.
fn find_free_port() -> Result<u16, TextProcessingError> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").map_err(|e| {
        TextProcessingError::ServerStartFailed(format!("Port allocation failed: {e}"))
    })?;
    let port = listener
        .local_addr()
        .map_err(|e| TextProcessingError::ServerStartFailed(format!("Port address failed: {e}")))?
        .port();
    Ok(port)
}

/// Returns the number of threads to use for inference.
fn num_threads() -> usize {
    std::thread::available_parallelism().map_or(4, |n| n.get().min(8))
}

/// Polls the server health endpoint until the model is fully loaded or times out.
///
/// The llama-server `/health` endpoint returns `{"status":"ok"}` when ready
/// and may return `{"status":"loading model"}` while still loading.
async fn wait_for_health(
    port: u16,
    child: &mut tokio::process::Child,
) -> Result<(), TextProcessingError> {
    let url = format!("http://127.0.0.1:{port}/health");
    let client = reqwest::Client::new();
    let max_attempts = (HEALTH_CHECK_MAX_WAIT_SECS * 1000) / HEALTH_CHECK_INTERVAL_MS;

    for _ in 0..max_attempts {
        tokio::time::sleep(Duration::from_millis(HEALTH_CHECK_INTERVAL_MS)).await;

        // A crashed server (missing shared library, corrupt model, port already
        // taken) would otherwise just fail every probe, making the user wait out
        // the full timeout for a misleading "timed out" message.
        if let Ok(Some(status)) = child.try_wait() {
            return Err(TextProcessingError::ServerStartFailed(format!(
                "Server exited during startup ({status})"
            )));
        }

        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                // Verify response body confirms model is loaded. A success
                // status alone is not enough: the port may belong to an
                // unrelated local service, and answering inference requests to
                // it would fail far more confusingly than a startup error.
                if let Ok(body) = resp.text().await {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                        if json.get("status").and_then(|s| s.as_str()) == Some("ok") {
                            return Ok(());
                        }
                    }
                }
                // "loading model", a non-JSON body, or a foreign service —
                // keep polling until the timeout.
            }
        }
    }

    Err(TextProcessingError::ServerStartFailed(format!(
        "Health check timed out after {HEALTH_CHECK_MAX_WAIT_SECS} seconds"
    )))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_manager_is_not_running() {
        let mut manager = LlamaServerManager::new();
        assert!(!manager.is_running());
    }

    #[test]
    fn new_manager_port_is_none() {
        let manager = LlamaServerManager::new();
        assert!(manager.port().is_none());
    }

    #[test]
    fn new_manager_model_id_is_none() {
        let manager = LlamaServerManager::new();
        assert!(manager.model_id().is_none());
    }

    #[test]
    #[ignore = "requires network socket binding"]
    fn find_free_port_returns_nonzero() {
        let port = find_free_port().expect("should find free port");
        assert!(port > 0);
    }

    #[test]
    #[ignore = "requires network socket binding"]
    fn find_free_port_returns_different_ports() {
        let port1 = find_free_port().expect("port 1");
        let port2 = find_free_port().expect("port 2");
        assert!(port1 > 0);
        assert!(port2 > 0);
    }

    #[test]
    fn num_threads_returns_reasonable_value() {
        let threads = num_threads();
        assert!(threads >= 1);
        assert!(threads <= 8);
    }
}
