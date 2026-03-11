#!/bin/bash
set -e

cd "$(dirname "$0")/client"

echo "==> Installing frontend dependencies..."
npm ci

echo "==> Building Tauri Android APK (debug)..."
npx tauri android build --apk --debug 2>&1

APK="src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk"

if [ ! -f "$APK" ]; then
  echo "ERROR: APK not found at $APK"
  exit 1
fi

if ! command -v adb &>/dev/null; then
  echo "ERROR: adb not found on PATH. Install Android SDK platform-tools."
  exit 1
fi

DEVICES=($(adb devices | grep 'device$' | awk '{print $1}'))

if [ ${#DEVICES[@]} -eq 0 ]; then
  echo "ERROR: No Android device connected. Connect a phone via USB and enable USB debugging."
  exit 1
fi

# Auto-select device: honor ANDROID_SERIAL env var, else prefer USB device over emulator
if [ -z "$ANDROID_SERIAL" ]; then
  for d in "${DEVICES[@]}"; do
    if [[ "$d" != emulator-* ]]; then
      export ANDROID_SERIAL="$d"
      break
    fi
  done
  # Fallback to first device if all are emulators
  [ -z "$ANDROID_SERIAL" ] && export ANDROID_SERIAL="${DEVICES[0]}"
fi

echo "==> Using device: $ANDROID_SERIAL (${#DEVICES[@]} device(s) connected)"

PACKAGE="com.webtimer.app"

echo "==> Uninstalling existing $PACKAGE if present..."
adb -s "$ANDROID_SERIAL" uninstall "$PACKAGE" 2>/dev/null || true

echo "==> Installing $APK..."
adb -s "$ANDROID_SERIAL" install "$APK"

echo "==> Launching $PACKAGE..."
adb -s "$ANDROID_SERIAL" shell am start -n "$PACKAGE/.MainActivity"

echo "Done."
