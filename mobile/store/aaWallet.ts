/**
 * store/aaWallet.ts
 *
 * Zustand store for ERC-4337 smart account state.
 * Tracks smart account address, deployment status, and loading state
 * per chain  separate from the EOA address in walletStore.ts.
 *
 * Usage:
 *   const { smartAddress, isDeployed, loading } = useAAWalletStore()
 */

import { create } from 'zustand'

interface AAWalletState {
  // Smart account address per chainId
  smartAddresses: Record<number, string>
  // Deployment status per chainId
  deployedChains: Record<number, boolean>
  // Whether AA mode is active
  aaEnabled: boolean
  // Loading state
  loading: boolean
  error: string | null

  // Actions
  setSmartAddress: (chainId: number, address: string, isDeployed: boolean) => void
  setAAEnabled: (enabled: boolean) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  reset: () => void
}

export const useAAWalletStore = create<AAWalletState>((set) => ({
  smartAddresses: {},
  deployedChains: {},
  aaEnabled:      false,
  loading:        false,
  error:          null,

  setSmartAddress: (chainId, address, isDeployed) =>
    set(state => ({
      smartAddresses: { ...state.smartAddresses, [chainId]: address },
      deployedChains: { ...state.deployedChains, [chainId]: isDeployed },
    })),

  setAAEnabled: (aaEnabled) => set({ aaEnabled }),
  setLoading:   (loading)   => set({ loading }),
  setError:     (error)     => set({ error }),
  reset:        ()          => set({
    smartAddresses: {},
    deployedChains: {},
    aaEnabled:      false,
    loading:        false,
    error:          null,
  }),
}))
