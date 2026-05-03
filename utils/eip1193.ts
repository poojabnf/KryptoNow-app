/**
 * KryptoNow EIP-1193 Provider
 * Injects window.ethereum so any dApp can connect to KryptoNow
 */

import { ethers } from 'ethers'

type Listener = (...args: any[]) => void

export interface DAppSession {
  origin: string
  name: string
  icon: string
  connectedAt: number
  chainId: number
}

function saveSessions(sessions: DAppSession[]) {
  try { localStorage.setItem("kn_dapp_sessions", JSON.stringify(sessions)) } catch {}
}

function loadSessions(): DAppSession[] {
  try {
    const raw = localStorage.getItem("kn_dapp_sessions")
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function getConnectedDApps(): DAppSession[] { return loadSessions() }

export function disconnectDApp(origin: string) {
  const sessions = loadSessions().filter(s => s.origin !== origin)
  saveSessions(sessions)
}

class KryptoNowProvider {
  isMetaMask = false
  isKryptoNow = true
  chainId: string = '0x1'
  selectedAddress: string | null = null

  private _listeners: Record<string, Listener[]> = {}
  private _privateKey: string | null = null
  private _rpc: string = 'https://eth-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3'
  private _chainId: number = 1
  private _connected: boolean = false
  private _pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map()

  //  Init 
  init(address: string, privateKey: string, chainId: number, rpc: string) {
    this.selectedAddress = address
    this._privateKey = privateKey
    this._chainId = chainId
    this._rpc = rpc
    this.chainId = '0x' + chainId.toString(16)
    this._connected = true
    this._emit('connect', { chainId: this.chainId })
  }

  updateChain(chainId: number, rpc: string) {
    const oldChainId = this.chainId
    this._chainId = chainId
    this._rpc = rpc
    this.chainId = '0x' + chainId.toString(16)
    if (oldChainId !== this.chainId) {
      this._emit('chainChanged', this.chainId)
    }
  }

  updateAddress(address: string) {
    this.selectedAddress = address
    this._emit('accountsChanged', [address])
  }

  //  EIP-1193 request 
  async request({ method, params = [] }: { method: string; params?: any[] }): Promise<any> {
    const provider = new ethers.JsonRpcProvider(this._rpc, this._chainId)

    switch (method) {
      //  Accounts 
      case 'eth_requestAccounts':
      case 'eth_accounts':
        if (!this.selectedAddress) throw this._error(4100, 'Unauthorized')
        // Track dApp connection
        if (typeof window !== 'undefined' && method === 'eth_requestAccounts') {
          const origin = window.location?.origin ?? 'unknown'
          const sessions = loadSessions()
          if (!sessions.find(s => s.origin === origin)) {
            sessions.push({
              origin,
              name: document.title || origin,
              icon: `https://www.google.com/s2/favicons?domain=${origin}&sz=64`,
              connectedAt: Date.now(),
              chainId: this._chainId,
            })
            saveSessions(sessions)
          }
        }
        return [this.selectedAddress]

      //  Chain 
      case 'eth_chainId':
        return this.chainId

      case 'net_version':
        return String(this._chainId)

      //  Balance 
      case 'eth_getBalance':
        return provider.send('eth_getBalance', params)

      //  Block 
      case 'eth_blockNumber':
        return provider.send('eth_blockNumber', [])

      case 'eth_getBlockByNumber':
        return provider.send('eth_getBlockByNumber', params)

      //  Gas 
      case 'eth_gasPrice':
        return provider.send('eth_gasPrice', [])

      case 'eth_estimateGas':
        return provider.send('eth_estimateGas', params)

      case 'eth_feeHistory':
        return provider.send('eth_feeHistory', params)

      //  Transactions 
      case 'eth_getTransactionCount':
        return provider.send('eth_getTransactionCount', params)

      case 'eth_getTransactionByHash':
        return provider.send('eth_getTransactionByHash', params)

      case 'eth_getTransactionReceipt':
        return provider.send('eth_getTransactionReceipt', params)

      case 'eth_sendRawTransaction':
        return provider.send('eth_sendRawTransaction', params)

      case 'eth_sendTransaction': {
        if (!this._privateKey) throw this._error(4100, 'Unauthorized')
        const tx = params[0]
        const wallet = new ethers.Wallet(this._privateKey, provider)
        const approved = await this._requestApproval('sendTransaction', tx)
        if (!approved) throw this._error(4001, 'User rejected transaction')
        const sent = await wallet.sendTransaction(tx)
        return sent.hash
      }

      //  Signing 
      case 'personal_sign':
      case 'eth_sign': {
        if (!this._privateKey) throw this._error(4100, 'Unauthorized')
        const wallet = new ethers.Wallet(this._privateKey)
        const message = method === 'personal_sign' ? params[0] : params[1]
        const approved = await this._requestApproval('sign', { message })
        if (!approved) throw this._error(4001, 'User rejected signing')
        return wallet.signMessage(ethers.getBytes(message))
      }

      case 'eth_signTypedData_v4': {
        if (!this._privateKey) throw this._error(4100, 'Unauthorized')
        const wallet = new ethers.Wallet(this._privateKey)
        const typedData = JSON.parse(params[1])
        const approved = await this._requestApproval('signTypedData', typedData)
        if (!approved) throw this._error(4001, 'User rejected signing')
        const { domain, types, message } = typedData
        const { EIP712Domain: _, ...cleanTypes } = types
        return wallet.signTypedData(domain, cleanTypes, message)
      }

      //  Chain switching 
      case 'wallet_switchEthereumChain': {
        const newChainId = parseInt(params[0].chainId, 16)
        const knownChains: Record<number, string> = {
          1:     'https://eth-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3',
          137:   'https://polygon-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3',
          56:    'https://bsc-dataseed1.binance.org/',
          42161: 'https://arb-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3',
          10:    'https://opt-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3',
          8453:  'https://base-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3',
        }
        if (!knownChains[newChainId]) throw this._error(4902, 'Unrecognized chain')
        this.updateChain(newChainId, knownChains[newChainId])
        return null
      }

      case 'wallet_addEthereumChain':
        return null

      //  Contract calls 
      case 'eth_call':
        return provider.send('eth_call', params)

      case 'eth_getLogs':
        return provider.send('eth_getLogs', params)

      case 'eth_getCode':
        return provider.send('eth_getCode', params)

      case 'eth_getStorageAt':
        return provider.send('eth_getStorageAt', params)

      default:
        return provider.send(method, params)
    }
  }

  //  Events 
  on(event: string, listener: Listener) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(listener)
    return this
  }

  removeListener(event: string, listener: Listener) {
    if (!this._listeners[event]) return this
    this._listeners[event] = this._listeners[event].filter(l => l !== listener)
    return this
  }

  off = this.removeListener

  private _emit(event: string, ...args: any[]) {
    (this._listeners[event] ?? []).forEach(l => l(...args))
  }

  //  Approval popup 
  private _requestApproval(type: string, data: any): Promise<boolean> {
    return new Promise((resolve) => {
      const event = new CustomEvent('kryptonow:approval_request', {
        detail: { type, data, resolve }
      })
      window.dispatchEvent(event)
    })
  }

  //  Errors 
  private _error(code: number, message: string) {
    return Object.assign(new Error(message), { code })
  }

  //  Legacy 
  send(method: string, params?: any[]) {
    return this.request({ method, params })
  }

  sendAsync(payload: any, callback: Function) {
    this.request(payload)
      .then(result => callback(null, { id: payload.id, jsonrpc: '2.0', result }))
      .catch(error => callback(error, null))
  }

  enable() {
    return this.request({ method: 'eth_requestAccounts' })
  }

  isConnected() { return this._connected }
}

export const kryptoNowProvider = new KryptoNowProvider()

// Inject into window
if (typeof window !== 'undefined') {
  (window as any).ethereum = kryptoNowProvider
  window.dispatchEvent(new Event('ethereum#initialized'))
  console.log('[KryptoNow] EIP-1193 provider injected ')
}