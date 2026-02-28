const UNSAFE_CHARS = /[\/\\:*?"<>|]/g;
const MAX_NAME_LENGTH = 60;

export function sanitizeFilename(name: string): string {
  return name
    .replace(UNSAFE_CHARS, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME_LENGTH)
    .replace(/[-\s]+$/, '');
}

/** First 6 hex characters of a UUID (enough for human-readable uniqueness) */
export function shortId(uuid: string): string {
  return uuid.replace(/-/g, '').slice(0, 6);
}

/** e.g. "Meeting Notes (019abc)" */
export function entityFilename(name: string, id: string): string {
  const sanitized = sanitizeFilename(name);
  return `${sanitized} (${shortId(id)})`;
}

/** Extract the short ID from a filename like "Meeting Notes (019abc).md" */
export function extractShortIdFromFilename(filename: string): string | null {
  const match = filename.match(/\(([a-f0-9]{6})\)(?:\.\w+)?$/);
  return match ? match[1] : null;
}

/** Check if a UUID matches a short ID */
export function uuidMatchesShortId(uuid: string, sid: string): boolean {
  return shortId(uuid) === sid;
}
