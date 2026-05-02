import { useState, useEffect } from "react"
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from "react-native"
import { router } from "expo-router"
import { ethers } from "ethers"
import { useWalletStore } from "../store/walletStore"
import { loadPrivateKey } from "../store/keyStore"
import { isValidAddress } from "../utils/crypto"
import { getTxUrl, getProvider } from "../utils/chains"

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

type Step = "form" | "confirm" | "success"

export default function Send() {
  const addr        = useWalletStore(s => s.address)
  const activeChain = useWalletStore(s => s.activeChain)

  const erc20List   = CHAIN_TOKENS[activeChain.id] ?? []
  const nativeToken = { symbol: activeChain.symbol, name: activeChain.nativeName, decimals: 18, contract: null as null, color: activeChain.color }
  const allTokens   = [nativeToken, ...erc20List]

  const [selectedToken, setSelectedToken] = useState(allTokens[0])
  const [showPicker,    setShowPicker]    = useState(false)
  const [toAddress,     setToAddress]     = useState("")
  const [amount,        setAmount]        = useState("")
  const [gasPrice,      setGasPrice]      = useState<string | null>(null)
  const [gasLimit,      setGasLimit]      = useState<bigint>(21000n)
  const [gasLoading,    setGasLoading]    = useState(false)
  const [nativePrice,   setNativePrice]   = useState(0)
  const [sending,       setSending]       = useState(false)
  const [step,          setStep]          = useState<Step>("form")
  const [txHash,        setTxHash]        = useState("")

  useEffect(() => {
    const tokens = [nativeToken, ...(CHAIN_TOKENS[activeChain.id] ?? [])]
    setSelectedToken(tokens[0])
    fetchGas()
    fetchNativePrice()
  }, [activeChain.id])

  useEffect(() => {
    if (isValidAddress(toAddress)) estimateGas()
  }, [selectedToken, toAddress])

  const addrValid  = isValidAddress(toAddress)
  const amtValid   = !isNaN(parseFloat(amount)) && parseFloat(amount) > 0
  const canProceed = addrValid && amtValid

  async function fetchGas() {
    setGasLoading(true)
    try {
      const provider = getProvider(activeChain)
      const feeData  = await provider.getFeeData()
      setGasPrice((Number(feeData.gasPrice ?? 0n) / 1e9).toFixed(1))
    } catch { setGasPrice("--") }
    finally   { setGasLoading(false) }
  }

  async function estimateGas() {
    if (!addr || !isValidAddress(toAddress)) return
    try {
      const provider = getProvider(activeChain)
      const estimate = selectedToken.contract
        ? await provider.estimateGas({
            from: addr, to: selectedToken.contract,
            data: new ethers.Interface(ERC20_ABI).encodeFunctionData("transfer", [
              toAddress, ethers.parseUnits("1", selectedToken.decimals),
            ])
          })
        : await provider.estimateGas({ from: addr, to: toAddress, value: 1n })
      setGasLimit(estimate)
    } catch {
      setGasLimit(selectedToken.contract ? 65000n : 21000n)
    }
  }

  async function fetchNativePrice() {
    const cgId: Record<number, string> = {
      1:"ethereum", 137:"matic-network", 42161:"ethereum", 10:"ethereum", 56:"binancecoin"
    }
    try {
      const id  = cgId[activeChain.id] ?? "ethereum"
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`)
      const d   = await res.json()
      setNativePrice(d[id]?.usd ?? 0)
    } catch {}
  }

  const gasCostETH = gasPrice && gasPrice !== "--"
    ? ((parseFloat(gasPrice) * Number(gasLimit)) / 1e9).toFixed(6) : null
  const gasCostUSD = gasCostETH
    ? (parseFloat(gasCostETH) * nativePrice).toFixed(4) : null

  async function handleSend() {
    setSending(true)
    try {
      const privateKey = await loadPrivateKey()
      if (!privateKey) {
        Alert.alert("Authentication Required", "Could not load wallet key.")
        return
      }
      const provider = getProvider(activeChain)
      const wallet   = new ethers.Wallet(privateKey, provider)
      let tx: ethers.TransactionResponse

      if (selectedToken.contract) {
        const contract = new ethers.Contract(selectedToken.contract, ERC20_ABI, wallet)
        tx = await contract.transfer(
          toAddress,
          ethers.parseUnits(amount, selectedToken.decimals),
          { gasLimit: gasLimit + 10000n }
        )
      } else {
        tx = await wallet.sendTransaction({
          to: ethers.getAddress(toAddress),
          value: ethers.parseEther(amount),
          gasLimit,
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

  // -- Success --
  if (step === "success") return (
    <View style={s.c}>
      <View style={s.successWrap}>
        <View style={s.tick}><Text style={{ fontSize:32, fontWeight:"700", color:"#10B981" }}>OK</Text></View>
        <Text style={s.successTitle}>Sent!</Text>
        <Text style={s.successSub}>
          {amount} {selectedToken.symbol} on {activeChain.name}{"\n"}
          to {toAddress.slice(0,8)}...{toAddress.slice(-6)}
        </Text>
        <View style={s.hashBox}>
          <Text style={s.hashLabel}>Transaction Hash</Text>
          <Text style={s.hash} numberOfLines={2} selectable>{txHash}</Text>
        </View>
        <TouchableOpacity style={s.explorerBtn}
          onPress={() => Linking.openURL(getTxUrl(activeChain.id, txHash))}>
          <Text style={[s.explorerBtnT, { color: activeChain.color }]}>
            View on Explorer [->]
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: activeChain.color }]}
          onPress={() => router.replace("/dashboard")}>
          <Text style={s.doneBtnT}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  // -- Confirm --
  if (step === "confirm") return (
    <View style={s.c}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => setStep("form")}>
          <Text style={s.backT}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Confirm Send</Text>
        <View style={{ width:38 }} />
      </View>
      <ScrollView style={s.scroll}>
        <View style={[s.confirmCard, { backgroundColor: activeChain.color }]}>
          <Text style={s.confirmLabel}>Sending on {activeChain.name}</Text>
          <Text style={s.confirmAmt}>{amount} {selectedToken.symbol}</Text>
        </View>
        <View style={s.detailCard}>
          {[
            { l:"Network",   v: activeChain.name },
            { l:"From",      v: addr ? addr.slice(0,8)+"..."+addr.slice(-6) : "-" },
            { l:"To",        v: toAddress.slice(0,8)+"..."+toAddress.slice(-6) },
            { l:"Token",     v: `${selectedToken.name} (${selectedToken.symbol})` },
            { l:"Gas limit", v: `${gasLimit.toLocaleString()} units` },
            { l:"Gas price", v: gasPrice ? `${gasPrice} Gwei` : "..." },
            { l:"Est. fee",  v: gasCostUSD ? `~$${gasCostUSD} (${gasCostETH} ${activeChain.symbol})` : "..." },
          ].map(row => (
            <View key={row.l} style={s.detailRow}>
              <Text style={s.detailL}>{row.l}</Text>
              <Text style={s.detailV}>{row.v}</Text>
            </View>
          ))}
        </View>
        <View style={s.bioHint}>
          <Text style={s.bioHintT}>[!] Review carefully. Transactions cannot be reversed.</Text>
        </View>
        <TouchableOpacity
          style={[s.sendBtn, { backgroundColor: activeChain.color }, sending && { opacity: 0.6 }]}
          onPress={handleSend}
          disabled={sending}
        >
          {sending
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.sendBtnT}>Confirm & Send</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  )

  // -- Form --
  return (
    <KeyboardAvoidingView style={s.c} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Text style={s.backT}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Send</Text>
        <View style={{ width:38 }} />
      </View>

      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Token selector */}
        <Text style={s.fieldLabel}>Token</Text>
        <TouchableOpacity style={s.tokenBtn} onPress={() => setShowPicker(!showPicker)}>
          <View style={[s.tokenDot, { backgroundColor: selectedToken.color + "20" }]}>
            <Text style={[s.tokenDotT, { color: selectedToken.color }]}>
              {selectedToken.symbol.slice(0,2)}
            </Text>
          </View>
          <Text style={s.tokenBtnT}>{selectedToken.name} ({selectedToken.symbol})</Text>
          <Text style={s.tokenChev}>{showPicker ? "[^]" : "[v]"}</Text>
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
                {selectedToken.symbol === t.symbol && <Text style={s.pickerCheck}>[*]</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* To address */}
        <Text style={s.fieldLabel}>To Address</Text>
        <View style={[s.inputWrap, addrValid && s.inputValid, toAddress.length > 0 && !addrValid && s.inputError]}>
          <TextInput
            style={s.input}
            value={toAddress}
            onChangeText={setToAddress}
            placeholder="0x..."
            placeholderTextColor="#CBD5E1"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {addrValid && <Text style={s.validMark}>[OK]</Text>}
        </View>
        {toAddress.length > 0 && !addrValid && (
          <Text style={s.errorMsg}>Invalid Ethereum address</Text>
        )}

        {/* Amount */}
        <Text style={s.fieldLabel}>Amount ({selectedToken.symbol})</Text>
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

        {/* Gas info */}
        <View style={s.gasRow}>
          <Text style={s.gasLabel}>Est. Gas Fee</Text>
          {gasLoading
            ? <ActivityIndicator size="small" color="#6366F1" />
            : <Text style={s.gasVal}>
                {gasCostUSD ? `~$${gasCostUSD}` : "--"}
                {gasCostETH ? `  (${gasCostETH} ${activeChain.symbol})` : ""}
              </Text>
          }
        </View>

        <TouchableOpacity
          style={[s.sendBtn, { backgroundColor: activeChain.color }, !canProceed && { opacity: 0.4 }]}
          onPress={() => setStep("confirm")}
          disabled={!canProceed}
        >
          <Text style={s.sendBtnT}>Review Transaction</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  c:              { flex:1, backgroundColor:"#F8FAFF" },
  hdr:            { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:20, paddingTop:20, paddingBottom:16 },
  back:           { width:38, height:38, borderRadius:12, backgroundColor:"#fff", borderWidth:1, borderColor:"#E2E8F0", alignItems:"center", justifyContent:"center" },
  backT:          { color:"#6366F1", fontSize:18, fontWeight:"700" },
  hdrTitle:       { color:"#1E1B4B", fontSize:17, fontWeight:"700" },
  scroll:         { flex:1, paddingHorizontal:20 },
  fieldLabel:     { color:"#64748B", fontSize:13, fontWeight:"600", marginBottom:8, marginTop:16, textTransform:"uppercase", letterSpacing:0.3 },
  tokenBtn:       { flexDirection:"row", alignItems:"center", backgroundColor:"#fff", borderRadius:16, borderWidth:1.5, borderColor:"#E2E8F0", padding:14, gap:12 },
  tokenDot:       { width:36, height:36, borderRadius:18, alignItems:"center", justifyContent:"center" },
  tokenDotT:      { fontSize:13, fontWeight:"700" },
  tokenBtnT:      { flex:1, color:"#1E1B4B", fontSize:15, fontWeight:"600" },
  tokenChev:      { color:"#94A3B8", fontSize:12 },
  picker:         { backgroundColor:"#fff", borderRadius:16, borderWidth:1.5, borderColor:"#E2E8F0", marginTop:4, overflow:"hidden" },
  pickerRow:      { flexDirection:"row", alignItems:"center", padding:14, gap:12, borderBottomWidth:1, borderBottomColor:"#F1F5F9" },
  pickerRowActive:{ backgroundColor:"#EEF2FF" },
  pickerSym:      { color:"#1E1B4B", fontSize:14, fontWeight:"700" },
  pickerName:     { color:"#94A3B8", fontSize:12 },
  pickerCheck:    { marginLeft:"auto", color:"#6366F1", fontSize:13, fontWeight:"700" },
  inputWrap:      { flexDirection:"row", alignItems:"center", backgroundColor:"#fff", borderRadius:16, borderWidth:1.5, borderColor:"#E2E8F0", paddingHorizontal:16, height:52 },
  inputValid:     { borderColor:"#6EE7B7" },
  inputError:     { borderColor:"#FCA5A5" },
  input:          { flex:1, color:"#1E1B4B", fontSize:15, height:52 },
  inputSuffix:    { color:"#94A3B8", fontSize:14, fontWeight:"600" },
  validMark:      { color:"#10B981", fontSize:13, fontWeight:"700" },
  errorMsg:       { color:"#EF4444", fontSize:12, marginTop:4, marginLeft:4 },
  gasRow:         { flexDirection:"row", alignItems:"center", justifyContent:"space-between", backgroundColor:"#fff", borderRadius:12, padding:14, marginTop:12, borderWidth:1, borderColor:"#E2E8F0" },
  gasLabel:       { color:"#64748B", fontSize:13, fontWeight:"600" },
  gasVal:         { color:"#1E1B4B", fontSize:13, fontWeight:"600" },
  sendBtn:        { borderRadius:16, paddingVertical:16, alignItems:"center", marginTop:20 },
  sendBtnT:       { color:"#fff", fontSize:16, fontWeight:"700" },
  confirmCard:    { borderRadius:20, padding:24, alignItems:"center", marginBottom:16 },
  confirmLabel:   { color:"rgba(255,255,255,0.8)", fontSize:13, marginBottom:8 },
  confirmAmt:     { color:"#fff", fontSize:32, fontWeight:"800" },
  detailCard:     { backgroundColor:"#fff", borderRadius:16, borderWidth:1, borderColor:"#E2E8F0", overflow:"hidden", marginBottom:16 },
  detailRow:      { flexDirection:"row", justifyContent:"space-between", padding:14, borderBottomWidth:1, borderBottomColor:"#F1F5F9" },
  detailL:        { color:"#64748B", fontSize:13 },
  detailV:        { color:"#1E1B4B", fontSize:13, fontWeight:"600", maxWidth:"55%" as any, textAlign:"right" },
  bioHint:        { backgroundColor:"#FFF7ED", borderRadius:12, padding:14, marginBottom:16, borderWidth:1, borderColor:"#FED7AA" },
  bioHintT:       { color:"#C2410C", fontSize:13, lineHeight:20 },
  successWrap:    { flex:1, alignItems:"center", justifyContent:"center", padding:32 },
  tick:           { width:72, height:72, borderRadius:36, backgroundColor:"#D1FAE5", alignItems:"center", justifyContent:"center", marginBottom:16 },
  successTitle:   { color:"#1E1B4B", fontSize:28, fontWeight:"800", marginBottom:8 },
  successSub:     { color:"#64748B", fontSize:14, textAlign:"center", lineHeight:22, marginBottom:24 },
  hashBox:        { backgroundColor:"#F8FAFF", borderRadius:12, padding:16, width:"100%", marginBottom:16, borderWidth:1, borderColor:"#E2E8F0" },
  hashLabel:      { color:"#94A3B8", fontSize:12, marginBottom:6 },
  hash:           { color:"#1E1B4B", fontSize:12, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", lineHeight:18 },
  explorerBtn:    { marginBottom:12 },
  explorerBtnT:   { fontSize:14, fontWeight:"600" },
  doneBtn:        { borderRadius:16, paddingVertical:16, paddingHorizontal:40, marginTop:8 },
  doneBtnT:       { color:"#fff", fontSize:16, fontWeight:"700" },
})