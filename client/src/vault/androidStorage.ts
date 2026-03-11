/**
 * Android storage permission helpers.
 * Wraps the Kotlin AndroidStoragePlugin commands via Tauri invoke.
 * Dynamic imports ensure this tree-shakes from the web build.
 */

/**
 * Try invoking a plugin command with camelCase name first (Kotlin method name),
 * then snake_case as fallback. Pure Kotlin plugins loaded via pluginManager.load()
 * use exact method name matching — no auto-conversion.
 */
async function invokeAndroid<T>(command: string, camelCommand: string): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  try {
    return await invoke<T>(`plugin:android-storage|${camelCommand}`);
  } catch {
    return await invoke<T>(`plugin:android-storage|${command}`);
  }
}

export async function checkStoragePermission(): Promise<boolean> {
  try {
    const result = await invokeAndroid<{ granted: boolean }>('check_storage_permission', 'checkStoragePermission');
    return result.granted;
  } catch {
    // Plugin unavailable — probe filesystem to check access
    try {
      const { readDir } = await import('@tauri-apps/plugin-fs');
      const entries = await readDir('/storage/emulated/0/Documents');
      return entries.some(e => !e.isDirectory) || entries.length > 0;
    } catch {
      // Can't access files — permission likely not granted
      return false;
    }
  }
}

export async function requestStoragePermission(): Promise<void> {
  await invokeAndroid<void>('request_storage_permission', 'requestStoragePermission');
}

export async function getDefaultVaultPath(): Promise<string> {
  const result = await invokeAndroid<{ path: string }>('get_default_vault_path', 'getDefaultVaultPath');
  return result.path;
}
