/**
 * utils/graphClient.ts
 * --------------------
 * Thin GraphQL-over-fetch client for The Graph hosted subgraphs.
 * No Apollo, no urql  just fetch + typed queries.
 *
 * Public endpoints used (no API key needed for reasonable usage):
 *   Ethereum:  https://api.thegraph.com/subgraphs/name/messari/ethereum-mainnet
 *   Polygon:   https://api.thegraph.com/subgraphs/name/messari/polygon-mainnet
 *   Arbitrum:  https://api.thegraph.com/subgraphs/name/messari/arbitrum-one
 *   Optimism:  https://api.thegraph.com/subgraphs/name/messari/optimism
 *   Base:      https://api.thegraph.com/subgraphs/name/messari/base
 *
 * For UserOps (ERC-4337):
 *   https://api.thegraph.com/subgraphs/name/balloondoggie/erc-4337-mainnet
 */

export type GraphResponse<T> = { data: T; errors?: { message: string }[] }

// Chain  subgraph endpoint
export const GRAPH_ENDPOINTS: Record<number, string> = {
  1:     'https://api.thegraph.com/subgraphs/name/messari/ethereum-mainnet',
  137:   'https://api.thegraph.com/subgraphs/name/messari/polygon-mainnet',
  42161: 'https://api.thegraph.com/subgraphs/name/messari/arbitrum-one',
  10:    'https://api.thegraph.com/subgraphs/name/messari/optimism',
  8453:  'https://api.thegraph.com/subgraphs/name/messari/base',
}

// ERC-4337 EntryPoint subgraphs per chain
export const USEROP_ENDPOINTS: Record<number, string> = {
  1:     'https://api.thegraph.com/subgraphs/name/balloondoggie/erc-4337-mainnet',
  137:   'https://api.thegraph.com/subgraphs/name/balloondoggie/erc-4337-polygon',
  42161: 'https://api.thegraph.com/subgraphs/name/balloondoggie/erc-4337-arbitrum',
  10:    'https://api.thegraph.com/subgraphs/name/balloondoggie/erc-4337-optimism',
}

export async function graphQuery<T>(
  endpoint: string,
  query:    string,
  variables?: Record<string, any>,
): Promise<T> {
  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query, variables }),
  })

  if (!res.ok) throw new Error(`Graph HTTP ${res.status}`)

  const json: GraphResponse<T> = await res.json()
  if (json.errors?.length) {
    throw new Error(json.errors.map(e => e.message).join(', '))
  }
  return json.data
}

//  Shared fragments 

export const TX_FIELDS = `
  id
  hash
  from { id }
  to { id }
  value
  gasUsed
  gasPrice
  blockNumber
  timestamp
  status
`

export const TRANSFER_FIELDS = `
  id
  transaction { hash timestamp blockNumber gasUsed gasPrice }
  from { id }
  to { id }
  amount
  token { symbol name decimals }
`
