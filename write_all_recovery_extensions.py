import pathlib, json, os

os.makedirs('contracts', exist_ok=True)
os.makedirs('subgraph/src', exist_ok=True)
os.makedirs('subgraph/abis', exist_ok=True)
os.makedirs('scripts', exist_ok=True)

#  1. GuardianRegistry.sol 
sol = """// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * GuardianRegistry.sol  v1.0.0
 * KryptoNow Social Recovery  on-chain guardian registry
 * Deploy to: ETH, Polygon, Arbitrum, Optimism, Base
 * Est. deploy gas: ~350,000
 */
contract GuardianRegistry {

    event GuardianAdded(address indexed smartAccount, address indexed guardian, string nickname, uint256 threshold, uint256 timestamp);
    event GuardianRemoved(address indexed smartAccount, address indexed guardian, uint256 timestamp);
    event RecoveryInitiated(address indexed smartAccount, address indexed newOwner, bytes32 indexed requestId, uint256 deadline, uint256 timestamp);
    event RecoverySigned(bytes32 indexed requestId, address indexed guardian, uint256 timestamp);
    event RecoveryExecuted(bytes32 indexed requestId, address indexed smartAccount, address indexed newOwner, uint256 timestamp);
    event RecoveryCancelled(bytes32 indexed requestId, address indexed smartAccount, uint256 timestamp);

    struct RecoveryRequest {
        address smartAccount;
        address newOwner;
        uint256 deadline;
        address[] signers;
        mapping(address => bool) hasSigned;
        bool executed;
        bool cancelled;
    }

    struct GuardianSet {
        address[] list;
        mapping(address => bool) isGuardian;
        mapping(address => string) nicknames;
        uint8 threshold;
    }

    mapping(address => GuardianSet)    private guardianSets;
    mapping(bytes32 => RecoveryRequest) private recoveryRequests;
    mapping(address => uint256)         public  nonces;

    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant  RECOVERY_TYPEHASH = keccak256(
        "RecoverAccount(address smartAccount,address newOwner,uint256 deadline,uint256 nonce)"
    );

    constructor() {
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
            keccak256("KryptoNow Social Recovery"),
            keccak256("1"),
            block.chainid,
            address(this)
        ));
    }

    //  Guardian management 

    function addGuardian(address guardian, string calldata nickname, uint8 newThreshold) external {
        require(guardian != address(0) && guardian != msg.sender, "Invalid guardian");
        require(bytes(nickname).length > 0, "Empty nickname");
        GuardianSet storage gs = guardianSets[msg.sender];
        require(!gs.isGuardian[guardian], "Already guardian");
        require(gs.list.length < 5, "Max 5 guardians");
        gs.list.push(guardian);
        gs.isGuardian[guardian] = true;
        gs.nicknames[guardian]  = nickname;
        gs.threshold            = newThreshold;
        emit GuardianAdded(msg.sender, guardian, nickname, newThreshold, block.timestamp);
    }

    function removeGuardian(address guardian, uint8 newThreshold) external {
        GuardianSet storage gs = guardianSets[msg.sender];
        require(gs.isGuardian[guardian], "Not guardian");
        gs.isGuardian[guardian] = false;
        for (uint i = 0; i < gs.list.length; i++) {
            if (gs.list[i] == guardian) {
                gs.list[i] = gs.list[gs.list.length - 1];
                gs.list.pop();
                break;
            }
        }
        gs.threshold = newThreshold;
        emit GuardianRemoved(msg.sender, guardian, block.timestamp);
    }

    //  Recovery flow 

    function initiateRecovery(address smartAccount, address newOwner, uint256 deadline) external returns (bytes32 requestId) {
        require(deadline > block.timestamp, "Deadline past");
        require(guardianSets[smartAccount].isGuardian[msg.sender], "Not guardian");
        requestId = keccak256(abi.encodePacked(smartAccount, newOwner, deadline, nonces[smartAccount]++));
        RecoveryRequest storage req = recoveryRequests[requestId];
        req.smartAccount = smartAccount;
        req.newOwner     = newOwner;
        req.deadline     = deadline;
        emit RecoveryInitiated(smartAccount, newOwner, requestId, deadline, block.timestamp);
    }

    function signRecovery(bytes32 requestId, bytes calldata sig) external {
        RecoveryRequest storage req = recoveryRequests[requestId];
        require(req.smartAccount != address(0) && !req.executed && !req.cancelled, "Invalid request");
        require(block.timestamp < req.deadline, "Expired");
        GuardianSet storage gs = guardianSets[req.smartAccount];
        require(gs.isGuardian[msg.sender] && !req.hasSigned[msg.sender], "Cannot sign");
        bytes32 digest = keccak256(abi.encodePacked("\\x19\\x01", DOMAIN_SEPARATOR,
            keccak256(abi.encode(RECOVERY_TYPEHASH, req.smartAccount, req.newOwner, req.deadline, nonces[req.smartAccount] - 1))
        ));
        require(_recover(digest, sig) == msg.sender, "Bad sig");
        req.hasSigned[msg.sender] = true;
        req.signers.push(msg.sender);
        emit RecoverySigned(requestId, msg.sender, block.timestamp);
    }

    function executeRecovery(bytes32 requestId) external {
        RecoveryRequest storage req = recoveryRequests[requestId];
        require(req.smartAccount != address(0) && !req.executed && !req.cancelled, "Invalid");
        require(block.timestamp < req.deadline, "Expired");
        GuardianSet storage gs = guardianSets[req.smartAccount];
        require(req.signers.length >= gs.threshold, "Insufficient sigs");
        req.executed = true;
        (bool ok,) = req.smartAccount.call(abi.encodeWithSelector(0xf2fde38b, req.newOwner));
        require(ok, "transferOwnership failed");
        emit RecoveryExecuted(requestId, req.smartAccount, req.newOwner, block.timestamp);
    }

    function cancelRecovery(bytes32 requestId) external {
        RecoveryRequest storage req = recoveryRequests[requestId];
        require(req.smartAccount == msg.sender && !req.executed, "Cannot cancel");
        req.cancelled = true;
        emit RecoveryCancelled(requestId, req.smartAccount, block.timestamp);
    }

    //  Views 

    function getGuardians(address smartAccount) external view returns (address[] memory, uint8) {
        GuardianSet storage gs = guardianSets[smartAccount];
        return (gs.list, gs.threshold);
    }

    function isGuardian(address smartAccount, address guardian) external view returns (bool) {
        return guardianSets[smartAccount].isGuardian[guardian];
    }

    function getSigners(bytes32 requestId) external view returns (address[] memory) {
        return recoveryRequests[requestId].signers;
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        require(sig.length == 65, "Bad sig len");
        bytes32 r; bytes32 s; uint8 v;
        assembly { r := calldataload(sig.offset) s := calldataload(add(sig.offset, 32)) v := byte(0, calldataload(add(sig.offset, 64))) }
        return ecrecover(digest, v, r, s);
    }
}
"""
pathlib.Path('contracts/GuardianRegistry.sol').write_text(sol, encoding='utf-8')
print('OK: contracts/GuardianRegistry.sol')

