import { useState, useEffect } from "react"
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Switch, Alert, Platform } from "react-native"
import { router } from "expo-router"
import { useTheme } from "../context/ThemeContext"
import { Ionicons } from "@expo/vector-icons"
import { useWalletStore } from "../store/walletStore"
import { loadPrivateKey } from "../store/keyStore"
import { CHAINS } from "../utils/chains"
import { useAuth } from "@clerk/expo"
import * as Clipboard from "expo-clipboard"

export default function Settings() {
  const addr        = useWalletStore(s => s.address)
  const activeChain = useWalletStore(s => s.activeChain)
  const clearWallet = useWalletStore(s => s.clearWallet)
  const { signOut } = useAuth()
  const { theme, mode, setMode } = useTheme()

  const [copied,        setCopied]        = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [hideBalance,   setHideBalance]   = useState(false)

  const short = addr ? addr.slice(0, 10) + "..." + addr.slice(-8) : "No wallet"

  const copyAddress = async () => {
    if (!addr) return
    await Clipboard.setStringAsync(addr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const confirmLogout = () => {
    Alert.alert("Log Out", "You will be signed out. Your wallet data stays on this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Log Out", style: "destructive", onPress: async () => {
        try {
          if (Platform.OS === "web") {
            Object.keys(localStorage).forEach(k => {
              if (k.startsWith("__clerk") || k.startsWith("clerk")) localStorage.removeItem(k)
            })
          }
          await signOut()
          router.replace("/(auth)/sign-in")
        } catch { router.replace("/(auth)/sign-in") }
      }},
    ])
  }

  const confirmWipe = () => {
    Alert.alert("Wipe Wallet", "This permanently deletes your wallet. Make sure you have your seed phrase backed up.", [
      { text: "Cancel", style: "cancel" },
      { text: "Wipe Wallet", style: "destructive", onPress: async () => {
        try {
          clearWallet?.()
          if (Platform.OS === "web") localStorage.clear()
          await signOut()
          router.replace("/(auth)/sign-in")
        } catch {
          if (Platform.OS === "web") localStorage.clear()
          router.replace("/(auth)/sign-in")
        }
      }},
    ])
  }

  type ItemType = "nav" | "toggle" | "action" | "info" | "theme"
  type Item = { icon: string; iconBg: string; label: string; sublabel?: string; type: ItemType; value?: boolean; color?: string; onPress?: () => void; onToggle?: (v: boolean) => void }
  type Section = { title: string; items: Item[] }

  const sections: Section[] = [
    { title: "WALLET", items: [
      { icon: "#", iconBg: "#EEF2FF", label: "Wallet Address",    sublabel: short,                           type: "action", onPress: copyAddress },
      { icon: "K", iconBg: "#FFF7ED", label: "Export Private Key", sublabel: "Tap to reveal (keep secret)", type: "nav",    onPress: () => Alert.alert("Security Notice", "Never share your private key with anyone.") },
      { icon: "S", iconBg: "#ECFDF5", label: "Backup Seed Phrase", sublabel: "Verify your recovery words",  type: "nav",    onPress: () => Alert.alert("Backup", "Write down your 12-word seed phrase and store it safely offline.") },
      { icon: "N", iconBg: "#F0F9FF", label: "Active Network",    sublabel: activeChain.name,               type: "info" },
    ]},
    { title: "APPEARANCE", items: [
      { icon: "T", iconBg: "#F8FAFF", label: "Theme", type: "theme" },
    ]},
    { title: "PREFERENCES", items: [
      { icon: "B", iconBg: "#F0FDF4", label: "Hide Balance",   sublabel: "Mask balance on dashboard",  type: "toggle", value: hideBalance,   onToggle: setHideBalance },
      { icon: "N", iconBg: "#FFF7ED", label: "Notifications",  sublabel: "Price alerts & activity",   type: "toggle", value: notifications, onToggle: setNotifications },
    ]},
    { title: "ACTIVITY", items: [
      { icon: "H", iconBg: "#EEF2FF", label: "Transaction History", sublabel: "View all past activity", type: "nav", onPress: () => router.push("/history" as any) },
      { icon: "C", iconBg: "#ECFDF5", label: "Address Book",        sublabel: "Saved contacts",         type: "nav", onPress: () => router.push("/addressbook" as any) },
    ]},
    { title: "ABOUT", items: [
      { icon: "V", iconBg: "#F8FAFF", label: "Version",    sublabel: "1.0.0",                    type: "info" },
      { icon: "E", iconBg: "#F8FAFF", label: "Encryption", sublabel: "AES-256-CBC",              type: "info" },
      { icon: "N", iconBg: "#F8FAFF", label: "Networks",   sublabel: CHAINS.length + " chains",  type: "info" },
    ]},
    { title: "DANGER ZONE", items: [
      { icon: "X", iconBg: "#FEF2F2", label: "Wipe Wallet", sublabel: "Remove all data from device", type: "action", color: "#EF4444", onPress: confirmWipe },
    ]},
  ]

  return (
    <View style={[st.c, { backgroundColor: theme.bgApp }]}>
      <View style={[st.header, { backgroundColor: theme.bgApp }]}>
        <TouchableOpacity style={st.back} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={theme.accent} />
        </TouchableOpacity>
        <Text style={[st.title, { color: theme.textPrimary }]}>Settings</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={true} contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={[st.profileCard, { backgroundColor: activeChain.color }]}>
          <View style={st.avatar}>
            <Text style={st.avatarT}>{addr ? addr.slice(2,4).toUpperCase() : "KN"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={st.profileLabel}>KryptoNow Wallet</Text>
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
                      {(["light","dark","pro"] as const).map(m => (
                        <TouchableOpacity key={m} onPress={() => setMode(m)}
                          style={{ paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20,
                            backgroundColor: mode === m ? activeChain.color : theme.bgApp,
                            borderWidth: 1.5, borderColor: mode === m ? activeChain.color : theme.border }}>
                          <Text style={{ fontSize: 11, fontWeight: "700", textTransform: "capitalize",
                            color: mode === m ? "#fff" : theme.textSecondary }}>{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {item.type === "toggle" && (
                    <Switch value={item.value} onValueChange={item.onToggle}
                      trackColor={{ false: "#E2E8F0", true: activeChain.color }} thumbColor="#fff" />
                  )}
                  {item.type === "nav"    && <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />}
                  {item.type === "info"   && <Text style={[st.infoVal, { color: theme.textMuted }]}>{item.sublabel}</Text>}
                  {item.type === "action" && item.color && <Ionicons name="chevron-forward" size={18} color={item.color} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <TouchableOpacity style={st.logoutBtn} onPress={confirmLogout} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={18} color="#F43F5E" />
            <Text style={st.logoutT}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  )
}

const st = StyleSheet.create({
  c:            { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
  back:         { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  title:        { fontSize: 18, fontWeight: "800" },
  profileCard:  { marginHorizontal: 16, marginBottom: 24, borderRadius: 24, padding: 20, flexDirection: "row", alignItems: "center", gap: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 6 },
  avatar:       { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  avatarT:      { color: "#fff", fontSize: 18, fontWeight: "800" },
  profileLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },
  profileAddr:  { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },
  copyBtn:      { backgroundColor: "rgba(255,255,255,0.2)", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },
  copyBtnT:     { color: "#fff", fontSize: 13, fontWeight: "700" },
  section:      { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, paddingLeft: 4 },
  card:         { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  row:          { flexDirection: "row", alignItems: "center", paddingVertical: 15, paddingHorizontal: 16, gap: 14 },
  iconWrap:     { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  iconT:        { fontSize: 15, fontWeight: "800" },
  rowMid:       { flex: 1 },
  rowLabel:     { fontSize: 15, fontWeight: "600" },
  rowSub:       { fontSize: 12, marginTop: 2 },
  chevron:      { fontSize: 18, fontWeight: "700" },
  infoVal:      { fontSize: 13, fontWeight: "500" },
  logoutBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#FFF1F2", borderRadius: 16, paddingVertical: 16, borderWidth: 1.5, borderColor: "#FECDD3" },
  logoutT:      { color: "#F43F5E", fontSize: 16, fontWeight: "700" },
})