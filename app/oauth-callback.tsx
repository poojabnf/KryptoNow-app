import { useEffect } from "react"
import { View, ActivityIndicator, Platform } from "react-native"
import * as WebBrowser from "expo-web-browser"

/**
 * OAuth popup callback page.
 *
 * Native: maybeCompleteAuthSession() posts the URL back to the opener and
 * closes the in-app browser session.
 *
 * Web: Clerk's startSSOFlow opens a real popup via window.open().  After the
 * OAuth redirect lands here, window.opener may be null (browsers null it out
 * after cross-origin hops through Google → Clerk → back), so
 * maybeCompleteAuthSession() silently does nothing.  We therefore call
 * window.close() directly — that always closes a script-opened popup regardless
 * of opener state.  If this turns out to be the main window (full-redirect flow),
 * window.close() is a no-op and the 500 ms timeout redirects home instead.
 */
export default function OAuthCallback() {
  useEffect(() => {
    // Native deep-link path
    WebBrowser.maybeCompleteAuthSession()

    if (Platform.OS !== "web") return

    // Web popup path: close the popup so the parent window can take over
    window.close()

    // Fallback: if window.close() was a no-op (this IS the main window after a
    // full-redirect OAuth flow), navigate home after a brief pause so the Clerk
    // session has time to be written to localStorage before the redirect.
    const t = setTimeout(() => {
      if (!window.closed) window.location.replace("/")
    }, 500)

    return () => clearTimeout(t)
  }, [])

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0D2E2E" }}>
      <ActivityIndicator size="large" color="#00D4AA" />
    </View>
  )
}
