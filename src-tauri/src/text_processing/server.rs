use std::path::Path;
use std::time::{Duration, Instant};

use tokio::process::{Child, Command};

use super::error::TextProcessingError;
use super::models;

/// Default idle timeout in seconds.
const DEFAULT_IDLE_TIMEOUT_SECS: u64 = 300;

/// Health check polling interval in milliseconds.
const HEALTH_CHECK_INTERVAL_MS: u64 = 1000;

/// Maximum health check wait time in seconds.
const HEALTH_CHECK_MAX_WAIT_SECS: u64 = 30;

/// Manages the llama-server subprocess lifecycle.
pub struct LlamaServerManager {
    child: Option<Child>,
    port: Option<u16>,
    model_id: Option<String>,
    last_activity: Option<Instant>,
    idle_timeout: Duration,
}

impl Default for LlamaServerManager {
    fn default() -> Self {
        Self::new()
    }
}

impl LlamaServerManager {
    /// Creates a new server manager in the stopped state.
    #[must_use]
    pub fn new() -> Self {
        Self {
            child: None,
            port: None,
            model_id: None,
            last_activity: None,
            idle_timeout: Duration::from_secs(DEFAULT_IDLE_TIMEOUT_SECS),
        }
    }

    /// Returns whether the server is currently running.
    #[must_use]
    pub fn is_running(&self) -> bool {
        self.child.is_some()
    }

    /// Returns the port the server is listening on, if running.
    #[must_use]
    pub fn port(&self) -> Option<u16> {
        self.port
    }

    /// Returns the model ID loaded on the server, if running.
    #[must_use]
    pub fn model_id(&self) -> Option<&str> {
        self.model_id.as_deref()
    }

    /// Updates the last activity timestamp.
    pub fn touch_activity(&mut self) {
        self.last_activity = Some(Instant::now());
    }

    /// Returns whether the server should be stopped due to idle timeout.
    #[must_use]
    pub fn should_idle_stop(&self) -> bool {
        if !self.is_running() {
            return false;
        }
        self.last_activity
            .is_some_and(|t| t.elapsed() >= self.idle_timeout)
    }

    /// Starts the llama-server subprocess.
    ///
    /// # Errors
    ///
    /// Returns an error if the server binary is not found or fails to start.
    pub async fn start(
        &mut self,
        app_data_dir: &Path,
        model_id: &str,
        idle_timeout_secs: Option<u64>,
    ) -> Result<u16, TextProcessingError> {
        // Stop existing server if running with a different model
        if self.is_running() {
            if self.model_id.as_deref() == Some(model_id) {
                self.touch_activity();
                return self.port.ok_or(TextProcessingError::ServerNotRunning);
            }
            self.stop().await?;
        }

        if let Some(timeout) = idle_timeout_secs {
            self.idle_timeout = Duration::from_secs(timeout);
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
        let child = Command::new(&server_path)
            .args([
                "--port",
                &port.to_string(),
                "--model",
                &model_path.to_string_lossy(),
                "--ctx-size",
                "4096",
                "--threads",
                &num_threads().to_string(),
            ])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .kill_on_drop(true)
            .spawn()
            .map_err(|e| {
                TextProcessingError::ServerStartFailed(format!("Failed to spawn server: {e}"))
            })?;

        self.child = Some(child);
        self.port = Some(port);
        self.model_id = Some(model_id.to_string());
        self.touch_activity();

        // Wait for health check
        wait_for_health(port).await?;

        Ok(port)
    }

    /// Stops the server subprocess.
    ///
    /// # Errors
    ///
    /// Returns an error if the process cannot be killed.
    pub async fn stop(&mut self) -> Result<(), TextProcessingError> {
        if let Some(mut child) = self.child.take() {
            child.kill().await.map_err(TextProcessingError::from)?;
            let _ = child.wait().await;
        }
        self.port = None;
        self.model_id = None;
        self.last_activity = None;
        Ok(())
    }

    /// Stops the server, ignoring any errors (for app shutdown).
    pub async fn shutdown(&mut self) {
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

/// Polls the server health endpoint until it responds or times out.
async fn wait_for_health(port: u16) -> Result<(), TextProcessingError> {
    let url = format!("http://127.0.0.1:{port}/health");
    let client = reqwest::Client::new();
    let max_attempts = (HEALTH_CHECK_MAX_WAIT_SECS * 1000) / HEALTH_CHECK_INTERVAL_MS;

    for _ in 0..max_attempts {
        tokio::time::sleep(Duration::from_millis(HEALTH_CHECK_INTERVAL_MS)).await;
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                return Ok(());
            }
        }
    }

    Err(TextProcessingError::ServerStartFailed(
        "Health check timed out after 30 seconds".to_string(),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_manager_is_not_running() {
        let manager = LlamaServerManager::new();
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
    fn should_idle_stop_false_when_not_running() {
        let manager = LlamaServerManager::new();
        assert!(!manager.should_idle_stop());
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
