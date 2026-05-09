// ✅ MUST be first import — ethers needs crypto.getRandomValues at load time
import 'react-native-get-random-values';

import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, TextInput } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@clerk/expo";
import { useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { ethers } from "ethers";
import { useWalletStore } from '../store/walletStore';
import { encryptPhrase } from "../security";
import { saveWalletKeys } from "../store/keyStore";

const TEAL  = "#0D2E2E";
const ACCENT = "#00D4AA";

const LOG = (tag: string, msg: string, data?: any) => {
  if (data !== undefined) console.log(`[KryptoNow][${tag}] ${msg}`, JSON.stringify(data, null, 2));
  else console.log(`[KryptoNow][${tag}] ${msg}`);
};

type Step = "choice" | "create_show" | "import_input";

export default function Create() {
  const { signOut } = useAuth();
  const [step,    setStep]    = useState<Step>("choice");
  const [wallet,  setWallet]  = useState<ethers.Wallet | null>(null);
  const [imported, setImported] = useState("");
  const [copied,  setCopied]  = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    LOG("Generate", "Creating random wallet...");
    try {
      const w = ethers.Wallet.createRandom();
      LOG("Generate", "✅ Wallet created", { address: w.address });
      setWallet(w);
      setStep("create_show");
    } catch (e: any) {
      LOG("Generate", "❌ Failed", { error: e?.message });
      Alert.alert("Error", e?.message ?? "Failed to generate wallet");
    }
  };

  const handleCopyPhrase = async () => {
    const phrase = wallet?.mnemonic?.phrase;
    if (!phrase) return;
    await Clipboard.setStringAsync(phrase);
    LOG("Copy", "Phrase copied");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveWallet = async (phrase: string) => {
    LOG("Save", "Saving wallet...");
    setLoading(true);
    try {
      const w       = ethers.Wallet.fromPhrase(phrase);
      const address = w.address;
      const privKey = w.privateKey;
      LOG("Save", "Wallet derived", { address });

      const vault = await encryptPhrase(phrase, address);
      LOG("Save", "Phrase encrypted");

      // ✅ Bug 6 fix: NEVER store phrase in AsyncStorage — only address + encrypted vault
      await AsyncStorage.setItem("kryptonow_vault",   vault);
      await AsyncStorage.setItem("kryptonow_address", address);
      LOG("Save", "✅ AsyncStorage written (no plaintext phrase)");

      // Private key goes to SecureStore only
      await saveWalletKeys(privKey, phrase);
      LOG("Save", "✅ SecureStore keys saved");

      // ✅ Bug 1 fix: setWallet expects WalletData object, not a plain string
      useWalletStore.getState().setWallet({ address, phrase: '', name: 'Wallet 1' });
      LOG("Save", "✅ WalletStore updated → navigating to dashboard");

      router.replace('/dashboard');
    } catch (e: any) {
      LOG("Save", "❌ Error", { error: e?.message });
      Alert.alert("Error", e?.message ?? "Failed to save wallet");
    } finally {
      setLoading(false);
    }
  };

  const handleImportConfirm = () => {
    const phrase = imported.trim().replace(/\s+/g, " ");
    const words  = phrase.split(" ");
    LOG("Import", "Validating phrase", { wordCount: words.length });
    if (words.length !== 12 && words.length !== 24) {
      Alert.alert("Invalid phrase", "Please enter exactly 12 or 24 words.");
      return;
    }
    handleSaveWallet(phrase);
  };

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={s.loadingT}>Setting up your wallet...</Text>
      </View>
    );
  }

  if (step === "choice") {
    return (
      <View style={s.c}>
        <Text style={s.emoji}>⬡</Text>
        <Text style={s.title}>Your Web3 Wallet</Text>
        <Text style={s.sub}>Create a new wallet or import an existing one using your seed phrase.</Text>
        <TouchableOpacity style={s.btn} onPress={handleGenerate} activeOpacity={0.85}>
          <Text style={s.btnT}>✦  Create New Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btnOutline} onPress={() => setStep("import_input")} activeOpacity={0.85}>
          <Text style={s.btnOutlineT}>↓  Import Existing Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.logoutBtn} onPress={async () => { await signOut(); router.replace("/(auth)/sign-in"); }}>
          <Text style={s.logoutT}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === "create_show") {
    const phrase = wallet?.mnemonic?.phrase ?? "";
    const words  = phrase.split(" ").filter(Boolean);
    return (
      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.title}>Your Seed Phrase</Text>
        <Text style={s.sub}>Write these words down in order and store them safely offline.</Text>
        <View style={s.warningBox}>
          <Text style={s.warningT}>⚠  Never share these words. Anyone with them controls your funds.</Text>
        </View>
        <View style={s.phraseGrid}>
          {words.map((word, i) => (
            <View key={i} style={s.wordBox}>
              <Text style={s.wordNum}>{i + 1}</Text>
              <Text style={s.wordT}>{word}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={s.copyBtn} onPress={handleCopyPhrase} activeOpacity={0.8}>
          <Text style={s.copyBtnT}>{copied ? "✓  Copied!" : "Copy Phrase"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.btn} onPress={() => handleSaveWallet(phrase)} activeOpacity={0.85}>
          <Text style={s.btnT}>I have saved it — Continue →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.logoutBtn} onPress={() => setStep("choice")}>
          <Text style={s.logoutT}>← Back</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={s.scroll}>
      <Text style={s.title}>Import Wallet</Text>
      <Text style={s.sub}>Enter your 12 or 24 word seed phrase separated by spaces.</Text>
      <TextInput
        style={s.inputBox}
        value={imported}
        onChangeText={setImported}
        placeholder="word1 word2 word3 ..."
        placeholderTextColor="#4A7070"
        multiline
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity
        style={[s.btn, !imported.trim() && s.btnOff]}
        onPress={handleImportConfirm}
        disabled={!imported.trim()}
        activeOpacity={0.85}
      >
        <Text style={s.btnT}>Import Wallet →</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.logoutBtn} onPress={() => setStep("choice")}>
        <Text style={s.logoutT}>← Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  c:          { flex: 1, backgroundColor: TEAL, justifyContent: "center", alignItems: "center", padding: 32 },
  centered:   { flex: 1, backgroundColor: TEAL, justifyContent: "center", alignItems: "center", gap: 16 },
  scroll:     { flexGrow: 1, backgroundColor: TEAL, padding: 28, paddingTop: 70 },
  emoji:      { fontSize: 64, marginBottom: 24 },
  title:      { color: "#fff", fontSize: 26, fontWeight: "800", marginBottom: 10, textAlign: "center" },
  sub:        { color: "#94A3B8", fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  loadingT:   { color: ACCENT, fontSize: 16, fontWeight: "600" },
  warningBox: { backgroundColor: "#1a1a2e", borderRadius: 12, borderWidth: 1, borderColor: "#F59E0B", padding: 14, marginBottom: 24 },
  warningT:   { color: "#F59E0B", fontSize: 13, lineHeight: 19 },
  phraseGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24, justifyContent: "center" },
  wordBox:    { backgroundColor: "#0f3d3d", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, flexDirection: "row", gap: 6, alignItems: "center", minWidth: "28%" },
  wordNum:    { color: ACCENT, fontSize: 11, fontWeight: "700", minWidth: 16 },
  wordT:      { color: "#fff", fontSize: 14, fontWeight: "600" },
  copyBtn:    { borderWidth: 1.5, borderColor: ACCENT, borderRadius: 12, paddingVertical: 12, alignItems: "center", marginBottom: 14 },
  copyBtnT:   { color: ACCENT, fontSize: 14, fontWeight: "600" },
  btn:        { backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 16, alignItems: "center", width: "100%", marginBottom: 12 },
  btnOff:     { opacity: 0.35 },
  btnT:       { color: TEAL, fontSize: 16, fontWeight: "700" },
  btnOutline: { borderWidth: 1.5, borderColor: ACCENT, borderRadius: 14, paddingVertical: 16, alignItems: "center", width: "100%", marginBottom: 24 },
  btnOutlineT:{ color: ACCENT, fontSize: 16, fontWeight: "600" },
  logoutBtn:  { padding: 12 },
  logoutT:    { color: "#64748B", fontSize: 14 },
  inputBox:   { backgroundColor: "#0f3d3d", borderRadius: 14, borderWidth: 1.5, borderColor: "#1a5555", padding: 16, marginBottom: 20, minHeight: 120, color: "#fff", fontSize: 16, lineHeight: 26, textAlignVertical: "top" },
});
