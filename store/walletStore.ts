import { create } from 'zustand'

export interface Chain {
  id:          number
  name:        string
  nativeName:  string
  symbol:      string
  icon:        string
  color:       string
  rpc:         string
  explorer:    string
}

export interface WalletData {
  address: string
  phrase:  string
  name?:   string
}

interface ChainCache {
  nativeBalance: string
  nativeUSD:     number
  tokens:        any[]
  lastFetch:     number
}

interface WalletState {
  wallet:        WalletData | null
  address:       string | null
  isLoaded:      boolean
  activeChain:   Chain
  chainCache:    Record<number, ChainCache>
  setWallet:     (w: WalletData | null) => void
  setLoaded:     (v: boolean) => void
  setActiveChain:(chain: Chain) => void
  clearWallet:   () => void
  setChainCache: (chainId: number, data: ChainCache) => void
  getChainCache: (chainId: number) => ChainCache | null
}

const DEFAULT_CHAIN: Chain = {
  id:         1,
  name:       'Ethereum',
  nativeName: 'Ether',
  symbol:     'ETH',
  icon:       'E',
  color:      '#627EEA',
  rpc:        'https://eth-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3',
  explorer:   'https://etherscan.io',
}

const STORAGE_KEY = 'kryptonow_wallet'
const CHAIN_KEY   = 'kryptonow_chain'

function loadWallet(): WalletData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function loadChain(): Chain {
  try {
    const raw = localStorage.getItem(CHAIN_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_CHAIN
  } catch { return DEFAULT_CHAIN }
}

function saveWallet(w: WalletData | null) {
  try {
    if (w) localStorage.setItem(STORAGE_KEY, JSON.stringify(w))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

function saveChain(c: Chain) {
  try { localStorage.setItem(CHAIN_KEY, JSON.stringify(c)) } catch {}
}

const savedWallet = loadWallet()
const savedChain  = loadChain()

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet:      savedWallet,
  address:     savedWallet?.address ?? null,
  isLoaded:    true,
  activeChain: savedChain,
  chainCache:  {},

  setWallet: (wallet) => {
    saveWallet(wallet)
    set({ wallet, address: wallet?.address ?? null })
  },

  setLoaded: (isLoaded) => set({ isLoaded }),

  setActiveChain: (activeChain) => {
    saveChain(activeChain)
    set({ activeChain })
  },

  clearWallet: () => {
    saveWallet(null)
    localStorage.removeItem(CHAIN_KEY)
    set({ wallet: null, address: null, chainCache: {} })
  },

  setChainCache: (chainId, data) => set(state => ({
    chainCache: { ...state.chainCache, [chainId]: data }
  })),

  getChainCache: (chainId) => {
    const cache = get().chainCache[chainId]
    if (!cache) return null
    if (Date.now() - cache.lastFetch > 60000) return null
    return cache
  },
}))