import { useState, useEffect } from "react"
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Alert, Platform, Modal, TextInput, ActivityIndicator,
} from "react-native"
import { router } from "expo-router"
import { goBack } from "../utils/navigation"
import { useTheme, ThemeMode } from "../context/ThemeContext"
import { useLockContext } from "../context/LockContext"
import { Ionicons } from "@expo/vector-icons"
import { useWalletStore } from "../store/walletStore"
import { getSmartAccountAddress, chainSupportsAA, SmartAccountInfo } from "../utils/aa"
import { retrievePrivateKey, retrieveMnemonic, storePrivateKey, deletePrivateKey as deleteEnclaveKey, listAllAccounts } from "../store/SecureKeyStore"
import { CHAINS } from "../utils/chains"
import { useAuth } from "@clerk/expo"
import * as Clipboard from "expo-clipboard"
import { ethers } from "ethers"

async function encryptData(plainText: string, userPin: string): Promise<string> {
  if (Platform.OS === 'web') return "";
  const QuickCrypto = require('react-native-quick-crypto').default || require('react-native-quick-crypto');
  const salt = QuickCrypto.randomBytes(16);
  const iv = QuickCrypto.randomBytes(12);

  const keyBuf = await new Promise<Buffer>((resolve, reject) => {
    QuickCrypto.pbkdf2(
      userPin,
      salt,
      100_000,
      32,
      'sha512',
      (err: Error | null, key: Buffer) => (err ? reject(err) : resolve(key))
    );
  });

  const cipher = QuickCrypto.createCipheriv('aes-256-gcm', keyBuf, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(plainText, 'utf8')),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  const finalBuf = Buffer.concat([salt, iv, encrypted, authTag]);
  return finalBuf.toString('hex');
}

