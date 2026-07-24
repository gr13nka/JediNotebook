# Build and Install JediNotebook on Android

This guide is for Linux contributors who need to build JediNotebook and install the current debug build on a USB-connected Android phone.

After completing it, you can rebuild, update, and launch the app with one command while preserving the phone's app data.

## Prerequisites

Use a 64-bit Linux computer with an internet connection and an ARM64 Android phone. Install these host prerequisites first:

```bash
sudo apt update
sudo apt install curl unzip openjdk-17-jdk
```

Install Node.js 20 or newer, then install Rust with Rustup if it is not already available:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Open a new terminal after installing Rust. The scripts check for Node, npm, Java, Curl, Unzip, SHA-256, and Rustup and report a missing prerequisite before doing any work.

## One-time Android toolchain setup

From the repository root, run:

```bash
./setup-android-build-tools.sh
```

The setup is per-user and does not require `sudo`. It installs the Android command-line tools, Android SDK Platform 36, Build-Tools 35 and 36, Platform-Tools (including ADB), NDK 27.2, and Rust's ARM64 Android target. The Android SDK is stored under the user-local application directory by default.

To use a different SDK location, set `ANDROID_SDK_ROOT` before running either script. To use another compatible NDK version, set `ANDROID_NDK_VERSION`; use the same value for setup and build.

## Prepare the phone

On the phone:

1. Enable Developer options.
2. Enable USB debugging.
3. Connect it by USB and unlock it.
4. Accept the “Allow USB debugging?” prompt from this computer.

Check that ADB sees the phone as `device`, not `unauthorized`:

```bash
~/.local/opt/android-sdk/platform-tools/adb devices -l
```

If you use a custom SDK location, replace that path with `$ANDROID_SDK_ROOT/platform-tools/adb`.

## Build, install, and launch

Run this from the repository root:

```bash
./build-android.sh
```

The script installs the locked frontend dependencies, runs the test suite, builds an ARM64 debug APK, installs it with ADB, and launches JediNotebook. It uses Android's in-place update mode, so it preserves existing app data.

When more than one device is connected, select one explicitly:

```bash
ANDROID_SERIAL=your-device-serial ./build-android.sh
```

The script currently targets physical ARM64 Android phones. It stops before building if the selected device uses another ABI.

## Updating an existing debug build

Run `./build-android.sh` again after changing the app. Android accepts the update because the application ID and debug signing certificate remain the same on this machine. If ADB reports an incompatible signature, do not uninstall blindly: uninstalling removes the app's local data. First confirm whether the installed app came from a different signing key or release channel.

This debug-install workflow is for development devices. It does not configure Play Store distribution or automatic updates. Those require a persistent release signing key, a monotonically increasing Android version code, and publishing a signed Android App Bundle to Google Play.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| `No authorized Android device found` | Unlock the phone, reconnect the cable, and accept the USB debugging prompt. Run ADB again to verify the state is `device`. |
| Android SDK or NDK missing | Run `./setup-android-build-tools.sh`, or set `ANDROID_SDK_ROOT` and `ANDROID_NDK_VERSION` to the existing installation. |
| Rust target is missing | Re-run the setup script; it installs `aarch64-linux-android`. |
| Signature mismatch during install | Keep the existing app/data intact until you determine which signing key installed it. A debug build cannot replace a build signed with a different certificate. |
| Build fails after an SDK update | Re-run the setup script to restore the required Platform 36, Build-Tools 35/36, and NDK 27.2 components. |
