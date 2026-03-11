package com.webtimer.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@TauriPlugin
class AndroidStoragePlugin(private val activity: Activity) : Plugin(activity) {

    companion object {
        private const val TAG = "AndroidStoragePlugin"
    }

    @Command
    fun checkStoragePermission(invoke: Invoke) {
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            true
        }
        Log.d(TAG, "checkStoragePermission: granted=$granted SDK=${Build.VERSION.SDK_INT}")
        val result = app.tauri.plugin.JSObject()
        result.put("granted", granted)
        invoke.resolve(result)
    }

    @Command
    fun requestStoragePermission(invoke: Invoke) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                // Try app-specific "All files access" settings page
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                    data = Uri.parse("package:${activity.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(intent)
                Log.d(TAG, "Opened app-specific all-files-access settings")
            } catch (e: Exception) {
                Log.w(TAG, "App-specific intent failed, trying general all-files-access", e)
                try {
                    // Fallback: general "All files access" list
                    val intent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    activity.startActivity(intent)
                    Log.d(TAG, "Opened general all-files-access settings")
                } catch (e2: Exception) {
                    Log.w(TAG, "General intent failed, trying app details", e2)
                    try {
                        // Last fallback: app info page
                        val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                            data = Uri.parse("package:${activity.packageName}")
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        activity.startActivity(intent)
                        Log.d(TAG, "Opened app details settings")
                    } catch (e3: Exception) {
                        Log.e(TAG, "All settings intents failed", e3)
                    }
                }
            }
        }
        invoke.resolve()
    }

    @Command
    fun getDefaultVaultPath(invoke: Invoke) {
        val documentsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS)
        val result = app.tauri.plugin.JSObject()
        result.put("path", "${documentsDir.absolutePath}/WebTimer")
        invoke.resolve(result)
    }
}
