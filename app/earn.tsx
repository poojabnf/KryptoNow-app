import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'
import { useWalletStore } from '../store/walletStore'

//  Data 
type YieldProduct = {
  id: string; name: string; protocol: string; asset: string
  icon: string; color: string; bg: string
  apy: string; apyValue: number; risk: 'Low' | 'Medium' | 'High'
  tvl: string; minAmount: string; description: string
  tags: string[]
}

const YIELD_PRODUCTS: YieldProduct[] = [
  {
    id: 'aave-eth',
    name: 'ETH Lending',
    protocol: 'Aave v3',
    asset: 'ETH',
    icon: 'Ξ',
    color: '#6366F1',
    bg: '#EEF2FF',
    apy: '3.2%',
    apyValue: 3.2,
    risk: 'Low',
    tvl: '$4.2B',
    minAmount: '0.01 ETH',
    description: 'Lend ETH to borrowers on Aave. Earn interest while keeping full withdrawal access.',
    tags: ['Audited', 'Non-custodial', 'Instant withdraw'],
  },
  {
    id: 'lido-steth',
    name: 'ETH Staking',
    protocol: 'Lido Finance',
    asset: 'ETH',
    icon: '🔷',
    color: '#0EA5E9',
    bg: '#F0F9FF',
    apy: '3.8%',
    apyValue: 3.8,
    risk: 'Low',
    tvl: '$14.1B',
    minAmount: '0.01 ETH',
    description: 'Liquid stake ETH and receive stETH. No lock-up, trade or use stETH in DeFi.',
    tags: ['Liquid', 'stETH rewards', 'Top protocol'],
  },
  {
    id: 'compound-usdc',
    name: 'USDC Lending',
    protocol: 'Compound v3',
    asset: 'USDC',
    icon: '💲',
    color: '#2775CA',
    bg: '#EFF6FF',
    apy: '5.1%',
    apyValue: 5.1,
    risk: 'Low',
    tvl: '$980M',
    minAmount: '10 USDC',
    description: 'Supply USDC to Compound and earn variable interest. Best stablecoin yields.',
    tags: ['Stablecoin', 'No IL risk', 'Audited'],
  },
  {
    id: 'curve-usdc-usdt',
    name: 'Stablecoin LP',
    protocol: 'Curve Finance',
    asset: 'USDC/USDT',
    icon: '🌀',
    color: '#D97706',
    bg: '#FFFBEB',
    apy: '4.4%',
    apyValue: 4.4,
    risk: 'Low',
    tvl: '$2.1B',
    minAmount: '50 USDC',
    description: 'Provide liquidity to Curve stablecoin pools. Minimal impermanent loss, steady yield.',
    tags: ['LP rewards', 'CRV boost', 'Low IL'],
  },
  {
    id: 'gmx-matic',
    name: 'MATIC Staking',
    protocol: 'Polygon Native',
    asset: 'MATIC',
    icon: '⬡',
    color: '#7C3AED',
    bg: '#F5F3FF',
    apy: '5.9%',
    apyValue: 5.9,
    risk: 'Medium',
    tvl: '$680M',
    minAmount: '1 MATIC',
    description: 'Delegate MATIC to validators on Polygon. Earn native staking rewards each checkpoint.',
    tags: ['Native staking', 'Checkpoint rewards', 'Validators'],
  },
]

function calcEarnings(amount: number, apy: number) {
  const yearly  = amount * (apy / 100)
  const monthly = yearly / 12
  const daily   = yearly / 365
  return {
    daily:   `$${daily.toFixed(2)}`,
    monthly: `$${monthly.toFixed(2)}`,
    yearly:  `$${yearly.toFixed(2)}`,
  }
}

const RISK_COLOR: Record<string, string> = {
  Low: '#10B981', Medium: '#F59E0B', High: '#EF4444',
}

