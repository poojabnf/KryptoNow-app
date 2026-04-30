import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'
import { useWalletStore } from '../store/walletStore'

// ─── Data ─────────────────────────────────────────────────────────────────────
const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '$4.99',
    period: 'per month',
    savings: '',
    color: '#6366F1',
    popular: false,
  },
  {
    id: 'yearly',
    name: 'Annual',
    price: '$39.99',
    period: 'per year',
    savings: 'Save 33%',
    color: '#7C3AED',
    popular: true,
  },
]

type FeatureAccess = 'free' | 'premium' | 'both'

const FEATURES: { icon: string; title: string; description: string; access: FeatureAccess }[] = [
  { icon: '🔑', title: 'Multi-Wallet Support',   description: 'Manage up to 10 wallets from one app',           access: 'premium' },
  { icon: '📊', title: 'Portfolio Analytics',     description: 'P&L tracking, charts, tax export (CSV)',         access: 'premium' },
  { icon: '🔔', title: 'Price Alerts',            description: 'Set custom price alerts for any token',          access: 'premium' },
  { icon: '⚡', title: 'Priority RPC Nodes',      description: 'Faster transactions via premium node infrastructure', access: 'premium' },
  { icon: '🛡️', title: 'Biometric Lock',          description: 'Face ID & fingerprint wallet security',          access: 'both' },
  { icon: '📋', title: 'Transaction History',     description: 'Full history with search & filter',              access: 'both' },
  { icon: '💱', title: 'Multi-Chain Swap',         description: 'Swap tokens across 5+ chains',                  access: 'both' },
  { icon: '🌐', title: 'WalletConnect v2',         description: 'Connect to any dApp browser',                   access: 'premium' },
  { icon: '📤', title: 'Batch Transactions',       description: 'Send to multiple addresses at once',             access: 'premium' },
  { icon: '🔒', title: 'AES-256-GCM Encryption',  description: 'Military-grade key storage on device',           access: 'both' },
]

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function PremiumScreen() {
  const activeChain  = useWalletStore(s => s.activeChain)
  const [selPlan, setSelPlan]   = useState('yearly')
  const [loading,  setLoading]  = useState(false)
  const [isPremium, setIsPremium] = useState(false)

  async function handlePurchase() {
    setLoading(true)
    // Simulate IAP — replace with expo-iap / react-native-purchases
    await new Promise(r => setTimeout(r, 1800))
    setLoading(false)
    setIsPremium(true)
    Alert.alert(
      '🎉 Welcome to Kryptonow Premium!',
      'All features are now unlocked. Thank you for your support!',
      [{ text: 'Start Exploring', onPress: () => router.back() }]
    )
  }

  const plan = PLANS.find(p => p.id === selPlan)!

  // ── Already premium ───────────────────────────────────────────────────────
  if (isPremium) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 64, marginBottom: 16 }}>⭐</Text>
        <Text style={s.premTitle}>You're Premium!</Text>
        <Text style={s.premSub}>All features unlocked. Thank you for supporting Kryptonow.</Text>
        <TouchableOpacity
          style={[s.mainBtn, { backgroundColor: activeChain.color, marginTop: 32 }]}
          onPress={() => router.back()} activeOpacity={0.85}
        >
          <Text style={s.mainBtnT}>Back to Wallet →</Text>
        </TouchableOpacity>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backT}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Kryptonow Premium</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroEmoji}>⭐</Text>
          <Text style={s.heroTitle}>Unlock the Full Experience</Text>
          <Text style={s.heroSub}>Professional tools for serious crypto users</Text>
        </View>

        {/* Plan cards */}
        <View style={s.planRow}>
          {PLANS.map(p => (
            <TouchableOpacity
              key={p.id}
              style={[s.planCard, selPlan === p.id && { borderColor: p.color, borderWidth: 2 }]}
              onPress={() => setSelPlan(p.id)}
              activeOpacity={0.85}
            >
              {p.popular && (
                <View style={[s.popularBadge, { backgroundColor: p.color }]}>
                  <Text style={s.popularT}>BEST VALUE</Text>
                </View>
              )}
              <Text style={[s.planName, { marginTop: p.popular ? 16 : 0 }]}>{p.name}</Text>
              <Text style={[s.planPrice, { color: p.color }]}>{p.price}</Text>
              <Text style={s.planPeriod}>{p.period}</Text>
              {p.savings !== '' && (
                <View style={[s.savingsBadge, { backgroundColor: p.color + '18' }]}>
                  <Text style={[s.savingsT, { color: p.color }]}>{p.savings}</Text>
                </View>
              )}
              {selPlan === p.id && (
                <View style={[s.checkCircle, { backgroundColor: p.color }]}>
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Feature list */}
        <View style={s.section}>
          <Text style={s.label}>What's Included</Text>
          <View style={s.featureList}>
            {FEATURES.map((f, i) => (
              <View
                key={f.title}
                style={[
                  s.featureRow,
                  i === FEATURES.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={s.featureIconWrap}>
                  <Text style={{ fontSize: 20 }}>{f.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.featureTitle}>{f.title}</Text>
                  <Text style={s.featureDesc}>{f.description}</Text>
                </View>
                <View style={[
                  s.accessBadge,
                  f.access === 'premium'
                    ? { backgroundColor: '#F5F3FF' }
                    : { backgroundColor: '#F0FDF4' },
                ]}>
                  <Text style={[
                    s.accessT,
                    { color: f.access === 'premium' ? '#7C3AED' : '#16A34A' },
                  ]}>
                    {f.access === 'premium' ? '⭐' : '✓'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <View style={s.legend}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: '#7C3AED' }]} />
              <Text style={s.legendT}>⭐ Premium only</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: '#16A34A' }]} />
              <Text style={s.legendT}>✓ Free for everyone</Text>
            </View>
          </View>
        </View>

        {/* Testimonials */}
        <View style={s.section}>
          <Text style={s.label}>Trusted by Users</Text>
          {[
            { name: 'Rahul M.',    text: 'Portfolio analytics alone is worth it. Clean UI!', stars: 5 },
            { name: 'Priya S.',   text: 'Switched from MetaMask. Kryptonow is way more polished.', stars: 5 },
            { name: 'Aditya K.', text: 'Price alerts saved me during the last pump. 🚀',       stars: 5 },
          ].map(t => (
            <View key={t.name} style={s.testimonial}>
              <Text style={s.testimonialStars}>{'★'.repeat(t.stars)}</Text>
              <Text style={s.testimonialText}>"{t.text}"</Text>
              <Text style={s.testimonialName}>— {t.name}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={s.ctaBox}>
        <TouchableOpacity
          style={[s.mainBtn, { backgroundColor: loading ? '#94A3B8' : plan.color }]}
          onPress={handlePurchase}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Text style={s.mainBtnT}>
            {loading ? 'Processing...' : `Start ${plan.name} · ${plan.price}`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Restore', 'No previous purchases found.')} style={{ marginTop: 10 }}>
          <Text style={s.restoreT}>Restore purchases</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#F8FAFF' },
  header:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  back:          { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  backT:         { fontSize: 18, color: '#1E1B4B' },
  title:         { color: '#1E1B4B', fontSize: 18, fontWeight: '700' },
  hero:          { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  heroEmoji:     { fontSize: 52, marginBottom: 12 },
  heroTitle:     { color: '#1E1B4B', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  heroSub:       { color: '#64748B', fontSize: 14, textAlign: 'center' },
  planRow:       { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 28 },
  planCard:      { flex: 1, backgroundColor: '#fff', borderRadius: 18, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', position: 'relative', overflow: 'visible' },
  popularBadge:  { position: 'absolute', top: -12, alignSelf: 'center', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 12 },
  popularT:      { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  planName:      { color: '#64748B', fontSize: 13, marginBottom: 6 },
  planPrice:     { fontSize: 26, fontWeight: '800', marginBottom: 2 },
  planPeriod:    { color: '#94A3B8', fontSize: 12 },
  savingsBadge:  { borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12, marginTop: 10 },
  savingsT:      { fontSize: 12, fontWeight: '700' },
  checkCircle:   { position: 'absolute', top: 12, right: 12, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  section:       { paddingHorizontal: 16, marginBottom: 24 },
  label:         { color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  featureList:   { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  featureRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  featureIconWrap:{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#F8FAFF', alignItems: 'center', justifyContent: 'center' },
  featureTitle:  { color: '#1E1B4B', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  featureDesc:   { color: '#94A3B8', fontSize: 12, lineHeight: 16 },
  accessBadge:   { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  accessT:       { fontSize: 14, fontWeight: '700' },
  legend:        { flexDirection: 'row', gap: 16, marginTop: 12, justifyContent: 'center' },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:     { width: 8, height: 8, borderRadius: 4 },
  legendT:       { color: '#64748B', fontSize: 12 },
  testimonial:   { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  testimonialStars:{ color: '#F59E0B', fontSize: 14, marginBottom: 6 },
  testimonialText:{ color: '#1E1B4B', fontSize: 13, lineHeight: 19, marginBottom: 6 },
  testimonialName:{ color: '#94A3B8', fontSize: 12 },
  ctaBox:        { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#F8FAFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  mainBtn:       { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  mainBtnT:      { color: '#fff', fontSize: 16, fontWeight: '700' },
  restoreT:      { color: '#94A3B8', fontSize: 13, textAlign: 'center' },
  premTitle:     { color: '#1E1B4B', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  premSub:       { color: '#64748B', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
})

