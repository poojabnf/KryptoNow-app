import { useSSO } from "@clerk/expo";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  TextInput, ActivityIndicator, Animated, Dimensions,
  KeyboardAvoidingView, ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useSignIn, useSignUp } from "@clerk/expo/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

// Only needed on native — on web Clerk handles its own popup/redirect completion.
// Calling this unconditionally on web can swallow the OAuth callback before
// Clerk finishes reading it, which silently breaks Google & Discord login.
if (Platform.OS !== "web") {
  WebBrowser.maybeCompleteAuthSession();
}

const { width, height } = Dimensions.get("window")
const TEAL   = "#0D2E2E"
const ACCENT = "#00D4AA"
const ACCENT2 = "#00B8FF"

const LOG = (tag: string, msg: string, data?: any) => {
  if (data !== undefined) console.log(`[KryptoNow][${tag}] ${msg}`, JSON.stringify(data, null, 2));
  else console.log(`[KryptoNow][${tag}] ${msg}`);
};

// OAuth helper - FIXED: removed manual window.open("about:blank") that caused double popup
function useOAuthFlow(strategy: "oauth_google" | "oauth_discord") {
  const { startSSOFlow } = useSSO();
  return useCallback(async (onSuccess: () => Promise<void>) => {
    if (Platform.OS === "web") {
      // redirectUrl must be registered in Clerk dashboard under "Allowed redirect URLs".
      // window.location.origin automatically resolves to:
      //   http://localhost:8081  (dev)   or   https://kypra.xyz  (production)
      // so no manual env-switching is needed here.
      const redirectUrl = window.location.origin + "/sso-callback"
      try {
        const result = await startSSOFlow({ strategy, redirectUrl })
        const { createdSessionId, setActive } = result
        if (createdSessionId && setActive) {
          await setActive({ session: createdSessionId })
          await onSuccess()
        } else {
          // Popup completed and closed - give Clerk 800ms to update session
          await new Promise(r => setTimeout(r, 800))
          await onSuccess()
        }
      } catch (e: any) {
        // User closed popup or cancelled - not a hard error
        if (
          e?.code === 4001 ||
          e?.message?.includes("cancelled") ||
          e?.message?.includes("closed") ||
          e?.message?.includes("popup")
        ) {
          return
        }
        throw e
      }
      return
    }
    // Mobile flow
    try {
      const result = await startSSOFlow({ strategy, redirectUrl: "kryptonow://" })
      const { createdSessionId, setActive, signIn, signUp } = result
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId })
        await onSuccess(); return
      }
      if (signIn?.firstFactorVerification?.status === "transferable" && signUp) {
        await signUp.create({ transfer: true }); await signUp.reload()
        if (signUp.status === "complete" && setActive && signUp.createdSessionId) {
          await setActive({ session: signUp.createdSessionId })
          await onSuccess()
        }
      }
    } catch(e: any) { throw e }
  }, [startSSOFlow, strategy])
}

