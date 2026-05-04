import { useState, useEffect } from "react"
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Alert, Platform,
} from "react-native"
import { router } from "expo-router"
import { useTheme, ThemeMode } from "../context/ThemeContext"
import { Ionicons } from "@expo/vector-icons"
import { useWalletStore } from "../store/walletStore"
import { getSmartAccountAddress, chainSupportsAA, SmartAccountInfo } from "../utils/aa"
import { retrievePrivateKey } from "../store/SecureKeyStore"
import { CHAINS } from "../utils/chains"
import { useAuth } from "@clerk/expo"
import * as Clipboard from "expo-clipboard"

export default function Settings() {
  const addr        = useWalletStore(s => s.address)
  const activeChain = useWalletStore(s => s.activeChain)
  const clearWallet = useWalletStore(s => s.clearWallet)
  const { signOut } = useAuth()
  const { theme, mode, setMode } = useTheme()

  const [biometrics,    setBiometrics]    = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [hideBalance,   setHideBalance]   = useState(false)
  const [testnet,       setTestnet]       = useState(false)
  const [copied,        setCopied]        = useState(false)
  const [aaInfo,        setAaInfo]        = useState<SmartAccountInfo | null>(null)
  const [aaLoading,     setAaLoading]     = useState(false)
  const [aaCopied,      setAaCopied]      = useState(false)

  const short = addr ? addr.slice(0, 10) + "..." + addr.slice(-8) : ""

  const copyAddress = async () => {
    if (addr) {
      await Clipboard.setStringAsync(addr)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Load smart account info on mount (native only)
  useEffect(() => {
    if (Platform.OS === 'web' || !addr || !chainSupportsAA(activeChain.id)) return
    setAaLoading(true)
    retrievePrivateKey(0, 'Authenticate to load smart account info')
      .then(async res => {
        if (!res.ok || !res.data) return
        const info = await getSmartAccountAddress(res.data, activeChain.id)
        setAaInfo(info)
      })
      .catch(() => {})
      .finally(() => setAaLoading(false))
  }, [addr, activeChain.id])

  const copyAAAddress = async () => {
    if (aaInfo?.address) {
      await Clipboard.setStringAsync(aaInfo.address)
      setAaCopied(true)
      setTimeout(() => setAaCopied(false), 2000)
    }
  }

  // Logout: signs out of Clerk but keeps wallet data on device
  const confirmLogout = () => {
    Alert.alert(
      "Log Out",
      "You will be signed out of your account. Your wallet data will remain on this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear Clerk session tokens only  keep wallet data
              if (Platform.OS === "web") {
                // Remove only Clerk session keys, not wallet keys
                if (Platform.OS === 'web') Object.keys(localStorage).forEach(key => {
                  if (key.startsWith("__clerk") || key.startsWith("clerk")) {
                    localStorage.removeItem(key)
                  }
                })
              }
              await signOut()
              router.replace("/(auth)/sign-in")
            } catch (e: any) {
              // Force redirect even if signOut fails
              if (Platform.OS === "web") {
                if (Platform.OS === 'web') Object.keys(localStorage).forEach(key => {
                  if (key.startsWith("__clerk") || key.startsWith("clerk")) {
                    localStorage.removeItem(key)
                  }
                })
              }
              router.replace("/(auth)/sign-in")
            }
          },
        },
      ]
    )
  }

  // Wipe: clears everything including wallet data
  const confirmWipe = () => {
    Alert.alert(
      "Wipe Wallet",
      "This will permanently delete your wallet from this device. Make sure you have backed up your seed phrase.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Wipe Wallet",
          style: "destructive",
          onPress: async () => {
            try {
              clearWallet?.()
              if (Platform.OS === "web") {
                localStorage.clear()
              }
              await signOut()
              router.replace("/(auth)/sign-in")
            } catch {
              if (Platform.OS === "web") localStorage.clear()
              router.replace("/(auth)/sign-in")
            }
          },
        },
      ]
    )
  }

  type ItemType = "nav" | "toggle" | "action" | "info" | "theme"
  type Item = {
    icon: string; iconBg: string; label: string; sublabel?: string
    type: ItemType; value?: boolean; color?: string
    onPress?: () => void; onToggle?: (v: boolean) => void
  }
  type Section = { title: string; items: Item[] }

  const sections: Section[] = [
    {
      title: "WALLET",
      items: [
        { icon: "#", iconBg: "#EEF2FF", label: "Wallet Address",     sublabel: short,                          type: "action", onPress: copyAddress },
        { icon: "*", iconBg: "#FFF7ED", label: "Export Private Key",  sublabel: "Tap to reveal (keep secret)", type: "nav",    onPress: () => Alert.alert("Security Notice", "Never share your private key.") },
        { icon: "2", iconBg: "#EEF2FF", label: "Two-Factor Auth",     sublabel: "Authenticator, SMS, Backup codes", type: "nav",    onPress: () => router.push("/mfa" as any) },
        { icon: "S", iconBg: "#ECFDF5", label: "Backup Seed Phrase",  sublabel: "Verify your recovery words",  type: "nav",    onPress: () => Alert.alert("Backup", "Write down your 12-word seed phrase safely.") },
        { icon: "N", iconBg: "#F0F9FF", label: "Active Network",      sublabel: activeChain.name,              type: "info" },
        { icon: "AA", iconBg: "#EEF2FF", label: "Smart Account",
          sublabel: aaLoading ? "Loading..." : aaInfo ? aaInfo.address.slice(0,10) + "..." + aaInfo.address.slice(-8) : Platform.OS === "web" ? "Native only" : !chainSupportsAA(activeChain.id) ? "Not supported on " + activeChain.name : "Tap to load",
          type: "action", onPress: aaInfo ? copyAAAddress : undefined },
        { icon: aaInfo?.isDeployed ? "" : "", iconBg: aaInfo?.isDeployed ? "#ECFDF5" : "#F8FAFF",
          label: "Account Status",
          sublabel: aaLoading ? "Checking..." : aaInfo?.isDeployed ? "Deployed on-chain" : aaInfo ? "Not yet deployed (deploys on first tx)" : "",
          type: "info" },
        { icon: "", iconBg: "#FFFBEB", label: "Gas Sponsorship",
          sublabel: aaInfo?.gasless ? "Gasless  Pimlico sponsors gas" : "Standard gas (add Pimlico key for gasless)",
          type: "info" },
      ],
    },
    {
      title: "APPEARANCE",
      items: [
        { icon: "TH", iconBg: "#EEF2FF", label: "Theme", sublabel: mode === "light" ? "Light" : mode === "dark" ? "Dark" : "Pro", type: "theme", onPress: () => {} },
      ],
    },
    {
      title: "SECURITY",
      items: [
        { icon: "H", iconBg: "#F8FAFF", label: "Hide Balance",   sublabel: "Mask amounts on dashboard",      type: "toggle", value: hideBalance,   onToggle: setHideBalance },
        { icon: "L", iconBg: "#F8FAFF", label: "Biometric Lock", sublabel: "Require Face ID / fingerprint",  type: "toggle", value: biometrics,    onToggle: setBiometrics },
      ],
    },
    {
      title: "APP",
      items: [
        { icon: "B", iconBg: "#FFF7ED", label: "Push Notifications", sublabel: "Transaction alerts",      type: "toggle", value: notifications, onToggle: setNotifications },
        { icon: "T", iconBg: "#F8FAFF", label: "Testnet Mode",        sublabel: "Show test networks",      type: "toggle", value: testnet,        onToggle: setTestnet },
        { icon: "H", iconBg: "#EEF2FF", label: "Transaction History", sublabel: "View all past activity",  type: "nav",    onPress: () => router.push("/history" as any) },
        { icon: "C", iconBg: "#ECFDF5", label: "Address Book",        sublabel: "Saved contacts",          type: "nav",    onPress: () => router.push("/addressbook" as any) },
      ],
    },
    {
      title: "ABOUT",
      items: [
        { icon: "V", iconBg: "#F8FAFF", label: "Version",    sublabel: "1.0.0",                   type: "info" },
        { icon: "E", iconBg: "#F8FAFF", label: "Encryption", sublabel: "AES-256-GCM",             type: "info" },
        { icon: "N", iconBg: "#F8FAFF", label: "Networks",   sublabel: `${CHAINS.length} chains`, type: "info" },
      ],
    },
    {
      title: "DANGER ZONE",
      items: [
        { icon: "X", iconBg: "#FEF2F2", label: "Wipe Wallet", sublabel: "Remove all data from device", type: "action", color: "#EF4444", onPress: confirmWipe },
      ],
    },
  ]

  return (
    <View style={[st.c, { backgroundColor: theme.bgApp }]}>
      <View style={[st.header, { backgroundColor: theme.bgApp }]}>
        <TouchableOpacity style={st.back} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={[st.backT, { color: theme.accent }]}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={[st.title, { color: theme.textPrimary }]}>Settings</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={true}
        persistentScrollbar={true}
        indicatorStyle="black"
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Profile Card */}
        <View style={[st.profileCard, { backgroundColor: activeChain.color }]}>
          <View style={st.avatar}>
            <Text style={st.avatarT}>{addr ? addr.slice(2,4).toUpperCase() : "KN"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.profileLabel}>Kryptonow Wallet</Text>
            <Text style={st.profileAddr} numberOfLines={1}>{short}</Text>
          </View>
          <TouchableOpacity style={st.copyBtn} onPress={copyAddress} activeOpacity={0.8}>
            <Text style={st.copyBtnT}>{copied ? "Copied!" : "Copy"}</Text>
          </TouchableOpacity>
        </View>

        {sections.map(sec => (
          <View key={sec.title} style={st.section}>
            <Text style={[st.sectionTitle, { color: theme.textMuted }]}>{sec.title}</Text>
            <View style={[st.card, { backgroundColor: theme.bgCard, borderColor: theme.borderLight }]}>
              {sec.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[st.row, idx < sec.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.borderLight }]}
                  onPress={item.type !== "toggle" && item.type !== "info" ? item.onPress : undefined}
                  activeOpacity={item.type === "info" || item.type === "toggle" || item.type === "theme" ? 1 : 0.7}
                >
                  <View style={[st.iconWrap, { backgroundColor: item.color === "#EF4444" ? "#FEF2F2" : item.iconBg }]}>
                    <Text style={[st.iconT, { color: item.color ?? activeChain.color }]}>{item.icon}</Text>
                  </View>
                  <View style={st.rowMid}>
                    <Text style={[st.rowLabel, { color: item.color ?? theme.textPrimary }]}>{item.label}</Text>
                    {item.sublabel && item.type !== "info" && (
                      <Text style={[st.rowSub, { color: theme.textMuted }]}>{item.sublabel}</Text>
                    )}
                  </View>
                  {item.type === "theme" && (
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      {(["light", "dark", "pro"]).map((m) => (
                        <TouchableOpacity
                          key={m}
                          onPress={() => setMode(m as any)}
                          style={{
                            paddingVertical: 5,
                            paddingHorizontal: 12,
                            borderRadius: 20,
                            backgroundColor: mode === m ? activeChain.color : theme.bgCardAlt,
                            borderWidth: 1.5,
                            borderColor: mode === m ? activeChain.color : theme.border,
                          }}
                        >
                          <Text style={{
                            fontSize: 11, fontWeight: "700", textTransform: "capitalize",
                            color: mode === m ? "#fff" : theme.textSecondary,
                          }}>{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {item.type === "toggle" && (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      trackColor={{ false: "#E2E8F0", true: activeChain.color }}
                      thumbColor="#fff"
                    />
                  )}
                  {item.type === "nav"    && <Text style={[st.chevron, { color: theme.textMuted }]}>{">"}</Text>}
                  {item.type === "info"   && <Text style={[st.infoVal, { color: theme.textMuted }]}>{item.sublabel}</Text>}
                  {item.type === "action" && item.color && (
                    <Text style={[st.chevron, { color: item.color }]}>{">"}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {/* Logout button at bottom */}
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <TouchableOpacity style={[st.logoutBtn, { backgroundColor: theme.bgCard, borderColor: theme.border }]} onPress={confirmLogout} activeOpacity={0.85}>
            <Text style={[st.logoutIcon, { color: theme.error }]}>O</Text>
            <Text style={[st.logoutT, { color: theme.textSecondary }]}>Log Out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </View>
  )
}

const st = StyleSheet.create({
  c:            { flex: 1, backgroundColor: "#F0F4FF" },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  back:         { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  backT:        { fontSize: 16, color: "#6366F1", fontWeight: "800" },
  title:        { color: "#1E1B4B", fontSize: 18, fontWeight: "800" },
  profileCard:  { marginHorizontal: 16, marginBottom: 24, borderRadius: 24, padding: 20, flexDirection: "row", alignItems: "center", gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 6 },
  avatar:       { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  avatarT:      { color: "#fff", fontSize: 18, fontWeight: "800" },
  profileLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },
  profileAddr:  { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },
  copyBtn:      { backgroundColor: "rgba(255,255,255,0.2)", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  copyBtnT:     { color: "#fff", fontSize: 13, fontWeight: "700" },
  section:      { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { color: "#94A3B8", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, paddingLeft: 4 },
  card:         { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#F1F5F9", overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  row:          { flexDirection: "row", alignItems: "center", paddingVertical: 15, paddingHorizontal: 16, gap: 14 },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: "#F8FAFF" },
  iconWrap:     { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  iconT:        { fontSize: 15, fontWeight: "800" },
  rowMid:       { flex: 1 },
  rowLabel:     { color: "#1E1B4B", fontSize: 15, fontWeight: "600" },
  rowSub:       { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  chevron:      { color: "#CBD5E1", fontSize: 18, fontWeight: "700" },
  infoVal:      { color: "#94A3B8", fontSize: 13, fontWeight: "500" },
  logoutBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#FFF1F2", borderRadius: 16, paddingVertical: 16, borderWidth: 1.5, borderColor: "#FECDD3" },
  logoutIcon:   { color: "#F43F5E", fontSize: 16, fontWeight: "800" },
  logoutT:      { color: "#F43F5E", fontSize: 16, fontWeight: "700" },
})