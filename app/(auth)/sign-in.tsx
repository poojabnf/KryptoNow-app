import { useSSO } from "@clerk/expo";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  TextInput, ActivityIndicator, KeyboardAvoidingView,
  ScrollView, Alert,
} from "react-native";
import { router } from "expo-router";
import { useSignIn, useSignUp } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";

WebBrowser.maybeCompleteAuthSession();

const TEAL   = "#0D2E2E";
const ACCENT = "#00D4AA";

const LOG = (tag: string, msg: string, data?: any) => {
  if (data !== undefined) console.log(`[KryptoNow][${tag}] ${msg}`, JSON.stringify(data, null, 2));
  else console.log(`[KryptoNow][${tag}] ${msg}`);
};

// ── OAuth helper ──────────────────────────────────────────────────
function useOAuthFlow(strategy: "oauth_google" | "oauth_discord") {
  const { startSSOFlow } = useSSO();

  return useCallback(async (onSuccess: () => Promise<void>) => {
    const redirectUrl = Platform.OS === "web"
      ? `${window.location.origin}/`
      : "kryptonow://";

    LOG("OAuth", `Starting ${strategy}`, { redirectUrl, platform: Platform.OS });

    const result = await startSSOFlow({ strategy, redirectUrl });
    const { createdSessionId, setActive, signIn, signUp } = result;

    LOG("OAuth", "SSO result", {
      createdSessionId: createdSessionId ?? "none",
      hasSetActive: !!setActive,
      signInStatus: signIn?.status ?? "none",
      signInFirstFactor: signIn?.firstFactorVerification?.status ?? "none",
      signUpStatus: signUp?.status ?? "none",
      signUpMissingFields: signUp?.missingFields ?? [],
    });

    // Case 1: session ready
    if (createdSessionId && setActive) {
      LOG("OAuth", "✅ Case 1: direct session, activating...");
      await setActive({ session: createdSessionId });
      await onSuccess();
      return;
    }

    // Case 2: transfer signIn → signUp
    if (signIn?.firstFactorVerification?.status === "transferable" && signUp) {
      LOG("OAuth", "🔄 Case 2: transferable, creating signUp from signIn...");
      await signUp.create({ transfer: true });
      await signUp.reload();
      LOG("OAuth", "After transfer", { status: signUp.status, sessionId: signUp.createdSessionId });
      if (signUp.status === "complete" && setActive && signUp.createdSessionId) {
        await setActive({ session: signUp.createdSessionId });
        await onSuccess();
        return;
      }
      if (signUp.status === "missing_requirements") {
        LOG("OAuth", "❌ missing_requirements", signUp.missingFields);
        Alert.alert("Missing info", `Required fields: ${JSON.stringify(signUp.missingFields)}`);
        return;
      }
    }

    // Case 3: signUp incomplete
    if (signUp?.status === "missing_requirements") {
      LOG("OAuth", "❌ Case 3: signUp missing_requirements", signUp.missingFields);
      Alert.alert("Incomplete signup", `Missing: ${JSON.stringify(signUp.missingFields)}`);
      return;
    }

    LOG("OAuth", "⚠️ WARNING: No case matched — flow ended without session");
  }, [startSSOFlow, strategy]);
}

