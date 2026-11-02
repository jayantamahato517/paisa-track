package com.paisatrack.app;

import android.annotation.SuppressLint;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.os.VibrationEffect;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private long backPressedTime = 0;
    private Toast exitToast;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Customize Status Bar & Navigation Bar to match PaisaTrack palette
        setCustomSystemBars();

        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        setupWebView();

        // Load local offline assets directly from inside the APK
        webView.loadUrl("file:///android_asset/www/index.html");

        // Android Hardware Back-Button Handling
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // Check if any modal is open in the web app
                webView.evaluateJavascript(
                    "(function() { " +
                    "  const openModal = document.querySelector('.modal-backdrop.open'); " +
                    "  if (openModal) { " +
                    "    const closeBtn = openModal.querySelector('.close-modal-btn'); " +
                    "    if (closeBtn) { closeBtn.click(); return 'closed_modal'; } " +
                    "    openModal.classList.remove('open'); return 'closed_modal'; " +
                    "  } " +
                    "  const sidebar = document.getElementById('appSidebar'); " +
                    "  if (sidebar && sidebar.classList.contains('open')) { " +
                    "    sidebar.classList.remove('open'); " +
                    "    document.getElementById('sidebarBackdrop')?.classList.remove('active'); " +
                    "    return 'closed_sidebar'; " +
                    "  } " +
                    "  return 'none'; " +
                    "})()",
                    value -> {
                        if ("\"closed_modal\"".equals(value) || "\"closed_sidebar\"".equals(value)) {
                            // Back action handled by closing modal or sidebar
                            return;
                        }

                        // If web history can go back
                        if (webView.canGoBack()) {
                            webView.goBack();
                        } else {
                            // Double tap back to exit
                            if (backPressedTime + 2000 > System.currentTimeMillis()) {
                                if (exitToast != null) exitToast.cancel();
                                finish();
                            } else {
                                exitToast = Toast.makeText(MainActivity.this, "Press back again to exit PaisaTrack", Toast.LENGTH_SHORT);
                                exitToast.show();
                            }
                            backPressedTime = System.currentTimeMillis();
                        }
                    }
                );
            }
        });
    }

    private void setupWebView() {
        WebSettings settings = webView.getSettings();

        // Core HTML5 features
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true); // REQUIRED FOR LOCALSTORAGE
        settings.setDatabaseEnabled(true);

        // File and content access
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        // Responsive viewport and scaling
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        // Caching
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        // Smooth scrolling & hardware acceleration
        webView.setScrollBarStyle(View.SCROLLBARS_INSIDE_OVERLAY);
        webView.setBackgroundColor(Color.parseColor("#FBF6EF"));

        // Register Native JavaScript Bridge
        webView.addJavascriptInterface(new WebAppInterface(), "AndroidNative");

        // Keep navigation inside WebView
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Keep local asset URLs inside app
                String url = request.getUrl().toString();
                if (url.startsWith("file:///android_asset/")) {
                    return false;
                }
                return false;
            }
        });

        webView.setWebChromeClient(new WebChromeClient());
    }

    private void setCustomSystemBars() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            Window window = getWindow();
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            window.setStatusBarColor(Color.parseColor("#3A2618")); // Dark espresso
            window.setNavigationBarColor(Color.parseColor("#1C120A"));
        }
    }

    // JavaScript Bridge for native device interactions
    public class WebAppInterface {
        @JavascriptInterface
        public void showToast(String message) {
            Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show();
        }

        @JavascriptInterface
        public void vibrate(int durationMs) {
            try {
                Vibrator v = (Vibrator) getSystemService(VIBRATOR_SERVICE);
                if (v != null && v.hasVibrator()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        v.vibrate(VibrationEffect.createOneShot(durationMs, VibrationEffect.DEFAULT_AMPLITUDE));
                    } else {
                        v.vibrate(durationMs);
                    }
                }
            } catch (Exception ignored) {}
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
