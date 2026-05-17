/**
 * content/index.ts
 * ----------------
 * Content Script running in host website isolated DOM.
 * Injects standard ethereum.js provider and relays message events to/from Background script.
 */

// --- 1. Inject the Web3 ethereum.js bundle ------------------------------------
try {
  const container = document.head || document.documentElement
  const script = document.createElement('script')
  script.src = chrome.runtime.getURL('ethereum.js')
  script.type = 'text/javascript'
  script.async = false
  container.insertBefore(script, container.firstChild)
  script.remove() // cleanup DOM trace
} catch (e) {
  console.error('[KryptoNow] Injection failed:', e)
}

// --- 2. Message Event Bridge --------------------------------------------------
window.addEventListener('KRYPTONOW_RPC_REQUEST', (event: Event) => {
  const customEvent = event as CustomEvent
  const { requestId, method, params } = customEvent.detail

  // Forward webpage request directly to the secure extension background worker
  chrome.runtime.sendMessage({ method, params }, (response) => {
    // Send response back to webpage context via unique custom event
    const responseEvent = new CustomEvent(`KRYPTONOW_RPC_RESPONSE_${requestId}`, {
      detail: {
        requestId,
        result: response?.result ?? null,
        error: response?.error ?? null
      }
    })
    window.dispatchEvent(responseEvent)
  })
})
