import { useState, useCallback } from "react"
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Platform,
} from "react-native"
import { router } from "expo-router"
import { goBack } from "../utils/navigation"
import { Ionicons } from "@expo/vector-icons"
import { useWalletStore } from "../store/walletStore"

//  Types 
type HWStatus = "idle" | "connecting" | "connected" | "error"
type HWDevice = "ledger" | "trezor"

interface ConnectedDevice {
  type: HWDevice
  address: string
  path: string
  model: string
}

//  Ledger Connection 
async function connectLedger(): Promise<ConnectedDevice> {
  if (typeof window === "undefined") throw new Error("Web only feature")

  // @ts-ignore
  if (!navigator?.hid) {
    throw new Error("WebHID not supported. Please use Chrome or Edge browser.")
  }

  const TransportWebHID = (await import("@ledgerhq/hw-transport-webhid")).default
  const Eth = (await import("@ledgerhq/hw-app-eth")).default

  const transport = await TransportWebHID.create()
  const eth = new Eth(transport)

  const PATH = "44'/60'/0'/0/0"
  const result = await eth.getAddress(PATH, false, true)

  await transport.close()

  return {
    type: "ledger",
    address: result.address,
    path: PATH,
    model: "Ledger",
  }
}

//  Trezor Connection 
async function connectTrezor(): Promise<ConnectedDevice> {
  return new Promise((resolve, reject) => {
    // Use Trezor Connect iframe (no npm package needed)
    const script = document.createElement("script")
    script.src = "https://connect.trezor.io/9/trezor-connect.js"
    script.onload = async () => {
      try {
        // @ts-ignore
        const TrezorConnect = window.TrezorConnect
        await TrezorConnect.init({
          lazyLoad: true,
          manifest: { email: "support@kryptonow.xyz", appUrl: "https://kryptonow.xyz" },
        })

        const result = await TrezorConnect.ethereumGetAddress({
          path: "m/44'/60'/0'/0/0",
          showOnTrezor: true,
        })

        if (!result.success) throw new Error(result.payload.error)

        resolve({
          type: "trezor",
          address: result.payload.address,
          path: "m/44'/60'/0'/0/0",
          model: "Trezor",
        })
      } catch (e: any) {
        reject(e)
      }
    }
    script.onerror = () => reject(new Error("Failed to load Trezor Connect"))
    document.head.appendChild(script)
  })
}

