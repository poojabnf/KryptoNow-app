import { create } from 'zustand'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { saveEncryptedWallet, loadEncryptedWallet, deleteEncryptedWallet } from '../utils/webVault'
import { CHAINS, type Chain } from '../utils/chains'

export type { Chain }

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
  wallet:               WalletData | null
  address:              string | null
  smartAccountAddress:  string | null   // ERC-4337 LightAccount address
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

const DEFAULT_CHAIN: Chain = CHAINS[0]

const STORAGE_KEY = 'kryptonow_wallet'
const CHAIN_KEY   = 'kryptonow_chain'

// Sync load for web (initial state)
function loadWalletSync(): WalletData | null {
  if (Platform.OS !== 'web') return null
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null } catch { return null }
}
function loadChainSync(): Chain {
  if (Platform.OS !== 'web') return DEFAULT_CHAIN
  try { const r = localStorage.getItem(CHAIN_KEY); return r ? JSON.parse(r) : DEFAULT_CHAIN } catch { return DEFAULT_CHAIN }
}

async function saveWallet(w: WalletData | null) {
  if (Platform.OS !== 'web') {
    if (w) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(w))
    else await AsyncStorage.removeItem(STORAGE_KEY)
  } else {
    try {
      if (w) await saveEncryptedWallet({ address: w.address, phrase: w.phrase ?? '', name: w.name })
      else deleteEncryptedWallet()
    } catch {}
  }
}

async function saveChain(c: Chain) {
  if (Platform.OS !== 'web') {
    await AsyncStorage.setItem(CHAIN_KEY, JSON.stringify(c))
  } else {
    try { localStorage.setItem(CHAIN_KEY, JSON.stringify(c)) } catch {}
  }
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallet:               loadWalletSync(),
  address:              loadWalletSync()?.address ?? null,
  smartAccountAddress:  null,
  isLoaded:             Platform.OS === 'web', // web loads sync, native needs initFromStorage
  activeChain: loadChainSync(),
  chainCache:  {},

  initFromStorage: async () => {
    try {
      if (Platform.OS === 'web') {
        // Web: decrypt vault + load chain
        const [wallet, chainRaw] = await Promise.all([
          loadEncryptedWallet(),
          Promise.resolve(localStorage.getItem(CHAIN_KEY)),
        ])
        const chain = chainRaw ? JSON.parse(chainRaw) : DEFAULT_CHAIN
        set({ wallet, address: wallet?.address ?? null, activeChain: chain, isLoaded: true })
        return
      }
      // Native: AsyncStorage
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
    saveWallet(wallet)
    set({ wallet, address: wallet?.address ?? null })
  },

  setLoaded: (isLoaded) => set({ isLoaded }),
  setSmartAccountAddress: (smartAccountAddress) => set({ smartAccountAddress }),

  setActiveChain: (activeChain) => {
    saveChain(activeChain)
    set({ activeChain })
  },

  clearWallet: () => {
    saveWallet(null)
    if (Platform.OS !== 'web') AsyncStorage.removeItem(CHAIN_KEY)
    else try { localStorage.removeItem(CHAIN_KEY) } catch {}
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
