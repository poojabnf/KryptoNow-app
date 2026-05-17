import { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  Animated, Platform,
} from 'react-native'
import { useLockContext } from '../context/LockContext'
import { useTheme } from '../context/ThemeContext'
import { useWalletStore } from '../store/walletStore'

const PINPAD = [
  ['1','2','3'],
  ['4','5','6'],
  ['7','8','9'],
  ['','0','<'],
]

export default function LockScreen({ isSetup = false }: { isSetup?: boolean }) {
  const { theme } = useTheme()
  const { savePin, unlock } = useLockContext()
  const addr = useWalletStore(s => s.address)

  const [pin,     setPin]     = useState('')
  const [confirm, setConfirm] = useState('')
  const [step,    setStep]    = useState<'enter' | 'confirm'>(isSetup ? 'enter' : 'enter')
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState(false)

  const shakeAnim = useRef(new Animated.Value(0)).current
  const fadeAnim  = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start()
  }, [])

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12,  duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 30, useNativeDriver: true }),
    ]).start()
  }

  function handlePress(key: string) {
    setError('')
    if (key === '<') {
      if (isSetup && step === 'enter') setPin(p => p.slice(0, -1))
      else if (isSetup && step === 'confirm') setConfirm(c => c.slice(0, -1))
      else setPin(p => p.slice(0, -1))
      return
    }
    if (key === '') return

    if (isSetup) {
      if (step === 'enter') {
        const next = pin + key
        setPin(next)
        if (next.length === 6) setStep('confirm')
      } else {
        const next = confirm + key
        setConfirm(next)
        if (next.length === 6) {
          if (next === pin) {
            savePin(next)
            setSuccess(true)
          } else {
            shake()
            setError('PINs do not match. Try again.')
            setConfirm('')
            setPin('')
            setStep('enter')
          }
        }
      }
    } else {
      const next = pin + key
      setPin(next)
      if (next.length === 6) {
        unlock(next).then(ok => {
          if (!ok) {
            shake()
            setError('Incorrect PIN. Try again.')
            setPin('')
          }
        })
      }
    }
  }

  const currentPin = isSetup ? (step === 'enter' ? pin : confirm) : pin
  const short = addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : ''

  return (
    <Animated.View style={[st.c, { backgroundColor: theme.bgApp, opacity: fadeAnim }]}>
      {/* Header */}
      <View style={st.top}>
        <View style={[st.avatar, { backgroundColor: theme.accent + '20' }]}>
          <Text style={[st.avatarT, { color: theme.accent }]}>
            {addr ? addr.slice(2, 4).toUpperCase() : 'KN'}
          </Text>
        </View>
        <Text style={[st.walletName, { color: theme.textPrimary }]}>Kryptonow Wallet</Text>
        <Text style={[st.walletAddr, { color: theme.textMuted }]}>{short}</Text>
      </View>

      {/* Title */}
      <Text style={[st.title, { color: theme.textPrimary }]}>
        {isSetup
          ? step === 'enter' ? 'Create PIN' : 'Confirm PIN'
          : 'Enter PIN'}
      </Text>
      <Text style={[st.sub, { color: theme.textMuted }]}>
        {isSetup
          ? step === 'enter'
            ? 'Choose a 6-digit PIN to secure your wallet'
            : 'Re-enter your PIN to confirm'
          : 'Enter your 6-digit PIN to unlock'}
      </Text>

      {/* PIN Dots */}
      <Animated.View style={[st.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
        {Array.from({ length: 6 }).map((_, i) => (
          <View
            key={i}
            style={[
              st.dot,
              {
                backgroundColor: i < currentPin.length ? theme.accent : 'transparent',
                borderColor: i < currentPin.length ? theme.accent : theme.border,
              }
            ]}
          />
        ))}
      </Animated.View>

      {/* Error */}
      {error ? (
        <Text style={[st.error, { color: theme.error }]}>{error}</Text>
      ) : (
        <View style={{ height: 20 }} />
      )}

      {/* Success */}
      {success && (
        <Text style={[st.success, { color: theme.success }]}>PIN set successfully!</Text>
      )}

      {/* PIN Pad */}
      <View style={st.pad}>
        {PINPAD.map((row, ri) => (
          <View key={ri} style={st.padRow}>
            {row.map((key, ki) => (
              <TouchableOpacity
                key={ki}
                style={[
                  st.key,
                  {
                    backgroundColor: key === '' ? 'transparent' : theme.bgCard,
                    borderColor: key === '' ? 'transparent' : theme.border,
                  }
                ]}
                onPress={() => handlePress(key)}
                activeOpacity={key === '' ? 1 : 0.7}
                disabled={key === ''}
              >
                <Text style={[
                  st.keyT,
                  {
                    color: key === '<' ? theme.error : theme.textPrimary,
                    fontSize: key === '<' ? 20 : 24,
                  }
                ]}>
                  {key}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </Animated.View>
  )
}

const st = StyleSheet.create({
  c:          { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  top:        { alignItems: 'center', marginBottom: 32 },
  avatar:     { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarT:    { fontSize: 22, fontWeight: '800' },
  walletName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  walletAddr: { fontSize: 12 },
  title:      { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  sub:        { fontSize: 13, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
  dotsRow:    { flexDirection: 'row', gap: 16, marginBottom: 12 },
  dot:        { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  error:      { fontSize: 13, fontWeight: '500', marginBottom: 8, textAlign: 'center' },
  success:    { fontSize: 13, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  pad:        { width: '100%', maxWidth: 280, gap: 12, marginTop: 16 },
  padRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  key:        { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  keyT:       { fontWeight: '600' },
})
