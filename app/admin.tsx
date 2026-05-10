import { useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Platform, Alert, TextInput, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useWalletStore } from '../store/walletStore'

const API          = process.env.EXPO_PUBLIC_API_URL ?? ''
const ADMIN_WALLET = (process.env.EXPO_PUBLIC_ADMIN_WALLET ?? '').toLowerCase()

type LogEntry = {
  id:        string
  level:     'info' | 'warn' | 'error'
  event:     string
  userId?:   string
  wallet?:   string
  message:   string
  meta?:     string
  createdAt: string
}

type KYCRecord = {
  id:        string
  wallet:    string
  fullName:  string
  country:   string
  docType:   string
  status:    'pending' | 'verified' | 'rejected'
  createdAt: string
}

type UserSummary = {
  id:          string
  wallet:      string
  name:        string
  country:     string
  kycStatus:   string
  referrals:   number
  joinedAt:    string
}

type Stats = {
  totalUsers:      number
  kycPending:      number
  kycVerified:     number
  logsToday:       number
  errorCount:      number
  referralsTotal:  number
}

type Tab = 'overview' | 'logs' | 'kyc' | 'users'

const LEVEL_COLOR = { info: '#4F46E5', warn: '#D97706', error: '#DC2626' }
const LEVEL_BG    = { info: '#EEF2FF', warn: '#FFF7ED', error: '#FEF2F2' }

