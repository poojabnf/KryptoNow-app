/**
 * app/notifications.tsx
 * Notification settings + history screen
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Switch, Alert, ActivityIndicator, TextInput,
} from 'react-native'
import { router } from 'expo-router'
import {
  registerForPushNotifications, loadNotifPrefs, saveNotifPrefs,
  loadNotifHistory, markAllRead, NotifPrefs, NotifRecord, DEFAULT_PREFS,
} from '../utils/notifications'

// ─── Toggle row ───────────────────────────────────────────────────────────────
function ToggleRow({
  icon, title, subtitle, value, onToggle, disabled = false,
}: {
  icon: string; title: string; subtitle: string
  value: boolean; onToggle: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <View style={[t.row, disabled && { opacity: 0.5 }]}>
      <View style={t.iconWrap}>
        <Text style={t.icon}>{icon}</Text>
      </View>
      <View style={t.mid}>
        <Text style={t.title}>{title}</Text>
        <Text style={t.sub}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: '#E2E8F0', true: '#6366F1' }}
        thumbColor={value ? '#fff' : '#f4f3f4'}
      />
    </View>
  )
}

// ─── Notification history item ────────────────────────────────────────────────
function NotifItem({ notif }: { notif: NotifRecord }) {
  const icons: Record<NotifRecord['type'], string> = {
    tx_in:         '💸',
    tx_out:        '↑',
    large_transfer:'🚨',
    price_alert:   '📊',
    security:      '🔐',
  }
  const colors: Record<NotifRecord['type'], string> = {
    tx_in:         '#D1FAE5',
    tx_out:        '#EEF2FF',
    large_transfer:'#FEF2F2',
    price_alert:   '#FFFBEB',
    security:      '#FEF2F2',
  }

  const relTime = (ts: number) => {
    const d = Date.now() - ts
    if (d < 60000)   return 'Just now'
    if (d < 3600000) return `${Math.floor(d/60000)}m ago`
    if (d < 86400000)return `${Math.floor(d/3600000)}h ago`
    return new Date(ts).toLocaleDateString()
  }

  return (
    <View style={[n.item, !notif.read && n.unread]}>
      <View style={[n.iconWrap, { backgroundColor: colors[notif.type] }]}>
        <Text style={n.icon}>{icons[notif.type]}</Text>
      </View>
      <View style={n.mid}>
        <Text style={n.title}>{notif.title}</Text>
        <Text style={n.body}>{notif.body}</Text>
        <Text style={n.time}>{relTime(notif.timestamp)}</Text>
      </View>
      {!notif.read && <View style={n.dot} />}
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const [tab,         setTab]         = useState<'settings' | 'history'>('settings')
  const [prefs,       setPrefs]       = useState<NotifPrefs>(DEFAULT_PREFS)
  const [history,     setHistory]     = useState<NotifRecord[]>([])
  const [pushToken,   setPushToken]   = useState<string | null>(null)
  const [registering, setRegistering] = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const load = useCallback(async () => {
    const [p, h] = await Promise.all([loadNotifPrefs(), loadNotifHistory()])
    setPrefs(p)
    setHistory(h)
    setUnreadCount(h.filter(n => !n.read).length)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRegister() {
    setRegistering(true)
    const token = await registerForPushNotifications()
    setRegistering(false)
    if (token) {
      setPushToken(token)
      Alert.alert('Notifications enabled!', 'You\'ll receive alerts for transactions and price changes.')
    } else {
      Alert.alert(
        'Permission denied',
        'Go to Settings → Kryptonow → Notifications to enable push notifications.',
      )
    }
  }

  async function handleToggle(key: keyof NotifPrefs, value: boolean | number) {
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    setSaving(true)
    await saveNotifPrefs(updated)
    setSaving(false)
  }

  async function handleMarkAllRead() {
    await markAllRead()
    setHistory(h => h.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  return (
    <View style={s.c}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Text style={s.backT}>←</Text>
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Notifications</Text>
        {saving ? <ActivityIndicator size="small" color="#6366F1" /> : <View style={{ width: 24 }} />}
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['settings', 'history'] as const).map(tb => (
          <TouchableOpacity
            key={tb}
            style={[s.tab, tab === tb && s.tabActive]}
            onPress={() => setTab(tb)}
          >
            <Text style={[s.tabT, tab === tb && s.tabTActive]}>
              {tb === 'settings' ? '⚙  Settings' : `🔔  History${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'settings' ? (
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>

          {/* Push token status */}
          <View style={s.tokenCard}>
            {pushToken ? (
              <>
                <View style={s.tokenActive}>
                  <View style={s.tokenDot} />
                  <Text style={s.tokenActiveT}>Push notifications active</Text>
                </View>
                <Text style={s.tokenSub} numberOfLines={1}>{pushToken.slice(0, 32)}…</Text>
              </>
            ) : (
              <>
                <Text style={s.tokenInactive}>Push notifications not enabled</Text>
                <TouchableOpacity
                  style={[s.enableBtn, registering && { opacity: 0.7 }]}
                  onPress={handleRegister}
                  disabled={registering}
                >
                  {registering
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.enableBtnT}>Enable Push Notifications</Text>
                  }
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Transaction alerts */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Transaction Alerts</Text>
            <View style={s.card}>
              <ToggleRow
                icon="💸" title="Transaction Alerts"
                subtitle="Get notified for every incoming and outgoing transaction"
                value={prefs.txAlerts}
                onToggle={v => handleToggle('txAlerts', v)}
              />
              <View style={s.divider} />
              <ToggleRow
                icon="🚨" title="Large Transfer Warnings"
                subtitle={`Alert when transfer value exceeds $${prefs.largeThreshold}`}
                value={prefs.largeTransfer}
                onToggle={v => handleToggle('largeTransfer', v)}
              />
              {prefs.largeTransfer && (
                <View style={s.thresholdRow}>
                  <Text style={s.thresholdLabel}>Alert threshold (USD)</Text>
                  <View style={s.thresholdInput}>
                    <Text style={s.thresholdPrefix}>$</Text>
                    <TextInput
                      style={s.thresholdField}
                      value={String(prefs.largeThreshold)}
                      onChangeText={v => {
                        const n = parseInt(v)
                        if (!isNaN(n) && n > 0) handleToggle('largeThreshold', n)
                      }}
                      keyboardType="number-pad"
                      selectTextOnFocus
                    />
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Price alerts */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Price Alerts</Text>
            <View style={s.card}>
              <ToggleRow
                icon="📊" title="ETH Price Alerts"
                subtitle={`Notify when ETH moves more than ${prefs.priceThreshold}% in 24h`}
                value={prefs.priceAlerts}
                onToggle={v => handleToggle('priceAlerts', v)}
              />
              {prefs.priceAlerts && (
                <View style={s.thresholdRow}>
                  <Text style={s.thresholdLabel}>Price change threshold</Text>
                  <View style={s.thresholdInput}>
                    <TextInput
                      style={s.thresholdField}
                      value={String(prefs.priceThreshold)}
                      onChangeText={v => {
                        const n = parseInt(v)
                        if (!isNaN(n) && n > 0) handleToggle('priceThreshold', n)
                      }}
                      keyboardType="number-pad"
                      selectTextOnFocus
                    />
                    <Text style={s.thresholdPrefix}>%</Text>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Security alerts */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Security</Text>
            <View style={s.card}>
              <ToggleRow
                icon="🔐" title="Security Alerts"
                subtitle="Notify for new WalletConnect connections and unusual activity"
                value={prefs.securityAlerts}
                onToggle={v => handleToggle('securityAlerts', v)}
              />
            </View>
          </View>

          {/* Info box */}
          <View style={s.infoBox}>
            <Text style={s.infoTitle}>How notifications work</Text>
            <Text style={s.infoBody}>
              Kryptonow polls your wallet address every 2 minutes for new transactions. Notifications are delivered via Expo Push Service (FCM on Android, APNs on iOS). Your private key is never transmitted — only your public wallet address is used for monitoring.
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>
          {/* History header */}
          <View style={s.histHdr}>
            <Text style={s.histCount}>
              {history.length} notification{history.length !== 1 ? 's' : ''}
              {unreadCount > 0 ? ` · ${unreadCount} unread` : ''}
            </Text>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={handleMarkAllRead}>
                <Text style={s.markRead}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>

          {history.length === 0 ? (
            <View style={s.center}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🔔</Text>
              <Text style={s.emptyTitle}>No notifications yet</Text>
              <Text style={s.emptySub}>
                Transaction alerts and price notifications will appear here.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1, paddingHorizontal: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {history.map(notif => (
                <NotifItem key={notif.id} notif={notif} />
              ))}
              <View style={{ height: 32 }} />
            </ScrollView>
          )}
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  c:              { flex: 1, backgroundColor: '#F8FAFF' },
  hdr:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  back:           { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  backT:          { color: '#6366F1', fontSize: 18 },
  hdrTitle:       { color: '#1E1B4B', fontSize: 17, fontWeight: '700' },
  tabs:           { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  tab:            { flex: 1, paddingVertical: 10, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center' },
  tabActive:      { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  tabT:           { color: '#64748B', fontSize: 13, fontWeight: '600' },
  tabTActive:     { color: '#fff' },
  tokenCard:      { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 16 },
  tokenActive:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tokenDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  tokenActiveT:   { color: '#10B981', fontSize: 14, fontWeight: '600' },
  tokenSub:       { color: '#CBD5E1', fontSize: 11, fontFamily: 'monospace' },
  tokenInactive:  { color: '#94A3B8', fontSize: 14, marginBottom: 12 },
  enableBtn:      { backgroundColor: '#6366F1', paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  enableBtnT:     { color: '#fff', fontSize: 14, fontWeight: '600' },
  section:        { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle:   { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  card:           { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden' },
  divider:        { height: 1, backgroundColor: '#F8FAFF', marginHorizontal: 16 },
  thresholdRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F8FAFF' },
  thresholdLabel: { color: '#64748B', fontSize: 13 },
  thresholdInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 10 },
  thresholdPrefix:{ color: '#94A3B8', fontSize: 14 },
  thresholdField: { color: '#1E1B4B', fontSize: 15, fontWeight: '600', minWidth: 60, paddingVertical: 8, textAlign: 'center' },
  infoBox:        { marginHorizontal: 16, backgroundColor: '#EEF2FF', borderRadius: 14, borderWidth: 1, borderColor: '#C7D2FE', padding: 16 },
  infoTitle:      { color: '#4338CA', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  infoBody:       { color: '#4338CA', fontSize: 12, lineHeight: 20 },
  histHdr:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 },
  histCount:      { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  markRead:       { color: '#6366F1', fontSize: 13, fontWeight: '600' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle:     { color: '#1E1B4B', fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptySub:       { color: '#94A3B8', fontSize: 14, textAlign: 'center', lineHeight: 22 },
})

const t = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  iconWrap:{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  icon:    { fontSize: 20 },
  mid:     { flex: 1 },
  title:   { color: '#1E1B4B', fontSize: 14, fontWeight: '600', marginBottom: 3 },
  sub:     { color: '#94A3B8', fontSize: 12, lineHeight: 18 },
})

const n = StyleSheet.create({
  item:    { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9', gap: 12 },
  unread:  { borderColor: '#C7D2FE', backgroundColor: '#FAFBFF' },
  iconWrap:{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon:    { fontSize: 18 },
  mid:     { flex: 1 },
  title:   { color: '#1E1B4B', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  body:    { color: '#64748B', fontSize: 13, lineHeight: 19, marginBottom: 4 },
  time:    { color: '#CBD5E1', fontSize: 11 },
  dot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366F1', marginTop: 4, flexShrink: 0 },
})