// ── Main component ────────────────────────────────────────────────
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

  useEffect(() => {
    LOG("Mount", "SignIn screen mounted", { platform: Platform.OS, siLoaded, suLoaded });
    if (Platform.OS !== "web") {
      void WebBrowser.warmUpAsync();
      return () => { WebBrowser.coolDownAsync(); };
    }
  }, []);

  useEffect(() => {
    LOG("Clerk", "Load state", { siLoaded, suLoaded });
  }, [siLoaded, suLoaded]);

  const onSuccess = async () => {
    LOG("onSuccess", "Auth complete, checking wallet...");
    try {
      const address = await AsyncStorage.getItem("kryptonow_address");
      const profileRaw = await AsyncStorage.getItem("kryptonow_profile");
      const profile = profileRaw ? JSON.parse(profileRaw) : null;
      LOG("onSuccess", "State check", { hasAddress: !!address, onboarded: profile?.onboarded });
      if (!address) {
        router.replace("/create");
      } else if (!profile?.onboarded) {
        router.replace("/onboarding");
      } else {
        router.replace("/dashboard");
      }
    } catch (e: any) {
      LOG("onSuccess", "Error reading storage", { error: e?.message });
      router.replace("/create");
    }
  };

  const handleGoogle = async () => {
    LOG("Google", "▶ Button pressed");
    setLoading(true); setError("");
    try {
      await startGoogle(onSuccess);
    } catch (e: any) {
      const msg = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? "Google sign-in failed";
      LOG("Google", "❌ Error", { msg, errors: e?.errors });
      setError(msg);
    } finally {
      setLoading(false);
      LOG("Google", "■ Done");
    }
  };

  const handleDiscord = async () => {
    LOG("Discord", "▶ Button pressed");
    setLoading(true); setError("");
    try {
      await startDiscord(onSuccess);
    } catch (e: any) {
      const msg = e?.errors?.[0]?.longMessage ?? e?.errors?.[0]?.message ?? e?.message ?? "Discord sign-in failed";
      LOG("Discord", "❌ Error", { msg, errors: e?.errors });
      setError(msg);
    } finally {
      setLoading(false);
      LOG("Discord", "■ Done");
    }
  };

  const handleEmailContinue = async () => {
    const trimmed = email.trim();
    LOG("Email", "▶ Continue pressed", { email: trimmed, siLoaded, suLoaded });
    if (!trimmed || !siLoaded || !suLoaded) {
      LOG("Email", "⚠️ Aborting — empty or not ready");
      return;
    }
    setLoading(true); setError("");
    try {
      LOG("Email", "Trying signIn with email_code...");
      await signIn!.create({ identifier: trimmed, strategy: "email_code" });
      LOG("Email", "✅ signIn OTP sent → signin flow");
      setFlow("signin"); setStep("otp");
    } catch (e1: any) {
      LOG("Email", "signIn failed, trying signUp", { error: e1?.errors?.[0]?.message });
      try {
        await signUp!.create({ emailAddress: trimmed });
        await signUp!.prepareEmailAddressVerification({ strategy: "email_code" });
        LOG("Email", "✅ signUp OTP sent → signup flow");
        setFlow("signup"); setStep("otp");
      } catch (e2: any) {
        const msg = e2?.errors?.[0]?.message ?? "Failed to send code.";
        LOG("Email", "❌ signUp also failed", { msg, errors: e2?.errors });
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    LOG("OTP", "▶ Verify pressed", { flow, codeLength: code.length });
    if (!siLoaded || !suLoaded) return;
    setLoading(true); setError("");
    try {
      if (flow === "signin") {
        LOG("OTP", "Attempting signIn.attemptFirstFactor...");
        const result = await signIn!.attemptFirstFactor({ strategy: "email_code", code });
        LOG("OTP", "Result", { status: result.status, sessionId: result.createdSessionId });
        if (result.status === "complete" && result.createdSessionId) {
          await setSignInActive!({ session: result.createdSessionId });
          await onSuccess();
        }
      } else {
        LOG("OTP", "Attempting signUp.attemptEmailAddressVerification...");
        const result = await signUp!.attemptEmailAddressVerification({ code });
        LOG("OTP", "Result", { status: result.status, sessionId: result.createdSessionId });
        if (result.status === "complete" && result.createdSessionId) {
          await setSignUpActive!({ session: result.createdSessionId });
          await onSuccess();
        }
      }
    } catch (e: any) {
      const msg = e?.errors?.[0]?.message ?? "Invalid code.";
      LOG("OTP", "❌ Error", { msg, errors: e?.errors });
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    LOG("Nav", "← Back pressed, resetting state");
    setStep("email"); setCode(""); setError(""); setFlow("signin");
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.brand}>
          <View style={s.logoBox}><Text style={s.logoText}>K</Text></View>
          <Text style={s.appName}>KryptoNow</Text>
          <Text style={s.tagline}>Your keys. Your crypto.</Text>
        </View>

        <View style={s.panel}>
          <Text style={s.title}>{step === "email" ? "Welcome to KryptoNow" : "Check your email"}</Text>
          <Text style={s.sub}>{step === "email" ? "Sign in or create your account" : `We sent a code to ${email}`}</Text>

          {!!error && <View style={s.errBox}><Text style={s.errT}>⚠  {error}</Text></View>}

          {step === "email" ? (
            <>
              <TouchableOpacity style={s.googleBtn} onPress={handleGoogle} disabled={loading} activeOpacity={0.75}>
                {loading ? <ActivityIndicator color="#4285F4" size="small" /> : <><Text style={s.googleG}>G</Text><Text style={s.googleT}>Continue with Google</Text></>}
              </TouchableOpacity>

              <TouchableOpacity style={s.discordBtn} onPress={handleDiscord} disabled={loading} activeOpacity={0.75}>
                {loading ? <ActivityIndicator color="#fff" size="small" /> : <><Text style={s.discordIcon}>D</Text><Text style={s.discordT}>Continue with Discord</Text></>}
              </TouchableOpacity>

              <View style={s.divRow}><View style={s.divLine} /><Text style={s.divT}>or continue with email</Text><View style={s.divLine} /></View>

              <TextInput style={s.input} value={email} onChangeText={setEmail} placeholder="your@email.com" placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={handleEmailContinue} />

              <TouchableOpacity style={[s.btn, (!email.trim() || loading) && s.btnOff]} onPress={handleEmailContinue} disabled={!email.trim() || loading}>
                {loading ? <ActivityIndicator color={TEAL} /> : <Text style={s.btnT}>Continue with Email</Text>}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TextInput style={[s.input, s.otpBox]} value={code} onChangeText={setCode} placeholder="000000" placeholderTextColor="#CBD5E1" keyboardType="number-pad" maxLength={6} textAlign="center" autoFocus />

              <TouchableOpacity style={[s.btn, (code.length < 6 || loading) && s.btnOff]} onPress={handleVerifyOTP} disabled={code.length < 6 || loading}>
                {loading ? <ActivityIndicator color={TEAL} /> : <Text style={s.btnT}>Verify & Enter</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={s.backBtn} onPress={goBack}>
                <Text style={s.backBtnT}>← Back</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <Text style={s.legal}>By continuing you agree to KryptoNow&apos;s Terms of Service and Privacy Policy.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: TEAL },
  scroll:      { flexGrow: 1, justifyContent: "center", padding: 24, paddingTop: 60 },
  brand:       { alignItems: "center", marginBottom: 32 },
  logoBox:     { width: 72, height: 72, borderRadius: 22, backgroundColor: ACCENT, alignItems: "center", justifyContent: "center", marginBottom: 12, shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  logoText:    { color: TEAL, fontSize: 36, fontWeight: "800" },
  appName:     { color: "#FFFFFF", fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  tagline:     { color: ACCENT, fontSize: 14, marginTop: 4, opacity: 0.9 },
  panel:       { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 8 },
  title:       { color: "#1E1B4B", fontSize: 20, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  sub:         { color: "#64748B", fontSize: 14, textAlign: "center", marginBottom: 20, lineHeight: 20 },
  errBox:      { backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#FECACA" },
  errT:        { color: "#DC2626", fontSize: 13, lineHeight: 18 },
  googleBtn:   { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 14, paddingVertical: 14, marginBottom: 10, minHeight: 52 },
  googleG:     { fontSize: 18, fontWeight: "800", color: "#4285F4" },
  googleT:     { color: "#1E1B4B", fontSize: 15, fontWeight: "600" },
  discordBtn:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#5865F2", borderRadius: 14, paddingVertical: 14, marginBottom: 16, minHeight: 52 },
  discordIcon: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
  discordT:    { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  divRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  divLine:     { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  divT:        { color: "#94A3B8", fontSize: 12 },
  input:       { backgroundColor: "#F8FAFF", borderWidth: 1.5, borderColor: "#E2E8F0", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: "#1E1B4B", marginBottom: 12 },
  otpBox:      { fontSize: 28, fontWeight: "700", letterSpacing: 10, textAlign: "center" },
  btn:         { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 16, alignItems: "center", marginBottom: 10, minHeight: 52 },
  btnOff:      { opacity: 0.4 },
  btnT:        { color: TEAL, fontSize: 16, fontWeight: "700" },
  backBtn:     { alignItems: "center", paddingVertical: 12 },
  backBtnT:    { color: "#6366F1", fontSize: 14, fontWeight: "600" },
  legal:       { color: "rgba(255,255,255,0.35)", fontSize: 11, textAlign: "center", lineHeight: 18, paddingHorizontal: 16 },
});
