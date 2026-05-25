import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  SafeAreaView,
} from 'react-native'
import { goBack } from '../utils/navigation'
import { useWalletStore } from '../store/walletStore'

// --- Feature list (display only — no purchase flow in v1) -------------------
const FEATURES = [
  { icon: '🔑', title: 'Multi-Wallet Support',    description: 'Manage up to 10 wallets from one app' },
  { icon: '📊', title: 'Portfolio Analytics',      description: 'P&L tracking, charts, tax export (CSV)' },
  { icon: '🔔', title: 'Price Alerts',             description: 'Set custom price alerts for any token' },
  { icon: '⚡', title: 'Priority RPC Nodes',       description: 'Faster transactions via premium node infrastructure' },
  { icon: '🌐', title: 'WalletConnect v2',          description: 'Connect to any dApp seamlessly' },
  { icon: '📤', title: 'Batch Transactions',        description: 'Send to multiple addresses at once' },
  { icon: '🛡️', title: 'Biometric Lock',           description: 'Face ID & Touch ID wallet security' },
  { icon: '🔒', title: 'AES-256-GCM Encryption',   description: 'Military-grade key storage on device' },
]

// --- Screen ------------------------------------------------------------------
export default function PremiumScreen() {
  const activeChain = useWalletStore(s => s.activeChain)

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.back} onPress={() => goBack()} activeOpacity={0.7}>
          <Text style={s.backT}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Kryptonow Premium</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroEmoji}>⭐</Text>
          <Text style={s.heroTitle}>Premium — Coming Soon</Text>
          <Text style={s.heroSub}>
            We're putting the finishing touches on our subscription. Join the waitlist
            and get 3 months free when we launch.
          </Text>
        </View>

        {/* Coming soon badge */}
        <View style={s.comingSoonCard}>
          <Text style={[s.comingSoonLabel, { color: activeChain.color }]}>EARLY ACCESS</Text>
          <Text style={s.comingSoonTitle}>Be the first to know</Text>
          <Text style={s.comingSoonSub}>
            Premium features are in development. All features are currently free for every user.
          </Text>
        </View>

        {/* Feature preview list */}
        <View style={s.section}>
          <Text style={s.label}>What's Coming</Text>
          <View style={s.featureList}>
            {FEATURES.map((f, i) => (
              <View
                key={f.title}
                style={[s.featureRow, i === FEATURES.length - 1 && { borderBottomWidth: 0 }]}
              >
                <View style={s.featureIconWrap}>
                  <Text style={{ fontSize: 20 }}>{f.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.featureTitle}>{f.title}</Text>
                  <Text style={s.featureDesc}>{f.description}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Free notice */}
        <View style={s.freeNotice}>
          <Text style={s.freeNoticeTitle}>All features are free right now</Text>
          <Text style={s.freeNoticeSub}>
            Every feature in Kryptonow is available at no cost during our launch period.
            No account required. No hidden fees.
          </Text>
        </View>

      </ScrollView>

      {/* Sticky CTA */}
      <View style={s.ctaBox}>
        <TouchableOpacity
          style={[s.mainBtn, { backgroundColor: activeChain.color }]}
          onPress={() => goBack()}
          activeOpacity={0.85}
        >
          <Text style={s.mainBtnT}>Back to Wallet</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

// --- Styles -------------------------------------------------------------------
const s = StyleSheet.create({
  safe:              { flex: 1, backgroundColor: '#F8FAFF' },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  back:              { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  backT:             { fontSize: 18, color: '#1E1B4B' },
  title:             { color: '#1E1B4B', fontSize: 18, fontWeight: '700' },
  hero:              { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24 },
  heroEmoji:         { fontSize: 52, marginBottom: 12 },
  heroTitle:         { color: '#1E1B4B', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  heroSub:           { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 22 },
  comingSoonCard:    { marginHorizontal: 16, marginBottom: 28, backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  comingSoonLabel:   { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 8 },
  comingSoonTitle:   { color: '#1E1B4B', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  comingSoonSub:     { color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  section:           { paddingHorizontal: 16, marginBottom: 24 },
  label:             { color: '#64748B', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  featureList:       { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  featureRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  featureIconWrap:   { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F8FAFF', alignItems: 'center', justifyContent: 'center' },
  featureTitle:      { color: '#1E1B4B', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  featureDesc:       { color: '#94A3B8', fontSize: 12, lineHeight: 16 },
  freeNotice:        { marginHorizontal: 16, marginBottom: 24, backgroundColor: '#F0FDF4', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#BBF7D0' },
  freeNoticeTitle:   { color: '#15803D', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  freeNoticeSub:     { color: '#166534', fontSize: 13, lineHeight: 20 },
  ctaBox:            { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#F8FAFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  mainBtn:           { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  mainBtnT:          { color: '#fff', fontSize: 16, fontWeight: '700' },
})

