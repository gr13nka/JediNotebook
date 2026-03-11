import { useState, useEffect } from 'react';

/** Returns true when running inside a Tauri desktop/mobile shell */
export function isTauri(): boolean {
  return '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
}

/** Returns true when running inside Tauri on a mobile device (Android/iOS) */
export function isMobileTauri(): boolean {
  return isTauri() && /Android|iPhone|iPad/i.test(navigator.userAgent);
}

/**
 * Cached Android detection result.
 * `null` = not yet probed, `true`/`false` = resolved.
 */
let androidCache: boolean | null = null;

/** Listeners waiting for the async detection result */
const listeners = new Set<(v: boolean) => void>();

/**
 * Probe the Kotlin android-storage plugin as a UA fallback.
 * Call once at startup (e.g. from App.tsx) so subsequent
 * `isAndroidTauri()` calls are reliable and synchronous.
 */
export async function detectAndroidOnce(): Promise<boolean> {
  if (androidCache !== null) return androidCache;

  // Fast path: UA already says Android
  if (isTauri() && /Android/i.test(navigator.userAgent)) {
    androidCache = true;
    listeners.forEach(fn => fn(true));
    listeners.clear();
    return true;
  }

  // Fallback: probe the Kotlin android-storage plugin (WebView UA may lack "Android")
  // Try camelCase (Kotlin method name) first, then snake_case as fallback
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    for (const cmd of ['checkStoragePermission', 'check_storage_permission']) {
      try {
        await invoke<{ granted: boolean }>(`plugin:android-storage|${cmd}`);
        // If invoke didn't throw, the plugin exists → Android
        console.log('[platform] Android detected via plugin probe:', cmd);
        androidCache = true;
        listeners.forEach(fn => fn(true));
        listeners.clear();
        return true;
      } catch (e) {
        console.warn('[platform] probe failed for', cmd, e);
      }
    }
  }

  console.log('[platform] Not Android. UA:', navigator.userAgent);
  androidCache = false;
  listeners.forEach(fn => fn(false));
  listeners.clear();
  return false;
}

/** Returns true when running inside Tauri on Android */
export function isAndroidTauri(): boolean {
  if (androidCache !== null) return androidCache;
  // Synchronous fallback before cache is warm
  return isTauri() && /Android/i.test(navigator.userAgent);
}

/** Reactive hook that re-renders when async Android detection resolves */
export function useIsAndroid(): boolean {
  const [val, setVal] = useState(isAndroidTauri());
  useEffect(() => {
    // If cache is already resolved, use it immediately
    if (androidCache !== null) { setVal(androidCache); return; }
    // Otherwise subscribe for when it resolves
    listeners.add(setVal);
    return () => { listeners.delete(setVal); };
  }, []);
  return val;
}
