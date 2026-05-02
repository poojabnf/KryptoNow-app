import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Linking } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useWalletStore } from '../store/walletStore'

const FAQS = [
  { q: 'How do I send crypto?', a: 'Tap Send on the dashboard, enter the recipient address and amount, then confirm.' },
  { q: 'How do I receive crypto?', a: 'Tap Receive to see your wallet address and QR code. Share it with the sender.' },
  { q: 'Is my wallet secure?', a: 'Yes. Your private keys are encrypted and stored locally. We never have access to them.' },
  { q: 'What chains are supported?', a: 'Ethereum, Polygon, Arbitrum, Optimism, and BNB Chain.' },
  { q: 'How do I switch networks?', a: 'Tap the chain name (e.g. Ethereum) at the top left of the dashboard.' },
  { q: 'What if I lose my phone?', a: 'Use your recovery phrase to restore your wallet on any device.' },
]

export default function Support() {
  const activeChain = useWalletStore(s => s.activeChain)

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={s.title}>Help & Support</Text>
      </View>

      {/* Contact */}
      <View style={[s.card, { borderColor: activeChain.color + '33' }]}>
        <Text style={s.cardTitle}>Contact Us</Text>
        <TouchableOpacity style={[s.contactBtn, { backgroundColor: activeChain.color }]}
          onPress={() => Linking.openURL('mailto:support@kryptonow.xyz')}>
          <Ionicons name="mail-outline" size={18} color="#fff" />
          <Text style={s.contactBtnText}>support@kryptonow.xyz</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.contactBtn, { backgroundColor: activeChain.color }]}
          onPress={() => Linking.openURL('https://twitter.com/kryptonow')}>
          <Ionicons name="logo-twitter" size={18} color="#fff" />
          <Text style={s.contactBtnText}>@kryptonow</Text>
        </TouchableOpacity>
      </View>

      {/* FAQs */}
      <Text style={s.sectionTitle}>Frequently Asked Questions</Text>
      {FAQS.map((faq, i) => (
        <View key={i} style={[s.faqCard, { borderLeftColor: activeChain.color }]}>
          <Text style={s.faqQ}>{faq.q}</Text>
          <Text style={s.faqA}>{faq.a}</Text>
        </View>
      ))}

      <View style={s.footer}>
        <Text style={s.footerText}>KryptoNow v1.0.0</Text>
        <Text style={s.footerText}>kryptonow.xyz</Text>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F8FAFC' },
  content:      { padding: 16, paddingBottom: 40 },
  header:       { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 },
  backBtn:      { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  title:        { fontSize: 22, fontWeight: '800', color: '#1E1B4B' },
  card:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1 },
  cardTitle:    { fontSize: 16, fontWeight: '700', color: '#1E1B4B', marginBottom: 12 },
  contactBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, marginBottom: 8 },
  contactBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1E1B4B', marginBottom: 12 },
  faqCard:      { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, borderLeftWidth: 3 },
  faqQ:         { fontSize: 14, fontWeight: '700', color: '#1E1B4B', marginBottom: 6 },
  faqA:         { fontSize: 13, color: '#64748B', lineHeight: 20 },
  footer:       { alignItems: 'center', marginTop: 24, gap: 4 },
  footerText:   { color: '#94A3B8', fontSize: 12 },
})