// Floating particle component
function Particle({ delay, x }: { delay: number; x: number }) {
  const anim = useRef(new Animated.Value(0)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(anim, { toValue: -300, duration: 4000, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.6, duration: 500, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 3500, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [])

  return (
    <Animated.View style={[p.particle, { left: x, transform: [{ translateY: anim }], opacity }]} />
  )
}

// Main component
export default function SignIn() {
  const startGoogle  = useOAuthFlow("oauth_google");
  const startDiscord = useOAuthFlow("oauth_discord");
  const { signIn, setActive: setSignInActive, isLoaded: siLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: suLoaded } = useSignUp();

  const [email,   setEmail  ] = useState("");
  const [code,    setCode   ] = useState("");
  const [step,    setStep   ] = useState<"email" | "otp">("email");
  const [flow,    setFlow   ] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState("");
  const [mfaStep,  setMfaStep]  = useState<"none"|"totp"|"sms"|"backup">("none");
  const [mfaCode,  setMfaCode]  = useState("");
  const [mfaSignIn, setMfaSignIn] = useState<any>(null);

  const cardAnim   = useRef(new Animated.Value(60)).current
  const cardOpacity= useRef(new Animated.Value(0)).current
  const logoScale  = useRef(new Animated.Value(0.5)).current
  const logoOpacity= useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale,   { toValue: 1, tension: 50, friction: 8, useNativeDriver: true }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.spring(cardAnim,   { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
          Animated.timing(cardOpacity,{ toValue: 1, duration: 500, useNativeDriver: true }),
        ]),
      ]),
    ]).start()
    if (Platform.OS !== "web") {
      void WebBrowser.warmUpAsync();
      return () => { WebBrowser.coolDownAsync(); };
    }
  }, []);

  const onSuccess = async () => {
    try {
      let address: string | null = null
      let profile: any = null
      if (Platform.OS === "web") {
        const walletRaw = localStorage.getItem("kryptonow_wallet")
        if (walletRaw) {
          try { address = JSON.parse(walletRaw)?.address ?? null } catch {}
        }
        if (!address) address = localStorage.getItem("kryptonow_address")
        const profileRaw = localStorage.getItem("kryptonow_profile")
        profile = profileRaw ? JSON.parse(profileRaw) : null
      } else {
        address = await AsyncStorage.getItem("kryptonow_address")
        const profileRaw = await AsyncStorage.getItem("kryptonow_profile")
        profile = profileRaw ? JSON.parse(profileRaw) : null
      }
      if (!address) router.replace("/create")
      else if (!profile?.onboarded) router.replace("/onboarding")
      else router.replace("/dashboard")
    } catch { router.replace("/create") }
  };

  const handleGoogle = async () => {
    setLoading(true); setError("");
    try { await startGoogle(onSuccess); }
    catch (e: any) {
      setError(e?.errors?.[0]?.message ?? "Google sign-in failed");
    } finally { setLoading(false); }
  };

  const handleDiscord = async () => {
    setLoading(true); setError("");
    try { await startDiscord(onSuccess); }
    catch (e: any) {
      setError(e?.errors?.[0]?.message ?? "Discord sign-in failed");
    } finally { setLoading(false); }
  };

  const handleEmail = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return setError("Enter a valid email address");
    setLoading(true); setError("");
    try {
      await signIn!.create({ identifier: trimmed, strategy: "email_code" });
      setFlow("signin"); setStep("otp");
    } catch {
      try {
        await signUp!.create({ emailAddress: trimmed });
        await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
        setFlow("signup"); setStep("otp");
      } catch (e2: any) {
        setError(e2?.errors?.[0]?.message ?? "Failed to send code.");
      }
    } finally { setLoading(false); }
  };

  const handleOTP = async () => {
    if (!code || code.length < 6) return setError("Enter the 6-digit code");
    setLoading(true); setError("");
    try {
      if (flow === "signin") {
        const result = await signIn!.attemptFirstFactor({ strategy: "email_code", code });
        if (result.status === "needs_second_factor") {
          setMfaSignIn(signIn); setMfaStep("totp"); setStep("otp");
          return;
        }
        if (result.status === "complete") {
          await setSignInActive!({ session: result.createdSessionId! });
          await onSuccess();
        }
      } else {
        const result = await signUp!.attemptEmailAddressVerification({ code });
        if (result.status === "complete") {
          await setSignUpActive!({ session: result.createdSessionId! });
          await onSuccess();
        }
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? "Invalid code.");
    } finally { setLoading(false); }
  };

  const handleMFA = async () => {
    if (!mfaCode) return setError("Enter your verification code");
    setLoading(true); setError("");
    try {
      const strategy = mfaStep === "totp" ? "totp"
        : mfaStep === "sms" ? "phone_code" : "backup_code";
      const result = await mfaSignIn.attemptSecondFactor({ strategy, code: mfaCode });
      if (result.status === "complete") {
        await setSignInActive!({ session: result.createdSessionId! });
        await onSuccess();
      }
    } catch (e: any) {
      setError(e?.errors?.[0]?.message ?? "Invalid MFA code");
    } finally { setLoading(false); }
  };

  // MFA Screen
  if (mfaStep !== "none") return (
    <View style={s.bg}>
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />
      <KeyboardAvoidingView behavior="padding" style={s.center}>
        <Animated.View style={[s.card, { transform: [{ translateY: cardAnim }], opacity: cardOpacity }]}>
          <View style={s.mfaIcon}>
            <Ionicons name="shield-checkmark" size={32} color={ACCENT} />
          </View>
          <Text style={s.mfaTitle}>Two-Factor Auth</Text>
          <Text style={s.mfaSub}>
            {mfaStep === "totp"   ? "Enter the 6-digit code from your authenticator app"
            : mfaStep === "sms"   ? "Enter the code sent to your phone"
            : "Enter one of your emergency backup codes"}
          </Text>
          <TextInput
            style={s.otpInput}
            placeholder=""
            placeholderTextColor="#94A3B8"
            value={mfaCode}
            onChangeText={setMfaCode}
            keyboardType="number-pad"
            maxLength={mfaStep === "backup" ? 12 : 6}
            textAlign="center"
            autoFocus
          />
          {error ? <Text style={s.errorText}>{error}</Text> : null}
          <TouchableOpacity style={s.accentBtn} onPress={handleMFA} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" />
              : <Text style={s.accentBtnText}>Verify </Text>}
          </TouchableOpacity>
          <View style={s.fallbackRow}>
            {mfaStep !== "totp" && (
              <TouchableOpacity onPress={() => { setMfaStep("totp"); setMfaCode(""); setError(""); }}>
                <Text style={s.fallbackLink}>Use Authenticator</Text>
              </TouchableOpacity>
            )}
            {mfaStep !== "sms" && (
              <TouchableOpacity onPress={() => { setMfaStep("sms"); setMfaCode(""); setError(""); }}>
                <Text style={s.fallbackLink}>Use SMS</Text>
              </TouchableOpacity>
            )}
            {mfaStep !== "backup" && (
              <TouchableOpacity onPress={() => { setMfaStep("backup"); setMfaCode(""); setError(""); }}>
                <Text style={s.fallbackLink}>Backup Code</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  )

  // OTP Screen
  if (step === "otp") return (
    <View style={s.bg}>
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />
      {[100, 200, 300, 150, 250].map((x, i) => <Particle key={i} delay={i * 800} x={x} />)}
      <KeyboardAvoidingView behavior="padding" style={s.center}>
        <Animated.View style={[s.card, { transform: [{ translateY: cardAnim }], opacity: cardOpacity }]}>
          <View style={s.otpIconWrap}>
            <Ionicons name="mail" size={28} color={ACCENT} />
          </View>
          <Text style={s.cardTitle}>Check your email</Text>
          <Text style={s.cardSub}>We sent a 6-digit code to{"\n"}<Text style={s.emailHighlight}>{email}</Text></Text>
          <TextInput
            style={s.otpInput}
            placeholder="000000"
            placeholderTextColor="#94A3B8"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
            autoFocus
          />
          {error ? <Text style={s.errorText}>{error}</Text> : null}
          <TouchableOpacity style={s.accentBtn} onPress={handleOTP} disabled={loading}>
            {loading ? <ActivityIndicator color="#000" />
              : <Text style={s.accentBtnText}>Verify Code </Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.backLink} onPress={() => { setStep("email"); setCode(""); setError(""); }}>
            <Ionicons name="arrow-back" size={14} color="#94A3B8" />
            <Text style={s.backLinkText}>Use different email</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  )

  // Main Login Screen
  return (
    <View style={s.bg}>
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />
      <View style={s.bgCircle3} />
      {[80, 160, 240, 320, 120, 200, 280].map((x, i) => (
        <Particle key={i} delay={i * 600} x={x} />
      ))}
      <ScrollView contentContainerStyle={s.center} keyboardShouldPersistTaps="handled">
        <Animated.View style={[s.logoWrap, { transform: [{ scale: logoScale }], opacity: logoOpacity }]}>
          <View style={s.logoIcon}>
            <Text style={s.logoIconText}>K</Text>
          </View>
          <Text style={s.logoTitle}>KryptoNow</Text>
          <Text style={s.logoTagline}>Your keys. Your crypto.</Text>
        </Animated.View>

        <Animated.View style={[s.card, { transform: [{ translateY: cardAnim }], opacity: cardOpacity }]}>
          <Text style={s.cardTitle}>Welcome back</Text>
          <Text style={s.cardSub}>Sign in or create your account</Text>

          <TouchableOpacity style={s.googleBtn} onPress={handleGoogle} disabled={loading} activeOpacity={0.85}>
            <View style={s.googleIconWrap}>
              <Text style={s.googleIconG}>G</Text>
            </View>
            <Text style={s.googleBtnText}>Continue with Google</Text>
            {loading ? <ActivityIndicator size="small" color="#64748B" /> : <View style={{ width: 20 }} />}
          </TouchableOpacity>

          <TouchableOpacity style={s.discordBtn} onPress={handleDiscord} disabled={loading} activeOpacity={0.85}>
            <Ionicons name="logo-discord" size={20} color="#fff" />
            <Text style={s.discordBtnText}>Continue with Discord</Text>
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <View style={{ width: 20 }} />}
          </TouchableOpacity>

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or continue with email</Text>
            <View style={s.dividerLine} />
          </View>

          <View style={s.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#94A3B8" style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="your@email.com"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={t => { setEmail(t); setError(""); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={s.accentBtn} onPress={handleEmail} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={s.accentBtnText}>Continue with Email </Text>
            }
          </TouchableOpacity>

          <View style={s.badgeRow}>
            <View style={s.badge}>
              <Ionicons name="shield-checkmark-outline" size={12} color={ACCENT} />
              <Text style={s.badgeText}>Non-custodial</Text>
            </View>
            <View style={s.badge}>
              <Ionicons name="lock-closed-outline" size={12} color={ACCENT} />
              <Text style={s.badgeText}>E2E Encrypted</Text>
            </View>
            <View style={s.badge}>
              <Ionicons name="eye-off-outline" size={12} color={ACCENT} />
              <Text style={s.badgeText}>Privacy first</Text>
            </View>
          </View>
        </Animated.View>

        <Text style={s.footer}>
          By continuing you agree to our{" "}
          <Text style={s.footerLink}>Terms</Text> &{" "}
          <Text style={s.footerLink}>Privacy Policy</Text>
        </Text>
      </ScrollView>
    </View>
  )
}

