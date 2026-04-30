const fs = require('fs')

console.log('=== KryptoNow.xyz Domain Update ===\n')

const filesToFix = [
  'App.tsx', 'app.json', 'package.json',
  'index.js', 'index.ts', 'security.ts',
  'tokens.ts', 'defi.ts', 'premium.ts',
  'onramp.ts', 'rpc.ts', 'hooks/useGoogleAuth.ts',
]

const replacements = [
  // Old domains → new domain
  { from: 'KryptoNow.xyz', to: 'kryptonow.xyz' },
  { from: 'KryptoNow.com', to: 'kryptonow.xyz' },
  { from: 'KryptoNow.xyz', to: 'kryptonow.xyz' },
  { from: 'KryptoNow.com', to: 'kryptonow.xyz' },
  // Old accounts subdomains
  { from: 'accounts.KryptoNow.xyz', to: 'accounts.kryptonow.xyz' },
  { from: 'clerk.KryptoNow.xyz', to: 'accounts.kryptonow.xyz' },
  // App names
  { from: 'KryptoNow', to: 'KryptoNow' },
  { from: 'KryptoNow', to: 'kryptonow' },
  { from: 'KryptoNow', to: 'KRYPTONOW' },
  { from: 'KryptoNow', to: 'KryptoNow' },
  { from: 'KryptoNow', to: 'kryptonow' },
  // Bundle IDs
  { from: 'com.KryptoNow.app', to: 'com.kryptonow.app' },
  { from: 'com.KryptoNow.app', to: 'com.kryptonow.app' },
  { from: 'com.poojaya2k19.KryptoNow', to: 'com.kryptonow.app' },
  // Schemes
  { from: 'KryptoNow://', to: 'kryptonow://' },
  { from: 'KryptoNow://', to: 'kryptonow://' },
]

filesToFix.forEach(f => {
  if (!fs.existsSync(f)) { console.log('SKIP: ' + f); return }
  let content = fs.readFileSync(f, 'utf8')
  const original = content
  replacements.forEach(({ from, to }) => {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    content = content.replace(new RegExp(escaped, 'g'), to)
  })
  if (content !== original) {
    fs.writeFileSync(f, content)
    console.log('✓ Fixed: ' + f)
  } else {
    console.log('  OK: ' + f)
  }
})

// Force correct app.json values
const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'))
appJson.expo.name = 'KryptoNow'
appJson.expo.slug = 'kryptonow'
appJson.expo.scheme = 'kryptonow'
if (!appJson.expo.ios) appJson.expo.ios = {}
if (!appJson.expo.android) appJson.expo.android = {}
appJson.expo.ios.bundleIdentifier = 'com.kryptonow.app'
appJson.expo.android.package = 'com.kryptonow.app'
if (!appJson.expo.extra) appJson.expo.extra = {}
appJson.expo.extra.website = 'https://kryptonow.xyz'
fs.writeFileSync('app.json', JSON.stringify(appJson, null, 2))
console.log('✓ Fixed: app.json')

// Fix package.json
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.name = 'kryptonow-app'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2))
console.log('✓ Fixed: package.json')

// Update auth hook with correct domain
if (!fs.existsSync('hooks')) fs.mkdirSync('hooks')
const hook = `import { useOAuth } from "@clerk/expo"
import { useCallback } from "react"
import { Alert } from "react-native"
import * as WebBrowser from "expo-web-browser"
import * as Linking from "expo-linking"

WebBrowser.maybeCompleteAuthSession()

export function useGoogleAuth() {
  const { startOAuthFlow } = useOAuth({ strategy: "oauth_google" })

  const signInWithGoogle = useCallback(async () => {
    try {
      const redirectUrl = Linking.createURL("/oauth-callback", { scheme: "kryptonow" })
      console.log("=== KRYPTONOW AUTH ===")
      console.log("Redirect URL:", redirectUrl)

      const { createdSessionId, setActive, signIn, signUp } = await startOAuthFlow({ redirectUrl })

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId })
        console.log("Signed in successfully")
      } else if (signIn) {
        Alert.alert("Extra step", "signIn status: " + signIn.status)
      } else if (signUp) {
        Alert.alert("Extra step", "signUp status: " + signUp.status)
      }
    } catch (err) {
      console.log("Auth error:", JSON.stringify(err, null, 2))
      Alert.alert("Sign in failed", err.message || "Something went wrong")
    }
  }, [startOAuthFlow])

  return { signInWithGoogle }
}
`
fs.writeFileSync('hooks/useGoogleAuth.ts', hook)
console.log('✓ Fixed: hooks/useGoogleAuth.ts')

console.log('\n=== FINAL VALUES ===')
const v = JSON.parse(fs.readFileSync('app.json', 'utf8'))
console.log('Name:    ', v.expo.name)
console.log('Slug:    ', v.expo.slug)
console.log('Scheme:  ', v.expo.scheme)
console.log('iOS:     ', v.expo.ios.bundleIdentifier)
console.log('Android: ', v.expo.android.package)
console.log('Website: ', v.expo.extra.website)
console.log('\nAll done! Run: npx expo start --clear')

