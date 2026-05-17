import { router, type Href } from 'expo-router'

/** Go back when possible; otherwise navigate to a safe screen (default dashboard). */
export function goBack(fallback: Href = '/dashboard') {
  if (router.canGoBack()) {
    router.back()
  } else {
    router.replace(fallback)
  }
}
