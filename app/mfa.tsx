import { useState, useEffect } from "react"
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, ActivityIndicator, Alert, Image,
  Modal, FlatList,
} from "react-native"
import { router } from "expo-router"
import { goBack } from "../utils/navigation"
import { Ionicons } from "@expo/vector-icons"
import { useUser } from "@clerk/expo"
import { useWalletStore } from "../store/walletStore"
import { COUNTRY_CODES } from "../utils/countryCodes"

type CountryCode = (typeof COUNTRY_CODES)[number]

type MFAStep = "overview" | "totp_setup" | "totp_verify" | "sms_setup" | "sms_verify" | "backup_codes"
type MFAMethod = { type: string; enabled: boolean; id?: string }

export default function MFASetup() {
  const activeChain = useWalletStore(s => s.activeChain)
  const { user, isLoaded } = useUser()

  const [step,        setStep]       = useState<MFAStep>("overview")
  const [loading,     setLoading]    = useState(false)
  const [error,       setError]      = useState("")
  const [totpUri,     setTotpUri]    = useState("")
  const [totpSecret,  setTotpSecret] = useState("")
  const [totpCode,    setTotpCode]   = useState("")
  const [phone,       setPhone]      = useState("")
  const [smsCode,     setSmsCode]    = useState("")
  const [backupCodes, setBackupCodes]= useState<string[]>([])
  const [methods,     setMethods]    = useState<MFAMethod[]>([])
  const [totpResource, setTotpResource] = useState<any>(null)
  const [phoneResource, setPhoneResource] = useState<any>(null)
  const [voiceMode, setVoiceMode] = useState(false)
  const [showPicker, setShowPicker] = useState(false)
  const [countrySearch, setCountrySearch] = useState("")
  const [countryCode, setCountryCode] = useState<CountryCode>(
    COUNTRY_CODES.find(c => c.code === "US") ?? COUNTRY_CODES[0],
  )

  useEffect(() => {
    if (!isLoaded || !user) return
    const enabled: MFAMethod[] = []
    // Check TOTP
    if ((user as any).totpEnabled) enabled.push({ type: "totp", enabled: true })
    // Check phone
    const phones = (user as any).phoneNumbers ?? []
    phones.forEach((p: any) => {
      if (p.verification?.status === "verified") {
        enabled.push({ type: "sms", enabled: true, id: p.id })
      }
    })
    // Check backup codes
    if ((user as any).backupCodeEnabled) enabled.push({ type: "backup", enabled: true })
    setMethods(enabled)
  }, [isLoaded, user])

  //  TOTP Setup 
  const startTOTP = async () => {
    setLoading(true); setError("")
    try {
      const totp = await (user as any).createTOTP()
      setTotpUri(totp.uri ?? "")
      setTotpSecret(totp.secret ?? "")
      setTotpResource(totp)
      setStep("totp_setup")
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? "Failed to setup authenticator")
    } finally { setLoading(false) }
  }

  const verifyTOTP = async () => {
    if (!totpCode || totpCode.length !== 6) return setError("Enter 6-digit code")
    setLoading(true); setError("")
    try {
      await totpResource.verify({ code: totpCode })
      Alert.alert(" Success", "Authenticator app enabled!")
      setStep("overview")
      setTotpCode("")
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? "Invalid code")
    } finally { setLoading(false) }
  }

  //  SMS Setup 
  const startSMS = async () => {
    if (!phone || phone.length < 8) return setError("Enter a valid phone number")
    setLoading(true); setError("")
    try {
      const fullPhone = `${countryCode.dial}${phone.replace(/\D/g, "")}`
      const phoneNum = await (user as any).createPhoneNumber({ phoneNumber: fullPhone })
      await phoneNum.prepareVerification()
      setPhoneResource(phoneNum)
      setStep("sms_verify")
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? "Failed to send SMS")
    } finally { setLoading(false) }
  }

  const verifySMS = async () => {
    if (!smsCode || smsCode.length < 4) return setError("Enter the verification code")
    setLoading(true); setError("")
    try {
      await phoneResource.attemptVerification({ code: smsCode })
      Alert.alert(" Success", "SMS authentication enabled!")
      setStep("overview")
      setSmsCode("")
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? "Invalid code")
    } finally { setLoading(false) }
  }

  //  Backup Codes 
  const generateBackupCodes = async () => {
    setLoading(true); setError("")
    try {
      const result = await (user as any).createBackupCode()
      setBackupCodes(result.codes ?? [])
      setStep("backup_codes")
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? "Failed to generate backup codes")
    } finally { setLoading(false) }
  }

  //  Disable Method 
  const disableTOTP = async () => {
    Alert.alert("Disable Authenticator?", "This will remove TOTP from your account.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disable", style: "destructive", onPress: async () => {
        try { await (user as any).disableTOTP() } catch {}
      }}
    ])
  }

  if (!isLoaded) return <ActivityIndicator style={{ flex: 1 }} color={activeChain.color} />

  //  TOTP Setup Screen 
  if (step === "totp_setup") return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => setStep("overview")} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={s.title}>Scan QR Code</Text>
      </View>
      <Text style={s.sub}>Open Google Authenticator, Authy, or 1Password and scan this QR code.</Text>

      {totpUri ? (
        <View style={s.qrBox}>
          <Image
            source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri)}` }}
            style={s.qrImage}
          />
        </View>
      ) : null}

      <View style={s.secretBox}>
        <Text style={s.secretLabel}>Manual entry key</Text>
        <Text style={s.secretText} selectable>{totpSecret}</Text>
      </View>

      <TouchableOpacity onPress={() => setStep("totp_verify")} style={[s.primaryBtn, { backgroundColor: activeChain.color }]}>
        <Text style={s.primaryBtnText}>I've scanned it </Text>
      </TouchableOpacity>
    </ScrollView>
  )

  //  TOTP Verify Screen 
  if (step === "totp_verify") return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => setStep("totp_setup")} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={s.title}>Enter Code</Text>
      </View>
      <Text style={s.sub}>Enter the 6-digit code from your authenticator app to confirm setup.</Text>

      <TextInput
        style={s.codeInput}
        placeholder="000000"
        value={totpCode}
        onChangeText={setTotpCode}
        keyboardType="number-pad"
        maxLength={6}
        textAlign="center"
      />
      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <TouchableOpacity onPress={verifyTOTP} disabled={loading} style={[s.primaryBtn, { backgroundColor: activeChain.color }]}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Verify & Enable</Text>}
      </TouchableOpacity>
    </ScrollView>
  )

  //  SMS Setup Screen 
  if (step === "sms_setup") {
    const filtered = COUNTRY_CODES.filter(c =>
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.dial.includes(countrySearch)
    )
    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <Modal visible={showPicker} animationType="slide" onRequestClose={() => setShowPicker(false)}>
          <View style={s.pickerModal}>
            <View style={s.pickerHeader}>
              <Text style={s.pickerTitle}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons name="close" size={24} color="#1E1B4B" />
              </TouchableOpacity>
            </View>
            <TextInput
              style={s.pickerSearch}
              placeholder="Search country or code..."
              value={countrySearch}
              onChangeText={setCountrySearch}
              autoFocus
            />
            <FlatList
              data={filtered}
              keyExtractor={i => i.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={s.pickerItem}
                  onPress={() => { setCountryCode(item); setShowPicker(false); setCountrySearch("") }}
                >
                  <Text style={s.pickerFlag}>{item.flag}</Text>
                  <Text style={s.pickerName}>{item.name}</Text>
                  <Text style={s.pickerDial}>{item.dial}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </Modal>

        <View style={s.header}>
          <TouchableOpacity onPress={() => setStep("overview")} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1E1B4B" />
          </TouchableOpacity>
          <View>
            <Text style={s.title}>Phone Verification</Text>
            <Text style={s.subtitle}>SMS or Voice call</Text>
          </View>
        </View>

        {/* Voice/SMS toggle */}
        <View style={s.toggleRow}>
          <TouchableOpacity
            style={[s.toggleBtn, !voiceMode && { backgroundColor: activeChain.color }]}
            onPress={() => setVoiceMode(false)}
          >
            <Ionicons name="chatbubble-outline" size={16} color={!voiceMode ? "#fff" : "#64748B"} />
            <Text style={[s.toggleText, !voiceMode && { color: "#fff" }]}>SMS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.toggleBtn, voiceMode && { backgroundColor: activeChain.color }]}
            onPress={() => setVoiceMode(true)}
          >
            <Ionicons name="call-outline" size={16} color={voiceMode ? "#fff" : "#64748B"} />
            <Text style={[s.toggleText, voiceMode && { color: "#fff" }]}>Voice Call</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.sub}>
          {voiceMode
            ? "You will receive an automated voice call reading your 6-digit code."
            : "Enter your phone number to receive a verification code via SMS."}
        </Text>

        {/* Phone input with country picker */}
        <View style={s.phoneRow}>
          <TouchableOpacity style={s.countryBtn} onPress={() => setShowPicker(true)}>
            <Text style={s.countryFlag}>{countryCode.flag}</Text>
            <Text style={s.countryDial}>{countryCode.dial}</Text>
            <Ionicons name="chevron-down" size={14} color="#64748B" />
          </TouchableOpacity>
          <TextInput
            style={s.phoneInput}
            placeholder="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* Info banner */}
        <View style={[s.infoBanner, { borderColor: activeChain.color + "33", backgroundColor: activeChain.color + "08" }]}>
          <Ionicons name={voiceMode ? "call-outline" : "chatbubble-outline"} size={16} color={activeChain.color} />
          <Text style={[s.infoBannerText, { color: activeChain.color }]}>
            {voiceMode
              ? "A robot will call and say your code twice. Answer within 60 seconds."
              : "Standard SMS rates may apply depending on your carrier."}
          </Text>
        </View>

        {error ? <Text style={s.errorText}>{error}</Text> : null}

        <TouchableOpacity
          onPress={startSMS}
          disabled={loading}
          style={[s.primaryBtn, { backgroundColor: activeChain.color }]}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : (
              <View style={s.btnRow}>
                <Ionicons name={voiceMode ? "call-outline" : "send-outline"} size={18} color="#fff" />
                <Text style={s.primaryBtnText}>
                  {voiceMode ? "Call Me Now" : "Send SMS Code"}
                </Text>
              </View>
            )
          }
        </TouchableOpacity>
      </ScrollView>
    )
  }

  //  SMS Verify Screen 
  if (step === "sms_verify") return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => setStep("sms_setup")} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={s.title}>Enter Code</Text>
      </View>

      <View style={s.verifyInfo}>
        <Ionicons name={voiceMode ? "call-outline" : "chatbubble-outline"} size={32} color={activeChain.color} />
        <Text style={s.verifyTitle}>
          {voiceMode ? "Check Your Phone" : "Check Your Messages"}
        </Text>
        <Text style={s.verifySub}>
          {voiceMode
            ? `We called ${countryCode.dial} ${phone} with your 6-digit code`
            : `We sent a code to ${countryCode.dial} ${phone}`}
        </Text>
      </View>

      <TextInput
        style={s.codeInput}
        placeholder="000000"
        value={smsCode}
        onChangeText={setSmsCode}
        keyboardType="number-pad"
        maxLength={6}
        textAlign="center"
      />
      {error ? <Text style={s.errorText}>{error}</Text> : null}

      <TouchableOpacity onPress={verifySMS} disabled={loading} style={[s.primaryBtn, { backgroundColor: activeChain.color }]}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Verify & Enable</Text>}
      </TouchableOpacity>

      {/* Resend options */}
      <View style={s.resendBox}>
        <Text style={s.resendTitle}>Did not receive the code?</Text>
        <View style={s.resendRow}>
          <TouchableOpacity
            style={[s.resendBtn, { borderColor: activeChain.color }]}
            onPress={() => { setVoiceMode(false); startSMS() }}
          >
            <Ionicons name="chatbubble-outline" size={16} color={activeChain.color} />
            <Text style={[s.resendBtnText, { color: activeChain.color }]}>Resend SMS</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.resendBtn, { borderColor: "#10B981" }]}
            onPress={() => { setVoiceMode(true); startSMS() }}
          >
            <Ionicons name="call-outline" size={16} color="#10B981" />
            <Text style={[s.resendBtnText, { color: "#10B981" }]}>Call Instead</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => setStep("sms_setup")} style={s.changePhone}>
          <Text style={s.changePhoneText}>Change phone number</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )

  //  Backup Codes Screen 
  if (step === "backup_codes") return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => setStep("overview")} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={s.title}>Backup Codes</Text>
      </View>

      <View style={[s.warnBox, { borderColor: "#F59E0B", backgroundColor: "#FFFBEB" }]}>
        <Ionicons name="warning-outline" size={18} color="#F59E0B" />
        <Text style={s.warnText}>Save these codes somewhere safe. Each can only be used once.</Text>
      </View>

      <View style={s.codesGrid}>
        {backupCodes.map((code, i) => (
          <View key={i} style={[s.codeChip, { borderColor: activeChain.color + "33" }]}>
            <Text style={s.codeChipNum}>{i + 1}.</Text>
            <Text style={s.codeChipText} selectable>{code}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity onPress={() => setStep("overview")} style={[s.primaryBtn, { backgroundColor: activeChain.color }]}>
        <Text style={s.primaryBtnText}>I've saved these codes</Text>
      </TouchableOpacity>
    </ScrollView>
  )

  //  Overview Screen 
  const isTOTPEnabled  = methods.some(m => m.type === "totp")
  const isSMSEnabled   = methods.some(m => m.type === "sms")
  const isBackupEnabled= methods.some(m => m.type === "backup")

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={s.title}>Two-Factor Auth</Text>
      </View>

      <View style={[s.banner, { backgroundColor: activeChain.color + "12", borderColor: activeChain.color + "33" }]}>
        <Ionicons name="shield-checkmark-outline" size={20} color={activeChain.color} />
        <Text style={[s.bannerText, { color: activeChain.color }]}>
          Add multiple authentication methods. If one fails, you can use another to sign in.
        </Text>
      </View>

      {/* Method 1 - TOTP */}
      <View style={s.methodCard}>
        <View style={s.methodLeft}>
          <View style={[s.methodIcon, { backgroundColor: isTOTPEnabled ? "#ECFDF5" : "#F1F5F9" }]}>
            <Ionicons name="phone-portrait-outline" size={22} color={isTOTPEnabled ? "#10B981" : "#64748B"} />
          </View>
          <View style={s.methodInfo}>
            <Text style={s.methodName}>Authenticator App</Text>
            <Text style={s.methodSub}>Google Authenticator, Authy, 1Password</Text>
            <View style={[s.badge, { backgroundColor: isTOTPEnabled ? "#ECFDF5" : "#F1F5F9" }]}>
              <Text style={[s.badgeText, { color: isTOTPEnabled ? "#10B981" : "#94A3B8" }]}>
                {isTOTPEnabled ? " Enabled" : "Not set up"}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[s.methodBtn, { backgroundColor: isTOTPEnabled ? "#FEF2F2" : activeChain.color }]}
          onPress={isTOTPEnabled ? disableTOTP : startTOTP}
          disabled={loading}
        >
          <Text style={[s.methodBtnText, { color: isTOTPEnabled ? "#EF4444" : "#fff" }]}>
            {isTOTPEnabled ? "Disable" : "Enable"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Method 2 - SMS */}
      <View style={s.methodCard}>
        <View style={s.methodLeft}>
          <View style={[s.methodIcon, { backgroundColor: isSMSEnabled ? "#ECFDF5" : "#F1F5F9" }]}>
            <Ionicons name="chatbubble-outline" size={22} color={isSMSEnabled ? "#10B981" : "#64748B"} />
          </View>
          <View style={s.methodInfo}>
            <Text style={s.methodName}>SMS Text Message</Text>
            <Text style={s.methodSub}>Receive a code via text message</Text>
            <View style={[s.badge, { backgroundColor: isSMSEnabled ? "#ECFDF5" : "#F1F5F9" }]}>
              <Text style={[s.badgeText, { color: isSMSEnabled ? "#10B981" : "#94A3B8" }]}>
                {isSMSEnabled ? " Enabled" : "Not set up"}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[s.methodBtn, { backgroundColor: isSMSEnabled ? "#FEF2F2" : activeChain.color }]}
          onPress={() => !isSMSEnabled && setStep("sms_setup")}
          disabled={loading || isSMSEnabled}
        >
          <Text style={[s.methodBtnText, { color: isSMSEnabled ? "#EF4444" : "#fff" }]}>
            {isSMSEnabled ? "Enabled" : "Enable"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Method 3 - Backup Codes */}
      <View style={s.methodCard}>
        <View style={s.methodLeft}>
          <View style={[s.methodIcon, { backgroundColor: isBackupEnabled ? "#ECFDF5" : "#F1F5F9" }]}>
            <Ionicons name="key-outline" size={22} color={isBackupEnabled ? "#10B981" : "#64748B"} />
          </View>
          <View style={s.methodInfo}>
            <Text style={s.methodName}>Backup Codes</Text>
            <Text style={s.methodSub}>8 one-time use emergency codes</Text>
            <View style={[s.badge, { backgroundColor: isBackupEnabled ? "#ECFDF5" : "#F1F5F9" }]}>
              <Text style={[s.badgeText, { color: isBackupEnabled ? "#10B981" : "#94A3B8" }]}>
                {isBackupEnabled ? " Generated" : "Not generated"}
              </Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[s.methodBtn, { backgroundColor: activeChain.color }]}
          onPress={generateBackupCodes}
          disabled={loading}
        >
          <Text style={[s.methodBtnText, { color: "#fff" }]}>
            {isBackupEnabled ? "Regenerate" : "Generate"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Fallback info */}
      <View style={s.fallbackCard}>
        <Text style={s.fallbackTitle}> Fallback Order</Text>
        <Text style={s.fallbackText}>
          1. Authenticator App (most secure){"\n"}
          2. SMS Text Message (if app unavailable){"\n"}
          3. Backup Codes (emergency access)
        </Text>
      </View>

      {error ? <Text style={s.errorText}>{error}</Text> : null}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#F8FAFC" },
  content:        { padding: 16, paddingBottom: 40 },
  header:         { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 12 },
  backBtn:        { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  title:          { fontSize: 22, fontWeight: "800", color: "#1E1B4B" },
  sub:            { fontSize: 14, color: "#64748B", marginBottom: 24, lineHeight: 20 },
  banner:         { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 20 },
  bannerText:     { flex: 1, fontSize: 13, fontWeight: "500", lineHeight: 18 },
  methodCard:     { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#F1F5F9" },
  methodLeft:     { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  methodIcon:     { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  methodInfo:     { flex: 1 },
  methodName:     { fontSize: 15, fontWeight: "700", color: "#1E1B4B" },
  methodSub:      { fontSize: 12, color: "#64748B", marginTop: 2 },
  badge:          { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: "flex-start", marginTop: 6 },
  badgeText:      { fontSize: 11, fontWeight: "600" },
  methodBtn:      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  methodBtnText:  { fontWeight: "700", fontSize: 13 },
  qrBox:          { alignItems: "center", padding: 20, backgroundColor: "#fff", borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E2E8F0" },
  qrImage:        { width: 200, height: 200 },
  secretBox:      { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#E2E8F0" },
  secretLabel:    { fontSize: 11, color: "#94A3B8", fontWeight: "600", marginBottom: 6, textTransform: "uppercase" },
  secretText:     { fontSize: 14, color: "#1E1B4B", fontFamily: "monospace", letterSpacing: 2 },
  input:          { backgroundColor: "#fff", borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1.5, borderColor: "#E2E8F0", marginBottom: 16 },
  codeInput:      { backgroundColor: "#fff", borderRadius: 16, padding: 18, fontSize: 32, fontWeight: "800", borderWidth: 2, borderColor: "#E2E8F0", marginBottom: 20, letterSpacing: 8 },
  codesGrid:      { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  codeChip:       { backgroundColor: "#fff", borderRadius: 10, padding: 10, borderWidth: 1, flexDirection: "row", gap: 6, width: "48%" },
  codeChipNum:    { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
  codeChipText:   { fontSize: 13, color: "#1E1B4B", fontWeight: "700", fontFamily: "monospace" },
  fallbackCard:   { backgroundColor: "#F8FAFC", borderRadius: 14, padding: 16, marginTop: 8, borderWidth: 1, borderColor: "#E2E8F0" },
  fallbackTitle:  { fontSize: 14, fontWeight: "700", color: "#1E1B4B", marginBottom: 8 },
  fallbackText:   { fontSize: 13, color: "#64748B", lineHeight: 22 },
  warnBox:        { flexDirection: "row", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  warnText:       { flex: 1, fontSize: 13, color: "#92400E", lineHeight: 18 },
  primaryBtn:     { padding: 16, borderRadius: 16, alignItems: "center", marginBottom: 10 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  secondaryBtn:   { padding: 14, alignItems: "center" },
  secondaryBtnText:{ color: "#64748B", fontWeight: "600" },
  errorText:      { color: "#EF4444", fontSize: 13, textAlign: "center", marginBottom: 10 },
  subtitle:       { fontSize: 12, color: "#94A3B8", marginTop: 2 },
  toggleRow:      { flexDirection: "row", gap: 8, marginBottom: 16 },
  toggleBtn:      { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F1F5F9" },
  toggleText:     { fontSize: 13, fontWeight: "600", color: "#64748B" },
  phoneRow:       { flexDirection: "row", gap: 8, marginBottom: 16 },
  countryBtn:     { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E2E8F0" },
  countryFlag:    { fontSize: 16 },
  countryDial:    { fontSize: 14, fontWeight: "600", color: "#1E1B4B" },
  phoneInput:     { flex: 1, backgroundColor: "#fff", borderRadius: 12, padding: 14, fontSize: 16, borderWidth: 1.5, borderColor: "#E2E8F0" },
  infoBanner:     { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  infoBannerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  btnRow:         { flexDirection: "row", alignItems: "center", gap: 8 },
  verifyInfo:     { alignItems: "center", marginBottom: 24, gap: 8 },
  verifyTitle:    { fontSize: 18, fontWeight: "700", color: "#1E1B4B" },
  verifySub:      { fontSize: 14, color: "#64748B", textAlign: "center" },
  resendBox:      { marginTop: 24, alignItems: "center", gap: 12 },
  resendTitle:    { fontSize: 14, fontWeight: "600", color: "#64748B" },
  resendRow:      { flexDirection: "row", gap: 10 },
  resendBtn:      { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5 },
  resendBtnText:  { fontSize: 13, fontWeight: "600" },
  changePhone:    { marginTop: 8, padding: 8 },
  changePhoneText:{ color: "#6366F1", fontSize: 14, fontWeight: "600" },
  pickerModal:    { flex: 1, backgroundColor: "#fff", paddingTop: 48 },
  pickerHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 12 },
  pickerTitle:    { fontSize: 18, fontWeight: "700", color: "#1E1B4B" },
  pickerSearch:   { marginHorizontal: 16, marginBottom: 8, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, fontSize: 15, borderWidth: 1, borderColor: "#E2E8F0" },
  pickerItem:     { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 20, gap: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  pickerFlag:     { fontSize: 18, width: 28 },
  pickerName:     { flex: 1, fontSize: 15, color: "#1E1B4B" },
  pickerDial:     { fontSize: 14, color: "#64748B", fontWeight: "600" },
})