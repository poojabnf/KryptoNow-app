import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState, useRef } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  TextInput, ActivityIndicator, Animated, Dimensions,
  KeyboardAvoidingView, ScrollView, Image,
} from "react-native";
import { router } from "expo-router";
import { auth } from "../../config/firebase";
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential
} from "firebase/auth";
import { storage } from "../../utils/storage";
import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";

// Required on all platforms for expo-auth-session to catch the redirect and close the popup
WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get("window")
const TEAL   = "#0D2E2E"
const ACCENT = "#00D4AA"

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
  const [email,    setEmail   ] = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading ] = useState(false);
  const [error,    setError   ] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);

  // Setup Google Auth Session
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "dummy-client-id.apps.googleusercontent.com",
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
  });

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
      const walletRaw = await storage.get("kryptonow_wallet")
      let address = await storage.get("kryptonow_address")
      if (walletRaw && !address) {
        try { address = JSON.parse(walletRaw)?.address ?? null } catch {}
      }
      const profileRaw = await storage.get("kryptonow_profile_fallback")
      const profile = profileRaw ? JSON.parse(profileRaw) : null
      
      if (!address) router.replace("/create")
      else if (!profile?.onboarded) router.replace("/onboarding")
      else router.replace("/dashboard")
    } catch { router.replace("/create") }
  };

  // Handle Google OAuth response
  useEffect(() => {
    if (response?.type === "success") {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      setLoading(true);
      signInWithCredential(auth, credential)
        .then(() => onSuccess())
        .catch(err => {
          setError(err.message || "Google sign-in failed");
          setLoading(false);
        });
    }
  }, [response]);

  const handleEmailAuth = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return setError("Enter a valid email address");
    if (password.length < 6) return setError("Password must be at least 6 characters");
    
    setLoading(true); setError("");
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, trimmed, password);
      } else {
        await signInWithEmailAndPassword(auth, trimmed, password);
      }
      await onSuccess();
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError("Account already exists. Switch to Sign In.");
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("Invalid email or password.");
      } else {
        setError(err.message || "Authentication failed.");
      }
    } finally { 
      setLoading(false); 
    }
  };

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
          <View style={s.logoIconWrap}>
            <Image source={require("../../assets/icon.png")} style={s.logoImg} resizeMode="contain" />
          </View>
          <Text style={s.logoTitle}>KryptoNow</Text>
          <Text style={s.logoTagline}>Your keys. Your crypto.</Text>
        </Animated.View>

        <Animated.View style={[s.card, { transform: [{ translateY: cardAnim }], opacity: cardOpacity }]}>
          <Text style={s.cardTitle}>Welcome back</Text>
          <Text style={s.cardSub}>{isSignUp ? "Create a new Firebase account" : "Sign in to your Firebase account"}</Text>

          <TouchableOpacity style={s.googleBtn} onPress={() => promptAsync()} disabled={!request || loading} activeOpacity={0.85}>
            <View style={s.googleIconWrap}>
              <Text style={s.googleIconG}>G</Text>
            </View>
            <Text style={s.googleBtnText}>Continue with Google</Text>
            {loading ? <ActivityIndicator size="small" color="#64748B" /> : <View style={{ width: 20 }} />}
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

          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={s.inputIcon} />
            <TextInput
              style={s.input}
              placeholder="Password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={t => { setPassword(t); setError(""); }}
              secureTextEntry
            />
          </View>

          {error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <TouchableOpacity style={s.accentBtn} onPress={handleEmailAuth} disabled={loading} activeOpacity={0.85}>
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={s.accentBtnText}>{isSignUp ? "Sign Up " : "Sign In "}</Text>
            }
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => { setIsSignUp(!isSignUp); setError(""); }} style={s.toggleBtn}>
            <Text style={s.toggleBtnText}>
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </Text>
          </TouchableOpacity>

          <View style={[s.badgeRow, { marginTop: 20 }]}>
            <View style={s.badge}>
              <Ionicons name="cloud-done-outline" size={12} color={ACCENT} />
              <Text style={s.badgeText}>Cloud Synced</Text>
            </View>
            <View style={s.badge}>
              <Ionicons name="lock-closed-outline" size={12} color={ACCENT} />
              <Text style={s.badgeText}>E2E Encrypted</Text>
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
  logoWrap:     { alignItems: "center", marginBottom: 32, gap: 10 },
  logoIconWrap: { width: 88, height: 88, borderRadius: 24, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 12, ...Platform.select({ web: { boxShadow: "0px 8px 24px rgba(0,212,170,0.45)" }, default: { shadowColor: ACCENT, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.45, shadowRadius: 20 } }) },
  logoImg:      { width: 72, height: 72, borderRadius: 18 },
  logoTitle:    { fontSize: 28, fontWeight: "900", color: "#fff", letterSpacing: -0.5 },
  logoTagline:  { fontSize: 14, color: ACCENT, fontWeight: "500", letterSpacing: 0.5 },
  card:         { width: "100%", maxWidth: 420, backgroundColor: "rgba(255,255,255,0.97)", borderRadius: 28, padding: 28, elevation: 20, ...Platform.select({ web: { boxShadow: "0px 20px 40px rgba(0,0,0,0.3)" }, default: { shadowColor: "#000", shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.3, shadowRadius: 40 } }) },
  cardTitle:    { fontSize: 24, fontWeight: "800", color: "#1E1B4B", textAlign: "center", marginBottom: 6 },
  cardSub:      { fontSize: 14, color: "#64748B", textAlign: "center", marginBottom: 24, lineHeight: 20 },
  googleBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: "#E2E8F0", marginBottom: 10, elevation: 2, ...Platform.select({ web: { boxShadow: "0px 2px 8px rgba(0,0,0,0.06)" }, default: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 } }) },
  googleIconWrap:{ width: 24, height: 24, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  googleIconG:  { fontSize: 16, fontWeight: "900", color: "#4285F4" },
  googleBtnText:{ fontSize: 15, fontWeight: "700", color: "#1E1B4B", flex: 1, textAlign: "center" },
  divider:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  dividerLine:  { flex: 1, height: 1, backgroundColor: "#E2E8F0" },
  dividerText:  { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  inputWrap:    { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 14, borderWidth: 1.5, borderColor: "#E2E8F0", marginBottom: 12, paddingHorizontal: 14 },
  inputIcon:    { marginRight: 10 },
  input:        { flex: 1, fontSize: 15, color: "#1E1B4B", paddingVertical: 14 },
  errorBox:     { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  errorText:    { color: "#EF4444", fontSize: 13, fontWeight: "500", flex: 1 },
  accentBtn:    { backgroundColor: ACCENT, borderRadius: 14, padding: 16, alignItems: "center", marginBottom: 10, elevation: 6, ...Platform.select({ web: { boxShadow: "0px 6px 16px rgba(0,212,170,0.35)" }, default: { shadowColor: ACCENT, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 16 } }) },
  accentBtnText:{ fontSize: 16, fontWeight: "800", color: "#0D2E2E" },
  toggleBtn:    { alignItems: "center", paddingVertical: 10 },
  toggleBtnText:{ color: "#64748B", fontSize: 14, fontWeight: "600" },
  badgeRow:     { flexDirection: "row", justifyContent: "center", gap: 8, flexWrap: "wrap" },
  badge:        { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F0FDF9", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: "#A7F3D0" },
  badgeText:    { fontSize: 11, color: "#065F46", fontWeight: "600" },
  footer:       { marginTop: 24, fontSize: 12, color: "rgba(255,255,255,0.4)", textAlign: "center" },
  footerLink:   { color: "rgba(255,255,255,0.7)", fontWeight: "600" },
})
