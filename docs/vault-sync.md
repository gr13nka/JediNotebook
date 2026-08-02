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

## Syncthing checklist (per device)

JediNotebook's sync only works as well as Syncthing itself is configured underneath it. Check every item below on **every** device sharing the vault folder — desktop, phone, and laptop alike. A single misconfigured device can quietly cause data loss for all of them, not just for itself.

- **The folder is not paused.** Syncthing does show a paused folder as "Paused," not "Up to Date" — but it's easy to miss if you only glance at whether devices show as Connected, so check the folder's own status directly.
- **File Versioning is set to Simple, keeping at least 5 versions.** This is what makes an accidental overwrite recoverable — see "Recovering an overwritten file" below.
- **Max Conflicts is not 0.** A value of 0 tells Syncthing to silently *discard* the losing side of a conflict instead of keeping it as a `.sync-conflict-*` copy. That is permanent data loss on Syncthing's side, before JediNotebook ever gets a chance to merge anything.
- **On Android:** exclude Syncthing from battery optimization, and grant the app "All files access." Without both, Android can suspend Syncthing or silently block it from reading the vault folder.
- **`.stignore` can safely exclude device housekeeping files** — `(?d).DS_Store` and `(?d).trashed-*` are fine to ignore on every device.
- **Do not ignore `*.sync-conflict-*` files.** They have to actually reach every device for JediNotebook's conflict resolution to fold them back in. A device that never receives a copy can never merge it, and the edit it represents is gone for good.
- **"Up to Date" is not the same as synced.** It only means that device has everything *it* currently knows about — see "If devices still look out of sync" below for what to check instead.

## When two devices edit the same thing

Syncthing cannot merge file contents. If you edit one project on your laptop and the same project on your phone while the two are not connected, Syncthing keeps one version and renames the other to something like `project.sync-conflict-20260724-153258-YZWMYOO.md`.

JediNotebook folds those copies back in automatically, before each import:

- **Tasks, activities, time entries and other structured records** are combined by identity. A task added on either device is kept; a task changed on both keeps the more recent change.
- **Project notes** are combined paragraph by paragraph, so text written on one device is never discarded in favour of the other.
- **Deletions are respected.** Something you deleted on one device stays deleted once the change reaches another — it is not resurrected by the merge. The one case this can't tell apart from a fresh addition is a file this device has never fully synced before — the very first sync to a vault, or the first sync after switching to a different vault folder — which keeps both sides in full rather than guessing which one deleted something. After that first sync, deletions on either device are respected normally.

The conflict copy is removed once its content has been merged in, so the copies do not pile up.

### If devices still look out of sync

Syncthing reports a folder as "Up to Date" when *that device* has everything it knows about — not when it matches its peers. Two disconnected devices therefore both show green while holding different content, and rescanning changes nothing, because a rescan only re-reads the local disk. Check that the other device is actually **Connected** before concluding that a file failed to sync.

File versioning (see the checklist above) is what makes an unlucky overwrite recoverable — the next section covers how to actually recover one.

## Recovering an overwritten file (.stversions)

With Simple file versioning enabled, Syncthing keeps a copy of anything it overwrites in an `.stversions` folder at the root of the vault folder — on the device that *received* the overwrite, not the one that sent it. Versioned filenames get a `~YYYYMMDD-HHMMSS` suffix appended, for example `projects/Website/tasks~20260724-091530.md`.

To restore an older version:

1. Close JediNotebook on the device you're restoring to.
2. Find the file under `.stversions`, matching the timestamp of the version you want.
3. Copy it back to its original path inside the vault folder, stripping the `~YYYYMMDD-HHMMSS` suffix.
4. Reopen JediNotebook, or use **Sync Now** in Settings → Vault Sync, so it re-imports the restored file.

This is a manual, last-resort recovery path for a file that was overwritten outright — it is not needed for an ordinary Syncthing conflict. Those show up as `*.sync-conflict-*` copies, and JediNotebook's own conflict resolver folds them back in automatically every time the vault is enabled or synced. Don't delete `.sync-conflict-*` files by hand; let the app process them first.

## Upgrading from older versions

Older versions stored the vault path in the synchronized settings file. After upgrading, the currently saved path is retained on each device and future synchronization does not transfer it. If a device already has the wrong path, use **Switch vault** on that device and select its own local Syncthing folder once.

When a vault is opened after the upgrade, JediNotebook rewrites its synchronized settings file without device-only data. Older application versions may still add those fields back, but current versions ignore them safely.
