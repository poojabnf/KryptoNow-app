/**
 * utils/eip712Decoder.ts
 *
 * Decodes EIP-712 typed data into human-readable fields for display.
 * Used by ApprovalModal to show users what they are actually signing
 * instead of raw JSON  prevents blind signing of drainer permits.
 *
 * Handles common DeFi patterns:
 *   Permit        ERC-20 token approval with deadline
 *   Permit2       Uniswap universal permit
 *   Order         OpenSea/Seaport trade orders
 *   SafeTx        Gnosis Safe transactions
 *   Generic       Any other typed data (key-value display)
 */

export type DecodedField = {
  label:    string
  value:    string
  type:     'address' | 'amount' | 'deadline' | 'hash' | 'text' | 'warning'
  raw?:     string
}

export type DecodedTypedData = {
  title:       string
  subtitle:    string
  domain:      { name?: string; version?: string; chainId?: number; contract?: string }
  fields:      DecodedField[]
  riskLevel:   'safe' | 'caution' | 'danger'
  riskReason?: string
}

//  Helpers 

function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr
  return addr.slice(0, 8) + '...' + addr.slice(-6)
}

function formatDeadline(value: string | number): string {
  try {
    const ts = typeof value === 'string' ? parseInt(value) : value
    if (ts > 1e12) return 'No expiry' // max uint256
    const d = new Date(ts * 1000)
    const diff = Math.floor((d.getTime() - Date.now()) / 1000)
    if (diff < 0)       return `Expired (${d.toLocaleDateString()})`
    if (diff < 3600)    return `${Math.floor(diff / 60)} min (${d.toLocaleTimeString()})`
    if (diff < 86400)   return `${Math.floor(diff / 3600)} hours (${d.toLocaleDateString()})`
    if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} days (${d.toLocaleDateString()})`
    return d.toLocaleDateString()
  } catch { return String(value) }
}

function formatAmount(value: string | number, decimals = 18, symbol = ''): string {
  try {
    const raw = BigInt(String(value))
    // Max uint256 = unlimited approval
    if (raw === BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') ||
        raw > BigInt('1000000000000000000000000000000')) {
      return `Unlimited${symbol ? ' ' + symbol : ''} `
    }
    const divisor = BigInt(10 ** Math.min(decimals, 18))
    const whole   = raw / divisor
    const frac    = raw % divisor
    const fracStr = frac.toString().padStart(decimals, '0').slice(0, 6).replace(/0+$/, '')
    const display = fracStr ? `${whole}.${fracStr}` : String(whole)
    return symbol ? `${display} ${symbol}` : display
  } catch { return String(value) }
}

function isAddress(val: string): boolean {
  return typeof val === 'string' && /^0x[0-9a-fA-F]{40}$/.test(val)
}

function isHash(val: string): boolean {
  return typeof val === 'string' && /^0x[0-9a-fA-F]{64}$/.test(val)
}

//  Known type patterns 

const DEADLINE_KEYS  = ['deadline', 'expiry', 'expiration', 'validUntil', 'validBefore']
const AMOUNT_KEYS    = ['amount', 'value', 'allowance', 'requestedAmount', 'sellAmount', 'buyAmount']
const SPENDER_KEYS   = ['spender', 'operator', 'to', 'recipient', 'receiver']
const OWNER_KEYS     = ['owner', 'from', 'sender', 'signer']
const NONCE_KEYS     = ['nonce', 'salt']

//  Main decoder 

export function decodeTypedData(raw: any): DecodedTypedData {
  try {
    const data       = typeof raw === 'string' ? JSON.parse(raw) : raw
    const domain     = data.domain ?? {}
    const types      = data.types ?? {}
    const message    = data.message ?? data.value ?? {}
    const primaryType = data.primaryType ?? Object.keys(types).find(k => k !== 'EIP712Domain') ?? 'Unknown'

    //  Domain info 
    const domainInfo = {
      name:     domain.name,
      version:  domain.version,
      chainId:  domain.chainId ? Number(domain.chainId) : undefined,
      contract: domain.verifyingContract,
    }

    //  Detect known patterns 
    const pt = primaryType.toLowerCase()

    // Permit (ERC-20 approval)
    if (pt === 'permit') {
      return decodePermit(domainInfo, message, domain)
    }

    // Permit2 (Uniswap)
    if (pt.includes('permit') && (pt.includes('single') || pt.includes('batch') || pt.includes('transfer'))) {
      return decodePermit2(domainInfo, message, primaryType)
    }

    // Seaport / OpenSea order
    if (pt === 'ordercomponents' || pt === 'order' || pt.includes('seaport')) {
      return decodeSeaportOrder(domainInfo, message)
    }

    // Gnosis Safe
    if (pt === 'safetx') {
      return decodeSafeTx(domainInfo, message)
    }

    // Generic fallback
    return decodeGeneric(domainInfo, message, primaryType, types)

  } catch (e: any) {
    return {
      title:     'Sign Typed Data',
      subtitle:  'Could not decode  review raw data carefully',
      domain:    {},
      fields:    [{ label: 'Raw data', value: JSON.stringify(raw, null, 2), type: 'text' }],
      riskLevel: 'caution',
      riskReason: 'Unable to decode this request',
    }
  }
}

//  Permit decoder 

function decodePermit(domain: any, msg: any, rawDomain: any): DecodedTypedData {
  const isUnlimited = msg.value && (
    BigInt(String(msg.value)) > BigInt('1000000000000000000000000000000')
  )
  const fields: DecodedField[] = [
    { label: 'Token',    value: domain.name ?? shortAddr(rawDomain.verifyingContract ?? ''), type: 'text' },
    { label: 'Owner',    value: shortAddr(msg.owner ?? ''),   type: 'address', raw: msg.owner },
    { label: 'Spender',  value: shortAddr(msg.spender ?? ''), type: 'address', raw: msg.spender },
    { label: 'Amount',   value: formatAmount(msg.value ?? '0'), type: isUnlimited ? 'warning' : 'amount' },
    { label: 'Deadline', value: formatDeadline(msg.deadline ?? msg.expiry ?? 0), type: 'deadline' },
    { label: 'Nonce',    value: String(msg.nonce ?? 0), type: 'text' },
  ]

  return {
    title:      'Token Approval',
    subtitle:   `${domain.name ?? 'Token'} is requesting spend approval`,
    domain,
    fields,
    riskLevel:  isUnlimited ? 'danger' : 'caution',
    riskReason: isUnlimited
      ? 'Unlimited approval  spender can transfer all your tokens anytime'
      : 'This grants token spending permission to the spender address',
  }
}

//  Permit2 decoder 

function decodePermit2(domain: any, msg: any, primaryType: string): DecodedTypedData {
  const details = msg.details ?? msg.permitted ?? msg
  const fields: DecodedField[] = []

  if (details.token)  fields.push({ label: 'Token',   value: shortAddr(details.token),  type: 'address', raw: details.token })
  if (details.amount) fields.push({ label: 'Amount',  value: formatAmount(details.amount), type: 'amount' })
  if (msg.spender)    fields.push({ label: 'Spender', value: shortAddr(msg.spender),    type: 'address', raw: msg.spender })
  if (details.expiration ?? msg.deadline) {
    fields.push({ label: 'Expires', value: formatDeadline(details.expiration ?? msg.deadline), type: 'deadline' })
  }
  if (msg.nonce !== undefined) fields.push({ label: 'Nonce', value: String(msg.nonce), type: 'text' })

  return {
    title:     'Uniswap Permit2',
    subtitle:  'Universal permit for Uniswap routing',
    domain,
    fields,
    riskLevel: 'caution',
    riskReason: 'Grants Uniswap permission to move tokens on your behalf',
  }
}

//  Seaport order decoder 

function decodeSeaportOrder(domain: any, msg: any): DecodedTypedData {
  const fields: DecodedField[] = [
    { label: 'Offerer',  value: shortAddr(msg.offerer ?? ''), type: 'address', raw: msg.offerer },
    { label: 'Start',    value: formatDeadline(msg.startTime ?? 0), type: 'deadline' },
    { label: 'End',      value: formatDeadline(msg.endTime ?? 0),   type: 'deadline' },
    { label: 'Zone',     value: shortAddr(msg.zone ?? '0x000...'), type: 'address' },
  ]

  if (msg.offer?.length) {
    fields.push({ label: `Offering (${msg.offer.length})`, value: msg.offer.map((o: any) => `${o.identifierOrCriteria ?? ''}  ${shortAddr(o.token ?? '')}`).join(', '), type: 'text' })
  }
  if (msg.consideration?.length) {
    fields.push({ label: `Receiving (${msg.consideration.length})`, value: msg.consideration.map((c: any) => `${formatAmount(c.amount ?? '0')}  ${shortAddr(c.recipient ?? '')}`).join(', '), type: 'text' })
  }

  return {
    title:     'OpenSea / Seaport Order',
    subtitle:  'NFT or token trade order',
    domain,
    fields,
    riskLevel: 'caution',
    riskReason: 'Review offer and consideration carefully before signing',
  }
}

//  Gnosis Safe decoder 

function decodeSafeTx(domain: any, msg: any): DecodedTypedData {
  const fields: DecodedField[] = [
    { label: 'To',        value: shortAddr(msg.to ?? ''),     type: 'address', raw: msg.to },
    { label: 'Value',     value: formatAmount(msg.value ?? '0', 18, 'ETH'), type: 'amount' },
    { label: 'Operation', value: msg.operation === 1 ? 'DelegateCall ' : 'Call', type: msg.operation === 1 ? 'warning' : 'text' },
    { label: 'Nonce',     value: String(msg.nonce ?? 0), type: 'text' },
  ]
  if (msg.data && msg.data !== '0x') {
    fields.push({ label: 'Data', value: msg.data.slice(0, 20) + '...', type: 'hash', raw: msg.data })
  }

  return {
    title:     'Safe Transaction',
    subtitle:  'Gnosis Safe multisig transaction',
    domain,
    fields,
    riskLevel:  msg.operation === 1 ? 'danger' : 'caution',
    riskReason: msg.operation === 1
      ? 'DelegateCall is high risk  can execute arbitrary code in Safe context'
      : 'Safe transaction requires your signature',
  }
}

//  Generic decoder 

function decodeGeneric(domain: any, message: any, primaryType: string, types: any): DecodedTypedData {
  const fields: DecodedField[] = []

  function addField(key: string, value: any, depth = 0) {
    if (depth > 3) return
    if (value === null || value === undefined) return

    if (typeof value === 'object' && !Array.isArray(value)) {
      Object.entries(value).forEach(([k, v]) => addField(k, v, depth + 1))
      return
    }

    const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
    const strVal = String(value)

    let type: DecodedField['type'] = 'text'
    if (isAddress(strVal))                            type = 'address'
    else if (isHash(strVal))                          type = 'hash'
    else if (DEADLINE_KEYS.some(k => key.toLowerCase().includes(k))) type = 'deadline'
    else if (AMOUNT_KEYS.some(k => key.toLowerCase().includes(k)))   type = 'amount'

    const displayVal = type === 'address'  ? shortAddr(strVal)
      : type === 'deadline' ? formatDeadline(strVal)
      : type === 'amount'   ? formatAmount(strVal)
      : Array.isArray(value) ? `[${value.length} items]`
      : strVal.length > 60  ? strVal.slice(0, 40) + '...'
      : strVal

    fields.push({ label, value: displayVal, type, raw: strVal })
  }

  Object.entries(message).forEach(([k, v]) => addField(k, v))

  return {
    title:     primaryType.replace(/([A-Z])/g, ' $1').trim(),
    subtitle:  domain.name ? `Requested by ${domain.name}` : 'Typed data signature',
    domain,
    fields:    fields.slice(0, 12), // cap at 12 fields
    riskLevel: 'caution',
    riskReason: 'Review all fields carefully before approving',
  }
}

//  Personal sign decoder 

export function decodePersonalSign(message: string): {
  displayText: string
  isHex: boolean
  riskLevel: 'safe' | 'caution' | 'danger'
  riskReason?: string
} {
  const isHex = message.startsWith('0x')
  let displayText = message

  if (isHex) {
    try {
      const bytes = Buffer.from(message.slice(2), 'hex')
      const decoded = bytes.toString('utf8')
      // Only use decoded if it looks like readable text
      if (/^[\x20-\x7E\n\r\t]*$/.test(decoded)) {
        displayText = decoded
      }
    } catch {}
  }

  // Risk: signing a hash (could be a tx hash being signed directly)
  const isHash32 = isHex && message.length === 66
  const riskLevel = isHash32 ? 'danger' : 'safe'

  return {
    displayText,
    isHex,
    riskLevel,
    riskReason: isHash32
      ? 'You are signing a 32-byte hash directly. This could authorize a transaction.'
      : undefined,
  }
}
