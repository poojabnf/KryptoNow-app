import React, { useState, useRef } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Animated, Easing, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useAuth } from '../context/AuthContext'

const AVATARS = ['fox','wolf','lion','tiger','unicorn','dragon','bolt','crystal','gem','moon','fire','robot']
const EMOJI: Record<string,string> = {
  fox:'', wolf:'', lion:'', tiger:'', unicorn:'', dragon:'',
  bolt:'', crystal:'', gem:'', moon:'', fire:'', robot:'',
}
const CHAINS = [
  { id: 1,     name: 'Ethereum',  symbol: 'ETH',  color: '#627EEA' },
  { id: 137,   name: 'Polygon',   symbol: 'MATIC', color: '#8247E5' },
  { id: 56,    name: 'BNB Chain', symbol: 'BNB',  color: '#F0B90B' },
  { id: 42161, name: 'Arbitrum',  symbol: 'ARB',  color: '#2D374B' },
  { id: 10,    name: 'Optimism',  symbol: 'OP',   color: '#FF0420' },
  { id: 8453,  name: 'Base',      symbol: 'ETH',  color: '#0052FF' },
]
const CURRENCIES = ['USD','EUR','GBP','INR','JPY','AED']
type Step = 1|2|3|4

export default function Onboarding() {
  const { user, updateProfile } = useAuth()
  const [step, setStep]         = useState<Step>(1)
  const [name, setName]         = useState(user?.name ?? '')
  const [avatar, setAvatar]     = useState('fox')
  const [chainId, setChainId]   = useState(1)
  const [currency, setCurrency] = useState('USD')
  const slideAnim    = useRef(new Animated.Value(0)).current
  const progressAnim = useRef(new Animated.Value(0.25)).current

  function animateToStep(next: Step) {
    Animated.parallel([
      Animated.timing(slideAnim,    { toValue: -30, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: next * 0.25, duration: 400, easing: Easing.out(Easing.ease), useNativeDriver: false }),
    ]).start(() => {
      setStep(next); slideAnim.setValue(30)
      Animated.timing(slideAnim, { toValue: 0, duration: 280, easing: Easing.out(Easing.exp), useNativeDriver: true }).start()
    })
  }

  function handleFinish() {
    updateProfile({ name, avatar: EMOJI[avatar] ?? avatar, defaultChain: chainId, currency, onboarded: true })
    router.replace('/dashboard')
  }

  const progressWidth  = progressAnim.interpolate({ inputRange: [0,1], outputRange: ['0%','100%'] })
  const contentOpacity = slideAnim.interpolate({ inputRange: [-30,0,30], outputRange: [0,1,0] })

  return (
    <LinearGradient colors={['#F5F3FF','#EEF2FF','#F0F4FF']} style={{ flex:1 }}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':undefined}>
          <View style={s.progressTrack}>
            <Animated.View style={[s.progressFill, { width: progressWidth }]} />
          </View>
          <View style={s.stepRow}>
            <Text style={s.stepText}>Step {step} of 4</Text>
            {step > 1 && <TouchableOpacity onPress={() => animateToStep((step-1) as Step)}><Text style={s.backLink}>Back</Text></TouchableOpacity>}
          </View>
          <Animated.View style={[s.content, { opacity: contentOpacity, transform: [{ translateY: slideAnim }] }]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {step===1 && (
                <View style={s.stepContent}>
                  <Text style={s.stepEmoji}></Text>
                  <Text style={s.title}>What should we call you?</Text>
                  <Text style={s.sub}>Your display name inside Kypra.</Text>
                  <View style={s.inputWrap}>
                    <TextInput style={s.input} value={name} onChangeText={setName}
                      placeholder="e.g. Sanjay" placeholderTextColor="#A5B4FC" autoFocus maxLength={30} />
                  </View>
                  <Text style={s.hint}>You can change this anytime in settings</Text>
                </View>
              )}
              {step===2 && (
                <View style={s.stepContent}>
                  <Text style={s.stepEmoji}>{EMOJI[avatar]}</Text>
                  <Text style={s.title}>Pick your avatar</Text>
                  <Text style={s.sub}>Choose an emoji that represents you.</Text>
                  <View style={s.avatarGrid}>
                    {AVATARS.map(a => (
                      <TouchableOpacity key={a} style={[s.avatarBtn, avatar===a && s.avatarSelected]} onPress={() => setAvatar(a)} activeOpacity={0.75}>
                        <Text style={s.avatarEmoji}>{EMOJI[a]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              {step===3 && (
                <View style={s.stepContent}>
                  <Text style={s.stepEmoji}></Text>
                  <Text style={s.title}>Default network</Text>
                  <Text style={s.sub}>Switch chains anytime from the dashboard.</Text>
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
                        {chainId===ch.id && <Text style={[s.chainCheck,{color:ch.color}]}>OK</Text>}
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              {step===4 && (
                <View style={s.stepContent}>
                  <Text style={s.stepEmoji}></Text>
                  <Text style={s.title}>Display currency</Text>
                  <Text style={s.sub}>Balances shown in this currency.</Text>
                  <View style={s.currencyWrap}>
                    {CURRENCIES.map(c => (
                      <TouchableOpacity key={c} style={[s.currencyBtn, currency===c && s.currencySelected]} onPress={() => setCurrency(c)} activeOpacity={0.8}>
                        <Text style={[s.currencyT, currency===c && s.currencySelectedT]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={s.summaryCard}>
                    <Text style={s.summaryTitle}>YOUR PROFILE</Text>
                    <View style={s.summaryRow}><Text style={s.summaryLabel}>Name</Text><Text style={s.summaryVal}>{name||'Not set'}</Text></View>
                    <View style={s.summaryRow}><Text style={s.summaryLabel}>Avatar</Text><Text style={s.summaryVal}>{EMOJI[avatar]}</Text></View>
                    <View style={s.summaryRow}><Text style={s.summaryLabel}>Network</Text><Text style={s.summaryVal}>{CHAINS.find(c=>c.id===chainId)?.name}</Text></View>
                    <View style={s.summaryRow}><Text style={s.summaryLabel}>Currency</Text><Text style={s.summaryVal}>{currency}</Text></View>
                  </View>
                </View>
              )}
            </ScrollView>
          </Animated.View>
          <View style={s.btnWrap}>
            {step<4 ? (
              <TouchableOpacity style={[s.btnPrimaryWrap,(step===1&&!name.trim())&&{opacity:0.45}]}
                onPress={() => { if(step===1&&!name.trim()) return; animateToStep((step+1) as Step) }}
                activeOpacity={0.88} disabled={step===1&&!name.trim()}>
                <LinearGradient colors={['#7C3AED','#6366F1']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.btnPrimary}>
                  <Text style={s.btnPrimaryT}>Continue</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.btnPrimaryWrap} onPress={handleFinish} activeOpacity={0.88}>
                <LinearGradient colors={['#059669','#10B981']} start={{x:0,y:0}} end={{x:1,y:0}} style={s.btnPrimary}>
                  <Text style={s.btnPrimaryT}>Launch Kypra</Text>
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
  progressTrack:    { height:3, backgroundColor:'#E0E7FF', borderRadius:2, marginBottom:16, overflow:'hidden' },
  progressFill:     { height:3, backgroundColor:'#6366F1', borderRadius:2 },
  stepRow:          { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
  stepText:         { fontSize:12, color:'#A5B4FC', fontWeight:'600' },
  backLink:         { fontSize:13, color:'#6366F1', fontWeight:'600' },
  content:          { flex:1 },
  stepContent:      { paddingTop:16, paddingBottom:24 },
  stepEmoji:        { fontSize:52, marginBottom:16, textAlign:'center' },
  title:            { fontSize:32, fontWeight:'800', color:'#1E1B4B', textAlign:'center', marginBottom:8, lineHeight:38 },
  sub:              { fontSize:14.5, color:'#6B7280', textAlign:'center', lineHeight:21, marginBottom:28 },
  inputWrap:        { backgroundColor:'#fff', borderRadius:16, borderWidth:1.5, borderColor:'#DDD6FE', marginBottom:10, paddingHorizontal:20 },
  input:            { fontSize:18, fontWeight:'600', color:'#1E1B4B', paddingVertical:16 },
  hint:             { fontSize:12, color:'#A5B4FC', textAlign:'center' },
  avatarGrid:       { flexDirection:'row', flexWrap:'wrap', gap:10, justifyContent:'center' },
  avatarBtn:        { width:56, height:56, borderRadius:16, backgroundColor:'#fff', borderWidth:1.5, borderColor:'#E0E7FF', alignItems:'center', justifyContent:'center' },
  avatarSelected:   { borderColor:'#6366F1', backgroundColor:'#EEF2FF' },
  avatarEmoji:      { fontSize:26 },
  chainList:        { gap:10 },
  chainRow:         { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:14, borderWidth:1.5, borderColor:'#E0E7FF', padding:14, gap:12 },
  chainDot:         { width:10, height:10, borderRadius:5 },
  chainName:        { fontSize:15, fontWeight:'700', color:'#1E1B4B' },
  chainSym:         { fontSize:12, color:'#9CA3AF', marginTop:1 },
  chainCheck:       { fontSize:14, fontWeight:'800' },
  currencyWrap:     { flexDirection:'row', flexWrap:'wrap', gap:10, justifyContent:'center', marginBottom:24 },
  currencyBtn:      { paddingVertical:12, paddingHorizontal:20, borderRadius:12, backgroundColor:'#fff', borderWidth:1.5, borderColor:'#E0E7FF' },
  currencySelected: { backgroundColor:'#EEF2FF', borderColor:'#6366F1' },
  currencyT:        { fontSize:15, fontWeight:'700', color:'#6B7280' },
  currencySelectedT:{ color:'#6366F1' },
  summaryCard:      { backgroundColor:'#fff', borderRadius:16, borderWidth:1.5, borderColor:'#E0E7FF', padding:16, gap:10 },
  summaryTitle:     { fontSize:12, fontWeight:'700', color:'#A5B4FC', marginBottom:4 },
  summaryRow:       { flexDirection:'row', justifyContent:'space-between' },
  summaryLabel:     { fontSize:14, color:'#9CA3AF' },
  summaryVal:       { fontSize:14, fontWeight:'600', color:'#1E1B4B' },
  btnWrap:          { paddingBottom:8, paddingTop:12 },
  btnPrimaryWrap:   { borderRadius:18, overflow:'hidden', elevation:8, ...Platform.select({ web:{ boxShadow:'0px 6px 14px rgba(99,102,241,0.3)' }, default:{ shadowColor:'#6366F1', shadowOffset:{width:0,height:6}, shadowOpacity:0.3, shadowRadius:14 } }) },
  btnPrimary:       { paddingVertical:18, alignItems:'center', borderRadius:18 },
  btnPrimaryT:      { color:'#fff', fontSize:16.5, fontWeight:'700', letterSpacing:0.2 },
})
