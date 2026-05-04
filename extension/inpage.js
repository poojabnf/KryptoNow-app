(function() {
  if (window.kryptoNowInjected) return
  window.kryptoNowInjected = true

  let _nextId = 1
  const _pending = new Map()

  window.addEventListener("message", (event) => {
    if (event.source !== window) return
    if (!event.data || event.data.target !== "kryptonow-inpage") return
    const { id, result, error } = event.data
    if (_pending.has(id)) {
      const { resolve, reject } = _pending.get(id)
      _pending.delete(id)
      if (error) {
        const err = Object.assign(new Error(error.message), { code: error.code })
        reject(err)
      } else {
        resolve(result)
      }
    }
  })

  window.addEventListener("message", (event) => {
    if (event.source !== window) return
    if (!event.data || event.data.target !== "kryptonow-event") return
    provider._emit(event.data.event, event.data.data)
  })

  class KryptoNowProvider {
    constructor() {
      this.isMetaMask     = false
      this.isKryptoNow    = true
      this._listeners     = {}
      this._connected     = false
      this.selectedAddress = null
      this.chainId        = "0x1"
      this.networkVersion = "1"
    }

    async request({ method, params = [] }) {
      return new Promise((resolve, reject) => {
        const id = _nextId++
        _pending.set(id, { resolve, reject })
        window.postMessage({
          target: "kryptonow-content",
          id, method, params,
          origin: window.location.origin,
        }, "*")
        setTimeout(() => {
          if (_pending.has(id)) {
            _pending.delete(id)
            reject(Object.assign(new Error("Request timed out"), { code: -32603 }))
          }
        }, 5 * 60 * 1000)
      })
    }

    on(event, listener) {
      if (!this._listeners[event]) this._listeners[event] = []
      this._listeners[event].push(listener)
      return this
    }

    removeListener(event, listener) {
      if (!this._listeners[event]) return this
      this._listeners[event] = this._listeners[event].filter(l => l !== listener)
      return this
    }

    off(event, listener) { return this.removeListener(event, listener) }

    _emit(event, ...args) {
      ;(this._listeners[event] ?? []).forEach(l => { try { l(...args) } catch {} })
    }

    send(method, params)     { return this.request({ method, params }) }
    sendAsync(payload, cb)   {
      this.request(payload)
        .then(r  => cb(null, { id: payload.id, jsonrpc: "2.0", result: r }))
        .catch(e => cb(e, null))
    }
    enable()      { return this.request({ method: "eth_requestAccounts" }) }
    isConnected() { return this._connected }
  }

  const provider = new KryptoNowProvider()

  try {
    Object.defineProperty(window, "ethereum", {
      value: provider, writable: false, configurable: false,
    })
  } catch {
    window.ethereum = provider
  }

  window.dispatchEvent(new Event("ethereum#initialized"))

  const EIP6963_INFO = {
    uuid: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "KryptoNow",
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='16' fill='%236366F1'/><text x='16' y='22' text-anchor='middle' font-size='18' font-weight='bold' fill='white' font-family='Arial'>K</text></svg>",
    rdns: "io.kryptonow",
  }

  function announceProvider() {
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", {
      detail: Object.freeze({ info: EIP6963_INFO, provider }),
    }))
  }

  announceProvider()
  window.addEventListener("eip6963:requestProvider", announceProvider)
  console.log("[KryptoNow] EIP-1193 provider injected via extension")
})()