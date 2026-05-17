const COINGECKO = 'https://api.coingecko.com/api/v3'
const ETH_RPC = 'https://eth-mainnet.g.alchemy.com/v2/Gw7PHs6VFH8gDXU4joBdN'

export async function fetchPrices(): Promise<{btc:number,eth:number,btcChange:number,ethChange:number}> {
  const url = COINGECKO + '/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true'
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } })
  const data = await res.json()
  return {
    btc: data.bitcoin.usd,
    eth: data.ethereum.usd,
    btcChange: data.bitcoin.usd_24h_change,
    ethChange: data.ethereum.usd_24h_change,
  }
}

export async function fetchEthBalance(address: string): Promise<string> {
  const res = await fetch(ETH_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_getBalance', params:[address,'latest'] })
  })
  const data = await res.json()
  const wei = parseInt(data.result, 16)
  return (wei / 1e18).toFixed(6)
}

export function toUSD(amount: number): string {
  if (amount < 0.01) return '.00'
  return new Intl.NumberFormat('en-US', { style:'currency', currency:'USD', minimumFractionDigits:2, maximumFractionDigits:2 }).format(amount)
}

export function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : ''
  return sign + change.toFixed(2) + '%'
}


