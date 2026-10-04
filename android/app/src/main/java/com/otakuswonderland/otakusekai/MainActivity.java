package com.otakuswonderland.otakusekai;

import android.content.pm.PackageInfo;

import com.google.androidbrowserhelper.trusted.LauncherActivity;
import com.google.androidbrowserhelper.trusted.LauncherActivityMetadata;
import com.google.androidbrowserhelper.trusted.TwaLauncher;
import com.google.androidbrowserhelper.trusted.WebViewFallbackActivity;

/**
 * Opens the game full screen. The game's card layouts use modern CSS (container-query units), so the engine matters and must not depend on
 * the phone's default browser (Firefox, Edge, Samsung Internet...):
 *  - Chrome installed and recent enough: a Trusted Web Activity in Chrome (keeps web push notifications working).
 *  - Otherwise: the phone's System WebView inside the app. Google updates it on its own on every Play device.
 */
public class MainActivity extends LauncherActivity {
    private static final String CHROME = "com.android.chrome";
    private static final int MIN_CHROME_MAJOR = 105; // first version with container-query units

    @Override
    protected TwaLauncher createTwaLauncher() {
        return new TwaLauncher(this, CHROME); // never the default browser
    }

    @Override
    protected void launchTwa() {
        if (chromeIsRecentEnough()) {
            super.launchTwa();
            return;
        }
        startActivity(WebViewFallbackActivity.createLaunchIntent(this, getLaunchingUrl(), LauncherActivityMetadata.parse(this)));
        finish();
    }

    private boolean chromeIsRecentEnough() {
        try {
            PackageInfo info = getPackageManager().getPackageInfo(CHROME, 0);
            if (info.applicationInfo == null || !info.applicationInfo.enabled || info.versionName == null) return false;
            return Integer.parseInt(info.versionName.split("\.")[0]) >= MIN_CHROME_MAJOR;
        } catch (Exception e) {
            return false; // not installed, disabled or unreadable
        }
    }
}
