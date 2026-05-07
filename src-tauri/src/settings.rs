use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const SETTINGS_STORE: &str = "settings.json";

/// Errors that can occur during settings store access.
#[derive(Debug, thiserror::Error)]
pub enum SettingsError {
    /// A store operation failed.
    #[error("Store error: {0}")]
    Store(String),
}

impl From<SettingsError> for String {
    fn from(err: SettingsError) -> Self {
        err.to_string()
    }
}

/// Reads a string value from the settings store.
///
/// Returns `Ok(None)` if the key is missing or the value is not a string.
///
/// # Errors
///
/// Returns [`SettingsError::Store`] if the store cannot be opened.
pub fn get_string(app: &AppHandle, key: &str) -> Result<Option<String>, SettingsError> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| SettingsError::Store(e.to_string()))?;
    let value = store
        .get(key)
        .and_then(|v| v.as_str().map(std::string::ToString::to_string));
    Ok(value)
}

/// Sets or deletes a string value in the settings store.
///
/// Passing `Some(value)` writes the string; passing `None` removes the key.
///
/// # Errors
///
/// Returns [`SettingsError::Store`] if the store cannot be opened.
pub fn set_or_delete_string(
    app: &AppHandle,
    key: &str,
    value: Option<String>,
) -> Result<(), SettingsError> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| SettingsError::Store(e.to_string()))?;
    match value {
        Some(v) => store.set(key, serde_json::Value::String(v)),
        None => {
            store.delete(key);
        }
    }
    Ok(())
}

/// Reads multiple string values from the settings store with a single open.
///
/// Returns a vector aligned to `keys` where each entry is `Some` if the key
/// exists and is a string, otherwise `None`.
///
/// # Errors
///
/// Returns [`SettingsError::Store`] if the store cannot be opened.
pub fn get_strings(app: &AppHandle, keys: &[&str]) -> Result<Vec<Option<String>>, SettingsError> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| SettingsError::Store(e.to_string()))?;
    Ok(keys
        .iter()
        .map(|k| {
            store
                .get(*k)
                .and_then(|v| v.as_str().map(std::string::ToString::to_string))
        })
        .collect())
}

/// Sets or deletes multiple string values in the settings store with a single open.
///
/// For each entry, `Some` writes the string and `None` removes the key.
///
/// # Errors
///
/// Returns [`SettingsError::Store`] if the store cannot be opened.
pub fn set_or_delete_strings(
    app: &AppHandle,
    entries: &[(&str, Option<String>)],
) -> Result<(), SettingsError> {
    let store = app
        .store(SETTINGS_STORE)
        .map_err(|e| SettingsError::Store(e.to_string()))?;
    for (key, value) in entries {
        match value {
            Some(v) => store.set(*key, serde_json::Value::String(v.clone())),
            None => {
                store.delete(*key);
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_error_display() {
        let err = SettingsError::Store("locked".to_string());
        assert_eq!(err.to_string(), "Store error: locked");
    }

    #[test]
    fn settings_error_converts_to_string() {
        let err = SettingsError::Store("locked".to_string());
        let s: String = err.into();
        assert_eq!(s, "Store error: locked");
    }
}
