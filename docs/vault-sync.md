# Vault sync across devices

## What is shared

The vault contains your tasks, projects, activities, time entries, inbox, folders, and shared behavior preferences such as day boundaries and time-tracking visibility. Syncthing should synchronize the same vault contents between your devices.

## What stays on each device

Each installation keeps its own vault location and interface preferences. This includes the vault path, recent-vault list, theme, language, typography, and navigation layout. Changing a vault folder on one device does not change the folder selected on any other device.

This matters when the same Syncthing folder has a different absolute path on a desktop and a phone: each installation can point to its own local copy without the paths overwriting each other.

## Set up Syncthing

1. Create or choose one vault folder on your first device in **Settings → Vault Sync**.
2. Share that folder with Syncthing and let it finish syncing to the other device.
3. On every other device, open JediNotebook and select that device's local Syncthing folder as its vault.
4. Wait for the initial import to finish before editing the same item on multiple devices.

Do not configure JediNotebook to use a Syncthing conflict-copy folder. Resolve the Syncthing conflict first, then select the normal shared folder.

## Upgrading from older versions

Older versions stored the vault path in the synchronized settings file. After upgrading, the currently saved path is retained on each device and future synchronization does not transfer it. If a device already has the wrong path, use **Switch vault** on that device and select its own local Syncthing folder once.

When a vault is opened after the upgrade, JediNotebook rewrites its synchronized settings file without device-only data. Older application versions may still add those fields back, but current versions ignore them safely.
