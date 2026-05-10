import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Linking, SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useTheme } from '../context/ThemeContext'
import { useWalletStore } from '../store/walletStore'
import { CHAINS } from '../utils/chains'
import { useToast } from '../context/ToastContext'

type BridgeProvider = {
  id:          string
  name:        string
  icon:        string
  color:       string
  bg:          string
  description: string
  features:    string[]
  buildUrl:    (from: number, to: number, token: string, addr: string) => string
}

const BRIDGE_PROVIDERS: BridgeProvider[] = [
  {
    id:          'across',
    name:        'Across Protocol',
    icon:        'A',
    color:       '#6CF4CF',
    bg:          '#022C22',
    description: 'Fastest bridge — typically 1-2 minutes, optimistic verification',
    features:    ['Ethereum ↔ L2s', 'Low fees', 'Instant UX'],
    buildUrl:    (from, to, token, addr) =>
      `https://app.across.to/?inputChainId=${from}&outputChainId=${to}&inputToken=${token}&recipient=${addr}`,
  },
  {
    id:          'stargate',
    name:        'Stargate Finance',
    icon:        'S',
    color:       '#00D4FF',
    bg:          '#001F33',
    description: 'Omnichain liquidity — bridge stablecoins and ETH instantly',
    features:    ['USDC, USDT, ETH', 'All major chains', 'LayerZero powered'],
    buildUrl:    (from, to, token, addr) =>
      `https://stargate.finance/bridge?srcChain=${from}&dstChain=${to}&token=${token}`,
  },
  {
    id:          'hop',
    name:        'Hop Exchange',
    icon:        'H',
    color:       '#E34CA6',
    bg:          '#1A0010',
    description: 'Ethereum Layer 2 bridge specialist — ETH, USDC, USDT, DAI',
    features:    ['Optimism, Arbitrum', 'Polygon, Base', 'Low slippage'],
    buildUrl:    (from, to, token, addr) =>
      `https://app.hop.exchange/#/send?sourceNetwork=ethereum&destNetwork=optimism&token=${token}&recipient=${addr}`,
  },
  {
    id:          'relay',
    name:        'Relay Bridge',
    icon:        'R',
    color:       '#7C3AED',
    bg:          '#140029',
    description: 'Ultra-fast ETH bridging in seconds, no waiting periods',
    features:    ['Sub-second bridging', 'ETH & WETH', 'Base, Optimism, Arb'],
    buildUrl:    (from, to, token, addr) =>
      `https://relay.link/bridge?fromChainId=${from}&toChainId=${to}&currency=ETH`,
  },
]

