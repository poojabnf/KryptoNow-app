"use client"
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

// ── Design tokens ─────────────────────────────────────────────────────────────
const BG       = "#050E14"         // near-black deep navy
const SURFACE  = "#0A1929"         // card surface
const SURFACE2 = "#0F2234"         // elevated surface
const BORDER   = "#1A3550"         // subtle border
const BORDER2  = "#1E4060"         // active border
const TEAL     = "#00D4AA"         // primary accent
const TEAL2    = "#00B8E6"         // secondary accent
const GOLD     = "#F0B429"         // warning/highlight
const RED      = "#FF4D6D"         // error
const TEXT     = "#E8F4F8"         // primary text
const MUTED    = "#5A8A9F"         // muted text
const { width } = Dimensions.get("window")

type Step = "choice" | "create_show" | "import_input"

export default function Create() {
  const { signOut } = useAuth()
  const [step,         setStep]         = useState<Step>("choice")
  const [wallet,       setWallet]       = useState<any>(null)
  const [imported,     setImported]     = useState("")
  const [copied,       setCopied]       = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [importError,  setImportError]  = useState("")
  const [enclaveError, setEnclaveError] = useState("")
  const [confirmed,    setConfirmed]    = useState(false)
  const [revealAll,    setRevealAll]    = useState(false)

  const cardAnim    = useRef(new Animated.Value(50)).current
  const cardOpacity = useRef(new Animated.Value(0)).current
  const logoScale   = useRef(new Animated.Value(0.85)).current
  const logoOpacity = useRef(new Animated.Value(0)).current
  const pulseAnim   = useRef(new Animated.Value(1)).current

  useEffect(() => {
    // Reset animations on step change
    cardAnim.setValue(50)
    cardOpacity.setValue(0)
    logoScale.setValue(0.85)
    logoOpacity.setValue(0)

    Animated.parallel([
      Animated.spring(logoScale,    { toValue: 1, tension: 45, friction: 8, useNativeDriver: true }),
      Animated.timing(logoOpacity,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(150),
        Animated.parallel([
          Animated.spring(cardAnim,    { toValue: 0, tension: 55, friction: 10, useNativeDriver: true }),
          Animated.timing(cardOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ]),
    ]).start()

    // Pulse animation for the logo
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 2200, useNativeDriver: true }),
      ])
    )
    pulse.start()
    return () => pulse.stop()
  }, [step])

  const handleGenerate = () => {
    try {
      let w: any
      if (Platform.OS === "web" && typeof window !== "undefined" && window.crypto) {
        const entropy = new Uint8Array(16)
        window.crypto.getRandomValues(entropy)
        const mnemonic = ethers.Mnemonic.fromEntropy(entropy)
        w = ethers.Wallet.fromPhrase(mnemonic.phrase)
      } else {
        w = ethers.Wallet.createRandom()
      }
      setWallet(w)
      setConfirmed(false)
      setRevealAll(false)
      setStep("create_show")
    } catch (e: any) {
      setEnclaveError(e?.message ?? "Failed to generate wallet. Please try again.")
    }
  }

  const handleCopyPhrase = async () => {
    await Clipboard.setStringAsync(wallet?.mnemonic?.phrase ?? "")
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
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
        localStorage.setItem("kryptonow_wallet",  JSON.stringify({ address, phrase: "" }))
        localStorage.setItem("kryptonow_vault",   privKey)
        localStorage.setItem("kryptonow_profile", JSON.stringify({ onboarded: true }))
      } else {
        const AS = require("@react-native-async-storage/async-storage").default
        await AS.setItem("kryptonow_address", address)
        await AS.setItem("kryptonow_wallet",  JSON.stringify({ address, phrase: "" }))
        await AS.setItem("kryptonow_profile", JSON.stringify({ onboarded: true }))
      }
      useWalletStore.getState().setWallet({ address, phrase: "" })
      router.replace("/dashboard")
    } catch (e: any) {
      setEnclaveError(e?.message ?? "Unexpected error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleImportConfirm = () => {
    const phrase = imported.trim().replace(/\s+/g, " ")
    const words  = phrase.split(" ")
    if (words.length !== 12 && words.length !== 24) {
      setImportError("Please enter a valid 12 or 24-word seed phrase.")
      return
    }
    try {
      ethers.Wallet.fromPhrase(phrase)
      setImportError("")
      handleSaveWallet(phrase)
    } catch {
      setImportError("Invalid seed phrase. Please check each word carefully.")
    }
  }

  const wordCount = imported.trim() === "" ? 0 : imported.trim().split(/\s+/).length
  const isValidWordCount = wordCount === 12 || wordCount === 24

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) return (
    <View style={s.bg}>
      <GridLines />
      <View style={s.centered}>
        <Animated.View style={[s.loadingRing, { transform: [{ scale: pulseAnim }] }]}>
          <View style={s.loadingInner}>
            <Ionicons name="shield-checkmark" size={38} color={TEAL} />
          </View>
        </Animated.View>
        <Text style={s.loadingTitle}>Securing your wallet</Text>
        <Text style={s.loadingSub}>Encrypting keys with AES-256-GCM...</Text>
        <View style={s.loadingSteps}>
          {["Deriving HD keypair", "Encrypting to enclave", "Saving securely"].map((step, i) => (
            <View key={i} style={s.loadingStep}>
              <View style={s.loadingDot} />
              <Text style={s.loadingStepT}>{step}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )

  // ── Choice screen ──────────────────────────────────────────────────────────
  if (step === "choice") return (
    <View style={s.bg}>
      <GridLines />
      <ScrollView contentContainerStyle={s.center} showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <Animated.View style={[s.logoWrap, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
          <Animated.View style={[s.logoGlow, { transform: [{ scale: pulseAnim }] }]} />
          <View style={s.logoIcon}>
            <Text style={s.logoIconText}>K</Text>
          </View>
          <Text style={s.logoTitle}>KryptoNow</Text>
          <Text style={s.logoTagline}>Your keys. Your crypto. Your rules.</Text>
        </Animated.View>

        {/* Card */}
        <Animated.View style={[s.card, { transform: [{ translateY: cardAnim }], opacity: cardOpacity }]}>
          <Text style={s.cardTitle}>Set up your wallet</Text>
          <Text style={s.cardSub}>Choose how you'd like to get started</Text>

          {enclaveError ? <ErrorBox msg={enclaveError} /> : null}

          {/* Create option */}
          <TouchableOpacity style={s.optionCard} onPress={handleGenerate} activeOpacity={0.85}>
            <View style={[s.optionIconWrap, { backgroundColor: TEAL + "18" }]}>
              <Ionicons name="sparkles" size={26} color={TEAL} />
            </View>
            <View style={s.optionText}>
              <Text style={s.optionTitle}>Create New Wallet</Text>
              <Text style={s.optionSub}>Generate a fresh wallet with a new seed phrase</Text>
            </View>
            <View style={s.optionArrow}>
              <Ionicons name="arrow-forward" size={16} color={TEAL} />
            </View>
          </TouchableOpacity>

          {/* Divider */}
          <View style={s.orRow}>
            <View style={s.orLine} />
            <Text style={s.orText}>or</Text>
            <View style={s.orLine} />
          </View>

          {/* Import option */}
          <TouchableOpacity style={[s.optionCard, s.optionCardAlt]} onPress={() => setStep("import_input")} activeOpacity={0.85}>
            <View style={[s.optionIconWrap, { backgroundColor: TEAL2 + "18" }]}>
              <Ionicons name="download-outline" size={26} color={TEAL2} />
            </View>
            <View style={s.optionText}>
              <Text style={[s.optionTitle, { color: TEAL2 }]}>Import Existing Wallet</Text>
              <Text style={s.optionSub}>Restore using your 12 or 24-word seed phrase</Text>
            </View>
            <View style={[s.optionArrow, { backgroundColor: TEAL2 + "18" }]}>
              <Ionicons name="arrow-forward" size={16} color={TEAL2} />
            </View>
          </TouchableOpacity>

          {/* Security row */}
          <View style={s.securityRow}>
            {[
              { icon: "shield-checkmark-outline", label: "Non-custodial" },
              { icon: "lock-closed-outline",      label: "AES-256-GCM"  },
              { icon: "eye-off-outline",           label: "Zero telemetry"},
            ].map(b => (
              <View key={b.label} style={s.secBadge}>
                <Ionicons name={b.icon as any} size={11} color={TEAL} />
                <Text style={s.secBadgeT}>{b.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <TouchableOpacity style={s.signOutBtn} onPress={async () => { await signOut(); router.replace("/(auth)/sign-in") }}>
          <Ionicons name="log-out-outline" size={15} color={MUTED} />
          <Text style={s.signOutT}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )

  // ── Seed phrase screen ─────────────────────────────────────────────────────
  if (step === "create_show") {
    const phrase = wallet?.mnemonic?.phrase ?? ""
    const words  = phrase.split(" ").filter(Boolean)

    return (
      <View style={s.bg}>
        <GridLines />
        <ScrollView contentContainerStyle={s.scrollPad} showsVerticalScrollIndicator={false}>

          {/* Header */}
          <Animated.View style={[{ opacity: cardOpacity, transform: [{ translateY: cardAnim }] }]}>
            <View style={s.pageHeader}>
              <TouchableOpacity style={s.backBtn} onPress={() => setStep("choice")}>
                <Ionicons name="arrow-back" size={18} color={TEAL} />
              </TouchableOpacity>
              <View style={s.pageHeaderCenter}>
                <Text style={s.pageHeaderTitle}>Your Seed Phrase</Text>
                <View style={s.stepDot} />
              </View>
              <TouchableOpacity style={s.revealBtn} onPress={() => setRevealAll(!revealAll)}>
                <Ionicons name={revealAll ? "eye-off-outline" : "eye-outline"} size={16} color={MUTED} />
              </TouchableOpacity>
            </View>

            <Text style={s.pageSubtitle}>
              Write these <Text style={{ color: TEAL, fontWeight: "700" }}>{words.length} words</Text> down in the exact order shown. This is the only way to recover your wallet if you lose access.
            </Text>

            {/* Warning banner */}
            <View style={s.warningCard}>
              <View style={s.warningLeft}>
                <Ionicons name="warning" size={20} color={GOLD} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.warningTitle}>Never share this phrase</Text>
                <Text style={s.warningBody}>Anyone with these words has full control of your funds. KryptoNow staff will never ask for your seed phrase.</Text>
              </View>
            </View>

            {/* Word grid */}
            <View style={s.phraseCard}>
              <View style={s.phraseTitleRow}>
                <View style={s.phraseTitleLeft}>
                  <View style={s.phraseTitleDot} />
                  <Text style={s.phraseTitleT}>Recovery Phrase</Text>
                </View>
                <Text style={s.phraseWordCount}>{words.length} words</Text>
              </View>

              <View style={s.phraseGrid}>
                {words.map((word: string, i: number) => (
                  <View key={i} style={[s.wordBox, i % 3 === 0 && s.wordBoxFirst]}>
                    <View style={s.wordNumWrap}>
                      <Text style={s.wordNum}>{i + 1}</Text>
                    </View>
                    <Text style={s.wordT} numberOfLines={1}>
                      {revealAll ? word : word.slice(0, 2) + "•".repeat(Math.max(2, word.length - 2))}
                    </Text>
                  </View>
                ))}
              </View>

              {!revealAll && (
                <TouchableOpacity style={s.tapReveal} onPress={() => setRevealAll(true)}>
                  <Ionicons name="eye-outline" size={14} color={MUTED} />
                  <Text style={s.tapRevealT}>Tap to reveal all words</Text>
                </TouchableOpacity>
              )}
            </View>

            {enclaveError ? <ErrorBox msg={enclaveError} /> : null}

            {/* Copy button */}
            <TouchableOpacity style={[s.copyBtn, copied && s.copyBtnDone]} onPress={handleCopyPhrase} activeOpacity={0.8}>
              <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={17} color={copied ? BG : TEAL} />
              <Text style={[s.copyBtnT, copied && { color: BG }]}>
                {copied ? "Copied to clipboard!" : "Copy seed phrase"}
              </Text>
            </TouchableOpacity>

            {/* Confirmation */}
            <TouchableOpacity style={s.confirmRow} onPress={() => setConfirmed(!confirmed)} activeOpacity={0.85}>
              <View style={[s.checkbox, confirmed && s.checkboxActive]}>
                {confirmed && <Ionicons name="checkmark" size={12} color={BG} />}
              </View>
              <Text style={s.confirmText}>
                I have written down my seed phrase and stored it securely offline
              </Text>
            </TouchableOpacity>

            {/* CTA */}
            <TouchableOpacity
              style={[s.ctaBtn, !confirmed && s.ctaBtnDisabled]}
              onPress={() => handleSaveWallet(phrase)}
              disabled={!confirmed}
              activeOpacity={0.9}
            >
              <Text style={s.ctaBtnT}>Continue to Wallet</Text>
              <Ionicons name="arrow-forward" size={17} color={BG} />
            </TouchableOpacity>
          </Animated.View>

          <View style={{ height: 48 }} />
        </ScrollView>
      </View>
    )
  }

  // ── Import screen ──────────────────────────────────────────────────────────
  if (step === "import_input") return (
    <View style={s.bg}>
      <GridLines />
      <ScrollView
        contentContainerStyle={s.scrollPad}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: cardOpacity, transform: [{ translateY: cardAnim }] }}>
          {/* Header */}
          <View style={s.pageHeader}>
            <TouchableOpacity style={s.backBtn} onPress={() => setStep("choice")}>
              <Ionicons name="arrow-back" size={18} color={TEAL} />
            </TouchableOpacity>
            <View style={s.pageHeaderCenter}>
              <Text style={s.pageHeaderTitle}>Import Wallet</Text>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <Text style={s.pageSubtitle}>
            Enter your <Text style={{ color: TEAL, fontWeight: "700" }}>12 or 24-word</Text> seed phrase, each word separated by a space.
          </Text>

          {/* Security note */}
          <View style={s.importSecureNote}>
            <Ionicons name="lock-closed" size={15} color={TEAL} />
            <Text style={s.importSecureNoteT}>
              Your phrase is encrypted locally — it never leaves your device.
            </Text>
          </View>

          {/* Input */}
          <View style={[s.importInputCard, importError ? s.importInputCardError : null, isValidWordCount ? s.importInputCardValid : null]}>
            <TextInput
              style={s.importInput}
              multiline
              placeholder="word1 word2 word3 word4..."
              placeholderTextColor={MUTED + "88"}
              value={imported}
              onChangeText={t => { setImported(t); setImportError("") }}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
            />
            <View style={s.importInputBar}>
              <View style={s.wordPillRow}>
                {[12, 24].map(n => (
                  <View key={n} style={[s.wordPill, wordCount === n && s.wordPillActive]}>
                    <Text style={[s.wordPillT, wordCount === n && s.wordPillTActive]}>{n}w</Text>
                  </View>
                ))}
              </View>
              <View style={s.wordCountRow}>
                {isValidWordCount
                  ? <><Ionicons name="checkmark-circle" size={14} color={TEAL} /><Text style={[s.wordCountT, { color: TEAL }]}>{wordCount} words ✓</Text></>
                  : <Text style={s.wordCountT}>{wordCount} / 12 words</Text>
                }
              </View>
            </View>
          </View>

          {importError  ? <ErrorBox msg={importError}  /> : null}
          {enclaveError ? <ErrorBox msg={enclaveError} /> : null}

          {/* CTA */}
          <TouchableOpacity
            style={[s.ctaBtn, !isValidWordCount && s.ctaBtnDisabled]}
            onPress={handleImportConfirm}
            disabled={!isValidWordCount}
            activeOpacity={0.9}
          >
            <Ionicons name="download-outline" size={17} color={BG} />
            <Text style={s.ctaBtnT}>Import Wallet</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  )

  return null
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function GridLines() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Radial glow top */}
      <View style={{
        position: "absolute", top: -200, left: "50%", marginLeft: -300,
        width: 600, height: 600, borderRadius: 300,
        backgroundColor: TEAL, opacity: 0.04,
      }} />
      {/* Radial glow bottom */}
      <View style={{
        position: "absolute", bottom: -150, right: -100,
        width: 400, height: 400, borderRadius: 200,
        backgroundColor: TEAL2, opacity: 0.03,
      }} />
      {/* Horizontal lines */}
      {Array.from({ length: 12 }).map((_, i) => (
        <View key={i} style={{
          position: "absolute", left: 0, right: 0,
          top: i * 80, height: 1,
          backgroundColor: "#FFFFFF", opacity: 0.018,
        }} />
      ))}
    </View>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <View style={s.errorBox}>
      <Ionicons name="alert-circle-outline" size={15} color={RED} />
      <Text style={s.errorT}>{msg}</Text>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  bg:              { flex: 1, backgroundColor: BG },
  centered:        { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  center:          { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24, paddingVertical: 56 },
  scrollPad:       { flexGrow: 1, padding: 20, paddingTop: 60, maxWidth: 560, alignSelf: "center", width: "100%" },

  // ── Loading ──────────────────────────────────────────────────────────────
  loadingRing:     { width: 120, height: 120, borderRadius: 60, borderWidth: 2, borderColor: TEAL + "40", alignItems: "center", justifyContent: "center", marginBottom: 32 },
  loadingInner:    { width: 88, height: 88, borderRadius: 44, backgroundColor: TEAL + "12", borderWidth: 1, borderColor: TEAL + "30", alignItems: "center", justifyContent: "center" },
  loadingTitle:    { color: TEXT, fontSize: 22, fontWeight: "700", letterSpacing: -0.3, textAlign: "center" },
  loadingSub:      { color: MUTED, fontSize: 13, textAlign: "center", marginTop: 8, marginBottom: 28 },
  loadingSteps:    { gap: 10 },
  loadingStep:     { flexDirection: "row", alignItems: "center", gap: 10 },
  loadingDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: TEAL },
  loadingStepT:    { color: MUTED, fontSize: 13 },

  // ── Logo ─────────────────────────────────────────────────────────────────
  logoWrap:        { alignItems: "center", marginBottom: 36, gap: 10 },
  logoGlow:        { position: "absolute", top: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: TEAL, opacity: 0.08 },
  logoIcon:        { width: 76, height: 76, borderRadius: 22, backgroundColor: TEAL, alignItems: "center", justifyContent: "center", shadowColor: TEAL, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.55, shadowRadius: 24, elevation: 16, borderWidth: 1, borderColor: TEAL + "60" },
  logoIconText:    { fontSize: 38, fontWeight: "900", color: BG, letterSpacing: -1 },
  logoTitle:       { fontSize: 30, fontWeight: "900", color: TEXT, letterSpacing: -0.8 },
  logoTagline:     { fontSize: 13, color: MUTED, fontWeight: "500", letterSpacing: 0.2 },

  // ── Card ─────────────────────────────────────────────────────────────────
  card:            { width: "100%", maxWidth: 460, backgroundColor: SURFACE, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: BORDER, shadowColor: "#000", shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.4, shadowRadius: 48, elevation: 20 },
  cardTitle:       { fontSize: 21, fontWeight: "800", color: TEXT, textAlign: "center", marginBottom: 6, letterSpacing: -0.3 },
  cardSub:         { fontSize: 13, color: MUTED, textAlign: "center", marginBottom: 24, lineHeight: 20 },

  // ── Option cards ──────────────────────────────────────────────────────────
  optionCard:      { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: SURFACE2, borderRadius: 16, padding: 16, marginBottom: 4, borderWidth: 1, borderColor: BORDER },
  optionCardAlt:   { borderColor: TEAL2 + "30", backgroundColor: TEAL2 + "06" },
  optionIconWrap:  { width: 50, height: 50, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  optionText:      { flex: 1 },
  optionTitle:     { color: TEAL, fontSize: 15, fontWeight: "700", marginBottom: 3, letterSpacing: -0.2 },
  optionSub:       { color: MUTED, fontSize: 12, lineHeight: 17 },
  optionArrow:     { width: 32, height: 32, borderRadius: 10, backgroundColor: TEAL + "18", alignItems: "center", justifyContent: "center" },

  // ── Or divider ────────────────────────────────────────────────────────────
  orRow:           { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 14 },
  orLine:          { flex: 1, height: 1, backgroundColor: BORDER },
  orText:          { color: MUTED, fontSize: 12, fontWeight: "600" },

  // ── Security badges ───────────────────────────────────────────────────────
  securityRow:     { flexDirection: "row", justifyContent: "center", gap: 6, flexWrap: "wrap", marginTop: 16 },
  secBadge:        { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: TEAL + "10", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: TEAL + "25" },
  secBadgeT:       { fontSize: 10, color: TEAL, fontWeight: "700", letterSpacing: 0.3 },

  // ── Sign out ──────────────────────────────────────────────────────────────
  signOutBtn:      { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 24, padding: 10 },
  signOutT:        { color: MUTED, fontSize: 13 },

  // ── Page header ───────────────────────────────────────────────────────────
  pageHeader:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 20 },
  backBtn:         { width: 40, height: 40, borderRadius: 12, backgroundColor: SURFACE, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BORDER },
  pageHeaderCenter:{ flex: 1, alignItems: "center" },
  pageHeaderTitle: { fontSize: 17, fontWeight: "700", color: TEXT, letterSpacing: -0.3 },
  stepDot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: TEAL, marginTop: 4 },
  revealBtn:       { width: 40, height: 40, borderRadius: 12, backgroundColor: SURFACE, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: BORDER },
  pageSubtitle:    { fontSize: 14, color: MUTED, lineHeight: 22, marginBottom: 20 },

  // ── Warning ───────────────────────────────────────────────────────────────
  warningCard:     { flexDirection: "row", gap: 12, backgroundColor: GOLD + "0C", borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: GOLD + "35", alignItems: "flex-start" },
  warningLeft:     { marginTop: 1 },
  warningTitle:    { color: GOLD, fontSize: 13, fontWeight: "700", marginBottom: 4 },
  warningBody:     { color: GOLD + "CC", fontSize: 12, lineHeight: 18 },

  // ── Phrase card ───────────────────────────────────────────────────────────
  phraseCard:      { backgroundColor: SURFACE, borderRadius: 20, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: BORDER },
  phraseTitleRow:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  phraseTitleLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  phraseTitleDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: TEAL, shadowColor: TEAL, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6 },
  phraseTitleT:    { fontSize: 13, fontWeight: "700", color: TEXT, letterSpacing: 0.5, textTransform: "uppercase" },
  phraseWordCount: { fontSize: 11, color: MUTED, fontWeight: "600", backgroundColor: SURFACE2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: BORDER },

  phraseGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  wordBox:         {
    backgroundColor: SURFACE2,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    width: "31%",
    borderWidth: 1,
    borderColor: BORDER,
    minWidth: 90,
  },
  wordBoxFirst:    { borderColor: TEAL + "30" },
  wordNumWrap:     { width: 18, height: 18, borderRadius: 5, backgroundColor: TEAL + "18", alignItems: "center", justifyContent: "center" },
  wordNum:         { fontSize: 9, color: TEAL, fontWeight: "800" },
  wordT:           { fontSize: 12, color: TEXT, fontWeight: "600", flex: 1 },

  tapReveal:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: BORDER },
  tapRevealT:      { color: MUTED, fontSize: 12 },

  // ── Copy button ───────────────────────────────────────────────────────────
  copyBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: TEAL + "12", borderRadius: 14, paddingVertical: 14, marginBottom: 14, borderWidth: 1, borderColor: TEAL + "35" },
  copyBtnDone:     { backgroundColor: TEAL, borderColor: TEAL },
  copyBtnT:        { color: TEAL, fontSize: 14, fontWeight: "700" },

  // ── Confirm checkbox ──────────────────────────────────────────────────────
  confirmRow:      { flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: SURFACE, borderRadius: 14, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: BORDER },
  checkbox:        { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: BORDER2, alignItems: "center", justifyContent: "center", marginTop: 1 },
  checkboxActive:  { backgroundColor: TEAL, borderColor: TEAL },
  confirmText:     { flex: 1, color: MUTED, fontSize: 13, lineHeight: 20 },

  // ── CTA button ────────────────────────────────────────────────────────────
  ctaBtn:          { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: TEAL, borderRadius: 16, paddingVertical: 17, shadowColor: TEAL, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 20, elevation: 10 },
  ctaBtnT:         { color: BG, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  ctaBtnDisabled:  { opacity: 0.3, shadowOpacity: 0 },

  // ── Import input ──────────────────────────────────────────────────────────
  importSecureNote:  { flexDirection: "row", gap: 10, backgroundColor: TEAL + "0C", borderRadius: 12, padding: 13, marginBottom: 16, borderWidth: 1, borderColor: TEAL + "28", alignItems: "center" },
  importSecureNoteT: { flex: 1, color: TEAL, fontSize: 12, lineHeight: 18, fontWeight: "500" },

  importInputCard:       { backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1.5, borderColor: BORDER, marginBottom: 14, overflow: "hidden" },
  importInputCardError:  { borderColor: RED + "60" },
  importInputCardValid:  { borderColor: TEAL + "50" },
  importInput:           { color: TEXT, fontSize: 15, padding: 16, minHeight: 150, textAlignVertical: "top", lineHeight: 28, letterSpacing: 0.2 },
  importInputBar:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 14, paddingBottom: 12, paddingTop: 4 },

  wordPillRow:     { flexDirection: "row", gap: 6 },
  wordPill:        { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: SURFACE2, borderWidth: 1, borderColor: BORDER },
  wordPillActive:  { backgroundColor: TEAL + "18", borderColor: TEAL + "50" },
  wordPillT:       { fontSize: 11, color: MUTED, fontWeight: "600" },
  wordPillTActive: { color: TEAL },

  wordCountRow:    { flexDirection: "row", alignItems: "center", gap: 5 },
  wordCountT:      { color: MUTED, fontSize: 12, fontWeight: "500" },

  // ── Error ─────────────────────────────────────────────────────────────────
  errorBox:        { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: RED + "10", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: RED + "35" },
  errorT:          { flex: 1, color: RED, fontSize: 13, lineHeight: 18 },
})
