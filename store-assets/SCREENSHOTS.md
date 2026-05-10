# App Store Screenshots — KryptoNow

## Required sizes (Apple mandates at least iPhone 6.7" + iPad if you support tablet)

| Device | Resolution | Orientation | Required? |
|---|---|---|---|
| iPhone 6.7" (15 Pro Max) | 1290 × 2796 px | Portrait | ✅ Required |
| iPhone 6.5" (14 Plus / 13 Pro Max) | 1284 × 2778 px | Portrait | ✅ Required |
| iPad Pro 12.9" (6th gen) | 2048 × 2732 px | Portrait | Only if iPad supported |

> Your `app.json` has `"supportsTablet": false` so iPad screenshots are **not required**.
> Upload at minimum the 6.7" set. Apple will auto-scale for smaller devices.

---

## How to take screenshots with EAS / Expo

### Option A — iOS Simulator (fastest, free)
```bash
# 1. Build a simulator build
eas build --profile development --platform ios

# 2. Open in Simulator → Device → iPhone 15 Pro Max
#    Window → Physical Size

# 3. In simulator: File → Save Screen
#    Or: xcrun simctl io booted screenshot screenshot.png
```

### Option B — Real device (best quality)
Take screenshots on a physical iPhone 14 Plus or 15 Pro Max.
Side button + Volume Up → saved to Photos.

### Option C — Figma / Sketch mockup (most polished)
Wrap your screenshots in a device frame using:
- Figma community: search "iPhone 15 Pro Max mockup"
- screenshots.pro (web tool)
- AppLaunchpad (paid but generates all sizes)

---

## Recommended 5-screenshot story

| # | Screen to capture | Caption text |
|---|---|---|
| 1 | Dashboard — balance card visible, tokens list | "Your crypto. Your keys. Always." |
| 2 | Swap screen — token picker open | "Swap 100+ tokens at the best rate" |
| 3 | Bridge screen — provider list | "Bridge across chains in seconds" |
| 4 | NFTs gallery | "Your NFTs, beautifully displayed" |
| 5 | Settings → Theme → Pro (gold theme) | "Premium. Dark. Gold." |

---

## File naming convention

Place final PNG files here:
```
store-assets/
  ios/
    screenshots/
      iphone-6.7-01-dashboard.png
      iphone-6.7-02-swap.png
      iphone-6.7-03-bridge.png
      iphone-6.7-04-nfts.png
      iphone-6.7-05-pro-theme.png
```

---

## Upload via EAS (after screenshots are ready)

Screenshots are uploaded manually via App Store Connect:
1. Go to https://appstoreconnect.apple.com
2. My Apps → KryptoNow → iOS App → 1.0 Prepare for Submission
3. Drag screenshots into each device slot
4. Also fill in: Description, Keywords, Support URL, Privacy Policy URL

**Privacy Policy URL to paste:** `https://kryptonow.xyz/privacy`
**Support URL:** `https://kryptonow.xyz`

---

## One-time App Store Connect setup checklist

- [ ] Enroll in Apple Developer Program at developer.apple.com ($99/year) using `pooja.bnf@gmail.com`
- [ ] Confirm Team ID is `QGKA75U5S4` (check at developer.apple.com → Membership)
- [ ] In App Store Connect → My Apps → `+` → New App:
  - Platform: iOS
  - Name: KryptoNow - Web3 Crypto Wallet
  - Primary Language: English (U.S.)
  - Bundle ID: `com.kryptonow.app`
  - SKU: `kryptonow-ios-2026`
- [ ] **Copy the numeric App ID** from the URL bar (e.g. `1234567890`)
- [ ] Paste that number into `eas.json` → `submit.production.ios.ascAppId`
- [ ] Set up In-App Purchases in App Store Connect (Pro Monthly + Annual)
- [ ] Create app review contact info in App Store Connect
- [ ] Upload screenshots
- [ ] Submit for review: `eas submit --platform ios --profile production`