async function decryptData(encryptedHex: string, userPin: string): Promise<string> {
  if (Platform.OS === 'web') return "";
  const QuickCrypto = require('react-native-quick-crypto').default || require('react-native-quick-crypto');
  const buf = Buffer.from(encryptedHex, 'hex');

  const salt       = buf.slice(0, 16);
  const iv         = buf.slice(16, 28);
  const authTag    = buf.slice(buf.length - 16);
  const ciphertext = buf.slice(28, buf.length - 16);

  const keyBuf = await new Promise<Buffer>((resolve, reject) => {
    QuickCrypto.pbkdf2(
      userPin,
      salt,
      100_000,
      32,
      'sha512',
      (err: Error | null, key: Buffer) => (err ? reject(err) : resolve(key))
    );
  });

  const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

export default function Settings() {
  const addr                  = useWalletStore(s => s.address)
  const accounts                = useWalletStore(s => s.accounts)
  const activeAccountIndex      = useWalletStore(s => s.activeAccountIndex)
  const setActiveAccountIndex   = useWalletStore(s => s.setActiveAccountIndex)
  const setAccounts             = useWalletStore(s => s.setAccounts)
  const activeChain = useWalletStore(s => s.activeChain)
  const clearWallet = useWalletStore(s => s.clearWallet)
  const { signOut } = useAuth()
  const { theme, mode, setMode } = useTheme()

  // Wallet manager modal state
  const [showWalletManager, setShowWalletManager] = useState(false)
  const [showImportModal, setShowImportModal]     = useState(false)
  const [importKeyInput, setImportKeyInput]       = useState("")
  const [showBackupModal, setShowBackupModal]     = useState(false)
  const [backupPassword, setBackupPassword]       = useState("")
  const [backupHexOutput, setBackupHexOutput]     = useState("")
  const [showRestoreModal, setShowRestoreModal]   = useState(false)
  const [restorePayloadInput, setRestorePayloadInput] = useState("")
  const [restorePasswordInput, setRestorePasswordInput] = useState("")
  const { hasPin, lockState, lock, clearPin } = useLockContext()

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
    retrievePrivateKey(activeAccountIndex, 'Authenticate to load smart account info')
      .then(async res => {
        if (!res.ok || !res.data) return
        const info = await getSmartAccountAddress(res.data, activeChain.id)
        setAaInfo(info)
      })
      .catch(() => {})
      .finally(() => setAaLoading(false))
  }, [addr, activeChain.id, activeAccountIndex])

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

  // Wallet management actions
  const handleCreateNewAccount = async () => {
    setAaLoading(true)
    try {
      const mnemoRes = await retrieveMnemonic(0, 'Authenticate to derive new account')
      if (!mnemoRes.ok || !mnemoRes.data) {
        Alert.alert('Error', mnemoRes.error ?? 'Authentication required to access seed phrase.')
        return
      }
      
      const mnemonic = mnemoRes.data
      const nextIndex = accounts.length
      const path = `m/44'/60'/0'/0/${nextIndex}`
      
      const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path)
      const privKeyHex = hdNode.privateKey.replace('0x', '')
      
      const storeRes = await storePrivateKey(privKeyHex, {
        accountIndex: nextIndex,
        address: hdNode.address,
        derivationPath: path
      })
      
      if (!storeRes.ok) {
        Alert.alert('Error', storeRes.error ?? 'Failed to store new account key in Enclave.')
        return
      }
      
      const updatedAccountsRes = await listAllAccounts()
      if (updatedAccountsRes.ok && updatedAccountsRes.data) {
        setAccounts(updatedAccountsRes.data)
        Alert.alert('Success', `Successfully created and derived Account #${nextIndex + 1}!`)
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Unknown error creating account.')
    } finally {
      setAaLoading(false)
    }
  }

  const handleImportConfirm = async () => {
    const cleanKey = importKeyInput.trim().replace('0x', '')
    if (cleanKey.length !== 64) {
      Alert.alert('Error', 'Please enter a valid 64-character hex private key.')
      return
    }
    
    setAaLoading(true)
    try {
      const nextIndex = accounts.length
      const w = new ethers.Wallet('0x' + cleanKey)
      const storeRes = await storePrivateKey(cleanKey, {
        accountIndex: nextIndex,
        address: w.address,
        derivationPath: 'imported'
      })
      
      if (!storeRes.ok) {
        Alert.alert('Error', storeRes.error ?? 'Failed to store imported key in Enclave.')
        return
      }
      
      const updatedAccountsRes = await listAllAccounts()
      if (updatedAccountsRes.ok && updatedAccountsRes.data) {
        setAccounts(updatedAccountsRes.data)
        Alert.alert('Success', `Successfully imported Private Key as Account #${nextIndex + 1}!`)
        setShowImportModal(false)
        setImportKeyInput("")
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Invalid private key format.')
    } finally {
      setAaLoading(false)
    }
  }

  const handleExportSeedPhrase = async (idx: number) => {
    const mnemoRes = await retrieveMnemonic(idx, 'Authenticate to reveal seed phrase')
    if (mnemoRes.ok && mnemoRes.data) {
      Alert.alert(
        'Recovery Seed Phrase',
        `YOUR SEED PHRASE:\n\n${mnemoRes.data}\n\nWARNING: Keep this secret and store it offline. Anyone with these words can steal all your funds.`,
        [
          { text: 'Copy to Clipboard', onPress: async () => {
            await Clipboard.setStringAsync(mnemoRes.data!)
            Alert.alert('Copied!', 'Seed phrase copied to clipboard.')
          }},
          { text: 'Close', style: 'cancel' }
        ]
      )
    } else {
      Alert.alert('Failed', mnemoRes.error ?? 'Authentication failed.')
    }
  }

  const handleExportPrivateKey = async (idx: number) => {
    const keyRes = await retrievePrivateKey(idx, 'Authenticate to reveal private key')
    if (keyRes.ok && keyRes.data) {
      Alert.alert(
        'Private Key',
        `YOUR PRIVATE KEY:\n\n0x${keyRes.data}\n\nWARNING: Never share your private key. Anyone with it controls your address.`,
        [
          { text: 'Copy to Clipboard', onPress: async () => {
            await Clipboard.setStringAsync('0x' + keyRes.data!)
            Alert.alert('Copied!', 'Private key copied to clipboard.')
          }},
          { text: 'Close', style: 'cancel' }
        ]
      )
    } else {
      Alert.alert('Failed', keyRes.error ?? 'Authentication failed.')
    }
  }

  // cloud backup helper functions
  const handleInitiateBackup = () => {
    setBackupPassword("")
    setBackupHexOutput("")
    setShowBackupModal(true)
  }

  const handleBackupConfirm = async () => {
    if (!backupPassword.trim()) {
      Alert.alert("Password required", "Please enter a passcode to secure your backup.")
      return
    }
    setAaLoading(true)
    try {
      const mnemoRes = await retrieveMnemonic(0, 'Authenticate to backup your master seed phrase')
      if (!mnemoRes.ok || !mnemoRes.data) {
        Alert.alert('Error', mnemoRes.error ?? 'Authentication required.')
        return
      }

      const backupObj = {
        mnemonic: mnemoRes.data,
        accounts: accounts.map(a => ({
          index: a.accountIndex,
          address: a.address,
          derivationPath: a.derivationPath
        })),
        createdAt: Date.now()
      }

      const encrypted = await encryptData(JSON.stringify(backupObj), backupPassword.trim())
      setBackupHexOutput(encrypted)
      Alert.alert("Success", "Backup generated! Copy your encrypted payload or export the file below.")
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Encryption failed.")
    } finally {
      setAaLoading(false)
    }
  }

  const handleExportBackupShare = async () => {
    if (Platform.OS === 'web') {
      Alert.alert("Not supported", "File sharing is only supported on mobile devices.")
      return
    }
    if (!backupHexOutput) {
      Alert.alert("Error", "Please generate backup first.")
      return
    }
    try {
      const FileSystem = require('expo-file-system')
      const Sharing = require('expo-sharing')
      
      const fileUri = `${FileSystem.documentDirectory}kryptonow_backup_${Date.now()}.json`
      const backupEnvelope = {
        version: 1,
        payload: backupHexOutput,
        timestamp: Date.now()
      }
      
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(backupEnvelope))
      await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Export Cloud Backup' })
    } catch (e: any) {
      Alert.alert("Error", e.message)
    }
  }

  const handleInitiateRestore = () => {
    setRestorePayloadInput("")
    setRestorePasswordInput("")
    setShowRestoreModal(true)
  }

  const handleRestoreBackupConfirm = async () => {
    if (!restorePayloadInput.trim() || !restorePasswordInput.trim()) {
      Alert.alert("Error", "Please fill in both fields.")
      return
    }
    setAaLoading(true)
    try {
      let payloadStr = restorePayloadInput.trim()
      // If user imported the full JSON file, extract the payload field
      try {
        const jsonParsed = JSON.parse(payloadStr)
        if (jsonParsed.payload) {
          payloadStr = jsonParsed.payload
        }
      } catch {}

      let decryptedStr = ""
      try {
        decryptedStr = await decryptData(payloadStr, restorePasswordInput.trim())
      } catch {
        Alert.alert("Error", "Decryption failed. Please verify your password.")
        return
      }

      const backupObj = JSON.parse(decryptedStr)
      if (!backupObj.mnemonic) {
        Alert.alert("Error", "Invalid backup format.")
        return
      }

      const w = ethers.Wallet.fromPhrase(backupObj.mnemonic)
      const storeRes = await storePrivateKey(w.privateKey.replace('0x', ''), {
        accountIndex: 0,
        address: w.address,
        derivationPath: "m/44'/60'/0'/0/0"
      })

      if (!storeRes.ok) {
        Alert.alert("Error", storeRes.error ?? "Failed to save restored wallet.")
        return
      }

      if (backupObj.accounts && backupObj.accounts.length > 0) {
        for (const acc of backupObj.accounts) {
          if (acc.index === 0) continue
          const path = acc.derivationPath || `m/44'/60'/0'/0/${acc.index}`
          if (path === 'imported') continue
          
          const hdNode = ethers.HDNodeWallet.fromPhrase(backupObj.mnemonic, undefined, path)
          await storePrivateKey(hdNode.privateKey.replace('0x', ''), {
            accountIndex: acc.index,
            address: hdNode.address,
            derivationPath: path
          })
        }
      }

      const updatedAccountsRes = await listAllAccounts()
      if (updatedAccountsRes.ok && updatedAccountsRes.data) {
        setAccounts(updatedAccountsRes.data)
        await setActiveAccountIndex(0)
        Alert.alert("Success", "Wallet successfully restored from cloud backup!")
        setShowRestoreModal(false)
        setRestorePayloadInput("")
        setRestorePasswordInput("")
      }
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to restore backup.")
    } finally {
      setAaLoading(false)
    }
  }

  const handleDeleteAccount = async (idx: number) => {
    if (idx === 0) {
      Alert.alert('Protected', 'The primary master wallet (Account #1) cannot be deleted. You can wipe the whole wallet in Settings Danger Zone instead.')
      return
    }
    
    Alert.alert(
      'Remove Wallet',
      'Are you sure you want to permanently remove this account from your enclave? Make sure you have backed up any keys.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: async () => {
          setAaLoading(true)
          try {
            const delRes = await deleteEnclaveKey(idx)
            if (delRes.ok) {
              const updatedAccountsRes = await listAllAccounts()
              if (updatedAccountsRes.ok && updatedAccountsRes.data) {
                setAccounts(updatedAccountsRes.data)
                if (activeAccountIndex === idx) {
                  await setActiveAccountIndex(0)
                }
                Alert.alert('Success', 'Account successfully removed.')
              }
            } else {
              Alert.alert('Error', delRes.error ?? 'Failed to delete account.')
            }
          } catch (e: any) {
            Alert.alert('Error', e?.message ?? 'Unknown error.')
          } finally {
            setAaLoading(false)
          }
        }}
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
        { icon: "W", iconBg: "#EEF2FF", label: "Manage Wallets",      sublabel: `${accounts.length} active wallets`, type: "nav", onPress: () => setShowWalletManager(true) },
        { icon: "#", iconBg: "#EEF2FF", label: "Wallet Address",     sublabel: short,                          type: "action", onPress: copyAddress },
        { icon: "*", iconBg: "#FFF7ED", label: "Export Private Key",  sublabel: "Tap to reveal (keep secret)", type: "nav",    onPress: () => handleExportPrivateKey(activeAccountIndex) },
        { icon: "2", iconBg: "#EEF2FF", label: "Two-Factor Auth",     sublabel: "Authenticator, SMS, Backup codes", type: "nav",    onPress: () => router.push("/mfa" as any) },
        { icon: "S", iconBg: "#ECFDF5", label: "Backup Seed Phrase",  sublabel: "Verify your recovery words",  type: "nav",    onPress: () => handleExportSeedPhrase(activeAccountIndex) },
        { icon: "N", iconBg: "#F0F9FF", label: "Active Network",      sublabel: activeChain.name,              type: "info" },
        { icon: "SR", iconBg: "#D1FAE5", label: "Social Recovery", sublabel: "Manage guardians", type: "nav", onPress: () => router.push("/recovery" as any) },
        { icon: "AA", iconBg: "#EEF2FF", label: "Smart Account",
          sublabel: aaLoading ? "Loading..." : aaInfo ? aaInfo.address.slice(0,10) + "..." + aaInfo.address.slice(-8) : Platform.OS === "web" ? "Native only" : !chainSupportsAA(activeChain.id) ? "Not supported on " + activeChain.name : "Tap to load",
          type: "action", onPress: aaInfo ? copyAAAddress : undefined },
        { icon: aaInfo?.isDeployed ? "D" : "N", iconBg: aaInfo?.isDeployed ? "#ECFDF5" : "#F8FAFF",
          label: "Account Status",
          sublabel: aaLoading ? "Checking..." : aaInfo?.isDeployed ? "Deployed on-chain" : aaInfo ? "Not yet deployed (deploys on first tx)" : "",
          type: "info" },
        { icon: "G", iconBg: "#FFFBEB", label: "Gas Sponsorship",
          sublabel: aaInfo?.gasless ? "Gasless  Pimlico sponsors gas" : "Standard gas (add Pimlico key for gasless)",
          type: "info" },
      ],
    },
    {
      title: "CLOUD BACKUP & RECOVERY",
      items: [
        { icon: "☁️", iconBg: "#E0F2FE", label: "Backup to Cloud", sublabel: "AES-256 Encrypted Backup", type: "nav", onPress: handleInitiateBackup },
        { icon: "🔄", iconBg: "#FFEDD5", label: "Restore from Cloud", sublabel: "Restore wallet parameters", type: "nav", onPress: handleInitiateRestore },
      ]
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
        <TouchableOpacity style={st.back} onPress={() => goBack()} activeOpacity={0.7}>
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
              {sec.items.map((item, idx) => {
                const isClickable = item.type === "nav" || item.type === "action"
                const RowWrapper = isClickable ? TouchableOpacity : View
                return (
                  <RowWrapper
                    key={item.label}
                    style={[st.row, idx < sec.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.borderLight }]}
                    {...(isClickable ? { onPress: item.onPress, activeOpacity: 0.7 } : {})}
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
                  </RowWrapper>
                )
              })}
            </View>
          </View>
        ))}

        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <TouchableOpacity style={[st.logoutBtn, { backgroundColor: theme.bgCard, borderColor: theme.border }]} onPress={confirmLogout} activeOpacity={0.85}>
            <Text style={[st.logoutIcon, { color: theme.error }]}>O</Text>
            <Text style={[st.logoutT, { color: theme.textSecondary }]}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Sleek Wallet Manager Modal */}
      <Modal visible={showWalletManager} animationType="slide" transparent>
        <View style={st.modalOverlay}>
          <View style={[st.modalContent, { backgroundColor: theme.bgCard }]}>
            <View style={st.modalHeader}>
              <Text style={[st.modalTitle, { color: theme.textPrimary }]}>Manage Wallets</Text>
              <TouchableOpacity onPress={() => setShowWalletManager(false)}>
                <Ionicons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={st.modalScroll} showsVerticalScrollIndicator={false}>
              {aaLoading && (
                <View style={st.loadingOverlay}>
                  <ActivityIndicator size="large" color={activeChain.color} />
                  <Text style={[st.loadingOverlayT, { color: theme.textSecondary }]}>Processing enclave operation...</Text>
                </View>
              )}

              {accounts.map((acc, index) => (
                <View key={index} style={[
                  st.walletItem,
                  { borderColor: activeAccountIndex === acc.accountIndex ? activeChain.color : theme.borderLight }
                ]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[st.walletItemNum, { color: theme.textPrimary }]}>Account #{acc.accountIndex + 1}</Text>
                      {activeAccountIndex === acc.accountIndex && (
                        <View style={[st.activeBadge, { backgroundColor: activeChain.color }]}>
                          <Text style={st.activeBadgeT}>Active</Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity onPress={() => {
                      setActiveAccountIndex(acc.accountIndex)
                      setShowWalletManager(false)
                    }}>
                      <Text style={[st.switchBtnT, { color: activeChain.color }]}>
                        {activeAccountIndex === acc.accountIndex ? "" : "Select"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={[st.walletItemAddr, { color: theme.textMuted }]}>{acc.address}</Text>

                  {/* Wallet Controls */}
                  <View style={st.walletControls}>
                    <TouchableOpacity style={st.controlBtn} onPress={() => handleExportPrivateKey(acc.accountIndex)}>
                      <Ionicons name="key" size={14} color="#6366F1" />
                      <Text style={st.controlBtnT}>Private Key</Text>
                    </TouchableOpacity>
                    {acc.accountIndex === 0 && (
                      <TouchableOpacity style={st.controlBtn} onPress={() => handleExportSeedPhrase(acc.accountIndex)}>
                        <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                        <Text style={st.controlBtnT}>Seed Phrase</Text>
                      </TouchableOpacity>
                    )}
                    {acc.accountIndex > 0 && (
                      <TouchableOpacity style={[st.controlBtn, { borderColor: "#FECDD3" }]} onPress={() => handleDeleteAccount(acc.accountIndex)}>
                        <Ionicons name="trash" size={14} color="#EF4444" />
                        <Text style={[st.controlBtnT, { color: "#EF4444" }]}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Manager Buttons */}
            <View style={st.modalActions}>
              <TouchableOpacity style={[st.actionBtnOutline, { borderColor: activeChain.color }]} onPress={handleCreateNewAccount}>
                <Ionicons name="add" size={20} color={activeChain.color} />
                <Text style={[st.actionBtnOutlineT, { color: activeChain.color }]}>Derive Wallet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.actionBtnSolid, { backgroundColor: activeChain.color }]} onPress={() => setShowImportModal(true)}>
                <Ionicons name="download-outline" size={18} color="#fff" />
                <Text style={st.actionBtnSolidT}>Import Key</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Private Key Import Modal */}
      <Modal visible={showImportModal} animationType="fade" transparent>
        <View style={st.popupOverlay}>
          <View style={[st.popupContent, { backgroundColor: theme.bgCard }]}>
            <Text style={[st.popupTitle, { color: theme.textPrimary }]}>Import Private Key</Text>
            <Text style={[st.popupSub, { color: theme.textMuted }]}>Enter your 64-character hex private key. It will be secured in the enclave.</Text>
            
            <TextInput
              style={[st.popupInput, { color: theme.textPrimary, borderColor: theme.border }]}
              placeholder="0x..."
              placeholderTextColor="#94A3B8"
              value={importKeyInput}
              onChangeText={setImportKeyInput}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />

            <View style={st.popupActions}>
              <TouchableOpacity style={st.popupBtnCancel} onPress={() => setShowImportModal(false)}>
                <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.popupBtnConfirm, { backgroundColor: activeChain.color }]} onPress={handleImportConfirm}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Import</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cloud Backup Modal */}
      <Modal visible={showBackupModal} animationType="fade" transparent>
        <View style={st.popupOverlay}>
          <View style={[st.popupContent, { backgroundColor: theme.bgCard }]}>
            <Text style={[st.popupTitle, { color: theme.textPrimary }]}>Cloud Backup</Text>
            <Text style={[st.popupSub, { color: theme.textMuted }]}>Create an encrypted backup passcode. This passcode is required to decrypt your recovery parameters.</Text>
            
            {!backupHexOutput ? (
              <>
                <TextInput
                  style={[st.popupInput, { color: theme.textPrimary, borderColor: theme.border }]}
                  placeholder="Enter secure passcode"
                  placeholderTextColor="#94A3B8"
                  value={backupPassword}
                  onChangeText={setBackupPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                />
                <View style={st.popupActions}>
                  <TouchableOpacity style={st.popupBtnCancel} onPress={() => setShowBackupModal(false)}>
                    <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[st.popupBtnConfirm, { backgroundColor: activeChain.color }]} onPress={handleBackupConfirm}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Encrypt</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={[st.popupSub, { color: "#10B981", fontWeight: "700", marginBottom: 12 }]}>✓ AES-256 encrypted backup envelope generated!</Text>
                <TextInput
                  style={[st.popupInput, { color: theme.textPrimary, borderColor: theme.border, height: 80, fontSize: 10 }]}
                  multiline
                  editable={false}
                  value={backupHexOutput}
                />
                <View style={{ flexDirection: "column", gap: 10 }}>
                  <TouchableOpacity style={[st.popupBtnConfirm, { backgroundColor: "#6366F1", width: '100%' }]} onPress={async () => {
                    await Clipboard.setStringAsync(backupHexOutput)
                    Alert.alert("Copied!", "Encrypted string payload copied to clipboard.")
                  }}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Copy Payload</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[st.popupBtnConfirm, { backgroundColor: "#10B981", width: '100%' }]} onPress={handleExportBackupShare}>
                    <Text style={{ color: "#fff", fontWeight: "700" }}>Export Backup File (.json)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[st.popupBtnCancel, { width: '100%' }]} onPress={() => {
                    setShowBackupModal(false)
                    setBackupHexOutput("")
                  }}>
                    <Text style={{ color: theme.textSecondary, fontWeight: "700" }}>Close</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Cloud Restore Modal */}
      <Modal visible={showRestoreModal} animationType="fade" transparent>
        <View style={st.popupOverlay}>
          <View style={[st.popupContent, { backgroundColor: theme.bgCard }]}>
            <Text style={[st.popupTitle, { color: theme.textPrimary }]}>Restore from Cloud</Text>
            <Text style={[st.popupSub, { color: theme.textMuted }]}>Paste your encrypted backup payload string or complete backup file content below, then enter your secure passcode.</Text>
            
            <TextInput
              style={[st.popupInput, { color: theme.textPrimary, borderColor: theme.border, height: 80, fontSize: 11 }]}
              placeholder="Paste encrypted payload string..."
              placeholderTextColor="#94A3B8"
              value={restorePayloadInput}
              onChangeText={setRestorePayloadInput}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={[st.popupInput, { color: theme.textPrimary, borderColor: theme.border }]}
              placeholder="Passcode used for encryption"
              placeholderTextColor="#94A3B8"
              value={restorePasswordInput}
              onChangeText={setRestorePasswordInput}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={st.popupActions}>
              <TouchableOpacity style={st.popupBtnCancel} onPress={() => setShowRestoreModal(false)}>
                <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.popupBtnConfirm, { backgroundColor: activeChain.color }]} onPress={handleRestoreBackupConfirm}>
                <Text style={{ color: "#fff", fontWeight: "700" }}>Decrypt & Restore</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // Wallet manager modal styling
  modalOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.6)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: "85%" },
  modalHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle:   { fontSize: 20, fontWeight: "800" },
  modalScroll:  { paddingBottom: 24 },
  loadingOverlay: { padding: 20, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingOverlayT: { fontSize: 13, fontWeight: "600" },
  
  walletItem:   { borderRadius: 20, padding: 16, borderWidth: 1.5, marginBottom: 14, backgroundColor: "rgba(248, 250, 252, 0.5)" },
  walletItemNum: { fontSize: 15, fontWeight: "700" },
  activeBadge:  { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  activeBadgeT: { color: "#fff", fontSize: 10, fontWeight: "800" },
  switchBtnT:   { fontSize: 13, fontWeight: "700" },
  walletItemAddr: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 4 },
  
  walletControls: { flexDirection: "row", gap: 10, marginTop: 12 },
  controlBtn:   { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#E2E8F0", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12 },
  controlBtnT:  { fontSize: 11, fontWeight: "600", color: "#64748B" },
  
  modalActions: { flexDirection: "row", gap: 12, marginTop: 16, paddingBottom: Platform.OS === 'ios' ? 20 : 0 },
  actionBtnOutline: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 2, paddingVertical: 14, borderRadius: 16 },
  actionBtnOutlineT: { fontSize: 14, fontWeight: "700" },
  actionBtnSolid: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 16 },
  actionBtnSolidT: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // Import Popup Modals
  popupOverlay: { flex: 1, backgroundColor: "rgba(15, 23, 42, 0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  popupContent: { width: "100%", maxWidth: 360, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  popupTitle:   { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  popupSub:     { fontSize: 12, lineHeight: 18, marginBottom: 16 },
  popupInput:   { borderWidth: 1.5, borderRadius: 14, padding: 14, fontSize: 14, marginBottom: 20 },
  popupActions: { flexDirection: "row", gap: 12 },
  popupBtnCancel: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  popupBtnConfirm: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
})