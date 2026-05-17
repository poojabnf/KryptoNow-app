/**
 * injected/ethereum.ts
 * --------------------
 * Injected script context that mounts `window.ethereum` inside host Web3 sites.
 * Emulates MetaMask for maximum standard compatibility and routes RPCs via Events.
 */

interface RPCRequest {
  method: string
  params?: any[]
}

class KryptoNowProvider {
  public isKryptoNow = true
  public isMetaMask = true // Max DApp library compatibility fallback
  public selectedAddress: string | null = null
  public chainId: string = "0x1" // default Ethereum mainnet
  public networkVersion: string = "1"

  private listeners: Record<string, Function[]> = {}

  constructor() {
    // Attempt to read currently active address if pre-cached
    this.request({ method: 'eth_accounts' })
      .then((accounts: any) => {
        if (Array.isArray(accounts) && accounts[0]) {
          this.selectedAddress = accounts[0]
        }
      })
      .catch(() => {})
  }

  // --- Core EIP-1193 request method -------------------------------------------
  public async request({ method, params }: RPCRequest): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substring(2) + Date.now().toString(36)
      
      // Dispatch custom event intercepted by content.ts
      const event = new CustomEvent('KRYPTONOW_RPC_REQUEST', {
        detail: { requestId, method, params }
      })
      window.dispatchEvent(event)

      // Listen for the specific request ID response event
      const responseHandler = (e: Event) => {
        const customEvent = e as CustomEvent
        const { result, error } = customEvent.detail

        if (customEvent.detail.requestId === requestId) {
          window.removeEventListener(`KRYPTONOW_RPC_RESPONSE_${requestId}`, responseHandler)
          if (error) {
            reject(new Error(error))
          } else {
            if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
              if (Array.isArray(result) && result[0]) {
                this.selectedAddress = result[0]
              }
            }
            resolve(result)
          }
        }
      }

      window.addEventListener(`KRYPTONOW_RPC_RESPONSE_${requestId}`, responseHandler)
    })
  }

  // --- Backwards Compatibility methods ---------------------------------------
  public async enable(): Promise<string[]> {
    return this.request({ method: 'eth_requestAccounts' })
  }

  public send(method: string, params?: any[]): Promise<any> {
    return this.request({ method, params })
  }

  public sendAsync(payload: any, callback: (error: any, response: any) => void): void {
    this.request({ method: payload.method, params: payload.params })
      .then(result => {
        callback(null, { id: payload.id, jsonrpc: "2.0", result })
      })
      .catch(error => {
        callback(error, null)
      })
  }

  // --- EventEmitter implementation ------------------------------------------
  public on(event: string, callback: Function): this {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(callback)
    return this
  }

  public removeListener(event: string, callback: Function): this {
    if (!this.listeners[event]) return this
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
    return this
  }

  public emit(event: string, ...args: any[]): boolean {
    if (!this.listeners[event]) return false
    this.listeners[event].forEach(cb => cb(...args))
    return true
  }
}

// Injected globally
;(window as any).ethereum = new KryptoNowProvider()
console.log('[KryptoNow] EIP-1193 window.ethereum provider successfully injected!')
