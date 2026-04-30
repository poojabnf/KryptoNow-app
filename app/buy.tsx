import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Linking, Alert, SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'
import { useWalletStore } from '../store/walletStore'

//  Data 
const TOKENS = [
  { symbol: 'ETH',  name: 'Ethereum',  icon: 'Ξ' },
  { symbol: 'BNB',  name: 'BNB',       icon: '◆' },
  { symbol: 'MATIC',name: 'Polygon',   icon: '⬡' },
  { symbol: 'USDC', name: 'USD Coin',  icon: '💲' },
  { symbol: 'USDT', name: 'Tether',    icon: '₮'  },
  { symbol: 'BTC',  name: 'Bitcoin',   icon: '₿'  },
]

const AMOUNTS = ['50', '100', '250', '500']

const PROVIDERS = [
  {
    id: 'moonpay',
    name: 'MoonPay',
    icon: '🌙',
    color: '#7B2FF7',
    bg: '#F3E8FF',
    description: 'Fast & secure card payments',
    fees: '~3.5%',
    minAmount: 20,
    methods: ['Visa', 'Mastercard', 'Apple Pay'],
    rating: '4.8',
    buildUrl: (addr: string, token: string, amount: string) =>
      `https://buy.moonpay.com/?walletAddress=${addr}&currencyCode=${token.toLowerCase()}&baseCurrencyAmount=${amount}&baseCurrencyCode=usd`,
  },
  {
    id: 'transak',
    name: 'Transak',
    icon: '⚡',
    color: '#0066FF',
    bg: '#EFF6FF',
    description: '169+ countries supported',
    fees: '~13%',
    minAmount: 10,
    methods: ['Card', 'Bank Transfer', 'Google Pay'],
    rating: '4.6',
    buildUrl: (addr: string, token: string, amount: string) =>
      `https://global.transak.com/?walletAddress=${addr}&cryptoCurrencyCode=${token}&fiatAmount=${amount}&fiatCurrency=USD`,
  },
  {
    id: 'ramp',
    name: 'Ramp Network',
    icon: '🔷',
    color: '#00C1B4',
    bg: '#ECFDF5',
    description: 'Best rates, low fees',
    fees: '~0.92.9%',
    minAmount: 5,
    methods: ['Open Banking', 'Card', 'PayPal'],
    rating: '4.7',
    buildUrl: (addr: string, token: string, amount: string) =>
      `https://app.ramp.network/?userAddress=${addr}&swapAsset=${token}&fiatValue=${amount}&fiatCurrency=USD`,
  },
  {
    id: 'simplex',
    name: 'Simplex',
    icon: '💠',
    color: '#2563EB',
    bg: '#EFF6FF',
    description: 'Instant approval, no rejection',
    fees: '~3.55%',
    minAmount: 50,
    methods: ['Visa', 'Mastercard'],
    rating: '4.4',
    buildUrl: (addr: string, token: string, amount: string) =>
      `https://simplex.com/account/sell?crypto_currency=${token}&fiat_currency=USD&fiat_amount=${amount}&wallet_address=${addr}`,
  },
]

