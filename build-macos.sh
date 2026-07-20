#!/bin/bash
set -e

cd "$(dirname "$0")/client"

echo "==> Installing frontend dependencies..."
npm ci

echo "==> Building Tauri app for macOS..."
npx tauri build 2>&1

APP=$(find src-tauri/target/release/bundle/macos -name "*.app" -maxdepth 1 | head -1)

if [ -z "$APP" ]; then
  echo "ERROR: No .app bundle found in src-tauri/target/release/bundle/macos/"
  exit 1
fi

echo "==> Closing existing JediNotebook if running..."
osascript -e 'quit app "JediNotebook"' 2>/dev/null || true
sleep 1

echo "==> Installing $APP to /Applications..."
rm -rf "/Applications/$(basename "$APP")"
cp -R "$APP" /Applications/

echo "==> Launching JediNotebook..."
open "/Applications/$(basename "$APP")"

echo "Done."
