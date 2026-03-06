package com.webtimer.app

import android.os.Bundle
import android.view.View
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding

class MainActivity : TauriActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(AndroidStoragePlugin::class.java)
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)

        // Keep WebView content within safe area (matches mobile browser behavior)
        val contentView = findViewById<View>(android.R.id.content)
        ViewCompat.setOnApplyWindowInsetsListener(contentView) { view, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.updatePadding(
                top = insets.top,
                bottom = insets.bottom,
                left = insets.left,
                right = insets.right
            )
            WindowInsetsCompat.CONSUMED
        }
    }

    // Configure WebView to respect viewport meta tag
    override fun onWebViewCreate(webView: WebView) {
        webView.settings.useWideViewPort = true
        webView.settings.loadWithOverviewMode = true
    }
}
