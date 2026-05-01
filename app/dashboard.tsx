import { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, Modal, Animated,
} from 'react-native'
import { router } from 'expo-router'
import { ethers } from 'ethers'
import { useWalletStore } from '../store/walletStore'
import { useTransactions, Tx, TxType } from '../hooks/useTransactions'
import { CHAINS, Chain, getProvider } from '../utils/chains'
import { fetchChainTokenBalances } from '../utils/tokens'
import { IS_WEB, HEADER_TOP, webContainer, webInner, WEB_MAX_WIDTH } from '../utils/webLayout'

type TokenRow = {
  symbol: string; name: string
  balance: string; price: number; change24h: number; valueUSD: number
  isNative: boolean; icon?: string; color?: string
}

const TX_META: Record<TxType, { icon: string; color: string; bg: string }> = {
  send:          { icon: 'â†‘', color: '#EF4444', bg: '#FEF2F2' },
  receive:       { icon: 'â†“', color: '#10B981', bg: '#D1FAE5' },
  token_send:          { icon: 'â†‘', color: '#F59E0B', bg: '#FEF3C7' },
  token_receive:       { icon: 'â†“', color: '#06B6D4', bg: '#CFFAFE' },
  contract:      { icon: 'âš™', color: '#8B5CF6', bg: '#EDE9FE' },
}

const NATIVE_CG: Record<number, string> = {
  1: 'ethereum', 137: 'matic-network',
  42161: 'ethereum', 10: 'ethereum', 56: 'binancecoin',
}
const NATIVE_BINANCE: Record<number, string> = {
  1: 'ETHUSDT', 137: 'MATICUSDT',
  42161: 'ETHUSDT', 10: 'ETHUSDT', 56: 'BNBUSDT',
}

const NATIVE_CC: Record<number, string> = {
  1:     'ETH',
  137:   'MATIC',
  42161: 'ETH',
  10:    'ETH',
  56:    'BNB',
}

