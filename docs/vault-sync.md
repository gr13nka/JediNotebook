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

Do not configure JediNotebook to use a Syncthing conflict-copy folder. Select the normal shared folder — individual conflicted *files* inside it are handled for you, as described next.

## When two devices edit the same thing

Syncthing cannot merge file contents. If you edit one project on your laptop and the same project on your phone while the two are not connected, Syncthing keeps one version and renames the other to something like `project.sync-conflict-20260724-153258-YZWMYOO.md`.

JediNotebook folds those copies back in automatically, before each import:

- **Tasks, activities, time entries and other structured records** are combined by identity. A task added on either device is kept; a task changed on both keeps the more recent change.
- **Project notes** are combined paragraph by paragraph, so text written on one device is never discarded in favour of the other.
- **Deletions are respected.** Something you deleted stays deleted — it is not resurrected by the merge. The one exception is the very first sync after upgrading to this version: with no prior record of what the devices agreed on, that first merge keeps both sides in full rather than guessing which side deleted something. Review your notes once after upgrading.

The conflict copy is removed once its content has been merged in, so the copies do not pile up.

### If devices still look out of sync

Syncthing reports a folder as "Up to Date" when *that device* has everything it knows about — not when it matches its peers. Two disconnected devices therefore both show green while holding different content, and rescanning changes nothing, because a rescan only re-reads the local disk. Check that the other device is actually **Connected** before concluding that a file failed to sync.

Enabling file versioning on the Syncthing folder is worthwhile: it is what makes an unlucky overwrite recoverable.

## Upgrading from older versions

Older versions stored the vault path in the synchronized settings file. After upgrading, the currently saved path is retained on each device and future synchronization does not transfer it. If a device already has the wrong path, use **Switch vault** on that device and select its own local Syncthing folder once.

When a vault is opened after the upgrade, JediNotebook rewrites its synchronized settings file without device-only data. Older application versions may still add those fields back, but current versions ignore them safely.
