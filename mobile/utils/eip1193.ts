/**
 * utils/eip1193.ts
 * KryptoNow EIP-1193 Provider + EIP-6963 Multi-Wallet Discovery
 *
 * EIP-1193 : window.ethereum provider for dApp connectivity
 * EIP-6963 : multi-wallet announcement (works alongside MetaMask etc.)
 *
 * FIXED: removed duplicate interface declarations and duplicate announcer fns.
 * UPGRADED: signing ops load key from Secure Enclave on demand instead of
 *           storing private key as a class property.
 */

import { ethers } from 'ethers'
import { loadPrivateKeyFromEnclave } from '../store/SecureKeyStore'

type Listener = (...args: any[]) => void

//  dApp session tracking 

export interface DAppSession {
  origin:      string
  name:        string
  icon:        string
  connectedAt: number
  chainId:     number
}

function saveSessions(sessions: DAppSession[]) {
  try { localStorage.setItem('kn_dapp_sessions', JSON.stringify(sessions)) } catch {}
}

function loadSessions(): DAppSession[] {
  try {
    const raw = localStorage.getItem('kn_dapp_sessions')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function getConnectedDApps(): DAppSession[] { return loadSessions() }

export function disconnectDApp(origin: string) {
  saveSessions(loadSessions().filter(s => s.origin !== origin))
}

//  EIP-1193 Provider 

class KryptoNowProvider {
  isMetaMask  = false
  isKryptoNow = true
  chainId: string = '0x1'
  selectedAddress: string | null = null

  private _listeners: Record<string, Listener[]> = {}
  private _rpc      = 'https://eth-mainnet.g.alchemy.com/v2/' + (process.env.EXPO_PUBLIC_ALCHEMY_KEY ?? 't7T7fcsMA4rqQYH70YRV3')
  private _chainId  = 1
  private _connected = false

  //  Init 
  init(address: string, chainId: number, rpc: string) {
    this.selectedAddress = address
    this._chainId  = chainId
    this._rpc      = rpc
    this.chainId   = '0x' + chainId.toString(16)
    this._connected = true
    this._emit('connect', { chainId: this.chainId })
  }

  updateChain(chainId: number, rpc: string) {
    const prev = this.chainId
    this._chainId = chainId
    this._rpc     = rpc
    this.chainId  = '0x' + chainId.toString(16)
    if (prev !== this.chainId) this._emit('chainChanged', this.chainId)
  }

  updateAddress(address: string) {
    this.selectedAddress = address
    this._emit('accountsChanged', [address])
  }

  //  EIP-1193 request 
  async request({ method, params = [] }: { method: string; params?: any[] }): Promise<any> {
    const provider = new ethers.JsonRpcProvider(this._rpc, this._chainId)

    switch (method) {

      case 'eth_requestAccounts':
      case 'eth_accounts': {
        if (!this.selectedAddress) throw this._error(4100, 'Unauthorized')
        if (method === 'eth_requestAccounts' && typeof window !== 'undefined') {
          const origin = window.location?.origin ?? 'unknown'
          const sessions = loadSessions()
          if (!sessions.find(s => s.origin === origin)) {
            sessions.push({
              origin,
              name:        document.title || origin,
              icon:        `https://www.google.com/s2/favicons?domain=${origin}&sz=64`,
              connectedAt: Date.now(),
              chainId:     this._chainId,
            })
            saveSessions(sessions)
          }
        }
        return [this.selectedAddress]
      }

      case 'eth_chainId':    return this.chainId
      case 'net_version':    return String(this._chainId)
      case 'eth_blockNumber':return provider.send('eth_blockNumber', [])

      case 'eth_getBalance':
      case 'eth_estimateGas':
      case 'eth_feeHistory':
      case 'eth_getTransactionCount':
      case 'eth_getTransactionByHash':
      case 'eth_getTransactionReceipt':
      case 'eth_sendRawTransaction':
      case 'eth_call':
      case 'eth_getLogs':
      case 'eth_getCode':
      case 'eth_getStorageAt':
      case 'eth_getBlockByNumber':
      case 'eth_gasPrice':
        return provider.send(method, params)

      case 'eth_sendTransaction': {
        const approved = await this._requestApproval('sendTransaction', params[0])
        if (!approved) throw this._error(4001, 'User rejected transaction')
        const pk = await this._getKey()
        const wallet = new ethers.Wallet(pk, provider)
        const sent = await wallet.sendTransaction(params[0])
        return sent.hash
      }

      case 'personal_sign':
      case 'eth_sign': {
        const message = method === 'personal_sign' ? params[0] : params[1]
        const approved = await this._requestApproval('sign', { message })
        if (!approved) throw this._error(4001, 'User rejected signing')
        const pk = await this._getKey()
        const wallet = new ethers.Wallet(pk)
        return wallet.signMessage(ethers.getBytes(message))
      }

      case 'eth_signTypedData_v4': {
        const typedData = typeof params[1] === 'string' ? JSON.parse(params[1]) : params[1]
        const approved = await this._requestApproval('signTypedData', typedData)
        if (!approved) throw this._error(4001, 'User rejected signing')
        const pk = await this._getKey()
        const wallet = new ethers.Wallet(pk)
        const { domain, types, message } = typedData
        const { EIP712Domain: _, ...cleanTypes } = types
        return wallet.signTypedData(domain, cleanTypes, message)
      }

      case 'wallet_switchEthereumChain': {
        const newChainId = parseInt(params[0].chainId, 16)
        const ak = process.env.EXPO_PUBLIC_ALCHEMY_KEY ?? 't7T7fcsMA4rqQYH70YRV3'
        const knownRpcs: Record<number, string> = {
          1:     `https://eth-mainnet.g.alchemy.com/v2/${ak}`,
          137:   `https://polygon-mainnet.g.alchemy.com/v2/${ak}`,
          56:    'https://bsc-dataseed1.binance.org/',
          42161: `https://arb-mainnet.g.alchemy.com/v2/${ak}`,
          10:    `https://opt-mainnet.g.alchemy.com/v2/${ak}`,
          8453:  `https://base-mainnet.g.alchemy.com/v2/${ak}`,
        }
        if (!knownRpcs[newChainId]) throw this._error(4902, 'Unrecognized chain')
        this.updateChain(newChainId, knownRpcs[newChainId])
        return null
      }

      case 'wallet_addEthereumChain':
        return null

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
    ;(this._listeners[event] ?? []).forEach(l => l(...args))
  }

  //  Load key from Secure Enclave on demand 
  // Key never sits in memory  fetched fresh for each signing op,
  // biometric prompt fires automatically via requireAuthentication.
  private async _getKey(): Promise<string> {
    const result = await loadPrivateKeyFromEnclave('Authenticate to sign')
    if (!result.ok || !result.data) {
      throw this._error(4001, result.error ?? 'Authentication failed')
    }
    return '0x' + result.data
  }

  //  Approval popup 
  private _requestApproval(type: string, data: any): Promise<boolean> {
    return new Promise(resolve => {
      window.dispatchEvent(
        new CustomEvent('kryptonow:approval_request', { detail: { type, data, resolve } })
      )
    })
  }

  //  Error helper 
  private _error(code: number, message: string) {
    return Object.assign(new Error(message), { code })
  }

  //  Legacy compatibility 
  send(method: string, params?: any[]) { return this.request({ method, params }) }
  sendAsync(payload: any, callback: Function) {
    this.request(payload)
      .then(result => callback(null, { id: payload.id, jsonrpc: '2.0', result }))
      .catch(error => callback(error, null))
  }
  enable() { return this.request({ method: 'eth_requestAccounts' }) }
  isConnected() { return this._connected }
}

export const kryptoNowProvider = new KryptoNowProvider()

// Inject window.ethereum
if (typeof window !== 'undefined') {
  ;(window as any).ethereum = kryptoNowProvider
  window.dispatchEvent(new Event('ethereum#initialized'))
  console.log('[KryptoNow] EIP-1193 provider injected ')
}

//  EIP-6963 Multi-Wallet Discovery 

export interface EIP6963ProviderInfo {
  uuid: string
  name: string
  icon: string
  rdns: string
}

export interface EIP6963ProviderDetail {
  info:     EIP6963ProviderInfo
  provider: KryptoNowProvider
}

const KRYPTONOW_INFO: EIP6963ProviderInfo = {
  uuid: 'f4b8b7e2-1a3c-4d5e-9f0a-2b6c8d4e1f3a',
  name: 'KryptoNow',
  icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDEyOCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEyOCIgaGVpZ2h0PSIxMjgiIHJ4PSIyNCIgZmlsbD0iIzBEMkUyRSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTUlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LXNpemU9IjcyIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSI5MDAiIGZpbGw9IiMwMEQ0QUEiPks8L3RleHQ+PC9zdmc+',
  rdns: 'xyz.kryptonow',
}

export function announceEIP6963Provider() {
  if (typeof window === 'undefined') return
  const detail: EIP6963ProviderDetail = {
    info:     KRYPTONOW_INFO,
    provider: kryptoNowProvider,
  }
  const event = new CustomEvent('eip6963:announceProvider', {
    detail: Object.freeze(detail),
  })
  window.dispatchEvent(event)
  console.log('[KryptoNow] EIP-6963 announced ')
}

if (typeof window !== 'undefined') {
  setTimeout(announceEIP6963Provider, 100)
  window.addEventListener('eip6963:requestProvider', announceEIP6963Provider)
}

export { KRYPTONOW_INFO }