#  2. Subgraph schema 
schema = """type GuardianAdded @entity(immutable: true) {
  id:           Bytes!
  smartAccount: Bytes!
  guardian:     Bytes!
  nickname:     String!
  threshold:    Int!
  timestamp:    BigInt!
  blockNumber:  BigInt!
  txHash:       Bytes!
}
type GuardianRemoved @entity(immutable: true) {
  id:           Bytes!
  smartAccount: Bytes!
  guardian:     Bytes!
  timestamp:    BigInt!
  blockNumber:  BigInt!
  txHash:       Bytes!
}
type RecoveryInitiated @entity(immutable: true) {
  id:           Bytes!
  smartAccount: Bytes!
  newOwner:     Bytes!
  requestId:    Bytes!
  deadline:     BigInt!
  timestamp:    BigInt!
  blockNumber:  BigInt!
  txHash:       Bytes!
}
type RecoverySigned @entity(immutable: true) {
  id:           Bytes!
  requestId:    Bytes!
  guardian:     Bytes!
  timestamp:    BigInt!
  blockNumber:  BigInt!
  txHash:       Bytes!
}
type RecoveryExecuted @entity(immutable: true) {
  id:           Bytes!
  requestId:    Bytes!
  smartAccount: Bytes!
  newOwner:     Bytes!
  timestamp:    BigInt!
  blockNumber:  BigInt!
  txHash:       Bytes!
}
type SmartAccountConfig @entity {
  id:        Bytes!
  guardians: [Bytes!]!
  threshold: Int!
  updatedAt: BigInt!
}
"""
pathlib.Path('subgraph/schema.graphql').write_text(schema, encoding='utf-8')
print('OK: subgraph/schema.graphql')

