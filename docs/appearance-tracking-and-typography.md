# Appearance, scaling, and time tracking

This guide describes the appearance and time-tracking controls currently available in JediNotebook, including how their settings interact.

## Themes and readable contrast

The default theme is a clean, high-contrast white-and-black palette inspired by Notion-style interfaces. The following built-in themes are available in Settings:

- Clean Light (default)
- Gruvbox Dark and Gruvbox Light
- Everforest Dark and Everforest Light
- Catppuccin Mocha and Catppuccin Latte
- Nord
- Solarized Dark and Solarized Light
- Dracula
- Custom, with user-selected colors

Every built-in theme defines the full application palette: page and card backgrounds, primary and secondary text, borders, accents, and their foreground colors. Theme contrast tests enforce WCAG AA-level contrast (at least 4.5:1) for primary and secondary text on the main application surfaces and for the accent foreground. This includes the active navigation icon and label in dark themes, so the active state remains legible.

Existing installations are kept compatible: a legacy `dark` selection becomes Gruvbox Dark, while older Notion-style and removed light themes become Clean Light. Custom themes remain custom themes.

## Time tracking visibility

Time tracking can be shown or hidden from Settings. It is enabled by default.

When it is hidden:

- The activity/timer entry point is removed from all navigation layouts.
- The timer display is removed from the Today page.
- Analytics is removed from Settings.
- The activity link below a project is removed.
- Opening the old activity route redirects to Today instead of leaving the user on a hidden screen.
- A running timer is stopped before the feature is hidden.

Existing activities, time entries, and project links are not deleted. Turning the setting back on restores access to the preserved data.

## Interface zoom and project typography

The interface zoom control accepts any value from 25% upward. It can be changed with the field, plus/minus buttons, mouse wheel, or vertical dragging; there is deliberately no maximum limit. Reset returns it to 100%.

Project-list text and project-note text have separate size controls. They also have no maximum limit, with a lower bound of 10 px. Before either is changed, both sizes follow the global interface zoom at their standard proportions:

| Text area | Standard size at 100% |
| --- | --- |
| Project list | 13 px |
| Project note | 14 px |

Changing one of these local text settings affects only that text area. It does not alter the rest of the interface or the other local text setting.

Changing the global interface zoom is the reset point: both local text overrides are cleared, and their sizes again follow the normal proportions of the new zoom. This makes global zoom a predictable way to return the application to a coherent scale.

## Build and installation

For a Linux desktop build, installation, and launch, use [the Linux build and installation guide](linux-build-and-install.md). For a connected Android device, use [the Android build and installation guide](android-build-and-install.md).

The Linux script runs the frontend tests before packaging, uses the Rustup-managed Cargo toolchain, installs the application into the current user’s local application directory, and launches it. The Android workflow builds a debug APK, installs it with ADB, and starts the app on the selected device.

## Development workflow

After each completed implementation iteration, verification results are reported first. The user is then asked whether they want the iteration committed and pushed; neither action is assumed without that request. If the user has already explicitly requested a commit or push for the current iteration, that authorization is used directly.
