/** Returns true when running inside a Tauri desktop/mobile shell */
export function isTauri(): boolean {
  return '__TAURI__' in window;
}