const BRIDGE_TOKENS = ['ETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'MATIC', 'BNB']

// Chains that are popular bridge destinations
const BRIDGE_CHAINS = CHAINS.filter(c => [1, 137, 42161, 10, 8453, 56].includes(c.id))

export default function BridgeScreen() {
  const { theme }   = useTheme()
  const activeChain = useWalletStore(s => s.activeChain)
  const addr        = useWalletStore(s => s.address)
  const toast       = useToast()

  const otherChains    = BRIDGE_CHAINS.filter(c => c.id !== activeChain.id)
  const [toChain,      setToChain]     = useState(otherChains[0])
  const [selToken,     setSelToken]    = useState('ETH')
  const [selProvider,  setSelProvider] = useState<string | null>(null)
  const [showFromList, setShowFromList] = useState(false)
  const [fromChain,    setFromChain]   = useState(activeChain)

  function handleBridge() {
    if (!selProvider) { toast.warning('Select a bridge provider'); return }
    const provider = BRIDGE_PROVIDERS.find(p => p.id === selProvider)!
    const url = provider.buildUrl(fromChain.id, toChain.id, selToken, addr ?? '')
    Linking.openURL(url).catch(() => toast.error('Could not open browser'))
  }

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: theme.bgApp }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          style={[s.back, { backgroundColor: theme.bgCard, borderColor: theme.border }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.title, { color: theme.textPrimary }]}>Bridge</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>

        {/* Info banner */}
        <LinearGradient
          colors={[activeChain.color + '20', activeChain.color + '08']}
          style={[s.infoBanner, { borderColor: activeChain.color + '30' }]}
        >
          <Ionicons name="swap-horizontal" size={20} color={activeChain.color} />
          <Text style={[s.infoText, { color: activeChain.color }]}>
            Move assets between chains. Bridges connect you to 3rd-party services — KryptoNow earns no fees from bridging.
          </Text>
        </LinearGradient>

        {/* Chain selector */}
        <Text style={[s.label, { color: theme.textSecondary }]}>From</Text>
        <TouchableOpacity
          style={[s.chainPicker, { backgroundColor: theme.bgCard, borderColor: fromChain.color + '44' }]}
          onPress={() => setShowFromList(!showFromList)}
          activeOpacity={0.8}
        >
          <View style={[s.chainIcon, { backgroundColor: fromChain.color + '22' }]}>
            <Text style={[s.chainIconT, { color: fromChain.color }]}>{fromChain.icon}</Text>
          </View>
          <Text style={[s.chainName, { color: theme.textPrimary }]}>{fromChain.name}</Text>
          <Ionicons name={showFromList ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textMuted} />
        </TouchableOpacity>
        {showFromList && (
          <View style={[s.chainList, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
            {BRIDGE_CHAINS.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[s.chainListItem, fromChain.id === c.id && { backgroundColor: c.color + '12' }]}
                onPress={() => { setFromChain(c); setShowFromList(false); if (toChain.id === c.id) setToChain(BRIDGE_CHAINS.find(x => x.id !== c.id)!) }}
                activeOpacity={0.7}
              >
                <View style={[s.chainIcon, { backgroundColor: c.color + '18' }]}>
                  <Text style={[s.chainIconT, { color: c.color }]}>{c.icon}</Text>
                </View>
                <Text style={[s.chainName, { color: theme.textPrimary }]}>{c.name}</Text>
                {fromChain.id === c.id && <Ionicons name="checkmark-circle" size={16} color={c.color} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={s.arrowRow}>
          <View style={[s.divider, { backgroundColor: theme.border }]} />
          <View style={[s.arrowCircle, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
            <Ionicons name="arrow-down" size={18} color={activeChain.color} />
          </View>
          <View style={[s.divider, { backgroundColor: theme.border }]} />
        </View>

        <Text style={[s.label, { color: theme.textSecondary }]}>To</Text>
        <View style={s.toChainRow}>
          {otherChains.map(c => (
            <TouchableOpacity
              key={c.id}
              style={[
                s.chainChip,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
                toChain.id === c.id && { borderColor: c.color, backgroundColor: c.color + '10' },
              ]}
              onPress={() => setToChain(c)}
              activeOpacity={0.75}
            >
              <Text style={{ fontSize: 13, marginRight: 4 }}>{c.icon}</Text>
              <Text style={[s.chipT, { color: toChain.id === c.id ? c.color : theme.textSecondary }]}>
                {c.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Token */}
        <Text style={[s.label, { color: theme.textSecondary, marginTop: 20 }]}>Token</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {BRIDGE_TOKENS.map(t => (
            <TouchableOpacity
              key={t}
              style={[
                s.tokenChip,
                { backgroundColor: theme.bgCard, borderColor: theme.border },
                selToken === t && { borderColor: activeChain.color, backgroundColor: activeChain.color + '12' },
              ]}
              onPress={() => setSelToken(t)}
              activeOpacity={0.75}
            >
              <Text style={[s.tokenChipT, { color: selToken === t ? activeChain.color : theme.textSecondary }]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Route summary */}
        <View style={[s.routeSummary, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <View style={[s.chainIcon, { backgroundColor: fromChain.color + '18' }]}>
            <Text style={[s.chainIconT, { color: fromChain.color }]}>{fromChain.icon}</Text>
          </View>
          <Text style={[s.routeArrow, { color: theme.textMuted }]}>
            {selToken}  →  {toChain.name.split(' ')[0]}
          </Text>
          <View style={[s.chainIcon, { backgroundColor: toChain.color + '18' }]}>
            <Text style={[s.chainIconT, { color: toChain.color }]}>{toChain.icon}</Text>
          </View>
        </View>

        {/* Providers */}
        <Text style={[s.label, { color: theme.textSecondary, marginTop: 20 }]}>Choose Bridge</Text>
        {BRIDGE_PROVIDERS.map(p => (
          <TouchableOpacity
            key={p.id}
            style={[
              s.provCard,
              { backgroundColor: p.bg, borderColor: selProvider === p.id ? p.color : p.color + '33' },
              selProvider === p.id && { borderWidth: 2 },
            ]}
            onPress={() => setSelProvider(p.id === selProvider ? null : p.id)}
            activeOpacity={0.85}
          >
            <View style={s.provHeader}>
              <View style={[s.provIcon, { backgroundColor: p.color + '22', borderColor: p.color + '44' }]}>
                <Text style={[s.provIconT, { color: p.color }]}>{p.icon}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[s.provName, { color: '#F1F5F9' }]}>{p.name}</Text>
                <Text style={[s.provDesc, { color: '#94A3B8' }]}>{p.description}</Text>
              </View>
              {selProvider === p.id && (
                <Ionicons name="checkmark-circle" size={22} color={p.color} />
              )}
            </View>
            <View style={s.featureRow}>
              {p.features.map(f => (
                <View key={f} style={[s.featurePill, { backgroundColor: p.color + '15', borderColor: p.color + '30' }]}>
                  <Text style={[s.featureT, { color: p.color }]}>{f}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}

        {/* Disclaimer */}
        <View style={[s.disclaimer, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.textMuted} style={{ marginRight: 8, flexShrink: 0 }} />
          <Text style={[s.disclaimerT, { color: theme.textMuted }]}>
            Bridges are independent protocols. Always verify URLs. KryptoNow does not custody your funds during bridging.
          </Text>
        </View>
      </ScrollView>

      {/* CTA */}
      <View style={[s.cta, { backgroundColor: theme.bgApp }]}>
        <TouchableOpacity
          style={[s.ctaBtn, { backgroundColor: selProvider ? activeChain.color : theme.bgCard, borderColor: theme.border }]}
          onPress={handleBridge}
          activeOpacity={0.85}
        >
          <Text style={[s.ctaBtnT, { color: selProvider ? '#fff' : theme.textMuted }]}>
            {selProvider
              ? `Bridge ${selToken}: ${fromChain.name.split(' ')[0]} → ${toChain.name.split(' ')[0]}`
              : 'Select a bridge to continue'}
          </Text>
          {selProvider && <Ionicons name="open-outline" size={16} color="#fff" style={{ marginLeft: 8 }} />}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  safe:         { flex: 1 },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  back:         { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 18, fontWeight: '700' },
  infoBanner:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 20 },
  infoText:     { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
  label:        { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  chainPicker:  { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1.5, padding: 14, marginBottom: 4 },
  chainIcon:    { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chainIconT:   { fontSize: 14, fontWeight: '800' },
  chainName:    { flex: 1, fontSize: 15, fontWeight: '600' },
  chainList:    { borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginBottom: 4 },
  chainListItem:{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(148,163,184,0.2)' },
  arrowRow:     { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  divider:      { flex: 1, height: 1 },
  arrowCircle:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginHorizontal: 8 },
  toChainRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chainChip:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, gap: 4 },
  chipT:        { fontSize: 13, fontWeight: '600' },
  tokenChip:    { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1.5, marginRight: 8 },
  tokenChipT:   { fontSize: 13, fontWeight: '700' },
  routeSummary: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 4 },
  routeArrow:   { flex: 1, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  provCard:     { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
  provHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  provIcon:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  provIconT:    { fontSize: 18, fontWeight: '800' },
  provName:     { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  provDesc:     { fontSize: 12, lineHeight: 18 },
  featureRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  featurePill:  { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  featureT:     { fontSize: 11, fontWeight: '600' },
  disclaimer:   { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 8 },
  disclaimerT:  { flex: 1, fontSize: 12, lineHeight: 18 },
  cta:          { padding: 16, paddingBottom: 28 },
  ctaBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 16, paddingVertical: 16, borderWidth: 1 },
  ctaBtnT:      { fontSize: 15, fontWeight: '700' },
})
