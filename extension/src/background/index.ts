/**
 * background/index.ts
 * -------------------
 * Extension Background Service Worker (Manifest V3).
 * Intercepts Web3 DApp RPC messages and coordinates window prompts.
 */

// Simple active connection cache
let activeSession: { connected: boolean; address: string | null } = {
  connected: false,
  address: null
}

// Load active session from persistent local chrome storage on startup
chrome.storage.local.get(['vault_address', 'session_connected'], (res) => {
  if (res.vault_address) {
    activeSession.address = res.vault_address
    activeSession.connected = !!res.session_connected
  }
})

// Listen for updates from popup UI (such as unlock or password derivation events)
chrome.storage.onChanged.addListener((changes) => {
  if (changes.vault_address) {
    activeSession.address = changes.vault_address.newValue
  }
  if (changes.session_connected) {
    activeSession.connected = !!changes.session_connected.newValue
  }
})

// --- Handle incoming RPC requests from content.js ----------------------------
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  const { method, params } = request
  console.log(`[KryptoNow Background] RPC Method: ${method}`, params)

  switch (method) {
    case 'eth_accounts':
      // Return address if unlocked and connected, else empty array
      if (activeSession.connected && activeSession.address) {
        sendResponse({ result: [activeSession.address] })
      } else {
        sendResponse({ result: [] })
      }
      break

    case 'eth_requestAccounts':
      // If already connected, return active address instantly
      if (activeSession.connected && activeSession.address) {
        sendResponse({ result: [activeSession.address] })
      } else {
        // Open secure popup window prompting user approval (just like MetaMask!)
        chrome.windows.create({
          url: chrome.runtime.getURL('popup.html?action=connect'),
          type: 'popup',
          width: 360,
          height: 600
        })

        // Listen for connection approval in storage
        const checkApproval = (changes: Record<string, any>, namespace: string) => {
          if (namespace === 'local' && changes.session_connected?.newValue === true) {
            chrome.storage.onChanged.removeListener(checkApproval)
            chrome.storage.local.get('vault_address', (res) => {
              sendResponse({ result: [res.vault_address ?? ''] })
            })
          }
        }
        chrome.storage.onChanged.addListener(checkApproval)
      }
      break

    case 'eth_chainId':
      // Return default chain ID 1 (Ethereum Mainnet)
      sendResponse({ result: '0x1' })
      break

    case 'net_version':
      sendResponse({ result: '1' })
      break

    case 'personal_sign':
    case 'eth_signTypedData_v4':
    case 'eth_sendTransaction':
      // Trigger a secure signature approval window
      chrome.windows.create({
        url: chrome.runtime.getURL(`popup.html?action=sign&method=${method}&params=${encodeURIComponent(JSON.stringify(params))}`),
        type: 'popup',
        width: 360,
        height: 600
      })

      // Await popup approval or rejection signals
      const checkSignature = (changes: Record<string, any>, namespace: string) => {
        if (namespace === 'local' && changes.pending_rpc_result) {
          chrome.storage.onChanged.removeListener(checkSignature)
          const result = changes.pending_rpc_result.newValue
          chrome.storage.local.remove('pending_rpc_result')
          
          if (result.error) {
            sendResponse({ error: result.error })
          } else {
            sendResponse({ result: result.txHash ?? result.signature })
          }
        }
      }
      chrome.storage.onChanged.addListener(checkSignature)
      break

    default:
      // Forward unhandled read-only RPC requests to public RPC node
      fetch('https://cloudflare-eth.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params: params ?? []
        })
      })
        .then(res => res.json())
        .then(data => {
          sendResponse({ result: data.result, error: data.error })
        })
        .catch(err => {
          sendResponse({ error: err.message })
        })
      break
  }

  return true // Keeps message port open for asynchronous responses!
})
