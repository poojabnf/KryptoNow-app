import "react-native-get-random-values"
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, TextInput, Platform } from "react-native"
import { router } from "expo-router"
import { useAuth } from "@clerk/expo"
import { useState } from "react"
import * as Clipboard from "expo-clipboard"
import { ethers } from "ethers"
import { useWalletStore } from "../store/walletStore"
import { savePrivateKey } from "../store/keyStore"

const TEAL   = "#0D2E2E"
const ACCENT = "#00D4AA"

type Step = "choice" | "create_show" | "import_input"

export default function Create() {
  const { signOut } = useAuth()
  const [step,         setStep]         = useState<Step>("choice")
  const [wallet,       setWallet]       = useState<ethers.Wallet | null>(null)
  const [imported,     setImported]     = useState("")
  const [copied,       setCopied]       = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [importError,  setImportError]  = useState("")
  const [enclaveError, setEnclaveError] = useState("")

  const handleGenerate = () => {
    try {
      const w = ethers.Wallet.createRandom()
      setWallet(w)
      setStep("create_show")
    } catch (e: any) {
      setEnclaveError(e?.message ?? "Failed to generate wallet")
    }
  }

  const handleCopyPhrase = async () => {
    const phrase = wallet?.mnemonic?.phrase ?? ""
    await Clipboard.setStringAsync(phrase)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveWallet = async (phrase: string) => {
    setLoading(true)
    setEnclaveError("")
    try {
      const w       = ethers.Wallet.fromPhrase(phrase)
      const address = w.address
      const privKey = w.privateKey

      // Save private key to secure storage
      await savePrivateKey(privKey)

      // Save address + profile to localStorage (web) or AsyncStorage (native)
      if (Platform.OS === "web") {
        // Write both formats so all auth code paths find the wallet
        localStorage.setItem("kryptonow_address", address)
        localStorage.setItem("kryptonow_wallet",  JSON.stringify({ address, phrase: "" }))
        localStorage.setItem("kryptonow_vault",   privKey)
        localStorage.setItem("kryptonow_profile", JSON.stringify({ onboarded: true }))
      } else {
        const AS = require("@react-native-async-storage/async-storage").default
        await AS.setItem("kryptonow_address", address)
        await AS.setItem("kryptonow_wallet",  JSON.stringify({ address, phrase: "" }))
        await AS.setItem("kryptonow_profile", JSON.stringify({ onboarded: true }))
      }

      // Update wallet store
      useWalletStore.getState().setWallet({ address, phrase: "" })

      router.replace("/dashboard")
    } catch (e: any) {
      setEnclaveError(e?.message ?? "Unexpected error saving wallet.")
    } finally {
      setLoading(false)
    }
  }

  const handleImportConfirm = () => {
    const phrase = imported.trim().replace(/\s+/g, " ")
    const words  = phrase.split(" ")
    if (words.length !== 12 && words.length !== 24) {
      setImportError("Please enter a valid 12 or 24 word phrase.")
      return
    }
    setImportError("")
    handleSaveWallet(phrase)
  }

  // --- Loading ---
  if (loading) return (
    <View style={s.centered}>
      <ActivityIndicator size="large" color={ACCENT} />
      <Text style={s.loadingT}>Setting up your wallet...</Text>
    </View>
  )

  // --- Choice ---
  if (step === "choice") return (
    <View style={s.c}>
      <Text style={s.title}>Your Web3 Wallet</Text>
      <Text style={s.sub}>Create a new wallet or import an existing one using your seed phrase.</Text>
      {enclaveError ? <Text style={s.errorT}>{enclaveError}</Text> : null}
      <TouchableOpacity style={s.btn} onPress={handleGenerate} activeOpacity={0.85}>
        <Text style={s.btnT}>Create New Wallet</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.btnOutline} onPress={() => setStep("import_input")} activeOpacity={0.85}>
        <Text style={s.btnOutlineT}>Import Existing Wallet</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.logoutBtn} onPress={async () => {
        await signOut()
        router.replace("/(auth)/sign-in")
      }}>
        <Text style={s.logoutT}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  )

  // --- Show Seed Phrase ---
  if (step === "create_show") {
    const phrase = wallet?.mnemonic?.phrase ?? ""
    const words  = phrase.split(" ").filter(Boolean)
    return (
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Your Seed Phrase</Text>
        <Text style={s.sub}>Write these words down in order and store them safely offline.</Text>
        <View style={s.warningBox}>
          <Text style={s.warningT}>[!] Never share these words. Anyone with them controls your funds.</Text>
        </View>
        <View style={s.phraseGrid}>
          {words.map((word, i) => (
            <View key={i} style={s.wordBox}>
              <Text style={s.wordNum}>{i + 1}</Text>
              <Text style={s.wordT}>{word}</Text>
            </View>
          ))}
        </View>
        {enclaveError ? <Text style={s.errorT}>{enclaveError}</Text> : null}
        <TouchableOpacity style={s.copyBtn} onPress={handleCopyPhrase} activeOpacity={0.8}>
          <Text style={s.copyBtnT}>{copied ? "[OK] Copied!" : "Copy Phrase"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={() => handleSaveWallet(phrase)} activeOpacity={0.85}>
          <Text style={s.btnT}>I have saved it  Continue</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.logoutBtn} onPress={() => setStep("choice")}>
          <Text style={s.logoutT}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  // --- Import ---
  if (step === "import_input") return (
    <ScrollView contentContainerStyle={s.scroll}>
      <Text style={s.title}>Import Wallet</Text>
      <Text style={s.sub}>Enter your 12 or 24-word seed phrase separated by spaces.</Text>
      <TextInput
        style={s.input}
        multiline
        placeholder="word1 word2 word3 ..."
        placeholderTextColor="#4A7A7A"
        value={imported}
        onChangeText={setImported}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {importError  ? <Text style={s.errorT}>{importError}</Text>  : null}
      {enclaveError ? <Text style={s.errorT}>{enclaveError}</Text> : null}
      <TouchableOpacity style={s.btn} onPress={handleImportConfirm} activeOpacity={0.85}>
        <Text style={s.btnT}>Import Wallet</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.logoutBtn} onPress={() => setStep("choice")}>
        <Text style={s.logoutT}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  )

  return null
}