const p = StyleSheet.create({
  particle: {
    position: "absolute", bottom: -10,
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: "#00D4AA",
  },
})

const s = StyleSheet.create({
  bg:           { flex: 1, backgroundColor: "#0D2E2E" },
  bgCircle1:    { position: "absolute", top: -120, right: -80, width: 350, height: 350, borderRadius: 175, backgroundColor: "#00D4AA", opacity: 0.08 },
  bgCircle2:    { position: "absolute", bottom: -100, left: -60, width: 280, height: 280, borderRadius: 140, backgroundColor: "#00B8FF", opacity: 0.06 },
  bgCircle3:    { position: "absolute", top: "40%", left: "30%", width: 200, height: 200, borderRadius: 100, backgroundColor: "#00D4AA", opacity: 0.04 },
  center:       { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingVertical: 40, paddingHorizontal: 20 },
  logoWrap:     { alignItems: "center", marginBottom: 32, gap: 8 },
  logoIcon:     { width: 72, height: 72, borderRadius: 20, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", elevation: 12, ...Platform.select({ web: { boxShadow: `0px 8px 20px rgba(0,212,170,0.5)` }, default: { shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.5, shadowRadius: 20 } }) },
  logoIconText: { fontSize: 36, fontWeight: "900", color: "#0D2E2E" },
  logoTitle:    { fontSize: 28, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  logoTagline:  { fontSize: 14, color: ACCENT, fontWeight: "500", letterSpacing: 0.5 },
  card:         { width: "100%", maxWidth: 420, backgroundColor: "rgba(255,255,255,0.97)", borderRadius: 28, padding: 28, elevation: 20, ...Platform.select({ web: { boxShadow: "0px 20px 40px rgba(0,0,0,0.3)" }, default: { shadowColor: "#000", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.3, shadowRadius: 40 } }) },
  cardTitle:    { fontSize: 24, fontWeight: "800", color: "#1E1B4B", textAlign: "center", marginBottom: 6 },
  cardSub:      { fontSize: 14, color: "#64748B", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  googleBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: "#E2E8F0", marginBottom: 10, elevation: 2, ...Platform.select({ web: { boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" }, default: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 } }) },
  googleIconWrap:{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  googleIconG:  { fontSize: 16, fontWeight: "900", color: "#4285F4" },
  googleBtnText:{ fontSize: 15, fontWeight: "700", color: "#1E1B4B", flex: 1, textAlign: "center" },
  discordBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#5865F2", borderRadius: 14, padding: 14, marginBottom: 20, elevation: 4, ...Platform.select({ web: { boxShadow: "0px 4px 12px rgba(88,101,242,0.3)" }, default: { shadowColor: "#5865F2", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 } }) },
  discordBtnText:{ fontSize: 15, fontWeight: "700", color: "#fff", flex: 1, textAlign: "center" },
  divider:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  dividerText:  { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  inputWrap:    { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 14, borderWidth: 1.5, borderColor: "#E2E8F0", marginBottom: 12, paddingHorizontal: 14 },
  inputIcon:    { marginRight: 10 },
  input:        { flex: 1, fontSize: 15, color: "#1E1B4B", paddingVertical: 14 },
  errorBox:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  errorText:    { color: "#EF4444", fontSize: 13, fontWeight: "500", flex: 1 },
  accentBtn:    { backgroundColor: ACCENT, borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 16, elevation: 6, ...Platform.select({ web: { boxShadow: "0px 6px 16px rgba(0,212,170,0.35)" }, default: { shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16 } }) },
  accentBtnText:{ fontSize: 16, fontWeight: "800", color: "#0D2E2E" },
  badgeRow:     { flexDirection: "row", justifyContent: "center", gap: 8, flexWrap: "wrap" },
  badge:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F0FDF9", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#A7F3D0" },
  badgeText:    { fontSize: 11, color: "#065F46", fontWeight: "600" },
  otpIconWrap:  { width: 64, height: 64, borderRadius: 20, backgroundColor: "#F0FDF9", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16, borderWidth: 1, borderColor: "#A7F3D0" },
  emailHighlight:{ color: ACCENT, fontWeight: "700" },
  otpInput:     { fontSize: 36, fontWeight: "800", color: "#1E1B4B", letterSpacing: 12, paddingVertical: 16, borderBottomWidth: 2, borderBottomColor: ACCENT, marginBottom: 20, textAlign: "center" },
  backLink:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 },
  backLinkText: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },
  mfaIcon:      { width: 64, height: 64, borderRadius: 20, backgroundColor: "#F0FDF9", alignItems: "center", justifyContent: "center", alignSelf: "center", marginBottom: 16, borderWidth: 1, borderColor: "#A7F3D0" },
  mfaTitle:     { fontSize: 22, fontWeight: "800", color: "#1E1B4B", textAlign: "center", marginBottom: 8 },
  mfaSub:       { fontSize: 14, color: "#64748B", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  fallbackRow:  { flexDirection: "row", justifyContent: "center", gap: 16, flexWrap: "wrap", marginTop: 8 },
  fallbackLink: { fontSize: 13, color: ACCENT, fontWeight: "600" },
  footer:       { marginTop: 24, fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center" },
  footerLink:   { color: "rgba(255,255,255,0.7)", fontWeight: "600" },
})
