/**
 * scripts/deployGuardianRegistry.ts
 * Run: PRIVATE_KEY=0x... npx ts-node scripts/deployGuardianRegistry.ts
 * Requires: npm install -D ts-node hardhat @nomiclabs/hardhat-ethers
 */
import { ethers } from 'ethers'
import * as fs from 'fs'
import * as path from 'path'

// Paste ABI + bytecode after: npx hardhat compile
// or compile at https://remix.ethereum.org
const BYTECODE = process.env.GUARDIAN_BYTECODE ?? ''

const CHAINS = [
  { id: 1,     name: 'Ethereum', rpc: `https://eth-mainnet.g.alchemy.com/v2/${process.env.EXPO_PUBLIC_ALCHEMY_KEY}` },
  { id: 137,   name: 'Polygon',  rpc: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.EXPO_PUBLIC_ALCHEMY_KEY}` },
  { id: 42161, name: 'Arbitrum', rpc: `https://arb-mainnet.g.alchemy.com/v2/${process.env.EXPO_PUBLIC_ALCHEMY_KEY}` },
  { id: 10,    name: 'Optimism', rpc: `https://opt-mainnet.g.alchemy.com/v2/${process.env.EXPO_PUBLIC_ALCHEMY_KEY}` },
  { id: 8453,  name: 'Base',     rpc: `https://base-mainnet.g.alchemy.com/v2/${process.env.EXPO_PUBLIC_ALCHEMY_KEY}` },
]

async function main() {
  const pk = process.env.PRIVATE_KEY
  if (!pk) throw new Error('Set PRIVATE_KEY env var')
  if (!BYTECODE) throw new Error('Set GUARDIAN_BYTECODE env var (compiled bytecode)')

  const deployed: Record<string, string> = {}

  for (const chain of CHAINS) {
    try {
      const provider = new ethers.JsonRpcProvider(chain.rpc)
      const wallet   = new ethers.Wallet(pk, provider)
      const factory  = new ethers.ContractFactory([], BYTECODE, wallet)
      const contract = await factory.deploy()
      await contract.waitForDeployment()
      const addr = await contract.getAddress()
      deployed[String(chain.id)] = addr
      console.log(`${chain.name}: ${addr}`)
    } catch (e: any) {
      console.error(`${chain.name} failed:`, e.message)
    }
  }

  const outPath = path.join(__dirname, '../utils/guardianRegistryAddresses.json')
  const existing = JSON.parse(fs.readFileSync(outPath, 'utf-8'))
  const updated  = { ...existing, ...deployed }
  fs.writeFileSync(outPath, JSON.stringify(updated, null, 2))
  console.log('Saved to utils/guardianRegistryAddresses.json')
  console.log('Next: update subgraph/subgraph.yaml with contract addresses, then deploy subgraph')
}

main().catch(console.error)
