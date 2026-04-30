import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Vibration, Platform,
} from 'react-native'
import { useLockContext } from '../context/LockContext'

const DOTS = 6
const ACCENT = '#6366F1'

type Props = { isSetup?: boolean }

export default function LockScreen({ isSetup = false }: Props) {
  const { biometricAvail, biometricType, biometricUnlock, savePin, verifyPin } = useLockContext()

  const [pin,      setPin]      = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [step,     setStep]     = useState<'enter' | 'confirm'>('enter')
  const [error,    setError]    = useState('')
  const [attempts, setAttempts] = useState(0)

  const shakeAnim = useRef(new Animated.Value(0)).current
  const fadeAnim  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start()
    if (!isSetup && biometricAvail) setTimeout(triggerBiometric, 500)
  }, [])

  async function triggerBiometric() {
    await biometricUnlock()
    // lockState changes in context → layout re-renders automatically
  }

  function shake() {
    Vibration.vibrate(Platform.OS === 'android' ? [0, 50, 50, 50] : 50)
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12,  duration: 50,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 50,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 40,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 40,  useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 30,  useNativeDriver: true }),
    ]).start()
  }

  async function handleDigit(d: string) {
    if (step === 'enter' && pin.length >= DOTS)     return
    if (step === 'confirm' && confirm.length >= DOTS) return

    const newVal = step === 'confirm' ? confirm + d : pin + d
    step === 'confirm' ? setConfirm(newVal) : setPin(newVal)

    if (newVal.length < DOTS) return

    // ── PIN complete ──
    if (isSetup) {
      if (step === 'enter') {
        setTimeout(() => { setStep('confirm'); setError('') }, 200)
        return
      }
      // Confirm step
      if (newVal === pin) {
        await savePin(newVal)
        // context sets lockState → 'unlocked' → layout shows app
      } else {
        shake()
        setError("PINs don't match. Try again.")
        setTimeout(() => { setPin(''); setConfirm(''); setStep('enter'); setError('') }, 900)
      }
    } else {
      const ok = await verifyPin(newVal)
      if (!ok) {
        const att = attempts + 1
        setAttempts(att)
        shake()
        setError(att >= 5 ? 'Too many attempts. Wait 30s.' : 'Wrong PIN. Try again.')
        setTimeout(() => { setPin(''); setError('') }, 700)
      }
      // if ok → context sets 'unlocked' → layout switches automatically
    }
  }

  function handleDelete() {
    setError('')
    step === 'confirm' ? setConfirm(c => c.slice(0, -1)) : setPin(p => p.slice(0, -1))
  }

  const current = step === 'confirm' ? confirm : pin

  const KEYS = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['bio','0','del'],
  ]

  return (
    <Animated.View style={[s.container, { opacity: fadeAnim }]}>
      <View style={s.logoWrap}>
        <View style={s.logoCircle}>
          <Text style={s.logoText}>V</Text>
        </View>
        <Text style={s.appName}>Kryptonow</Text>
        <Text style={s.subtitle}>
          {isSetup
            ? (step === 'enter' ? 'Create a 6-digit PIN' : 'Confirm your PIN')
            : 'Enter your PIN to unlock'}
        </Text>
      </View>

      <Animated.View style={[s.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: DOTS }).map((_, i) => (
          <View key={i} style={[s.dot, i < current.length ? s.dotFilled : s.dotEmpty]} />
        ))}
      </Animated.View>

      {error
        ? <Text style={s.error}>{error}</Text>
        : <View style={{ height: 34 }} />
      }

      <View style={s.keypad}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={s.keyRow}>
            {row.map(key => {
              if (key === 'bio') return (
                <TouchableOpacity key="bio" style={s.keyBtn}
                  onPress={triggerBiometric}
                  disabled={isSetup || !biometricAvail}
                  activeOpacity={0.65}>
                  {(!isSetup && biometricAvail)
                    ? <Text style={{ fontSize: 28 }}>{biometricType === 'Face ID' ? '👤' : '👆'}</Text>
                    : <View />}
                </TouchableOpacity>
              )
              if (key === 'del') return (
                <TouchableOpacity key="del" style={s.keyBtn} onPress={handleDelete} activeOpacity={0.65}>
                  <Text style={s.keyDelIcon}>⌫</Text>
                </TouchableOpacity>
              )
              return (
                <TouchableOpacity key={key} style={s.keyBtn}
                  onPress={() => handleDigit(key)} activeOpacity={0.65}>
                  <Text style={s.keyNum}>{key}</Text>
                </TouchableOpacity>
              )
            })}
          </View>
        ))}
      </View>

      {!isSetup && biometricAvail && (
        <TouchableOpacity style={{ marginTop: 8 }} onPress={triggerBiometric}>
          <Text style={{ color: ACCENT, fontSize: 14, fontWeight: '600' }}>
            Use {biometricType} instead
          </Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  )
}

const s = StyleSheet.create({
  container:  { flex:1, backgroundColor:'#0F0E1A', alignItems:'center', justifyContent:'center', paddingBottom:40 },
  logoWrap:   { alignItems:'center', marginBottom:44 },
  logoCircle: { width:72, height:72, borderRadius:36, backgroundColor:ACCENT, alignItems:'center', justifyContent:'center', marginBottom:14, shadowColor:ACCENT, shadowOffset:{width:0,height:8}, shadowOpacity:0.5, shadowRadius:20, elevation:10 },
  logoText:   { color:'#fff', fontSize:36, fontWeight:'800' },
  appName:    { color:'#fff', fontSize:26, fontWeight:'800', letterSpacing:-0.5, marginBottom:8 },
  subtitle:   { color:'#94A3B8', fontSize:14 },
  dotsRow:    { flexDirection:'row', gap:16, marginBottom:8 },
  dot:        { width:16, height:16, borderRadius:8 },
  dotFilled:  { backgroundColor:ACCENT, shadowColor:ACCENT, shadowOffset:{width:0,height:0}, shadowOpacity:0.8, shadowRadius:6 },
  dotEmpty:   { backgroundColor:'#2D2B3D', borderWidth:1.5, borderColor:'#3D3B52' },
  error:      { color:'#EF4444', fontSize:13, marginBottom:16, textAlign:'center', height:34 },
  keypad:     { gap:12, marginBottom:20 },
  keyRow:     { flexDirection:'row', gap:20 },
  keyBtn:     { width:76, height:76, borderRadius:38, backgroundColor:'#1E1C2E', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'#2D2B3D' },
  keyNum:     { color:'#fff', fontSize:26, fontWeight:'300' },
  keyDelIcon: { color:'#94A3B8', fontSize:22 },
})

