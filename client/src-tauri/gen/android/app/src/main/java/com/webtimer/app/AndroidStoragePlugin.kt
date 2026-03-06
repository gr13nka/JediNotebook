package com.webtimer.app

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin

@TauriPlugin
class AndroidStoragePlugin(private val activity: Activity) : Plugin(activity) {

    @Command
    fun checkStoragePermission(invoke: Invoke) {
        val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Environment.isExternalStorageManager()
        } else {
            true
        }
        val result = app.tauri.plugin.JSObject()
        result.put("granted", granted)
        invoke.resolve(result)
    }

    @Command
    fun requestStoragePermission(invoke: Invoke) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                data = Uri.parse("package:${activity.packageName}")
            }
            activity.startActivity(intent)
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
