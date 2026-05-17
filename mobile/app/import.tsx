import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { goBack } from '../utils/navigation'
import { useWalletStore } from '../store/walletStore'
import { validateMnemonic, deriveWallet } from '../utils/crypto'
import { saveWalletKeys } from '../store/keyStore'

export default function Import() {
  const [phrase,   setPhrase]   = useState('')
  const [importing, setImporting] = useState(false)
  const words    = phrase.trim() === '' ? 0 : phrase.trim().split(/\s+/).length
  const isValid  = validateMnemonic(phrase)   // real BIP-39 checksum validation
  const hasWords = words === 12 || words === 24

  // Show word count status
  const wordStatus = (): { text: string; color: string } => {
    if (phrase.trim() === '') return { text: '0 words', color: '#CBD5E1' }
    if (!hasWords)            return { text: `${words} words`, color: '#F59E0B' }
    if (!isValid)             return { text: `${words} words - invalid checksum`, color: '#EF4444' }
    return { text: `${words} words - valid OK`, color: '#10B981' }
  }

  async function doImport() {
    if (!isValid) {
      Alert.alert(
        'Invalid Phrase',
        'The seed phrase is not valid. Check for typos or missing words.',
        [{ text: 'OK' }]
      )
      return
    }

    setImporting(true)
    try {
      const trimmed = phrase.trim().toLowerCase().replace(/\s+/g, ' ')
      const wallet  = deriveWallet(trimmed)

      // Store private key + mnemonic in Secure Enclave
      await saveWalletKeys(wallet.privateKey, trimmed)

      useWalletStore.getState().setWallet({ address: wallet.address, phrase: '' })

      router.replace('/dashboard')
    } catch (e: any) {
      Alert.alert(
        'Import Failed',
        e?.message ?? 'Could not import wallet. Please check your phrase and try again.',
        [{ text: 'OK' }]
      )
    } finally {
      setImporting(false)
    }
  }

  const status = wordStatus()

  return (
    <KeyboardAvoidingView
      style={s.c}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => goBack()}>
          <Text style={s.backT}>←</Text>
        </TouchableOpacity>
      </View>

      <View style={s.body}>
        <Text style={s.title}>Import Wallet</Text>
        <Text style={s.sub}>
          Enter your 12 or 24 word seed phrase, separated by spaces. Words are validated against the BIP-39 word list.
        </Text>

        <View style={s.note}>
          <Text style={s.nt}>🔒  Your phrase never leaves this device.</Text>
        </View>

        <View style={[
          s.inputCard,
          isValid && s.inputValid,
          hasWords && !isValid && s.inputError,
        ]}>
          <TextInput
            style={s.input}
            value={phrase}
            onChangeText={setPhrase}
            placeholder="word1 word2 word3 ..."
            placeholderTextColor="#CBD5E1"
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            secureTextEntry={false}
          />
          <View style={s.foot}>
            <Text style={[s.wc, { color: status.color }]}>{status.text}</Text>
          </View>
        </View>

        {/* Security explainer */}
        <View style={s.secCard}>
          <Text style={s.secTitle}>🔐 Where is my key stored?</Text>
          <Text style={s.secDesc}>
            Your private key is derived from this phrase and stored exclusively in your device's Secure Enclave - iOS Keychain or Android Keystore. It never touches our servers.
          </Text>
        </View>
      </View>

      <View style={s.bot}>
        <TouchableOpacity
          style={[s.bp, (!isValid || importing) && s.dis]}
          disabled={!isValid || importing}
          onPress={doImport}
        >
          {importing
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.bpt}>Import Wallet →</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  c:          { flex:1, backgroundColor:'#F8FAFF' },
  hdr:        { paddingHorizontal:20, paddingTop:60, paddingBottom:12 },
  back:       { width:38, height:38, borderRadius:12, backgroundColor:'#fff', borderWidth:1, borderColor:'#E2E8F0', alignItems:'center', justifyContent:'center' },
  backT:      { color:'#6366F1', fontSize:18 },
  body:       { flex:1, paddingHorizontal:24 },
  title:      { fontSize:28, fontWeight:'700', color:'#1E1B4B', letterSpacing:-0.5, marginBottom:10 },
  sub:        { fontSize:14, color:'#64748B', lineHeight:22, marginBottom:20 },
  note:       { backgroundColor:'#F0FDF4', borderWidth:1, borderColor:'#86EFAC', borderRadius:12, padding:13, marginBottom:20 },
  nt:         { color:'#166534', fontSize:13 },
  inputCard:  { backgroundColor:'#fff', borderRadius:18, borderWidth:1.5, borderColor:'#E2E8F0', overflow:'hidden' },
  inputValid: { borderColor:'#6366F1' },
  inputError: { borderColor:'#EF4444' },
  input:      { color:'#1E1B4B', fontSize:15, padding:18, minHeight:160, textAlignVertical:'top', lineHeight:26 },
  foot:       { paddingHorizontal:18, paddingBottom:14 },
  wc:         { fontSize:13, fontWeight:'500' },
  secCard:    { backgroundColor:'#EEF2FF', borderRadius:14, borderWidth:1, borderColor:'#C7D2FE', padding:16, marginTop:16 },
  secTitle:   { color:'#4338CA', fontSize:13, fontWeight:'700', marginBottom:6 },
  secDesc:    { color:'#4338CA', fontSize:13, lineHeight:20 },
  bot:        { padding:24, paddingBottom:40, backgroundColor:'#fff', borderTopWidth:1, borderTopColor:'#F1F5F9' },
  bp:         { backgroundColor:'#6366F1', paddingVertical:18, borderRadius:16, alignItems:'center', shadowColor:'#6366F1', shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:12, elevation:6 },
  dis:        { opacity:0.4 },
  bpt:        { color:'#fff', fontSize:16, fontWeight:'600' },
})
