import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Alert, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { useWalletStore } from '../store/walletStore'
import { CHAINS } from '../utils/chains'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Clipboard from 'expo-clipboard'

type Section = { title: string; items: Item[] }
type Item = {
  icon: string; label: string; sublabel?: string
  type: 'nav' | 'toggle' | 'action' | 'info'
  value?: boolean; color?: string
  onPress?: () => void
  onToggle?: (v: boolean) => void
}

export default function Settings() {
  const addr        = useWalletStore(s => s.address)
  const activeChain = useWalletStore(s => s.activeChain)
  const clearWallet = useWalletStore(s => s.clearWallet)

  const [biometrics,    setBiometrics]    = useState(false)
  const [notifications, setNotifications] = useState(true)
  const [hideBalance,   setHideBalance]   = useState(false)
  const [testnet,       setTestnet]       = useState(false)
  const [copied,        setCopied]        = useState(false)

  const short = addr ? addr.slice(0, 10) + '...' + addr.slice(-8) : ''

  const copyAddress = async () => {
    if (addr) {
      await Clipboard.setStringAsync(addr)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const confirmWipe = () => {
    Alert.alert(
      'Wipe Wallet',
      'This will permanently delete your wallet from this device. Make sure you have backed up your seed phrase.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Wipe Wallet',
          style: 'destructive',
          onPress: async () => {
            clearWallet?.()
            await AsyncStorage.clear()
            router.replace('/')
          },
        },
      ]
    )
  }

  const sections: Section[] = [
    {
      title: 'WALLET',
      items: [
        {
          icon: 'clipboard',
          label: 'Wallet Address',
          sublabel: short,
          type: 'action',
          onPress: copyAddress,
        },
        {
          icon: 'key',
          label: 'Export Private Key',
          sublabel: 'Tap to reveal (keep secret)',
          type: 'nav',
          onPress: () => Alert.alert(
            'Security Notice',
            'Never share your private key. This feature requires biometric authentication.'
          ),
        },
        {
          icon: 'seed',
          label: 'Backup Seed Phrase',
          sublabel: 'Verify your recovery words',
          type: 'nav',
          onPress: () => Alert.alert(
            'Backup',
            'Write down your 12-word seed phrase and store it safely offline.'
          ),
        },
        {
          icon: 'network',
          label: 'Active Network',
          sublabel: activeChain.name,
          type: 'info',
        },
      ],
    },
    {
      title: 'SECURITY',
      items: [
        {
          icon: 'eye',
          label: 'Hide Balance',
          sublabel: 'Mask amounts on dashboard',
          type: 'toggle',
          value: hideBalance,
          onToggle: setHideBalance,
        },
        {
          icon: 'lock',
          label: 'Biometric Lock',
          sublabel: 'Require Face ID / fingerprint',
          type: 'toggle',
          value: biometrics,
          onToggle: setBiometrics,
        },
      ],
    },
    {
      title: 'APP',
      items: [
        {
          icon: 'bell',
          label: 'Push Notifications',
          sublabel: 'Transaction alerts',
          type: 'toggle',
          value: notifications,
          onToggle: setNotifications,
        },
        {
          icon: 'flask',
          label: 'Testnet Mode',
          sublabel: 'Show test networks',
          type: 'toggle',
          value: testnet,
          onToggle: setTestnet,
        },
        {
          icon: 'history',
          label: 'Transaction History',
          sublabel: 'View all past activity',
          type: 'nav',
          onPress: () => router.push('/history' as any),
        },
        {
          icon: 'contacts',
          label: 'Address Book',
          sublabel: 'Saved contacts',
          type: 'nav',
          onPress: () => router.push('/addressbook' as any),
        },
      ],
    },
    {
      title: 'ABOUT',
      items: [
        { icon: 'info',  label: 'Version',    sublabel: '1.0.0',           type: 'info' },
        { icon: 'shield',label: 'Encryption', sublabel: 'AES-256-GCM',     type: 'info' },
        { icon: 'chain', label: 'Networks',   sublabel: `${CHAINS.length} chains`, type: 'info' },
      ],
    },
    {
      title: 'DANGER ZONE',
      items: [
        {
          icon: 'trash',
          label: 'Wipe Wallet',
          sublabel: 'Remove all data from device',
          type: 'action',
          color: '#EF4444',
          onPress: confirmWipe,
        },
      ],
    },
  ]

  // Render icon as colored text symbol — no emoji, no encoding issues
  function renderIcon(icon: string, color: string, danger?: string) {
    const MAP: Record<string, string> = {
      clipboard: '⊞',
      key:       '⚿',
      seed:      '⬡',
      network:   '◉',
      eye:       '◎',
      lock:      '⊘',
      bell:      '◈',
      flask:     '⬢',
      history:   '◷',
      contacts:  '⊕',
      info:      'ℹ',
      shield:    '⊛',
      chain:     '⊗',
      trash:     '⊠',
    }
    return (
      <View style={[
        styles.iconWrap,
        { backgroundColor: danger ? '#FEF2F2' : color + '18' }
      ]}>
        <Text style={[styles.iconT, { color: danger ?? color }]}>
          {MAP[icon] ?? '•'}
        </Text>
      </View>
    )
  }

  return (
    <View style={styles.c}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backT}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Profile card */}
        <View style={[styles.profileCard, { backgroundColor: activeChain.color }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarT}>V</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileLabel}>Kryptonow Wallet</Text>
            <Text style={styles.profileAddr} numberOfLines={1}>{short}</Text>
          </View>
          <TouchableOpacity
            style={styles.copyBtn}
            onPress={copyAddress}
            activeOpacity={0.8}
          >
            <Text style={styles.copyBtnT}>{copied ? 'Copied!' : 'Copy'}</Text>
          </TouchableOpacity>
        </View>

        {/* Sections */}
        {sections.map(sec => (
          <View key={sec.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{sec.title}</Text>
            <View style={styles.card}>
              {sec.items.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.row,
                    idx < sec.items.length - 1 && styles.rowBorder,
                  ]}
                  onPress={
                    item.type !== 'toggle' && item.type !== 'info'
                      ? item.onPress
                      : undefined
                  }
                  activeOpacity={
                    item.type === 'info' || item.type === 'toggle' ? 1 : 0.7
                  }
                >
                  {renderIcon(item.icon, activeChain.color, item.color)}

                  <View style={styles.rowMid}>
                    <Text style={[
                      styles.rowLabel,
                      item.color ? { color: item.color } : {},
                    ]}>
                      {item.label}
                    </Text>
                    {item.sublabel && item.type !== 'info' && (
                      <Text style={styles.rowSub}>{item.sublabel}</Text>
                    )}
                  </View>

                  {item.type === 'toggle' && (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      trackColor={{
                        false: '#E2E8F0',
                        true:  activeChain.color,
                      }}
                      thumbColor="#fff"
                    />
                  )}
                  {item.type === 'nav' && (
                    <Text style={styles.chevron}>{'>'}</Text>
                  )}
                  {item.type === 'info' && (
                    <Text style={styles.infoVal}>{item.sublabel}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  c:            { flex: 1, backgroundColor: '#F8FAFF' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  back:         { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  backT:        { fontSize: 18, color: '#6366F1', fontWeight: '700' },
  title:        { color: '#1E1B4B', fontSize: 18, fontWeight: '700' },
  profileCard:  { marginHorizontal: 16, marginBottom: 24, borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 },
  avatar:       { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarT:      { color: '#fff', fontSize: 20, fontWeight: '700' },
  profileLabel: { color: '#fff', fontSize: 15, fontWeight: '700' },
  profileAddr:  { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  copyBtn:      { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20 },
  copyBtnT:     { color: '#fff', fontSize: 13, fontWeight: '600' },
  section:      { paddingHorizontal: 16, marginBottom: 20 },
  sectionTitle: { color: '#94A3B8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingLeft: 4 },
  card:         { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden' },
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  rowBorder:    { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  iconWrap:     { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconT:        { fontSize: 18, fontWeight: '600' },
  rowMid:       { flex: 1 },
  rowLabel:     { color: '#1E1B4B', fontSize: 15, fontWeight: '500' },
  rowSub:       { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  chevron:      { color: '#CBD5E1', fontSize: 18, fontWeight: '700' },
  infoVal:      { color: '#94A3B8', fontSize: 13 },
})

