const fs = require('fs')
let content = fs.readFileSync('App.tsx', 'utf8')

if (content.includes('maybeCompleteAuthSession')) {
  console.log('Already present — no change needed')
} else {
  // Add at the very top of the file
  content = 'import * as WebBrowser from "expo-web-browser"\nWebBrowser.maybeCompleteAuthSession()\n\n' + content
  fs.writeFileSync('App.tsx', content)
  console.log('Added maybeCompleteAuthSession to top of App.tsx')
}
