import { Ionicons } from '@expo/vector-icons'
import { useState, useEffect, useCallback } from "react"
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Switch, Alert, FlatList, RefreshControl,
} from "react-native"
import { router } from "expo-router"
import {
  loadNotifPrefs, saveNotifPrefs, loadNotifHistory, markAllRead,
  markOneRead, clearAllNotifications, getUnreadCount,
  seedDemoNotifications, checkPriceAlerts,
  NotifPrefs, NotifRecord,
} from "../utils/notifications"

// --- Helpers ---
function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60)        return `${diff}s ago`
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return new Date(ts * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

const TYPE_META: Record<NotifRecord["type"], { icon: string; color: string; bg: string; label: string }> = {
  price:    { icon: "$", color: "#F59E0B", bg: "#FEF3C7", label: "Price"    },
  tx:       { icon: "T", color: "#6366F1", bg: "#EEF2FF", label: "Transaction" },
  security: { icon: "!", color: "#EF4444", bg: "#FEF2F2", label: "Security" },
  news:     { icon: "N", color: "#10B981", bg: "#D1FAE5", label: "News"     },
}

type Tab = "notifications" | "settings"
type FilterKey = "all" | "price" | "tx" | "security" | "news"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",      label: "All"      },
  { key: "price",    label: "Price"    },
  { key: "tx",       label: "Txns"     },
  { key: "security", label: "Security" },
  { key: "news",     label: "News"     },
]

