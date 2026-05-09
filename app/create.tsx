import "react-native-get-random-values"
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  ScrollView, TextInput, Platform, Animated, Dimensions,
} from "react-native"
import { router } from "expo-router"
import { useAuth } from "@clerk/expo"
import { useState, useRef, useEffect } from "react"
import * as Clipboard from "expo-clipboard"
import { ethers } from "ethers"
import { Ionicons } from "@expo/vector-icons"
import { useWalletStore } from "../store/walletStore"
import { savePrivateKey } from "../store/keyStore"

const { width } = Dimensions.get("window")
const TEAL   = "#0D2E2E"
const ACCENT = "#00D4AA"
const BLUE   = "#00B8FF"
const CARD   = "rgba(255,255,255,0.97)"

type Step = "choice" | "create_show" | "import_input"

function useFadeSlide() {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(32)).current
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,     { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(translateY,  { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start()
  }, [])
  return { opacity, transform: [{ translateY }] }
}

// ─── Choice Screen ────────────────────────────────────────────────────────────
function ChoiceScreen({
  onCreate, onImport, onSignOut, error,
}: {
  onCreate: () => void
  onImport: () => void
  onSignOut: () => void
  error: string
}) {
  const anim = useFadeSlide()
  const logoAnim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.spring(logoAnim, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }).start()
  }, [])

  return (
    <View style={c.bg}>
      {/* Background decoration */}
      <View style={c.circle1} />
      <View style={c.circle2} />
      <View style={c.circle3} />

      <ScrollView contentContainerStyle={c.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <Animated.View style={[c.hero, { opacity: logoAnim, transform: [{ scale: logoAnim }] }]}>
          <View style={c.iconRing}>
            <View style={c.iconInner}>
              <Text style={c.iconK}>K</Text>
            </View>
          </View>
          <Text style={c.heroTitle}>Your Web3 Wallet</Text>
          <Text style={c.heroSub}>Secure, self-custodial, and fully yours</Text>
        </Animated.View>

        {/* Feature badges */}
        <Animated.View style={[c.badgeRow, anim]}>
          {[
            { icon: "shield-checkmark-outline" as const, label: "Non-custodial" },
            { icon: "lock-closed-outline" as const,      label: "E2E Encrypted" },
            { icon: "eye-off-outline" as const,          label: "Private" },
          ].map(b => (
            <View key={b.label} style={c.badge}>
              <Ionicons name={b.icon} size={12} color={ACCENT} />
              <Text style={c.badgeT}>{b.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Cards */}
        <Animated.View style={anim}>
          {/* Create card */}
          <TouchableOpacity style={c.optionCard} onPress={onCreate} activeOpacity={0.88}>
            <View style={[c.optionIconWrap, { backgroundColor: ACCENT + "20" }]}>
              <Ionicons name="add-circle-outline" size={28} color={ACCENT} />
            </View>
            <View style={c.optionMid}>
              <Text style={c.optionTitle}>Create New Wallet</Text>
              <Text style={c.optionSub}>Generate a fresh wallet with a new seed phrase</Text>
            </View>
            <View style={[c.optionArrow, { backgroundColor: ACCENT }]}>
              <Ionicons name="arrow-forward" size={16} color={TEAL} />
            </View>
          </TouchableOpacity>

          {/* Import card */}
          <TouchableOpacity style={c.optionCard} onPress={onImport} activeOpacity={0.88}>
            <View style={[c.optionIconWrap, { backgroundColor: BLUE + "20" }]}>
              <Ionicons name="download-outline" size={28} color={BLUE} />
            </View>
            <View style={c.optionMid}>
              <Text style={c.optionTitle}>Import Existing Wallet</Text>
              <Text style={c.optionSub}>Restore with a 12 or 24-word seed phrase</Text>
            </View>
            <View style={[c.optionArrow, { backgroundColor: BLUE }]}>
              <Ionicons name="arrow-forward" size={16} color={TEAL} />
            </View>
          </TouchableOpacity>

          {/* How it works */}
          <View style={c.infoCard}>
            <Text style={c.infoTitle}>How it works</Text>
            {[
              { icon: "key-outline" as const,             text: "Your keys are stored only on this device" },
              { icon: "cloud-offline-outline" as const,   text: "No server ever sees your private key" },
              { icon: "finger-print-outline" as const,    text: "Protected by device biometrics" },
            ].map((row, i) => (
              <View key={i} style={c.infoRow}>
                <View style={c.infoDot}>
                  <Ionicons name={row.icon} size={14} color={ACCENT} />
                </View>
                <Text style={c.infoText}>{row.text}</Text>
              </View>
            ))}
          </View>

          {error ? (
            <View style={c.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#FF6B35" />
              <Text style={c.errorT}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={c.signOutBtn} onPress={onSignOut} activeOpacity={0.7}>
            <Ionicons name="log-out-outline" size={16} color="#4A7A7A" />
            <Text style={c.signOutT}>Sign Out</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  )
}

// ─── Seed Phrase Screen ───────────────────────────────────────────────────────
function SeedPhraseScreen({
  words, copied, error, onCopy, onContinue, onBack,
}: {
  words: string[]
  copied: boolean
  error: string
  onCopy: () => void
  onContinue: () => void
  onBack: () => void
}) {
  const anim = useFadeSlide()
  const [revealed, setRevealed] = useState(false)

  return (
    <View style={c.bg}>
      <View style={c.circle1} />
      <View style={c.circle2} />
      <ScrollView contentContainerStyle={c.scroll} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View style={[c.pageHeader, anim]}>
          <TouchableOpacity style={c.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={20} color={ACCENT} />
          </TouchableOpacity>
          <View style={c.pageHeaderMid}>
            <Text style={c.pageTitle}>Your Seed Phrase</Text>
            <Text style={c.pageSub}>Write every word down — in order</Text>
          </View>
        </Animated.View>

        <Animated.View style={anim}>
          {/* Warning banner */}
          <View style={c.warnCard}>
            <View style={c.warnIcon}>
              <Ionicons name="warning-outline" size={20} color="#FF6B35" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={c.warnTitle}>Keep this private</Text>
              <Text style={c.warnText}>Anyone with these words can steal all your funds. Never screenshot or share them.</Text>
            </View>
          </View>

          {/* Blur overlay until revealed */}
          <View style={c.phraseCard}>
            <View style={c.phraseGrid}>
              {words.map((word, i) => (
                <View key={i} style={[c.wordChip, !revealed && c.wordBlurred]}>
                  <Text style={c.wordNum}>{i + 1}</Text>
                  <Text style={c.wordT} numberOfLines={1}>
                    {revealed ? word : "•••••"}
                  </Text>
                </View>
              ))}
            </View>

            {!revealed && (
              <TouchableOpacity style={c.revealOverlay} onPress={() => setRevealed(true)} activeOpacity={0.85}>
                <Ionicons name="eye-outline" size={24} color="#fff" />
                <Text style={c.revealT}>Tap to reveal</Text>
              </TouchableOpacity>
            )}
          </View>

          {revealed && (
            <TouchableOpacity style={c.copyBtn} onPress={onCopy} activeOpacity={0.8}>
              <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={18} color={copied ? "#10B981" : ACCENT} />
              <Text style={[c.copyBtnT, copied && { color: "#10B981" }]}>
                {copied ? "Copied to clipboard!" : "Copy all words"}
              </Text>
            </TouchableOpacity>
          )}

          {error ? (
            <View style={c.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#FF6B35" />
              <Text style={c.errorT}>{error}</Text>
            </View>
          ) : null}

          {/* Steps reminder */}
          <View style={c.stepsCard}>
            <Text style={c.stepsTitle}>Before you continue</Text>
            {[
              "Write down all words in the exact order shown",
              "Store them offline — paper or metal backup",
              "Never store them digitally or in screenshots",
            ].map((s, i) => (
              <View key={i} style={c.stepRow}>
                <View style={c.stepNum}><Text style={c.stepNumT}>{i + 1}</Text></View>
                <Text style={c.stepText}>{s}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[c.primaryBtn, !revealed && c.primaryBtnDisabled]}
            onPress={onContinue}
            activeOpacity={0.85}
            disabled={!revealed}
          >
            <Ionicons name="checkmark-circle-outline" size={20} color={TEAL} />
            <Text style={c.primaryBtnT}>I've saved my phrase — Continue</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  )
}

// ─── Import Screen ────────────────────────────────────────────────────────────
function ImportScreen({
  value, onChange, importError, enclaveError, onImport, onBack,
}: {
  value: string
  onChange: (v: string) => void
  importError: string
  enclaveError: string
  onImport: () => void
  onBack: () => void
}) {
  const anim = useFadeSlide()
  const wordCount = value.trim() ? value.trim().replace(/\s+/g, " ").split(" ").length : 0
  const isValid   = wordCount === 12 || wordCount === 24

  return (
    <View style={c.bg}>
      <View style={c.circle1} />
      <View style={c.circle2} />
      <ScrollView contentContainerStyle={c.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <Animated.View style={[c.pageHeader, anim]}>
          <TouchableOpacity style={c.backBtn} onPress={onBack}>
            <Ionicons name="arrow-back" size={20} color={ACCENT} />
          </TouchableOpacity>
          <View style={c.pageHeaderMid}>
            <Text style={c.pageTitle}>Import Wallet</Text>
            <Text style={c.pageSub}>Restore from your seed phrase</Text>
          </View>
        </Animated.View>

        <Animated.View style={anim}>
          {/* Input card */}
          <View style={c.inputCard}>
            <View style={c.inputCardHeader}>
              <Ionicons name="document-text-outline" size={18} color={ACCENT} />
              <Text style={c.inputCardLabel}>Seed Phrase</Text>
              <View style={[c.wordBadge, isValid && c.wordBadgeOk]}>
                <Text style={[c.wordBadgeT, isValid && c.wordBadgeTOk]}>
                  {wordCount}/{value.trim() ? "24" : "12–24"} words
                </Text>
              </View>
            </View>
            <TextInput
              style={c.seedInput}
              multiline
              placeholder="Enter your seed phrase words separated by spaces..."
              placeholderTextColor="#4A7A7A"
              value={value}
              onChangeText={onChange}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
            {isValid && (
              <View style={c.validRow}>
                <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                <Text style={c.validT}>Valid {wordCount}-word phrase detected</Text>
              </View>
            )}
          </View>

          {/* Tips */}
          <View style={c.tipsCard}>
            <Ionicons name="information-circle-outline" size={16} color={BLUE} />
            <Text style={c.tipsT}>Words are separated by spaces. Capitalisation does not matter.</Text>
          </View>

          {(importError || enclaveError) ? (
            <View style={c.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#FF6B35" />
              <Text style={c.errorT}>{importError || enclaveError}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[c.primaryBtn, !isValid && c.primaryBtnDisabled]}
            onPress={onImport}
            activeOpacity={0.85}
            disabled={!isValid}
          >
            <Ionicons name="download-outline" size={20} color={TEAL} />
            <Text style={c.primaryBtnT}>Import Wallet</Text>
          </TouchableOpacity>

          <View style={c.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#4A7A7A" />
            <Text style={c.securityNoteT}>Your phrase never leaves this device</Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────
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

      await savePrivateKey(privKey)

      if (Platform.OS === "web") {
        localStorage.setItem("kryptonow_address", address)
        localStorage.setItem("kryptonow_profile", JSON.stringify({ onboarded: true }))
      }

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
      setImportError("Please enter a valid 12 or 24-word phrase.")
      return
    }
    setImportError("")
    handleSaveWallet(phrase)
  }

  if (loading) return (
    <View style={c.loadingScreen}>
      <View style={c.circle1} />
      <View style={c.circle2} />
      <View style={c.loadingCard}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={c.loadingTitle}>Setting up your wallet</Text>
        <Text style={c.loadingSub}>Securing your keys on this device...</Text>
      </View>
    </View>
  )

  if (step === "choice") return (
    <ChoiceScreen
      onCreate={handleGenerate}
      onImport={() => setStep("import_input")}
      onSignOut={async () => { await signOut(); router.replace("/(auth)/sign-in") }}
      error={enclaveError}
    />
  )

  if (step === "create_show") {
    const phrase = wallet?.mnemonic?.phrase ?? ""
    const words  = phrase.split(" ").filter(Boolean)
    return (
      <SeedPhraseScreen
        words={words}
        copied={copied}
        error={enclaveError}
        onCopy={handleCopyPhrase}
        onContinue={() => handleSaveWallet(phrase)}
        onBack={() => setStep("choice")}
      />
    )
  }

  if (step === "import_input") return (
    <ImportScreen
      value={imported}
      onChange={v => { setImported(v); setImportError("") }}
      importError={importError}
      enclaveError={enclaveError}
      onImport={handleImportConfirm}
      onBack={() => setStep("choice")}
    />
  )

  return null
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const c = StyleSheet.create({
  bg:           { flex: 1, backgroundColor: TEAL },
  circle1:      { position: "absolute", top: -100, right: -80,  width: 320, height: 320, borderRadius: 160, backgroundColor: ACCENT, opacity: 0.08 },
  circle2:      { position: "absolute", bottom: -80, left: -60, width: 260, height: 260, borderRadius: 130, backgroundColor: BLUE,   opacity: 0.07 },
  circle3:      { position: "absolute", top: "45%", left: "20%",width: 180, height: 180, borderRadius: 90,  backgroundColor: ACCENT, opacity: 0.04 },
  scroll:       { flexGrow: 1, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 48 },

  // Hero
  hero:         { alignItems: "center", marginBottom: 28 },
  iconRing:     { width: 96, height: 96, borderRadius: 48, backgroundColor: ACCENT + "25", alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1.5, borderColor: ACCENT + "40" },
  iconInner:    { width: 72, height: 72, borderRadius: 36, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 },
  iconK:        { fontSize: 36, fontWeight: "900", color: TEAL },
  heroTitle:    { fontSize: 28, fontWeight: "900", color: "#fff", letterSpacing: -0.5, marginBottom: 6 },
  heroSub:      { fontSize: 14, color: ACCENT, fontWeight: "500", letterSpacing: 0.3 },

  // Badges
  badgeRow:     { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 28, flexWrap: "wrap" },
  badge:        { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,212,170,0.12)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: ACCENT + "35" },
  badgeT:       { fontSize: 11, color: ACCENT, fontWeight: "600" },

  // Option cards
  optionCard:   { backgroundColor: CARD, borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
  optionIconWrap:{ width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  optionMid:    { flex: 1 },
  optionTitle:  { fontSize: 16, fontWeight: "800", color: "#1E1B4B", marginBottom: 3 },
  optionSub:    { fontSize: 12, color: "#64748B", lineHeight: 17 },
  optionArrow:  { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  // Info card
  infoCard:     { backgroundColor: "rgba(255,255,255,0.07)", borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" },
  infoTitle:    { fontSize: 13, fontWeight: "700", color: "#A0C4C4", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  infoRow:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  infoDot:      { width: 28, height: 28, borderRadius: 8, backgroundColor: ACCENT + "20", alignItems: "center", justifyContent: "center" },
  infoText:     { fontSize: 13, color: "#B0D4D4", lineHeight: 18, flex: 1 },

  // Sign out
  signOutBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14 },
  signOutT:     { color: "#4A7A7A", fontSize: 14, fontWeight: "500" },

  // Page header
  pageHeader:   { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 24 },
  pageHeaderMid:{ flex: 1 },
  backBtn:      { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(0,212,170,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: ACCENT + "30" },
  pageTitle:    { fontSize: 22, fontWeight: "800", color: "#fff" },
  pageSub:      { fontSize: 13, color: "#A0C4C4", marginTop: 2 },

  // Warning
  warnCard:     { backgroundColor: "rgba(255,107,53,0.12)", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,107,53,0.35)" },
  warnIcon:     { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,107,53,0.2)", alignItems: "center", justifyContent: "center" },
  warnTitle:    { fontSize: 14, fontWeight: "700", color: "#FF6B35", marginBottom: 4 },
  warnText:     { fontSize: 12, color: "#FF9A6B", lineHeight: 17 },

  // Phrase card
  phraseCard:   { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", overflow: "hidden" },
  phraseGrid:   { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  wordChip:     { width: `${(100 / 3) - 2}%` as any, backgroundColor: "rgba(0,212,170,0.12)", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: ACCENT + "25" },
  wordBlurred:  { opacity: 0.15 },
  wordNum:      { fontSize: 9, fontWeight: "700", color: ACCENT, minWidth: 14 },
  wordT:        { fontSize: 12, color: "#fff", fontWeight: "600", flex: 1 },
  revealOverlay:{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(13,46,46,0.82)", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 20 },
  revealT:      { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Copy
  copyBtn:      { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "rgba(0,212,170,0.12)", borderRadius: 14, paddingVertical: 14, marginBottom: 16, borderWidth: 1, borderColor: ACCENT + "35" },
  copyBtnT:     { color: ACCENT, fontSize: 14, fontWeight: "700" },

  // Steps
  stepsCard:    { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  stepsTitle:   { fontSize: 12, fontWeight: "700", color: "#A0C4C4", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.8 },
  stepRow:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  stepNum:      { width: 22, height: 22, borderRadius: 11, backgroundColor: ACCENT + "25", alignItems: "center", justifyContent: "center" },
  stepNumT:     { fontSize: 11, fontWeight: "800", color: ACCENT },
  stepText:     { fontSize: 12, color: "#B0D4D4", lineHeight: 17, flex: 1 },

  // Primary button
  primaryBtn:         { backgroundColor: ACCENT, borderRadius: 16, paddingVertical: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16, elevation: 6, marginBottom: 8 },
  primaryBtnDisabled: { backgroundColor: "#1A4A3A", shadowOpacity: 0 },
  primaryBtnT:        { color: TEAL, fontSize: 16, fontWeight: "800" },

  // Import
  inputCard:        { backgroundColor: CARD, borderRadius: 20, padding: 18, marginBottom: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 4 },
  inputCardHeader:  { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  inputCardLabel:   { fontSize: 14, fontWeight: "700", color: "#1E1B4B", flex: 1 },
  wordBadge:        { backgroundColor: "#F1F5F9", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  wordBadgeOk:      { backgroundColor: "#D1FAE5" },
  wordBadgeT:       { fontSize: 11, fontWeight: "600", color: "#64748B" },
  wordBadgeTOk:     { color: "#065F46" },
  seedInput:        { fontSize: 15, color: "#1E1B4B", minHeight: 130, textAlignVertical: "top", lineHeight: 24, padding: 0 },
  validRow:         { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  validT:           { fontSize: 12, color: "#10B981", fontWeight: "600" },
  tipsCard:         { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(0,184,255,0.10)", borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "rgba(0,184,255,0.25)" },
  tipsT:            { fontSize: 12, color: "#A0D4F4", lineHeight: 17, flex: 1 },
  securityNote:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 },
  securityNoteT:    { fontSize: 12, color: "#4A7A7A", fontWeight: "500" },

  // Errors
  errorBox:     { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "rgba(255,107,53,0.1)", borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,107,53,0.3)" },
  errorT:       { color: "#FF6B35", fontSize: 13, lineHeight: 18, flex: 1 },

  // Loading
  loadingScreen:{ flex: 1, backgroundColor: TEAL, alignItems: "center", justifyContent: "center" },
  loadingCard:  { alignItems: "center", gap: 12 },
  loadingTitle: { fontSize: 20, fontWeight: "800", color: "#fff", marginTop: 8 },
  loadingSub:   { fontSize: 14, color: "#A0C4C4" },
})
