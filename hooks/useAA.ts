/**
 * hooks/useAA.ts
 *
 * React hook for ERC-4337 Account Abstraction.
 * Wraps utils/aa.ts and store/aaWallet.ts into a clean component API.
 *
 * Usage in a component:
 *   const { smartAddress, isDeployed, aaEnabled, sendAA, sendBatchAA, toggleAA } = useAA()
 */

import { useCallback } from 'react'
import { Alert } from 'react-native'
import { useWalletStore } from '../store/walletStore'
import { useAAWalletStore } from '../store/aaWallet'
import { loadPrivateKeyFromEnclave } from '../store/SecureKeyStore'
import {
  getSmartAccountAddress,
  sendUserOp,
  sendBatchUserOp,
  encodeERC20Transfer,
  chainSupportsAA,
  type AACall,
  type AAResult,
} from '../utils/aa'

export function useAA() {
  const activeChain   = useWalletStore(s => s.activeChain)
  const eoaAddress    = useWalletStore(s => s.address)

  const {
    smartAddresses,
    deployedChains,
    aaEnabled,
    loading,
    error,
    setSmartAddress,
    setAAEnabled,
    setLoading,
    setError,
  } = useAAWalletStore()

  const chainId      = activeChain?.id ?? 1
  const smartAddress = smartAddresses[chainId] ?? null
  const isDeployed   = deployedChains[chainId] ?? false
  const isSupported  = chainSupportsAA(chainId)

  //  Load smart account address for current chain 
  const loadSmartAddress = useCallback(async () => {
    if (!isSupported || !eoaAddress) return
    if (smartAddresses[chainId]) return // already loaded

    setLoading(true)
    setError(null)
    try {
      const res = await loadPrivateKeyFromEnclave('Authenticate to load smart account')
      if (!res.ok || !res.data) {
        setError(res.error ?? 'Authentication failed')
        return
      }

      const info = await getSmartAccountAddress(res.data, chainId)
      setSmartAddress(chainId, info.address, info.isDeployed)
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load smart account')
    } finally {
      setLoading(false)
    }
  }, [chainId, isSupported, eoaAddress, smartAddresses])

  //  Toggle AA mode on/off 
  const toggleAA = useCallback(async () => {
    if (!isSupported) {
      Alert.alert(
        'Not Supported',
        'Account Abstraction is not available on this chain. Switch to Ethereum, Polygon, Arbitrum, Optimism, or Base.',
      )
      return
    }
    const next = !aaEnabled
    setAAEnabled(next)
    if (next && !smartAddress) {
      await loadSmartAddress()
    }
  }, [aaEnabled, isSupported, smartAddress, loadSmartAddress])

  //  Send a single UserOp 
  const sendAA = useCallback(async (
    to: string,
    value: bigint,
    data: string = '0x',
  ): Promise<AAResult> => {
    if (!isSupported) return { ok: false, error: 'Chain not supported for AA' }

    setLoading(true)
    setError(null)
    try {
      const res = await loadPrivateKeyFromEnclave('Authenticate to send transaction')
      if (!res.ok || !res.data) {
        return { ok: false, error: res.error ?? 'Authentication failed' }
      }

      const result = await sendUserOp(res.data, chainId, to, value, data)
      if (!result.ok) setError(result.error ?? 'UserOp failed')
      return result
    } catch (e: any) {
      const msg = e?.message ?? 'UserOp failed'
      setError(msg)
      return { ok: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [chainId, isSupported])

  //  Send a batch UserOp 
  const sendBatchAA = useCallback(async (
    calls: AACall[],
  ): Promise<AAResult> => {
    if (!isSupported) return { ok: false, error: 'Chain not supported for AA' }

    setLoading(true)
    setError(null)
    try {
      const res = await loadPrivateKeyFromEnclave('Authenticate to send batch transaction')
      if (!res.ok || !res.data) {
        return { ok: false, error: res.error ?? 'Authentication failed' }
      }

      const result = await sendBatchUserOp(res.data, chainId, calls)
      if (!result.ok) setError(result.error ?? 'Batch UserOp failed')
      return result
    } catch (e: any) {
      const msg = e?.message ?? 'Batch UserOp failed'
      setError(msg)
      return { ok: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [chainId, isSupported])

  //  Send ERC-20 via AA 
  const sendERC20AA = useCallback(async (
    tokenContract: string,
    to:            string,
    amount:        bigint,
  ): Promise<AAResult> => {
    const data = encodeERC20Transfer(to, amount)
    return sendAA(tokenContract, 0n, data)
  }, [sendAA])

  //  Approve + Transfer batch (approve+swap pattern) 
  const approveAndTransferAA = useCallback(async (
    tokenContract: string,
    spender:       string,
    amount:        bigint,
    transferTo:    string,
  ): Promise<AAResult> => {
    // approve(address,uint256) selector = 0x095ea7b3
    const approveSelector = '0x095ea7b3'
    const paddedSpender   = spender.toLowerCase().replace('0x', '').padStart(64, '0')
    const paddedAmount    = amount.toString(16).padStart(64, '0')
    const approveData     = approveSelector + paddedSpender + paddedAmount
    const transferData    = encodeERC20Transfer(transferTo, amount)

    return sendBatchAA([
      { to: tokenContract, value: 0n, data: approveData  },
      { to: tokenContract, value: 0n, data: transferData },
    ])
  }, [sendBatchAA])

  return {
    // State
    smartAddress,
    isDeployed,
    aaEnabled,
    isSupported,
    loading,
    error,

    // Actions
    loadSmartAddress,
    toggleAA,
    sendAA,
    sendBatchAA,
    sendERC20AA,
    approveAndTransferAA,
  }
}
