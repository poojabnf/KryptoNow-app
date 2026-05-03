/**
 * utils/tenderly.ts   v1.2.0
 *
 * Pre-sign transaction simulation via Tenderly Gateway.
 * Shows the user exactly what a transaction will do before signing.
 * No API key required  uses Tenderly public simulation endpoint.
 */

export type SimulationStatus = 'success' | 'reverted' | 'error'

export interface SimulationResult {
  status:      SimulationStatus
  gasUsed:     number
  errorReason?: string          // revert reason if status === 'reverted'
  assetChanges: AssetChange[]
}

export interface AssetChange {
  type:    'transfer' | 'approval'
  from:    string
  to:      string
  amount:  string               // human-readable, e.g. "1.5"
  symbol:  string
  usdValue?:string
}

const TENDERLY_GATEWAY: Record<number, string> = {
  1:     'https://mainnet.gateway.tenderly.co',
  137:   'https://polygon.gateway.tenderly.co',
  42161: 'https://arbitrum.gateway.tenderly.co',
  10:    'https://optimism.gateway.tenderly.co',
  56:    'https://bsc.gateway.tenderly.co',
  8453:  'https://base.gateway.tenderly.co',
}

/**
 * Simulate a transaction before signing.
 * Call this in send.tsx between gas estimation and wallet.sendTransaction().
 *
 * @param chainId   Active chain ID
 * @param from      Sender address
 * @param to        Recipient or contract address
 * @param data      Encoded calldata ('' for native transfers)
 * @param value     Wei value as hex string (e.g. '0xde0b6b3a7640000')
 * @param gasLimit  Gas limit as bigint
 */
export async function simulateTransaction(
  chainId: number,
  from:     string,
  to:       string,
  data:     string,
  value:    string,
  gasLimit: bigint,
): Promise<SimulationResult> {
  const gateway = TENDERLY_GATEWAY[chainId]
  if (!gateway) {
    return { status: 'error', gasUsed: 0, assetChanges: [], errorReason: 'Chain not supported for simulation' }
  }

  try {
    const body = {
      jsonrpc: '2.0',
      id:      1,
      method:  'tenderly_simulateTransaction',
      params:  [
        {
          from,
          to,
          data:  data || '0x',
          value: value || '0x0',
          gas:   '0x' + gasLimit.toString(16),
        },
        'latest',
      ],
    }

    const res = await fetch(gateway, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })

    if (!res.ok) {
      return { status: 'error', gasUsed: 0, assetChanges: [], errorReason: `Simulation service unavailable (${res.status})` }
    }

    const json = await res.json()

    if (json.error) {
      return { status: 'error', gasUsed: 0, assetChanges: [], errorReason: json.error.message ?? 'Simulation error' }
    }

    const result = json.result
    if (!result) {
      return { status: 'error', gasUsed: 0, assetChanges: [], errorReason: 'Empty simulation response' }
    }

    // Parse status
    const status: SimulationStatus = result.status === false ? 'reverted' : 'success'

    // Parse gas used
    const gasUsed = result.gasUsed ? parseInt(result.gasUsed, 16) : 0

    // Parse revert reason
    const errorReason = status === 'reverted'
      ? (result.errorMessage ?? result.revertReason ?? 'Transaction will revert')
      : undefined

    // Parse asset changes (Tenderly returns these in assetChanges array)
    const assetChanges: AssetChange[] = (result.assetChanges ?? []).map((c: any) => ({
      type:     c.type?.toLowerCase() ?? 'transfer',
      from:     c.from ?? '',
      to:       c.to ?? '',
      amount:   c.amount ?? '0',
      symbol:   c.tokenInfo?.symbol ?? c.symbol ?? activeChainSymbol(chainId),
      usdValue: c.dollarValue,
    }))

    return { status, gasUsed, assetChanges, errorReason }

  } catch (e: any) {
    // Network failure  fail open (don't block the user)
    return { status: 'error', gasUsed: 0, assetChanges: [], errorReason: e.message ?? 'Simulation failed' }
  }
}

function activeChainSymbol(chainId: number): string {
  const symbols: Record<number, string> = { 1:'ETH', 137:'POL', 42161:'ETH', 10:'ETH', 56:'BNB', 8453:'ETH' }
  return symbols[chainId] ?? 'ETH'
}