export default function AdminScreen() {
  const address = useWalletStore(s => s.address)

  // Gate — must be owner wallet
  if (!address || address.toLowerCase() !== ADMIN_WALLET) {
    return (
      <View style={[s.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Ionicons name="lock-closed" size={48} color="#DC2626" />
        <Text style={s.gateTitle}>Access Denied</Text>
        <Text style={s.gateSub}>This section is restricted to the platform owner.</Text>
        <TouchableOpacity style={s.gateBtn} onPress={() => router.back()}>
          <Text style={s.gateBtnT}>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const [tab,         setTab]         = useState<Tab>('overview')
  const [stats,       setStats]       = useState<Stats | null>(null)
  const [logs,        setLogs]        = useState<LogEntry[]>([])
  const [kyc,         setKyc]         = useState<KYCRecord[]>([])
  const [users,       setUsers]       = useState<UserSummary[]>([])
  const [loading,     setLoading]     = useState(false)
  const [refreshing,  setRefreshing]  = useState(false)
  const [logFilter,   setLogFilter]   = useState<'all' | 'info' | 'warn' | 'error'>('all')
  const [userSearch,  setUserSearch]  = useState('')
  const [kycFilter,   setKycFilter]   = useState<'all' | 'pending' | 'verified' | 'rejected'>('pending')

  const authHeaders = { 'X-Admin-Wallet': address }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, lRes, kRes, uRes] = await Promise.all([
        fetch(`${API}/admin/stats`,    { headers: authHeaders }),
        fetch(`${API}/admin/logs`,     { headers: authHeaders }),
        fetch(`${API}/admin/kyc/queue`, { headers: authHeaders }),
        fetch(`${API}/admin/users`,    { headers: authHeaders }),
      ])
      if (sRes.ok) setStats(await sRes.json())
      if (lRes.ok) { const d = await lRes.json(); setLogs(d.logs ?? []) }
      if (kRes.ok) { const d = await kRes.json(); setKyc(d.records ?? []) }
      if (uRes.ok) { const d = await uRes.json(); setUsers(d.users ?? []) }
    } catch {}
    setLoading(false)
  }, [address])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function refreshData() {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }

  async function reviewKYC(id: string, action: 'verified' | 'rejected') {
    const label = action === 'verified' ? 'Approve' : 'Reject'
    Alert.alert(`${label} KYC?`, 'This action will update the user\'s KYC status immediately.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: label, style: action === 'rejected' ? 'destructive' : 'default',
        onPress: async () => {
          try {
            const res = await fetch(`${API}/admin/kyc/${id}/review`, {
              method:  'POST',
              headers: { ...authHeaders, 'Content-Type': 'application/json' },
              body:    JSON.stringify({ action }),
            })
            if (res.ok) {
              setKyc(prev => prev.map(r => r.id === id ? { ...r, status: action } : r))
            }
          } catch {}
        },
      },
    ])
  }

  const filteredLogs  = logFilter === 'all'  ? logs  : logs.filter(l => l.level === logFilter)
  const filteredKyc   = kycFilter === 'all'  ? kyc   : kyc.filter(k => k.status === kycFilter)
  const filteredUsers = userSearch ? users.filter(u =>
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.wallet.toLowerCase().includes(userSearch.toLowerCase())
  ) : users

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={s.headerT}>Admin Panel</Text>
        <TouchableOpacity onPress={refreshData} style={s.back}>
          <Ionicons name="refresh-outline" size={20} color="#4F46E5" />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {(['overview', 'logs', 'kyc', 'users'] as Tab[]).map(t => (
          <TouchableOpacity key={t} style={[s.tabItem, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabT, tab === t && s.tabActiveT]}>
              {t === 'overview' ? 'Overview' : t === 'logs' ? 'Logs' : t === 'kyc' ? 'KYC' : 'Users'}
            </Text>
            {t === 'kyc' && kyc.filter(k => k.status === 'pending').length > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeT}>{kyc.filter(k => k.status === 'pending').length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshData} tintColor="#4F46E5" />}
      >
        {loading && !stats ? (
          <ActivityIndicator color="#4F46E5" style={{ marginTop: 60 }} />
        ) : (

          <>
            {/* ═══════════════════ OVERVIEW ═══════════════════ */}
            {tab === 'overview' && stats && (
              <View style={s.section}>
                <View style={s.statGrid}>
                  <StatCard label="Total Users"     value={stats.totalUsers}     color="#4F46E5" icon="people-outline" />
                  <StatCard label="KYC Pending"     value={stats.kycPending}     color="#D97706" icon="time-outline" />
                  <StatCard label="KYC Verified"    value={stats.kycVerified}    color="#059669" icon="shield-checkmark-outline" />
                  <StatCard label="Logs Today"      value={stats.logsToday}      color="#6366F1" icon="document-text-outline" />
                  <StatCard label="Errors (24h)"    value={stats.errorCount}     color="#DC2626" icon="warning-outline" />
                  <StatCard label="Total Referrals" value={stats.referralsTotal} color="#0891B2" icon="gift-outline" />
                </View>

                <Text style={s.sectionTitle}>Recent Errors</Text>
                {logs.filter(l => l.level === 'error').slice(0, 5).map(l => (
                  <LogRow key={l.id} log={l} />
                ))}
                {logs.filter(l => l.level === 'error').length === 0 && (
                  <Text style={s.emptyText}>No errors in the last 15 days</Text>
                )}
              </View>
            )}

            {/* ═══════════════════ LOGS ═══════════════════ */}
            {tab === 'logs' && (
              <View style={s.section}>
                <Text style={s.retentionNote}>Logs retained for 15 days · {logs.length} total entries</Text>

                <View style={s.filterRow}>
                  {(['all', 'info', 'warn', 'error'] as const).map(f => (
                    <TouchableOpacity key={f} style={[s.chip, logFilter === f && s.chipActive]} onPress={() => setLogFilter(f)}>
                      <Text style={[s.chipT, logFilter === f && s.chipActiveT]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {filteredLogs.map(l => <LogRow key={l.id} log={l} expanded />)}
                {filteredLogs.length === 0 && <Text style={s.emptyText}>No logs found</Text>}
              </View>
            )}

            {/* ═══════════════════ KYC ═══════════════════ */}
            {tab === 'kyc' && (
              <View style={s.section}>
                <Text style={s.retentionNote}>KYC records retained for 10 years as required by law</Text>

                <View style={s.filterRow}>
                  {(['all', 'pending', 'verified', 'rejected'] as const).map(f => (
                    <TouchableOpacity key={f} style={[s.chip, kycFilter === f && s.chipActive]} onPress={() => setKycFilter(f)}>
                      <Text style={[s.chipT, kycFilter === f && s.chipActiveT]}>{f}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {filteredKyc.map(k => (
                  <View key={k.id} style={s.kycCard}>
                    <View style={s.kycTop}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.kycName}>{k.fullName}</Text>
                        <Text style={s.kycWallet}>{k.wallet.slice(0, 10)}…{k.wallet.slice(-6)}</Text>
                        <Text style={s.kycMeta}>{k.country} · {k.docType}</Text>
                        <Text style={s.kycDate}>{new Date(k.createdAt).toLocaleDateString('en-IN')}</Text>
                      </View>
                      <View style={[s.kycBadge, {
                        backgroundColor:
                          k.status === 'verified' ? '#ECFDF5' :
                          k.status === 'rejected' ? '#FEF2F2' : '#FFF7ED',
                      }]}>
                        <Text style={[s.kycBadgeT, {
                          color:
                            k.status === 'verified' ? '#059669' :
                            k.status === 'rejected' ? '#DC2626' : '#D97706',
                        }]}>{k.status}</Text>
                      </View>
                    </View>

                    {k.status === 'pending' && (
                      <View style={s.kycActions}>
                        <TouchableOpacity style={[s.kycBtn, { backgroundColor: '#059669' }]} onPress={() => reviewKYC(k.id, 'verified')}>
                          <Ionicons name="checkmark-outline" size={16} color="#fff" />
                          <Text style={s.kycBtnT}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.kycBtn, { backgroundColor: '#DC2626' }]} onPress={() => reviewKYC(k.id, 'rejected')}>
                          <Ionicons name="close-outline" size={16} color="#fff" />
                          <Text style={s.kycBtnT}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))}
                {filteredKyc.length === 0 && <Text style={s.emptyText}>No KYC records found</Text>}
              </View>
            )}

            {/* ═══════════════════ USERS ═══════════════════ */}
            {tab === 'users' && (
              <View style={s.section}>
                <TextInput
                  style={s.search}
                  value={userSearch}
                  onChangeText={setUserSearch}
                  placeholder="Search name or wallet..."
                  placeholderTextColor="#CBD5E1"
                />
                <Text style={s.retentionNote}>{filteredUsers.length} users</Text>

                {filteredUsers.map(u => (
                  <View key={u.id} style={s.userRow}>
                    <View style={s.userAvatar}>
                      <Text style={s.userAvatarT}>{(u.name || '?').slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.userName}>{u.name || 'Anonymous'}</Text>
                      <Text style={s.userWallet}>{u.wallet.slice(0, 10)}…{u.wallet.slice(-6)}</Text>
                      <Text style={s.userMeta}>{u.country} · {u.referrals} referrals · joined {new Date(u.joinedAt).toLocaleDateString('en-IN')}</Text>
                    </View>
                    <View style={[s.kycBadge, {
                      backgroundColor:
                        u.kycStatus === 'verified' ? '#ECFDF5' :
                        u.kycStatus === 'rejected' ? '#FEF2F2' :
                        u.kycStatus === 'pending'  ? '#FFF7ED' : '#F3F4F6',
                    }]}>
                      <Text style={[s.kycBadgeT, {
                        color:
                          u.kycStatus === 'verified' ? '#059669' :
                          u.kycStatus === 'rejected' ? '#DC2626' :
                          u.kycStatus === 'pending'  ? '#D97706' : '#6B7280',
                      }]}>{u.kycStatus}</Text>
                    </View>
                  </View>
                ))}
                {filteredUsers.length === 0 && <Text style={s.emptyText}>No users found</Text>}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

function StatCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: string }) {
  return (
    <View style={[s.statCard, { borderLeftColor: color }]}>
      <Ionicons name={icon as any} size={20} color={color} />
      <Text style={[s.statValue, { color }]}>{value.toLocaleString()}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

function LogRow({ log, expanded }: { log: LogEntry; expanded?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <TouchableOpacity
      style={[s.logRow, { borderLeftColor: LEVEL_COLOR[log.level] }]}
      onPress={() => expanded && setOpen(o => !o)}
      activeOpacity={expanded ? 0.7 : 1}
    >
      <View style={[s.logLevel, { backgroundColor: LEVEL_BG[log.level] }]}>
        <Text style={[s.logLevelT, { color: LEVEL_COLOR[log.level] }]}>{log.level.toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.logEvent}>{log.event}</Text>
        <Text style={s.logMsg} numberOfLines={open ? undefined : 1}>{log.message}</Text>
        {open && log.wallet && <Text style={s.logMeta}>Wallet: {log.wallet}</Text>}
        {open && log.meta   && <Text style={s.logMeta}>Meta: {log.meta}</Text>}
        <Text style={s.logTime}>{new Date(log.createdAt).toLocaleString('en-IN')}</Text>
      </View>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F8FAFF' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  back:         { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  headerT:      { fontSize: 17, fontWeight: '800', color: '#1E1B4B' },

  gateTitle:    { fontSize: 20, fontWeight: '800', color: '#DC2626', marginTop: 16 },
  gateSub:      { fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center', paddingHorizontal: 40 },
  gateBtn:      { marginTop: 24, backgroundColor: '#4F46E5', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  gateBtnT:     { color: '#fff', fontWeight: '700', fontSize: 15 },

  tabBar:       { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tabItem:      { flex: 1, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: '#4F46E5' },
  tabT:         { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabActiveT:   { color: '#4F46E5', fontWeight: '800' },
  badge:        { backgroundColor: '#DC2626', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
  badgeT:       { fontSize: 10, color: '#fff', fontWeight: '700' },

  section:      { margin: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#1E1B4B', marginTop: 20, marginBottom: 12 },
  retentionNote:{ fontSize: 11, color: '#94A3B8', marginBottom: 12, fontStyle: 'italic' },
  emptyText:    { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 24 },

  statGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard:     { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderLeftWidth: 3, width: '47%', gap: 4, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statValue:    { fontSize: 24, fontWeight: '800' },
  statLabel:    { fontSize: 11, color: '#6B7280', fontWeight: '600' },

  filterRow:    { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  chip:         { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  chipActive:   { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  chipT:        { fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'capitalize' },
  chipActiveT:  { color: '#fff' },

  logRow:       { flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderLeftWidth: 3 },
  logLevel:     { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  logLevelT:    { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  logEvent:     { fontSize: 13, fontWeight: '700', color: '#1E1B4B', marginBottom: 2 },
  logMsg:       { fontSize: 12, color: '#64748B', lineHeight: 17 },
  logMeta:      { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  logTime:      { fontSize: 10, color: '#CBD5E1', marginTop: 4 },

  kycCard:      { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9' },
  kycTop:       { flexDirection: 'row', gap: 12 },
  kycName:      { fontSize: 14, fontWeight: '700', color: '#1E1B4B' },
  kycWallet:    { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  kycMeta:      { fontSize: 12, color: '#64748B', marginTop: 2 },
  kycDate:      { fontSize: 11, color: '#CBD5E1', marginTop: 2 },
  kycBadge:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  kycBadgeT:    { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  kycActions:   { flexDirection: 'row', gap: 10, marginTop: 12 },
  kycBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, paddingVertical: 10 },
  kycBtnT:      { fontSize: 13, fontWeight: '700', color: '#fff' },

  search:       { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1E1B4B', marginBottom: 12 },
  userRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' },
  userAvatar:   { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userAvatarT:  { fontSize: 15, fontWeight: '800', color: '#4F46E5' },
  userName:     { fontSize: 14, fontWeight: '700', color: '#1E1B4B' },
  userWallet:   { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  userMeta:     { fontSize: 11, color: '#64748B', marginTop: 2 },
})
