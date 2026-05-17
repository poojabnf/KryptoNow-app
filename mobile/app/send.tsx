import { router } from 'expo-router'
import { goBack } from '../utils/navigation'
import { useTheme } from '../context/ThemeContext'
import { useState, useEffect, useRef, useCallback } from "react"
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator, Linking, Switch,
} from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { ethers } from "ethers"
import { useWalletStore } from "../store/walletStore"
import { loadPrivateKey } from "../store/keyStore"
import { simulateTransaction, SimulationResult } from "../utils/tenderly"
import { isValidAddress } from "../utils/crypto"
import { getTxUrl, getProvider, Chain, AA_SUPPORTED_CHAINS } from "../utils/chains"
import TokenSearchModal from "../components/TokenSearchModal"
import { CustomToken, loadCustomTokens } from "../utils/tokenSearch"
import { useAA } from "../hooks/useAA"
import { useDeferredRender } from "../hooks/useDeferredRender"

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
]

const CHAIN_TOKENS: Record<number, { symbol: string; name: string; decimals: number; contract: string; color: string }[]> = {
  1: [
    { symbol:"USDC", name:"USD Coin",  decimals:6,  contract:"0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", color:"#2775CA" },
    { symbol:"USDT", name:"Tether",    decimals:6,  contract:"0xdAC17F958D2ee523a2206206994597C13D831ec7", color:"#26A17B" },
    { symbol:"LINK", name:"Chainlink", decimals:18, contract:"0x514910771AF9Ca656af840dff83E8264EcF986CA", color:"#375BD2" },
    { symbol:"UNI",  name:"Uniswap",  decimals:18, contract:"0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", color:"#FF007A" },
  ],
  137: [
    { symbol:"USDC", name:"USD Coin",  decimals:6,  contract:"0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", color:"#2775CA" },
    { symbol:"USDT", name:"Tether",    decimals:6,  contract:"0xc2132D05D31c914a87C6611C10748AEb04B58e8F", color:"#26A17B" },
  ],
  42161: [
    { symbol:"USDC", name:"USD Coin",  decimals:6,  contract:"0xaf88d065e77c8cC2239327C5EDb3A432268e5831", color:"#2775CA" },
    { symbol:"USDT", name:"Tether",    decimals:6,  contract:"0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", color:"#26A17B" },
  ],
  10: [
    { symbol:"USDC", name:"USD Coin",  decimals:6,  contract:"0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", color:"#2775CA" },
    { symbol:"USDT", name:"Tether",    decimals:6,  contract:"0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", color:"#26A17B" },
  ],
  56: [
    { symbol:"USDT", name:"Tether",    decimals:18, contract:"0x55d398326f99059fF775485246999027B3197955", color:"#26A17B" },
    { symbol:"BUSD", name:"BUSD",      decimals:18, contract:"0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56", color:"#F0B90B" },
  ],
}

// --- Gas Estimator Types ---
type GasSpeed = "slow" | "standard" | "fast"
type GasTier = {
  speed:       GasSpeed
  label:       string
  gwei:        number
  maxFeeGwei:  number
  priorityGwei:number
  limitedTime: string
  costETH:     string
  costUSD:     string
  color:       string
  bg:          string
  icon:        string
}

type GasData = {
  baseFeeGwei:  number
  tiers:        GasTier[]
  isEIP1559:    boolean
  gasLimit:     bigint
  lastUpdated:  number
}

// --- Gas Oracle ---
async function fetchGasData(
  chain: Chain,
  addr: string,
  toAddr: string,
  isERC20: boolean,
  contract: string | null,
  decimals: number,
  nativePrice: number,
): Promise<GasData> {
  const provider = getProvider(chain)

  const [feeData, gasLimit] = await Promise.all([
    provider.getFeeData(),
    (async () => {
      try {
        if (!isValidAddress(toAddr)) return isERC20 ? 65000n : 21000n
        if (isERC20 && contract) {
          return await provider.estimateGas({
            from: addr, to: contract,
            data: new ethers.Interface(ERC20_ABI).encodeFunctionData("transfer", [
              toAddr, ethers.parseUnits("1", decimals),
            ])
          })
        }
        return await provider.estimateGas({ from: addr, to: toAddr, value: 1n })
      } catch {
        return isERC20 ? 65000n : 21000n
      }
    })(),
  ])

  const baseFeeWei  = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n
  const gasPriceWei = feeData.gasPrice ?? 0n
  const isEIP1559   = feeData.maxFeePerGas != null
  const baseFeeGwei = Number(baseFeeWei) / 1e9

  const buildTier = (
    speed: GasSpeed,
    label: string,
    multiplier: number,
    priorityGwei: number,
    time: string,
    color: string,
    bg: string,
    icon: string,
  ): GasTier => {
    const gasPriceGwei = isEIP1559
      ? baseFeeGwei * multiplier + priorityGwei
      : (Number(gasPriceWei) / 1e9) * multiplier

    const maxFeeGwei = isEIP1559
      ? baseFeeGwei * multiplier * 1.25 + priorityGwei
      : gasPriceGwei

    const costWei = BigInt(Math.floor(gasPriceGwei * 1e9)) * gasLimit
    const costETH = (Number(costWei) / 1e18).toFixed(8)
    const costUSD = (parseFloat(costETH) * nativePrice).toFixed(4)

    return {
      speed, label,
      gwei:         parseFloat(gasPriceGwei.toFixed(2)),
      maxFeeGwei:   parseFloat(maxFeeGwei.toFixed(2)),
      priorityGwei,
      limitedTime:  time,
      costETH,
      costUSD,
      color, bg, icon,
    }
  }

  const tiers: GasTier[] = [
    buildTier("slow",     "Slow",     0.9,  1,  "~5 min",  "#64748B", "#F8FAFF", "hourglass-outline"),
    buildTier("standard", "Standard", 1.0,  2,  "~1 min",  "#6366F1", "#EEF2FF", "flash-outline"),
    buildTier("fast",     "Fast",     1.25, 5,  "~15 sec", "#10B981", "#D1FAE5", "rocket-outline"),
  ]

  return { baseFeeGwei, tiers, isEIP1559, gasLimit, lastUpdated: Date.now() }
}

