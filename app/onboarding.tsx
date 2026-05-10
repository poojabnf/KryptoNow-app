import { useState, useRef, useMemo } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Easing, KeyboardAvoidingView,
  Platform, FlatList, Modal,
} from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../context/AuthContext'

// ─── Country data ─────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code:'IN',    name:'India',          flag:'🇮🇳', docs:['Aadhaar Card','PAN Card','Passport','Voter ID'] },
  { code:'US',    name:'United States',  flag:'🇺🇸', docs:['Passport','Driver\'s License','State ID'] },
  { code:'GB',    name:'United Kingdom', flag:'🇬🇧', docs:['Passport','Driver\'s License','National ID'] },
  { code:'DE',    name:'Germany',        flag:'🇩🇪', docs:['Passport','National ID','Driver\'s License'] },
  { code:'FR',    name:'France',         flag:'🇫🇷', docs:['Passport','National ID','Driver\'s License'] },
  { code:'SG',    name:'Singapore',      flag:'🇸🇬', docs:['Passport','NRIC','Driver\'s License'] },
  { code:'AE',    name:'UAE',            flag:'🇦🇪', docs:['Passport','Emirates ID'] },
  { code:'AU',    name:'Australia',      flag:'🇦🇺', docs:['Passport','Driver\'s License','Medicare Card'] },
  { code:'CA',    name:'Canada',         flag:'🇨🇦', docs:['Passport','Driver\'s License','Health Card'] },
  { code:'JP',    name:'Japan',          flag:'🇯🇵', docs:['Passport','My Number Card','Driver\'s License'] },
  { code:'KR',    name:'South Korea',    flag:'🇰🇷', docs:['Passport','Resident Registration Card'] },
  { code:'BR',    name:'Brazil',         flag:'🇧🇷', docs:['Passport','CPF','RG'] },
  { code:'MX',    name:'Mexico',         flag:'🇲🇽', docs:['Passport','INE','CURP'] },
  { code:'ZA',    name:'South Africa',   flag:'🇿🇦', docs:['Passport','Smart ID Card'] },
  { code:'NG',    name:'Nigeria',        flag:'🇳🇬', docs:['Passport','NIN','Driver\'s License'] },
  { code:'PK',    name:'Pakistan',       flag:'🇵🇰', docs:['Passport','CNIC'] },
  { code:'BD',    name:'Bangladesh',     flag:'🇧🇩', docs:['Passport','NID Card'] },
  { code:'PH',    name:'Philippines',    flag:'🇵🇭', docs:['Passport','PhilSys ID','Driver\'s License'] },
  { code:'ID',    name:'Indonesia',      flag:'🇮🇩', docs:['Passport','KTP','SIM'] },
  { code:'TR',    name:'Turkey',         flag:'🇹🇷', docs:['Passport','Turkish ID'] },
  { code:'OTHER', name:'Other',          flag:'🌍', docs:['Passport'] },
]

const CHAINS = [
  { id: 1,     name: 'Ethereum',  symbol: 'ETH',   color: '#627EEA' },
  { id: 137,   name: 'Polygon',   symbol: 'MATIC',  color: '#8247E5' },
  { id: 56,    name: 'BNB Chain', symbol: 'BNB',   color: '#F0B90B' },
  { id: 42161, name: 'Arbitrum',  symbol: 'ARB',   color: '#2D374B' },
  { id: 10,    name: 'Optimism',  symbol: 'OP',    color: '#FF0420' },
]

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AED', 'AUD', 'CAD', 'SGD']

type Step = 1 | 2 | 3 | 4 | 5
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
  const insets = useSafeAreaInsets()

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[cp.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={cp.header}>
          <Text style={cp.title}>Select Country</Text>
          <TouchableOpacity onPress={onClose} style={cp.closeBtn}>
            <Ionicons name="close" size={22} color="#374151" />
          </TouchableOpacity>
        </View>
        <View style={cp.searchWrap}>
          <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput
            style={cp.search}
            value={q}
            onChangeText={setQ}
            placeholder="Search country..."
            placeholderTextColor="#9CA3AF"
            autoFocus
          />
        </View>
        <FlatList
          data={filtered}
          keyExtractor={i => i.code}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity style={cp.row} onPress={() => { onSelect(item); onClose() }} activeOpacity={0.7}>
              <Text style={cp.flag}>{item.flag}</Text>
              <Text style={cp.name}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  )
}

