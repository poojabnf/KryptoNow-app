import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Platform, Linking, ActivityIndicator, SafeAreaView,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useSubscription, PRODUCT_PRO, PRODUCT_BUSINESS } from '../context/SubscriptionContext'

// ─── Feature matrix ──────────────────────────────────────────────────────────
const FEATURES = [
  { label: 'Wallet (send, receive, swap)',   free: true,  pro: true,  biz: true  },
  { label: '100+ tokens across 5 chains',   free: true,  pro: true,  biz: true  },
  { label: 'WalletConnect dApp browser',    free: true,  pro: true,  biz: true  },
  { label: 'Account Abstraction (ERC-4337)',free: true,  pro: true,  biz: true  },
  { label: 'Zero swap fee',                 free: false, pro: true,  biz: true  },
  { label: 'Price alerts & notifications',  free: false, pro: true,  biz: true  },
  { label: 'Advanced portfolio analytics',  free: false, pro: true,  biz: true  },
  { label: 'Priority support',              free: false, pro: true,  biz: true  },
  { label: 'Unlimited price history',       free: false, pro: true,  biz: true  },
  { label: 'Batch send (multi-recipient)',  free: false, pro: false, biz: true  },
  { label: 'REST API access',               free: false, pro: false, biz: true  },
  { label: 'White-label SDK',               free: false, pro: false, biz: true  },
  { label: 'Dedicated account manager',     free: false, pro: false, biz: true  },
]

type Tier = { id: string; label: string; price: string; per: string; color: string; gradient: [string, string] }

const TIERS: Tier[] = [
  { id: 'free',     label: 'Free',     price: '$0',     per: 'forever', color: '#64748B', gradient: ['#1E293B','#0F172A'] },
  { id: 'pro',      label: 'Pro',      price: '$4.99',  per: '/ month', color: '#00D4AA', gradient: ['#0D4F46','#0D2E2E'] },
  { id: 'business', label: 'Business', price: '$19.99', per: '/ month', color: '#A78BFA', gradient: ['#2D1B69','#1E1040'] },
]

// ─── Tick / Cross ─────────────────────────────────────────────────────────────
function Check({ ok, color }: { ok: boolean; color: string }) {
  return ok
    ? <Ionicons name="checkmark-circle" size={18} color={color} />
    : <Ionicons name="close-circle"     size={18} color="#334155" />
}

