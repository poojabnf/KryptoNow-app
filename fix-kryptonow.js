const fs = require('fs')

const filesToFix = [
  'App.tsx',
  'app.json',
  'package.json',
  'index.js',
  'index.ts',
  'security.ts',
  'tokens.ts',
  'defi.ts',
  'premium.ts',
  'onramp.ts',
  'hooks/useGoogleAuth.ts',
]

const replacements = [
  // KryptoNow variants → KryptoNow
  { from: 'KryptoNow Wallet', to: 'KryptoNow' },
  { from: 'KryptoNow', to: 'KryptoNow' },
  { from: 'KryptoNow-wallet', to: 'kryptonow' },
  { from: 'KryptoNow', to: 'kryptonow' },
  { from: 'KryptoNow', to: 'KRYPTONOW' },
  // KryptoNow variants → KryptoNow
  { from: 'KryptoNow', to: 'KryptoNow' },
  { from: 'KryptoNow', to: 'kryptonow' },
  { from: 'KryptoNow', to: 'KRYPTONOW' },
  // Schemes
  { from: 'KryptoNow://', to: 'kryptonow://' },
  { from: 'KryptoNow://', to: 'kryptonow://' },
  // Bundle IDs
  { from: 'com.KryptoNow.app', to: 'com.kryptonow.app' },
  { from: 'com.KryptoNow.app', to: 'com.kryptonow.app' },
]

filesToFix.forEach(f => {
  if (!fs.existsSync(f)) { console.log('SKIP (not found): ' + f); return }

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
    console.log('  OK (no changes): ' + f)
  }
})

// Force correct values in app.json
const appJson = JSON.parse(fs.readFileSync('app.json', 'utf8'))
appJson.expo.name = 'KryptoNow'
appJson.expo.slug = 'kryptonow'
appJson.expo.scheme = 'kryptonow'
if (appJson.expo.ios) appJson.expo.ios.bundleIdentifier = 'com.kryptonow.app'
if (appJson.expo.android) appJson.expo.android.package = 'com.kryptonow.app'
fs.writeFileSync('app.json', JSON.stringify(appJson, null, 2))
console.log('✓ Fixed: app.json (forced correct values)')

// Fix package.json
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
pkg.name = 'kryptonow-app'
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2))
console.log('✓ Fixed: package.json')

console.log('\n=== VERIFY ===')
const verify = JSON.parse(fs.readFileSync('app.json', 'utf8'))
console.log('App name:', verify.expo.name)
console.log('Slug:', verify.expo.slug)
console.log('Scheme:', verify.expo.scheme)
console.log('iOS bundle:', verify.expo.ios?.bundleIdentifier)
console.log('Android pkg:', verify.expo.android?.package)
console.log('\nDone! Now run: npx expo start --clear')

