/// Prevents the system from sleeping while a recording is in progress.
///
/// On macOS, spawns a `caffeinate -d` process that inhibits display sleep.
/// On other platforms, this is a no-op.
pub struct SleepGuard {
    #[cfg(target_os = "macos")]
    process: Option<std::process::Child>,
}

impl SleepGuard {
    /// Acquires a sleep prevention guard.
    ///
    /// On macOS, spawns `caffeinate -d` to prevent display sleep.
    /// On other platforms, returns immediately with a no-op guard.
    #[must_use]
    pub fn acquire() -> Self {
        #[cfg(target_os = "macos")]
        {
            match std::process::Command::new("caffeinate").arg("-d").spawn() {
                Ok(child) => Self {
                    process: Some(child),
                },
                Err(e) => {
                    eprintln!("Warning: failed to spawn caffeinate: {e}");
                    Self { process: None }
                }
            }
        }

        #[cfg(not(target_os = "macos"))]
        {
            Self {}
        }
    }

    /// Releases the sleep prevention guard.
    ///
    /// On macOS, kills the `caffeinate` process if it is still running.
    pub fn release(&mut self) {
        #[cfg(target_os = "macos")]
        if let Some(ref mut child) = self.process {
            if let Err(e) = child.kill() {
                eprintln!("Warning: failed to kill caffeinate process: {e}");
            }
            // Reap the child process to avoid zombies
            let _ = child.wait();
            self.process = None;
        }
    }
}

impl Drop for SleepGuard {
    fn drop(&mut self) {
        self.release();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn acquire_and_release_does_not_panic() {
        let mut guard = SleepGuard::acquire();
        guard.release();
    }

    #[test]
    fn double_release_does_not_panic() {
        let mut guard = SleepGuard::acquire();
        guard.release();
        guard.release();
    }

    #[test]
    fn drop_does_not_panic() {
        let _guard = SleepGuard::acquire();
        // Guard is dropped here
    }
}
