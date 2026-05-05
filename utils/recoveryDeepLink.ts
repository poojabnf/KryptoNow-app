/**
 * utils/recoveryDeepLink.ts
 * --------------------------
 * Generate + parse shareable recovery deep links.
 * Format: kryptonow://recovery?requestId=...&smartAccount=...&newOwner=...&deadline=...
 *
 * Guardian taps link  app opens  pre-fills sign modal  one-tap approve
 */
import { Linking, Platform } from 'react-native'

const SCHEME  = 'kryptonow'
const WEB_URL = 'https://kryptonow.xyz'

export interface RecoveryLinkParams {
  requestId:    string
  smartAccount: string
  newOwner:     string
  deadline:     number
  chainId:      number
}

export function buildRecoveryLink(params: RecoveryLinkParams): string {
  const query = new URLSearchParams({
    requestId:    params.requestId,
    smartAccount: params.smartAccount,
    newOwner:     params.newOwner,
    deadline:     String(params.deadline),
    chainId:      String(params.chainId),
  }).toString()

  if (Platform.OS === 'web') {
    return `${WEB_URL}/recovery?${query}`
  }
  return `${SCHEME}://recovery?${query}`
}

export function parseRecoveryLink(url: string): RecoveryLinkParams | null {
  try {
    const u      = new URL(url.replace(`${SCHEME}://`, 'http://placeholder/'))
    const params = u.searchParams
    const requestId    = params.get('requestId')
    const smartAccount = params.get('smartAccount')
    const newOwner     = params.get('newOwner')
    const deadline     = params.get('deadline')
    const chainId      = params.get('chainId')

    if (!requestId || !smartAccount || !newOwner || !deadline || !chainId) return null

    return {
      requestId,
      smartAccount,
      newOwner,
      deadline:  parseInt(deadline),
      chainId:   parseInt(chainId),
    }
  } catch { return null }
}

export async function shareRecoveryLink(params: RecoveryLinkParams): Promise<void> {
  const link = buildRecoveryLink(params)

  if (Platform.OS === 'web') {
    if (navigator.share) {
      await navigator.share({
        title: 'KryptoNow Recovery Request',
        text:  'Please sign this recovery request to help restore wallet access.',
        url:   link,
      })
    } else {
      await navigator.clipboard.writeText(link)
    }
    return
  }

  const { Share } = await import('react-native')
  await Share.share({
    message: `KryptoNow wallet recovery request. Tap to sign:\n${link}`,
    url:     link,
  })
}

export function registerDeepLinkHandler(
  onRecoveryLink: (params: RecoveryLinkParams) => void
): () => void {
  const handler = ({ url }: { url: string }) => {
    if (url.includes('recovery')) {
      const params = parseRecoveryLink(url)
      if (params) onRecoveryLink(params)
    }
  }

  const sub = Linking.addEventListener('url', handler)

  Linking.getInitialURL().then(url => {
    if (url && url.includes('recovery')) {
      const params = parseRecoveryLink(url)
      if (params) onRecoveryLink(params)
    }
  })

  return () => sub.remove()
}
