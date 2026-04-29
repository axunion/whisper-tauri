# Installation Guide

## macOS (Apple Silicon)

1. Download the latest `Whisper-Tauri-aarch64.zip` from the [Releases](../../../releases) page.
2. Double-click the zip to extract — a `Whisper Tauri Installer` folder appears.
3. Open the folder and double-click `Install.command`.
4. When prompted "Are you sure you want to open `Install.command`?", click **Open**.
5. A Terminal window opens, runs the installer, and Whisper Tauri launches automatically from `/Applications`.

You may delete the downloaded zip and the extracted folder after installation completes.

### If `Install.command` Is Blocked

macOS may block the script depending on security settings:

1. Open **System Settings** → **Privacy & Security**.
2. Near the bottom, find "`Install.command` was blocked..." and click **Open Anyway**.
3. Authenticate with password or Touch ID.

### About `.app` Direct-Launch Warnings

If you launch the `.app` directly without `Install.command`, macOS Gatekeeper shows a "cannot be opened because it is damaged" warning. This is normal for unsigned apps. Always use `Install.command`.

## Windows / Linux

Download the platform-appropriate installer (`.msi` / `.exe` / `.AppImage` / `.deb`) from the [Releases](../../../releases) page and run it.

## Uninstall (macOS)

```bash
rm -rf "/Applications/Whisper Tauri.app"
rm -rf "$HOME/Library/Application Support/com.whisper-tauri.desktop"
rm -rf "$HOME/Library/Caches/com.whisper-tauri.desktop"
```
