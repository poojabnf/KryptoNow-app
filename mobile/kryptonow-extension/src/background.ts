// src/background.ts
console.log(' KryptoNow Background Worker initialized.');

// Mock wallet state (we will connect this to your encrypted local storage later)
let isUnlocked = true;
const userAddress = "0x5DE6b7012011032339"; // Mock address for testing

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Ignore messages that aren't specifically routed to the extension
  if (message.target !== 'KRYPTONOW_EXT') return false;

  console.log(` RPC Request received:`, message.method, message.params);

  // Core Web3 RPC Router
  switch (message.method) {
    case 'eth_accounts':
    case 'eth_requestAccounts':
      if (isUnlocked) {
        // Return the user's address to the dApp
        sendResponse({ result: [userAddress] });
      } else {
        // If locked, we would programmatically open the extension popup here
        sendResponse({ error: { code: 4100, message: 'The requested account and/or method has not been authorized by the user.' } });
      }
      break;

    case 'personal_sign':
    case 'eth_sendTransaction':
    case 'eth_signTypedData_v4':
      console.log(' High-risk action: Requires user approval!');
      
      // In production, this triggers the Chrome extension popup to open with your ApprovalModal.
      // For this initial setup, we will safely mock a rejection.
      sendResponse({ error: { code: 4001, message: 'User rejected the request.' } });
      break;

    default:
      console.warn('Unknown RPC method:', message.method);
      sendResponse({ error: { code: 4200, message: 'Method not supported.' } });
  }

  return true; // Indicates that sendResponse will be called asynchronously
});