// ─── Tier card ────────────────────────────────────────────────────────────────
function TierCard({
  tier, isActive, isCurrent, onPress, loading,
}: {
  tier: Tier; isActive: boolean; isCurrent: boolean
  onPress: () => void; loading: boolean
}) {
  const scale = useRef(new Animated.Value(1)).current

  function pulse() {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80,  useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start()
  }

  const isPro = tier.id === 'pro'

  return (
    <Animated.View style={[s.cardWrap, isActive && s.cardActive, { transform: [{ scale }] }]}>
      {isPro && (
        <View style={s.popularBadge}>
          <Ionicons name="star" size={11} color="#0D2E2E" />
          <Text style={s.popularT}>MOST POPULAR</Text>
        </View>
      )}
      <LinearGradient colors={tier.gradient} style={s.card}>
        {/* Header */}
        <View style={s.cardHeader}>
          <View style={[s.tierDot, { backgroundColor: tier.color + '22' }]}>
            <Ionicons
              name={tier.id === 'free' ? 'wallet-outline' : tier.id === 'pro' ? 'star' : 'briefcase'}
              size={20} color={tier.color}
            />
          </View>
          <Text style={[s.tierLabel, { color: tier.color }]}>{tier.label}</Text>
        </View>

        {/* Price */}
        <View style={s.priceRow}>
          <Text style={s.price}>{tier.price}</Text>
          <Text style={s.per}>{tier.per}</Text>
        </View>

        {/* CTA */}
        {tier.id === 'free' ? (
          <View style={[s.btn, s.btnFree]}>
            <Text style={s.btnFreeT}>
              {isCurrent ? 'Current Plan' : 'Get Started'}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.btn, { backgroundColor: tier.color }, isCurrent && s.btnCurrent]}
            onPress={() => { pulse(); onPress() }}
            activeOpacity={0.85}
            disabled={loading || isCurrent}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#0D2E2E" />
            ) : (
              <Text style={s.btnT}>
                {isCurrent ? '✓ Active' : `Upgrade to ${tier.label}`}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </LinearGradient>
    </Animated.View>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function SubscriptionScreen() {
  const { tier, isLoading, purchase, restore, openUpgrade } = useSubscription()
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const fadeAnim  = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(30)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start()
  }, [])

  async function handlePurchase(productId: string) {
    if (Platform.OS === 'web') {
      Linking.openURL('https://kryptonow.xyz/upgrade')
      return
    }
    setPurchasing(productId)
    await purchase(productId)
    setPurchasing(null)
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={24} color="#E2E8F0" />
        </TouchableOpacity>
        <Text style={s.headerT}>Plans & Pricing</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

          {/* Hero */}
          <LinearGradient
            colors={['#00D4AA22', '#0D2E2E00']}
            style={s.hero}
          >
            <View style={s.crownWrap}>
              <Ionicons name="star" size={36} color="#00D4AA" />
            </View>
            <Text style={s.heroTitle}>Unlock Full Power</Text>
            <Text style={s.heroSub}>
              Go Pro and swap with zero fees, get price alerts, advanced analytics, and priority support.
            </Text>
          </LinearGradient>

          {/* Tier cards */}
          <View style={s.cards}>
            {TIERS.map(t => (
              <TierCard
                key={t.id}
                tier={t}
                isActive={t.id === tier}
                isCurrent={t.id === tier}
                onPress={() => handlePurchase(
                  t.id === 'pro' ? PRODUCT_PRO : PRODUCT_BUSINESS
                )}
                loading={purchasing === (t.id === 'pro' ? PRODUCT_PRO : PRODUCT_BUSINESS)}
              />
            ))}
          </View>

          {/* Feature comparison */}
          <View style={s.table}>
            <Text style={s.tableTitle}>Everything included</Text>

            {/* Column headers */}
            <View style={s.tableHeader}>
              <Text style={[s.colHead, { flex: 2.5 }]}>Feature</Text>
              <Text style={[s.colHead, { color: '#64748B' }]}>Free</Text>
              <Text style={[s.colHead, { color: '#00D4AA' }]}>Pro</Text>
              <Text style={[s.colHead, { color: '#A78BFA' }]}>Biz</Text>
            </View>

            {FEATURES.map((f, i) => (
              <View key={i} style={[s.row, i % 2 === 0 && s.rowAlt]}>
                <Text style={[s.rowLabel, { flex: 2.5 }]}>{f.label}</Text>
                <View style={s.checkCell}><Check ok={f.free} color="#64748B" /></View>
                <View style={s.checkCell}><Check ok={f.pro}  color="#00D4AA" /></View>
                <View style={s.checkCell}><Check ok={f.biz}  color="#A78BFA" /></View>
              </View>
            ))}
          </View>

          {/* Swap fee note */}
          <View style={s.feeNote}>
            <Ionicons name="information-circle-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
            <Text style={s.feeNoteT}>
              Free users pay a 0.1% platform fee on swaps.{' '}
              <Text style={{ color: '#00D4AA' }}>Pro removes it entirely.</Text>
            </Text>
          </View>

          {/* Restore & ToS */}
          <View style={s.footer}>
            {Platform.OS !== 'web' && (
              <TouchableOpacity onPress={restore} disabled={isLoading}>
                <Text style={s.footerLink}>Restore Purchases</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => Linking.openURL('https://kryptonow.xyz/privacy')}>
              <Text style={s.footerLink}>Privacy Policy</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Linking.openURL('https://kryptonow.xyz/terms')}>
              <Text style={s.footerLink}>Terms of Service</Text>
            </TouchableOpacity>
          </View>

          <Text style={s.legal}>
            Subscriptions auto-renew monthly. Cancel anytime in your App Store / Google Play settings.
            Prices shown in USD.
          </Text>

        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: '#0D2E2E' },
  scroll: { paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#1A3F3F',
  },
  back:    { padding: 6, borderRadius: 10, backgroundColor: '#1A3F3F' },
  headerT: { fontSize: 17, fontWeight: '700', color: '#E2E8F0' },

  hero: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 20,
  },
  crownWrap: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#00D4AA22',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#E2E8F0', marginBottom: 10, textAlign: 'center' },
  heroSub:   { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 21 },

  cards:     { paddingHorizontal: 16, marginTop: 20, gap: 12 },
  cardWrap:  { borderRadius: 18, overflow: 'visible' },
  cardActive:{ shadowColor: '#00D4AA', shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
  card:      { borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#FFFFFF10' },

  popularBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#00D4AA',
    alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, marginBottom: 0,
    position: 'absolute', top: -10, right: 16, zIndex: 10,
  },
  popularT: { fontSize: 10, fontWeight: '800', color: '#0D2E2E', marginLeft: 4 },

  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  tierDot: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  tierLabel: { fontSize: 18, fontWeight: '700' },

  priceRow:  { flexDirection: 'row', alignItems: 'baseline', marginBottom: 18 },
  price:     { fontSize: 32, fontWeight: '800', color: '#F1F5F9' },
  per:       { fontSize: 14, color: '#94A3B8', marginLeft: 6 },

  btn:       { borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  btnFree:   { backgroundColor: '#1E293B' },
  btnFreeT:  { fontSize: 14, fontWeight: '600', color: '#64748B' },
  btnCurrent:{ opacity: 0.7 },
  btnT:      { fontSize: 14, fontWeight: '700', color: '#0D2E2E' },

  table:       { marginHorizontal: 16, marginTop: 28 },
  tableTitle:  { fontSize: 18, fontWeight: '700', color: '#E2E8F0', marginBottom: 16 },
  tableHeader: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#112D2D', borderRadius: 10, marginBottom: 4 },
  colHead:     { flex: 1, fontSize: 12, fontWeight: '700', textAlign: 'center', color: '#94A3B8' },

  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderRadius: 8 },
  rowAlt:    { backgroundColor: '#0A2020' },
  rowLabel:  { fontSize: 13, color: '#CBD5E1', lineHeight: 18 },
  checkCell: { flex: 1, alignItems: 'center' },

  feeNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginTop: 20,
    padding: 14,
    backgroundColor: '#112D2D',
    borderRadius: 12,
  },
  feeNoteT: { flex: 1, fontSize: 12, color: '#94A3B8', lineHeight: 18 },

  footer:     { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 16, marginTop: 24, paddingHorizontal: 16 },
  footerLink: { fontSize: 13, color: '#00D4AA', textDecorationLine: 'underline' },

  legal: { fontSize: 11, color: '#475569', textAlign: 'center', marginHorizontal: 24, marginTop: 16, lineHeight: 16 },
})
