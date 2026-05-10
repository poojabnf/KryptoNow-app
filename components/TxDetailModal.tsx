import { useRef, useEffect } from 'react'
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Animated, Linking, Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '../context/ThemeContext'
import { useWalletStore } from '../store/walletStore'
import { getTxUrl } from '../utils/chains'
import type { Tx } from '../hooks/useTransactions'
import { useToast } from '../context/ToastContext'

type Props = {
  tx:       Tx | null
  visible:  boolean
  onClose:  () => void
}

function relTime(ts: number) {
  const d = Math.floor(Date.now() / 1000) - ts
  if (d < 60)    return `${d} seconds ago`
  if (d < 3600)  return `${Math.floor(d / 60)} minutes ago`
  if (d < 86400) return `${Math.floor(d / 3600)} hours ago`
  return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const TYPE_META: Record<string, { label: string; icon: string; bg: string; color: string }> = {
  send:          { label: 'Sent',           icon: 'arrow-up-circle',   bg: '#FEF2F2', color: '#EF4444' },
  receive:       { label: 'Received',       icon: 'arrow-down-circle', bg: '#D1FAE5', color: '#10B981' },
  token_send:    { label: 'Token Sent',     icon: 'arrow-up-circle',   bg: '#FEF3C7', color: '#F59E0B' },
  token_receive: { label: 'Token Received', icon: 'arrow-down-circle', bg: '#CFFAFE', color: '#06B6D4' },
  contract:      { label: 'Contract Call',  icon: 'code-slash',        bg: '#EDE9FE', color: '#8B5CF6' },
}

function Row({ label, value, mono = false, color }: { label: string; value: string; mono?: boolean; color?: string }) {
  return (
    <View style={dt.row}>
      <Text style={dt.rowLabel}>{label}</Text>
      <Text style={[dt.rowValue, mono && dt.mono, color ? { color } : {}]} numberOfLines={1} ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  )
}

export default function TxDetailModal({ tx, visible, onClose }: Props) {
  const { theme }   = useTheme()
  const activeChain = useWalletStore(s => s.activeChain)
  const toast       = useToast()
  const slide       = useRef(new Animated.Value(600)).current

  useEffect(() => {
    Animated.spring(slide, {
      toValue:         visible ? 0 : 600,
      useNativeDriver: true,
      tension:         60,
      friction:        12,
    }).start()
  }, [visible])

  if (!tx) return null

  const meta   = TYPE_META[tx.type] ?? TYPE_META.contract
  const isSend = tx.type === 'send' || tx.type === 'token_send'
  const gasFmt = parseFloat(tx.gasCostETH) > 0
    ? parseFloat(tx.gasCostETH).toFixed(6) + ' ' + activeChain.symbol
    : '—'

  function openExplorer() {
    const url = getTxUrl(activeChain, tx!.hash)
    Linking.openURL(url).catch(() => {})
  }

  function copyHash() {
    if (Platform.OS === 'web') {
      navigator.clipboard?.writeText(tx!.hash).catch(() => {})
    } else {
      const { Clipboard } = require('react-native')
      Clipboard.setString(tx!.hash)
    }
    toast.success('Transaction hash copied')
  }

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="none">
      <TouchableOpacity style={dt.overlay} activeOpacity={1} onPress={onClose} />

      <Animated.View
        style={[dt.sheet, { backgroundColor: theme.bgCard, transform: [{ translateY: slide }] }]}
      >
        {/* Handle */}
        <View style={[dt.handle, { backgroundColor: theme.border }]} />

        {/* Icon + title */}
        <View style={dt.topRow}>
          <View style={[dt.iconWrap, { backgroundColor: meta.bg }]}>
            <Ionicons name={meta.icon as any} size={32} color={meta.color} />
          </View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[dt.typeLabel, { color: theme.textPrimary }]}>{meta.label}</Text>
            <Text style={[dt.amtLabel, { color: isSend ? theme.error : theme.success }]}>
              {isSend ? '−' : '+'}{tx.value} {tx.symbol}
            </Text>
          </View>
          <View style={[dt.statusPill, {
            backgroundColor: tx.status === 'success'
              ? theme.successBg
              : tx.status === 'failed' ? theme.errorBg : '#FEF3C7',
          }]}>
            <Text style={[dt.statusT, {
              color: tx.status === 'success'
                ? theme.success
                : tx.status === 'failed' ? theme.error : theme.warning,
            }]}>
              {tx.status === 'success' ? 'Confirmed' : tx.status === 'failed' ? 'Failed' : 'Pending'}
            </Text>
          </View>
        </View>

        <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
          <View style={[dt.detailCard, { backgroundColor: theme.bgCardAlt, borderColor: theme.border }]}>
            <Row label="Time"         value={relTime(tx.timestamp)} />
            <Row label="Block"        value={tx.blockNumber ? '#' + tx.blockNumber : '—'} />
            <Row label="From"         value={tx.from} mono />
            <Row label="To"           value={tx.to}   mono />
            <Row label="Gas cost"     value={gasFmt}  />
            <Row label="Gas price"    value={tx.gasPrice ? (parseFloat(tx.gasPrice) / 1e9).toFixed(2) + ' Gwei' : '—'} />
            <Row label="Gas used"     value={tx.gasUsed ?? '—'} />
            <Row label="Network"      value={activeChain.name} />
            {tx.isERC20 && <Row label="Token"  value={tx.tokenName} />}
          </View>

          {/* Hash row with copy */}
          <View style={[dt.hashCard, { backgroundColor: theme.bgCardAlt, borderColor: theme.border }]}>
            <Text style={[dt.hashLabel, { color: theme.textSecondary }]}>Transaction Hash</Text>
            <Text style={[dt.hashValue, { color: theme.textPrimary }]} numberOfLines={2}>{tx.hash}</Text>
            <View style={dt.hashActions}>
              <TouchableOpacity style={[dt.hashBtn, { backgroundColor: theme.bgApp, borderColor: theme.border }]} onPress={copyHash} activeOpacity={0.7}>
                <Ionicons name="copy-outline" size={14} color={theme.textSecondary} />
                <Text style={[dt.hashBtnT, { color: theme.textSecondary }]}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[dt.hashBtn, { backgroundColor: activeChain.color + '12', borderColor: activeChain.color + '40' }]} onPress={openExplorer} activeOpacity={0.7}>
                <Ionicons name="open-outline" size={14} color={activeChain.color} />
                <Text style={[dt.hashBtnT, { color: activeChain.color }]}>Explorer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity style={[dt.closeBtn, { backgroundColor: theme.bgApp, borderColor: theme.border }]} onPress={onClose} activeOpacity={0.8}>
          <Text style={[dt.closeBtnT, { color: theme.textSecondary }]}>Close</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  )
}

const dt = StyleSheet.create({
  overlay:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:      { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 36, shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 24 },
  handle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  topRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconWrap:   { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeLabel:  { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  amtLabel:   { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  statusPill: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20 },
  statusT:    { fontSize: 12, fontWeight: '700' },
  detailCard: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(148,163,184,0.15)' },
  rowLabel:   { color: '#94A3B8', fontSize: 13, fontWeight: '500', flexShrink: 0, marginRight: 10 },
  rowValue:   { color: '#1E1B4B', fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  mono:       { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 },
  hashCard:   { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 16 },
  hashLabel:  { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  hashValue:  { fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 18, marginBottom: 12 },
  hashActions:{ flexDirection: 'row', gap: 10 },
  hashBtn:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1 },
  hashBtnT:   { fontSize: 13, fontWeight: '600' },
  closeBtn:   { borderRadius: 16, paddingVertical: 15, alignItems: 'center', borderWidth: 1, marginTop: 4 },
  closeBtnT:  { fontSize: 15, fontWeight: '600' },
})
