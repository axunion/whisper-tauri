---
title: Installation Guide
---

## macOS (Apple Silicon)

1. Download the latest `Whisper-Tauri-aarch64.zip` from the [Releases](https://github.com/axunion/whisper-tauri/releases) page.
2. Double-click the zip to extract — a `Whisper Tauri Installer` folder appears.
3. Open the folder and double-click `Install.command`. macOS shows a warning that it could not verify the file — click **Done** (not "Move to Trash").
4. Open **System Settings** → **Privacy & Security**, scroll to the bottom, find "`Install.command` was blocked...", and click **Open Anyway**.
5. Authenticate with password or Touch ID, then confirm **Open**.
6. A Terminal window opens, runs the installer, and Whisper Tauri launches automatically from `/Applications`. The installed app never shows this warning again.

You may delete the downloaded zip and the extracted folder after installation completes.

### Why This Warning Appears

Pre-release builds are not signed with an Apple Developer certificate, so macOS cannot verify the publisher and blocks the first launch. This is expected and does not indicate a problem with the app itself. The approval applies to the downloaded copy of `Install.command`, so installing a future update (a new download) will ask for the same one-time approval again.

### On macOS 14 Sonoma and Earlier

The approval is simpler on older versions:

- **macOS 13–14**: Control-click (right-click) `Install.command`, choose **Open**, then click **Open** in the dialog. This shortcut was removed in macOS 15 Sequoia.
- **macOS 12 and earlier**: the equivalent settings pane is **System Preferences** → **Security & Privacy** → **General**, with the same **Open Anyway** button.

### If You Launch the `.app` Directly

`Install.command` is the recommended path. If you instead copy `Whisper Tauri.app` somewhere and launch it directly, macOS shows the same "could not verify" warning — approve it the same way via **System Settings** → **Privacy & Security** → **Open Anyway**.

## Windows

1. Download the latest `Whisper Tauri_<version>_x64-setup.exe` from the [Releases](https://github.com/axunion/whisper-tauri/releases) page.
2. Double-click to run.
3. Windows Defender SmartScreen will likely warn "Microsoft Defender SmartScreen prevented an unrecognized app from starting." This is expected — the build is unsigned. Click **More info** → **Run anyway**.
4. Follow the installer prompts to complete installation.
5. Launch Whisper Tauri from the Start menu.

## Linux

Two formats are provided. Use whichever fits your distribution.

### Debian / Ubuntu (`.deb`)

```bash
sudo dpkg -i whisper-tauri_<version>_amd64.deb
sudo apt-get install -f   # resolve any missing dependencies
```

Whisper Tauri appears in the application menu after install.

### Other distributions (`.AppImage`)

The AppImage requires no system installation.

```bash
chmod +x whisper-tauri_<version>_amd64.AppImage
./whisper-tauri_<version>_amd64.AppImage
```

If your distribution does not provide GLib/GTK/WebKit2GTK runtimes, install them via your package manager (Tauri 2 targets `webkit2gtk-4.1`).

## Updating

Updating is simply installing the new version over the old one — no uninstall needed.

- **macOS**: download the new zip and run `Install.command` again. It replaces the app in `/Applications`. macOS asks you to approve the newly downloaded script once, with the same steps as the first install.
- **Windows**: run the new `Whisper Tauri_<version>_x64-setup.exe`. It installs over the existing version.
- **Linux**: install the new `.deb` with `sudo dpkg -i`, or replace the old `.AppImage` file with the new one.

Your settings, history, and downloaded models live in a separate data directory (see [Uninstall](#uninstall) for paths) and are never touched by an update.

New versions are published on the [Releases](https://github.com/axunion/whisper-tauri/releases) page. You can also check from within the app: **Settings** → **App Updates** → **Check for Updates**. To get notified automatically, use GitHub **Watch** → **Custom** → **Releases** on the repository, or subscribe to the [releases.atom](https://github.com/axunion/whisper-tauri/releases.atom) feed with any RSS reader.

## Uninstall

### macOS

```bash
rm -rf "/Applications/Whisper Tauri.app"
rm -rf "$HOME/Library/Application Support/com.whisper-tauri.desktop"
rm -rf "$HOME/Library/Caches/com.whisper-tauri.desktop"
```

### Windows

Use **Settings** → **Apps** → search "Whisper Tauri" → **Uninstall**.

Application data and cached models are stored at:

```
%APPDATA%\com.whisper-tauri.desktop
%LOCALAPPDATA%\com.whisper-tauri.desktop
```

Remove these folders manually if you want a clean uninstall.

### Linux

For `.deb` installs:

```bash
sudo apt-get remove whisper-tauri
```

For `.AppImage`, simply delete the file.

Application data and cached models are stored at:

```
~/.local/share/com.whisper-tauri.desktop
~/.cache/com.whisper-tauri.desktop
```
