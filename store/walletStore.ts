import { create } from 'zustand'

export interface Chain {
  id: number
  name: string
  nativeName: string
  symbol: string
  icon: string
  color: string
  rpc: string
}

export interface WalletData {
  address: string
  phrase: string
  name?: string
}

interface WalletState {
  wallet: WalletData | null
  isLoaded: boolean
  activeChain: Chain
  setWallet: (w: WalletData | null) => void
  setLoaded: (v: boolean) => void
  setActiveChain: (chain: Chain) => void
}

const DEFAULT_CHAIN: Chain = {
  id: 1,
  name: 'Ethereum',
  nativeName: 'Ether',
  symbol: 'ETH',
  icon: 'E',
  color: '#627EEA',
  rpc: 'https://eth.llamarpc.com',
}

export const useWalletStore = create<WalletState>((set) => ({
  wallet: null,
  isLoaded: false,
  activeChain: DEFAULT_CHAIN,
  setWallet: (wallet) => set({ wallet }),
  setLoaded: (isLoaded) => set({ isLoaded }),
  setActiveChain: (activeChain) => set({ activeChain }),
}))
