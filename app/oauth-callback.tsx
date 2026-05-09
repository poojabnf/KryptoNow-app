import { useEffect } from "react"
import { View, ActivityIndicator } from "react-native"
import * as WebBrowser from "expo-web-browser"

/**
 * Dedicated OAuth callback route for web popup SSO flows (Google, Discord).
 *
 * After Google/Discord redirect back here, maybeCompleteAuthSession() reads
 * the auth params from the URL, posts them back to the opener window, and
 * closes this popup. Nothing else should render or navigate on this page —
 * any Expo Router navigation would strip the URL params before the handshake
 * completes, leaving the popup open.
 */
export default function OAuthCallback() {
  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession()
  }, [])

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0D2E2E" }}>
      <ActivityIndicator size="large" color="#00D4AA" />
    </View>
  )
}
