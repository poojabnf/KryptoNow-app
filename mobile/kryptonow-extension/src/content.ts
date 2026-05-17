// src/content.ts - The Bridge
console.log(' KryptoNow Content Script active.');

// 1. Inject the provider script into the DOM
const injectScript = () => {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/injected.ts');
    script.onload = () => script.remove(); // Clean up the DOM after injection
    (document.head || document.documentElement).appendChild(script);
  } catch (error) {
    console.error('KryptoNow injection failed.', error);
  }
};

injectScript();

// 2. Listen for messages from the injected script and forward them to the Background Worker
window.addEventListener('message', (event) => {
  if (event.source !== window || !event.data || event.data.target !== 'KRYPTONOW_EXT') return;
  
  chrome.runtime.sendMessage(event.data, (response) => {
    // Send the background worker's response back down to the webpage
    window.postMessage({ target: 'KRYPTONOW_PAGE', id: event.data.id, response }, '*');
  });
});