#  3. Subgraph manifest 
manifest = """specVersion: 0.0.5
schema:
  file: ./schema.graphql
dataSources:
  - kind: ethereum
    name: GuardianRegistry
    network: mainnet
    source:
      address: "0x0000000000000000000000000000000000000000"
      abi: GuardianRegistry
      startBlock: 0
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - GuardianAdded
        - GuardianRemoved
        - RecoveryInitiated
        - RecoverySigned
        - RecoveryExecuted
        - SmartAccountConfig
      abis:
        - name: GuardianRegistry
          file: ./abis/GuardianRegistry.json
      eventHandlers:
        - event: GuardianAdded(indexed address,indexed address,string,uint256,uint256)
          handler: handleGuardianAdded
        - event: GuardianRemoved(indexed address,indexed address,uint256)
          handler: handleGuardianRemoved
        - event: RecoveryInitiated(indexed address,indexed address,indexed bytes32,uint256,uint256)
          handler: handleRecoveryInitiated
        - event: RecoverySigned(indexed bytes32,indexed address,uint256)
          handler: handleRecoverySigned
        - event: RecoveryExecuted(indexed bytes32,indexed address,indexed address,uint256)
          handler: handleRecoveryExecuted
      file: ./src/mapping.ts
"""
pathlib.Path('subgraph/subgraph.yaml').write_text(manifest, encoding='utf-8')
print('OK: subgraph/subgraph.yaml')

#  4. Subgraph mapping 
mapping = """import {
  GuardianAdded as GuardianAddedEvent,
  GuardianRemoved as GuardianRemovedEvent,
  RecoveryInitiated as RecoveryInitiatedEvent,
  RecoverySigned as RecoverySignedEvent,
  RecoveryExecuted as RecoveryExecutedEvent,
} from '../generated/GuardianRegistry/GuardianRegistry'
import {
  GuardianAdded, GuardianRemoved,
  RecoveryInitiated, RecoverySigned, RecoveryExecuted,
  SmartAccountConfig,
} from '../generated/schema'

export function handleGuardianAdded(event: GuardianAddedEvent): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32())
  const e  = new GuardianAdded(id)
  e.smartAccount = event.params.smartAccount
  e.guardian     = event.params.guardian
  e.nickname     = event.params.nickname
  e.threshold    = event.params.threshold.toI32()
  e.timestamp    = event.params.timestamp
  e.blockNumber  = event.block.number
  e.txHash       = event.transaction.hash
  e.save()

  let cfg = SmartAccountConfig.load(event.params.smartAccount)
  if (!cfg) { cfg = new SmartAccountConfig(event.params.smartAccount); cfg.guardians = [] }
  const gs = cfg.guardians; gs.push(event.params.guardian)
  cfg.guardians = gs; cfg.threshold = event.params.threshold.toI32()
  cfg.updatedAt = event.block.timestamp; cfg.save()
}

export function handleGuardianRemoved(event: GuardianRemovedEvent): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32())
  const e  = new GuardianRemoved(id)
  e.smartAccount = event.params.smartAccount
  e.guardian     = event.params.guardian
  e.timestamp    = event.params.timestamp
  e.blockNumber  = event.block.number
  e.txHash       = event.transaction.hash
  e.save()

  const cfg = SmartAccountConfig.load(event.params.smartAccount)
  if (cfg) {
    cfg.guardians = cfg.guardians.filter(g => g != event.params.guardian)
    cfg.updatedAt = event.block.timestamp; cfg.save()
  }
}

export function handleRecoveryInitiated(event: RecoveryInitiatedEvent): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32())
  const e  = new RecoveryInitiated(id)
  e.smartAccount = event.params.smartAccount
  e.newOwner     = event.params.newOwner
  e.requestId    = event.params.requestId
  e.deadline     = event.params.deadline
  e.timestamp    = event.params.timestamp
  e.blockNumber  = event.block.number
  e.txHash       = event.transaction.hash
  e.save()
}

export function handleRecoverySigned(event: RecoverySignedEvent): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32())
  const e  = new RecoverySigned(id)
  e.requestId   = event.params.requestId
  e.guardian    = event.params.guardian
  e.timestamp   = event.params.timestamp
  e.blockNumber = event.block.number
  e.txHash      = event.transaction.hash
  e.save()
}

export function handleRecoveryExecuted(event: RecoveryExecutedEvent): void {
  const id = event.transaction.hash.concatI32(event.logIndex.toI32())
  const e  = new RecoveryExecuted(id)
  e.requestId    = event.params.requestId
  e.smartAccount = event.params.smartAccount
  e.newOwner     = event.params.newOwner
  e.timestamp    = event.params.timestamp
  e.blockNumber  = event.block.number
  e.txHash       = event.transaction.hash
  e.save()
}
"""
pathlib.Path('subgraph/src/mapping.ts').write_text(mapping, encoding='utf-8')
print('OK: subgraph/src/mapping.ts')

