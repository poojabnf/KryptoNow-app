import { useState, useEffect } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from 'react-native'
import { router } from 'expo-router'
import { ethers } from 'ethers'
import { useWalletStore } from '../store/walletStore'
import { loadPrivateKey } from '../store/keyStore'
import { isValidAddress } from '../utils/crypto'
import { getTxUrl , getProvider } from '../utils/chains'

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
]

// ERC-20 tokens per chain â€” extend as needed
const CHAIN_TOKENS: Record<number, { symbol: string; name: string; decimals: number; contract: string; color: string }[]> = {
  1: [ // Ethereum
    { symbol:'USDC', name:'USD Coin',  decimals:6,  contract:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', color:'#2775CA' },
    { symbol:'USDT', name:'Tether',    decimals:6,  contract:'0xdAC17F958D2ee523a2206206994597C13D831ec7', color:'#26A17B' },
    { symbol:'LINK', name:'Chainlink', decimals:18, contract:'0x514910771AF9Ca656af840dff83E8264EcF986CA', color:'#375BD2' },
    { symbol:'UNI',  name:'Uniswap',  decimals:18, contract:'0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', color:'#FF007A' },
  ],
  137: [ // Polygon
    { symbol:'USDC', name:'USD Coin',  decimals:6,  contract:'0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', color:'#2775CA' },
    { symbol:'USDT', name:'Tether',    decimals:6,  contract:'0xc2132D05D31c914a87C6611C10748AEb04B58e8F', color:'#26A17B' },
  ],
  42161: [ // Arbitrum
    { symbol:'USDC', name:'USD Coin',  decimals:6,  contract:'0xaf88d065e77c8cC2239327C5EDb3A432268e5831', color:'#2775CA' },
    { symbol:'USDT', name:'Tether',    decimals:6,  contract:'0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', color:'#26A17B' },
  ],
  10: [ // Optimism
    { symbol:'USDC', name:'USD Coin',  decimals:6,  contract:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', color:'#2775CA' },
    { symbol:'USDT', name:'Tether',    decimals:6,  contract:'0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', color:'#26A17B' },
  ],
  56: [ // BNB
    { symbol:'USDT', name:'Tether',    decimals:18, contract:'0x55d398326f99059fF775485246999027B3197955', color:'#26A17B' },
    { symbol:'BUSD', name:'BUSD',      decimals:18, contract:'0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', color:'#F0B90B' },
  ],
}

type Step = 'form' | 'confirm' | 'success'

export default function Send() {
  const addr        = useWalletStore(s => s.address)
  const activeChain = useWalletStore(s => s.activeChain)

  const erc20List = CHAIN_TOKENS[activeChain.id] ?? []
  const nativeToken = { symbol: activeChain.symbol, name: activeChain.nativeName, decimals: 18, contract: null as null, color: activeChain.color }
  const allTokens   = [nativeToken, ...erc20List]

  const [selectedToken,   setSelectedToken]   = useState(allTokens[0])
  const [showPicker,      setShowPicker]      = useState(false)
  const [toAddress,       setToAddress]       = useState('')
  const [amount,          setAmount]          = useState('')
  const [gasPrice,        setGasPrice]        = useState<string | null>(null)
  const [gasLimit,        setGasLimit]        = useState<bigint>(21000n)
  const [gasLoading,      setGasLoading]      = useState(false)
  const [nativePrice,     setNativePrice]     = useState(0)
  const [sending,         setSending]         = useState(false)
  const [step,            setStep]            = useState<Step>('form')
  const [txHash,          setTxHash]          = useState('')

  // Reset token when chain changes
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
    } catch { setGasPrice('--') }
    finally   { setGasLoading(false) }
  }

  async function estimateGas() {
    if (!addr || !isValidAddress(toAddress)) return
    try {
      const provider = getProvider(activeChain)
      const estimate = selectedToken.contract
        ? await provider.estimateGas({
            from: addr, to: selectedToken.contract,
            data: new ethers.Interface(ERC20_ABI).encodeFunctionData('transfer', [
              toAddress, ethers.parseUnits('1', selectedToken.decimals),
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
      1:'ethereum', 137:'matic-network', 42161:'ethereum', 10:'ethereum', 56:'binancecoin'
    }
    try {
      const id  = cgId[activeChain.id] ?? 'ethereum'
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`)
      const d   = await res.json()
      setNativePrice(d[id]?.usd ?? 0)
    } catch {}
  }

  const gasCostETH = gasPrice && gasPrice !== '--'
    ? ((parseFloat(gasPrice) * Number(gasLimit)) / 1e9).toFixed(6) : null
  const gasCostUSD = gasCostETH
    ? (parseFloat(gasCostETH) * nativePrice).toFixed(4) : null

  async function handleSend() {
    setSending(true)
    try {
      const privateKey = await loadPrivateKey()
      if (!privateKey) {
        Alert.alert('Authentication Required', 'Could not load wallet key. Please authenticate and try again.')
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
      setStep('success')
    } catch (e: any) {
      Alert.alert('Transaction Failed', e?.reason ?? e?.shortMessage ?? e?.message ?? 'Unknown error')
    } finally {
      setSending(false)
    }
  }

  // Â”Â€Â”Â€ Success Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€
  if (step === 'success') return (
    <View style={s.c}>
      <View style={s.successWrap}>
        <View style={s.tick}><Text style={{ fontSize:40 }}>âœ“</Text></View>
        <Text style={s.successTitle}>Sent!</Text>
        <Text style={s.successSub}>
          {amount} {selectedToken.symbol} on {activeChain.name}{'\n'}
          to {toAddress.slice(0,8)}â€¦{toAddress.slice(-6)}
        </Text>
        <View style={s.hashBox}>
          <Text style={s.hashLabel}>Transaction Hash</Text>
          <Text style={s.hash} numberOfLines={2} selectable>{txHash}</Text>
        </View>
        <TouchableOpacity style={s.explorerBtn}
          onPress={() => Linking.openURL(getTxUrl(activeChain.id, txHash))}>
          <Text style={[s.explorerBtnT, { color: activeChain.color }]}>
            View on {activeChain.name === 'Ethereum' ? 'Etherscan' : activeChain.name + 'scan'} â†—
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: activeChain.color }]}
          onPress={() => router.replace('/dashboard')}>
          <Text style={s.doneBtnT}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  // Â”Â€Â”Â€ Confirm Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€
  if (step === 'confirm') return (
    <View style={s.c}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => setStep('form')}><Text style={s.backT}>â†</Text></TouchableOpacity>
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
            { l:'Network',     v: activeChain.name },
            { l:'From',        v: addr ? addr.slice(0,8)+'â€¦'+addr.slice(-6) : 'â€”' },
            { l:'To',          v: toAddress.slice(0,8)+'â€¦'+toAddress.slice(-6) },
            { l:'Token',       v: `${selectedToken.name} (${selectedToken.symbol})` },
            { l:'Gas limit',   v: `${gasLimit.toLocaleString()} units` },
            { l:'Gas price',   v: gasPrice ? `${gasPrice} Gwei` : 'â€¦' },
            { l:'Est. fee',    v: gasCostUSD ? `~$${gasCostUSD} (${gasCostETH} ${activeChain.symbol})` : 'â€¦' },
          ].map(row => (
            <View key={row.l} style={s.detailRow}>
              <Text style={s.detailL}>{row.l}</Text>
              <Text style={s.detailV}>{row.v}</Text>
            </View>
          ))}
        </View>
        <View style={s.bioHint}><Text style={s.bioHintT}>ðŸ”  Face ID / fingerprint required to sign.</Text></View>
        <View style={s.warnBox}><Text style={s.warnT}>âš   Transactions are irreversible. Verify the address.</Text></View>
      </ScrollView>
      <View style={s.bot}>
        <TouchableOpacity style={[s.sendBtn, { backgroundColor: activeChain.color }, sending && { opacity:0.7 }]}
          onPress={handleSend} disabled={sending}>
          {sending
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.sendBtnT}>Confirm & Sign â†’</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  )

  // Â”Â€Â”Â€ Form Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€Â”Â€
  return (
    <KeyboardAvoidingView style={s.c} behavior={Platform.OS==='ios'?'padding':undefined}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}><Text style={s.backT}>â†</Text></TouchableOpacity>
        <Text style={s.hdrTitle}>Send Â· {activeChain.name}</Text>
        <View style={{ width:38 }} />
      </View>
      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">

        <Text style={s.label}>Token</Text>
        <TouchableOpacity style={s.tokenBtn} onPress={() => setShowPicker(!showPicker)}>
          <View style={[s.tokenDot, { backgroundColor: selectedToken.color+'20' }]}>
            <Text style={[s.tokenDotT, { color: selectedToken.color }]}>{selectedToken.symbol.slice(0,1)}</Text>
          </View>
          <View style={{ flex:1 }}>
            <Text style={s.tokenSymbol}>{selectedToken.symbol}</Text>
            <Text style={s.tokenName}>{selectedToken.name}</Text>
          </View>
          <Text style={s.chevron}>{showPicker ? 'â–²' : 'â–¼'}</Text>
        </TouchableOpacity>
        {showPicker && (
          <View style={s.picker}>
            {allTokens.map(t => (
              <TouchableOpacity key={t.symbol} style={[s.pickerRow, t.symbol===selectedToken.symbol&&s.pickerRowActive]}
                onPress={() => { setSelectedToken(t); setShowPicker(false) }}>
                <View style={[s.tokenDot, { backgroundColor: t.color+'20' }]}>
                  <Text style={[s.tokenDotT, { color: t.color }]}>{t.symbol.slice(0,1)}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={s.tokenSymbol}>{t.symbol}</Text>
                  <Text style={s.tokenName}>{t.name}</Text>
                </View>
                {t.symbol===selectedToken.symbol && <Text style={{ color: activeChain.color }}>âœ“</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={[s.label, { marginTop:20 }]}>To Address</Text>
        <View style={[s.inputWrap, addrValid&&toAddress.length>0&&s.inputValid, !addrValid&&toAddress.length>10&&s.inputError]}>
          <TextInput style={s.input} value={toAddress} onChangeText={setToAddress}
            placeholder="0x..." placeholderTextColor="#CBD5E1" autoCapitalize="none" autoCorrect={false} />
          {toAddress.length>0 && <Text style={{ fontSize:16, paddingRight:14 }}>{addrValid?'âœ…':'âŒ'}</Text>}
        </View>
        {!addrValid && toAddress.length>10 && <Text style={s.fieldError}>Invalid address</Text>}

        <Text style={[s.label, { marginTop:20 }]}>Amount</Text>
        <View style={[s.inputWrap, amtValid&&s.inputValid]}>
          <TextInput style={[s.input, { flex:1 }]} value={amount} onChangeText={setAmount}
            placeholder="0.00" placeholderTextColor="#CBD5E1" keyboardType="decimal-pad" />
          <Text style={s.unitTag}>{selectedToken.symbol}</Text>
        </View>

        <View style={s.gasCard}>
          <View style={{ flex:1 }}>
            <Text style={s.gasTitle}>â›½ Estimated Gas Fee</Text>
            {gasLoading
              ? <ActivityIndicator size="small" color={activeChain.color} style={{ alignSelf:'flex-start', marginTop:4 }} />
              : <Text style={s.gasVal}>{gasCostETH||'â€”'} {activeChain.symbol}{gasCostUSD ? `  (~$${gasCostUSD})` : ''}</Text>
            }
          </View>
          <TouchableOpacity onPress={() => { fetchGas(); estimateGas() }}>
            <Text style={[s.refreshT, { color: activeChain.color }]}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height:120 }} />
      </ScrollView>
      <View style={s.bot}>
        <TouchableOpacity
          style={[s.sendBtn, { backgroundColor: activeChain.color }, !canProceed && s.sendBtnDisabled]}
          disabled={!canProceed} onPress={() => setStep('confirm')}>
          <Text style={s.sendBtnT}>Review Transaction â†’</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  c:              { flex:1, backgroundColor:'#F8FAFF' },
  hdr:            { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingTop:60, paddingBottom:16 },
  back:           { width:38, height:38, borderRadius:12, backgroundColor:'#fff', borderWidth:1, borderColor:'#E2E8F0', alignItems:'center', justifyContent:'center' },
  backT:          { color:'#6366F1', fontSize:18 },
  hdrTitle:       { color:'#1E1B4B', fontSize:17, fontWeight:'700' },
  scroll:         { flex:1, paddingHorizontal:20 },
  label:          { color:'#64748B', fontSize:13, fontWeight:'600', marginBottom:8, letterSpacing:0.3, textTransform:'uppercase' },
  tokenBtn:       { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:16, borderWidth:1.5, borderColor:'#E2E8F0', padding:14, gap:12, marginBottom:4 },
  tokenDot:       { width:38, height:38, borderRadius:19, alignItems:'center', justifyContent:'center' },
  tokenDotT:      { fontSize:16, fontWeight:'700' },
  tokenSymbol:    { color:'#1E1B4B', fontSize:15, fontWeight:'600' },
  tokenName:      { color:'#94A3B8', fontSize:12 },
  chevron:        { color:'#94A3B8', fontSize:12 },
  picker:         { backgroundColor:'#fff', borderRadius:16, borderWidth:1, borderColor:'#E2E8F0', overflow:'hidden', marginBottom:8 },
  pickerRow:      { flexDirection:'row', alignItems:'center', padding:14, gap:12, borderBottomWidth:1, borderBottomColor:'#F8FAFF' },
  pickerRowActive:{ backgroundColor:'#EEF2FF' },
  inputWrap:      { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:14, borderWidth:1.5, borderColor:'#E2E8F0', paddingLeft:16 },
  inputValid:     { borderColor:'#6366F1' },
  inputError:     { borderColor:'#EF4444' },
  input:          { color:'#1E1B4B', fontSize:16, paddingVertical:15 },
  unitTag:        { color:'#94A3B8', fontSize:14, fontWeight:'600', paddingRight:16 },
  fieldError:     { color:'#EF4444', fontSize:12, marginTop:4, marginLeft:4 },
  gasCard:        { flexDirection:'row', alignItems:'center', backgroundColor:'#F8FAFF', borderRadius:14, borderWidth:1, borderColor:'#E2E8F0', padding:14, marginTop:20 },
  gasTitle:       { color:'#64748B', fontSize:13, fontWeight:'600', marginBottom:4 },
  gasVal:         { color:'#1E1B4B', fontSize:13, fontWeight:'500' },
  refreshT:       { fontSize:12, fontWeight:'600' },
  confirmCard:    { borderRadius:20, padding:28, alignItems:'center', margin:16 },
  confirmLabel:   { color:'rgba(255,255,255,0.7)', fontSize:14, marginBottom:8 },
  confirmAmt:     { color:'#fff', fontSize:38, fontWeight:'700' },
  detailCard:     { backgroundColor:'#fff', borderRadius:16, borderWidth:1, borderColor:'#E2E8F0', marginHorizontal:16, overflow:'hidden' },
  detailRow:      { flexDirection:'row', justifyContent:'space-between', paddingVertical:13, paddingHorizontal:16, borderBottomWidth:1, borderBottomColor:'#F8FAFF' },
  detailL:        { color:'#64748B', fontSize:14 },
  detailV:        { color:'#1E1B4B', fontSize:14, fontWeight:'500', flex:1, textAlign:'right' },
  bioHint:        { marginHorizontal:16, marginTop:14, backgroundColor:'#EEF2FF', borderRadius:12, padding:12 },
  bioHintT:       { color:'#4338CA', fontSize:13 },
  warnBox:        { backgroundColor:'#FFFBEB', borderRadius:14, borderWidth:1, borderColor:'#FDE68A', padding:14, margin:16 },
  warnT:          { color:'#92400E', fontSize:13, lineHeight:20 },
  bot:            { padding:20, paddingBottom:40, backgroundColor:'#fff', borderTopWidth:1, borderTopColor:'#F1F5F9' },
  sendBtn:        { paddingVertical:18, borderRadius:16, alignItems:'center', shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:12, elevation:6 },
  sendBtnT:       { color:'#fff', fontSize:16, fontWeight:'600' },
  sendBtnDisabled:{ opacity:0.4 },
  successWrap:    { flex:1, alignItems:'center', justifyContent:'center', padding:32 },
  tick:           { width:80, height:80, borderRadius:40, backgroundColor:'#D1FAE5', alignItems:'center', justifyContent:'center', marginBottom:20 },
  successTitle:   { color:'#1E1B4B', fontSize:32, fontWeight:'700', marginBottom:8 },
  successSub:     { color:'#64748B', fontSize:15, textAlign:'center', marginBottom:28, lineHeight:24 },
  hashBox:        { backgroundColor:'#F8FAFF', borderRadius:14, borderWidth:1, borderColor:'#E2E8F0', padding:14, width:'100%', marginBottom:14 },
  hashLabel:      { color:'#94A3B8', fontSize:11, marginBottom:6 },
  hash:           { color:'#1E1B4B', fontSize:11, fontFamily: Platform.OS==='ios'?'Courier':'monospace', lineHeight:18 },
  explorerBtn:    { paddingVertical:10, marginBottom:14 },
  explorerBtnT:   { fontSize:14, fontWeight:'600' },
  doneBtn:        { paddingVertical:16, paddingHorizontal:48, borderRadius:16 },
  doneBtnT:       { color:'#fff', fontSize:16, fontWeight:'600' },
})