type Step = "form" | "confirm" | "success"

export default function Send() {
  const isRenderReady = useDeferredRender(300)
  const addr        = useWalletStore(s => s.address)

  const { theme, mode } = useTheme()
  const activeChain = useWalletStore(s => s.activeChain)

  // ── ERC-4337 Account Abstraction ────────────────────────────────────────────
  const {
    aaEnabled,
    isSupported: aaSupported,
    smartAddress,
    isDeployed: aaDeployed,
    loading: aaLoading,
    toggleAA,
    sendAA,
    sendERC20AA,
  } = useAA()

  const [customTokens,    setCustomTokens]    = useState<CustomToken[]>(
    () => loadCustomTokens(activeChain.id)
  )

  const erc20List   = CHAIN_TOKENS[activeChain.id] ?? []
  const nativeToken = { symbol: activeChain.symbol, name: activeChain.nativeName, decimals: 18, contract: null as null, color: activeChain.color }
  const allTokens   = [nativeToken, ...erc20List, ...customTokens.map(t => ({
    symbol:   t.symbol,
    name:     t.name,
    decimals: t.decimals,
    contract: t.address,
    color:    t.color,
  }))]

  const [selectedToken, setSelectedToken] = useState(allTokens[0])
  const [showPicker,    setShowPicker]    = useState(false)
  const [showTokenSearch, setShowTokenSearch] = useState(false)
  const [toAddress,     setToAddress]     = useState("")
  const [ensName,       setEnsName]       = useState("")
  const [ensLoading,    setEnsLoading]    = useState(false)
  const [nativeBal,     setNativeBal]     = useState("0")
  const [amount,        setAmount]        = useState("")
  const [nativePrice,   setNativePrice]   = useState(0)
  const [sending,       setSending]       = useState(false)
  const [step,          setStep]          = useState<Step>("form")
  const [txHash,        setTxHash]        = useState("")
  const [simResult,     setSimResult]     = useState<SimulationResult | null>(null)
  const [simLoading,    setSimLoading]    = useState(false)

  // Fetch native balance for Max button
  useEffect(() => {
    if (!addr) return
    getProvider(activeChain).getBalance(addr)
      .then(wei => setNativeBal(parseFloat(ethers.formatEther(wei)).toFixed(8)))
      .catch(() => {})
  }, [addr, activeChain])

  // ENS resolution
  async function resolveENS(input: string) {
    if (!input.endsWith('.eth')) { setEnsName(''); return }
    setEnsLoading(true)
    try {
      const mainnet = new ethers.JsonRpcProvider('https://eth.llamarpc.com')
      const resolved = await mainnet.resolveName(input)
      setEnsName(resolved ?? '')
    } catch { setEnsName('') }
    finally { setEnsLoading(false) }
  }

  function handleAddressChange(text: string) {
    setToAddress(text)
    resolveENS(text.trim())
  }

  function handleMax() {
    if (!selectedToken.contract) {
      // Native: leave a buffer for gas
      const gasBuffer = selectedTier ? parseFloat(selectedTier.costETH) * 1.2 : 0.002
      const max = Math.max(0, parseFloat(nativeBal) - gasBuffer)
      setAmount(max > 0 ? max.toFixed(8) : '0')
    } else {
      // ERC20: no gas deduction needed
      setAmount(nativeBal)
    }
  }

  const effectiveToAddress = ensName || toAddress

  // Gas estimator state
  const [gasData,       setGasData]       = useState<GasData | null>(null)
  const [gasLoading,    setGasLoading]    = useState(false)
  const [gasError,      setGasError]      = useState(false)
  const [selectedSpeed, setSelectedSpeed] = useState<GasSpeed>("standard")
  const gasTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const selectedTier = gasData?.tiers.find(t => t.speed === selectedSpeed) ?? null

  const addrValid  = isValidAddress(effectiveToAddress)
  const amtValid   = !isNaN(parseFloat(amount)) && parseFloat(amount) > 0
  const canProceed = addrValid && amtValid

  const fetchNativePrice = useCallback(async () => {
    const cgId: Record<number, string> = {
      1:"ethereum", 137:"matic-network", 42161:"ethereum", 10:"ethereum", 56:"binancecoin", 8453:"ethereum"
    }
    try {
      const id  = cgId[activeChain.id] ?? "ethereum"
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`)
      const d   = await res.json()
      setNativePrice(d[id]?.usd ?? 0)
      return d[id]?.usd ?? 0
    } catch { return 0 }
  }, [activeChain.id])

  const refreshGas = useCallback(async (price?: number) => {
    if (!addr) return
    setGasLoading(true)
    setGasError(false)
    try {
      const p    = price ?? nativePrice
      const data = await fetchGasData(
        activeChain, addr, toAddress,
        !!selectedToken.contract, selectedToken.contract,
        selectedToken.decimals, p,
      )
      setGasData(data)
    } catch {
      setGasError(true)
    } finally {
      setGasLoading(false)
    }
  }, [addr, activeChain, toAddress, selectedToken, nativePrice])

  useEffect(() => {
    const tokens = [nativeToken, ...(CHAIN_TOKENS[activeChain.id] ?? [])]
    setSelectedToken(tokens[0])
    setGasData(null)
    fetchNativePrice().then(p => refreshGas(p))
    setCustomTokens(loadCustomTokens(activeChain.id))
  }, [activeChain.id])

  useEffect(() => {
    if (addr) refreshGas()
  }, [toAddress, selectedToken.symbol])

  useEffect(() => {
    gasTimer.current = setInterval(() => refreshGas(), 15000)
    return () => { if (gasTimer.current) clearInterval(gasTimer.current) }
  }, [refreshGas])

  if (!isRenderReady) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFF" }}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={{ marginTop: 12, color: "#94A3B8", fontSize: 13, fontWeight: "600" }}>
          Preparing Secure Interface...
        </Text>
      </View>
    )
  }

  async function handleSend() {
    // Tenderly pre-sign simulation
    setSimLoading(true)
    try {
      const gasLimit = gasData?.gasLimit ?? (selectedToken.contract ? 65000n : 21000n)
      const simData  = selectedToken.contract
        ? new ethers.Interface(ERC20_ABI).encodeFunctionData('transfer', [
            toAddress, ethers.parseUnits(amount, selectedToken.decimals)
          ])
        : ''
      const simValue = selectedToken.contract
        ? '0x0'
        : ('0x' + ethers.parseEther(amount).toString(16))
      const sim = await simulateTransaction(
        activeChain.id, addr ?? '',
        selectedToken.contract ?? toAddress,
        simData, simValue, gasLimit
      )
      setSimResult(sim)
      if (sim.status === 'reverted') {
        Alert.alert(
          'Transaction Will Fail',
          sim.errorReason ?? 'This transaction will revert on-chain.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Send Anyway', style: 'destructive', onPress: () => executeSend() }
          ]
        )
        setSimLoading(false)
        return
      }
    } catch { /* fail open */ }
    finally { setSimLoading(false) }
    executeSend()
  }

  async function executeSend() {
    setSending(true)
    try {

      // ── ERC-4337 AA path ────────────────────────────────────────────────────
      if (aaEnabled && aaSupported) {
        const result = selectedToken.contract
          ? await sendERC20AA(
              selectedToken.contract,
              toAddress,
              ethers.parseUnits(amount, selectedToken.decimals),
            )
          : await sendAA(
              toAddress,
              ethers.parseEther(amount),
            )

        if (result.ok) {
          setTxHash(result.txHash ?? result.userOpHash ?? '')
          setStep("success")
        } else {
          Alert.alert("AA Send Failed", result.error ?? "UserOp failed")
        }
        return
      }

      // ── Standard EOA path (unchanged) ──────────────────────────────────────
      const privateKey = await loadPrivateKey()
      if (!privateKey) {
        Alert.alert("Authentication Required", "Could not load wallet key.")
        return
      }
      const provider = getProvider(activeChain)
      const wallet   = new ethers.Wallet(privateKey, provider)
      const gasLimit = gasData?.gasLimit ?? (selectedToken.contract ? 65000n : 21000n)
      const tier     = selectedTier

      const gasParams = gasData?.isEIP1559 && tier ? {
        maxFeePerGas:         ethers.parseUnits(tier.maxFeeGwei.toFixed(9), "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits(tier.priorityGwei.toFixed(9), "gwei"),
        gasLimit,
      } : {
        gasPrice: ethers.parseUnits((tier?.gwei ?? 20).toFixed(9), "gwei"),
        gasLimit,
      }

      let tx: ethers.TransactionResponse

      if (selectedToken.contract) {
        const contract = new ethers.Contract(selectedToken.contract, ERC20_ABI, wallet)
        tx = await contract.transfer(
          toAddress,
          ethers.parseUnits(amount, selectedToken.decimals),
          gasParams
        )
      } else {
        tx = await wallet.sendTransaction({
          to:    ethers.getAddress(toAddress),
          value: ethers.parseEther(amount),
          ...gasParams,
        })
      }

      const receipt = await tx.wait(1)
      setTxHash(receipt?.hash ?? tx.hash)
      setStep("success")
    } catch (e: any) {
      Alert.alert("Transaction Failed", e?.reason ?? e?.shortMessage ?? e?.message ?? "Unknown error")
    } finally {
      setSending(false)
    }
  }

  // --- Success ---
  if (step === "success") return (
    <View style={s.c}>
      <View style={s.successWrap}>
        <View style={s.tick}>
          <Ionicons name="checkmark" size={36} color="#10B981" />
        </View>
        <Text style={s.successTitle}>Sent!</Text>
        {aaEnabled && (
          <View style={s.aaBadgeSuccess}>
            <Ionicons name="flash" size={12} color="#7C3AED" />
            <Text style={s.aaBadgeSuccessT}>Sent via Smart Account</Text>
          </View>
        )}
        <Text style={s.successSub}>
          {amount} {selectedToken.symbol} on {activeChain.name}{"\n"}
          to {toAddress.slice(0,8)}...{toAddress.slice(-6)}
        </Text>
        <View style={s.hashBox}>
          <Text style={s.hashLabel}>{aaEnabled ? "Transaction Hash (UserOp)" : "Transaction Hash"}</Text>
          <Text style={s.hash} numberOfLines={2} selectable>{txHash}</Text>
        </View>
        <TouchableOpacity style={s.explorerBtn}
          onPress={() => Linking.openURL(getTxUrl(activeChain, txHash))}>
          <Text style={[s.explorerBtnT, { color: activeChain.color }]}>
            View on Explorer
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: activeChain.color }]}
          onPress={() => router.replace("/dashboard")}>
          <Text style={s.doneBtnT}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  // --- Confirm ---
  if (step === "confirm") return (
    <View style={s.c}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => setStep("form")}>
          <Ionicons name="arrow-back" size={22} color="#6366F1" />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Confirm Send</Text>
        <View style={{ width:38 }} />
      </View>
      <ScrollView style={s.scroll}>

        {/* Amount card */}
        <View style={[s.confirmCard, { backgroundColor: activeChain.color }]}>
          <Text style={s.confirmLabel}>Sending on {activeChain.name}</Text>
          <Text style={s.confirmAmt}>{amount} {selectedToken.symbol}</Text>
          {aaEnabled && (
            <View style={s.aaBadgeConfirm}>
              <Ionicons name="flash" size={12} color="#fff" />
              <Text style={s.aaBadgeConfirmT}>Smart Account · ERC-4337</Text>
            </View>
          )}
          {selectedTier && !aaEnabled && (
            <View style={s.confirmGasBadge}>
              <Text style={s.confirmGasBadgeT}>
                {selectedTier.label} gas  ~{selectedTier.limitedTime}
              </Text>
            </View>
          )}
        </View>

        {/* Details */}
        <View style={s.detailCard}>
          {[
            { l:"Network",    v: activeChain.name },
            { l:"From",       v: aaEnabled && smartAddress
                ? `SA: ${smartAddress.slice(0,8)}...${smartAddress.slice(-6)}`
                : addr ? addr.slice(0,8)+"..."+addr.slice(-6) : "-" },
            { l:"To",         v: toAddress.slice(0,8)+"..."+toAddress.slice(-6) },
            { l:"Token",      v: `${selectedToken.name} (${selectedToken.symbol})` },
            { l:"Send mode",  v: aaEnabled ? "Smart Account (ERC-4337)" : "Standard EOA" },
            ...(!aaEnabled ? [
              { l:"Gas limit",  v: gasData ? `${gasData.gasLimit.toLocaleString()} units` : "..." },
              { l:"Gas price",  v: selectedTier ? `${selectedTier.gwei} Gwei` : "..." },
              { l:"Max fee",    v: selectedTier && gasData?.isEIP1559 ? `${selectedTier.maxFeeGwei} Gwei` : "-" },
              { l:"Priority",   v: selectedTier && gasData?.isEIP1559 ? `${selectedTier.priorityGwei} Gwei` : "-" },
              { l:"Est. fee",   v: selectedTier ? `~$${selectedTier.costUSD} (${selectedTier.costETH} ${activeChain.symbol})` : "..." },
              { l:"Est. time",  v: selectedTier?.limitedTime ?? "..." },
            ] : [
              { l:"Smart account", v: aaDeployed ? "Deployed ✓" : "Will deploy on first tx" },
            ]),
          ].map(row => (
            <View key={row.l} style={s.detailRow}>
              <Text style={s.detailL}>{row.l}</Text>
              <Text style={s.detailV}>{row.v}</Text>
            </View>
          ))}
        </View>

        <View style={s.bioHint}>
          <View style={{ flexDirection:"row", alignItems:"center", gap:8 }}>
            <Ionicons name="warning-outline" size={16} color="#C2410C" />
            <Text style={[s.bioHintT, { flex:1 }]}>Review carefully. Transactions cannot be reversed.</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[s.sendBtn, { backgroundColor: aaEnabled ? "#7C3AED" : activeChain.color }, (sending || aaLoading) && { opacity: 0.6 }]}
          onPress={handleSend}
          disabled={sending || aaLoading}
        >
          {sending || aaLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.sendBtnT}>
                {aaEnabled ? "⚡ Confirm & Send (AA)" : "Confirm & Send"}
              </Text>
          }
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )

  // --- Form ---
  return (
    <KeyboardAvoidingView style={s.c} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => goBack()}>
          <Ionicons name="arrow-back" size={22} color="#6366F1" />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Send</Text>
        <View style={{ width:38 }} />
      </View>

      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">

        {/* ── AA Mode Toggle ── */}
        {aaSupported && Platform.OS !== 'web' && (
          <View style={s.aaToggleRow}>
            <View style={s.aaToggleLeft}>
              <View style={s.aaToggleIcon}>
                <Ionicons name="flash" size={16} color="#7C3AED" />
              </View>
              <View>
                <Text style={s.aaToggleLabel}>Smart Account</Text>
                <Text style={s.aaToggleSub}>
                  {aaEnabled && smartAddress
                    ? `${smartAddress.slice(0,8)}...${smartAddress.slice(-6)} · ${aaDeployed ? 'Active' : 'Ready to deploy'}`
                    : 'ERC-4337 · gas abstraction'}
                </Text>
              </View>
            </View>
            <Switch
              value={aaEnabled}
              onValueChange={toggleAA}
              trackColor={{ false: "#E2E8F0", true: "#7C3AED" }}
              thumbColor="#fff"
            />
          </View>
        )}

        {/* Token selector */}
        <View style={{ flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:8, marginTop:16 }}>
          <Text style={[s.fieldLabel, { marginBottom:0, marginTop:0 }]}>Token</Text>
          <TouchableOpacity
            style={s.searchTokenBtn}
            onPress={() => setShowTokenSearch(true)}
          >
            <View style={{ flexDirection:"row", alignItems:"center", gap:4 }}>
              <Ionicons name="search-outline" size={13} color="#6366F1" />
              <Text style={s.searchTokenBtnT}>Search Tokens</Text>
            </View>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.tokenBtn} onPress={() => setShowPicker(!showPicker)}>
          <View style={[s.tokenDot, { backgroundColor: selectedToken.color + "20" }]}>
            <Text style={[s.tokenDotT, { color: selectedToken.color }]}>
              {selectedToken.symbol.slice(0,2)}
            </Text>
          </View>
          <Text style={s.tokenBtnT}>{selectedToken.name} ({selectedToken.symbol})</Text>
          <Ionicons name={showPicker ? "chevron-up" : "chevron-down"} size={16} color="#94A3B8" />
        </TouchableOpacity>

        {showPicker && (
          <View style={s.picker}>
            {allTokens.map(t => (
              <TouchableOpacity
                key={t.symbol}
                style={[s.pickerRow, selectedToken.symbol === t.symbol && s.pickerRowActive]}
                onPress={() => { setSelectedToken(t); setShowPicker(false) }}
              >
                <View style={[s.tokenDot, { backgroundColor: t.color + "20" }]}>
                  <Text style={[s.tokenDotT, { color: t.color }]}>{t.symbol.slice(0,2)}</Text>
                </View>
                <View>
                  <Text style={s.pickerSym}>{t.symbol}</Text>
                  <Text style={s.pickerName}>{t.name}</Text>
                </View>
                {selectedToken.symbol === t.symbol && <Ionicons name="checkmark-circle" size={18} color="#6366F1" />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* To address */}
        <Text style={s.fieldLabel}>To Address</Text>
        <View style={[s.inputWrap, addrValid && s.inputValid, toAddress.length > 0 && !addrValid && !ensName && s.inputError]}>
          <TextInput
            style={s.input}
            value={toAddress}
            onChangeText={handleAddressChange}
            placeholder="0x... or name.eth"
            placeholderTextColor="#CBD5E1"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {ensLoading && <ActivityIndicator size="small" color="#6366F1" />}
          {addrValid && !ensLoading && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
        </View>
        {ensName ? (
          <View style={s.ensResolved}>
            <Ionicons name="checkmark-circle" size={13} color="#10B981" />
            <Text style={s.ensResolvedT}>{ensName.slice(0,8)}...{ensName.slice(-6)}</Text>
          </View>
        ) : toAddress.length > 0 && !addrValid && !ensLoading && (
          <Text style={s.errorMsg}>Invalid Ethereum address or ENS name</Text>
        )}

        {/* Amount */}
        <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
          <Text style={[s.fieldLabel, { marginBottom:0, marginTop:16 }]}>Amount ({selectedToken.symbol})</Text>
          <TouchableOpacity style={s.maxBtn} onPress={handleMax}>
            <Text style={s.maxBtnT}>MAX</Text>
          </TouchableOpacity>
        </View>
        <View style={[s.inputWrap, amtValid && s.inputValid]}>
          <TextInput
            style={s.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor="#CBD5E1"
            keyboardType="decimal-pad"
          />
          <Text style={s.inputSuffix}>{selectedToken.symbol}</Text>
        </View>

        {/* Gas estimator — hidden when AA is on (bundler handles gas) */}
        {!aaEnabled && (
          <>
            <Text style={s.fieldLabel}>Gas Speed</Text>

            {gasLoading && !gasData ? (
              <View style={s.gasLoadingBox}>
                <ActivityIndicator size="small" color="#6366F1" />
                <Text style={s.gasLoadingT}>Fetching gas prices...</Text>
              </View>
            ) : gasError ? (
              <View style={s.gasErrorBox}>
                <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                  <Ionicons name="warning-outline" size={14} color="#F59E0B" />
                  <Text style={s.gasErrorT}>Could not fetch gas  using defaults</Text>
                </View>
                <TouchableOpacity onPress={() => refreshGas()}>
                  <Text style={s.gasRetryT}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : gasData ? (
              <View style={s.gasTiersWrap}>
                {gasData.isEIP1559 && (
                  <View style={s.baseFeeRow}>
                    <Text style={s.baseFeeLabel}>Base fee ({activeChain.name})</Text>
                    <Text style={s.baseFeeVal}>{gasData.baseFeeGwei.toFixed(2)} Gwei</Text>
                    <View style={s.liveIndicator}>
                      <View style={s.liveDot} />
                      <Text style={s.liveT}>Live</Text>
                    </View>
                  </View>
                )}

                {gasData.tiers.map(tier => (
                  <TouchableOpacity
                    key={tier.speed}
                    style={[
                      s.gasTier,
                      selectedSpeed === tier.speed && {
                        borderColor: tier.color,
                        backgroundColor: tier.bg,
                      }
                    ]}
                    onPress={() => setSelectedSpeed(tier.speed)}
                    activeOpacity={0.8}
                  >
                    <View style={[s.gasTierIcon, { backgroundColor: tier.color + "20" }]}>
                      <Ionicons name={tier.icon as any} size={18} color={tier.color} />
                    </View>
                    <View style={s.gasTierMid}>
                      <Text style={[s.gasTierLabel, selectedSpeed === tier.speed && { color: tier.color }]}>
                        {tier.label}
                      </Text>
                      <Text style={s.gasTierTime}>{tier.limitedTime}</Text>
                    </View>

                    <View style={s.gasTierRight}>
                      <Text style={[s.gasTierGwei, selectedSpeed === tier.speed && { color: tier.color }]}>
                        {tier.gwei} Gwei
                      </Text>
                      <Text style={s.gasTierUSD}>
                        {tier.costUSD !== "0.0000" ? `~$${tier.costUSD}` : `${tier.costETH} ${activeChain.symbol}`}
                      </Text>
                    </View>

                    {selectedSpeed === tier.speed && (
                      <View style={[s.gasTierCheck, { backgroundColor: tier.color }]}>
                        <Ionicons name="checkmark" size={13} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}

                {selectedTier && (
                  <View style={s.gasSummary}>
                    <Text style={s.gasSummaryL}>Estimated fee</Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={s.gasSummaryAmt}>
                        {selectedTier.costUSD !== "0.0000"
                          ? `~$${selectedTier.costUSD}`
                          : `${selectedTier.costETH} ${activeChain.symbol}`}
                      </Text>
                      <Text style={s.gasSummaryEth}>
                        {selectedTier.costETH} {activeChain.symbol}    {selectedTier.gwei} Gwei
                      </Text>
                    </View>
                  </View>
                )}

                <TouchableOpacity style={s.gasRefreshRow} onPress={() => refreshGas()}>
                  <Text style={s.gasRefreshT}>
                    Updated {Math.floor((Date.now() - gasData.lastUpdated) / 1000)}s ago  Tap to refresh
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}

        {/* AA info banner when AA is on */}
        {aaEnabled && (
          <View style={s.aaBanner}>
            <Ionicons name="flash" size={16} color="#7C3AED" />
            <Text style={s.aaBannerT}>
              Gas is handled by the bundler. Your smart account will be deployed automatically on first send.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[
            s.sendBtn,
            { backgroundColor: aaEnabled ? "#7C3AED" : activeChain.color },
            !canProceed && { opacity: 0.4 }
          ]}
          onPress={() => setStep("confirm")}
          disabled={!canProceed}
        >
          <Text style={s.sendBtnT}>
            {aaEnabled ? "⚡ Review Transaction (AA)" : "Review Transaction"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <TokenSearchModal
        visible={showTokenSearch}
        chain={activeChain}
        walletAddress={addr ?? ""}
        onClose={() => setShowTokenSearch(false)}
        onTokenAdded={token => {
          setCustomTokens(loadCustomTokens(activeChain.id))
          setShowTokenSearch(false)
        }}
      />
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  c:                  { flex:1, backgroundColor:"#F8FAFF" },
  hdr:                { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:20, paddingTop:20, paddingBottom:16 },
  back:               { width:38, height:38, borderRadius:12, backgroundColor:"#fff", borderWidth:1, borderColor:"#E2E8F0", alignItems:"center", justifyContent:"center" },
  backT:              { color:"#6366F1", fontSize:18, fontWeight:"700" },
  hdrTitle:           { color:"#1E1B4B", fontSize:17, fontWeight:"700" },
  scroll:             { flex:1, paddingHorizontal:20 },
  fieldLabel:         { color:"#64748B", fontSize:13, fontWeight:"600", marginBottom:8, marginTop:16, textTransform:"uppercase", letterSpacing:0.3 },
  tokenBtn:           { flexDirection:"row", alignItems:"center", backgroundColor:"#fff", borderRadius:16, borderWidth:1.5, borderColor:"#E2E8F0", padding:14, gap:12 },
  tokenDot:           { width:36, height:36, borderRadius:18, alignItems:"center", justifyContent:"center" },
  tokenDotT:          { fontSize:13, fontWeight:"700" },
  tokenBtnT:          { flex:1, color:"#1E1B4B", fontSize:15, fontWeight:"600" },
  tokenChev:          { color:"#94A3B8", fontSize:12 },
  picker:             { backgroundColor:"#fff", borderRadius:16, borderWidth:1.5, borderColor:"#E2E8F0", marginTop:4, overflow:"hidden" },
  pickerRow:          { flexDirection:"row", alignItems:"center", padding:14, gap:12, borderBottomWidth:1, borderBottomColor:"#F1F5F9" },
  pickerRowActive:    { backgroundColor:"#EEF2FF" },
  pickerSym:          { color:"#1E1B4B", fontSize:14, fontWeight:"700" },
  pickerName:         { color:"#94A3B8", fontSize:12 },
  pickerCheck:        { marginLeft:"auto", color:"#6366F1", fontSize:13, fontWeight:"700" },
  inputWrap:          { flexDirection:"row", alignItems:"center", backgroundColor:"#fff", borderRadius:16, borderWidth:1.5, borderColor:"#E2E8F0", paddingHorizontal:16, height:52 },
  inputValid:         { borderColor:"#6EE7B7" },
  inputError:         { borderColor:"#FCA5A5" },
  input:              { flex:1, color:"#1E1B4B", fontSize:15, height:52 },
  inputSuffix:        { color:"#94A3B8", fontSize:14, fontWeight:"600" },
  validMark:          { color:"#10B981", fontSize:13, fontWeight:"700" },
  errorMsg:           { color:"#EF4444", fontSize:12, marginTop:4, marginLeft:4 },
  ensResolved:        { flexDirection:"row", alignItems:"center", gap:4, marginTop:4, marginLeft:4 },
  ensResolvedT:       { color:"#10B981", fontSize:12, fontWeight:"600", fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  maxBtn:             { marginTop:16, backgroundColor:"#EEF2FF", borderRadius:8, paddingVertical:4, paddingHorizontal:10, borderWidth:1, borderColor:"#C7D2FE" },
  maxBtnT:            { color:"#6366F1", fontSize:12, fontWeight:"700", letterSpacing:0.5 },

  // AA toggle
  aaToggleRow:        { flexDirection:"row", alignItems:"center", justifyContent:"space-between", backgroundColor:"#F5F3FF", borderRadius:14, padding:14, marginTop:16, borderWidth:1, borderColor:"#DDD6FE" },
  aaToggleLeft:       { flexDirection:"row", alignItems:"center", gap:10, flex:1 },
  aaToggleIcon:       { width:34, height:34, borderRadius:10, backgroundColor:"#EDE9FE", alignItems:"center", justifyContent:"center" },
  aaToggleLabel:      { color:"#4C1D95", fontSize:14, fontWeight:"700" },
  aaToggleSub:        { color:"#7C3AED", fontSize:11, marginTop:1 },

  // AA banner
  aaBanner:           { flexDirection:"row", alignItems:"flex-start", gap:10, backgroundColor:"#F5F3FF", borderRadius:12, padding:14, marginTop:12, borderWidth:1, borderColor:"#DDD6FE" },
  aaBannerT:          { flex:1, color:"#5B21B6", fontSize:12, lineHeight:18 },

  // AA badges
  aaBadgeConfirm:     { flexDirection:"row", alignItems:"center", gap:4, marginTop:8, backgroundColor:"rgba(255,255,255,0.2)", paddingVertical:4, paddingHorizontal:12, borderRadius:20 },
  aaBadgeConfirmT:    { color:"#fff", fontSize:11, fontWeight:"600" },
  aaBadgeSuccess:     { flexDirection:"row", alignItems:"center", gap:4, backgroundColor:"#EDE9FE", paddingVertical:5, paddingHorizontal:12, borderRadius:20, marginBottom:12 },
  aaBadgeSuccessT:    { color:"#7C3AED", fontSize:12, fontWeight:"600" },

  // Gas estimator
  gasLoadingBox:      { flexDirection:"row", alignItems:"center", gap:10, backgroundColor:"#fff", borderRadius:14, padding:16, borderWidth:1, borderColor:"#E2E8F0" },
  gasLoadingT:        { color:"#94A3B8", fontSize:13 },
  gasErrorBox:        { flexDirection:"row", alignItems:"center", justifyContent:"space-between", backgroundColor:"#FEF2F2", borderRadius:14, padding:14, borderWidth:1, borderColor:"#FECACA" },
  gasErrorT:          { color:"#EF4444", fontSize:13, flex:1 },
  gasRetryT:          { color:"#6366F1", fontSize:13, fontWeight:"600", marginLeft:8 },
  gasTiersWrap:       { backgroundColor:"#fff", borderRadius:18, borderWidth:1.5, borderColor:"#E2E8F0", overflow:"hidden" },
  baseFeeRow:         { flexDirection:"row", alignItems:"center", paddingHorizontal:16, paddingVertical:10, borderBottomWidth:1, borderBottomColor:"#F1F5F9", gap:8 },
  baseFeeLabel:       { color:"#94A3B8", fontSize:12, fontWeight:"600", flex:1 },
  baseFeeVal:         { color:"#1E1B4B", fontSize:12, fontWeight:"700" },
  liveIndicator:      { flexDirection:"row", alignItems:"center", gap:4 },
  liveDot:            { width:6, height:6, borderRadius:3, backgroundColor:"#10B981" },
  liveT:              { color:"#10B981", fontSize:11, fontWeight:"600" },
  gasTier:            { flexDirection:"row", alignItems:"center", padding:14, gap:12, borderBottomWidth:1, borderBottomColor:"#F1F5F9", borderWidth:0, borderRadius:0 },
  gasTierIcon:        { width:38, height:38, borderRadius:19, alignItems:"center", justifyContent:"center" },
  gasTierIconT:       { fontSize:14, fontWeight:"800" },
  gasTierMid:         { flex:1 },
  gasTierLabel:       { color:"#1E1B4B", fontSize:14, fontWeight:"700" },
  gasTierTime:        { color:"#94A3B8", fontSize:12, marginTop:2 },
  gasTierRight:       { alignItems:"flex-end" },
  gasTierGwei:        { color:"#1E1B4B", fontSize:14, fontWeight:"700" },
  gasTierUSD:         { color:"#94A3B8", fontSize:12, marginTop:2 },
  gasTierCheck:       { width:22, height:22, borderRadius:11, alignItems:"center", justifyContent:"center", marginLeft:8 },
  gasTierCheckT:      { color:"#fff", fontSize:10, fontWeight:"800" },
  gasSummary:         { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:16, paddingVertical:12, borderTopWidth:1, borderTopColor:"#F1F5F9", backgroundColor:"#F8FAFF" },
  gasSummaryL:        { color:"#64748B", fontSize:13, fontWeight:"600" },
  gasSummaryAmt:      { color:"#1E1B4B", fontSize:15, fontWeight:"700" },
  gasSummaryEth:      { color:"#94A3B8", fontSize:11, marginTop:2 },
  gasRefreshRow:      { alignItems:"center", paddingVertical:10, borderTopWidth:1, borderTopColor:"#F1F5F9" },
  gasRefreshT:        { color:"#94A3B8", fontSize:11 },

  sendBtn:            { borderRadius:16, paddingVertical:16, alignItems:"center", marginTop:20 },
  sendBtnT:           { color:"#fff", fontSize:16, fontWeight:"700" },
  confirmCard:        { borderRadius:20, padding:24, alignItems:"center", marginBottom:16 },
  confirmLabel:       { color:"rgba(255,255,255,0.8)", fontSize:13, marginBottom:8 },
  confirmAmt:         { color:"#fff", fontSize:32, fontWeight:"800" },
  confirmGasBadge:    { marginTop:10, backgroundColor:"rgba(255,255,255,0.2)", paddingVertical:5, paddingHorizontal:14, borderRadius:20 },
  confirmGasBadgeT:   { color:"#fff", fontSize:12, fontWeight:"600" },
  detailCard:         { backgroundColor:"#fff", borderRadius:16, borderWidth:1, borderColor:"#E2E8F0", overflow:"hidden", marginBottom:16 },
  detailRow:          { flexDirection:"row", justifyContent:"space-between", padding:14, borderBottomWidth:1, borderBottomColor:"#F1F5F9" },
  detailL:            { color:"#64748B", fontSize:13 },
  detailV:            { color:"#1E1B4B", fontSize:13, fontWeight:"600", maxWidth:"55%" as any, textAlign:"right" },
  bioHint:            { backgroundColor:"#FFF7ED", borderRadius:12, padding:14, marginBottom:16, borderWidth:1, borderColor:"#FED7AA" },
  bioHintT:           { color:"#C2410C", fontSize:13, lineHeight:20 },
  successWrap:        { flex:1, alignItems:"center", justifyContent:"center", padding:32 },
  tick:               { width:72, height:72, borderRadius:36, backgroundColor:"#D1FAE5", alignItems:"center", justifyContent:"center", marginBottom:16 },
  successTitle:       { color:"#1E1B4B", fontSize:28, fontWeight:"800", marginBottom:8 },
  successSub:         { color:"#64748B", fontSize:14, textAlign:"center", lineHeight:22, marginBottom:24 },
  hashBox:            { backgroundColor:"#F8FAFF", borderRadius:12, padding:16, width:"100%", marginBottom:16, borderWidth:1, borderColor:"#E2E8F0" },
  hashLabel:          { color:"#94A3B8", fontSize:12, marginBottom:6 },
  hash:               { color:"#1E1B4B", fontSize:12, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", lineHeight:18 },
  explorerBtn:        { marginBottom:12 },
  explorerBtnT:       { fontSize:14, fontWeight:"600" },
  doneBtn:            { borderRadius:16, paddingVertical:16, paddingHorizontal:40, marginTop:8 },
  doneBtnT:           { color:"#fff", fontSize:16, fontWeight:"700" },
  searchTokenBtn:     { backgroundColor:"#EEF2FF", paddingVertical:6, paddingHorizontal:12, borderRadius:10, borderWidth:1, borderColor:"#C7D2FE" },
  searchTokenBtnT:    { color:"#6366F1", fontSize:12, fontWeight:"700" },
})
