/**
 * utils/tokenSearch.ts
 * --------------------
 * Search tokens by name/symbol OR paste a contract address
 * to auto-fetch metadata via eth_call (name/symbol/decimals/balance)
 */
import { ethers } from "ethers"
import { Chain, getProvider } from "./chains"

export type CustomToken = {
  address:  string
  symbol:   string
  name:     string
  decimals: number
  color:    string
  chainId:  number
  verified: boolean
  balance?: string
  addedAt:  number
}

const ERC20_META_ABI = [
  "function name()     view returns (string)",
  "function symbol()   view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
]

const STORAGE_KEY = "kryptonow_custom_tokens"

// Token colors by first letter for visual variety
const TOKEN_COLORS = [
  "#6366F1","#10B981","#F59E0B","#EF4444","#8B5CF6",
  "#06B6D4","#F43F5E","#84CC16","#0EA5E9","#A855F7",
]
function colorFor(symbol: string): string {
  const idx = symbol.charCodeAt(0) % TOKEN_COLORS.length
  return TOKEN_COLORS[idx]
}

// --- Built-in popular tokens per chain (for search) ---
export const POPULAR_TOKENS: Record<number, Omit<CustomToken, "addedAt" | "verified" | "chainId">[]> = {
  1: [
    { address:"0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol:"USDT",  name:"Tether USD",       decimals:6,  color:"#26A17B" },
    { address:"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol:"USDC",  name:"USD Coin",          decimals:6,  color:"#2775CA" },
    { address:"0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol:"WBTC",  name:"Wrapped Bitcoin",   decimals:8,  color:"#F7931A" },
    { address:"0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol:"DAI",   name:"Dai Stablecoin",    decimals:18, color:"#F5AC37" },
    { address:"0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol:"LINK",  name:"Chainlink",          decimals:18, color:"#375BD2" },
    { address:"0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", symbol:"UNI",   name:"Uniswap",            decimals:18, color:"#FF007A" },
    { address:"0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0", symbol:"MATIC", name:"Polygon",            decimals:18, color:"#8247E5" },
    { address:"0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", symbol:"SHIB",  name:"Shiba Inu",          decimals:18, color:"#E8A420" },
    { address:"0xB8c77482e45F1F44dE1745F52C74426C631bDD52", symbol:"BNB",   name:"BNB",                decimals:18, color:"#F0B90B" },
    { address:"0x6982508145454Ce325dDbE47a25d4ec3d2311933",symbol:"PEPE",  name:"Pepe",               decimals:18, color:"#4CAF50" },
    { address:"0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84", symbol:"stETH", name:"Lido Staked ETH",   decimals:18, color:"#00A3FF" },
    { address:"0xD31a59c85aE9D8edEFeC411D448f90841571b89c", symbol:"SOL",   name:"Wrapped SOL",        decimals:9,  color:"#9945FF" },
  ],
  137: [
    { address:"0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol:"USDT",  name:"Tether USD",        decimals:6,  color:"#26A17B" },
    { address:"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", symbol:"USDC",  name:"USD Coin",           decimals:6,  color:"#2775CA" },
    { address:"0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", symbol:"DAI",   name:"Dai Stablecoin",     decimals:18, color:"#F5AC37" },
    { address:"0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", symbol:"WETH",  name:"Wrapped Ether",      decimals:18, color:"#627EEA" },
    { address:"0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", symbol:"WBTC",  name:"Wrapped Bitcoin",    decimals:8,  color:"#F7931A" },
  ],
  56: [
    { address:"0x55d398326f99059fF775485246999027B3197955", symbol:"USDT",  name:"Tether USD",         decimals:18, color:"#26A17B" },
    { address:"0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol:"USDC",  name:"USD Coin",            decimals:18, color:"#2775CA" },
    { address:"0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", symbol:"BUSD",  name:"Binance USD",         decimals:18, color:"#F0B90B" },
    { address:"0x2170Ed0880ac9A755fd29B2688956BD959F933F8", symbol:"ETH",   name:"Ethereum Token",      decimals:18, color:"#627EEA" },
    { address:"0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82", symbol:"CAKE",  name:"PancakeSwap",         decimals:18, color:"#1FC7D4" },
  ],
  42161: [
    { address:"0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", symbol:"USDC",  name:"USD Coin",            decimals:6,  color:"#2775CA" },
    { address:"0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol:"USDT",  name:"Tether USD",          decimals:6,  color:"#26A17B" },
    { address:"0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", symbol:"WBTC",  name:"Wrapped Bitcoin",     decimals:8,  color:"#F7931A" },
    { address:"0xf97f4df75117a78c1A5a0DBb814Af92458539FB4", symbol:"LINK",  name:"Chainlink",            decimals:18, color:"#375BD2" },
    { address:"0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0", symbol:"UNI",   name:"Uniswap",              decimals:18, color:"#FF007A" },
  ],
  10: [
    { address:"0x7F5c764cBc14f9669B88837ca1490cCa17c31607", symbol:"USDC",  name:"USD Coin",            decimals:6,  color:"#2775CA" },
    { address:"0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol:"USDT",  name:"Tether USD",          decimals:6,  color:"#26A17B" },
    { address:"0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol:"DAI",   name:"Dai Stablecoin",      decimals:18, color:"#F5AC37" },
    { address:"0x4200000000000000000000000000000000000006", symbol:"WETH",  name:"Wrapped Ether",        decimals:18, color:"#627EEA" },
  ],
  8453: [
    { address:"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol:"USDC",  name:"USD Coin",            decimals:6,  color:"#2775CA" },
    { address:"0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol:"DAI",   name:"Dai Stablecoin",      decimals:18, color:"#F5AC37" },
    { address:"0x4200000000000000000000000000000000000006", symbol:"WETH",  name:"Wrapped Ether",        decimals:18, color:"#627EEA" },
    { address:"0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", symbol:"cbETH", name:"Coinbase ETH",        decimals:18, color:"#0052FF" },
  ],
}

// --- localStorage persistence ---
export function loadCustomTokens(chainId: number): CustomToken[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${chainId}`)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function saveCustomToken(token: CustomToken): void {
  try {
    const existing = loadCustomTokens(token.chainId)
    const filtered = existing.filter(t =>
      t.address.toLowerCase() !== token.address.toLowerCase()
    )
    localStorage.setItem(
      `${STORAGE_KEY}_${token.chainId}`,
      JSON.stringify([token, ...filtered].slice(0, 50))
    )
  } catch {}
}

export function removeCustomToken(address: string, chainId: number): void {
  try {
    const existing = loadCustomTokens(chainId)
    localStorage.setItem(
      `${STORAGE_KEY}_${chainId}`,
      JSON.stringify(existing.filter(t => t.address.toLowerCase() !== address.toLowerCase()))
    )
  } catch {}
}

// --- Contract lookup via eth_call ---
export async function lookupContractToken(
  address: string,
  chain: Chain,
  walletAddress: string,
): Promise<CustomToken> {
  if (!ethers.isAddress(address)) throw new Error("Invalid contract address")

  const provider = getProvider(chain)
  const contract = new ethers.Contract(address, ERC20_META_ABI, provider)

  const [name, symbol, decimals, balance] = await Promise.all([
    contract.name().catch(() => "Unknown Token"),
    contract.symbol().catch(() => "???"),
    contract.decimals().catch(() => 18),
    contract.balanceOf(walletAddress).catch(() => 0n),
  ])

  const balanceFormatted = ethers.formatUnits(balance, decimals)

  return {
    address:  ethers.getAddress(address),
    symbol:   String(symbol),
    name:     String(name),
    decimals: Number(decimals),
    color:    colorFor(String(symbol)),
    chainId:  chain.id,
    verified: false,
    balance:  parseFloat(balanceFormatted).toFixed(6),
    addedAt:  Date.now(),
  }
}

// --- Search popular tokens ---
export function searchPopularTokens(
  query: string,
  chainId: number,
): Omit<CustomToken, "addedAt" | "verified" | "chainId">[] {
  const list = POPULAR_TOKENS[chainId] ?? []
  if (!query.trim()) return list
  const q = query.toLowerCase()
  return list.filter(t =>
    t.symbol.toLowerCase().includes(q) ||
    t.name.toLowerCase().includes(q) ||
    t.address.toLowerCase() === q
  )
}