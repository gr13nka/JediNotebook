#!/bin/bash
set -e

cd "$(dirname "$0")/client"

echo "==> Installing frontend dependencies..."
npm ci

echo "==> Building Tauri Android APK (debug)..."
npx tauri android build --apk 2>&1

APK="src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk"

if [ ! -f "$APK" ]; then
  echo "ERROR: APK not found at $APK"
  exit 1
fi

if ! command -v adb &>/dev/null; then
  echo "ERROR: adb not found on PATH. Install Android SDK platform-tools."
  exit 1
fi

if [ "$(adb devices | grep -c 'device$')" -eq 0 ]; then
  echo "ERROR: No Android device connected. Connect a phone via USB and enable USB debugging."
  exit 1
fi

PACKAGE="com.webtimer.app"

echo "==> Uninstalling existing $PACKAGE if present..."
adb uninstall "$PACKAGE" 2>/dev/null || true

echo "==> Installing $APK..."
adb install "$APK"

echo "==> Launching $PACKAGE..."
adb shell am start -n "$PACKAGE/.MainActivity"

echo "Done."
