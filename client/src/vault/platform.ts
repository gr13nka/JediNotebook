/** Returns true when running inside a Tauri desktop/mobile shell */
export function isTauri(): boolean {
  return '__TAURI__' in window;
}

/** Returns true when running inside Tauri on a mobile device (Android/iOS) */
export function isMobileTauri(): boolean {
  return isTauri() && /Android|iPhone|iPad/i.test(navigator.userAgent);
}

/** Returns true when running inside Tauri on Android */
export function isAndroidTauri(): boolean {
  return isTauri() && /Android/i.test(navigator.userAgent);
}
