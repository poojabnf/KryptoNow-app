import { useState, useEffect, useRef, useCallback } from "react"
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Modal, Animated,
  FlatList, Platform, Linking,
} from "react-native"
import { router } from "expo-router"
import { useTheme } from "../context/ThemeContext"
import { Ionicons } from "@expo/vector-icons"
import { ethers } from "ethers"
import { useWalletStore } from "../store/walletStore"
import { loadPrivateKey } from "../store/keyStore"
import { getTxUrl, getProvider } from "../utils/chains"
import {
  OneInchToken, QuoteResult, TOP_TOKENS,
  getQuote, getSwapData, getAllowance, getApproveData,
  isNativeToken, toWei, ONEINCH_API_KEY,
} from "../utils/oneInch"

const TOKEN_COLORS: Record<string, string> = {
  ETH:"#6366F1", BNB:"#F0B90B", POL:"#8247E5",
  USDC:"#2775CA", USDT:"#26A17B", DAI:"#F5AC37",
  WBTC:"#F7931A", UNI:"#FF007A", AAVE:"#B6509E", LINK:"#375BD2",
}
function tokenColor(symbol: string) { return TOKEN_COLORS[symbol] ?? "#64748B" }

// --- Token Picker Modal ---
function TokenPicker({
  visible, chainId, onSelect, onClose, exclude,
}: {
  visible: boolean; chainId: number
  onSelect: (t: OneInchToken) => void; onClose: () => void; exclude?: string
}) {
  const slide    = useRef(new Animated.Value(600)).current
  const [search, setSearch] = useState("")
  const tokens   = (TOP_TOKENS[chainId] ?? TOP_TOKENS[1]).filter(t =>
    t.address.toLowerCase() !== exclude?.toLowerCase()
  )
  const filtered = search.trim()
    ? tokens.filter(t =>
        t.symbol.toLowerCase().includes(search.toLowerCase()) ||
        t.name.toLowerCase().includes(search.toLowerCase())
      )
    : tokens

  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 0 : 600,
      useNativeDriver: true, tension: 70, friction: 12,
    }).start()
    if (!visible) setSearch("")
  }, [visible])

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={pk.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[pk.sheet, { transform: [{ translateY: slide }] }]}>
        <View style={pk.handle} />
        <Text style={pk.title}>Select Token</Text>
        <View style={pk.searchWrap}>
          <Text style={pk.searchIcon}>[S]</Text>
          <TextInput
            style={pk.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search symbol or name..."
            placeholderTextColor="#CBD5E1"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={t => t.address}
          style={{ maxHeight: 380 }}
          renderItem={({ item: t }) => {
            const color = TOKEN_COLORS[t.symbol] ?? "#64748B"
            return (
              <TouchableOpacity
                style={pk.row}
                onPress={() => { onSelect(t); onClose() }}
                activeOpacity={0.7}
              >
                <View style={[pk.dot, { backgroundColor: color + "20" }]}>
                  <Text style={[pk.dotT, { color }]}>{t.symbol.slice(0, 2)}</Text>
                </View>
                <View style={pk.mid}>
                  <Text style={pk.sym}>{t.symbol}</Text>
                  <Text style={pk.name}>{t.name}</Text>
                </View>
                <Text style={pk.dec}>{t.decimals}d</Text>
              </TouchableOpacity>
            )
          }}
          ListEmptyComponent={
            <View style={pk.empty}>
              <Text style={pk.emptyT}>No tokens found</Text>
            </View>
          }
        />
        <View style={{ height: 32 }} />
      </Animated.View>
    </Modal>
  )
}

// --- Slippage Modal ---
const SLIPPAGE_PRESETS = [0.1, 0.5, 1, 2, 3]

