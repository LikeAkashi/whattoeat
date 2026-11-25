package app.whattoeat

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.webkit.WebViewAssetLoader
import androidx.webkit.WebViewClientCompat

/**
 * 「吃什么」的壳。
 *
 * 页面全部在 assets/www 里，离线可用，不联网、不要权限。
 * 用 WebViewAssetLoader 把 assets 映射到 https://appassets.androidplatform.net/，
 * 这样 localStorage（记住偏好）和正常网页一样可靠；直接 file:// 加载会踩同源限制。
 *
 * 站外链接（小红书视频等）交给系统浏览器，不在 WebView 里打开。
 */
class MainActivity : ComponentActivity() {

    private lateinit var web: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val loader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        web = WebView(this).apply {
            setBackgroundColor(Color.parseColor("#F2F2F7"))
            overScrollMode = View.OVER_SCROLL_NEVER
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = false
                allowContentAccess = false
            }
            webViewClient = object : WebViewClientCompat() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? = loader.shouldInterceptRequest(request.url)

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    val url = request.url.toString()
                    if (url.startsWith(BASE)) return false
                    // 外部链接（小红书视频）丢给系统浏览器
                    runCatching {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    }
                    return true
                }
            }
        }
        setContentView(web)
        web.loadUrl("$BASE/assets/www/index.html")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) {
                    web.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
    }

    override fun onPause() {
        super.onPause()
        web.onPause()
    }

    override fun onResume() {
        super.onResume()
        web.onResume()
    }

    companion object {
        private const val BASE = "https://appassets.androidplatform.net"
    }
}
