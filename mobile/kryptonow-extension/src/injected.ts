// src/injected.ts - The EIP-1193 Provider Interface
window.ethereum = {
  isKryptoNow: true,
  isMetaMask: true, // Many dApps check for this specifically
  request: async ({ method, params }) => {
    return new Promise((resolve, reject) => {
      const id = Date.now().toString() + Math.random().toString();
      
      const listener = (event) => {
        if (event.source !== window || !event.data || event.data.target !== 'KRYPTONOW_PAGE' || event.data.id !== id) return;
        window.removeEventListener('message', listener);
        
        if (event.data.response?.error) reject(event.data.response.error);
        else resolve(event.data.response?.result);
      };
      
      window.addEventListener('message', listener);
      // Send the request up to the Content Script
      window.postMessage({ target: 'KRYPTONOW_EXT', id, method, params }, '*');
    });
  }
};
console.log(' KryptoNow window.ethereum provider is ready!');
