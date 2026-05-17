import { useState } from "react"
import { View, Text, TouchableOpacity, StyleSheet, Image, Alert, Platform } from "react-native"
import { router } from "expo-router"
import { goBack } from "../utils/navigation"
import { useTheme } from "../context/ThemeContext"
import { Ionicons } from "@expo/vector-icons"
import { useWalletStore } from "../store/walletStore"
import * as Clipboard from "expo-clipboard"

const NETWORKS = [
  { id: "eth",     label: "Ethereum",  color: "#6366F1", symbol: "ETH"  },
  { id: "polygon", label: "Polygon",   color: "#8B5CF6", symbol: "POL"  },
  { id: "bnb",     label: "BNB Chain", color: "#F59E0B", symbol: "BNB"  },
  { id: "arb",     label: "Arbitrum",  color: "#3B82F6", symbol: "ARB"  },
]

export default function Receive() {
  const addr = useWalletStore(s => s.address)
  const { theme, mode } = useTheme()
  const [selectedNet, setSelectedNet] = useState(NETWORKS[0])
  const [copied, setCopied]           = useState(false)

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(addr ?? "")}`

  async function copyAddress() {
    if (!addr) return
    try {
      await Clipboard.setStringAsync(addr)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      Alert.alert("Copied", addr)
    }
  }

  return (
    <View style={s.c}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => goBack()}>
          <Ionicons name="arrow-back" size={22} color="#6366F1" />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Receive</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        <Text style={s.label}>Network</Text>
        <View style={s.netRow}>
          {NETWORKS.map(n => (
            <TouchableOpacity
              key={n.id}
              style={[s.netTab, selectedNet.id === n.id && { backgroundColor: n.color, borderColor: n.color }]}
              onPress={() => setSelectedNet(n)}
            >
              <Text style={[s.netTabT, selectedNet.id === n.id && { color: "#fff" }]}>
                {n.symbol}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[s.infoBanner, { borderColor: selectedNet.color + "40", backgroundColor: selectedNet.color + "10" }]}>
          <Text style={[s.infoT, { color: selectedNet.color }]}>
            Only send {selectedNet.symbol} and {selectedNet.label}-compatible tokens to this address.
          </Text>
        </View>

        <View style={s.card}>
          <View style={s.qrWrap}>
            {addr ? (
              <Image source={{ uri: qrUrl }} style={s.qr} resizeMode="contain" />
            ) : (
              <View style={s.qrPlaceholder}>
                <Text style={{ color: theme.textMuted, fontSize: 13 }}>No address</Text>
              </View>
            )}
          </View>

          <View style={[s.networkBadge, { backgroundColor: selectedNet.color }]}>
            <View style={s.networkDot} />
            <Text style={s.networkBadgeT}>{selectedNet.label}</Text>
          </View>

          <Text style={s.addrLabel}>Your {selectedNet.symbol} Address</Text>
          <Text style={s.addr} selectable>{addr ?? "-"}</Text>

          <TouchableOpacity
            style={[s.copyBtn, copied && s.copyBtnDone]}
            onPress={copyAddress}
            activeOpacity={0.8}
          >
            <Text style={[s.copyBtnT, copied && { color: "#10B981" }]}>
              {copied ? "Copied!" : "Copy Address"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={s.safeCard}>
          {[
            "Always double-check the network before sending",
            "Sending wrong-chain tokens may result in permanent loss",
            "Share only with trusted senders",
          ].map(tip => (
            <View key={tip} style={s.tip}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#D97706" style={{ marginTop:2 }} />
              <Text style={s.tipT}>{tip}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  c:             { flex:1, backgroundColor:"#F8FAFF" },
  hdr:           { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:20, paddingTop:20, paddingBottom:16 },
  back:          { width:38, height:38, borderRadius:12, backgroundColor:"#fff", borderWidth:1, borderColor:"#E2E8F0", alignItems:"center", justifyContent:"center" },
  backT:         { color:"#6366F1", fontSize:18, fontWeight:"700" },
  hdrTitle:      { color:"#1E1B4B", fontSize:17, fontWeight:"700" },
  label:         { color:"#64748B", fontSize:13, fontWeight:"600", marginBottom:8, letterSpacing:0.3, textTransform:"uppercase" },
  netRow:        { flexDirection:"row", gap:8, marginBottom:14 },
  netTab:        { flex:1, paddingVertical:8, borderRadius:12, borderWidth:1.5, borderColor:"#E2E8F0", alignItems:"center", backgroundColor:"#fff" },
  netTabT:       { color:"#64748B", fontSize:12, fontWeight:"600" },
  infoBanner:    { borderRadius:12, borderWidth:1, padding:11, marginBottom:16 },
  infoT:         { fontSize:12, lineHeight:18, fontWeight:"500" },
  card:          { backgroundColor:"#fff", borderRadius:24, borderWidth:1, borderColor:"#E2E8F0", padding:24, alignItems:"center", marginBottom:14, shadowColor:"#64748B", shadowOffset:{width:0,height:4}, shadowOpacity:0.06, shadowRadius:16, elevation:4 },
  qrWrap:        { width:180, height:180, borderRadius:16, overflow:"hidden", marginBottom:16, borderWidth:1, borderColor:"#E2E8F0" },
  qr:            { width:180, height:180 },
  qrPlaceholder: { width:180, height:180, backgroundColor:"#F8FAFF", alignItems:"center", justifyContent:"center" },
  networkBadge:  { flexDirection:"row", alignItems:"center", gap:6, paddingVertical:5, paddingHorizontal:12, borderRadius:20, marginBottom:14 },
  networkDot:    { width:6, height:6, borderRadius:3, backgroundColor:"rgba(255,255,255,0.8)" },
  networkBadgeT: { color:"#fff", fontSize:12, fontWeight:"600" },
  addrLabel:     { color:"#94A3B8", fontSize:12, marginBottom:8 },
  addr:          { color:"#1E1B4B", fontSize:13, fontWeight:"500", textAlign:"center", lineHeight:22, letterSpacing:0.3, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", marginBottom:16 },
  copyBtn:       { flexDirection:"row", backgroundColor:"#EEF2FF", paddingVertical:11, paddingHorizontal:28, borderRadius:12, borderWidth:1.5, borderColor:"#C7D2FE" },
  copyBtnDone:   { backgroundColor:"#D1FAE5", borderColor:"#6EE7B7" },
  copyBtnT:      { color:"#6366F1", fontSize:14, fontWeight:"600" },
  safeCard:      { backgroundColor:"#FFFBEB", borderRadius:16, borderWidth:1, borderColor:"#FDE68A", padding:16, gap:8 },
  tip:           { flexDirection:"row", gap:10, alignItems:"flex-start" },
  tipDot:        { color:"#D97706", fontSize:14, marginTop:1 },
  tipT:          { flex:1, color:"#92400E", fontSize:12, lineHeight:18 },
})