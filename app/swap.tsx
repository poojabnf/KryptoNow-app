import { useState, useEffect, useRef, useCallback } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Modal, Animated,
  FlatList, Platform, Linking,
} from 'react-native'
import { router } from 'expo-router'
import { ethers } from 'ethers'
import { useWalletStore } from '../store/walletStore'
import { loadPrivateKey } from '../store/keyStore'
import { getTxUrl , getProvider } from '../utils/chains'
import {
  OneInchToken, QuoteResult, TOP_TOKENS,
  getQuote, getSwapData, getAllowance, getApproveData,
  isNativeToken, toWei, ONEINCH_API_KEY,
} from '../utils/oneInch'

// â”€â”€â”€ Token picker modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TokenPicker({
  visible, chainId, onSelect, onClose, exclude,
}: {
  visible: boolean; chainId: number
  onSelect: (t: OneInchToken) => void; onClose: () => void; exclude?: string
}) {
  const slide     = useRef(new Animated.Value(600)).current
  const [search,  setSearch]  = useState('')
  const tokens    = (TOP_TOKENS[chainId] ?? TOP_TOKENS[1]).filter(t =>
    t.address.toLowerCase() !== exclude?.toLowerCase()
  )
  const filtered  = search.trim()
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
    if (!visible) setSearch('')
  }, [visible])

  const TOKEN_COLORS: Record<string, string> = {
    ETH:'#6366F1', BNB:'#F0B90B', POL:'#8247E5',
    USDC:'#2775CA', USDT:'#26A17B', DAI:'#F5AC37',
    WBTC:'#F7931A', UNI:'#FF007A', AAVE:'#B6509E', LINK:'#375BD2',
  }

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={pk.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[pk.sheet, { transform: [{ translateY: slide }] }]}>
        <View style={pk.handle} />
        <Text style={pk.title}>Select Token</Text>
        <View style={pk.searchWrap}>
          <Text style={pk.searchIcon}>ðŸ”</Text>
          <TextInput
            style={pk.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search symbol or nameâ€¦"
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
            const color = TOKEN_COLORS[t.symbol] ?? '#64748B'
            return (
              <TouchableOpacity
                style={pk.row}
                onPress={() => { onSelect(t); onClose() }}
                activeOpacity={0.7}
              >
                <View style={[pk.dot, { backgroundColor: color + '20' }]}>
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

// â”€â”€â”€ Slippage picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SLIPPAGE_PRESETS = [0.1, 0.5, 1, 2, 3]

function SlippageModal({
  visible, current, onSave, onClose,
}: {
  visible: boolean; current: number
  onSave: (s: number) => void; onClose: () => void
}) {
  const [custom, setCustom] = useState('')
  const [sel,    setSel]    = useState(current)

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={pk.overlay} activeOpacity={1} onPress={onClose} />
      <View style={sl.box}>
        <Text style={sl.title}>Slippage Tolerance</Text>
        <Text style={sl.sub}>Maximum price movement you'll accept for this swap.</Text>
        <View style={sl.presets}>
          {SLIPPAGE_PRESETS.map(p => (
            <TouchableOpacity
              key={p}
              style={[sl.preset, sel === p && sl.presetActive]}
              onPress={() => { setSel(p); setCustom('') }}
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
            <Text style={sl.warnT}>âš  High slippage — you may receive much less than expected.</Text>
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

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type SwapStep = 'form' | 'confirm' | 'approving' | 'swapping' | 'success'

const TOKEN_COLORS: Record<string, string> = {
  ETH:'#6366F1', BNB:'#F0B90B', POL:'#8247E5',
  USDC:'#2775CA', USDT:'#26A17B', DAI:'#F5AC37',
  WBTC:'#F7931A', UNI:'#FF007A', AAVE:'#B6509E', LINK:'#375BD2',
}
function tokenColor(symbol: string) { return TOKEN_COLORS[symbol] ?? '#64748B' }

// â”€â”€â”€ Main Swap Screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Swap() {
  const addr        = useWalletStore(s => s.address)
  const activeChain = useWalletStore(s => s.activeChain)

  const defaults = TOP_TOKENS[activeChain.id] ?? TOP_TOKENS[1]

  const [fromToken,     setFromToken]     = useState<OneInchToken>(defaults[0])
  const [toToken,       setToToken]       = useState<OneInchToken>(defaults[1])
  const [fromAmount,    setFromAmount]    = useState('')
  const [quote,         setQuote]         = useState<QuoteResult | null>(null)
  const [quoting,       setQuoting]       = useState(false)
  const [quoteError,    setQuoteError]    = useState('')
  const [slippage,      setSlippage]      = useState(0.5)
  const [step,          setStep]          = useState<SwapStep>('form')
  const [txHash,        setTxHash]        = useState('')
  const [needsApproval, setNeedsApproval] = useState(false)
  const [checkingAllowance, setCheckingAllowance] = useState(false)

  const [pickerFor,     setPickerFor]     = useState<'from' | 'to' | null>(null)
  const [slippageModal, setSlippageModal] = useState(false)

  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // â”€â”€â”€ Live quote with 600ms debounce â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const fetchQuote = useCallback(async () => {
    const amt = parseFloat(fromAmount)
    if (!fromAmount || isNaN(amt) || amt <= 0) {
      setQuote(null); setQuoteError(''); return
    }
    if (fromToken.address === toToken.address) {
      setQuoteError('Cannot swap a token for itself'); return
    }
    if (!ONEINCH_API_KEY || ONEINCH_API_KEY === 'YourOneInchApiKey') {
      // Demo mode: show a fake quote so UI is testable without an API key
      setQuote({
        fromToken, toToken,
        fromAmount: toWei(fromAmount, fromToken.decimals),
        toAmount:   toWei((amt * 0.998 * (toToken.symbol === 'USDC' || toToken.symbol === 'USDT' ? 2398 : 0.000416)).toFixed(6), toToken.decimals),
        toAmountHuman: (amt * 0.998 * (toToken.symbol === 'USDC' || toToken.symbol === 'USDT' ? 2398 : 0.000416)).toFixed(4),
        priceImpact: 0.08, gas: 150000,
      })
      return
    }

    setQuoting(true); setQuoteError('')
    try {
      const amtWei = toWei(fromAmount, fromToken.decimals)
      const q      = await getQuote(activeChain.id, fromToken, toToken, amtWei)
      setQuote(q)
    } catch (e: any) {
      setQuote(null)
      setQuoteError(e.message ?? 'Could not fetch quote')
    } finally {
      setQuoting(false)
    }
  }, [fromAmount, fromToken, toToken, activeChain.id])

  useEffect(() => {
    if (quoteTimer.current) clearTimeout(quoteTimer.current)
    quoteTimer.current = setTimeout(fetchQuote, 600)
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current) }
  }, [fetchQuote])

  // â”€â”€â”€ Check allowance when quote is ready â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    setFromAmount(quote?.toAmountHuman ?? '')
    setQuote(null)
  }

  // â”€â”€â”€ Approve ERC-20 spending â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleApprove(): Promise<boolean> {
    setStep('approving')
    try {
      const privateKey = await loadPrivateKey()
      if (!privateKey) throw new Error('Authentication failed')

      const approveData = await getApproveData(activeChain.id, fromToken.address)
      const provider    = getProvider(activeChain)
      const wallet      = new ethers.Wallet(privateKey, provider)

      const tx      = await wallet.sendTransaction({
        to:    approveData.to,
        data:  approveData.data,
        value: BigInt(approveData.value ?? '0'),
      })
      await tx.wait(1)
      setNeedsApproval(false)
      return true
    } catch (e: any) {
      Alert.alert('Approval Failed', e.message ?? 'Could not approve token')
      setStep('confirm')
      return false
    }
  }

  // â”€â”€â”€ Execute swap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async function handleSwap() {
    if (!quote || !addr) return

    // Approve first if needed
    if (needsApproval) {
      const approved = await handleApprove()
      if (!approved) return
    }

    setStep('swapping')
    try {
      const privateKey = await loadPrivateKey()
      if (!privateKey) throw new Error('Authentication failed')

      let txData: { to: string; data: string; value: string; gas: number; gasPrice: string } | null = null

      if (ONEINCH_API_KEY && ONEINCH_API_KEY !== 'YourOneInchApiKey') {
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
          value:    BigInt(txData.value ?? '0'),
          gasLimit: BigInt(txData.gas),
          gasPrice: BigInt(txData.gasPrice),
        })
      } else {
        // Demo mode — simulate success
        await new Promise(r => setTimeout(r, 2000))
        setTxHash('0x' + Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join(''))
        setStep('success')
        return
      }

      const receipt = await tx.wait(1)
      setTxHash(receipt?.hash ?? tx.hash)
      setStep('success')
    } catch (e: any) {
      Alert.alert('Swap Failed', e?.reason ?? e?.shortMessage ?? e?.message ?? 'Unknown error')
      setStep('confirm')
    }
  }

  const priceImpactColor = !quote ? '#94A3B8'
    : quote.priceImpact < 1   ? '#10B981'
    : quote.priceImpact < 3   ? '#F59E0B'
    : '#EF4444'

  const fromColor = tokenColor(fromToken.symbol)
  const toColor   = tokenColor(toToken.symbol)

  // â”€â”€â”€ Success â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (step === 'success') return (
    <View style={s.c}>
      <View style={s.successWrap}>
        <View style={s.successGlow} />
        <View style={s.tick}><Text style={{ fontSize: 44 }}>✓</Text></View>
        <Text style={s.successTitle}>Swap Complete!</Text>
        <View style={s.swapSummary}>
          <View style={[s.summaryToken, { backgroundColor: fromColor + '15' }]}>
            <Text style={[s.summaryAmt, { color: fromColor }]}>âˆ’{fromAmount}</Text>
            <Text style={[s.summarySym, { color: fromColor }]}>{fromToken.symbol}</Text>
          </View>
          <Text style={s.arrow}>→</Text>
          <View style={[s.summaryToken, { backgroundColor: toColor + '15' }]}>
            <Text style={[s.summaryAmt, { color: toColor }]}>+{quote?.toAmountHuman ?? '?'}</Text>
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
              <Text style={[s.explorerBtnT, { color: activeChain.color }]}>
                View on Explorer ↗
              </Text>
            </TouchableOpacity>
          </>
        ) : null}
        <TouchableOpacity style={[s.doneBtn, { backgroundColor: activeChain.color }]}
          onPress={() => router.replace('/dashboard')}>
          <Text style={s.doneBtnT}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  // â”€â”€â”€ Confirm / Approving / Swapping â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (step === 'confirm' || step === 'approving' || step === 'swapping') {
    const busy = step === 'approving' || step === 'swapping'
    return (
      <View style={s.c}>
        <View style={s.hdr}>
          <TouchableOpacity style={s.back} onPress={() => setStep('form')} disabled={busy}>
            <Text style={s.backT}>←</Text>
          </TouchableOpacity>
          <Text style={s.hdrTitle}>Confirm Swap</Text>
          <View style={{ width: 38 }} />
        </View>
        <ScrollView style={s.scroll}>
          {/* Visual swap card */}
          <View style={s.swapCard}>
            <View style={s.swapCardRow}>
              <View style={[s.swapCardToken, { backgroundColor: fromColor + '15' }]}>
                <View style={[s.swapDot, { backgroundColor: fromColor + '30' }]}>
                  <Text style={[s.swapDotT, { color: fromColor }]}>{fromToken.symbol.slice(0,2)}</Text>
                </View>
                <View>
                  <Text style={s.swapCardAmt}>âˆ’{fromAmount}</Text>
                  <Text style={s.swapCardSym}>{fromToken.symbol}</Text>
                </View>
              </View>
              <View style={s.swapArrowCircle}>
                <Text style={s.swapArrowT}>⇄</Text>
              </View>
              <View style={[s.swapCardToken, { backgroundColor: toColor + '15' }]}>
                <View style={[s.swapDot, { backgroundColor: toColor + '30' }]}>
                  <Text style={[s.swapDotT, { color: toColor }]}>{toToken.symbol.slice(0,2)}</Text>
                </View>
                <View>
                  <Text style={s.swapCardAmt}>+{quote?.toAmountHuman}</Text>
                  <Text style={s.swapCardSym}>{toToken.symbol}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Detail rows */}
          <View style={s.detailCard}>
            {[
              { l: 'Network',       v: activeChain.name },
              { l: 'Rate',          v: quote ? `1 ${fromToken.symbol} â‰ˆ ${(parseFloat(quote.toAmountHuman) / parseFloat(fromAmount)).toFixed(4)} ${toToken.symbol}` : '—' },
              { l: 'Price impact',  v: quote ? `${quote.priceImpact.toFixed(2)}%` : '—', color: priceImpactColor },
              { l: 'Slippage',      v: `${slippage}%` },
              { l: 'Min received',  v: quote ? `${(parseFloat(quote.toAmountHuman) * (1 - slippage / 100)).toFixed(4)} ${toToken.symbol}` : '—' },
              { l: 'Est. gas',      v: quote ? `~${quote.gas.toLocaleString()} units` : '—' },
              { l: 'Router',        v: '1inch v6' },
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
                Before swapping {fromToken.symbol}, you need to approve the 1inch router to spend your tokens.
                This is a one-time transaction per token.
              </Text>
            </View>
          )}

          <View style={s.bioHint}>
            <Text style={s.bioHintT}>ðŸ”  Face ID / fingerprint required to sign{needsApproval ? ' (twice — approval + swap)' : ''}.</Text>
          </View>
        </ScrollView>
        <View style={s.bot}>
          {busy ? (
            <View style={[s.swapBtn, s.swapBtnBusy]}>
              <ActivityIndicator color="#fff" />
              <Text style={s.swapBtnT}>
                {step === 'approving' ? 'Approving tokenâ€¦' : 'Executing swapâ€¦'}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[s.swapBtn, { backgroundColor: activeChain.color }]}
              onPress={handleSwap}
            >
              <Text style={s.swapBtnT}>
                {needsApproval ? `Approve & Swap ${fromToken.symbol}` : `Swap ${fromToken.symbol} → ${toToken.symbol}`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    )
  }

  // â”€â”€â”€ Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <View style={s.c}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Text style={s.backT}>←</Text>
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Swap</Text>
        <TouchableOpacity style={s.settingsBtn} onPress={() => setSlippageModal(true)}>
          <Text style={s.settingsBtnT}>⚙ {slippage}%</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} keyboardShouldPersistTaps="handled">

        {/* From token */}
        <View style={s.tokenCard}>
          <View style={s.tokenCardTop}>
            <Text style={s.cardLabel}>You pay</Text>
            <Text style={s.balanceHint}>Balance: —</Text>
          </View>
          <View style={s.tokenCardRow}>
            <TouchableOpacity
              style={[s.tokenSelector, { borderColor: fromColor + '40' }]}
              onPress={() => setPickerFor('from')}
            >
              <View style={[s.tokenDot, { backgroundColor: fromColor + '20' }]}>
                <Text style={[s.tokenDotT, { color: fromColor }]}>{fromToken.symbol.slice(0,2)}</Text>
              </View>
              <Text style={s.tokenSelectorSym}>{fromToken.symbol}</Text>
              <Text style={s.tokenSelectorArrow}>â–¾</Text>
            </TouchableOpacity>
            <TextInput
              style={s.amtInput}
              value={fromAmount}
              onChangeText={v => { setFromAmount(v); setQuote(null) }}
              placeholder="0.00"
              placeholderTextColor="#CBD5E1"
              keyboardType="decimal-pad"
              textAlign="right"
            />
          </View>
          <Text style={s.tokenName}>{fromToken.name}</Text>
        </View>

        {/* Flip button */}
        <View style={s.flipWrap}>
          <View style={s.flipLine} />
          <TouchableOpacity style={s.flipBtn} onPress={flipTokens} activeOpacity={0.7}>
            <Text style={s.flipBtnT}>â‡…</Text>
          </TouchableOpacity>
          <View style={s.flipLine} />
        </View>

        {/* To token */}
        <View style={[s.tokenCard, s.tokenCardTo]}>
          <View style={s.tokenCardTop}>
            <Text style={s.cardLabel}>You receive</Text>
            {quoting && <ActivityIndicator size="small" color={activeChain.color} />}
          </View>
          <View style={s.tokenCardRow}>
            <TouchableOpacity
              style={[s.tokenSelector, { borderColor: toColor + '40' }]}
              onPress={() => setPickerFor('to')}
            >
              <View style={[s.tokenDot, { backgroundColor: toColor + '20' }]}>
                <Text style={[s.tokenDotT, { color: toColor }]}>{toToken.symbol.slice(0,2)}</Text>
              </View>
              <Text style={s.tokenSelectorSym}>{toToken.symbol}</Text>
              <Text style={s.tokenSelectorArrow}>â–¾</Text>
            </TouchableOpacity>
            <Text style={[s.receiveAmt, { color: quote ? '#1E1B4B' : '#CBD5E1' }]}>
              {quote ? quote.toAmountHuman : quoting ? 'â€¦' : '0.00'}
            </Text>
          </View>
          <Text style={s.tokenName}>{toToken.name}</Text>
        </View>

        {/* Quote details */}
        {quote && !quoting && (
          <View style={s.quoteCard}>
            <View style={s.quoteRow}>
              <Text style={s.quoteL}>Rate</Text>
              <Text style={s.quoteV}>
                1 {fromToken.symbol} â‰ˆ {(parseFloat(quote.toAmountHuman) / parseFloat(fromAmount)).toFixed(4)} {toToken.symbol}
              </Text>
            </View>
            <View style={s.quoteRow}>
              <Text style={s.quoteL}>Price impact</Text>
              <Text style={[s.quoteV, { color: priceImpactColor }]}>
                {quote.priceImpact < 0.01 ? '< 0.01%' : `${quote.priceImpact.toFixed(2)}%`}
              </Text>
            </View>
            <View style={s.quoteRow}>
              <Text style={s.quoteL}>Min received</Text>
              <Text style={s.quoteV}>
                {(parseFloat(quote.toAmountHuman) * (1 - slippage / 100)).toFixed(4)} {toToken.symbol}
              </Text>
            </View>
            <View style={[s.quoteRow, { borderBottomWidth: 0 }]}>
              <Text style={s.quoteL}>Route</Text>
              <Text style={s.quoteV}>1inch v6 · {activeChain.name}</Text>
            </View>
          </View>
        )}

        {/* Quote error */}
        {quoteError ? (
          <View style={s.errCard}>
            <Text style={s.errCardT}>âš  {quoteError}</Text>
          </View>
        ) : null}

        {/* High price impact warning */}
        {quote && quote.priceImpact >= 3 && (
          <View style={s.impactWarn}>
            <Text style={s.impactWarnT}>
              ðŸš¨ High price impact ({quote.priceImpact.toFixed(1)}%). You may receive significantly less than expected. Consider a smaller trade.
            </Text>
          </View>
        )}

        {/* Allowance status */}
        {checkingAllowance && (
          <View style={s.allowanceRow}>
            <ActivityIndicator size="small" color="#6366F1" />
            <Text style={s.allowanceT}>Checking token approvalâ€¦</Text>
          </View>
        )}
        {!checkingAllowance && needsApproval && quote && (
          <View style={s.approvalNote}>
            <Text style={s.approvalNoteT}>
              â“˜  {fromToken.symbol} requires a one-time approval before swapping.
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={s.bot}>
        <TouchableOpacity
          style={[
            s.swapBtn,
            { backgroundColor: activeChain.color },
            (!quote || quoting || !fromAmount) && s.swapBtnDisabled,
          ]}
          disabled={!quote || quoting || !fromAmount}
          onPress={() => setStep('confirm')}
        >
          {quoting
            ? <><ActivityIndicator color="#fff" /><Text style={[s.swapBtnT, { marginLeft: 10 }]}>Getting quoteâ€¦</Text></>
            : <Text style={s.swapBtnT}>
                {!fromAmount ? 'Enter an amount' : !quote ? 'No route found' : `Swap ${fromToken.symbol} → ${toToken.symbol}`}
              </Text>
          }
        </TouchableOpacity>
      </View>

      {/* Modals */}
      <TokenPicker
        visible={pickerFor !== null}
        chainId={activeChain.id}
        exclude={pickerFor === 'from' ? toToken.address : fromToken.address}
        onSelect={t => {
          if (pickerFor === 'from') setFromToken(t)
          else setToToken(t)
          setQuote(null)
        }}
        onClose={() => setPickerFor(null)}
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

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const s = StyleSheet.create({
  c:               { flex:1, backgroundColor:'#F8FAFF' },
  hdr:             { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingTop:60, paddingBottom:16 },
  back:            { width:38, height:38, borderRadius:12, backgroundColor:'#fff', borderWidth:1, borderColor:'#E2E8F0', alignItems:'center', justifyContent:'center' },
  backT:           { color:'#6366F1', fontSize:18 },
  hdrTitle:        { color:'#1E1B4B', fontSize:17, fontWeight:'700' },
  settingsBtn:     { backgroundColor:'#EEF2FF', paddingHorizontal:12, paddingVertical:7, borderRadius:12 },
  settingsBtnT:    { color:'#6366F1', fontSize:13, fontWeight:'600' },
  scroll:          { flex:1, paddingHorizontal:16 },

  tokenCard:       { backgroundColor:'#fff', borderRadius:20, borderWidth:1.5, borderColor:'#E2E8F0', padding:16, marginBottom:0 },
  tokenCardTo:     { borderColor:'#E2E8F0', backgroundColor:'#F8FAFF' },
  tokenCardTop:    { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  cardLabel:       { color:'#94A3B8', fontSize:13, fontWeight:'600', textTransform:'uppercase', letterSpacing:0.3 },
  balanceHint:     { color:'#CBD5E1', fontSize:12 },
  tokenCardRow:    { flexDirection:'row', alignItems:'center', gap:12 },
  tokenSelector:   { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#F8FAFF', borderRadius:16, borderWidth:1.5, paddingVertical:8, paddingHorizontal:12 },
  tokenDot:        { width:32, height:32, borderRadius:16, alignItems:'center', justifyContent:'center' },
  tokenDotT:       { fontSize:12, fontWeight:'800' },
  tokenSelectorSym:{ color:'#1E1B4B', fontSize:16, fontWeight:'700' },
  tokenSelectorArrow:{ color:'#94A3B8', fontSize:11 },
  amtInput:        { flex:1, color:'#1E1B4B', fontSize:28, fontWeight:'700', letterSpacing:-0.5 },
  receiveAmt:      { flex:1, fontSize:28, fontWeight:'700', letterSpacing:-0.5, textAlign:'right' },
  tokenName:       { color:'#CBD5E1', fontSize:12, marginTop:8 },

  flipWrap:        { flexDirection:'row', alignItems:'center', marginVertical:6, paddingHorizontal:4 },
  flipLine:        { flex:1, height:1, backgroundColor:'#E2E8F0' },
  flipBtn:         { width:40, height:40, borderRadius:20, backgroundColor:'#fff', borderWidth:1.5, borderColor:'#E2E8F0', alignItems:'center', justifyContent:'center', marginHorizontal:12, shadowColor:'#64748B', shadowOffset:{width:0,height:2}, shadowOpacity:0.08, shadowRadius:8, elevation:2 },
  flipBtnT:        { fontSize:20, color:'#6366F1' },

  quoteCard:       { backgroundColor:'#fff', borderRadius:16, borderWidth:1, borderColor:'#E2E8F0', marginTop:12, overflow:'hidden' },
  quoteRow:        { flexDirection:'row', justifyContent:'space-between', paddingVertical:10, paddingHorizontal:16, borderBottomWidth:1, borderBottomColor:'#F8FAFF' },
  quoteL:          { color:'#94A3B8', fontSize:13 },
  quoteV:          { color:'#1E1B4B', fontSize:13, fontWeight:'500' },
  errCard:         { backgroundColor:'#FEF2F2', borderRadius:14, borderWidth:1, borderColor:'#FECACA', padding:13, marginTop:12 },
  errCardT:        { color:'#DC2626', fontSize:13 },
  impactWarn:      { backgroundColor:'#FEF2F2', borderRadius:14, borderWidth:1, borderColor:'#FECACA', padding:14, marginTop:10 },
  impactWarnT:     { color:'#DC2626', fontSize:13, lineHeight:20 },
  allowanceRow:    { flexDirection:'row', alignItems:'center', gap:8, padding:12, marginTop:8 },
  allowanceT:      { color:'#94A3B8', fontSize:13 },
  approvalNote:    { backgroundColor:'#EEF2FF', borderRadius:12, padding:12, marginTop:8 },
  approvalNoteT:   { color:'#4338CA', fontSize:13, lineHeight:18 },

  swapCard:        { backgroundColor:'#fff', borderRadius:20, borderWidth:1, borderColor:'#E2E8F0', padding:20, margin:16 },
  swapCardRow:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  swapCardToken:   { flex:1, borderRadius:16, padding:14, alignItems:'center', gap:8 },
  swapDot:         { width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center' },
  swapDotT:        { fontSize:14, fontWeight:'800' },
  swapCardAmt:     { color:'#1E1B4B', fontSize:16, fontWeight:'700', marginTop:4 },
  swapCardSym:     { color:'#94A3B8', fontSize:12 },
  swapArrowCircle: { width:36, height:36, borderRadius:18, backgroundColor:'#F1F5F9', alignItems:'center', justifyContent:'center' },
  swapArrowT:      { fontSize:18, color:'#64748B' },
  detailCard:      { backgroundColor:'#fff', borderRadius:16, borderWidth:1, borderColor:'#E2E8F0', marginHorizontal:16, overflow:'hidden' },
  detailRow:       { flexDirection:'row', justifyContent:'space-between', paddingVertical:12, paddingHorizontal:16, borderBottomWidth:1, borderBottomColor:'#F8FAFF' },
  detailL:         { color:'#64748B', fontSize:14 },
  detailV:         { color:'#1E1B4B', fontSize:14, fontWeight:'500', flex:1, textAlign:'right' },
  approvalBanner:  { margin:16, backgroundColor:'#FFF7ED', borderRadius:14, borderWidth:1, borderColor:'#FED7AA', padding:14 },
  approvalTitle:   { color:'#C2410C', fontSize:14, fontWeight:'700', marginBottom:6 },
  approvalSub:     { color:'#9A3412', fontSize:13, lineHeight:19 },
  bioHint:         { marginHorizontal:16, marginTop:12, backgroundColor:'#EEF2FF', borderRadius:12, padding:12 },
  bioHintT:        { color:'#4338CA', fontSize:13 },

  bot:             { padding:20, paddingBottom:40, backgroundColor:'#fff', borderTopWidth:1, borderTopColor:'#F1F5F9' },
  swapBtn:         { flexDirection:'row', justifyContent:'center', alignItems:'center', paddingVertical:18, borderRadius:16, shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:12, elevation:6, gap:10 },
  swapBtnT:        { color:'#fff', fontSize:16, fontWeight:'600' },
  swapBtnDisabled: { opacity:0.4 },
  swapBtnBusy:     { backgroundColor:'#6366F1', opacity:0.8 },

  successWrap:     { flex:1, alignItems:'center', justifyContent:'center', padding:32 },
  successGlow:     { position:'absolute', width:200, height:200, borderRadius:100, backgroundColor:'#6366F1', opacity:0.06, top:'25%' },
  tick:            { width:88, height:88, borderRadius:44, backgroundColor:'#D1FAE5', alignItems:'center', justifyContent:'center', marginBottom:20 },
  successTitle:    { color:'#1E1B4B', fontSize:28, fontWeight:'700', marginBottom:20 },
  swapSummary:     { flexDirection:'row', alignItems:'center', gap:16, marginBottom:28 },
  summaryToken:    { borderRadius:16, padding:14, alignItems:'center', minWidth:110 },
  summaryAmt:      { fontSize:20, fontWeight:'700' },
  summarySym:      { fontSize:13, fontWeight:'600', marginTop:2 },
  arrow:           { color:'#94A3B8', fontSize:24 },
  hashBox:         { backgroundColor:'#F8FAFF', borderRadius:14, borderWidth:1, borderColor:'#E2E8F0', padding:14, width:'100%', marginBottom:14 },
  hashLabel:       { color:'#94A3B8', fontSize:11, marginBottom:6 },
  hash:            { color:'#1E1B4B', fontSize:11, fontFamily: Platform.OS==='ios'?'Courier':'monospace', lineHeight:18 },
  explorerBtn:     { paddingVertical:10, marginBottom:14 },
  explorerBtnT:    { fontSize:14, fontWeight:'600' },
  doneBtn:         { paddingVertical:16, paddingHorizontal:48, borderRadius:16 },
  doneBtnT:        { color:'#fff', fontSize:16, fontWeight:'600' },
})

const pk = StyleSheet.create({
  overlay:    { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(15,23,42,0.5)' },
  sheet:      { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#fff', borderTopLeftRadius:28, borderTopRightRadius:28, paddingTop:12, paddingHorizontal:16, maxHeight:'80%' },
  handle:     { width:36, height:4, borderRadius:2, backgroundColor:'#E2E8F0', alignSelf:'center', marginBottom:16 },
  title:      { color:'#1E1B4B', fontSize:17, fontWeight:'700', marginBottom:12 },
  searchWrap: { flexDirection:'row', alignItems:'center', backgroundColor:'#F8FAFF', borderRadius:14, borderWidth:1, borderColor:'#E2E8F0', paddingHorizontal:14, marginBottom:12, gap:8 },
  searchIcon: { fontSize:14 },
  searchInput:{ flex:1, color:'#1E1B4B', fontSize:15, paddingVertical:12 },
  row:        { flexDirection:'row', alignItems:'center', paddingVertical:12, paddingHorizontal:4, borderBottomWidth:1, borderBottomColor:'#F8FAFF', gap:12 },
  dot:        { width:42, height:42, borderRadius:21, alignItems:'center', justifyContent:'center' },
  dotT:       { fontSize:13, fontWeight:'800' },
  mid:        { flex:1 },
  sym:        { color:'#1E1B4B', fontSize:15, fontWeight:'700' },
  name:       { color:'#94A3B8', fontSize:12, marginTop:2 },
  dec:        { color:'#CBD5E1', fontSize:11 },
  empty:      { padding:28, alignItems:'center' },
  emptyT:     { color:'#CBD5E1', fontSize:14 },
})

const sl = StyleSheet.create({
  box:        { position:'absolute', bottom:0, left:16, right:16, backgroundColor:'#fff', borderRadius:24, padding:24, shadowColor:'#000', shadowOffset:{width:0,height:-4}, shadowOpacity:0.15, shadowRadius:20, elevation:20 },
  title:      { color:'#1E1B4B', fontSize:17, fontWeight:'700', marginBottom:6 },
  sub:        { color:'#94A3B8', fontSize:13, marginBottom:20 },
  presets:    { flexDirection:'row', gap:10, marginBottom:14 },
  preset:     { flex:1, paddingVertical:10, borderRadius:12, borderWidth:1.5, borderColor:'#E2E8F0', alignItems:'center', backgroundColor:'#F8FAFF' },
  presetActive:{ backgroundColor:'#6366F1', borderColor:'#6366F1' },
  presetT:    { color:'#64748B', fontSize:14, fontWeight:'600' },
  presetTActive:{ color:'#fff' },
  customWrap: { flexDirection:'row', alignItems:'center', backgroundColor:'#F8FAFF', borderRadius:14, borderWidth:1.5, borderColor:'#E2E8F0', paddingHorizontal:16, marginBottom:14 },
  customInput:{ flex:1, color:'#1E1B4B', fontSize:16, paddingVertical:13 },
  pct:        { color:'#94A3B8', fontSize:16 },
  warn:       { backgroundColor:'#FFFBEB', borderRadius:12, borderWidth:1, borderColor:'#FDE68A', padding:12, marginBottom:14 },
  warnT:      { color:'#92400E', fontSize:13 },
  saveBtn:    { backgroundColor:'#6366F1', paddingVertical:15, borderRadius:14, alignItems:'center' },
  saveBtnT:   { color:'#fff', fontSize:15, fontWeight:'600' },
})


