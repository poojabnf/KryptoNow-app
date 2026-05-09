// src/content.ts - The Bridge between page and background worker
//
// Security: We validate event.source === window (same-frame only) and check
// event.origin against the extension's own origin when sending responses back.
// Responses are posted to the page's own origin rather than '*' so they cannot
// be read by cross-origin frames embedded in the page.

console.log('KryptoNow Content Script active.')

const injectScript = () => {
  try {
    const script = document.createElement('script')
    script.src = chrome.runtime.getURL('src/injected.ts')
    script.onload = () => script.remove()
    ;(document.head || document.documentElement).appendChild(script)
  } catch (error) {
    console.error('KryptoNow injection failed.', error)
  }
}

injectScript()

// Bridge: page → background worker
window.addEventListener('message', (event) => {
  // Only accept messages originating from this same window (same frame, same origin)
  if (event.source !== window) return
  if (!event.data || event.data.target !== 'KRYPTONOW_EXT') return

  chrome.runtime.sendMessage(event.data, (response) => {
    // Respond to the page's own origin only — never wildcard
    window.postMessage(
      { target: 'KRYPTONOW_PAGE', id: event.data.id, response },
      window.location.origin,
    )
  })
})