//  Screen 
export default function EarnScreen() {
  const activeChain = useWalletStore(s => s.activeChain)
  const [selected, setSelected] = useState<string | null>(null)
  const [calcAmt,  setCalcAmt]  = useState('')

  const selProduct = YIELD_PRODUCTS.find(p => p.id === selected) ?? null
  const earnings   = selProduct && calcAmt
    ? calcEarnings(parseFloat(calcAmt) || 0, selProduct.apyValue)
    : null

  const totalTVL  = '$22.1B'
  const maxAPY    = '5.9%'
  const products  = YIELD_PRODUCTS.length

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backT}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Earn Yield</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Hero stats */}
        <View style={s.heroBox}>
          <Text style={s.heroTitle}>Put Your Crypto to Work</Text>
          <Text style={s.heroSub}>Audited protocols · Withdraw anytime · No lock-up</Text>
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={s.statV}>{totalTVL}</Text>
              <Text style={s.statL}>Total TVL</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.stat}>
              <Text style={s.statV}>{products}</Text>
              <Text style={s.statL}>Products</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.stat}>
              <Text style={[s.statV, { color: '#10B981' }]}>Up to {maxAPY}</Text>
              <Text style={s.statL}>Best APY</Text>
            </View>
          </View>
        </View>

        {/* Products */}
        <View style={s.section}>
          <Text style={s.label}>Available Products</Text>
          {YIELD_PRODUCTS.map(p => {
            const isOpen = selected === p.id
            return (
              <TouchableOpacity
                key={p.id}
                style={[s.card, isOpen && { borderColor: p.color, borderWidth: 2 }]}
                onPress={() => setSelected(isOpen ? null : p.id)}
                activeOpacity={0.8}
              >
                {/* Card header */}
                <View style={s.cardHeader}>
                  <View style={[s.cardIcon, { backgroundColor: p.bg }]}>
                    <Text style={{ fontSize: 22 }}>{p.icon}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.cardName}>{p.name}</Text>
                    <Text style={s.cardProtocol}>{p.protocol} · {p.asset}</Text>
                  </View>
                  <View style={[s.apyBadge, { backgroundColor: p.color + '18' }]}>
                    <Text style={[s.apyV, { color: p.color }]}>{p.apy}</Text>
                    <Text style={[s.apyLabel, { color: p.color + 'AA' }]}>APY</Text>
                  </View>
                </View>

                {/* Metadata */}
                <View style={s.metaRow}>
                  <View style={s.metaPill}>
                    <Text style={s.metaT}>TVL {p.tvl}</Text>
                  </View>
                  <View style={s.metaPill}>
                    <Text style={s.metaT}>Min {p.minAmount}</Text>
                  </View>
                  <View style={[s.metaPill, { backgroundColor: RISK_COLOR[p.risk] + '18' }]}>
                    <Text style={[s.metaT, { color: RISK_COLOR[p.risk] }]}>{p.risk} risk</Text>
                  </View>
                </View>

                {/* Tags */}
                <View style={s.tagRow}>
                  {p.tags.map(t => (
                    <View key={t} style={[s.tag, { backgroundColor: p.color + '12' }]}>
                      <Text style={[s.tagT, { color: p.color }]}>{t}</Text>
                    </View>
                  ))}
                </View>

                {/* Expanded */}
                {isOpen && (
                  <View style={s.expanded}>
                    <Text style={s.expandedDesc}>{p.description}</Text>

                    {/* Calculator */}
                    <View style={[s.calcBox, { borderColor: p.color + '44' }]}>
                      <Text style={[s.calcLabel, { color: p.color }]}>💰 Earnings Calculator</Text>
                      <TextInput
                        style={s.calcInput}
                        placeholder={`Enter amount in ${p.asset}`}
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={calcAmt}
                        onChangeText={setCalcAmt}
                      />
                      {earnings && parseFloat(calcAmt) > 0 && (
                        <View style={s.earningsRow}>
                          {[
                            { label: 'Daily',   val: earnings.daily   },
                            { label: 'Monthly', val: earnings.monthly },
                            { label: 'Yearly',  val: earnings.yearly  },
                          ].map(e => (
                            <View key={e.label} style={s.earningItem}>
                              <Text style={[s.earningV, { color: p.color }]}>{e.val}</Text>
                              <Text style={s.earningL}>{e.label}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[s.depositBtn, { backgroundColor: p.color }]}
                      onPress={() => Alert.alert(
                        'Coming Soon 🚀',
                        `Direct DeFi deposits for ${p.protocol} are launching in the next Kryptonow update.`,
                        [{ text: 'OK' }]
                      )}
                      activeOpacity={0.85}
                    >
                      <Text style={s.depositBtnT}>Deposit {p.asset} →</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        {/* Disclaimer */}
        <View style={s.disclaimer}>
          <Text style={s.disclaimerT}>
            ⚠ï¸  DeFi yields are variable and carry smart contract risk. Kryptonow does not
            custody your assets — all protocols are non-custodial. APYs shown are estimates.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

//  Styles 
const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: '#F8FAFF' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  back:        { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  backT:       { fontSize: 18, color: '#1E1B4B' },
  title:       { color: '#1E1B4B', fontSize: 18, fontWeight: '700' },
  heroBox:     { marginHorizontal: 16, marginBottom: 24, backgroundColor: '#1E1B4B', borderRadius: 20, padding: 20 },
  heroTitle:   { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  heroSub:     { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 16 },
  statsRow:    { flexDirection: 'row', alignItems: 'center' },
  stat:        { flex: 1, alignItems: 'center' },
  statV:       { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  statL:       { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
  statDiv:     { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)' },
  section:     { paddingHorizontal: 16, marginBottom: 20 },
  label:       { color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  card:        { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  cardHeader:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardIcon:    { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  cardName:    { color: '#1E1B4B', fontSize: 15, fontWeight: '700' },
  cardProtocol:{ color: '#94A3B8', fontSize: 12, marginTop: 2 },
  apyBadge:    { borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center' },
  apyV:        { fontSize: 18, fontWeight: '700' },
  apyLabel:    { fontSize: 10, fontWeight: '600', marginTop: 1 },
  metaRow:     { flexDirection: 'row', gap: 6, marginBottom: 8 },
  metaPill:    { backgroundColor: '#F1F5F9', borderRadius: 8, paddingVertical: 4, paddingHorizontal: 10 },
  metaT:       { color: '#64748B', fontSize: 11, fontWeight: '500' },
  tagRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag:         { borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  tagT:        { fontSize: 11, fontWeight: '500' },
  expanded:    { marginTop: 14, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 14 },
  expandedDesc:{ color: '#64748B', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  calcBox:     { backgroundColor: '#F8FAFF', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1 },
  calcLabel:   { fontSize: 13, fontWeight: '600', marginBottom: 10 },
  calcInput:   { backgroundColor: '#fff', borderRadius: 10, padding: 12, fontSize: 16, color: '#1E1B4B', borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8 },
  earningsRow: { flexDirection: 'row', gap: 8 },
  earningItem: { flex: 1, backgroundColor: '#fff', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  earningV:    { fontSize: 14, fontWeight: '700' },
  earningL:    { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  depositBtn:  { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  depositBtnT: { color: '#fff', fontSize: 14, fontWeight: '700' },
  disclaimer:  { marginHorizontal: 16, backgroundColor: '#FFFBEB', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#FDE68A' },
  disclaimerT: { color: '#92400E', fontSize: 12, lineHeight: 18 },
})


