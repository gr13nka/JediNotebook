# Typography and font presets

## Purpose

JediNotebook uses a single typeface preference for the whole interface and project text. This keeps navigation, tasks, editable project notes, and markdown previews visually coherent while still letting each person choose a mood that suits their work.

Users choose a typeface from **Settings → Appearance → Typeface**. The preference takes effect immediately and is saved only on the current device; vault sync never changes a device's presentation settings.

## Available presets

| Typeface | Character |
| --- | --- |
| Source Serif 4 | Warm, thoughtful, editorial; the default for new and upgraded installs. |
| IBM Plex Sans | Focused, serious, and precise. |
| Nunito Sans | Soft, relaxed, and approachable. |
| Departure Mono | A lo-fi technical pixel face for a terminal-inspired workspace. |

All presets support the English and Russian interface. Departure Mono includes Cyrillic, so its technical look remains consistent in Russian projects as well.

Markdown code stays monospaced for readability. When Departure Mono is selected, it is used for code too.

## Maintaining the system

Keep the four source-of-truth parts in sync whenever a preset is added, renamed, or removed:

1. Add the locally bundled font assets and its Open Font License notice. Do not introduce a runtime font CDN; JediNotebook must work offline.
2. Register the preset's stable identifier, font-family stack, and localized label/description.
3. Extend the device-settings type and default, including safe fallback for invalid values from older installs.
4. Update the Typeface picker and its tests, then verify a production build contains each required asset.

Use only stable identifiers for saved preferences. If an identifier must be retired, resolve it to the current default so an old local database cannot prevent the app from loading.

## Verification

Run the client test suite and production build after typography changes. Check that the picker lists every preset, an invalid saved value selects the default safely, typography is absent from vault settings serialization, and the generated application includes each local font file.
