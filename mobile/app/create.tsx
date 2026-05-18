import "react-native-get-random-values"
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, ScrollView, TextInput, Platform, Dimensions } from "react-native"
import { router } from "expo-router"
import { useAuth } from "@clerk/expo"
import { useState } from "react"
import * as Clipboard from "expo-clipboard"
import { ethers } from "ethers"
import { useWalletStore } from "../store/walletStore"
import { savePrivateKey } from "../store/keyStore"
import { LinearGradient } from "expo-linear-gradient"
import { Ionicons } from "@expo/vector-icons"

const TEAL   = "#0D2E2E"
const ACCENT = "#00D4AA"
const ACCENT2 = "#00B8FF"
const BG_DARK = "#092020"

type Step = "choice" | "create_show" | "import_input"

const { width } = Dimensions.get("window")
const isWeb = Platform.OS === "web"

export default function Create() {
  const { signOut } = useAuth()
  const [step,         setStep]         = useState<Step>("choice")
  const [wallet,       setWallet]       = useState<ethers.HDNodeWallet | null>(null)
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
        localStorage.setItem("kryptonow_address", address)
        localStorage.setItem("kryptonow_vault",   privKey)
        localStorage.setItem("kryptonow_profile", JSON.stringify({ onboarded: true }))
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
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />
      <ActivityIndicator size="large" color={ACCENT} />
      <Text style={s.loadingT}>Setting up secure enclave...</Text>
    </View>
  )

  // --- Choice ---
  if (step === "choice") return (
    <View style={s.c}>
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />
      
      <ScrollView contentContainerStyle={s.centerScroll} showsVerticalScrollIndicator={false}>
        {/* Core Brand Header */}
        <View style={s.headerContainer}>
          <View style={s.logoIcon}>
            {/* Unified Shield Diamond */}
            <View style={s.logoShield}>
              <View style={s.logoShieldInner}>
                <View style={s.logoCore} />
              </View>
            </View>
            {/* Unified Orbital Ring */}
            <View style={s.logoRing} />
          </View>
          <Text style={s.brandTitle}>KryptoNow</Text>
          <Text style={s.brandTag}>Decentralized self-custody vault</Text>
        </View>

        {/* Content Title */}
        <View style={s.titleBlock}>
          <Text style={s.title}>Secure Your Wallet</Text>
          <Text style={s.sub}>Establish your cryptographic storage system to manage, swap, and secure digital assets.</Text>
        </View>

        {enclaveError ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={s.errorText}>{enclaveError}</Text>
          </View>
        ) : null}

        {/* Responsive Choice Grid */}
        <View style={s.cardsGrid}>
          {/* Card 1: Create */}
          <TouchableOpacity style={s.choiceCard} onPress={handleGenerate} activeOpacity={0.88}>
            <LinearGradient colors={["rgba(0, 212, 170, 0.15)", "rgba(0, 184, 255, 0.05)"]} style={s.cardGradient}>
              <View style={s.cardHeader}>
                <View style={[s.iconBox, { backgroundColor: "rgba(0, 212, 170, 0.1)" }]}>
                  <Ionicons name="shield-checkmark" size={24} color={ACCENT} />
                </View>
                <Ionicons name="arrow-forward" size={18} color="rgba(255, 255, 255, 0.4)" />
              </View>
              <Text style={s.cardTitle}>Create New Vault</Text>
              <Text style={s.cardDesc}>Generate a fresh, mathematically secure cryptographic seed phrase to keep your funds fully in your control.</Text>
              <Text style={s.cardLink}>Generate Phrase →</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Card 2: Import */}
          <TouchableOpacity style={s.choiceCard} onPress={() => setStep("import_input")} activeOpacity={0.88}>
            <LinearGradient colors={["rgba(255, 255, 255, 0.05)", "rgba(255, 255, 255, 0.01)"]} style={s.cardGradient}>
              <View style={s.cardHeader}>
                <View style={[s.iconBox, { backgroundColor: "rgba(255, 255, 255, 0.05)" }]}>
                  <Ionicons name="download" size={24} color="#A0C4C4" />
                </View>
                <Ionicons name="arrow-forward" size={18} color="rgba(255, 255, 255, 0.4)" />
              </View>
              <Text style={s.cardTitle}>Import Recovery Seed</Text>
              <Text style={s.cardDesc}>Restore your existing blockchain identities using a standard 12 or 24-word secret recovery phrase.</Text>
              <Text style={s.cardLink}>Enter Recovery Phrase →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Footer Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={async () => {
          await signOut()
          router.replace("/(auth)/sign-in")
        }} activeOpacity={0.75}>
          <Ionicons name="log-out-outline" size={16} color="rgba(255,255,255,0.4)" style={{ marginRight: 6 }} />
          <Text style={s.logoutT}>Sign Out of Profile</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )

  // --- Show Seed Phrase ---
  if (step === "create_show") {
    const phrase = wallet?.mnemonic?.phrase ?? ""
    const words  = phrase.split(" ").filter(Boolean)
    return (
      <View style={s.c}>
        <View style={s.bgCircle1} />
        <View style={s.bgCircle2} />
        
        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={s.titleBlock}>
            <Text style={s.title}>Your Seed Phrase</Text>
            <Text style={s.sub}>Write these 12 words down in the exact order shown and store them offline safely.</Text>
          </View>

          {/* Warning Card */}
          <View style={s.warningBox}>
            <Ionicons name="warning" size={22} color="#FF6B35" style={{ marginRight: 12, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.warningTitle}>CRITICAL SECURITY WARNING</Text>
              <Text style={s.warningT}>Never share these words with anyone. Anyone who gets these words can access all your funds and steal them forever.</Text>
            </View>
          </View>

          {/* Phrase Grid */}
          <View style={s.phraseGrid}>
            {words.map((word: string, i: number) => (
              <View key={i} style={s.wordBox}>
                <View style={s.wordNumBox}>
                  <Text style={s.wordNum}>{String(i + 1).padStart(2, "0")}</Text>
                </View>
                <Text style={s.wordT}>{word}</Text>
              </View>
            ))}
          </View>

          {/* Action Row */}
          <View style={s.actionStack}>
            <TouchableOpacity style={s.copyBtn} onPress={handleCopyPhrase} activeOpacity={0.8}>
              <Ionicons name={copied ? "checkmark-circle" : "copy-outline"} size={18} color={ACCENT} style={{ marginRight: 8 }} />
              <Text style={s.copyBtnT}>{copied ? "Copied Successfully!" : "Copy Phrase to Clipboard"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.btnPrimaryWrap} onPress={() => handleSaveWallet(phrase)} activeOpacity={0.88}>
              <LinearGradient colors={[ACCENT, "#00B8FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnPrimary}>
                <Text style={s.btnPrimaryT}>I Have Secured the Phrase</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={s.backBtn} onPress={() => setStep("choice")} activeOpacity={0.8}>
              <Ionicons name="arrow-back" size={16} color="rgba(255,255,255,0.6)" style={{ marginRight: 6 }} />
              <Text style={s.backBtnText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    )
  }

  // --- Import ---
  if (step === "import_input") return (
    <View style={s.c}>
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.titleBlock}>
          <Text style={s.title}>Import Vault</Text>
          <Text style={s.sub}>Paste or type your 12 or 24-word seed phrase separated by single spaces.</Text>
        </View>

        {/* Input Wrapper */}
        <View style={s.inputContainer}>
          <TextInput
            style={s.input}
            multiline
            placeholder="word1 word2 word3..."
            placeholderTextColor="rgba(255,255,255,0.2)"
            value={imported}
            onChangeText={(t) => { setImported(t); setImportError(""); }}
            autoCapitalize="none"
            autoCorrect={false}
            textAlignVertical="top"
          />
        </View>

        {importError ? (
          <View style={[s.errorBox, { marginBottom: 16 }]}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={s.errorText}>{importError}</Text>
          </View>
        ) : null}

        {enclaveError ? (
          <View style={[s.errorBox, { marginBottom: 16 }]}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
            <Text style={s.errorText}>{enclaveError}</Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={s.actionStack}>
          <TouchableOpacity style={s.btnPrimaryWrap} onPress={handleImportConfirm} activeOpacity={0.88}>
            <LinearGradient colors={[ACCENT, "#00B8FF"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btnPrimary}>
              <Text style={s.btnPrimaryT}>Confirm and Import Vault</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={s.backBtn} onPress={() => setStep("choice")} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={16} color="rgba(255,255,255,0.6)" style={{ marginRight: 6 }} />
            <Text style={s.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )

  return null
}

const s = StyleSheet.create({
  c: {
    flex: 1,
    backgroundColor: TEAL,
    position: "relative",
    overflow: "hidden",
  },
  centered: {
    flex: 1,
    backgroundColor: TEAL,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  centerScroll: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    paddingVertical: 50,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
    maxWidth: 680,
    alignSelf: "center",
    width: "100%",
  },
  
  /* Background Decorative Orbs */
  bgCircle1: {
    position: "absolute",
    top: -120,
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: ACCENT,
    opacity: 0.08,
  },
  bgCircle2: {
    position: "absolute",
    bottom: -100,
    left: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: ACCENT2,
    opacity: 0.06,
  },

  /* Header Branding */
  headerContainer: {
    alignItems: "center",
    marginBottom: 40,
    zIndex: 10,
  },
  logoIcon: {
    position: "relative",
    width: 64,
    height: 64,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoShield: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: ACCENT,
    transform: [{ rotate: "45deg" }],
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  logoShieldInner: {
    width: 24,
    height: 24,
    borderRadius: 5,
    backgroundColor: TEAL,
    transform: [{ rotate: "45deg" }],
    alignItems: "center",
    justifyContent: "center",
  },
  logoCore: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#ffffff",
  },
  logoRing: {
    position: "absolute",
    width: 52,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: ACCENT2,
    transform: [{ rotate: "-15deg" }],
    zIndex: 10,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#ffffff",
    letterSpacing: -0.5,
  },
  brandTag: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.4)",
    fontWeight: "600",
    marginTop: 2,
  },

  /* Titles */
  titleBlock: {
    alignItems: "center",
    marginBottom: 32,
    width: "100%",
  },
  title: {
    fontSize: 32,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  sub: {
    fontSize: 15,
    color: "#A0C4C4",
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 480,
  },

  /* Cards choice grid */
  cardsGrid: {
    flexDirection: isWeb ? "row" : "column",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    width: "100%",
    maxWidth: 680,
    marginBottom: 24,
    zIndex: 20,
  },
  choiceCard: {
    flex: isWeb ? 1 : undefined,
    width: isWeb ? "48%" : "100%",
    minWidth: 280,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.06)",
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
  },
  cardGradient: {
    padding: 24,
    flex: 1,
    minHeight: 220,
    justifyContent: "space-between",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 13.5,
    color: "rgba(255, 255, 255, 0.65)",
    lineHeight: 20,
    marginBottom: 16,
  },
  cardLink: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
  },

  /* Warning Box */
  warningBox: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 107, 53, 0.08)",
    borderWidth: 1.5,
    borderColor: "rgba(255, 107, 53, 0.3)",
    borderRadius: 20,
    padding: 16,
    marginBottom: 24,
  },
  warningTitle: {
    color: "#FF6B35",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  warningT: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 13,
    lineHeight: 19,
  },

  /* Phrase Grid */
  phraseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
    justifyContent: "space-between",
  },
  wordBox: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    width: isWeb ? "23.5%" : "47%",
    minWidth: 100,
  },
  wordNumBox: {
    backgroundColor: "rgba(0, 212, 170, 0.1)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginRight: 10,
  },
  wordNum: {
    fontSize: 10,
    color: ACCENT,
    fontWeight: "800",
  },
  wordT: {
    fontSize: 14.5,
    color: "#FFFFFF",
    fontWeight: "700",
  },

  /* Input Fields */
  inputContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
    marginBottom: 20,
    padding: 4,
  },
  input: {
    color: "#FFFFFF",
    fontSize: 16,
    padding: 16,
    minHeight: 140,
    lineHeight: 24,
    outlineStyle: "none",
  } as any,

  /* Action Buttons & Stack */
  actionStack: {
    gap: 12,
    width: "100%",
  },
  btnPrimaryWrap: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  btnPrimary: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  btnPrimaryT: {
    color: TEAL,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  copyBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(0, 212, 170, 0.3)",
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  copyBtnT: {
    color: ACCENT,
    fontSize: 15,
    fontWeight: "700",
  },
  backBtn: {
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  backBtnText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "700",
  },

  /* Errors & Loading */
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 12,
    padding: 12,
    width: "100%",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
    flex: 1,
  },
  loadingT: {
    color: ACCENT,
    marginTop: 20,
    fontSize: 16,
    fontWeight: "700",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 20,
  },
  logoutT: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 13.5,
    fontWeight: "700",
  },
})