# Build and install on Linux

This guide is for Linux users who want to build JediNotebook, install it for their own account, and launch the updated application.

## Prerequisites

Install the Linux packages required by Tauri and WebKitGTK. On Ubuntu and Debian-based distributions:

```bash
sudo apt update
sudo apt install build-essential pkg-config libssl-dev libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```

Install Node.js 20 or newer and Rust with Rustup. Open a new terminal after Rustup finishes so the user-local Cargo directory is available:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup update stable
```

The build requires a modern Cargo release. If Cargo reports that it cannot read lockfile version 4, ensure that `~/.cargo/bin` comes before `/usr/bin` in `PATH` and run the last two commands again.

## Build, install, and launch

From the repository root, run:

```bash
./build-linux.sh
```

The script installs locked frontend dependencies, runs the test suite, produces the Linux Tauri bundle, replaces the current user’s launcher, refreshes the desktop entry, and starts JediNotebook. No administrator password is required.

The application is installed under the current user’s local application directory, so it appears in the desktop application menu and can be updated safely by running the script again. User data is preserved.

## Optional system-wide package

The build also produces a Debian package. To install it for all users, use your distribution’s package tool after the build:

```bash
sudo apt install ./client/src-tauri/target/release/bundle/deb/JediNotebook_0.3.0_amd64.deb
```

Do not install both the user-local launcher and the system package unless you specifically need both. The user-local script is the recommended development workflow.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| Cargo cannot parse lockfile version 4 | Run `source "$HOME/.cargo/env"`, then `rustup update stable`; verify `cargo --version` is not the old distribution version. |
| Missing WebKitGTK or GTK library | Install the packages from Prerequisites, then rerun the script. |
| Application does not open from a terminal-only session | Run the script from an active desktop session, or launch it later from the application menu. |
| A previous process is still open | The script stops only the existing JediNotebook process before replacing the user-local binary. |