#  5. Registry addresses placeholder 
addresses = {
  "_note": "Deploy contracts/GuardianRegistry.sol then paste addresses here",
  "1":     "0x0000000000000000000000000000000000000000",
  "137":   "0x0000000000000000000000000000000000000000",
  "42161": "0x0000000000000000000000000000000000000000",
  "10":    "0x0000000000000000000000000000000000000000",
  "8453":  "0x0000000000000000000000000000000000000000",
}
pathlib.Path('utils/guardianRegistryAddresses.json').write_text(
    json.dumps(addresses, indent=2), encoding='utf-8')
print('OK: utils/guardianRegistryAddresses.json')

#  6. hooks/useGuardianRegistry.ts 
guardian_hook = """/**
 * hooks/useGuardianRegistry.ts
 * Queries GuardianRegistry subgraph for on-chain guardian state.
 * Merges with local config for unified view.
 */
import { useState, useCallback } from 'react'
import { graphQuery } from '../utils/graphClient'
import addresses from '../utils/guardianRegistryAddresses.json'

const REGISTRY_SUBGRAPH: Record<number, string> = {
  1:     'https://api.thegraph.com/subgraphs/name/kryptonow/guardian-registry-mainnet',
  137:   'https://api.thegraph.com/subgraphs/name/kryptonow/guardian-registry-polygon',
  42161: 'https://api.thegraph.com/subgraphs/name/kryptonow/guardian-registry-arbitrum',
  10:    'https://api.thegraph.com/subgraphs/name/kryptonow/guardian-registry-optimism',
  8453:  'https://api.thegraph.com/subgraphs/name/kryptonow/guardian-registry-base',
}

const GUARDIAN_QUERY = `
  query Guardians($smartAccount: Bytes!) {
    smartAccountConfig(id: $smartAccount) {
      guardians
      threshold
      updatedAt
    }
    recoveryInitiateds(
      where: { smartAccount: $smartAccount }
      orderBy: timestamp orderDirection: desc
      first: 10
    ) {
      requestId newOwner deadline timestamp txHash
    }
    recoveryExecuteds(
      where: { smartAccount: $smartAccount }
      first: 5
    ) {
      requestId newOwner timestamp txHash
    }
  }
`

export interface OnChainGuardianState {
  guardians:    string[]
  threshold:    number
  updatedAt:    number
  pendingRequests: {
    requestId: string
    newOwner:  string
    deadline:  number
    timestamp: number
    txHash:    string
  }[]
  executedRequests: {
    requestId: string
    newOwner:  string
    timestamp: number
    txHash:    string
  }[]
}

export function useGuardianRegistry(smartAccountAddr: string | null, chainId: number) {
  const [state,   setState]   = useState<OnChainGuardianState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const contractAddr = (addresses as any)[String(chainId)]
  const subgraphUrl  = REGISTRY_SUBGRAPH[chainId]
  const isDeployed   = contractAddr && contractAddr !== '0x0000000000000000000000000000000000000000'

  const refresh = useCallback(async () => {
    if (!smartAccountAddr || !subgraphUrl || !isDeployed) return
    setLoading(true)
    setError(null)
    try {
      const data = await graphQuery<any>(subgraphUrl, GUARDIAN_QUERY, {
        smartAccount: smartAccountAddr.toLowerCase(),
      })
      const cfg = data?.smartAccountConfig
      setState({
        guardians:    cfg?.guardians ?? [],
        threshold:    cfg?.threshold ?? 1,
        updatedAt:    parseInt(cfg?.updatedAt ?? '0'),
        pendingRequests: (data?.recoveryInitiateds ?? []).map((r: any) => ({
          requestId: r.requestId,
          newOwner:  r.newOwner,
          deadline:  parseInt(r.deadline),
          timestamp: parseInt(r.timestamp),
          txHash:    r.txHash,
        })),
        executedRequests: (data?.recoveryExecuteds ?? []).map((r: any) => ({
          requestId: r.requestId,
          newOwner:  r.newOwner,
          timestamp: parseInt(r.timestamp),
          txHash:    r.txHash,
        })),
      })
    } catch (e: any) {
      setError(e.message ?? 'Failed to load on-chain guardian state')
    } finally {
      setLoading(false)
    }
  }, [smartAccountAddr, chainId, subgraphUrl, isDeployed])

  return { state, loading, error, refresh, isDeployed, contractAddr }
}
"""
pathlib.Path('hooks/useGuardianRegistry.ts').write_text(guardian_hook, encoding='utf-8')
print('OK: hooks/useGuardianRegistry.ts')