const s = StyleSheet.create({
  c:           { flex:1, backgroundColor:TEAL, alignItems:"center", justifyContent:"center", padding:24 },
  centered:    { flex:1, backgroundColor:TEAL, alignItems:"center", justifyContent:"center" },
  scroll:      { flexGrow:1, backgroundColor:TEAL, padding:24, paddingTop:60 },
  title:       { fontSize:26, fontWeight:"800", color:"#FFFFFF", textAlign:"center", marginBottom:8 },
  sub:         { fontSize:14, color:"#A0C4C4", textAlign:"center", marginBottom:32, lineHeight:20 },
  warningBox:  { backgroundColor:"#1A1A2E", borderWidth:1, borderColor:"#FF6B35", borderRadius:10, padding:14, marginBottom:20 },
  warningT:    { color:"#FF6B35", fontSize:13, lineHeight:18 },
  phraseGrid:  { flexDirection:"row", flexWrap:"wrap", gap:8, marginBottom:24, justifyContent:"center" },
  wordBox:     { backgroundColor:"#0A2020", borderRadius:8, padding:10, flexDirection:"row", alignItems:"center", gap:6, width:"30%" },
  wordNum:     { fontSize:10, color:ACCENT, fontWeight:"700", minWidth:16 },
  wordT:       { fontSize:13, color:"#FFFFFF", fontWeight:"600" },
  btn:         { backgroundColor:ACCENT, borderRadius:14, paddingVertical:16, alignItems:"center", marginBottom:12 },
  btnT:        { color:"#0D2E2E", fontSize:16, fontWeight:"700" },
  btnOutline:  { borderWidth:1.5, borderColor:ACCENT, borderRadius:14, paddingVertical:16, alignItems:"center", marginBottom:12 },
  btnOutlineT: { color:ACCENT, fontSize:16, fontWeight:"600" },
  copyBtn:     { backgroundColor:"#0A2020", borderRadius:14, paddingVertical:14, alignItems:"center", marginBottom:12, borderWidth:1, borderColor:ACCENT },
  copyBtnT:    { color:ACCENT, fontSize:15, fontWeight:"600" },
  logoutBtn:   { paddingVertical:12, alignItems:"center", marginTop:8 },
  logoutT:     { color:"#4A7A7A", fontSize:14 },
  input:       { backgroundColor:"#0A2020", borderRadius:12, borderWidth:1.5, borderColor:"#1A4A4A", color:"#FFFFFF", fontSize:15, padding:16, minHeight:120, textAlignVertical:"top", marginBottom:12 },
  errorT:      { color:"#FF6B35", fontSize:13, marginBottom:12, textAlign:"center" },
  loadingT:    { color:ACCENT, marginTop:16, fontSize:15 },
})