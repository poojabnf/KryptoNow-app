# Graph Report - C:/KryptoNow/KryptoNow-app/mobile  (2026-05-24)

## Corpus Check
- 92 files · ~90,192 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 929 nodes · 1470 edges · 88 communities (56 shown, 32 thin omitted)
- Extraction: 97% EXTRACTED · 2% INFERRED · 1% AMBIGUOUS · INFERRED: 28 edges (avg confidence: 0.75)
- Token cost: 46,800 input · 8,200 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Batch Send & Transactions|Batch Send & Transactions]]
- [[_COMMUNITY_Analytics & Categorization|Analytics & Categorization]]
- [[_COMMUNITY_Dashboard & Portfolio View|Dashboard & Portfolio View]]
- [[_COMMUNITY_Wallet Creation Flow|Wallet Creation Flow]]
- [[_COMMUNITY_Buy  Fiat On-Ramp|Buy / Fiat On-Ramp]]
- [[_COMMUNITY_Screens Registry & AA Config|Screens Registry & AA Config]]
- [[_COMMUNITY_ERC-4337 Account Abstraction|ERC-4337 Account Abstraction]]
- [[_COMMUNITY_WalletConnect Approval|WalletConnect Approval]]
- [[_COMMUNITY_Social Recovery|Social Recovery]]
- [[_COMMUNITY_Portfolio Charts|Portfolio Charts]]
- [[_COMMUNITY_DApps & WalletConnect|DApps & WalletConnect]]
- [[_COMMUNITY_Launch Risks & Blockers|Launch Risks & Blockers]]
- [[_COMMUNITY_Swap UI|Swap UI]]
- [[_COMMUNITY_Price Alerts|Price Alerts]]
- [[_COMMUNITY_Secure Storage & Crypto Keys|Secure Storage & Crypto Keys]]
- [[_COMMUNITY_Buy Modal & P&L|Buy Modal & P&L]]
- [[_COMMUNITY_Address Book|Address Book]]
- [[_COMMUNITY_NFTs & Chain Config|NFTs & Chain Config]]
- [[_COMMUNITY_Root Layout & Bootstrap|Root Layout & Bootstrap]]
- [[_COMMUNITY_Notification Preferences|Notification Preferences]]
- [[_COMMUNITY_Chart Rendering|Chart Rendering]]
- [[_COMMUNITY_DeFi  Aave Positions|DeFi / Aave Positions]]
- [[_COMMUNITY_Auth Layout & Navigation|Auth Layout & Navigation]]
- [[_COMMUNITY_App Shell & Error Boundary|App Shell & Error Boundary]]
- [[_COMMUNITY_Receive & Networks|Receive & Networks]]
- [[_COMMUNITY_WalletConnect Chain Support|WalletConnect Chain Support]]
- [[_COMMUNITY_Premium  IAP|Premium / IAP]]
- [[_COMMUNITY_Wallet Import|Wallet Import]]
- [[_COMMUNITY_WalletConnect Risk Flags|WalletConnect Risk Flags]]
- [[_COMMUNITY_Sign-In & Auth|Sign-In & Auth]]
- [[_COMMUNITY_Module Cluster 30|Module Cluster 30]]
- [[_COMMUNITY_Module Cluster 31|Module Cluster 31]]
- [[_COMMUNITY_Module Cluster 32|Module Cluster 32]]
- [[_COMMUNITY_Module Cluster 33|Module Cluster 33]]
- [[_COMMUNITY_Module Cluster 34|Module Cluster 34]]
- [[_COMMUNITY_Module Cluster 35|Module Cluster 35]]
- [[_COMMUNITY_Module Cluster 36|Module Cluster 36]]
- [[_COMMUNITY_Module Cluster 37|Module Cluster 37]]
- [[_COMMUNITY_Module Cluster 38|Module Cluster 38]]
- [[_COMMUNITY_Module Cluster 39|Module Cluster 39]]
- [[_COMMUNITY_Module Cluster 40|Module Cluster 40]]
- [[_COMMUNITY_Module Cluster 41|Module Cluster 41]]
- [[_COMMUNITY_Module Cluster 42|Module Cluster 42]]
- [[_COMMUNITY_Module Cluster 43|Module Cluster 43]]
- [[_COMMUNITY_Module Cluster 44|Module Cluster 44]]
- [[_COMMUNITY_Module Cluster 45|Module Cluster 45]]
- [[_COMMUNITY_Module Cluster 46|Module Cluster 46]]
- [[_COMMUNITY_Module Cluster 47|Module Cluster 47]]
- [[_COMMUNITY_Module Cluster 48|Module Cluster 48]]
- [[_COMMUNITY_Module Cluster 49|Module Cluster 49]]
- [[_COMMUNITY_Module Cluster 50|Module Cluster 50]]
- [[_COMMUNITY_Module Cluster 51|Module Cluster 51]]
- [[_COMMUNITY_Module Cluster 52|Module Cluster 52]]
- [[_COMMUNITY_Module Cluster 53|Module Cluster 53]]
- [[_COMMUNITY_Module Cluster 54|Module Cluster 54]]
- [[_COMMUNITY_Module Cluster 55|Module Cluster 55]]
- [[_COMMUNITY_Module Cluster 56|Module Cluster 56]]
- [[_COMMUNITY_Module Cluster 57|Module Cluster 57]]
- [[_COMMUNITY_Module Cluster 58|Module Cluster 58]]
- [[_COMMUNITY_Module Cluster 60|Module Cluster 60]]
- [[_COMMUNITY_Module Cluster 61|Module Cluster 61]]
- [[_COMMUNITY_Module Cluster 62|Module Cluster 62]]
- [[_COMMUNITY_Module Cluster 63|Module Cluster 63]]
- [[_COMMUNITY_Module Cluster 64|Module Cluster 64]]
- [[_COMMUNITY_Module Cluster 68|Module Cluster 68]]
- [[_COMMUNITY_Module Cluster 69|Module Cluster 69]]
- [[_COMMUNITY_Module Cluster 70|Module Cluster 70]]
- [[_COMMUNITY_Module Cluster 71|Module Cluster 71]]
- [[_COMMUNITY_Module Cluster 72|Module Cluster 72]]
- [[_COMMUNITY_Module Cluster 73|Module Cluster 73]]
- [[_COMMUNITY_Module Cluster 74|Module Cluster 74]]
- [[_COMMUNITY_Module Cluster 75|Module Cluster 75]]
- [[_COMMUNITY_Module Cluster 76|Module Cluster 76]]
- [[_COMMUNITY_Module Cluster 77|Module Cluster 77]]
- [[_COMMUNITY_Module Cluster 78|Module Cluster 78]]
- [[_COMMUNITY_Module Cluster 79|Module Cluster 79]]
- [[_COMMUNITY_Module Cluster 80|Module Cluster 80]]
- [[_COMMUNITY_Module Cluster 81|Module Cluster 81]]
- [[_COMMUNITY_Module Cluster 82|Module Cluster 82]]
- [[_COMMUNITY_Module Cluster 83|Module Cluster 83]]
- [[_COMMUNITY_Module Cluster 84|Module Cluster 84]]
- [[_COMMUNITY_Module Cluster 85|Module Cluster 85]]
- [[_COMMUNITY_Module Cluster 86|Module Cluster 86]]
- [[_COMMUNITY_Module Cluster 87|Module Cluster 87]]

