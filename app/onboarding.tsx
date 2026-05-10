import AsyncStorage from '@react-native-async-storage/async-storage'
import React, { useState, useRef, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Easing, KeyboardAvoidingView,
  Platform, StatusBar, FlatList, Modal,
} from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'

// ─── Country data ─────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code:'IN', name:'India',          flag:'🇮🇳', docs:['Aadhaar Card','PAN Card','Passport','Voter ID'] },
  { code:'US', name:'United States',  flag:'🇺🇸', docs:['Passport','Driver\'s License','State ID'] },
  { code:'GB', name:'United Kingdom', flag:'🇬🇧', docs:['Passport','Driver\'s License','National ID'] },
  { code:'DE', name:'Germany',        flag:'🇩🇪', docs:['Passport','National ID','Driver\'s License'] },
  { code:'FR', name:'France',         flag:'🇫🇷', docs:['Passport','National ID','Driver\'s License'] },
  { code:'SG', name:'Singapore',      flag:'🇸🇬', docs:['Passport','NRIC','Driver\'s License'] },
  { code:'AE', name:'UAE',            flag:'🇦🇪', docs:['Passport','Emirates ID'] },
  { code:'AU', name:'Australia',      flag:'🇦🇺', docs:['Passport','Driver\'s License','Medicare Card'] },
  { code:'CA', name:'Canada',         flag:'🇨🇦', docs:['Passport','Driver\'s License','Health Card'] },
  { code:'JP', name:'Japan',          flag:'🇯🇵', docs:['Passport','My Number Card','Driver\'s License'] },
  { code:'KR', name:'South Korea',    flag:'🇰🇷', docs:['Passport','Resident Registration Card'] },
  { code:'BR', name:'Brazil',         flag:'🇧🇷', docs:['Passport','CPF','RG'] },
  { code:'MX', name:'Mexico',         flag:'🇲🇽', docs:['Passport','INE','CURP'] },
  { code:'ZA', name:'South Africa',   flag:'🇿🇦', docs:['Passport','Smart ID Card'] },
  { code:'NG', name:'Nigeria',        flag:'🇳🇬', docs:['Passport','NIN','Driver\'s License'] },
  { code:'PK', name:'Pakistan',       flag:'🇵🇰', docs:['Passport','CNIC'] },
  { code:'BD', name:'Bangladesh',     flag:'🇧🇩', docs:['Passport','NID Card'] },
  { code:'PH', name:'Philippines',    flag:'🇵🇭', docs:['Passport','PhilSys ID','Driver\'s License'] },
  { code:'ID', name:'Indonesia',      flag:'🇮🇩', docs:['Passport','KTP','SIM'] },
  { code:'TR', name:'Turkey',         flag:'🇹🇷', docs:['Passport','Turkish ID'] },
  { code:'OTHER', name:'Other',       flag:'🌍', docs:['Passport'] },
]

const CHAINS = [
  { id: 1,     name: 'Ethereum',  symbol: 'ETH',  color: '#627EEA' },
  { id: 137,   name: 'Polygon',   symbol: 'MATIC', color: '#8247E5' },
  { id: 56,    name: 'BNB Chain', symbol: 'BNB',  color: '#F0B90B' },
  { id: 42161, name: 'Arbitrum',  symbol: 'ARB',  color: '#2D374B' },
  { id: 10,    name: 'Optimism',  symbol: 'OP',   color: '#FF0420' },
]

const CURRENCIES = ['USD','EUR','GBP','INR','JPY','AED','AUD','CAD','SGD']

// Steps: 1=Name, 2=Country, 3=Referral(optional), 4=Chain+Currency, 5=KYC(optional)
type Step = 1|2|3|4|5
const TOTAL_STEPS = 5