const cp = StyleSheet.create({
  root:      { flex: 1, backgroundColor: '#fff' },
  header:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title:     { fontSize: 18, fontWeight: '700', color: '#111827' },
  closeBtn:  { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  searchWrap:{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginVertical: 12, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 14, paddingVertical: 10 },
  search:    { flex: 1, fontSize: 15, color: '#111827' },
  row:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  flag:      { fontSize: 24, marginRight: 14 },
  name:      { flex: 1, fontSize: 15, fontWeight: '500', color: '#111827' },
})

// ─── Main Onboarding ──────────────────────────────────────────────────────────
export default function Onboarding() {
  const { user, updateProfile } = useAuth()
  const insets = useSafeAreaInsets()

  const [step,          setStep]          = useState<Step>(1)
  const [firstName,     setFirstName]     = useState(user?.firstName ?? '')
  const [lastName,      setLastName]      = useState(user?.lastName ?? '')
  const [country,       setCountry]       = useState<typeof COUNTRIES[0] | null>(null)
  const [referralInput, setReferralInput] = useState('')
  const [chainId,       setChainId]       = useState(1)
  const [currency,      setCurrency]      = useState('USD')
  const [countryModal,  setCountryModal]  = useState(false)

  const slideAnim    = useRef(new Animated.Value(0)).current
  const progressAnim = useRef(new Animated.Value(1 / TOTAL_STEPS)).current

  function animateToStep(next: Step) {
    Animated.parallel([
      Animated.timing(slideAnim,    { toValue: -20, duration: 160, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: next / TOTAL_STEPS, duration: 350, easing: Easing.out(Easing.ease), useNativeDriver: false }),
    ]).start(() => {
      setStep(next)
      slideAnim.setValue(20)
      Animated.timing(slideAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.exp), useNativeDriver: true }).start()
    })
  }

  function goBack() { if (step > 1) animateToStep((step - 1) as Step) }

  async function handleFinish() {
    await updateProfile({
      firstName, lastName,
      name:         `${firstName} ${lastName}`.trim(),
      country:      country?.code ?? '',
      appliedCode:  referralInput.trim().toUpperCase(),
      defaultChain: chainId,
      currency,
      onboarded:    true,
    })
    if (referralInput.trim()) {
      fetch(`${process.env.EXPO_PUBLIC_API_URL ?? ''}/api/referral/apply`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: referralInput.trim().toUpperCase() }),
      }).catch(() => {})
    }
    router.replace('/dashboard')
  }

  const progressWidth  = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
  const contentOpacity = slideAnim.interpolate({ inputRange: [-20, 0, 20], outputRange: [0, 1, 0] })
  const canProceedStep1 = firstName.trim().length > 0 && lastName.trim().length > 0
  const canProceedStep2 = country !== null
  const isLastStep      = step === TOTAL_STEPS

  // Bottom padding: safe-area inset + extra breathing room, min 16
  const bottomPad = Math.max(insets.bottom + 8, 20)
  // Top padding: safe-area inset
  const topPad    = Math.max(insets.top, Platform.OS === 'web' ? 24 : 0)

  return (
    <View style={s.root}>
      {/* Gradient background */}
      <LinearGradient colors={['#EEF2FF', '#F5F3FF', '#FDF4FF']} style={StyleSheet.absoluteFill} />

      {/* CountryPicker renders as a Modal above everything */}
      <CountryPicker visible={countryModal} onSelect={setCountry} onClose={() => setCountryModal(false)} />

      {/* Main layout with safe-area padding applied as View padding (not SafeAreaView) */}
      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Centered card for web desktop, full-width on mobile */}
        <View style={[s.card, { paddingTop: topPad, paddingBottom: bottomPad }]}>

          {/* Progress bar */}
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: progressWidth }]} />
          </View>

          {/* Step header row */}
          <View style={s.stepRow}>
            <TouchableOpacity
              onPress={goBack}
              disabled={step === 1}
              style={[s.backBtn, step === 1 && { opacity: 0 }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="chevron-back" size={18} color="#6366F1" />
              <Text style={s.backLink}>Back</Text>
            </TouchableOpacity>

            <Text style={s.stepText}>Step {step} of {TOTAL_STEPS}</Text>

            {step === 3 || step === 5 ? (
              <TouchableOpacity
                onPress={step === 5 ? handleFinish : () => animateToStep((step + 1) as Step)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={s.skipLink}>Skip</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 52 }} />
            )}
          </View>

          {/* Scrollable step content */}
          <Animated.ScrollView
            style={[s.scroll, { opacity: contentOpacity }]}
            contentContainerStyle={s.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
          >
            {/* STEP 1 — Name */}
            {step === 1 && (
              <View style={s.stepContent}>
                <Text style={s.stepEmoji}>👋</Text>
                <Text style={s.title}>What's your name?</Text>
                <Text style={s.sub}>Used for your profile and support tickets.</Text>

                <Text style={s.fieldLabel}>First Name <Text style={s.req}>*</Text></Text>
                <View style={s.inputWrap}>
                  <TextInput
                    style={s.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="e.g. Sanjay"
                    placeholderTextColor="#A5B4FC"
                    autoFocus
                    maxLength={40}
                    returnKeyType="next"
                  />
                </View>

                <Text style={s.fieldLabel}>Last Name <Text style={s.req}>*</Text></Text>
                <View style={s.inputWrap}>
                  <TextInput
                    style={s.input}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="e.g. Kumar"
                    placeholderTextColor="#A5B4FC"
                    maxLength={40}
                    returnKeyType="done"
                  />
                </View>
                <Text style={s.hint}>Both fields are required to continue</Text>
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
                    <Ionicons name="information-circle-outline" size={15} color="#6366F1" style={{ marginTop: 1 }} />
                    <Text style={s.docNoteT}>
                      Accepted KYC documents: <Text style={{ fontWeight: '700' }}>{country.docs.join(', ')}</Text>
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
                  Got a referral code? Enter it below to get a{' '}
                  <Text style={{ color: '#6366F1', fontWeight: '700' }}>₹100 bonus</Text>.
                </Text>

                <Text style={s.fieldLabel}>Referral Code <Text style={s.opt}>(optional)</Text></Text>
                <View style={s.inputWrap}>
                  <TextInput
                    style={s.input}
                    value={referralInput}
                    onChangeText={setReferralInput}
                    placeholder="e.g. KRYPTO-ABCD1234"
                    placeholderTextColor="#A5B4FC"
                    autoCapitalize="characters"
                    maxLength={20}
                  />
                </View>

                <View style={s.rewardNote}>
                  <Ionicons name="gift-outline" size={20} color="#059669" />
                  <View style={{ flex: 1 }}>
                    <Text style={s.rewardNoteTitle}>Referral Rewards</Text>
                    <Text style={s.rewardNoteSub}>
                      You get ₹100 · Your referrer gets ₹150 once you complete KYC verification
                    </Text>
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
                    <TouchableOpacity
                      key={ch.id}
                      style={[s.chainRow, chainId === ch.id && { borderColor: ch.color, backgroundColor: ch.color + '18' }]}
                      onPress={() => setChainId(ch.id)}
                      activeOpacity={0.8}
                    >
                      <View style={[s.chainDot, { backgroundColor: ch.color }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.chainName}>{ch.name}</Text>
                        <Text style={s.chainSym}>{ch.symbol}</Text>
                      </View>
                      {chainId === ch.id && <Ionicons name="checkmark-circle" size={20} color={ch.color} />}
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[s.fieldLabel, { marginTop: 24 }]}>Display Currency</Text>
                <View style={s.currencyWrap}>
                  {CURRENCIES.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[s.currencyBtn, currency === c && s.currencySelected]}
                      onPress={() => setCurrency(c)}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.currencyT, currency === c && s.currencySelectedT]}>{c}</Text>
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
                  KYC is <Text style={{ fontWeight: '700' }}>optional now</Text> — but required before
                  you can deposit or withdraw fiat currency.
                </Text>

                {country && (
                  <>
                    <View style={s.kycCountryBadge}>
                      <Text style={s.kycCountryFlag}>{country.flag}</Text>
                      <Text style={s.kycCountryText}>{country.name} — accepted documents:</Text>
                    </View>
                    {country.docs.map(doc => (
                      <View key={doc} style={s.kycDocRow}>
                        <Ionicons name="document-text-outline" size={17} color="#6366F1" />
                        <Text style={s.kycDocT}>{doc}</Text>
                      </View>
                    ))}
                  </>
                )}

                <TouchableOpacity
                  style={s.kycStartBtn}
                  onPress={async () => { await handleFinish(); router.push('/kyc') }}
                  activeOpacity={0.85}
                >
                  <LinearGradient colors={['#4F46E5', '#6366F1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.kycStartGrad}>
                    <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                    <Text style={s.kycStartT}>Start KYC Verification</Text>
                  </LinearGradient>
                </TouchableOpacity>

                <View style={s.retentionNote}>
                  <Ionicons name="lock-closed-outline" size={13} color="#9CA3AF" style={{ marginTop: 1 }} />
                  <Text style={s.retentionNoteT}>
                    KYC records are securely retained for 10 years per regulatory requirements.
                  </Text>
                </View>
              </View>
            )}
          </Animated.ScrollView>

          {/* Fixed CTA button — always visible at bottom */}
          <View style={s.btnWrap}>
            {!isLastStep ? (
              <TouchableOpacity
                style={[
                  s.btnPrimaryWrap,
                  (step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2) ? { opacity: 0.4 } : {},
                ]}
                onPress={() => {
                  if (step === 1 && !canProceedStep1) return
                  if (step === 2 && !canProceedStep2) return
                  animateToStep((step + 1) as Step)
                }}
                activeOpacity={0.88}
                disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2)}
              >
                <LinearGradient colors={['#4F46E5', '#6366F1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnPrimary}>
                  <Text style={s.btnPrimaryT}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.btnPrimaryWrap} onPress={handleFinish} activeOpacity={0.88}>
                <LinearGradient colors={['#059669', '#10B981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnPrimary}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={s.btnPrimaryT}>Launch KryptoNow</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  // Root fills the full screen; gradient is behind it via absoluteFill
  root:       { flex: 1 },
  kav:        { flex: 1 },

  // On web: center content and cap width; on mobile: full screen
  card:       {
    flex:          1,
    width:         '100%',
    maxWidth:      560,
    alignSelf:     'center',
    paddingHorizontal: 24,
  },

  progressTrack: { height: 4, backgroundColor: '#DDD6FE', borderRadius: 2, marginBottom: 16, overflow: 'hidden' },
  progressFill:  { height: 4, backgroundColor: '#6366F1', borderRadius: 2 },

  stepRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  stepText:   { fontSize: 12, color: '#A5B4FC', fontWeight: '600' },
  backBtn:    { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 52 },
  backLink:   { fontSize: 13, color: '#6366F1', fontWeight: '600' },
  skipLink:   { fontSize: 13, color: '#9CA3AF', fontWeight: '600', textAlign: 'right', minWidth: 52 },

  scroll:      { flex: 1 },
  scrollContent:{ paddingTop: 8, paddingBottom: 16 },

  stepContent: { paddingBottom: 8 },
  stepEmoji:   { fontSize: 44, marginBottom: 12, textAlign: 'center', marginTop: 8 },
  title:       { fontSize: 26, fontWeight: '800', color: '#1E1B4B', textAlign: 'center', marginBottom: 8, lineHeight: 33 },
  sub:         { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  fieldLabel:  { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8, marginTop: 8 },
  req:         { color: '#EF4444' },
  opt:         { color: '#9CA3AF', fontWeight: '400' },
  hint:        { fontSize: 12, color: '#A5B4FC', textAlign: 'center', marginTop: 4 },

  inputWrap:   { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#DDD6FE', marginBottom: 12, paddingHorizontal: 16 },
  input:       { fontSize: 16, fontWeight: '600', color: '#1E1B4B', paddingVertical: 13 },

  countryBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#DDD6FE', paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12 },
  countrySelected:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  countryFlag:       { fontSize: 22 },
  countryName:       { fontSize: 15, fontWeight: '700', color: '#1E1B4B' },
  countryPlaceholder:{ fontSize: 15, color: '#A5B4FC', fontWeight: '500' },
  docNote:           { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EEF2FF', borderRadius: 12, padding: 12 },
  docNoteT:          { flex: 1, fontSize: 12, color: '#4F46E5', lineHeight: 18 },

  rewardNote:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#ECFDF5', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#A7F3D0', marginTop: 8 },
  rewardNoteTitle: { fontSize: 13, fontWeight: '700', color: '#059669', marginBottom: 2 },
  rewardNoteSub:   { fontSize: 12, color: '#065F46', lineHeight: 17 },

  chainList: { gap: 8 },
  chainRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#E0E7FF', padding: 14, gap: 12 },
  chainDot:  { width: 10, height: 10, borderRadius: 5 },
  chainName: { fontSize: 14, fontWeight: '700', color: '#1E1B4B' },
  chainSym:  { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  currencyWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  currencyBtn:      { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E0E7FF' },
  currencySelected: { backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
  currencyT:        { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  currencySelectedT:{ color: '#6366F1' },

  kycCountryBadge: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  kycCountryFlag:  { fontSize: 22 },
  kycCountryText:  { fontSize: 13, color: '#374151', fontWeight: '600' },
  kycDocRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  kycDocT:         { fontSize: 14, color: '#374151' },
  kycStartBtn:     { marginTop: 20, borderRadius: 16, overflow: 'hidden', shadowColor: '#4F46E5', shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  kycStartGrad:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15 },
  kycStartT:       { color: '#fff', fontSize: 15, fontWeight: '700' },
  retentionNote:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 14, padding: 12, backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: 12 },
  retentionNoteT:  { flex: 1, fontSize: 11, color: '#9CA3AF', lineHeight: 17 },

  btnWrap:       { paddingTop: 12 },
  btnPrimaryWrap:{ borderRadius: 16, overflow: 'hidden', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
  btnPrimary:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16 },
  btnPrimaryT:   { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
})
