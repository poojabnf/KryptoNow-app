import { create } from 'zustand'
import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { saveEncryptedWallet, loadEncryptedWallet, deleteEncryptedWallet } from '../utils/webVault'
import { CHAINS, type Chain } from '../utils/chains'
import { type KeyMeta } from './SecureKeyStore'

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
  activeAccountIndex:   number
  accounts:             KeyMeta[]
  setWallet:            (w: WalletData | null) => void
  setLoaded:            (v: boolean) => void
  setActiveChain:       (chain: Chain) => void
  setSmartAccountAddress: (addr: string | null) => void
  setActiveAccountIndex: (index: number) => Promise<void>
  setAccounts:          (accounts: KeyMeta[]) => void
  clearWallet:          () => void
  setChainCache:        (chainId: number, data: ChainCache) => void
  getChainCache:        (chainId: number) => ChainCache | null
  initFromStorage:      () => Promise<void>
}

const DEFAULT_CHAIN: Chain = CHAINS[0]

const STORAGE_KEY = 'kryptonow_wallet'
const CHAIN_KEY   = 'kryptonow_chain'

// Sync load for web (initial state) — encrypted vault is async; use address key as fallback
function loadWalletSync(): WalletData | null {
  if (Platform.OS !== 'web') return null
  try {
    const legacyAddr = localStorage.getItem('kryptonow_address')
    if (legacyAddr?.startsWith('0x')) {
      return { address: legacyAddr, phrase: '' }
    }
    const r = localStorage.getItem(STORAGE_KEY)
    if (!r) return null
    const parsed = JSON.parse(r) as { address?: string; ct?: string }
    if (parsed.address && !parsed.ct) {
      return { address: parsed.address, phrase: '', name: undefined }
    }
    return null
  } catch {
    return null
  }
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
  activeAccountIndex:   0,
  accounts:             [],

  initFromStorage: async () => {
    try {
      if (Platform.OS === 'web') {
        const [vaultWallet, chainRaw] = await Promise.all([
          loadEncryptedWallet(),
          Promise.resolve(localStorage.getItem(CHAIN_KEY)),
        ])
        const legacyAddr = localStorage.getItem('kryptonow_address')
        const wallet =
          vaultWallet ??
          (legacyAddr?.startsWith('0x') ? { address: legacyAddr, phrase: '' } : null)
        const chain = chainRaw ? JSON.parse(chainRaw) : DEFAULT_CHAIN
        
        const accounts: KeyMeta[] = wallet ? [{
          accountIndex: 0,
          address: wallet.address,
          derivationPath: "m/44'/60'/0'/0/0",
          createdAt: Date.now(),
          deviceId: 'web'
        }] : []

        set({ wallet, address: wallet?.address ?? null, activeChain: chain, accounts, activeAccountIndex: 0, isLoaded: true })
        return
      }

      // Native: AsyncStorage + SecureKeyStore
      const [walletRaw, chainRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(CHAIN_KEY),
      ])
      const chain  = chainRaw  ? JSON.parse(chainRaw)  : DEFAULT_CHAIN
      
      const { listAllAccounts, migrateFromWalletStore } = require('./SecureKeyStore')
      const accountsRes = await listAllAccounts()
      let accounts: KeyMeta[] = accountsRes.ok && accountsRes.data ? accountsRes.data : []
      
      if (accounts.length > 0) {
        const activeIdxRaw = await AsyncStorage.getItem('kryptonow_active_idx')
        const activeIdx = activeIdxRaw ? parseInt(activeIdxRaw, 10) : 0
        const activeAccount = accounts.find(a => a.accountIndex === activeIdx) ?? accounts[0]
        
        set({
          wallet: { address: activeAccount.address, phrase: '' },
          address: activeAccount.address,
          activeChain: chain,
          accounts,
          activeAccountIndex: activeAccount.accountIndex,
          isLoaded: true
        })
      } else {
        // Fallback / legacy check: is there a legacy wallet stored in AsyncStorage?
        const wallet = walletRaw ? JSON.parse(walletRaw) : null
        
        if (wallet && wallet.address) {
          const migrationRes = await migrateFromWalletStore(0)
          if (migrationRes.ok) {
            const updatedAccountsRes = await listAllAccounts()
            const updatedAccounts: KeyMeta[] = updatedAccountsRes.ok && updatedAccountsRes.data ? updatedAccountsRes.data : []
            set({
              wallet: { address: wallet.address, phrase: '' },
              address: wallet.address,
              activeChain: chain,
              accounts: updatedAccounts,
              activeAccountIndex: 0,
              isLoaded: true
            })
            return
          }
        }
        
        // No wallet at all
        set({ wallet: null, address: null, activeChain: chain, accounts: [], activeAccountIndex: 0, isLoaded: true })
      }
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

  setActiveAccountIndex: async (index: number) => {
    const { accounts } = get()
    const target = accounts.find(a => a.accountIndex === index)
    if (!target) return
    
    if (Platform.OS !== 'web') {
      await AsyncStorage.setItem('kryptonow_active_idx', String(index))
    }
    
    set({
      wallet: { address: target.address, phrase: '' },
      address: target.address,
      activeAccountIndex: index
    })
  },

  setAccounts: (accounts) => set({ accounts }),

  setActiveChain: (activeChain) => {
    saveChain(activeChain)
    set({ activeChain })
  },

  clearWallet: () => {
    saveWallet(null)
    if (Platform.OS !== 'web') {
      AsyncStorage.removeItem(CHAIN_KEY)
      AsyncStorage.removeItem('kryptonow_active_idx')
    } else {
      try {
        localStorage.removeItem(CHAIN_KEY)
      } catch {}
    }
    set({ wallet: null, address: null, chainCache: {}, accounts: [], activeAccountIndex: 0 })
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