// --- Notif Item ---
function NotifItem({ notif, onPress }: { notif: NotifRecord; onPress: () => void }) {
  const meta = TYPE_META[notif.type]
  return (
    <TouchableOpacity
      style={[n.row, !notif.read && n.rowUnread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[n.iconWrap, { backgroundColor: meta.bg }]}>
        <Text style={[n.icon, { color: meta.color }]}>{meta.icon}</Text>
      </View>
      <View style={n.mid}>
        <View style={n.topRow}>
          <Text style={[n.title, !notif.read && n.titleUnread]}>{notif.title}</Text>
          {!notif.read && <View style={n.unreadDot} />}
        </View>
        <Text style={n.body} numberOfLines={2}>{notif.body}</Text>
        <View style={n.bottomRow}>
          <View style={[n.typeBadge, { backgroundColor: meta.bg }]}>
            <Text style={[n.typeBadgeT, { color: meta.color }]}>{meta.label}</Text>
          </View>
          <Text style={n.time}>{relativeTime(notif.timestamp)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

// --- Toggle Row ---
function ToggleRow({
  icon, iconBg, iconColor, title, subtitle, value, onToggle, disabled = false,
}: {
  icon: string; iconBg: string; iconColor: string
  title: string; subtitle: string
  value: boolean; onToggle: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <View style={[s.row, disabled && { opacity: 0.5 }]}>
      <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
        <Text style={[s.iconT, { color: iconColor }]}>{icon}</Text>
      </View>
      <View style={s.rowMid}>
        <Text style={s.rowLabel}>{title}</Text>
        <Text style={s.rowSub}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: "#E2E8F0", true: "#6366F1" }}
        thumbColor="#fff"
      />
    </View>
  )
}

// --- Main Screen ---
export default function Notifications() {
  const [tab,       setTab]       = useState<Tab>("notifications")
  const [prefs,     setPrefs]     = useState<NotifPrefs>(loadNotifPrefs())
  const [history,   setHistory]   = useState<NotifRecord[]>([])
  const [filter,    setFilter]    = useState<FilterKey>("all")
  const [unread,    setUnread]    = useState(0)
  const [refreshing,setRefreshing]= useState(false)

  const loadData = useCallback(() => {
    seedDemoNotifications()
    const h = loadNotifHistory()
    setHistory(h)
    setUnread(getUnreadCount())
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function updatePref<K extends keyof NotifPrefs>(key: K, value: NotifPrefs[K]) {
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    saveNotifPrefs(updated)
  }

  function handleMarkAllRead() {
    markAllRead()
    loadData()
  }

  function handleClearAll() {
    Alert.alert(
      "Clear All",
      "This will permanently delete all notifications.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear All", style: "destructive", onPress: () => {
          clearAllNotifications()
          loadData()
        }},
      ]
    )
  }

  function handleNotifPress(notif: NotifRecord) {
    markOneRead(notif.id)
    loadData()
  }

  function handleRefresh() {
    setRefreshing(true)
    checkPriceAlerts(prefs).finally(() => {
      loadData()
      setRefreshing(false)
    })
  }

  const filtered = history.filter(n =>
    filter === "all" ? true : n.type === filter
  )

  // Group by date
  type Section = { type: "header"; date: string } | { type: "notif"; notif: NotifRecord }
  const sectioned: Section[] = []
  let lastDate = ""
  for (const notif of filtered) {
    const diff  = Math.floor(Date.now() / 1000 - notif.timestamp) / 86400
    const label = diff < 1 ? "Today"
      : diff < 2 ? "Yesterday"
      : new Date(notif.timestamp * 1000).toLocaleDateString("en-US", {
          weekday: "long", month: "short", day: "numeric"
        })
    if (label !== lastDate) {
      sectioned.push({ type: "header", date: label })
      lastDate = label
    }
    sectioned.push({ type: "notif", notif })
  }

  return (
    <View style={s.c}>

      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Text style={s.backT}>{"<"}</Text>
        </TouchableOpacity>
        <View style={s.hdrCenter}>
          <Text style={s.hdrTitle}>Notifications</Text>
          {unread > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeT}>{unread}</Text>
            </View>
          )}
        </View>
        <View style={{ width: 38 }} />
      </View>

      {/* Tab switcher */}
      <View style={s.tabRow}>
        {(["notifications", "settings"] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
          >
            <Ionicons name={t === "notifications" ? "notifications-outline" : "settings-outline"} size={16} color={tab === t ? "#6366F1" : "#94A3B8"} /><Text style={[s.tabT, tab === t && s.tabTActive]}>{t === "notifications" ? " Inbox" : " Settings"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* --- NOTIFICATIONS TAB --- */}
      {tab === "notifications" && (
        <View style={{ flex: 1 }}>

          {/* Actions row */}
          <View style={s.actionsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
              {FILTERS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  style={[s.filterTab, filter === f.key && s.filterTabActive]}
                  onPress={() => setFilter(f.key)}
                >
                  <Text style={[s.filterTabT, filter === f.key && s.filterTabTActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={s.actionBtns}>
              {unread > 0 && (
                <TouchableOpacity style={s.actionBtn} onPress={handleMarkAllRead}>
                  <Text style={s.actionBtnT}>Mark read</Text>
                </TouchableOpacity>
              )}
              {history.length > 0 && (
                <TouchableOpacity style={[s.actionBtn, s.actionBtnDanger]} onPress={handleClearAll}>
                  <Text style={[s.actionBtnT, { color: "#EF4444" }]}>Clear</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* List */}
          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Text style={s.emptyIcon}>[B]</Text>
              <Text style={s.emptyTitle}>No notifications</Text>
              <Text style={s.emptySub}>
                {filter === "all"
                  ? "You are all caught up!"
                  : `No ${filter} notifications yet`}
              </Text>
            </View>
          ) : (
            <FlatList
              data={sectioned}
              keyExtractor={(item, i) =>
                item.type === "header" ? `hdr-${item.date}` : `notif-${item.notif.id}-${i}`
              }
              contentContainerStyle={s.list}
              showsVerticalScrollIndicator={true}
              persistentScrollbar={true}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor="#6366F1"
                />
              }
              renderItem={({ item }) =>
                item.type === "header" ? (
                  <Text style={s.sectionHdr}>{item.date}</Text>
                ) : (
                  <NotifItem
                    notif={item.notif}
                    onPress={() => handleNotifPress(item.notif)}
                  />
                )
              }
            />
          )}
        </View>
      )}

      {/* --- SETTINGS TAB --- */}
      {tab === "settings" && (
        <ScrollView
          showsVerticalScrollIndicator={true}
          persistentScrollbar={true}
          contentContainerStyle={{ paddingBottom: 48 }}
        >
          {/* Master toggle */}
          <View style={s.settingsSection}>
            <Text style={s.sectionTitle}>MASTER CONTROL</Text>
            <View style={s.card}>
              <ToggleRow
                icon="B"
                iconBg="#EEF2FF"
                iconColor="#6366F1"
                title="Enable Notifications"
                subtitle="Turn all notifications on or off"
                value={prefs.pushEnabled}
                onToggle={v => updatePref("pushEnabled", v)}
              />
            </View>
          </View>

          {/* Alert types */}
          <View style={s.settingsSection}>
            <Text style={s.sectionTitle}>ALERT TYPES</Text>
            <View style={s.card}>
              <ToggleRow
                icon="T"
                iconBg="#EEF2FF"
                iconColor="#6366F1"
                title="Transaction Alerts"
                subtitle="Get notified when you send or receive crypto"
                value={prefs.txAlerts}
                onToggle={v => updatePref("txAlerts", v)}
                disabled={!prefs.pushEnabled}
              />
              <View style={s.divider} />
              <ToggleRow
                icon="$"
                iconBg="#FEF3C7"
                iconColor="#F59E0B"
                title="Price Alerts"
                subtitle="Notify on significant price movements (5%+)"
                value={prefs.priceAlerts}
                onToggle={v => updatePref("priceAlerts", v)}
                disabled={!prefs.pushEnabled}
              />
              <View style={s.divider} />
              <ToggleRow
                icon="!"
                iconBg="#FEF2F2"
                iconColor="#EF4444"
                title="Security Alerts"
                subtitle="New sign-ins and suspicious activity"
                value={prefs.securityAlerts}
                onToggle={v => updatePref("securityAlerts", v)}
                disabled={!prefs.pushEnabled}
              />
              <View style={s.divider} />
              <ToggleRow
                icon="N"
                iconBg="#D1FAE5"
                iconColor="#10B981"
                title="News & Updates"
                subtitle="Kryptonow product updates and announcements"
                value={prefs.newsAlerts}
                onToggle={v => updatePref("newsAlerts", v)}
                disabled={!prefs.pushEnabled}
              />
            </View>
          </View>

          {/* Info card */}
          <View style={s.settingsSection}>
            <Text style={s.sectionTitle}>ABOUT</Text>
            <View style={s.infoCard}>
              {[
                { icon: "B", text: "Transaction alerts fire when sends/receives are confirmed on-chain" },
                { icon: "$", text: "Price alerts check every 30 mins for 5%+ movements" },
                { icon: "!", text: "Security alerts are always enabled for your protection" },
              ].map((item, i) => (
                <View key={i} style={s.infoRow}>
                  <Text style={s.infoIcon}>{item.icon}</Text>
                  <Text style={s.infoText}>{item.text}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Test button */}
          <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
            <TouchableOpacity
              style={s.testBtn}
              onPress={() => {
                const { addNotification } = require("../utils/notifications")
                addNotification({
                  title: "Test Notification",
                  body:  "This is a test notification from Kryptonow!",
                  type:  "news",
                })
                loadData()
                setTab("notifications")
                Alert.alert("Sent!", "Check your notifications inbox.")
              }}
            >
              <Text style={s.testBtnT}>[>] Send Test Notification</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      )}
    </View>
  )
}

// --- Styles ---
const s = StyleSheet.create({
  c:               { flex: 1, backgroundColor: "#F8FAFF" },
  hdr:             { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  back:            { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  backT:           { color: "#6366F1", fontSize: 18, fontWeight: "700" },
  hdrCenter:       { flexDirection: "row", alignItems: "center", gap: 8 },
  hdrTitle:        { color: "#1E1B4B", fontSize: 17, fontWeight: "700" },
  badge:           { backgroundColor: "#EF4444", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  badgeT:          { color: "#fff", fontSize: 11, fontWeight: "700" },
  tabRow:          { flexDirection: "row", marginHorizontal: 16, marginBottom: 12, backgroundColor: "#F1F5F9", borderRadius: 14, padding: 4 },
  tab:             { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 11 },
  tabActive:       { backgroundColor: "#fff", shadowColor: "#64748B", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabT:            { color: "#94A3B8", fontSize: 13, fontWeight: "600" },
  tabTActive:      { color: "#1E1B4B" },
  actionsRow:      { flexDirection: "row", alignItems: "center", paddingRight: 16, marginBottom: 8 },
  filterRow:       { paddingHorizontal: 16, gap: 8, paddingVertical: 4 },
  filterTab:       { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E2E8F0" },
  filterTabActive: { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  filterTabT:      { color: "#64748B", fontSize: 12, fontWeight: "600" },
  filterTabTActive:{ color: "#fff" },
  actionBtns:      { flexDirection: "row", gap: 8, marginLeft: 8 },
  actionBtn:       { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#EEF2FF" },
  actionBtnDanger: { backgroundColor: "#FEF2F2" },
  actionBtnT:      { color: "#6366F1", fontSize: 12, fontWeight: "600" },
  list:            { paddingHorizontal: 16, paddingBottom: 40 },
  sectionHdr:      { color: "#94A3B8", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginTop: 16, marginBottom: 8, marginLeft: 4 },
  empty:           { flex: 1, alignItems: "center", justifyContent: "center", padding: 48 },
  emptyIcon:       { fontSize: 40, color: "#CBD5E1", marginBottom: 12 },
  emptyTitle:      { color: "#1E1B4B", fontSize: 18, fontWeight: "700", marginBottom: 6 },
  emptySub:        { color: "#94A3B8", fontSize: 14, textAlign: "center" },
  settingsSection: { paddingHorizontal: 16, marginBottom: 20, marginTop: 8 },
  sectionTitle:    { color: "#94A3B8", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 8, paddingLeft: 4 },
  card:            { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#F1F5F9", overflow: "hidden" },
  row:             { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 14 },
  iconWrap:        { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  iconT:           { fontSize: 15, fontWeight: "800" },
  rowMid:          { flex: 1 },
  rowLabel:        { color: "#1E1B4B", fontSize: 15, fontWeight: "600" },
  rowSub:          { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  divider:         { height: 1, backgroundColor: "#F8FAFF", marginHorizontal: 16 },
  infoCard:        { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#F1F5F9", padding: 16, gap: 12 },
  infoRow:         { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  infoIcon:        { color: "#6366F1", fontSize: 14, fontWeight: "700", width: 20 },
  infoText:        { flex: 1, color: "#64748B", fontSize: 13, lineHeight: 20 },
  testBtn:         { backgroundColor: "#EEF2FF", borderRadius: 16, paddingVertical: 16, alignItems: "center", borderWidth: 1.5, borderColor: "#C7D2FE" },
  testBtnT:        { color: "#6366F1", fontSize: 15, fontWeight: "700" },
})

const n = StyleSheet.create({
  row:         { flexDirection: "row", backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#F1F5F9", gap: 12, shadowColor: "#64748B", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  rowUnread:   { borderColor: "#C7D2FE", backgroundColor: "#FAFBFF" },
  iconWrap:    { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  icon:        { fontSize: 16, fontWeight: "800" },
  mid:         { flex: 1 },
  topRow:      { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  title:       { color: "#1E1B4B", fontSize: 14, fontWeight: "600", flex: 1 },
  titleUnread: { fontWeight: "800" },
  unreadDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: "#6366F1", marginLeft: 8 },
  body:        { color: "#64748B", fontSize: 13, lineHeight: 18, marginBottom: 8 },
  bottomRow:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeBadge:   { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8 },
  typeBadgeT:  { fontSize: 11, fontWeight: "600" },
  time:        { color: "#CBD5E1", fontSize: 11 },
})