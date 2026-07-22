import { useEffect, useState } from 'react';

/**
 * Which shell the app is running in. `'web'` is the plain browser (or any
 * context without the Tauri bridge); the other three are always Tauri, split
 * by device class because vault UI (file-manager access, storage
 * permissions) differs by device even within Tauri.
 *
 * `getPlatform()` is a synchronous snapshot; `usePlatform()` is the same
 * value as a reactive hook. Prefer the hook in components — see its doc
 * comment for why the snapshot alone can be temporarily wrong on Android.
 */
export type Platform = 'web' | 'desktop-tauri' | 'android-tauri' | 'ios-tauri';

/** `__TAURI_INTERNALS__`/`__TAURI__` are injected once at startup and never disappear, so this is safe to compute only once. */
let inTauriShellCache: boolean | null = null;
function inTauriShell(): boolean {
  if (inTauriShellCache === null) {
    inTauriShellCache = '__TAURI_INTERNALS__' in window || '__TAURI__' in window;
  }
  return inTauriShellCache;
}

/**
 * Cached result of the Android probe in `detectAndroidOnce`. `null` = not yet
 * resolved, `true`/`false` = resolved. Read by `getPlatform()`; `listeners`
 * lets `usePlatform()` re-render when it resolves.
 */
let androidCache: boolean | null = null;
const listeners = new Set<() => void>();

function resolveAndroidCache(v: boolean): boolean {
  androidCache = v;
  listeners.forEach((fn) => fn());
  listeners.clear();
  return v;
}

/**
 * Probes the Kotlin android-storage plugin as a fallback Android check. Call
 * once at startup (App.tsx) so subsequent `getPlatform()`/`usePlatform()`
 * calls don't rely on the UA sniff alone.
 *
 * Why a probe at all: some Android WebViews' user-agent string omits
 * "Android" entirely, so `getPlatform()`'s UA fallback can't be trusted by
 * itself. This asks the native plugin directly, which is only reachable from
 * an actual Android host.
 */
export async function detectAndroidOnce(): Promise<boolean> {
  if (androidCache !== null) return androidCache;

  // Fast path: UA already says Android
  if (inTauriShell() && /Android/i.test(navigator.userAgent)) {
    return resolveAndroidCache(true);
  }

  // Fallback: probe the Kotlin android-storage plugin (WebView UA may lack "Android")
  // Try camelCase (Kotlin method name) first, then snake_case as fallback
  if (inTauriShell()) {
    const { invoke } = await import('@tauri-apps/api/core');
    for (const cmd of ['checkStoragePermission', 'check_storage_permission']) {
      try {
        await invoke<{ granted: boolean }>(`plugin:android-storage|${cmd}`);
        // If invoke didn't throw, the plugin exists → Android
        console.log('[platform] Android detected via plugin probe:', cmd);
        return resolveAndroidCache(true);
      } catch (e) {
        console.warn('[platform] probe failed for', cmd, e);
      }
    }
  }

  console.log('[platform] Not Android. UA:', navigator.userAgent);
  return resolveAndroidCache(false);
}

/**
 * Synchronous platform snapshot.
 *
 * Android is read from `detectAndroidOnce`'s cache once it has resolved;
 * until then (or if it's never called — e.g. outside App.tsx, such as in
 * tests) this falls back to sniffing `navigator.userAgent` for "Android",
 * which is the same fallback `detectAndroidOnce` exists to correct and can
 * misclassify an Android WebView as `'desktop-tauri'`. Call `detectAndroidOnce()`
 * at startup and use `usePlatform()` wherever the corrected answer matters
 * for what's rendered.
 */
export function getPlatform(): Platform {
  if (!inTauriShell()) return 'web';
  const isAndroid = androidCache !== null ? androidCache : /Android/i.test(navigator.userAgent);
  if (isAndroid) return 'android-tauri';
  if (/iPhone|iPad/i.test(navigator.userAgent)) return 'ios-tauri';
  return 'desktop-tauri';
}

/** Reactive `getPlatform()` — re-renders once `detectAndroidOnce`'s probe resolves. */
export function usePlatform(): Platform {
  const [platform, setPlatform] = useState(getPlatform());
  useEffect(() => {
    if (androidCache !== null) {
      setPlatform(getPlatform());
      return;
    }
    const onResolve = () => setPlatform(getPlatform());
    listeners.add(onResolve);
    return () => { listeners.delete(onResolve); };
  }, []);
  return platform;
}
