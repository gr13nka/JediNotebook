/**
 * Android storage permission helpers.
 * Wraps the Kotlin AndroidStoragePlugin commands via Tauri invoke.
 * Dynamic imports ensure this tree-shakes from the web build.
 */

export async function checkStoragePermission(): Promise<boolean> {
  const { invoke } = await import('@tauri-apps/api/core');
  const result = await invoke<{ granted: boolean }>('plugin:android-storage|check_storage_permission');
  return result.granted;
}

export async function requestStoragePermission(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');
  await invoke('plugin:android-storage|request_storage_permission');
}

export async function getDefaultVaultPath(): Promise<string> {
  const { invoke } = await import('@tauri-apps/api/core');
  const result = await invoke<{ path: string }>('plugin:android-storage|get_default_vault_path');
  return result.path;
}
