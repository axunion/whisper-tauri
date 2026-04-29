#!/bin/bash
# Whisper Tauri installer.
# Copies the bundled .app to /Applications (stripping quarantine) and launches it.

set -e

APP="Whisper Tauri.app"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
DST="/Applications/$APP"

# Detect language from macOS system preference.
LANG_FIRST=$(defaults read -g AppleLanguages 2>/dev/null | sed -n 2p | tr -d ' ",' || true)
case "$LANG_FIRST" in
    ja*) JA=1 ;;
    *)   JA=0 ;;
esac

m() {
    if [ "$JA" = "1" ]; then echo "$1"; else echo "$2"; fi
}

m "Whisper Tauri をインストールしています..." "Installing Whisper Tauri..."

if [ ! -d "$SRC_DIR/$APP" ]; then
    m "エラー: $APP が見つかりません。" "Error: $APP not found alongside this script."
    sleep 3
    exit 1
fi

if [ -d "$DST" ]; then
    m "既存バージョンを削除しています..." "Removing existing version..."
    rm -rf "$DST"
fi

m "/Applications にコピーしています..." "Copying to /Applications..."
ditto --noqtn "$SRC_DIR/$APP" "$DST"

m "Whisper Tauri を起動します..." "Launching Whisper Tauri..."
open "$DST"

m "インストールが完了しました。" "Installation complete."

sleep 2
exit 0