function relTime(ts: number) {
  const d = Math.floor(Date.now() / 1000) - ts
  if (d < 60)    return `${d}s ago`
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

function fmt(n: number) {
  if (n === 0) return '$0.00'
  return n >= 1000
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${n.toFixed(2)}`
}

function ChainModal({ visible, current, onSelect, onClose }: {
  visible: boolean; current: Chain
  onSelect: (c: Chain) => void; onClose: () => void
}) {
  const slide = useRef(new Animated.Value(500)).current
  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 0 : 500,
      useNativeDriver: true, tension: 65, friction: 11,
    }).start()
  }, [visible])
  return (
    <Modal transparent visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[m.sheet, { transform: [{ translateY: slide }] }]}>
        <View style={m.handle} />
        <Text style={m.title}>Switch Network</Text>
        {CHAINS.map(chain => (
          <TouchableOpacity
            key={chain.id}
            style={[m.row, chain.id === current.id && m.rowActive]}
            onPress={() => { onSelect(chain); onClose() }}
            activeOpacity={0.7}
          >
            <View style={[m.iconWrap, { backgroundColor: chain.color + '22' }]}>
              <Text style={m.icon}>{chain.icon}</Text>
            </View>
            <View style={m.mid}>
              <Text style={m.chainName}>{chain.name}</Text>
              <Text style={m.chainSymbol}>Native: {chain.symbol}</Text>
            </View>
            {chain.id === current.id && (
              <View style={[m.activeDot, { backgroundColor: chain.color }]} />
            )}
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Modal>
  )
}

const ACTIONS = [
  { l: 'Send',    i: 'â†‘', c: '#6366F1', route: '/send'    },
  { l: 'Receive', i: 'â†“', c: '#8B5CF6', route: '/receive' },
  { l: 'Swap',    i: 'â‡„', c: '#06B6D4', route: '/swap'    },
  { l: 'Buy',     i: '+', c: '#10B981', route: '/buy'     },
]

export default function Dashboard() {
  const addr         = useWalletStore(s => s.address)
  const activeChain  = useWalletStore(s => s.activeChain)
  const setActiveChain = useWalletStore(s => s.setActiveChain)
  const setChainCache  = useWalletStore(s => s.setChainCache)
  const getChainCache  = useWalletStore(s => s.getChainCache)

  const short = addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : ''

  const [tokens,      setTokens]      = useState<TokenRow[]>([])
  const [totalUSD,    setTotalUSD]    = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [error,       setError]       = useState(false)
  const [errMsg,      setErrMsg]      = useState('')
  const [chainModal,  setChainModal]  = useState(false)
  const [fundSheet,   setFundSheet]   = useState(false)

  const { txns: recentTxns, loading: txLoading, refresh: refreshTxns } = useTransactions(addr)

  const fetchBalances = useCallback(async (force = false) => {
    if (!addr) return

    const cached = getChainCache(activeChain.id)
    if (cached && !force) {
      const nativeRow: TokenRow = {
        symbol: activeChain.symbol, name: activeChain.nativeName,
        balance: cached.nativeBalance,
        price: cached.nativeUSD / (parseFloat(cached.nativeBalance) || 1),
        change24h: 0, valueUSD: cached.nativeUSD, isNative: true,
      }
      setTokens([nativeRow, ...cached.tokens.map(t => ({ ...t, isNative: false }))])
      setTotalUSD(cached.nativeUSD + cached.tokens.reduce((s, t) => s + t.valueUSD, 0))
      setLoading(false)
      return
    }

    setError(false)
    try {
      //  1. Native balance (7s timeout â€” prevents infinite spinner)
      const provider = getProvider(activeChain)
      const weiBalance = await Promise.race([
        provider.getBalance(addr),
        new Promise<never>((_, r) =>
          setTimeout(() => r(new Error('RPC timeout â€” check connection')), 7000)
        ),
      ])
      const nativeBal  = parseFloat(ethers.formatEther(weiBalance))

      //  2. Native price: CoinGecko  Binance fallback 
      let nativePrice  = 0
      let nativeChange = 0
      try {
        const cgKey  = NATIVE_CG[activeChain.id] ?? 'ethereum'
        const cgRes  = await Promise.race([fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${cgKey}&vs_currencies=usd&include_24hr_change=true&x_cg_demo_api_key=`,
          { headers: { Accept: 'application/json' } }), new Promise((_,r)=>setTimeout(()=>r(new Error('timeout')),8000))])
        if (cgRes.ok) {
          const cgData  = await cgRes.json()
          nativePrice   = cgData[cgKey]?.usd ?? 0
          nativeChange  = cgData[cgKey]?.usd_24h_change ?? 0
        }
      } catch {}

      // Binance fallback
      if (nativePrice === 0) {
        try {
          const bSym = NATIVE_BINANCE[activeChain.id] ?? 'ETHUSDT'
          const bRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${bSym}`)
          if (bRes.ok) {
            const bData  = await bRes.json()
            nativePrice  = parseFloat(bData.lastPrice ?? '0')
            nativeChange = parseFloat(bData.priceChangePercent ?? '0')
          }
        } catch {}
      }

      if (nativePrice === 0) {
        try {
          const ccSym = NATIVE_CC[activeChain.id] ?? 'ETH'
          const ccRes = await fetch(
            `https://min-api.cryptocompare.com/data/price?fsym=${ccSym}&tsyms=USD`
          )
          if (ccRes.ok) {
            const ccData = await ccRes.json()
            nativePrice = ccData.USD ?? 0
          }
        } catch {}
      }

      const nativeUSD = nativeBal * nativePrice

      //  3. ERC-20 tokens via direct balanceOf calls 
      let tokenRows: TokenRow[] = []
      try {
        const fetched = await fetchChainTokenBalances(addr, activeChain)
        tokenRows = fetched.map(t => ({ ...t, isNative: false }))
      } catch {}

      //  4. Build final rows 
      const nativeRow: TokenRow = {
        symbol: activeChain.symbol, name: activeChain.nativeName,
        balance: nativeBal.toFixed(6),
        price: nativePrice, change24h: nativeChange,
        valueUSD: nativeUSD, isNative: true,
      }

      const allRows = [nativeRow, ...tokenRows]
      const total   = allRows.reduce((s, t) => s + t.valueUSD, 0)
      setTokens(allRows)
      setTotalUSD(total)

      setChainCache(activeChain.id, {
        nativeBalance: nativeBal.toFixed(6), nativeUSD,
        tokens: tokenRows, lastFetch: Date.now(),
      })
    } catch (e: any) {
      setError(true)
      const em = e?.message ?? e?.code ?? String(e) ?? "unknown"
      setErrMsg(em)
      console.error("[Kryptonow_ERR]", em)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [addr, activeChain])

  useEffect(() => {
    setLoading(true); setTokens([]); setTotalUSD(0)
    fetchBalances(false); refreshTxns()
  }, [activeChain.id])

  const onRefresh = () => { setRefreshing(true); fetchBalances(true); refreshTxns() }

  return (
    <View style={webContainer}>
      <View style={[webInner, { backgroundColor: '#F8FAFF' }]}>
      <View style={s.top}>
        <TouchableOpacity style={s.net} onPress={() => setChainModal(true)} activeOpacity={0.7}>
          <View style={[s.nd, { backgroundColor: activeChain.color }]} />
          <Text style={s.nt}>{activeChain.name}</Text>
          <Text style={s.chevron}></Text>
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={s.cog} onPress={() => setFundSheet(true)}>
            <Text style={{ fontSize: 18 }}>ðŸ‘›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.cog} onPress={() => router.push('/settings' as any)}>
            <Text style={{ fontSize: 18, color: '#64748B' }}>âš™ï¸</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Balance card */}
        <View style={[s.card, { backgroundColor: activeChain.color, shadowColor: activeChain.color }]}>
          <View style={s.av}><Text style={s.avt}>{addr ? addr.slice(2,4).toUpperCase() : 'VT'}</Text></View>
          <Text style={s.addr}>{short}</Text>
          <Text style={s.bl}>Total Balance</Text>
          {loading
            ? <ActivityIndicator color="#fff" size="large" style={{ marginVertical: 8 }} />
            : <Text style={s.bal}>{fmt(totalUSD)}</Text>
          }
          {!loading && tokens[0] && (
            <View style={{ alignItems: 'center', marginTop: 4 }}>
              <Text style={s.nativeSub}>
                {parseFloat(tokens[0].balance).toFixed(4)} {activeChain.symbol}
              </Text>
              <Text style={[s.chg, { color: tokens[0].change24h >= 0 ? '#86EFAC' : '#FCA5A5' }]}>
                {tokens[0].change24h >= 0 ? 'â–²' : 'â–¼'} {Math.abs(tokens[0].change24h).toFixed(2)}%
              </Text>
            </View>
          )}
          <View style={[s.chainBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={s.chainBadgeT}>{activeChain.name}  Â· Encrypted</Text>
          </View>
        </View>

        {/* Error banner */}
        {error && (
          <TouchableOpacity style={s.err} onPress={() => fetchBalances(true)} activeOpacity={0.7}>
            <Text style={s.errT}> Unable to fetch live data. Tap to retry.</Text>
          </TouchableOpacity>
        )}

        {/* Actions */}
        <View style={s.acts}>
          {ACTIONS.map(a => (
            <TouchableOpacity key={a.l} style={s.act} onPress={() => router.push(a.route as any)} activeOpacity={0.7}>
              <View style={[s.ai, { borderColor: activeChain.color + '44' }]}>
                <Text style={[s.ait, { color: activeChain.color }]}>{a.i}</Text>
              </View>
              <Text style={s.al}>{a.l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Assets */}
        <View style={s.sec}>
          <Text style={s.st}>Assets on {activeChain.name}</Text>
          {loading ? (
            <View style={s.loadBox}>
              <ActivityIndicator color={activeChain.color} />
              <Text style={s.loadT}>Fetching {activeChain.name} balances</Text>
            </View>
          ) : (
            <>
              {tokens.map((t, i) => (
                <View key={i} style={s.row}>
                  <View style={[s.icon, { backgroundColor: (t.color ?? activeChain.color) + '22' }]}>
                    <Text style={[s.iconT, { color: t.color ?? activeChain.color }]}>
                      {t.isNative ? activeChain.icon : (t.icon ?? t.symbol.slice(0, 2))}
                    </Text>
                  </View>
                  <View style={s.rowMid}>
                    <Text style={s.rn}>{t.name}</Text>
                    <Text style={s.rs}>{parseFloat(t.balance).toFixed(4)} {t.symbol}</Text>
                  </View>
                  <View style={s.rowRight}>
                    <Text style={s.rv}>{fmt(t.valueUSD)}</Text>
                    <Text style={[s.rc, { color: t.change24h >= 0 ? '#10B981' : '#EF4444' }]}>
                      {t.change24h === 0 ? 'â€”' : (t.change24h >= 0 ? '+' : '') + t.change24h.toFixed(2) + '%'}
                    </Text>
                  </View>
                </View>
              ))}
              {tokens.length === 0 && (
                <View style={s.empty}>
                  <Text style={{ fontSize: 36, marginBottom: 10 }}>{activeChain.icon}</Text>
                  <Text style={s.et}>No assets on {activeChain.name}</Text>
                  <Text style={s.es}>Bridge or receive {activeChain.symbol} to get started</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Recent Activity */}
        <View style={s.sec}>
          <View style={s.secHdr}>
            <Text style={s.st}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/history' as any)}>
              <Text style={[s.viewAll, { color: activeChain.color }]}>View all â†’</Text>
            </TouchableOpacity>
          </View>
          {txLoading ? (
            <ActivityIndicator color={activeChain.color} />
          ) : recentTxns.length === 0 ? (
            <View style={[s.txEmpty,{alignItems:'center',paddingVertical:24}]}>
              <Text style={{fontSize:28,marginBottom:6}}>ðŸ“­</Text><Text style={s.txEmptyT}>No transactions yet</Text><Text style={{fontSize:12,color:'#94a3b8',marginTop:2}}>Send or receive to see activity</Text>
            </View>
          ) : (
            <>
              {recentTxns.slice(0, 5).map((tx, i) => {
                const meta   = TX_META[tx.type]
                const isSend = tx.type === 'send' || tx.type === 'token_send'
                return (
                  <TouchableOpacity
                    key={i} style={s.txRow}
                    onPress={() => router.push('/history' as any)} activeOpacity={0.7}
                  >
                    <View style={[s.txIcon, { backgroundColor: meta.bg }]}>
                      <Text style={[s.txIconT, { color: meta.color }]}>{meta.icon}</Text>
                    </View>
                    <View style={s.txMid}>
                      <Text style={s.txLabel}>
                        {isSend
                          ? `To: ${tx.to.slice(0,6)}${tx.to.slice(-4)}`
                          : `From: ${tx.from.slice(0,6)}${tx.from.slice(-4)}`}
                      </Text>
                      <Text style={s.txTime}>{relTime(tx.timestamp)}</Text>
                    </View>
                    <Text style={[s.txAmt, { color: meta.color }]}>
                      {isSend ? '' : '+'}{tx.value} {tx.symbol}
                    </Text>
                  </TouchableOpacity>
                )
              })}
              <TouchableOpacity style={s.viewAllBtn} onPress={() => router.push('/history' as any)}>
                <Text style={[s.viewAllBtnT, { color: activeChain.color }]}>View Full History â†’</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* Fund Sheet */}
      <Modal transparent visible={fundSheet} onRequestClose={() => setFundSheet(false)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setFundSheet(false)} />
        <View style={m.fundSheet}>
          <View style={m.handle} />
          <Text style={m.title}>Add Funds</Text>
          <Text style={m.fundSub}>Choose how to fund your wallet</Text>

          {/* Balance Summary Card */}
          <View style={[m.balCard, { backgroundColor: activeChain.color + '12', borderColor: activeChain.color + '30' }]}>
            <View style={m.balCardLeft}>
              <Text style={m.balCardLabel}>Wallet Balance</Text>
              <Text style={[m.balCardAmount, { color: activeChain.color }]}>
                {loading ? '...' : fmt(totalUSD)}
              </Text>
              <Text style={m.balCardSub}>
                {tokens[0] ? parseFloat(tokens[0].balance).toFixed(4) + ' ' + activeChain.symbol : 'â€”'}
              </Text>
            </View>
            <View style={m.balCardRight}>
              <View style={[m.balChainBadge, { backgroundColor: activeChain.color }]}>
                <Text style={m.balChainIcon}>{activeChain.icon}</Text>
              </View>
              <Text style={m.balCardChain}>{activeChain.name}</Text>
            </View>
          </View>


          <TouchableOpacity
            style={m.fundCard}
            activeOpacity={0.85}
            onPress={() => { setFundSheet(false); router.push('/buy' as any) }}
          >
            <View style={[m.fundIconWrap, { backgroundColor: '#EEF2FF' }]}>
              <Text style={{ fontSize: 28 }}>ðŸ’³</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={m.fundCardTitle}>Buy Crypto</Text>
              <Text style={m.fundCardDesc}>Purchase with card via MoonPay, Transak, Ramp & more</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#94A3B8' }}>â€º</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={m.fundCard}
            activeOpacity={0.85}
            onPress={() => { setFundSheet(false); router.push('/earn' as any) }}
          >
            <View style={[m.fundIconWrap, { backgroundColor: '#ECFDF5' }]}>
              <Text style={{ fontSize: 28 }}>ðŸ“ˆ</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={m.fundCardTitle}>Earn Yield</Text>
              <Text style={m.fundCardDesc}>Put idle crypto to work with DeFi â€” up to 5.9% APY</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#94A3B8' }}>â€º</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[m.fundCard, { marginBottom: 0 }]}
            activeOpacity={0.85}
            onPress={() => { setFundSheet(false); router.push('/receive' as any) }}
          >
            <View style={[m.fundIconWrap, { backgroundColor: '#FFF7ED' }]}>
              <Text style={{ fontSize: 28 }}>ðŸ“¥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={m.fundCardTitle}>Receive Crypto</Text>
              <Text style={m.fundCardDesc}>Deposit from another wallet or exchange</Text>
            </View>
            <Text style={{ fontSize: 18, color: '#94A3B8' }}>â€º</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      </View>
      <ChainModal
        visible={chainModal} current={activeChain}
        onSelect={setActiveChain} onClose={() => setChainModal(false)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  c:           { flex:1, backgroundColor:'#F8FAFF' },
  top:         { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingTop: IS_WEB ? 20 : 60, paddingBottom:12 },
  net:         { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'#fff', paddingVertical:7, paddingHorizontal:13, borderRadius:20, borderWidth:1, borderColor:'#E2E8F0' },
  nd:          { width:7, height:7, borderRadius:4 },
  nt:          { fontSize:13, fontWeight:'600', color:'#1E1B4B' },
  chevron:     { fontSize:11, color:'#94A3B8' },
  cog:         { width:38, height:38, borderRadius:12, backgroundColor:'#fff', borderWidth:1, borderColor:'#E2E8F0', alignItems:'center', justifyContent:'center' },
  card:        { marginHorizontal:16, marginBottom:16, borderRadius:24, padding:24, alignItems:'center', shadowOffset:{width:0,height:8}, shadowOpacity:0.35, shadowRadius:20, elevation:10 },
  av:          { width:52, height:52, borderRadius:26, backgroundColor:'rgba(255,255,255,0.25)', alignItems:'center', justifyContent:'center', marginBottom:10 },
  avt:         { color:'#fff', fontSize:22, fontWeight:'700' },
  addr:        { color:'rgba(255,255,255,0.7)', fontSize:13, marginBottom:14 },
  bl:          { color:'rgba(255,255,255,0.65)', fontSize:13, marginBottom:5 },
  bal:         { color:'#fff', fontSize:40, fontWeight:'700', letterSpacing:-1 },
  nativeSub:   { color:'rgba(255,255,255,0.7)', fontSize:13, marginTop:4 },
  chg:         { fontSize:12, fontWeight:'600', marginTop:4, marginBottom:10 },
  chainBadge:  { marginTop:10, paddingVertical:5, paddingHorizontal:14, borderRadius:20 },
  chainBadgeT: { color:'#fff', fontSize:11, fontWeight:'500' },
  err:         { marginHorizontal:16, marginBottom:12, backgroundColor:'#FEF2F2', borderRadius:14, borderWidth:1, borderColor:'#FECACA', padding:13 },
  errT:        { color:'#DC2626', fontSize:13, textAlign:'center' },
  acts:        { flexDirection:'row', justifyContent:'space-around', paddingHorizontal:16, marginBottom:28 },
  act:         { alignItems:'center', gap:8 },
  ai:          { width:54, height:54, borderRadius:27, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', borderWidth:2, shadowColor:'#64748B', shadowOffset:{width:0,height:2}, shadowOpacity:0.12, shadowRadius:8, elevation:3 },
  ait:         { fontSize:22, fontWeight:'700', textAlign:'center' },
  al:          { color:'#64748B', fontSize:12, fontWeight:'500' },
  sec:         { paddingHorizontal:16, marginBottom:24 },
  secHdr:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  st:          { color:'#1E1B4B', fontSize:17, fontWeight:'700', marginBottom:12 },
  viewAll:     { fontSize:13, fontWeight:'600' },
  loadBox:     { backgroundColor:'#fff', borderRadius:16, padding:24, alignItems:'center', gap:10 },
  loadT:       { color:'#94A3B8', fontSize:13 },
  row:         { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:16, padding:14, marginBottom:10, borderWidth:1, borderColor:'#F1F5F9' },
  icon:        { width:42, height:42, borderRadius:21, alignItems:'center', justifyContent:'center', marginRight:12 },
  iconT:       { fontSize:16, fontWeight:'700' },
  rowMid:      { flex:1 },
  rn:          { color:'#1E1B4B', fontSize:14, fontWeight:'600' },
  rs:          { color:'#94A3B8', fontSize:12, marginTop:2 },
  rowRight:    { alignItems:'flex-end' },
  rv:          { color:'#1E1B4B', fontSize:14, fontWeight:'600' },
  rc:          { fontSize:12, fontWeight:'500', marginTop:2 },
  empty:       { backgroundColor:'#fff', borderRadius:20, padding:28, alignItems:'center', borderWidth:1, borderColor:'#E2E8F0' },
  et:          { color:'#1E1B4B', fontSize:16, fontWeight:'600', marginBottom:5 },
  es:          { color:'#94A3B8', fontSize:13, textAlign:'center' },
  txEmpty:     { backgroundColor:'#fff', borderRadius:14, padding:20, alignItems:'center', borderWidth:1, borderColor:'#F1F5F9' },
  txEmptyT:    { color:'#CBD5E1', fontSize:13 },
  txRow:       { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:14, padding:13, marginBottom:8, borderWidth:1, borderColor:'#F1F5F9' },
  txIcon:      { width:38, height:38, borderRadius:19, alignItems:'center', justifyContent:'center', marginRight:12 },
  txIconT:     { fontSize:16, fontWeight:'700' },
  txMid:       { flex:1 },
  txLabel:     { color:'#1E1B4B', fontSize:13, fontWeight:'500', marginBottom:2 },
  txTime:      { color:'#CBD5E1', fontSize:11 },
  txAmt:       { fontSize:13, fontWeight:'600' },
  viewAllBtn:  { backgroundColor:'#F8FAFF', borderRadius:12, borderWidth:1.5, borderColor:'#E0E7FF', paddingVertical:12, alignItems:'center', marginTop:4 },
  viewAllBtnT: { fontSize:14, fontWeight:'600' },
})

const m = StyleSheet.create({
  overlay:     { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(15,23,42,0.5)' },
  sheet:       { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#fff', borderTopLeftRadius:28, borderTopRightRadius:28, paddingTop:12, paddingHorizontal:16, paddingBottom:32 },
  handle:      { width:36, height:4, borderRadius:2, backgroundColor:'#E2E8F0', alignSelf:'center', marginBottom:16 },
  title:       { color:'#1E1B4B', fontSize:17, fontWeight:'700', marginBottom:16, paddingLeft:4 },
  row:         { flexDirection:'row', alignItems:'center', padding:14, borderRadius:16, marginBottom:8, backgroundColor:'#F8FAFF' },
  rowActive:   { backgroundColor:'#EEF2FF' },
  iconWrap:    { width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center', marginRight:14 },
  icon:        { fontSize:20 },
  mid:         { flex:1 },
  chainName:   { color:'#1E1B4B', fontSize:15, fontWeight:'600' },
  chainSymbol: { color:'#94A3B8', fontSize:12, marginTop:2 },
  activeDot:   { width:10, height:10, borderRadius:5 },
  balCard:        { flexDirection:'row', justifyContent:'space-between', alignItems:'center', borderRadius:16, borderWidth:1, padding:16, marginBottom:20 },
  balCardLeft:    { flex:1 },
  balCardLabel:   { color:'#64748B', fontSize:11, fontWeight:'600', textTransform:'uppercase', letterSpacing:0.5, marginBottom:4 },
  balCardAmount:  { fontSize:26, fontWeight:'800', letterSpacing:-0.5, marginBottom:2 },
  balCardSub:     { color:'#94A3B8', fontSize:12 },
  balCardRight:   { alignItems:'center', gap:6 },
  balChainBadge:  { width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center' },
  balChainIcon:   { fontSize:22 },
  balCardChain:   { color:'#64748B', fontSize:11, fontWeight:'600' },
  fundSheet:     { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#fff', borderTopLeftRadius:28, borderTopRightRadius:28, paddingTop:12, paddingHorizontal:16, paddingBottom:40 },
  fundSub:       { color:'#94A3B8', fontSize:13, marginTop:2, marginBottom:20, paddingLeft:4 },
  fundCard:      { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'#F8FAFF', borderRadius:16, padding:16, marginBottom:12, borderWidth:1, borderColor:'#E2E8F0' },
  fundIconWrap:  { width:52, height:52, borderRadius:26, alignItems:'center', justifyContent:'center' },
  fundCardTitle: { color:'#1E1B4B', fontSize:15, fontWeight:'700', marginBottom:3 },
  fundCardDesc:  { color:'#64748B', fontSize:12, lineHeight:17 },
})