// ─── Country Picker Modal ─────────────────────────────────────────────────────
function CountryPicker({ visible, onSelect, onClose }: {
  visible: boolean
  onSelect: (c: typeof COUNTRIES[0]) => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const filtered  = useMemo(
    () => COUNTRIES.filter(c => c.name.toLowerCase().includes(q.toLowerCase())),
    [q]
  )
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={{ flex:1, backgroundColor:'#fff' }}>
        <View style={cp.header}>
          <Text style={cp.title}>Select Country</Text>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color="#374151" /></TouchableOpacity>
        </View>
        <View style={cp.searchWrap}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginRight:8 }} />
          <TextInput style={cp.search} value={q} onChangeText={setQ}
            placeholder="Search country..." placeholderTextColor="#9CA3AF" autoFocus />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={i => i.code}
          renderItem={({ item }) => (
            <TouchableOpacity style={cp.row} onPress={() => { onSelect(item); onClose() }} activeOpacity={0.7}>
              <Text style={cp.flag}>{item.flag}</Text>
              <Text style={cp.name}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </Modal>
  )
}
const cp = StyleSheet.create({
  header:     { flexDirection:'row', justifyContent:'space-between', alignItems:'center', paddingHorizontal:20, paddingVertical:16, borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  title:      { fontSize:18, fontWeight:'700', color:'#111827' },
  searchWrap: { flexDirection:'row', alignItems:'center', marginHorizontal:16, marginVertical:12, backgroundColor:'#F9FAFB', borderRadius:12, borderWidth:1, borderColor:'#E5E7EB', paddingHorizontal:14, paddingVertical:10 },
  search:     { flex:1, fontSize:15, color:'#111827' },
  row:        { flexDirection:'row', alignItems:'center', paddingHorizontal:20, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  flag:       { fontSize:24, marginRight:14 },
  name:       { flex:1, fontSize:15, fontWeight:'500', color:'#111827' },
})

// ─── Main Onboarding ──────────────────────────────────────────────────────────
export default function Onboarding() {
  const { user, updateProfile } = useAuth()
  const [step,          setStep]         = useState<Step>(1)
  const [firstName,     setFirstName]    = useState(user?.firstName ?? '')
  const [lastName,      setLastName]     = useState(user?.lastName ?? '')
  const [country,       setCountry]      = useState<typeof COUNTRIES[0] | null>(null)
  const [referralInput, setReferralInput]= useState('')
  const [chainId,       setChainId]      = useState(1)
  const [currency,      setCurrency]     = useState('USD')
  const [countryModal,  setCountryModal] = useState(false)

  const slideAnim    = useRef(new Animated.Value(0)).current
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current

  function animateToStep(next: Step) {
    Animated.parallel([
      Animated.timing(slideAnim,    { toValue: -30, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: next / TOTAL_STEPS, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: false }),
    ]).start(() => {
      setStep(next); slideAnim.setValue(30)
      Animated.timing(slideAnim, { toValue: 0, duration: 280, easing: Easing.out(Easing.exp), useNativeDriver: true }).start()
    })
  }

  function goBack() { if (step > 1) animateToStep((step - 1) as Step) }

  async function handleFinish() {
    await updateProfile({
      firstName, lastName,
      name: `${firstName} ${lastName}`.trim(),
      country: country?.code ?? '',
      appliedCode: referralInput.trim().toUpperCase(),
      defaultChain: chainId,
      currency,
      onboarded: true,
    })
    // Send referral application to backend (best-effort)
    if (referralInput.trim()) {
      fetch(`${process.env.EXPO_PUBLIC_API_URL ?? ''}/api/referral/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: referralInput.trim().toUpperCase() }),
      }).catch(() => {})
    }
    router.replace('/dashboard')
  }

  const progressWidth  = progressAnim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] })
  const contentOpacity = slideAnim.interpolate({ inputRange: [-30,0,30], outputRange: [0,1,0] })

  const canProceedStep1 = firstName.trim().length > 0 && lastName.trim().length > 0
  const canProceedStep2 = country !== null

  return (
    <LinearGradient colors={['#EEF2FF','#F5F3FF','#FDF4FF']} style={{ flex:1 }}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={s.safe}>
        <CountryPicker visible={countryModal} onSelect={setCountry} onClose={() => setCountryModal(false)} />
        <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':undefined}>
          {/* Progress */}
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: progressWidth }]} />
          </View>

          {/* Step header */}
          <View style={s.stepRow}>
            <TouchableOpacity onPress={goBack} disabled={step === 1} style={[s.backBtn, step === 1 && { opacity: 0 }]}>
              <Ionicons name="chevron-back" size={20} color="#6366F1" />
              <Text style={s.backLink}>Back</Text>
            </TouchableOpacity>
            <Text style={s.stepText}>Step {step} of {TOTAL_STEPS}</Text>
            {/* Skip on optional steps (3 = referral, 5 = KYC) */}
            {(step === 3 || step === 5) ? (
              <TouchableOpacity onPress={step === 5 ? handleFinish : () => animateToStep((step + 1) as Step)}>
                <Text style={s.skipLink}>Skip</Text>
              </TouchableOpacity>
            ) : <View style={{ width: 60 }} />}
          </View>

          <Animated.View style={[s.content, { opacity: contentOpacity, transform: [{ translateY: slideAnim }] }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* STEP 1 — Name */}
              {step === 1 && (
                <View style={s.stepContent}>
                  <Text style={s.stepEmoji}>👋</Text>
                  <Text style={s.title}>What's your name?</Text>
                  <Text style={s.sub}>Used for your profile and support tickets.</Text>
                  <Text style={s.fieldLabel}>First Name <Text style={s.req}>*</Text></Text>
                  <View style={s.inputWrap}>
                    <TextInput style={s.input} value={firstName} onChangeText={setFirstName}
                      placeholder="e.g. Sanjay" placeholderTextColor="#A5B4FC" autoFocus maxLength={40} />
                  </View>
                  <Text style={s.fieldLabel}>Last Name <Text style={s.req}>*</Text></Text>
                  <View style={s.inputWrap}>
                    <TextInput style={s.input} value={lastName} onChangeText={setLastName}
                      placeholder="e.g. Kumar" placeholderTextColor="#A5B4FC" maxLength={40}
                      returnKeyType="next" />
                  </View>
                  <Text style={s.hint}>Both fields are required</Text>
                </View>
              )}

              {/* STEP 2 — Country */}
              {step === 2 && (
                <View style={s.stepContent}>
                  <Text style={s.stepEmoji}>🌍</Text>
                  <Text style={s.title}>Where are you from?</Text>
                  <Text style={s.sub}>Required for KYC compliance and regulatory purposes.</Text>
                  <Text style={s.fieldLabel}>Country <Text style={s.req}>*</Text></Text>
                  <TouchableOpacity style={s.countryBtn} onPress={() => setCountryModal(true)} activeOpacity={0.8}>
                    {country ? (
                      <View style={s.countrySelected}>
                        <Text style={s.countryFlag}>{country.flag}</Text>
                        <Text style={s.countryName}>{country.name}</Text>
                      </View>
                    ) : (
                      <Text style={s.countryPlaceholder}>Tap to select your country</Text>
                    )}
                    <Ionicons name="chevron-down" size={18} color="#A5B4FC" />
                  </TouchableOpacity>
                  {country && (
                    <View style={s.docNote}>
                      <Ionicons name="information-circle-outline" size={15} color="#6366F1" />
                      <Text style={s.docNoteT}>
                        Accepted documents: {country.docs.join(', ')}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* STEP 3 — Referral (optional) */}
              {step === 3 && (
                <View style={s.stepContent}>
                  <Text style={s.stepEmoji}>🎁</Text>
                  <Text style={s.title}>Referral Code</Text>
                  <Text style={s.sub}>
                    Got a referral code? Enter it to get{' '}
                    <Text style={{ color:'#6366F1', fontWeight:'700' }}>₹100 bonus</Text> in your account.
                  </Text>
                  <Text style={s.fieldLabel}>Referral Code <Text style={s.opt}>(optional)</Text></Text>
                  <View style={s.inputWrap}>
                    <TextInput style={s.input} value={referralInput} onChangeText={setReferralInput}
                      placeholder="e.g. KRYPTO-ABCD1234" placeholderTextColor="#A5B4FC"
                      autoCapitalize="characters" maxLength={20} />
                  </View>
                  <View style={s.rewardNote}>
                    <Ionicons name="gift-outline" size={20} color="#059669" />
                    <View style={{ flex:1 }}>
                      <Text style={s.rewardNoteTitle}>Referral Rewards</Text>
                      <Text style={s.rewardNoteSub}>You get ₹100 · Your friend gets ₹150 when you complete verification</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* STEP 4 — Chain + Currency */}
              {step === 4 && (
                <View style={s.stepContent}>
                  <Text style={s.stepEmoji}>⛓️</Text>
                  <Text style={s.title}>Default Network</Text>
                  <Text style={s.sub}>You can switch chains anytime from the dashboard.</Text>
                  <View style={s.chainList}>
                    {CHAINS.map(ch => (
                      <TouchableOpacity key={ch.id}
                        style={[s.chainRow, chainId===ch.id && { borderColor: ch.color, backgroundColor: ch.color+'18' }]}
                        onPress={() => setChainId(ch.id)} activeOpacity={0.8}>
                        <View style={[s.chainDot, { backgroundColor: ch.color }]} />
                        <View style={{ flex:1 }}>
                          <Text style={s.chainName}>{ch.name}</Text>
                          <Text style={s.chainSym}>{ch.symbol}</Text>
                        </View>
                        {chainId===ch.id && <Ionicons name="checkmark-circle" size={20} color={ch.color} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[s.fieldLabel, { marginTop:20 }]}>Display Currency</Text>
                  <View style={s.currencyWrap}>
                    {CURRENCIES.map(c => (
                      <TouchableOpacity key={c} style={[s.currencyBtn, currency===c && s.currencySelected]}
                        onPress={() => setCurrency(c)} activeOpacity={0.8}>
                        <Text style={[s.currencyT, currency===c && s.currencySelectedT]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* STEP 5 — KYC intro (optional) */}
              {step === 5 && (
                <View style={s.stepContent}>
                  <Text style={s.stepEmoji}>🪪</Text>
                  <Text style={s.title}>Verify Your Identity</Text>
                  <Text style={s.sub}>
                    KYC is <Text style={{ fontWeight:'700' }}>optional now</Text> but required to withdraw or deposit fiat.
                  </Text>
                  {country && (
                    <View style={s.kycCountryBadge}>
                      <Text style={s.kycCountryFlag}>{country.flag}</Text>
                      <Text style={s.kycCountryText}>{country.name} — accepted documents:</Text>
                    </View>
                  )}
                  {country && country.docs.map(doc => (
                    <View key={doc} style={s.kycDocRow}>
                      <Ionicons name="document-text-outline" size={18} color="#6366F1" />
                      <Text style={s.kycDocT}>{doc}</Text>
                    </View>
                  ))}
                  <TouchableOpacity style={s.kycStartBtn}
                    onPress={async () => { await handleFinish(); router.push('/kyc') }}
                    activeOpacity={0.85}>
                    <LinearGradient colors={['#4F46E5','#6366F1']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.kycStartGrad}>
                      <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                      <Text style={s.kycStartT}>Start KYC Verification</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                  <View style={s.retentionNote}>
                    <Ionicons name="lock-closed-outline" size={13} color="#9CA3AF" />
                    <Text style={s.retentionNoteT}>
                      KYC records are securely retained for 10 years per regulatory requirements.
                    </Text>
                  </View>
                </View>
              )}

            </ScrollView>
          </Animated.View>

          {/* CTA */}
          <View style={s.btnWrap}>
            {step < TOTAL_STEPS ? (
              <TouchableOpacity
                style={[s.btnPrimaryWrap, (step===1&&!canProceedStep1)||(step===2&&!canProceedStep2) ? { opacity:0.45 } : {}]}
                onPress={() => {
                  if (step===1 && !canProceedStep1) return
                  if (step===2 && !canProceedStep2) return
                  animateToStep((step+1) as Step)
                }}
                activeOpacity={0.88}
                disabled={(step===1&&!canProceedStep1)||(step===2&&!canProceedStep2)}
              >
                <LinearGradient colors={['#4F46E5','#6366F1']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.btnPrimary}>
                  <Text style={s.btnPrimaryT}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft:8 }} />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.btnPrimaryWrap} onPress={handleFinish} activeOpacity={0.88}>
                <LinearGradient colors={['#059669','#10B981']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.btnPrimary}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" style={{ marginRight:8 }} />
                  <Text style={s.btnPrimaryT}>Launch KryptoNow</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  )
}

const s = StyleSheet.create({
  safe:             { flex:1, paddingHorizontal:24 },
  progressTrack:    { height:4, backgroundColor:'#E0E7FF', borderRadius:2, marginBottom:16, overflow:'hidden' },
  progressFill:     { height:4, backgroundColor:'#6366F1', borderRadius:2 },
  stepRow:          { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  stepText:         { fontSize:12, color:'#A5B4FC', fontWeight:'600' },
  backBtn:          { flexDirection:'row', alignItems:'center', gap:2 },
  backLink:         { fontSize:13, color:'#6366F1', fontWeight:'600' },
  skipLink:         { fontSize:13, color:'#9CA3AF', fontWeight:'600' },
  content:          { flex:1 },
  stepContent:      { paddingTop:12, paddingBottom:24 },
  stepEmoji:        { fontSize:48, marginBottom:14, textAlign:'center' },
  title:            { fontSize:28, fontWeight:'800', color:'#1E1B4B', textAlign:'center', marginBottom:8, lineHeight:35 },
  sub:              { fontSize:14, color:'#6B7280', textAlign:'center', lineHeight:21, marginBottom:24 },
  fieldLabel:       { fontSize:13, fontWeight:'700', color:'#374151', marginBottom:8, marginTop:4 },
  req:              { color:'#EF4444' },
  opt:              { color:'#9CA3AF', fontWeight:'400' },
  inputWrap:        { backgroundColor:'#fff', borderRadius:14, borderWidth:1.5, borderColor:'#DDD6FE', marginBottom:14, paddingHorizontal:18 },
  input:            { fontSize:17, fontWeight:'600', color:'#1E1B4B', paddingVertical:14 },
  hint:             { fontSize:12, color:'#A5B4FC', textAlign:'center' },
  countryBtn:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#fff', borderRadius:14, borderWidth:1.5, borderColor:'#DDD6FE', paddingHorizontal:18, paddingVertical:16, marginBottom:14 },
  countrySelected:  { flexDirection:'row', alignItems:'center', gap:12 },
  countryFlag:      { fontSize:24 },
  countryName:      { fontSize:16, fontWeight:'700', color:'#1E1B4B' },
  countryPlaceholder:{ fontSize:15, color:'#A5B4FC', fontWeight:'500' },
  docNote:          { flexDirection:'row', alignItems:'flex-start', gap:8, backgroundColor:'#EEF2FF', borderRadius:12, padding:12 },
  docNoteT:         { flex:1, fontSize:12, color:'#4F46E5', lineHeight:18 },
  rewardNote:       { flexDirection:'row', alignItems:'flex-start', gap:12, backgroundColor:'#ECFDF5', borderRadius:14, padding:16, borderWidth:1, borderColor:'#A7F3D0', marginTop:8 },
  rewardNoteTitle:  { fontSize:14, fontWeight:'700', color:'#059669', marginBottom:2 },
  rewardNoteSub:    { fontSize:12, color:'#065F46', lineHeight:17 },
  chainList:        { gap:10 },
  chainRow:         { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:14, borderWidth:1.5, borderColor:'#E0E7FF', padding:14, gap:12 },
  chainDot:         { width:10, height:10, borderRadius:5 },
  chainName:        { fontSize:15, fontWeight:'700', color:'#1E1B4B' },
  chainSym:         { fontSize:12, color:'#9CA3AF', marginTop:1 },
  currencyWrap:     { flexDirection:'row', flexWrap:'wrap', gap:10, marginTop:8 },
  currencyBtn:      { paddingVertical:10, paddingHorizontal:18, borderRadius:12, backgroundColor:'#fff', borderWidth:1.5, borderColor:'#E0E7FF' },
  currencySelected: { backgroundColor:'#EEF2FF', borderColor:'#6366F1' },
  currencyT:        { fontSize:14, fontWeight:'700', color:'#6B7280' },
  currencySelectedT:{ color:'#6366F1' },
  kycCountryBadge:  { flexDirection:'row', alignItems:'center', gap:10, marginBottom:14 },
  kycCountryFlag:   { fontSize:24 },
  kycCountryText:   { fontSize:13, color:'#374151', fontWeight:'600' },
  kycDocRow:        { flexDirection:'row', alignItems:'center', gap:10, paddingVertical:10, borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  kycDocT:          { fontSize:14, color:'#374151' },
  kycStartBtn:      { marginTop:24, borderRadius:16, overflow:'hidden', shadowColor:'#4F46E5', shadowOpacity:0.25, shadowRadius:12, shadowOffset:{width:0,height:4}, elevation:6 },
  kycStartGrad:     { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, paddingVertical:16 },
  kycStartT:        { color:'#fff', fontSize:16, fontWeight:'700' },
  retentionNote:    { flexDirection:'row', alignItems:'flex-start', gap:8, marginTop:16, padding:12, backgroundColor:'#F9FAFB', borderRadius:12 },
  retentionNoteT:   { flex:1, fontSize:11, color:'#9CA3AF', lineHeight:17 },
  btnWrap:          { paddingBottom:8, paddingTop:12 },
  btnPrimaryWrap:   { borderRadius:16, overflow:'hidden', shadowColor:'#6366F1', shadowOffset:{width:0,height:6}, shadowOpacity:0.3, shadowRadius:14, elevation:8 },
  btnPrimary:       { flexDirection:'row', alignItems:'center', justifyContent:'center', paddingVertical:17, borderRadius:16 },
  btnPrimaryT:      { color:'#fff', fontSize:16, fontWeight:'700', letterSpacing:0.2 },
})