#  7. utils/recoveryNotification.ts 
notif = """/**
 * utils/recoveryNotification.ts
 * ------------------------------
 * Push notification helpers for Social Recovery.
 * Sends local notifications when recovery events happen.
 * Uses expo-notifications (already in package.json).
 */
import { Platform } from 'react-native'

async function getNotifications() {
  if (Platform.OS === 'web') return null
  return import('expo-notifications')
}

export async function notifyRecoveryInitiated(
  guardianNickname: string,
  newOwnerAddr:     string,
  requestId:        string,
): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Recovery Request Initiated',
      body:  `A recovery request has been created to transfer ownership to ${newOwnerAddr.slice(0,8)}...`,
      data:  { type: 'recovery_initiated', requestId, newOwnerAddr },
    },
    trigger: null,
  })
}

export async function notifyGuardianSignRequired(
  threshold:    number,
  sigsReceived: number,
  requestId:    string,
): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Guardian Signature Required',
      body:  `${sigsReceived}/${threshold} signatures collected. ${threshold - sigsReceived} more needed.`,
      data:  { type: 'recovery_sig_needed', requestId },
    },
    trigger: null,
  })
}

export async function notifyRecoveryComplete(
  newOwnerAddr: string,
  txHash:       string,
): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Wallet Recovery Complete',
      body:  `Ownership transferred to ${newOwnerAddr.slice(0,8)}...${newOwnerAddr.slice(-6)}`,
      data:  { type: 'recovery_complete', txHash },
    },
    trigger: null,
  })
}

export async function notifyRecoveryCancelled(): Promise<void> {
  const Notifications = await getNotifications()
  if (!Notifications) return
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Recovery Request Cancelled',
      body:  'A recovery request for your wallet has been cancelled.',
      data:  { type: 'recovery_cancelled' },
    },
    trigger: null,
  })
}
"""
pathlib.Path('utils/recoveryNotification.ts').write_text(notif, encoding='utf-8')
print('OK: utils/recoveryNotification.ts')

