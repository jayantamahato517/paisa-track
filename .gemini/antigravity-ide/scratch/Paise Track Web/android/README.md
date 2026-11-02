# PaisaTrack Android Application

This is the complete, production-grade Android Studio / Gradle project for **PaisaTrack — Daily Expense Tracker & Net Balance Dashboard**.

## Project Highlights
- **100% Offline Capable**: Bundled with `lucide.min.js` and `chart.min.js` directly inside the APK.
- **Hardware Back-Button Navigation**: Pressing the Android back button smoothly closes modals, drawers, or prompts to exit.
- **Persistent LocalStorage**: Full DOM storage and database support for user accounts, transactions, and settings.
- **Edge-to-Edge System Bars**: Custom status bar and navigation bar matching the PaisaTrack espresso palette.

---

## 3 Easy Ways to Build the APK

### Method 1: Android Studio (Recommended & Easiest)
1. Open **Android Studio**.
2. Select **Open** and choose this `android` folder:
   `C:\Users\Rakesh\.gemini\antigravity-ide\scratch\Paise Track Web\android`
3. Wait for Gradle sync to complete.
4. From the top menu, click:
   **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**
5. Once finished, click **locate** in the popup notification to find your **`app-debug.apk`**.
6. Transfer the APK to your Android phone and install!

---

### Method 2: Command Line (Gradle)
If you have Android SDK and Gradle installed:
```bash
cd "C:\Users\Rakesh\.gemini\antigravity-ide\scratch\Paise Track Web\android"
./gradlew assembleDebug
```
The APK will be generated at:
`app/build/outputs/apk/debug/app-debug.apk`

---

### Method 3: Instant Cloud / PWA Install
- You can also install PaisaTrack directly on any Android phone without an APK:
  1. Open PaisaTrack in Chrome / Brave / Edge on your Android phone.
  2. Tap the browser menu (⋮) > **"Add to Home screen"** or **"Install App"**.
  3. PaisaTrack installs immediately with its own app icon and runs full-screen as a standalone native app!