//  Screen 
export default function BuyScreen() {
  const addr        = useWalletStore(s => s.address)
  const activeChain = useWalletStore(s => s.activeChain)

  const [amount,      setAmount]      = useState('100')
  const [selToken,    setSelToken]    = useState('ETH')
  const [selProvider, setSelProvider] = useState<string | null>(null)
  const [showTokens,  setShowTokens]  = useState(false)

  const token = TOKENS.find(t => t.symbol === selToken) ?? TOKENS[0]

  function handleBuy() {
    if (!selProvider) { Alert.alert('Select a provider', 'Tap a provider card first.'); return }
    const p = PROVIDERS.find(x => x.id === selProvider)!
    if (parseFloat(amount) < p.minAmount) {
      Alert.alert('Minimum amount', `${p.name} requires a minimum of $${p.minAmount}.`)
      return
    }
    const url = p.buildUrl(addr ?? '', selToken, amount)
    Linking.openURL(url).catch(() => Alert.alert('Error', 'Could not open browser.'))
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backT}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Buy Crypto</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>

        {/* Amount pills */}
        <View style={s.section}>
          <Text style={s.label}>Amount (USD)</Text>
          <View style={s.row4}>
            {AMOUNTS.map(a => (
              <TouchableOpacity
                key={a} style={[s.pill, amount === a && { ...s.pillActive, borderColor: activeChain.color }]}
                onPress={() => setAmount(a)} activeOpacity={0.75}
              >
                <Text style={[s.pillT, amount === a && { color: activeChain.color, fontWeight: '700' }]}>
                  ${a}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Token picker */}
        <View style={s.section}>
          <Text style={s.label}>Token</Text>
          <TouchableOpacity
            style={[s.tokenPicker, { borderColor: activeChain.color + '55' }]}
            onPress={() => setShowTokens(!showTokens)} activeOpacity={0.8}
          >
            <View style={[s.tokenIconWrap, { backgroundColor: activeChain.color + '22' }]}>
              <Text style={s.tokenIcon}>{token.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.tokenName}>{token.name}</Text>
              <Text style={s.tokenSymbol}>{token.symbol}</Text>
            </View>
            <Text style={{ color: '#94A3B8', fontSize: 16 }}>{showTokens ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {showTokens && (
            <View style={s.tokenDropdown}>
              {TOKENS.map(t => (
                <TouchableOpacity
                  key={t.symbol}
                  style={[s.tokenItem, selToken === t.symbol && { backgroundColor: activeChain.color + '12' }]}
                  onPress={() => { setSelToken(t.symbol); setShowTokens(false) }}
                  activeOpacity={0.7}
                >
                  <Text style={s.tokenItemIcon}>{t.icon}</Text>
                  <Text style={[s.tokenItemName, selToken === t.symbol && { color: activeChain.color }]}>
                    {t.name}
                  </Text>
                  <Text style={s.tokenItemSym}>{t.symbol}</Text>
                  {selToken === t.symbol && <Text style={{ color: activeChain.color }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Wallet preview */}
        <View style={[s.walletBox, { borderColor: activeChain.color + '44', backgroundColor: activeChain.color + '0A' }]}>
          <View style={[s.walletDot, { backgroundColor: activeChain.color }]} />
          <Text style={s.walletAddr} numberOfLines={1}>
            {addr ? addr.slice(0, 10) + '...' + addr.slice(-6) : 'No wallet'}
          </Text>
          <Text style={[s.walletChain, { color: activeChain.color }]}>{activeChain.name}</Text>
        </View>

        {/* Providers */}
        <View style={s.section}>
          <Text style={s.label}>Choose Provider</Text>
          {PROVIDERS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[s.provCard, selProvider === p.id && { borderColor: p.color, borderWidth: 2 }]}
              onPress={() => setSelProvider(p.id === selProvider ? null : p.id)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <View style={[s.provIcon, { backgroundColor: p.bg }]}>
                  <Text style={{ fontSize: 22 }}>{p.icon}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.provName}>{p.name}</Text>
                  <Text style={s.provDesc}>{p.description}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.provRating}>{p.rating}</Text>
                  <Text style={s.provFees}>{p.fees}</Text>
                </View>
              </View>
              <View style={s.methodRow}>
                {p.methods.map(m => (
                  <View key={m} style={s.methodPill}>
                    <Text style={s.methodT}>{m}</Text>
                  </View>
                ))}
                <View style={[s.methodPill, { backgroundColor: '#FFF7ED' }]}>
                  <Text style={[s.methodT, { color: '#EA580C' }]}>Min ${p.minAmount}</Text>
                </View>
              </View>
              {selProvider === p.id && (
                <View style={[s.selectedBanner, { backgroundColor: p.color + '15', borderColor: p.color + '33' }]}>
                  <Text style={[s.selectedBannerT, { color: p.color }]}>
                    ✓ Selected · Buying ${amount} of {selToken} via {p.name}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Buy CTA */}
      <View style={s.cta}>
        <TouchableOpacity
          style={[s.buyBtn, { backgroundColor: selProvider ? activeChain.color : '#CBD5E1' }]}
          onPress={handleBuy} activeOpacity={0.85}
        >
          <Text style={s.buyBtnT}>
            {selProvider
              ? `Buy $${amount} of ${selToken} →`
              : 'Select a provider to continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

//  Styles 
const s = StyleSheet.create({
  safe:         { flex: 1, backgroundColor: '#F8FAFF' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  back:         { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  backT:        { fontSize: 18, color: '#1E1B4B' },
  title:        { color: '#1E1B4B', fontSize: 18, fontWeight: '700' },
  section:      { paddingHorizontal: 16, marginBottom: 20 },
  label:        { color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  row4:         { flexDirection: 'row', gap: 8 },
  pill:         { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0' },
  pillActive:   { backgroundColor: '#F8FAFF' },
  pillT:        { color: '#64748B', fontSize: 14, fontWeight: '600' },
  tokenPicker:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1.5, gap: 12 },
  tokenIconWrap:{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  tokenIcon:    { fontSize: 20 },
  tokenName:    { color: '#1E1B4B', fontSize: 15, fontWeight: '600' },
  tokenSymbol:  { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  tokenDropdown:{ backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 8, overflow: 'hidden' },
  tokenItem:    { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tokenItemIcon:{ fontSize: 18 },
  tokenItemName:{ flex: 1, color: '#1E1B4B', fontSize: 14, fontWeight: '500' },
  tokenItemSym: { color: '#94A3B8', fontSize: 12 },
  walletBox:    { marginHorizontal: 16, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14, borderWidth: 1 },
  walletDot:    { width: 8, height: 8, borderRadius: 4 },
  walletAddr:   { flex: 1, color: '#1E1B4B', fontSize: 13, fontWeight: '500' },
  walletChain:  { fontSize: 12, fontWeight: '600' },
  provCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  provIcon:     { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  provName:     { color: '#1E1B4B', fontSize: 15, fontWeight: '700' },
  provDesc:     { color: '#64748B', fontSize: 12, marginTop: 2 },
  provRating:   { color: '#F59E0B', fontSize: 13, fontWeight: '700' },
  provFees:     { color: '#64748B', fontSize: 12, marginTop: 2 },
  methodRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  methodPill:   { backgroundColor: '#F1F5F9', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  methodT:      { color: '#64748B', fontSize: 11, fontWeight: '500' },
  selectedBanner:{ marginTop: 12, borderRadius: 10, padding: 10, borderWidth: 1 },
  selectedBannerT:{ fontSize: 12, fontWeight: '600', textAlign: 'center' },
  cta:          { paddingHorizontal: 16, paddingBottom: 24, paddingTop: 10, backgroundColor: '#F8FAFF' },
  buyBtn:       { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  buyBtnT:      { color: '#fff', fontSize: 16, fontWeight: '700' },
})

