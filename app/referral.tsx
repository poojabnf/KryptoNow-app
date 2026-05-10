import { useEffect, useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Share, Animated, ActivityIndicator, Platform, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import * as Clipboard from 'expo-clipboard'
import { useAuth } from '../context/AuthContext'
import { useWalletStore } from '../store/walletStore'

const API = process.env.EXPO_PUBLIC_API_URL ?? ''

type Referral = {
  id:        string
  name:      string
  joinedAt:  string
  status:    'pending' | 'rewarded'
  reward:    number
}

function generateLocalCode(address: string): string {
  const hash = Array.from(address.slice(2, 10))
    .map(c => c.charCodeAt(0).toString(36))
    .join('')
    .toUpperCase()
    .slice(0, 8)
  return `KRYPTO-${hash}`
}

export default function ReferralScreen() {
  const { user, updateProfile } = useAuth()
  const address                 = useWalletStore(s => s.address)
  const [copied,    setCopied]  = useState(false)
  const [loading,   setLoading] = useState(true)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [totalEarned, setTotalEarned] = useState(0)
  const [pendingAmt,  setPendingAmt]  = useState(0)
  const fadeAnim  = useRef(new Animated.Value(0)).current

  // Ensure user has a referral code
  const myCode = user?.referralCode || (address ? generateLocalCode(address) : 'KRYPTO-??????')

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start()
    initCode()
    loadStats()
  }, [])

  async function initCode() {
    if (!user?.referralCode && address) {
      const code = generateLocalCode(address)
      await updateProfile({ referralCode: code })
      // Register on backend
      fetch(`${API}/api/referral/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, code }),
      }).catch(() => {})
    }
  }

  async function loadStats() {
    setLoading(true)
    try {
      const res = await fetch(`${API}/api/referral/stats?walletAddress=${address}`)
      if (res.ok) {
        const data = await res.json()
        setReferrals(data.referrals ?? [])
        setTotalEarned(data.totalEarned ?? 0)
        setPendingAmt(data.pending ?? 0)
      }
    } catch {
      // offline — show local data only
    } finally {
      setLoading(false)
    }
  }

  async function copyCode() {
    await Clipboard.setStringAsync(myCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareCode() {
    try {
      await Share.share({
        message: `Join KryptoNow — India's most secure crypto wallet! Use my referral code ${myCode} to sign up and get ₹100 bonus. Download: https://kryptonow.xyz`,
        title:   'KryptoNow Referral',
      })
    } catch {}
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={s.headerT}>Referral</Text>
        <View style={{ width: 38 }} />
      </View>

      <Animated.ScrollView style={{ opacity: fadeAnim }} showsVerticalScrollIndicator={false}>

        {/* Hero banner */}
        <LinearGradient colors={['#4F46E5','#7C3AED','#A855F7']} style={s.hero}>
          <View style={s.heroIcon}>
            <Ionicons name="gift" size={36} color="#fff" />
          </View>
          <Text style={s.heroTitle}>Invite Friends, Earn Together</Text>
          <Text style={s.heroSub}>
            You earn <Text style={{ fontWeight:'800' }}>₹150</Text> for every friend who joins.{'\n'}
            They get <Text style={{ fontWeight:'800' }}>₹100</Text> bonus on signup.
          </Text>
        </LinearGradient>

        {/* Reward cards */}
        <View style={s.rewardRow}>
          <View style={[s.rewardCard, { backgroundColor:'#ECFDF5' }]}>
            <Text style={s.rewardAmt}>₹{totalEarned.toLocaleString('en-IN')}</Text>
            <Text style={s.rewardLabel}>Total Earned</Text>
          </View>
          <View style={[s.rewardCard, { backgroundColor:'#FFF7ED' }]}>
            <Text style={[s.rewardAmt, { color:'#D97706' }]}>₹{pendingAmt.toLocaleString('en-IN')}</Text>
            <Text style={s.rewardLabel}>Pending</Text>
          </View>
          <View style={[s.rewardCard, { backgroundColor:'#EEF2FF' }]}>
            <Text style={[s.rewardAmt, { color:'#4F46E5' }]}>{referrals.filter(r=>r.status==='rewarded').length}</Text>
            <Text style={s.rewardLabel}>Successful</Text>
          </View>
        </View>

        {/* Referral code card */}
        <View style={s.codeCard}>
          <Text style={s.codeLabel}>YOUR REFERRAL CODE</Text>
          <Text style={s.codeText}>{myCode}</Text>
          <View style={s.codeBtnRow}>
            <TouchableOpacity style={s.codeBtn} onPress={copyCode} activeOpacity={0.8}>
              <Ionicons name={copied ? "checkmark" : "copy-outline"} size={17} color="#4F46E5" />
              <Text style={s.codeBtnT}>{copied ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.codeBtn, s.shareBtn]} onPress={shareCode} activeOpacity={0.8}>
              <Ionicons name="share-social-outline" size={17} color="#fff" />
              <Text style={[s.codeBtnT, { color:'#fff' }]}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* How it works */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>How it works</Text>
          {[
            { icon:'share-social-outline', color:'#4F46E5', title:'Share your code', desc:'Send your unique code to friends via any platform' },
            { icon:'person-add-outline',   color:'#059669', title:'Friend signs up',  desc:'They enter your code during onboarding' },
            { icon:'gift-outline',         color:'#D97706', title:'Both get rewarded', desc:'You get ₹150, they get ₹100 after KYC verification' },
          ].map((step, i) => (
            <View key={i} style={s.howRow}>
              <View style={[s.howIcon, { backgroundColor: step.color + '15' }]}>
                <Ionicons name={step.icon as any} size={22} color={step.color} />
              </View>
              <View style={{ flex:1 }}>
                <Text style={s.howTitle}>{step.title}</Text>
                <Text style={s.howDesc}>{step.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Referral list */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your Referrals</Text>
          {loading ? (
            <ActivityIndicator color="#4F46E5" style={{ marginTop:16 }} />
          ) : referrals.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyIcon}>👥</Text>
              <Text style={s.emptyTitle}>No referrals yet</Text>
              <Text style={s.emptySub}>Share your code to start earning</Text>
            </View>
          ) : (
            referrals.map(r => (
              <View key={r.id} style={s.refRow}>
                <View style={s.refAvatar}>
                  <Text style={s.refAvatarT}>{r.name.slice(0,2).toUpperCase()}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={s.refName}>{r.name}</Text>
                  <Text style={s.refDate}>{new Date(r.joinedAt).toLocaleDateString('en-IN')}</Text>
                </View>
                <View style={[s.refBadge, { backgroundColor: r.status==='rewarded' ? '#ECFDF5' : '#FFF7ED' }]}>
                  <Text style={[s.refBadgeT, { color: r.status==='rewarded' ? '#059669' : '#D97706' }]}>
                    {r.status==='rewarded' ? `+₹${r.reward}` : 'Pending'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* T&C */}
        <Text style={s.tc}>
          Rewards are credited after the referred user completes KYC verification. KryptoNow reserves
          the right to modify or cancel the referral programme at any time. Self-referral is not permitted.
        </Text>

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container:   { flex:1, backgroundColor:'#F8FAFF' },
  header:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingTop:Platform.OS==='ios'?56:20, paddingBottom:14, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#F1F5F9' },
  back:        { width:38, height:38, borderRadius:12, backgroundColor:'#F1F5F9', alignItems:'center', justifyContent:'center' },
  headerT:     { fontSize:17, fontWeight:'800', color:'#1E1B4B' },

  hero:        { marginHorizontal:20, marginTop:20, borderRadius:24, padding:28, alignItems:'center' },
  heroIcon:    { width:64, height:64, borderRadius:32, backgroundColor:'rgba(255,255,255,0.2)', alignItems:'center', justifyContent:'center', marginBottom:14 },
  heroTitle:   { fontSize:22, fontWeight:'800', color:'#fff', textAlign:'center', marginBottom:10 },
  heroSub:     { fontSize:14, color:'rgba(255,255,255,0.85)', textAlign:'center', lineHeight:22 },

  rewardRow:   { flexDirection:'row', gap:10, marginHorizontal:20, marginTop:16 },
  rewardCard:  { flex:1, borderRadius:16, padding:14, alignItems:'center' },
  rewardAmt:   { fontSize:20, fontWeight:'800', color:'#059669', marginBottom:4 },
  rewardLabel: { fontSize:11, color:'#6B7280', fontWeight:'600' },

  codeCard:    { marginHorizontal:20, marginTop:16, backgroundColor:'#fff', borderRadius:20, padding:20, borderWidth:1.5, borderColor:'#EEF2FF', alignItems:'center', shadowColor:'#6366F1', shadowOpacity:0.08, shadowRadius:16, shadowOffset:{width:0,height:4}, elevation:3 },
  codeLabel:   { fontSize:11, fontWeight:'700', color:'#A5B4FC', letterSpacing:1, marginBottom:10 },
  codeText:    { fontSize:22, fontWeight:'800', color:'#1E1B4B', letterSpacing:2, marginBottom:16, fontFamily: Platform.OS==='ios'?'Courier':'monospace' },
  codeBtnRow:  { flexDirection:'row', gap:10, width:'100%' },
  codeBtn:     { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, borderRadius:12, borderWidth:1.5, borderColor:'#EEF2FF', paddingVertical:11 },
  shareBtn:    { backgroundColor:'#4F46E5', borderColor:'#4F46E5' },
  codeBtnT:    { fontSize:14, fontWeight:'700', color:'#4F46E5' },

  section:     { marginHorizontal:20, marginTop:24 },
  sectionTitle:{ fontSize:17, fontWeight:'800', color:'#1E1B4B', marginBottom:14 },

  howRow:      { flexDirection:'row', alignItems:'flex-start', gap:14, marginBottom:16 },
  howIcon:     { width:44, height:44, borderRadius:22, alignItems:'center', justifyContent:'center', flexShrink:0 },
  howTitle:    { fontSize:14, fontWeight:'700', color:'#1E1B4B', marginBottom:2 },
  howDesc:     { fontSize:12, color:'#64748B', lineHeight:18 },

  emptyBox:    { backgroundColor:'#fff', borderRadius:16, padding:28, alignItems:'center', borderWidth:1, borderColor:'#E2E8F0' },
  emptyIcon:   { fontSize:36, marginBottom:10 },
  emptyTitle:  { fontSize:15, fontWeight:'700', color:'#1E1B4B', marginBottom:4 },
  emptySub:    { fontSize:13, color:'#94A3B8', textAlign:'center' },

  refRow:      { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:14, padding:14, marginBottom:8, borderWidth:1, borderColor:'#F1F5F9' },
  refAvatar:   { width:40, height:40, borderRadius:20, backgroundColor:'#EEF2FF', alignItems:'center', justifyContent:'center', marginRight:12 },
  refAvatarT:  { fontSize:14, fontWeight:'800', color:'#4F46E5' },
  refName:     { fontSize:14, fontWeight:'700', color:'#1E1B4B' },
  refDate:     { fontSize:12, color:'#94A3B8', marginTop:2 },
  refBadge:    { borderRadius:20, paddingHorizontal:10, paddingVertical:4 },
  refBadgeT:   { fontSize:12, fontWeight:'700' },

  tc:          { marginHorizontal:20, marginTop:20, fontSize:11, color:'#94A3B8', lineHeight:17, textAlign:'center' },
})