#  8. utils/recoveryDeepLink.ts 
deeplink = """/**
 * utils/recoveryDeepLink.ts
 * --------------------------
 * Generate + parse shareable recovery deep links.
 * Format: kryptonow://recovery?requestId=...&smartAccount=...&newOwner=...&deadline=...
 *
 * Guardian taps link  app opens  pre-fills sign modal  one-tap approve
 */
import { Linking, Platform } from 'react-native'

const SCHEME  = 'kryptonow'
const WEB_URL = 'https://kryptonow.xyz'

export interface RecoveryLinkParams {
  requestId:    string
  smartAccount: string
  newOwner:     string
  deadline:     number
  chainId:      number
}

export function buildRecoveryLink(params: RecoveryLinkParams): string {
  const query = new URLSearchParams({
    requestId:    params.requestId,
    smartAccount: params.smartAccount,
    newOwner:     params.newOwner,
    deadline:     String(params.deadline),
    chainId:      String(params.chainId),
  }).toString()

  if (Platform.OS === 'web') {
    return `${WEB_URL}/recovery?${query}`
  }
  return `${SCHEME}://recovery?${query}`
}

export function parseRecoveryLink(url: string): RecoveryLinkParams | null {
  try {
    const u      = new URL(url.replace(`${SCHEME}://`, 'http://placeholder/'))
    const params = u.searchParams
    const requestId    = params.get('requestId')
    const smartAccount = params.get('smartAccount')
    const newOwner     = params.get('newOwner')
    const deadline     = params.get('deadline')
    const chainId      = params.get('chainId')

    if (!requestId || !smartAccount || !newOwner || !deadline || !chainId) return null

    return {
      requestId,
      smartAccount,
      newOwner,
      deadline:  parseInt(deadline),
      chainId:   parseInt(chainId),
    }
  } catch { return null }
}

export async function shareRecoveryLink(params: RecoveryLinkParams): Promise<void> {
  const link = buildRecoveryLink(params)

  if (Platform.OS === 'web') {
    if (navigator.share) {
      await navigator.share({
        title: 'KryptoNow Recovery Request',
        text:  'Please sign this recovery request to help restore wallet access.',
        url:   link,
      })
    } else {
      await navigator.clipboard.writeText(link)
    }
    return
  }

  const { Share } = await import('react-native')
  await Share.share({
    message: `KryptoNow wallet recovery request. Tap to sign:\\n${link}`,
    url:     link,
  })
}

export function registerDeepLinkHandler(
  onRecoveryLink: (params: RecoveryLinkParams) => void
): () => void {
  const handler = ({ url }: { url: string }) => {
    if (url.includes('recovery')) {
      const params = parseRecoveryLink(url)
      if (params) onRecoveryLink(params)
    }
  }

  const sub = Linking.addEventListener('url', handler)

  Linking.getInitialURL().then(url => {
    if (url && url.includes('recovery')) {
      const params = parseRecoveryLink(url)
      if (params) onRecoveryLink(params)
    }
  })

  return () => sub.remove()
}
"""
pathlib.Path('utils/recoveryDeepLink.ts').write_text(deeplink, encoding='utf-8')
print('OK: utils/recoveryDeepLink.ts')

#  9. Deploy script 
deploy = """/**
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
"""
pathlib.Path('scripts/deployGuardianRegistry.ts').write_text(deploy, encoding='utf-8')
print('OK: scripts/deployGuardianRegistry.ts')

print('\\n=== All done ===')
print('Files created:')
for p in [
    'contracts/GuardianRegistry.sol',
    'subgraph/schema.graphql',
    'subgraph/subgraph.yaml',
    'subgraph/src/mapping.ts',
    'utils/guardianRegistryAddresses.json',
    'hooks/useGuardianRegistry.ts',
    'utils/recoveryNotification.ts',
    'utils/recoveryDeepLink.ts',
    'scripts/deployGuardianRegistry.ts',
]:
    print(f'  {p}')
