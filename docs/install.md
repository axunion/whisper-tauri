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

## Windows

1. Download the latest `Whisper Tauri_<version>_x64-setup.exe` from the [Releases](../../../releases) page.
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

- **macOS**: download the new zip and run `Install.command` again. It replaces the app in `/Applications`.
- **Windows**: run the new `Whisper Tauri_<version>_x64-setup.exe`. It installs over the existing version.
- **Linux**: install the new `.deb` with `sudo dpkg -i`, or replace the old `.AppImage` file with the new one.

Your settings, history, and downloaded models live in a separate data directory (see [Uninstall](#uninstall) for paths) and are never touched by an update.

New versions are published on the [Releases](../../../releases) page. You can also check from within the app: **Settings** → **App Updates** → **Check for Updates**. To get notified automatically, use GitHub **Watch** → **Custom** → **Releases** on the repository, or subscribe to the [releases.atom](../../../releases.atom) feed with any RSS reader.

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
