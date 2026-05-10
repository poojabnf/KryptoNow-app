/**
 * ProGate — wraps any UI that requires a Pro (or Business) subscription.
 * Shows an inline upgrade card instead of the gated content when tier is free.
 */
import React, { ReactNode } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSubscription } from '../context/SubscriptionContext'

type Props = {
  children:  ReactNode
  feature:   string          // e.g. "Price Alerts"
  business?: boolean         // true if Business tier required (default: Pro)
}

export default function ProGate({ children, feature, business = false }: Props) {
  const { isPro, isBusiness, openUpgrade } = useSubscription()

  const hasAccess = business ? isBusiness : isPro
  if (hasAccess) return <>{children}</>

  const requiredTier = business ? 'Business' : 'Pro'
  const price        = business ? '$19.99/mo' : '$4.99/mo'

  return (
    <View style={s.card}>
      <View style={s.iconWrap}>
        <Ionicons name="lock-closed" size={28} color="#00D4AA" />
      </View>
      <Text style={s.title}>{feature}</Text>
      <Text style={s.sub}>
        Unlock <Text style={s.tier}>{requiredTier}</Text> ({price}) to access this feature.
      </Text>
      <TouchableOpacity style={s.btn} onPress={openUpgrade} activeOpacity={0.85}>
        <Ionicons name="star" size={15} color="#0D2E2E" style={{ marginRight: 6 }} />
        <Text style={s.btnT}>Upgrade to {requiredTier}</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  card: {
    margin: 16,
    padding: 24,
    backgroundColor: '#112D2D',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#00D4AA30',
    alignItems: 'center',
  },
  iconWrap: {
    width: 56, height: 56,
    borderRadius: 28,
    backgroundColor: '#00D4AA15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: { fontSize: 17, fontWeight: '700', color: '#E2E8F0', marginBottom: 8 },
  sub:   { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  tier:  { color: '#00D4AA', fontWeight: '700' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D4AA',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnT: { fontSize: 14, fontWeight: '700', color: '#0D2E2E' },
})
