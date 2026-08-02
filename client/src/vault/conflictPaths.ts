/**
 * `project.sync-conflict-20260724-153258-YZWMYOO.md` -> stem `project`, ext `.md`.
 * The device suffix is Syncthing's short device ID; the timestamp is local to
 * whichever device detected the conflict, so neither is used for ordering —
 * `updatedAt` inside the file is the only ordering signal trusted here.
 *
 * Split out of conflictResolver.ts (still its re-export surface for existing
 * callers) so vaultSync.ts can recognize conflict-copy paths without an
 * import cycle: conflictResolver.ts already imports `writeEntityToDisk` from
 * vaultSync.ts, so vaultSync.ts importing back from conflictResolver.ts would
 * make the two modules mutually dependent.
 */
const CONFLICT_NAME = /^(.+)\.sync-conflict-\d{8}-\d{6}-[A-Z0-9]+(\.[^./]+)$/;

/** The path a conflict copy belongs to, or `null` if `path` is not one. */
export function conflictTargetPath(path: string): string | null {
  const slash = path.lastIndexOf('/');
  const dir = slash === -1 ? '' : path.slice(0, slash + 1);
  const match = CONFLICT_NAME.exec(path.slice(slash + 1));
  return match ? `${dir}${match[1]}${match[2]}` : null;
}
