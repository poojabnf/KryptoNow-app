# KryptoNow — Mobile Launch Checklist

This guide walks through every step required to publish KryptoNow on the Apple App Store and Google Play Store.

---

## Prerequisites

```bash
npm install -g eas-cli          # EAS build/submit CLI
eas login                       # Log in with your Expo account (poojaya2k19)
npm install                     # Install expo-build-properties (newly added)
```

---

## Step 1 — Rotate Exposed API Keys

The following keys were previously committed to the repo and **must be rotated before going to production**:

| Key | Where to rotate |
|-----|----------------|
| Alchemy API Key | https://dashboard.alchemy.com → Apps → Rotate Key |
| Pimlico API Key | https://dashboard.pimlico.io → API Keys |
| EXPO_PUBLIC_VAULT_SECRET | Generate a new 32+ char random string and update all environments |
| Clerk Publishable Key | Safe to keep (it's public by design) — but audit your Clerk dashboard for suspicious sessions |

After rotating, update `eas.json` with the new production values for each `env` block.

---

## Step 2 — Apple Developer Setup (iOS)

### 2a. Create App Store Connect listing
1. Go to https://appstoreconnect.apple.com
2. Click **+** → **New App**
3. Fill in: Name = "KryptoNow", Bundle ID = `com.kryptonow.app`, SKU = `kryptonow`
4. Copy the **App ID** (10-digit number) — you'll need it for `eas.json`

### 2b. Find your Team ID
- Go to https://developer.apple.com/account → Membership → **Team ID**

### 2c. Update eas.json
```json
"submit": {
  "production": {
    "ios": {
      "appleId": "your-actual@email.com",
      "ascAppId": "1234567890",       ← paste your App ID here
      "appleTeamId": "ABCDE12345"     ← paste your Team ID here
    }
  }
}
```

### 2d. App Store metadata (prepare before submission)
- **App icon**: 1024×1024 PNG (already in `assets/icon.png`) — upload in App Store Connect
- **Screenshots**: Required for iPhone 6.9" and 6.5" — take from simulator
- **Privacy Policy URL**: Required for financial/crypto apps — host at `kryptonow.xyz/privacy`
- **App description**: Up to 4000 chars
- **Keywords**: wallet, crypto, ethereum, DeFi, bitcoin, secure wallet
- **Category**: Finance
- **Age Rating**: 4+ (no objectionable content)
- **Export Compliance**: Select "Yes" for encryption (uses standard HTTPS/TLS)

---

## Step 3 — Google Play Setup (Android)

### 3a. Create Play Console listing
1. Go to https://play.google.com/console
2. **Create app** → App name = "KryptoNow", Default language = English
3. Fill in the Store listing questionnaire

### 3b. Create a Service Account for EAS Submit
1. Go to https://play.google.com/console → **Setup → API access**
2. Link to a Google Cloud project
3. Create a **Service Account** with role "Service Account User"
4. Download the JSON key file → save as `google-service-account.json` in this repo root
5. In Play Console, grant the service account **Release Manager** permissions

### 3c. Play Store metadata
- **Short description**: Secure crypto wallet (max 80 chars)
- **Full description**: Up to 4000 chars
- **Screenshots**: Phone, 7" tablet, 10" tablet
- **Feature graphic**: 1024×500 PNG
- **Content rating**: Complete the questionnaire (Financial category)
- **Privacy Policy URL**: `kryptonow.xyz/privacy` — required for financial apps
- **Target audience**: 18+ (crypto/financial apps)

---

## Step 4 — Push Notifications (Expo Push Service)

No Firebase setup required. The app uses Expo's push notification service which handles APNs (iOS) and FCM (Android) automatically.

For push notifications to work on production iOS builds, you need to:
1. Go to https://expo.dev/accounts/poojaya2k19/projects/kryptonow/credentials
2. Upload or generate an **APNs key** (`.p8` file from Apple Developer)
3. EAS handles the rest automatically for Android

---

## Step 5 — Build

### Preview build (internal testing — no store accounts needed)
```bash
# Android APK — install directly on device
npm run build:preview:android

# iOS — install via TestFlight or direct device install
npm run build:preview:ios
```

### Production build
```bash
# Build both platforms
npm run build:all

# Or individually
npm run build:ios
npm run build:android
```

Builds run on Expo's cloud infrastructure. Each takes ~15–25 min. You'll get a download link when done.

---

## Step 6 — Submit to Stores

```bash
# After production build completes:
npm run submit:ios        # Uploads to App Store Connect (TestFlight first)
npm run submit:android    # Uploads to Google Play internal track
```

For iOS, submit to **TestFlight** first, test for 1–2 days, then promote to App Store review.

---

## Step 7 — App Store Review Notes

Apple reviewers will test the app. Prepare a **demo account**:
- Pre-create a wallet or provide test seed phrase in the review notes
- Explain that the app is a self-custody crypto wallet (no backend sign-in required for wallet features)
- Note that camera permission is used for WalletConnect QR scanning

Google Play review is typically faster (1–3 days vs Apple's 1–7 days).

---

## Step 8 — Post-Launch

- **Crash monitoring**: Add `expo-updates` for OTA (over-the-air) JS updates that don't require a new app store submission
- **Analytics**: Consider `expo-analytics` or Mixpanel React Native SDK
- **Backend device registration**: Wire `expoPushToken` in `hooks/usePushNotifications.ts` to your backend endpoint

---

## Quick Reference — Version Bumping

For each new release, increment:
- `version` in `app.json` (e.g., `"1.0.1"`) — shown to users
- `buildNumber` in `app.json → ios` — must increment for every iOS upload
- `versionCode` in `app.json → android` — must increment for every Android upload

With `"autoIncrement": true` in `eas.json` production profile, EAS handles `buildNumber`/`versionCode` automatically. You only need to bump `version` manually.

---

## Useful Commands

```bash
eas build:list                          # View all builds
eas build:view [BUILD_ID]               # Details of a specific build  
eas credentials                         # Manage iOS/Android signing credentials
eas secret:create --name KEY --value V  # Store secrets securely (better than eas.json env)
eas update --branch production          # Push OTA JS update (no store submission needed)
```
