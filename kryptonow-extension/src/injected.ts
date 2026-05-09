// src/injected.ts - The EIP-1193 Provider Interface
//
// Security: postMessage is unavoidable for injected<->content communication,
// but we scope the target origin to the extension's own URL and validate
// event.source so cross-origin frames cannot spoof responses.
// Sensitive operations (sign, sendTransaction) are handled by the background
// worker behind the extension popup approval flow — not resolved here directly.

const EXTENSION_ORIGIN = document.currentScript
  ? (document.currentScript as HTMLScriptElement).src.split('/src/')[0]
  : undefined

window.ethereum = {
  isKryptoNow: true,
  request: async ({ method, params }) => {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID()

      const listener = (event: MessageEvent) => {
        if (event.source !== window) return
        if (!event.data || event.data.target !== 'KRYPTONOW_PAGE' || event.data.id !== id) return
        window.removeEventListener('message', listener)

        if (event.data.response?.error) reject(event.data.response.error)
        else resolve(event.data.response?.result)
      }

      window.addEventListener('message', listener)
      // Target the extension origin when known; fall back to same-origin only.
      const targetOrigin = EXTENSION_ORIGIN ?? window.location.origin
      window.postMessage({ target: 'KRYPTONOW_EXT', id, method, params }, targetOrigin)
    })
  },
}

console.log('KryptoNow window.ethereum provider is ready.')