//  Main Component 
export default function HardwareWallet() {
  const activeChain = useWalletStore(s => s.activeChain)
  const [status,  setStatus]  = useState<HWStatus>("idle")
  const [device,  setDevice]  = useState<HWDevice | null>(null)
  const [connected, setConnected] = useState<ConnectedDevice | null>(null)
  const [error,   setError]   = useState<string | null>(null)

  const connect = useCallback(async (type: HWDevice) => {
    setDevice(type)
    setStatus("connecting")
    setError(null)

    try {
      const result = type === "ledger" ? await connectLedger() : await connectTrezor()
      setConnected(result)
      setStatus("connected")
    } catch (e: any) {
      setError(e.message ?? "Connection failed")
      setStatus("error")
    }
  }, [])

  const reset = () => {
    setStatus("idle")
    setDevice(null)
    setConnected(null)
    setError(null)
  }

  const useAsWatchOnly = () => {
    if (!connected) return
    // Save as watch-only wallet (no private key)
    try {
      localStorage.setItem("kn_hw_address", connected.address)
      localStorage.setItem("kn_hw_type", connected.type)
      localStorage.setItem("kn_hw_path", connected.path)
    } catch {}
    router.push("/dashboard" as any)
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={s.title}>Hardware Wallet</Text>
      </View>

      {/* Web only warning */}
      {Platform.OS !== "web" && (
        <View style={s.warnBox}>
          <Ionicons name="warning-outline" size={20} color="#F59E0B" />
          <Text style={s.warnText}>Hardware wallet connection is only available on web (Chrome/Edge).</Text>
        </View>
      )}

      {/* Idle state - choose device */}
      {status === "idle" && (
        <>
          <Text style={s.sectionTitle}>Select Your Device</Text>

          {/* Ledger */}
          <TouchableOpacity
            style={[s.deviceCard, { borderColor: activeChain.color + "55" }]}
            onPress={() => connect("ledger")}
            activeOpacity={0.8}
          >
            <View style={[s.deviceIcon, { backgroundColor: "#000" }]}>
              <Text style={s.deviceIconText}>L</Text>
            </View>
            <View style={s.deviceInfo}>
              <Text style={s.deviceName}>Ledger</Text>
              <Text style={s.deviceSub}>Nano S, Nano X, Nano S Plus</Text>
              <View style={s.tagRow}>
                <View style={s.tag}><Text style={s.tagText}>USB</Text></View>
                <View style={s.tag}><Text style={s.tagText}>Chrome/Edge only</Text></View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {/* Trezor */}
          <TouchableOpacity
            style={[s.deviceCard, { borderColor: activeChain.color + "55" }]}
            onPress={() => connect("trezor")}
            activeOpacity={0.8}
          >
            <View style={[s.deviceIcon, { backgroundColor: "#1A1A1A" }]}>
              <Text style={s.deviceIconText}>T</Text>
            </View>
            <View style={s.deviceInfo}>
              <Text style={s.deviceName}>Trezor</Text>
              <Text style={s.deviceSub}>Model One, Model T, Safe 3</Text>
              <View style={s.tagRow}>
                <View style={s.tag}><Text style={s.tagText}>USB</Text></View>
                <View style={s.tag}><Text style={s.tagText}>All browsers</Text></View>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
          </TouchableOpacity>

          {/* Instructions */}
          <View style={[s.infoCard, { borderColor: activeChain.color + "33", backgroundColor: activeChain.color + "08" }]}>
            <Text style={[s.infoTitle, { color: activeChain.color }]}>Before connecting</Text>
            {[
              "Connect your device via USB cable",
              "Unlock your device with your PIN",
              "Open the Ethereum app on your device",
              "Allow browser permission when prompted",
            ].map((step, i) => (
              <View key={i} style={s.stepRow}>
                <View style={[s.stepNum, { backgroundColor: activeChain.color }]}>
                  <Text style={s.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={s.stepText}>{step}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Connecting state */}
      {status === "connecting" && (
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color={activeChain.color} />
          <Text style={s.connectingTitle}>
            Connecting to {device === "ledger" ? "Ledger" : "Trezor"}...
          </Text>
          <Text style={s.connectingSub}>
            {device === "ledger"
              ? "Check your Ledger device and approve the connection"
              : "A Trezor popup will appear  follow the instructions"}
          </Text>
        </View>
      )}

      {/* Connected state */}
      {status === "connected" && connected && (
        <>
          <View style={[s.successCard, { borderColor: "#10B981" }]}>
            <View style={s.successHeader}>
              <Ionicons name="checkmark-circle" size={32} color="#10B981" />
              <Text style={s.successTitle}>Device Connected!</Text>
            </View>
            <View style={s.addrRow}>
              <Text style={s.addrLabel}>Address</Text>
              <Text style={s.addrValue}>{connected.address}</Text>
            </View>
            <View style={s.addrRow}>
              <Text style={s.addrLabel}>Device</Text>
              <Text style={s.addrValue}>{connected.model}</Text>
            </View>
            <View style={s.addrRow}>
              <Text style={s.addrLabel}>Path</Text>
              <Text style={s.addrValue}>{connected.path}</Text>
            </View>
          </View>

          <View style={[s.infoCard, { borderColor: "#F59E0B33", backgroundColor: "#FFFBEB" }]}>
            <Ionicons name="shield-outline" size={18} color="#F59E0B" />
            <Text style={s.watchOnlyNote}>
              Your private key stays on your hardware device. KryptoNow will use this as a watch-only wallet and prompt your device to sign transactions.
            </Text>
          </View>

          <TouchableOpacity
            style={[s.useBtn, { backgroundColor: activeChain.color }]}
            onPress={useAsWatchOnly}
          >
            <Ionicons name="wallet-outline" size={18} color="#fff" />
            <Text style={s.useBtnText}>Use This Wallet</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.resetBtn} onPress={reset}>
            <Text style={s.resetBtnText}>Connect Different Device</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Error state */}
      {status === "error" && (
        <View style={s.centerBox}>
          <Ionicons name="close-circle" size={48} color="#EF4444" />
          <Text style={s.errorTitle}>Connection Failed</Text>
          <Text style={s.errorMsg}>{error}</Text>
          <TouchableOpacity
            style={[s.retryBtn, { backgroundColor: activeChain.color }]}
            onPress={reset}
          >
            <Text style={s.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#F8FAFC" },
  content:        { padding: 16, paddingBottom: 40 },
  header:         { flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 12 },
  backBtn:        { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  title:          { fontSize: 22, fontWeight: "800", color: "#1E1B4B" },
  warnBox:        { flexDirection: "row", gap: 10, backgroundColor: "#FFFBEB", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#FDE68A", marginBottom: 20 },
  warnText:       { flex: 1, fontSize: 13, color: "#92400E", lineHeight: 18 },
  sectionTitle:   { fontSize: 13, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 },
  deviceCard:     { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1.5 },
  deviceIcon:     { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  deviceIconText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  deviceInfo:     { flex: 1 },
  deviceName:     { fontSize: 17, fontWeight: "800", color: "#1E1B4B" },
  deviceSub:      { fontSize: 13, color: "#64748B", marginTop: 2 },
  tagRow:         { flexDirection: "row", gap: 6, marginTop: 6 },
  tag:            { backgroundColor: "#F1F5F9", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  tagText:        { fontSize: 11, color: "#64748B", fontWeight: "600" },
  infoCard:       { borderRadius: 14, padding: 16, borderWidth: 1, marginTop: 8, gap: 10 },
  infoTitle:      { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  stepRow:        { flexDirection: "row", alignItems: "center", gap: 10 },
  stepNum:        { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  stepNumText:    { color: "#fff", fontSize: 11, fontWeight: "800" },
  stepText:       { fontSize: 13, color: "#475569", flex: 1 },
  centerBox:      { alignItems: "center", paddingVertical: 40, gap: 16 },
  connectingTitle:{ fontSize: 18, fontWeight: "700", color: "#1E1B4B", textAlign: "center" },
  connectingSub:  { fontSize: 14, color: "#64748B", textAlign: "center", lineHeight: 20, maxWidth: 280 },
  successCard:    { backgroundColor: "#fff", borderRadius: 16, padding: 20, borderWidth: 1.5, marginBottom: 16 },
  successHeader:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  successTitle:   { fontSize: 18, fontWeight: "800", color: "#10B981" },
  addrRow:        { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  addrLabel:      { fontSize: 13, color: "#94A3B8", fontWeight: "500" },
  addrValue:      { fontSize: 13, color: "#1E1B4B", fontWeight: "600", maxWidth: "70%", textAlign: "right" },
  watchOnlyNote:  { fontSize: 13, color: "#92400E", lineHeight: 18, flex: 1 },
  useBtn:         { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 16, marginBottom: 10 },
  useBtnText:     { color: "#fff", fontSize: 16, fontWeight: "800" },
  resetBtn:       { padding: 14, alignItems: "center" },
  resetBtnText:   { color: "#64748B", fontWeight: "600", fontSize: 14 },
  errorTitle:     { fontSize: 18, fontWeight: "700", color: "#EF4444" },
  errorMsg:       { fontSize: 14, color: "#64748B", textAlign: "center", maxWidth: 280 },
  retryBtn:       { padding: 14, borderRadius: 14, paddingHorizontal: 32 },
  retryBtnText:   { color: "#fff", fontWeight: "700", fontSize: 14 },
})