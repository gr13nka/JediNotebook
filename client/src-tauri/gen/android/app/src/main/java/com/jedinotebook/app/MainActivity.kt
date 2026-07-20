package com.jedinotebook.app

import android.os.Bundle

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        pluginManager.load(null, "android-storage", AndroidStoragePlugin(this), "")
        super.onCreate(savedInstanceState)
    }
}
