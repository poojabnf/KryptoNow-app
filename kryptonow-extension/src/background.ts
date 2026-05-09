// src/background.ts
console.log('KryptoNow Background Worker initialized.')

// Wallet state is loaded from encrypted extension storage, never hardcoded.
let isUnlocked = false
let userAddress: string | null = null

// Restore session state from chrome.storage.local on startup
chrome.storage.local.get(['kn_unlocked', 'kn_address'], (result) => {
  isUnlocked  = result.kn_unlocked === true
  userAddress = result.kn_address  ?? null
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'KRYPTONOW_EXT') return false

  console.log('RPC Request received:', message.method)

  switch (message.method) {
    case 'eth_accounts':
    case 'eth_requestAccounts':
      if (isUnlocked && userAddress) {
        sendResponse({ result: [userAddress] })
      } else {
        sendResponse({ error: { code: 4100, message: 'Wallet is locked or not connected.' } })
      }
      break

    case 'personal_sign':
    case 'eth_sendTransaction':
    case 'eth_signTypedData_v4':
      if (!isUnlocked) {
        sendResponse({ error: { code: 4100, message: 'Wallet is locked.' } })
        break
      }
      // Open the extension popup for user approval — the popup resolves or rejects
      // the request after the user confirms or cancels.
      chrome.windows.create(
        { url: chrome.runtime.getURL('popup.html'), type: 'popup', width: 360, height: 600 },
        () => {
          // The popup will call back via chrome.runtime.sendMessage once approved/rejected.
          // For now, reject safely until the approval flow is wired up.
          sendResponse({ error: { code: 4001, message: 'User rejected the request.' } })
        },
      )
      break

    default:
      console.warn('Unknown RPC method:', message.method)
      sendResponse({ error: { code: 4200, message: 'Method not supported.' } })
  }

  return true
})