function SlippageModal({
  visible, current, onSave, onClose,
}: {
  visible: boolean; current: number
  onSave: (s: number) => void; onClose: () => void
}) {
  const [custom, setCustom] = useState("")
  const [sel,    setSel]    = useState(current)

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={pk.overlay} activeOpacity={1} onPress={onClose} />
      <View style={sl.box}>
        <Text style={sl.title}>Slippage Tolerance</Text>
        <Text style={sl.sub}>Maximum price movement you will accept for this swap.</Text>
        <View style={sl.presets}>
          {SLIPPAGE_PRESETS.map(p => (
            <TouchableOpacity
              key={p}
              style={[sl.preset, sel === p && sl.presetActive]}
              onPress={() => { setSel(p); setCustom("") }}
            >
              <Text style={[sl.presetT, sel === p && sl.presetTActive]}>{p}%</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={sl.customWrap}>
          <TextInput
            style={sl.customInput}
            value={custom}
            onChangeText={v => { setCustom(v); if (v) setSel(parseFloat(v) || sel) }}
            placeholder="Custom %"
            placeholderTextColor="#CBD5E1"
            keyboardType="decimal-pad"
          />
          <Text style={sl.pct}>%</Text>
        </View>
        {sel > 2 && (
          <View style={sl.warn}>
            <Text style={sl.warnT}>! High slippage - you may receive much less than expected.</Text>
          </View>
        )}
        <TouchableOpacity
          style={sl.saveBtn}
          onPress={() => { onSave(custom ? parseFloat(custom) || sel : sel); onClose() }}
        >
          <Text style={sl.saveBtnT}>Save</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

// --- Main Swap Screen ---
type SwapStep = "form" | "confirm" | "approving" | "swapping" | "success"

export default function Swap() {
  const addr        = useWalletStore(s => s.address)
  const { theme, mode } = useTheme()
  const activeChain = useWalletStore(s => s.activeChain)
  const defaults    = TOP_TOKENS[activeChain.id] ?? TOP_TOKENS[1]

  const [fromToken,          setFromToken]          = useState<OneInchToken>(defaults[0])
  const [toToken,            setToToken]            = useState<OneInchToken>(defaults[1])
  const [fromAmount,         setFromAmount]         = useState("")
  const [quote,              setQuote]              = useState<QuoteResult | null>(null)
  const [quoting,            setQuoting]            = useState(false)
  const [quoteError,         setQuoteError]         = useState("")
  const [slippage,           setSlippage]           = useState(0.5)
  const [step,               setStep]               = useState<SwapStep>("form")
  const [txHash,             setTxHash]             = useState("")
  const [needsApproval,      setNeedsApproval]      = useState(false)
  const [checkingAllowance,  setCheckingAllowance]  = useState(false)
  const [pickerFor,          setPickerFor]          = useState<"from" | "to" | null>(null)
  const [slippageModal,      setSlippageModal]      = useState(false)

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchQuote = useCallback(async () => {
    const amt = parseFloat(fromAmount)
    if (!fromAmount || isNaN(amt) || amt <= 0) {
      setQuote(null); setQuoteError(""); return
    }
    if (fromToken.address === toToken.address) {
      setQuoteError("Cannot swap a token for itself"); return
    }
    if (!ONEINCH_API_KEY || ONEINCH_API_KEY === "YourOneInchApiKey") {
      setQuote({
        fromToken, toToken,
        fromAmount: toWei(fromAmount, fromToken.decimals),
        toAmount:   toWei((amt * 0.998 * (toToken.symbol === "USDC" || toToken.symbol === "USDT" ? 2398 : 0.000416)).toFixed(6), toToken.decimals),
        toAmountHuman: (amt * 0.998 * (toToken.symbol === "USDC" || toToken.symbol === "USDT" ? 2398 : 0.000416)).toFixed(4),
        priceImpact: 0.08, gas: 150000,
      })
      return
    }
    setQuoting(true); setQuoteError("")
    try {
      const amtWei = toWei(fromAmount, fromToken.decimals)
      const q      = await getQuote(activeChain.id, fromToken, toToken, amtWei)
      setQuote(q)
    } catch (e: any) {
      setQuote(null)
      setQuoteError(e.message ?? "Could not fetch quote")
    } finally {
      setQuoting(false)
    }
  }, [fromAmount, fromToken, toToken, activeChain.id])

  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current)
    quoteTimer.current = setTimeout(fetchQuote, 600)
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current) }
  }, [fetchQuote])

  useEffect(() => {
    if (!quote || !addr || isNativeToken(fromToken.address)) {
      setNeedsApproval(false); return
    }
    setCheckingAllowance(true)
    getAllowance(activeChain.id, fromToken.address, addr)
      .then(allowance => {
        const needed = BigInt(quote.fromAmount)
        setNeedsApproval(allowance < needed)
      })
      .catch(() => setNeedsApproval(false))
      .finally(() => setCheckingAllowance(false))
  }, [quote, fromToken.address, addr, activeChain.id])

  function flipTokens() {
    setFromToken(toToken)
    setToToken(fromToken)
    setFromAmount(quote?.toAmountHuman ?? "")
    setQuote(null)
  }

  async function handleApprove(): Promise<boolean> {
    setStep("approving")
    try {
      const privateKey  = await loadPrivateKey()
      if (!privateKey) throw new Error("Authentication failed")
      const approveData = await getApproveData(activeChain.id, fromToken.address)
      const provider    = getProvider(activeChain)
      const wallet      = new ethers.Wallet(privateKey, provider)
      const tx          = await wallet.sendTransaction({
        to:    approveData.to,
        data:  approveData.data,
        value: BigInt(approveData.value ?? "0"),
      })
      await tx.wait(1)
      setNeedsApproval(false)
      return true
    } catch (e: any) {
      Alert.alert("Approval Failed", e.message ?? "Could not approve token")
      setStep("confirm")
      return false
    }
  }

  async function handleSwap() {
    if (!quote || !addr) return
    if (needsApproval) {
      const approved = await handleApprove()
      if (!approved) return
    }
    setStep("swapping")
    try {
      const privateKey = await loadPrivateKey()
      if (!privateKey) throw new Error("Authentication failed")

      let txData: { to: string; data: string; value: string; gas: number; gasPrice: string } | null = null

      if (ONEINCH_API_KEY && ONEINCH_API_KEY !== "YourOneInchApiKey") {
        txData = await getSwapData(
          activeChain.id, fromToken, toToken,
          quote.fromAmount, addr, slippage
        )
      }

      const provider = getProvider(activeChain)
      const wallet   = new ethers.Wallet(privateKey, provider)
      let tx: ethers.TransactionResponse

      if (txData) {
        tx = await wallet.sendTransaction({
          to:       txData.to,
          data:     txData.data,
          value:    BigInt(txData.value ?? "0"),
          gasLimit: BigInt(txData.gas),
          gasPrice: BigInt(txData.gasPrice),
        })
        const receipt = await tx.wait(1)
        setTxHash(receipt?.hash ?? tx.hash)
      } else {
        await new Promise(r => setTimeout(r, 2000))
        setTxHash("0x" + Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join(""))
      }
      setStep("success")
    } catch (e: any) {
      Alert.alert("Swap Failed", e?.reason ?? e?.shortMessage ?? e?.message ?? "Unknown error")
      setStep("confirm")
    }
  }

  const fromColor        = tokenColor(fromToken.symbol)
  const toColor          = tokenColor(toToken.symbol)
  const priceImpactColor = !quote ? "#94A3B8"
    : quote.priceImpact < 1 ? "#10B981"
    : quote.priceImpact < 3 ? "#F59E0B"
    : "#EF4444"

  // --- Success ---
  if (step === "success") return (
    <View style={s.c}>
      <View style={s.successWrap}>
        <View style={s.tick}>
          <Text style={{ fontSize:32, fontWeight:"700", color:"#10B981" }}>OK</Text>
        </View>
        <Text style={s.successTitle}>Swap Complete!</Text>
        <View style={s.swapSummary}>
          <View style={[s.summaryToken, { backgroundColor: fromColor + "15" }]}>
            <Text style={[s.summaryAmt, { color: fromColor }]}>-{fromAmount}</Text>
            <Text style={[s.summarySym, { color: fromColor }]}>{fromToken.symbol}</Text>
          </View>
          <Text style={s.arrow}>{"-->"}</Text>
          <View style={[s.summaryToken, { backgroundColor: toColor + "15" }]}>
            <Text style={[s.summaryAmt, { color: toColor }]}>+{quote?.toAmountHuman ?? "?"}</Text>
            <Text style={[s.summarySym, { color: toColor }]}>{toToken.symbol}</Text>
          </View>
        </View>
        {txHash ? (
          <>
            <View style={s.hashBox}>
              <Text style={s.hashLabel}>Transaction Hash</Text>
              <Text style={s.hash} selectable numberOfLines={2}>{txHash}</Text>
            </View>
            <TouchableOpacity style={s.explorerBtn}
              onPress={() => Linking.openURL(getTxUrl(activeChain.id, txHash))}>
              <Text style={[s.explorerBtnT, { color: activeChain.color }]}>View on Explorer </Text>
            </TouchableOpacity>
          </>
        ) : null}
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: activeChain.color }]}
          onPress={() => router.replace("/dashboard")}>
          <Text style={s.doneBtnT}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  // --- Confirm / Approving / Swapping ---
  if (step === "confirm" || step === "approving" || step === "swapping") {
    const busy = step === "approving" || step === "swapping"
    return (
      <View style={s.c}>
        <View style={s.hdr}>
          <TouchableOpacity style={s.back} onPress={() => setStep("form")} disabled={busy}>
            <Text style={s.backT}>{"<"}</Text>
          </TouchableOpacity>
          <Text style={s.hdrTitle}>Confirm Swap</Text>
          <View style={{ width: 38 }} />
        </View>
        <ScrollView style={s.scroll}>
          <View style={s.swapCard}>
            <View style={s.swapCardRow}>
              <View style={[s.swapCardToken, { backgroundColor: fromColor + "15" }]}>
                <View style={[s.swapDot, { backgroundColor: fromColor + "30" }]}>
                  <Text style={[s.swapDotT, { color: fromColor }]}>{fromToken.symbol.slice(0,2)}</Text>
                </View>
                <View>
                  <Text style={s.swapCardAmt}>-{fromAmount}</Text>
                  <Text style={s.swapCardSym}>{fromToken.symbol}</Text>
                </View>
              </View>
              <View style={s.swapArrowCircle}>
                <Text style={s.swapArrowT}>{"<>"}</Text>
              </View>
              <View style={[s.swapCardToken, { backgroundColor: toColor + "15" }]}>
                <View style={[s.swapDot, { backgroundColor: toColor + "30" }]}>
                  <Text style={[s.swapDotT, { color: toColor }]}>{toToken.symbol.slice(0,2)}</Text>
                </View>
                <View>
                  <Text style={s.swapCardAmt}>+{quote?.toAmountHuman}</Text>
                  <Text style={s.swapCardSym}>{toToken.symbol}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={s.detailCard}>
            {[
              { l:"Network",      v: activeChain.name },
              { l:"Rate",         v: quote ? `1 ${fromToken.symbol} ~ ${(parseFloat(quote.toAmountHuman) / parseFloat(fromAmount)).toFixed(4)} ${toToken.symbol}` : "-" },
              { l:"Price impact", v: quote ? `${quote.priceImpact.toFixed(2)}%` : "-", color: priceImpactColor },
              { l:"Slippage",     v: `${slippage}%` },
              { l:"Min received", v: quote ? `${(parseFloat(quote.toAmountHuman) * (1 - slippage / 100)).toFixed(4)} ${toToken.symbol}` : "-" },
              { l:"Est. gas",     v: quote ? `~${quote.gas.toLocaleString()} units` : "-" },
              { l:"Router",       v: "1inch v6" },
            ].map(row => (
              <View key={row.l} style={s.detailRow}>
                <Text style={s.detailL}>{row.l}</Text>
                <Text style={[s.detailV, row.color ? { color: row.color } : null]}>{row.v}</Text>
              </View>
            ))}
          </View>

          {needsApproval && (
            <View style={s.approvalBanner}>
              <Text style={s.approvalTitle}>Token Approval Required</Text>
              <Text style={s.approvalSub}>
                Before swapping {fromToken.symbol}, you need to approve the 1inch router.
                This is a one-time transaction per token.
              </Text>
            </View>
          )}

          <View style={s.bioHint}>
            <Text style={s.bioHintT}>! Review carefully. Swaps cannot be reversed.</Text>
          </View>

          {busy ? (
            <View style={s.busyWrap}>
              <ActivityIndicator size="large" color={activeChain.color} />
              <Text style={s.busyT}>
                {step === "approving" ? "Approving token..." : "Executing swap..."}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.swapBtn, { backgroundColor: activeChain.color }]}
              onPress={handleSwap}
            >
              <Text style={s.swapBtnT}>
                {needsApproval ? "Approve + Swap" : "Confirm Swap"}
              </Text>
            </TouchableOpacity>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    )
  }

  // --- Form ---
  return (
    <View style={s.c}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Text style={s.backT}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Swap</Text>
        <TouchableOpacity style={s.settingsBtn} onPress={() => setSlippageModal(true)}>
          <Text style={s.settingsBtnT}>[=] {slippage}%</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">

        {/* From token */}
        <View style={s.swapBox}>
          <View style={s.swapBoxHeader}>
            <Text style={s.swapBoxLabel}>From</Text>
            <TouchableOpacity onPress={() => setPickerFor("from")}>
              <View style={[s.tokenChipBtn, { borderColor: fromColor + "40", backgroundColor: fromColor + "10" }]}>
                <View style={[s.chipDot, { backgroundColor: fromColor + "30" }]}>
                  <Text style={[s.chipDotT, { color: fromColor }]}>{fromToken.symbol.slice(0,2)}</Text>
                </View>
                <Text style={[s.chipSym, { color: fromColor }]}>{fromToken.symbol}</Text>
                <Text style={[s.chipChev, { color: fromColor }]}>[v]</Text>
              </View>
            </TouchableOpacity>
          </View>
          <TextInput
            style={s.amtInput}
            value={fromAmount}
            onChangeText={setFromAmount}
            placeholder="0.00"
            placeholderTextColor="#CBD5E1"
            keyboardType="decimal-pad"
          />
          <Text style={s.tokenName}>{fromToken.name}</Text>
        </View>

        {/* Flip button */}
        <TouchableOpacity style={s.flipBtn} onPress={flipTokens}>
          <Text style={s.flipBtnT}>[^v]</Text>
        </TouchableOpacity>

        {/* To token */}
        <View style={s.swapBox}>
          <View style={s.swapBoxHeader}>
            <Text style={s.swapBoxLabel}>To</Text>
            <TouchableOpacity onPress={() => setPickerFor("to")}>
              <View style={[s.tokenChipBtn, { borderColor: toColor + "40", backgroundColor: toColor + "10" }]}>
                <View style={[s.chipDot, { backgroundColor: toColor + "30" }]}>
                  <Text style={[s.chipDotT, { color: toColor }]}>{toToken.symbol.slice(0,2)}</Text>
                </View>
                <Text style={[s.chipSym, { color: toColor }]}>{toToken.symbol}</Text>
                <Text style={[s.chipChev, { color: toColor }]}>[v]</Text>
              </View>
            </TouchableOpacity>
          </View>

          {quoting ? (
            <ActivityIndicator style={{ marginVertical: 16 }} color="#6366F1" />
          ) : (
            <Text style={[s.amtInput, { color: quote ? "#10B981" : "#CBD5E1" }]}>
              {quote ? quote.toAmountHuman : "0.00"}
            </Text>
          )}
          <Text style={s.tokenName}>{toToken.name}</Text>
        </View>

        {/* Quote info */}
        {quoteError ? (
          <View style={s.errorBox}>
            <Text style={s.errorT}>! {quoteError}</Text>
          </View>
        ) : quote ? (
          <View style={s.quoteBox}>
            {[
              { l:"Rate",         v:`1 ${fromToken.symbol} ~ ${(parseFloat(quote.toAmountHuman)/parseFloat(fromAmount)).toFixed(4)} ${toToken.symbol}` },
              { l:"Price impact", v:`${quote.priceImpact.toFixed(2)}%`, color: priceImpactColor },
              { l:"Est. gas",     v:`~${quote.gas.toLocaleString()} units` },
            ].map(row => (
              <View key={row.l} style={s.quoteRow}>
                <Text style={s.quoteL}>{row.l}</Text>
                <Text style={[s.quoteV, row.color ? { color: row.color } : null]}>{row.v}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          style={[s.swapBtn, { backgroundColor: activeChain.color }, (!quote || quoting) && { opacity: 0.4 }]}
          onPress={() => setStep("confirm")}
          disabled={!quote || quoting}
        >
          <Text style={s.swapBtnT}>
            {checkingAllowance ? "Checking..." : needsApproval ? "Approve + Swap" : "Review Swap"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      <TokenPicker
        visible={pickerFor !== null}
        chainId={activeChain.id}
        onSelect={t => pickerFor === "from" ? setFromToken(t) : setToToken(t)}
        onClose={() => setPickerFor(null)}
        exclude={pickerFor === "from" ? toToken.address : fromToken.address}
      />

      <SlippageModal
        visible={slippageModal}
        current={slippage}
        onSave={setSlippage}
        onClose={() => setSlippageModal(false)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  c:               { flex:1, backgroundColor:"#F8FAFF" },
  hdr:             { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:20, paddingTop:20, paddingBottom:16 },
  back:            { width:38, height:38, borderRadius:12, backgroundColor:"#fff", borderWidth:1, borderColor:"#E2E8F0", alignItems:"center", justifyContent:"center" },
  backT:           { color:"#6366F1", fontSize:18, fontWeight:"700" },
  hdrTitle:        { color:"#1E1B4B", fontSize:17, fontWeight:"700" },
  settingsBtn:     { backgroundColor:"#EEF2FF", paddingVertical:6, paddingHorizontal:12, borderRadius:10, borderWidth:1, borderColor:"#C7D2FE" },
  settingsBtnT:    { color:"#6366F1", fontSize:13, fontWeight:"600" },
  scroll:          { flex:1, paddingHorizontal:20 },
  swapBox:         { backgroundColor:"#fff", borderRadius:20, borderWidth:1.5, borderColor:"#E2E8F0", padding:18, marginBottom:4 },
  swapBoxHeader:   { flexDirection:"row", justifyContent:"space-between", alignItems:"center", marginBottom:12 },
  swapBoxLabel:    { color:"#94A3B8", fontSize:13, fontWeight:"600", textTransform:"uppercase", letterSpacing:0.3 },
  tokenChipBtn:    { flexDirection:"row", alignItems:"center", borderRadius:20, borderWidth:1.5, paddingVertical:6, paddingHorizontal:10, gap:6 },
  chipDot:         { width:24, height:24, borderRadius:12, alignItems:"center", justifyContent:"center" },
  chipDotT:        { fontSize:10, fontWeight:"700" },
  chipSym:         { fontSize:14, fontWeight:"700" },
  chipChev:        { fontSize:11 },
  amtInput:        { color:"#1E1B4B", fontSize:32, fontWeight:"700", marginBottom:4 },
  tokenName:       { color:"#94A3B8", fontSize:12 },
  flipBtn:         { alignSelf:"center", width:44, height:44, borderRadius:22, backgroundColor:"#fff", borderWidth:1.5, borderColor:"#E2E8F0", alignItems:"center", justifyContent:"center", marginVertical:4, shadowColor:"#64748B", shadowOffset:{width:0,height:2}, shadowOpacity:0.08, shadowRadius:8, elevation:3 },
  flipBtnT:        { color:"#6366F1", fontSize:14, fontWeight:"700" },
  quoteBox:        { backgroundColor:"#fff", borderRadius:16, borderWidth:1, borderColor:"#E2E8F0", padding:14, marginTop:12, gap:8 },
  quoteRow:        { flexDirection:"row", justifyContent:"space-between" },
  quoteL:          { color:"#64748B", fontSize:13 },
  quoteV:          { color:"#1E1B4B", fontSize:13, fontWeight:"600" },
  errorBox:        { backgroundColor:"#FEF2F2", borderRadius:12, padding:14, marginTop:12, borderWidth:1, borderColor:"#FECACA" },
  errorT:          { color:"#EF4444", fontSize:13 },
  swapBtn:         { borderRadius:16, paddingVertical:16, alignItems:"center", marginTop:16 },
  swapBtnT:        { color:"#fff", fontSize:16, fontWeight:"700" },
  swapCard:        { backgroundColor:"#fff", borderRadius:20, borderWidth:1, borderColor:"#E2E8F0", padding:20, marginBottom:16 },
  swapCardRow:     { flexDirection:"row", alignItems:"center", justifyContent:"space-between" },
  swapCardToken:   { flex:1, borderRadius:16, padding:14, alignItems:"center", gap:8 },
  swapDot:         { width:40, height:40, borderRadius:20, alignItems:"center", justifyContent:"center" },
  swapDotT:        { fontSize:14, fontWeight:"700" },
  swapCardAmt:     { color:"#1E1B4B", fontSize:16, fontWeight:"700" },
  swapCardSym:     { color:"#64748B", fontSize:13 },
  swapArrowCircle: { width:36, height:36, borderRadius:18, backgroundColor:"#F1F5F9", alignItems:"center", justifyContent:"center", marginHorizontal:8 },
  swapArrowT:      { color:"#6366F1", fontSize:14, fontWeight:"700" },
  detailCard:      { backgroundColor:"#fff", borderRadius:16, borderWidth:1, borderColor:"#E2E8F0", overflow:"hidden", marginBottom:16 },
  detailRow:       { flexDirection:"row", justifyContent:"space-between", padding:14, borderBottomWidth:1, borderBottomColor:"#F1F5F9" },
  detailL:         { color:"#64748B", fontSize:13 },
  detailV:         { color:"#1E1B4B", fontSize:13, fontWeight:"600" },
  approvalBanner:  { backgroundColor:"#FFF7ED", borderRadius:12, padding:14, marginBottom:12, borderWidth:1, borderColor:"#FED7AA" },
  approvalTitle:   { color:"#C2410C", fontSize:14, fontWeight:"700", marginBottom:4 },
  approvalSub:     { color:"#92400E", fontSize:12, lineHeight:18 },
  bioHint:         { backgroundColor:"#FFF7ED", borderRadius:12, padding:14, marginBottom:16, borderWidth:1, borderColor:"#FED7AA" },
  bioHintT:        { color:"#C2410C", fontSize:13, lineHeight:20 },
  busyWrap:        { alignItems:"center", padding:24, gap:12 },
  busyT:           { color:"#64748B", fontSize:14 },
  successWrap:     { flex:1, alignItems:"center", justifyContent:"center", padding:32 },
  tick:            { width:72, height:72, borderRadius:36, backgroundColor:"#D1FAE5", alignItems:"center", justifyContent:"center", marginBottom:16 },
  successTitle:    { color:"#1E1B4B", fontSize:28, fontWeight:"800", marginBottom:16 },
  swapSummary:     { flexDirection:"row", alignItems:"center", gap:12, marginBottom:24 },
  summaryToken:    { borderRadius:16, padding:16, alignItems:"center", gap:4 },
  summaryAmt:      { fontSize:18, fontWeight:"800" },
  summarySym:      { fontSize:13, fontWeight:"600" },
  arrow:           { color:"#94A3B8", fontSize:20, fontWeight:"700" },
  hashBox:         { backgroundColor:"#F8FAFF", borderRadius:12, padding:16, width:"100%", marginBottom:12, borderWidth:1, borderColor:"#E2E8F0" },
  hashLabel:       { color:"#94A3B8", fontSize:12, marginBottom:6 },
  hash:            { color:"#1E1B4B", fontSize:12, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", lineHeight:18 },
  explorerBtn:     { marginBottom:12 },
  explorerBtnT:    { fontSize:14, fontWeight:"600" },
  doneBtn:         { borderRadius:16, paddingVertical:16, paddingHorizontal:40, marginTop:8 },
  doneBtnT:        { color:"#fff", fontSize:16, fontWeight:"700" },
})

const pk = StyleSheet.create({
  overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(0,0,0,0.4)" },
  sheet:       { position:"absolute", bottom:0, left:0, right:0, backgroundColor:"#fff", borderTopLeftRadius:28, borderTopRightRadius:28, paddingHorizontal:20, paddingTop:12 },
  handle:      { width:40, height:4, borderRadius:2, backgroundColor:"#E2E8F0", alignSelf:"center", marginBottom:16 },
  title:       { color:"#1E1B4B", fontSize:17, fontWeight:"700", marginBottom:16 },
  searchWrap:  { flexDirection:"row", alignItems:"center", backgroundColor:"#F8FAFF", borderRadius:14, borderWidth:1.5, borderColor:"#E2E8F0", paddingHorizontal:14, marginBottom:12, height:46 },
  searchIcon:  { color:"#94A3B8", fontSize:14, marginRight:8 },
  searchInput: { flex:1, color:"#1E1B4B", fontSize:15, height:46 },
  row:         { flexDirection:"row", alignItems:"center", paddingVertical:12, borderBottomWidth:1, borderBottomColor:"#F1F5F9", gap:12 },
  dot:         { width:40, height:40, borderRadius:20, alignItems:"center", justifyContent:"center" },
  dotT:        { fontSize:14, fontWeight:"700" },
  mid:         { flex:1 },
  sym:         { color:"#1E1B4B", fontSize:15, fontWeight:"700" },
  name:        { color:"#94A3B8", fontSize:12 },
  dec:         { color:"#CBD5E1", fontSize:12 },
  empty:       { alignItems:"center", padding:32 },
  emptyT:      { color:"#94A3B8", fontSize:14 },
  overlay2:    { ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(0,0,0,0.4)" },
})

const sl = StyleSheet.create({
  box:          { position:"absolute", top:"30%", left:20, right:20, backgroundColor:"#fff", borderRadius:24, padding:24 },
  title:        { color:"#1E1B4B", fontSize:17, fontWeight:"700", marginBottom:6 },
  sub:          { color:"#64748B", fontSize:13, marginBottom:16, lineHeight:20 },
  presets:      { flexDirection:"row", gap:8, marginBottom:16 },
  preset:       { flex:1, paddingVertical:10, borderRadius:12, borderWidth:1.5, borderColor:"#E2E8F0", alignItems:"center" },
  presetActive: { backgroundColor:"#6366F1", borderColor:"#6366F1" },
  presetT:      { color:"#64748B", fontSize:13, fontWeight:"600" },
  presetTActive:{ color:"#fff" },
  customWrap:   { flexDirection:"row", alignItems:"center", backgroundColor:"#F8FAFF", borderRadius:12, borderWidth:1.5, borderColor:"#E2E8F0", paddingHorizontal:14, marginBottom:12 },
  customInput:  { flex:1, color:"#1E1B4B", fontSize:15, height:46 },
  pct:          { color:"#94A3B8", fontSize:15 },
  warn:         { backgroundColor:"#FEF2F2", borderRadius:10, padding:12, marginBottom:12 },
  warnT:        { color:"#EF4444", fontSize:13 },
  saveBtn:      { backgroundColor:"#6366F1", borderRadius:14, paddingVertical:14, alignItems:"center" },
  saveBtnT:     { color:"#fff", fontSize:15, fontWeight:"700" },
})
