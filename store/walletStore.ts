/**
 * store/walletStore.ts
 * --------------------
 * ✅ Bug 6 fix: removed phrase from WalletData stored in AsyncStorage.
 * Phrase now lives ONLY in SecureStore via keyStore.ts.
 * AsyncStorage only holds the public address + chain preference.
 */
import { create } from 'zustand'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

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

// ✅ phrase removed — never store seed phrase in AsyncStorage
export interface WalletData {
  address: string
  name?:   string
}

interface ChainCache {
  nativeBalance: string
  nativeUSD:     number
  tokens:        any[]
  lastFetch:     number
}

interface WalletState {
  wallet:               WalletData | null
  address:              string | null
  smartAccountAddress:  string | null
  isLoaded:             boolean
  activeChain:          Chain
  chainCache:           Record<number, ChainCache>
  setWallet:            (w: WalletData | null) => void
  setLoaded:            (v: boolean) => void
  setActiveChain:       (chain: Chain) => void
  setSmartAccountAddress: (addr: string | null) => void
  clearWallet:          () => void
  setChainCache:        (chainId: number, data: ChainCache) => void
  getChainCache:        (chainId: number) => ChainCache | null
  initFromStorage:      () => Promise<void>
}

export const DEFAULT_CHAIN: Chain = {
  id:         1,
  name:       'Ethereum',
  nativeName: 'Ether',
  symbol:     'ETH',
  icon:       'E',
  color:      '#627EEA',
  rpc:        `https://eth-mainnet.g.alchemy.com/v2/${process.env.EXPO_PUBLIC_ALCHEMY_KEY ?? ''}`,
  explorer:   'https://etherscan.io',
}

const STORAGE_KEY = 'kryptonow_wallet'
const CHAIN_KEY   = 'kryptonow_chain'

// ── Persistence helpers ───────────────────────────────────────────
async function saveWallet(w: WalletData | null) {
  if (w) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(w))
  else   await AsyncStorage.removeItem(STORAGE_KEY)
}

async function saveChain(c: Chain) {
  await AsyncStorage.setItem(CHAIN_KEY, JSON.stringify(c))
}

// ── Store ─────────────────────────────────────────────────────────
export const useWalletStore = create<WalletState>((set, get) => ({
  wallet:               null,
  address:              null,
  smartAccountAddress:  null,
  isLoaded:             false,
  activeChain:          DEFAULT_CHAIN,
  chainCache:           {},

  initFromStorage: async () => {
    try {
      const [walletRaw, chainRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(CHAIN_KEY),
      ])
      const wallet = walletRaw ? JSON.parse(walletRaw) : null
      const chain  = chainRaw  ? JSON.parse(chainRaw)  : DEFAULT_CHAIN
      set({ wallet, address: wallet?.address ?? null, activeChain: chain, isLoaded: true })
    } catch {
      set({ isLoaded: true })
    }
  },

  setWallet: (wallet) => {
    // ✅ Strip phrase before saving — if caller accidentally passes one
    const safe = wallet ? { address: wallet.address, name: wallet.name } : null
    saveWallet(safe)
    set({ wallet: safe, address: safe?.address ?? null })
  },

  setLoaded:              (isLoaded)             => set({ isLoaded }),
  setSmartAccountAddress: (smartAccountAddress)  => set({ smartAccountAddress }),

  setActiveChain: (activeChain) => {
    saveChain(activeChain)
    set({ activeChain })
  },

  clearWallet: () => {
    saveWallet(null)
    AsyncStorage.removeItem(CHAIN_KEY)
    set({ wallet: null, address: null, chainCache: {} })
  },

  setChainCache: (chainId, data) => set(state => ({
    chainCache: { ...state.chainCache, [chainId]: data }
  })),

  getChainCache: (chainId) => {
    const cache = get().chainCache[chainId]
    if (!cache) return null
    if (Date.now() - cache.lastFetch > 60_000) return null
    return cache
  },
}))