## God Nodes (most connected - your core abstractions)
1. `useWalletStore` - 66 edges
2. `goBack()` - 24 edges
3. `useTheme()` - 21 edges
4. `KryptoNowProvider` - 16 edges
5. `storePrivateKey()` - 12 edges
6. `getProvider()` - 11 edges
7. `Settings Screen` - 11 edges
8. `useAuth()` - 10 edges
9. `sendPushNotification()` - 10 edges
10. `loadPrivateKey()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `Create()` --calls--> `useAuth()`  [INFERRED]
  app/create.tsx → context/AuthContext.tsx
- `ConnectedDApps()` --calls--> `useWalletStore`  [EXTRACTED]
  app/dapps.tsx → store/walletStore.ts
- `Dashboard()` --calls--> `useAuth()`  [INFERRED]
  app/dashboard.tsx → context/AuthContext.tsx
- `HardwareWallet()` --calls--> `useWalletStore`  [EXTRACTED]
  app/hardware.tsx → store/walletStore.ts
- `Index()` --calls--> `useAuth()`  [INFERRED]
  app/index.tsx → context/AuthContext.tsx

## Communities (88 total, 32 thin omitted)

### Community 0 - "Batch Send & Transactions"
Cohesion: 0.05
Nodes (58): BatchItem, BatchResult, BatchSend(), makeId(), s, CHAIN_TOKENS, ERC20_ABI, fetchGasData() (+50 more)

### Community 1 - "Analytics & Categorization"
Cohesion: 0.05
Nodes (50): Analytics(), categorise(), Category, CATEGORY_META, CategoryMeta, CategorySummary, KNOWN_SIGS, pill (+42 more)

### Community 2 - "Dashboard & Portfolio View"
Cohesion: 0.06
Nodes (55): ACTIONS, Dashboard(), fmt(), m, NATIVE_BINANCE, NATIVE_CC, NATIVE_CG, NAV_ITEMS (+47 more)

### Community 3 - "Wallet Creation Flow"
Cohesion: 0.06
Nodes (51): Create(), s, Step, { width }, st, UseSecureWalletReturn, WalletAccount, WalletState (+43 more)

### Community 4 - "Buy / Fiat On-Ramp"
Cohesion: 0.07
Nodes (27): AMOUNTS, BuyScreen(), PROVIDERS, STATIC_TOKENS, Token, ChainModal(), Sidebar(), LockScreen() (+19 more)

### Community 5 - "Screens Registry & AA Config"
Cohesion: 0.07
Nodes (37): AddressBook Screen, Analytics Screen, Batch Send Screen, BUNDLER_URLS (Alchemy ERC-4337), CHAINS Config (RPC Endpoints), Local AuthContext (Onboarding, not Clerk), ThemeContext, Create / Import Wallet Screen (+29 more)

### Community 6 - "ERC-4337 Account Abstraction"
Cohesion: 0.06
Nodes (37): chainSupportsAA, createAAClient (ERC-4337 Smart Account), sendBatchUserOp (AA Batch Transaction), sendUserOp (AA Transaction), AsyncStorage (Legacy Key Storage - Pre-Migration), deriveWallet (BIP-44 HD Key Derivation), generateMnemonic (BIP-39), announceEIP6963Provider (Multi-Wallet Discovery) (+29 more)

### Community 7 - "WalletConnect Approval"
Cohesion: 0.11
Nodes (23): ApprovalModal(), ApprovalRequest, f, f2, rb, s, AMOUNT_KEYS, DEADLINE_KEYS (+15 more)

### Community 8 - "Social Recovery"
Cohesion: 0.12
Nodes (24): s, SocialRecoveryScreen(), Tab, buildRecoveryLink(), RecoveryLinkParams, shareRecoveryLink(), getNotifications(), notifyGuardianSignRequired() (+16 more)

### Community 9 - "Portfolio Charts"
Cohesion: 0.08
Nodes (17): PortfolioScreen(), RANGES, st, polarToXY(), Props, Slice, slicePath(), st (+9 more)

### Community 10 - "DApps & WalletConnect"
Cohesion: 0.12
Nodes (12): ConnectedDApps(), s, DAppSession, disconnectDApp(), EIP6963ProviderDetail, EIP6963ProviderInfo, getConnectedDApps(), KRYPTONOW_INFO (+4 more)

### Community 11 - "Launch Risks & Blockers"
Cohesion: 0.07
Nodes (27): RISK: /mfa Route Referenced but Not Verified to Exist, RISK: /recovery Route Referenced but Not Verified to Exist, RISK: Seed Phrase Copyable to Clipboard from Alert, RISK: Swap Generates Fake TxHash When No API Key (no real swap), AuthContext (Profile / Preferences), ERC-4337 AA Send Path, ENS Name Resolution, Standard EOA Send Path (+19 more)

### Community 12 - "Swap UI"
Cohesion: 0.13
Nodes (19): pk, s, sl, SLIPPAGE_PRESETS, Swap(), SwapStep, TOKEN_COLORS, tokenColor() (+11 more)

### Community 13 - "Price Alerts"
Cohesion: 0.19
Nodes (21): AddAlertModal(), AlertRow(), fmtPrice(), m, PriceAlertsScreen(), r, relTime(), s (+13 more)

### Community 14 - "Secure Storage & Crypto Keys"
Cohesion: 0.12
Nodes (18): RISK: WalletData.phrase May Be Stored in AsyncStorage (plaintext) Before Migration, RISK: APP_SECRET Defaults to Hardcoded Dev Secret if EXPO_PUBLIC_VAULT_SECRET Not Set, RISK: webVault Falls Back to Plaintext localStorage on Encrypt Failure, SecureStore WHEN_PASSCODE_SET_THIS_DEVICE_ONLY Access Policy, migrateFromWalletStore (AsyncStorage -> Enclave migration), retrievePrivateKey (biometric gated), storeMnemonic (SecureStore biometric gated), storeMnemonicAndKey (atomic wallet creation) (+10 more)

### Community 15 - "Buy Modal & P&L"
Cohesion: 0.13
Nodes (13): bm, BuyModal(), calcPnL(), GreekKey, oc, OptionCard(), OptionContract, OptionExpiry (+5 more)

### Community 16 - "Address Book"
Cohesion: 0.15
Nodes (8): COLORS, Contact, ContactRow(), initials(), m, r, s, shortAddr()

### Community 17 - "NFTs & Chain Config"
Cohesion: 0.14
Nodes (10): ALCHEMY_BASE, CHAIN_NAMES, d, g, NFT, NFTGallery(), s, SendNFTModal() (+2 more)

### Community 18 - "Root Layout & Bootstrap"
Cohesion: 0.18
Nodes (8): getTokenCache(), RootLayout(), WalletBootstrap(), ErrorBoundary, Props, State, styles, applyWebShadowPatch()

### Community 19 - "Notification Preferences"
Cohesion: 0.22
Nodes (10): checkPriceAlert(), DEFAULT_PREFS, loadNotifHistory(), loadNotifPrefs(), markAllRead(), NotifPrefs, NotifRecord, pollForNewTransactions() (+2 more)

### Community 20 - "Chart Rendering"
Cohesion: 0.23
Nodes (10): buildChartHtml(), Props, RANGE_LABELS, RANGES, st, TokenChartModal(), { width: SCREEN_W }, PricePoint (+2 more)

### Community 21 - "DeFi / Aave Positions"
Cohesion: 0.2
Nodes (9): AAVE_V3_SUBGRAPH, AavePosition, DeFiSummary, fetchAavePositions(), fetchUniswapPositions(), queryGraph(), TokenApproval, UNISWAP_V3_SUBGRAPH (+1 more)

### Community 22 - "Auth Layout & Navigation"
Cohesion: 0.18
Nodes (7): Index(), s, AppLayout(), Onboarding(), SSOCallback(), AuthLayout(), useAuth()

### Community 23 - "App Shell & Error Boundary"
Cohesion: 0.24
Nodes (10): RISK: SSO Callback Uses postMessage with Wildcard Origin (*), ErrorBoundary Component, App Layout ((app)/_layout.tsx), Auth Layout ((auth)/_layout.tsx), Root Layout (_layout.tsx), Email OTP Sign-In / Sign-Up, MFA Flow (TOTP / SMS / Backup Code), OAuth Flow (Google / Discord SSO) (+2 more)

### Community 24 - "Receive & Networks"
Cohesion: 0.28
Nodes (6): NETWORKS, s, FAQS, s, Support(), goBack()

### Community 25 - "WalletConnect Chain Support"
Cohesion: 0.22
Nodes (7): s, SUPPORTED_CHAINS, SUPPORTED_EVENTS, SUPPORTED_METHODS, WalletConnectScreen(), WCRequest, WCSession

### Community 26 - "Premium / IAP"
Cohesion: 0.28
Nodes (7): FeatureAccess, FEATURES, PLANS, PremiumScreen(), s, usePushNotifications(), useWalletStore

### Community 27 - "Wallet Import"
Cohesion: 0.31
Nodes (5): Import(), s, DerivedWallet, deriveWallet(), validateMnemonic()

### Community 28 - "WalletConnect Risk Flags"
Cohesion: 0.22
Nodes (9): RISK: ApprovalModal Only Works on Web (no native dApp approval UI), RISK: Hardcoded WalletConnect Project ID, ApprovalModal Component, RiskBadge (safe/caution/danger), ApprovalModal Web-Only Event Listener, WalletConnect Session Request Handler, WC Signing Methods (personal_sign, eth_sign, signTypedData, sendTransaction), WalletConnect Project ID (hardcoded) (+1 more)

### Community 29 - "Sign-In & Auth"
Cohesion: 0.29
Nodes (5): p, s, SignIn(), useOAuthFlow(), { width, height }

### Community 30 - "Module Cluster 30"
Cohesion: 0.29
Nodes (4): s, SECURE_KEYS, storage, storageSync

### Community 31 - "Module Cluster 31"
Cohesion: 0.25
Nodes (5): ConnectedDevice, HardwareWallet(), HWDevice, HWStatus, s

### Community 32 - "Module Cluster 32"
Cohesion: 0.25
Nodes (7): AIAssistant(), b, c, Message, QUICK_PROMPTS, Role, { width: SW, height: SH }

### Community 33 - "Module Cluster 33"
Cohesion: 0.29
Nodes (6): CountryCode, MFAMethod, MFASetup(), MFAStep, s, COUNTRY_CODES

### Community 34 - "Module Cluster 34"
Cohesion: 0.25
Nodes (8): RISK: biometricUnlock() is a No-Op Stub (always unlocks), RISK: PIN Hash Stored in localStorage (web, no secure enclave), RISK: Weak PIN Hash (djb2 variant, not cryptographic), PIN stored in localStorage (web only), LockContext / LockProvider, PIN Hashing (djb2 variant), Biometric Unlock (Face ID / Fingerprint), LockScreen Component

### Community 35 - "Module Cluster 35"
Cohesion: 0.29
Nodes (6): AVATARS, CHAINS, CURRENCIES, EMOJI, s, Step

### Community 36 - "Module Cluster 36"
Cohesion: 0.33
Nodes (6): calcEarnings(), EarnScreen(), RISK_COLOR, s, YIELD_PRODUCTS, YieldProduct

### Community 37 - "Module Cluster 37"
Cohesion: 0.29
Nodes (3): ChainCache, WalletData, WalletState

### Community 38 - "Module Cluster 38"
Cohesion: 0.33
Nodes (7): addNotification (localStorage only), checkCustomPriceAlerts (CoinGecko + push), sendPriceAlert, sendPushNotification (OS-level + in-app), sendSecurityAlert, sendTxNotification, startTxWatcher (Alchemy polling)

### Community 39 - "Module Cluster 39"
Cohesion: 0.33
Nodes (4): AuthContext, AuthContextType, DEFAULT_PROFILE, UserProfile

### Community 40 - "Module Cluster 40"
Cohesion: 0.4
Nodes (3): EDGES, NODES, Props

### Community 41 - "Module Cluster 41"
Cohesion: 0.5
Nodes (4): RISK: guardianPrivateKey Passed as Plain String Parameter in executeRecovery, Guardian Interface (EIP-712 social recovery), executeRecovery (LightAccount.transferOwnership), signRecoveryRequest (EIP-712 viem)

### Community 44 - "Module Cluster 44"
Cohesion: 0.5
Nodes (4): Notifications Screen, Price Alerts Screen, RISK: Demo Seed Data in Production Build, Price Alerts Utility

### Community 45 - "Module Cluster 45"
Cohesion: 0.5
Nodes (4): RISK: Hardcoded 1inch API Key Placeholder, 1inch API Key (placeholder hardcoded), getQuote (1inch Swap API v6), getSwapData (1inch Swap Calldata)

### Community 46 - "Module Cluster 46"
Cohesion: 0.5
Nodes (4): expo-local-authentication (Face ID / Fingerprint), expo-secure-store (PIN Hash Storage), RISK: Weak PIN Hash (djb2 variant, not bcrypt/PBKDF2), useLock Hook (PIN + Biometric Auth)

### Community 48 - "Module Cluster 48"
Cohesion: 0.67
Nodes (3): RISK: Tenderly API URL Uses Template Literal as String (not interpolated) - Bug, simulateTransaction (Tenderly Auth API), simulateTransaction (Tenderly Public Gateway)

### Community 49 - "Module Cluster 49"
Cohesion: 0.67
Nodes (3): RISK: Groq API Key as String Literal (not env var resolution), AI Assistant Component, Groq API Key (string literal, not env var)

### Community 51 - "Module Cluster 51"
Cohesion: 0.67
Nodes (3): Hardware Wallet Screen, RISK: Hardware Wallet Data in localStorage, RISK: Trezor Script Dynamically Injected from External Origin

### Community 52 - "Module Cluster 52"
Cohesion: 0.67
Nodes (3): LockContext, Lock / PIN Screen, RISK: No Biometric Authentication Fallback on Lock Screen

### Community 53 - "Module Cluster 53"
Cohesion: 0.67
Nodes (3): AsyncStorage Notification History Storage, pollForNewTransactions (background block scan), registerForPushNotifications (Expo/FCM)

### Community 54 - "Module Cluster 54"
Cohesion: 0.67
Nodes (3): buildRecoveryLink (kryptonow:// scheme), notifyRecoveryInitiated (expo-notifications), RecoveryConfig (AsyncStorage/localStorage)

### Community 55 - "Module Cluster 55"
Cohesion: 0.67
Nodes (3): Clerk useOAuth (Google Sign-In), RISK: console.log of FCM Token and Auth Redirect URL in Production, useGoogleAuth Hook (OAuth via Clerk)

## Ambiguous Edges - Review These
- `AddressBook Screen` → `RISK: Hardcoded ENS RPC Endpoint`  [AMBIGUOUS]
  mobile/app/addressbook.tsx · relation: HAS_RISK
- `AddressBook Screen` → `RISK: No Error Boundaries on Any Screen`  [AMBIGUOUS]
  mobile/app/addressbook.tsx · relation: HAS_RISK
- `Analytics Screen` → `RISK: Analytics Contract Classification Always Returns 'contract'`  [AMBIGUOUS]
  mobile/app/analytics.tsx · relation: HAS_RISK
- `Create / Import Wallet Screen` → `RISK: Private Key Stored in localStorage (Web)`  [AMBIGUOUS]
  mobile/app/create.tsx · relation: HAS_RISK
- `Create / Import Wallet Screen` → `RISK: No Error Boundaries on Any Screen`  [AMBIGUOUS]
  mobile/app/create.tsx · relation: HAS_RISK
- `Dashboard Screen` → `RISK: EIP-1193 Provider Init Blocked by Empty Phrase`  [AMBIGUOUS]
  mobile/app/dashboard.tsx · relation: HAS_RISK
- `Dashboard Screen` → `RISK: No Error Boundaries on Any Screen`  [AMBIGUOUS]
  mobile/app/dashboard.tsx · relation: HAS_RISK
- `Earn (DeFi Yield) Screen` → `RISK: Earn Deposit is Coming Soon — Incomplete Feature`  [AMBIGUOUS]
  mobile/app/earn.tsx · relation: HAS_RISK
- `Hardware Wallet Screen` → `RISK: Hardware Wallet Data in localStorage`  [AMBIGUOUS]
  mobile/app/hardware.tsx · relation: HAS_RISK
- `Hardware Wallet Screen` → `RISK: Trezor Script Dynamically Injected from External Origin`  [AMBIGUOUS]
  mobile/app/hardware.tsx · relation: HAS_RISK
- `Import Wallet Screen` → `RISK: EIP-1193 Provider Init Blocked by Empty Phrase`  [AMBIGUOUS]
  mobile/app/import.tsx · relation: CAUSES_RISK
- `Entry Router (index.tsx)` → `RISK: Wildcard postMessage Origin`  [AMBIGUOUS]
  mobile/app/index.tsx · relation: HAS_RISK
- `Lock / PIN Screen` → `RISK: No Biometric Authentication Fallback on Lock Screen`  [AMBIGUOUS]
  mobile/app/lock.tsx · relation: HAS_RISK
- `NFT Gallery Screen` → `RISK: Hardcoded Alchemy API Key Fallback`  [AMBIGUOUS]
  mobile/app/nfts.tsx · relation: HAS_RISK
- `NFT Gallery Screen` → `RISK: No Error Boundaries on Any Screen`  [AMBIGUOUS]
  mobile/app/nfts.tsx · relation: HAS_RISK
- `Notifications Screen` → `RISK: Demo Seed Data in Production Build`  [AMBIGUOUS]
  mobile/app/notifications.tsx · relation: HAS_RISK
- `DeFi Options Trading Screen` → `RISK: Simulated Options Trading — Misleading UI`  [AMBIGUOUS]
  mobile/app/options.tsx · relation: HAS_RISK
- `Premium Subscription Screen` → `RISK: Simulated IAP — App Store Rejection`  [AMBIGUOUS]
  mobile/app/premium.tsx · relation: HAS_RISK
- `Key Store (loadPrivateKey / savePrivateKey / saveWalletKeys)` → `RISK: Private Key Stored in localStorage (Web)`  [AMBIGUOUS]
  mobile/app/create.tsx · relation: BYPASSED_BY
- `Alchemy NFT API (v3)` → `RISK: Hardcoded Alchemy API Key Fallback`  [AMBIGUOUS]
  mobile/app/nfts.tsx · relation: EXPOSED_BY

## Knowledge Gaps
- **364 isolated node(s):** `Contact`, `COLORS`, `s`, `r`, `m` (+359 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `AddressBook Screen` and `RISK: Hardcoded ENS RPC Endpoint`?**
  _Edge tagged AMBIGUOUS (relation: HAS_RISK) - confidence is low._
- **What is the exact relationship between `AddressBook Screen` and `RISK: No Error Boundaries on Any Screen`?**
  _Edge tagged AMBIGUOUS (relation: HAS_RISK) - confidence is low._
- **What is the exact relationship between `Analytics Screen` and `RISK: Analytics Contract Classification Always Returns 'contract'`?**
  _Edge tagged AMBIGUOUS (relation: HAS_RISK) - confidence is low._
- **What is the exact relationship between `Create / Import Wallet Screen` and `RISK: Private Key Stored in localStorage (Web)`?**
  _Edge tagged AMBIGUOUS (relation: HAS_RISK) - confidence is low._
- **What is the exact relationship between `Create / Import Wallet Screen` and `RISK: No Error Boundaries on Any Screen`?**
  _Edge tagged AMBIGUOUS (relation: HAS_RISK) - confidence is low._
- **What is the exact relationship between `Dashboard Screen` and `RISK: EIP-1193 Provider Init Blocked by Empty Phrase`?**
  _Edge tagged AMBIGUOUS (relation: HAS_RISK) - confidence is low._
- **What is the exact relationship between `Dashboard Screen` and `RISK: No Error Boundaries on Any Screen`?**
  _Edge tagged AMBIGUOUS (relation: HAS_RISK) - confidence is low._