import { useState, useEffect, useCallback } from "react"
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, Alert, Modal, Switch, ActivityIndicator,
  ScrollView, KeyboardAvoidingView, Platform,
} from "react-native"
import { router } from "expo-router"
import {
  PriceAlert, AlertCondition, AlertFrequency,
  ALERT_TOKENS, loadPriceAlerts, addPriceAlert,
  deletePriceAlert, togglePriceAlert, updatePriceAlert,
  fetchCurrentPrices, checkCustomPriceAlerts, getLastCheckTime,
} from "../utils/priceAlerts"

// --- Helpers ---
function relTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function fmtPrice(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  if (n >= 1)    return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

// --- Add Alert Modal ---
function AddAlertModal({
  visible, onClose, onAdd, currentPrices,
}: {
  visible:       boolean
  onClose:       () => void
  onAdd:         (a: ReturnType<typeof addPriceAlert>) => void
  currentPrices: Record<string, number>
}) {
  const [selToken,    setSelToken]    = useState(ALERT_TOKENS[1]) // ETH default
  const [condition,   setCondition]   = useState<AlertCondition>("above")
  const [threshold,   setThreshold]   = useState("")
  const [frequency,   setFrequency]   = useState<AlertFrequency>("once")
  const [showTokens,  setShowTokens]  = useState(false)

  useEffect(() => {
    if (visible) {
      setSelToken(ALERT_TOKENS[1])
      setCondition("above")
      setThreshold("")
      setFrequency("once")
      setShowTokens(false)
    }
  }, [visible])

  function handleAdd() {
    const price = parseFloat(threshold)
    if (isNaN(price) || price <= 0) {
      Alert.alert("Invalid price", "Please enter a valid price threshold")
      return
    }
    const alert = addPriceAlert({
      coinId:    selToken.coinId,
      symbol:    selToken.symbol,
      name:      selToken.name,
      condition,
      threshold: price,
      frequency,
      enabled:   true,
    })
    onAdd(alert)
    onClose()
  }

  const currentPrice = currentPrices[selToken.coinId] ?? 0
  const token = ALERT_TOKENS.find(t => t.coinId === selToken.coinId) ?? ALERT_TOKENS[1]

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={m.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.title}>New Price Alert</Text>

          {/* Token selector */}
          <Text style={m.fieldLabel}>Token</Text>
          <TouchableOpacity
            style={[m.tokenBtn, { borderColor: token.color + "40" }]}
            onPress={() => setShowTokens(!showTokens)}
          >
            <View style={[m.tokenDot, { backgroundColor: token.color + "20" }]}>
              <Text style={[m.tokenDotT, { color: token.color }]}>{token.symbol.slice(0,2)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={m.tokenName}>{token.name} ({token.symbol})</Text>
              {currentPrice > 0 && (
                <Text style={m.tokenPrice}>Current: {fmtPrice(currentPrice)}</Text>
              )}
            </View>
            <Text style={m.tokenChev}>{showTokens ? "[^]" : "[v]"}</Text>
          </TouchableOpacity>

          {showTokens && (
            <View style={m.tokenList}>
              <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={true}>
                {ALERT_TOKENS.map(t => (
                  <TouchableOpacity
                    key={t.coinId}
                    style={[m.tokenOption, selToken.coinId === t.coinId && { backgroundColor: t.color + "15" }]}
                    onPress={() => { setSelToken(t); setShowTokens(false) }}
                  >
                    <View style={[m.tokenDot, { backgroundColor: t.color + "20" }]}>
                      <Text style={[m.tokenDotT, { color: t.color }]}>{t.symbol.slice(0,2)}</Text>
                    </View>
                    <Text style={m.tokenOptionName}>{t.name}</Text>
                    <Text style={m.tokenOptionPrice}>
                      {currentPrices[t.coinId] ? fmtPrice(currentPrices[t.coinId]) : "--"}
                    </Text>
                    {selToken.coinId === t.coinId && <Text style={[m.check, { color: t.color }]}>[*]</Text>}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Condition */}
          <Text style={m.fieldLabel}>Alert when price is</Text>
          <View style={m.condRow}>
            {(["above", "below"] as AlertCondition[]).map(c => (
              <TouchableOpacity
                key={c}
                style={[m.condBtn, condition === c && m.condBtnActive]}
                onPress={() => setCondition(c)}
              >
                <Text style={[m.condBtnT, condition === c && m.condBtnTActive]}>
                  {c === "above" ? "[^] Above" : "[v] Below"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Threshold */}
          <Text style={m.fieldLabel}>Price Threshold (USD)</Text>
          <View style={m.thresholdWrap}>
            <Text style={m.dollarSign}>$</Text>
            <TextInput
              style={m.thresholdInput}
              value={threshold}
              onChangeText={setThreshold}
              placeholder="0.00"
              placeholderTextColor="#CBD5E1"
              keyboardType="decimal-pad"
            />
            {currentPrice > 0 && threshold === "" && (
              <TouchableOpacity
                style={m.useCurrentBtn}
                onPress={() => setThreshold(currentPrice.toFixed(2))}
              >
                <Text style={m.useCurrentBtnT}>Use current</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Frequency */}
          <Text style={m.fieldLabel}>Alert frequency</Text>
          <View style={m.condRow}>
            {(["once", "always"] as AlertFrequency[]).map(f => (
              <TouchableOpacity
                key={f}
                style={[m.condBtn, frequency === f && m.condBtnActive]}
                onPress={() => setFrequency(f)}
              >
                <Text style={[m.condBtnT, frequency === f && m.condBtnTActive]}>
                  {f === "once" ? "Once" : "Every time"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary */}
          {threshold && parseFloat(threshold) > 0 && (
            <View style={m.summary}>
              <Text style={m.summaryT}>
                Alert when {selToken.symbol} goes {condition} {fmtPrice(parseFloat(threshold))}
                {frequency === "always" ? " (repeating)" : " (one time)"}
              </Text>
            </View>
          )}

          {/* Buttons */}
          <View style={m.btnRow}>
            <TouchableOpacity style={m.cancelBtn} onPress={onClose}>
              <Text style={m.cancelBtnT}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[m.saveBtn, (!threshold || parseFloat(threshold) <= 0) && { opacity: 0.4 }]}
              onPress={handleAdd}
              disabled={!threshold || parseFloat(threshold) <= 0}
            >
              <Text style={m.saveBtnT}>Create Alert</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 24 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// --- Alert Row ---
function AlertRow({
  alert, currentPrice, onToggle, onDelete,
}: {
  alert:        PriceAlert
  currentPrice: number
  onToggle:     () => void
  onDelete:     () => void
}) {
  const token    = ALERT_TOKENS.find(t => t.coinId === alert.coinId)
  const color    = token?.color ?? "#6366F1"
  const isMet    = currentPrice > 0 && (
    (alert.condition === "above" && currentPrice >= alert.threshold) ||
    (alert.condition === "below" && currentPrice <= alert.threshold)
  )
  const pctAway  = currentPrice > 0
    ? Math.abs((alert.threshold - currentPrice) / currentPrice * 100)
    : null

  return (
    <View style={[r.row, !alert.enabled && r.rowDisabled]}>
      {/* Token badge */}
      <View style={[r.tokenBadge, { backgroundColor: color + "20" }]}>
        <Text style={[r.tokenBadgeT, { color }]}>{alert.symbol.slice(0,2)}</Text>
      </View>

      {/* Info */}
      <View style={r.mid}>
        <View style={r.topRow}>
          <Text style={r.symbol}>{alert.symbol}</Text>
          <View style={[r.condBadge, { backgroundColor: alert.condition === "above" ? "#ECFDF5" : "#FEF2F2" }]}>
            <Text style={[r.condBadgeT, { color: alert.condition === "above" ? "#10B981" : "#EF4444" }]}>
              {alert.condition === "above" ? "[^]" : "[v]"} {alert.condition} {fmtPrice(alert.threshold)}
            </Text>
          </View>
        </View>

        <View style={r.bottomRow}>
          {currentPrice > 0 && (
            <Text style={r.currentPrice}>Now: {fmtPrice(currentPrice)}</Text>
          )}
          {pctAway !== null && !isMet && (
            <Text style={r.pctAway}>{pctAway.toFixed(1)}% away</Text>
          )}
          {isMet && (
            <View style={r.metBadge}>
              <Text style={r.metBadgeT}>[!] Condition met</Text>
            </View>
          )}
        </View>

        <View style={r.metaRow}>
          <Text style={r.freq}>{alert.frequency === "once" ? "One-time" : "Repeating"}</Text>
          {alert.lastTriggeredAt && (
            <Text style={r.lastTriggered}>Last triggered {relTime(alert.lastTriggeredAt)}</Text>
          )}
          {alert.triggered && (
            <View style={r.triggeredBadge}>
              <Text style={r.triggeredBadgeT}>[OK] Triggered</Text>
            </View>
          )}
        </View>
      </View>

      {/* Controls */}
      <View style={r.controls}>
        <Switch
          value={alert.enabled}
          onValueChange={onToggle}
          trackColor={{ false: "#E2E8F0", true: "#6366F1" }}
          thumbColor="#fff"
        />
        <TouchableOpacity style={r.deleteBtn} onPress={onDelete}>
          <Text style={r.deleteBtnT}>[X]</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// --- Main Screen ---
export default function PriceAlertsScreen() {
  const [alerts,        setAlerts]        = useState<PriceAlert[]>([])
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({})
  const [modalOpen,     setModalOpen]     = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [checking,      setChecking]      = useState(false)
  const [lastCheck,     setLastCheck]     = useState(0)
  const [checkedCount,  setCheckedCount]  = useState(0)

  const loadData = useCallback(async () => {
    setAlerts(loadPriceAlerts())
    setLastCheck(getLastCheckTime())
  }, [])

  const refreshPrices = useCallback(async () => {
    setLoading(true)
    try {
      const prices = await fetchCurrentPrices()
      setCurrentPrices(prices)
    } finally {
      setLoading(false)
    }
  }, [])

  const runCheck = useCallback(async () => {
    setChecking(true)
    try {
      const count = await checkCustomPriceAlerts()
      setCheckedCount(count)
      setAlerts(loadPriceAlerts())
      setLastCheck(getLastCheckTime())
      if (count > 0) {
        Alert.alert("Alerts Triggered!", `${count} price alert${count > 1 ? "s" : ""} triggered!`)
      }
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    refreshPrices()
  }, [])

  function handleAdd(alert: PriceAlert) {
    setAlerts(loadPriceAlerts())
  }

  function handleToggle(id: string) {
    togglePriceAlert(id)
    setAlerts(loadPriceAlerts())
  }

  function handleDelete(id: string) {
    Alert.alert(
      "Delete Alert",
      "Remove this price alert?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => {
          deletePriceAlert(id)
          setAlerts(loadPriceAlerts())
        }},
      ]
    )
  }

  const activeCount    = alerts.filter(a => a.enabled && !a.triggered).length
  const triggeredCount = alerts.filter(a => a.triggered).length

  return (
    <View style={s.c}>
      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Text style={s.backT}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Price Alerts</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setModalOpen(true)}>
          <Text style={s.addBtnT}>[+]</Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={s.statsBar}>
        <View style={s.statItem}>
          <Text style={s.statNum}>{alerts.length}</Text>
          <Text style={s.statLabel}>Total</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={[s.statNum, { color: "#6366F1" }]}>{activeCount}</Text>
          <Text style={s.statLabel}>Active</Text>
        </View>
        <View style={s.statDivider} />
        <View style={s.statItem}>
          <Text style={[s.statNum, { color: "#10B981" }]}>{triggeredCount}</Text>
          <Text style={s.statLabel}>Triggered</Text>
        </View>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          style={[s.checkBtn, checking && { opacity: 0.6 }]}
          onPress={runCheck}
          disabled={checking}
        >
          {checking
            ? <ActivityIndicator size="small" color="#6366F1" />
            : <Text style={s.checkBtnT}>[R] Check now</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Last check info */}
      {lastCheck > 0 && (
        <Text style={s.lastCheckT}>Last checked {relTime(lastCheck)}</Text>
      )}

      {/* Current prices strip */}
      {Object.keys(currentPrices).length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.priceStrip}
          contentContainerStyle={s.priceStripContent}
        >
          {ALERT_TOKENS.slice(0, 6).map(t => (
            <View key={t.coinId} style={s.priceChip}>
              <Text style={[s.priceChipSymbol, { color: t.color }]}>{t.symbol}</Text>
              <Text style={s.priceChipValue}>
                {currentPrices[t.coinId] ? fmtPrice(currentPrices[t.coinId]) : "--"}
              </Text>
              {loading && <ActivityIndicator size="small" color={t.color} style={{ marginLeft: 4 }} />}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Alerts list */}
      {alerts.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>[$]</Text>
          <Text style={s.emptyTitle}>No price alerts yet</Text>
          <Text style={s.emptySub}>
            Set custom price thresholds for any token.{"\n"}
            Get notified when prices move.
          </Text>
          <TouchableOpacity style={s.emptyBtn} onPress={() => setModalOpen(true)}>
            <Text style={s.emptyBtnT}>[+] Create First Alert</Text>
          </TouchableOpacity>

          {/* Example alerts */}
          <View style={s.examplesWrap}>
            <Text style={s.examplesTitle}>Example alerts you can set:</Text>
            {[
              { text: "Alert when ETH goes above $5,000" },
              { text: "Alert when BTC falls below $80,000" },
              { text: "Alert when BNB goes above $800" },
            ].map((ex, i) => (
              <View key={i} style={s.exampleRow}>
                <Text style={s.exampleDot}></Text>
                <Text style={s.exampleT}>{ex.text}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={a => a.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={true}
          persistentScrollbar={true}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <AlertRow
              alert={item}
              currentPrice={currentPrices[item.coinId] ?? 0}
              onToggle={() => handleToggle(item.id)}
              onDelete={() => handleDelete(item.id)}
            />
          )}
          ListFooterComponent={
            <View style={{ height: 48 }}>
              {triggeredCount > 0 && (
                <TouchableOpacity
                  style={s.clearTriggeredBtn}
                  onPress={() => {
                    Alert.alert("Clear triggered alerts?", "This will remove all triggered one-time alerts.", [
                      { text: "Cancel", style: "cancel" },
                      { text: "Clear", style: "destructive", onPress: () => {
                        const updated = loadPriceAlerts().filter(a => !a.triggered)
                        const { savePriceAlerts } = require("../utils/priceAlerts")
                        savePriceAlerts(updated)
                        setAlerts(updated)
                      }},
                    ])
                  }}
                >
                  <Text style={s.clearTriggeredBtnT}>[X] Clear {triggeredCount} triggered alert{triggeredCount > 1 ? "s" : ""}</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      <AddAlertModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onAdd={handleAdd}
        currentPrices={currentPrices}
      />
    </View>
  )
}

const s = StyleSheet.create({
  c:                  { flex: 1, backgroundColor: "#F4F7FF" },
  hdr:                { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EEF2FF" },
  back:               { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F4F7FF", borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  backT:              { color: "#6366F1", fontSize: 18, fontWeight: "700" },
  hdrTitle:           { color: "#1E1B4B", fontSize: 17, fontWeight: "800" },
  addBtn:             { width: 38, height: 38, borderRadius: 12, backgroundColor: "#6366F1", alignItems: "center", justifyContent: "center" },
  addBtnT:            { color: "#fff", fontSize: 16, fontWeight: "800" },
  statsBar:           { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EEF2FF" },
  statItem:           { alignItems: "center", paddingHorizontal: 12 },
  statNum:            { color: "#1E1B4B", fontSize: 20, fontWeight: "800" },
  statLabel:          { color: "#94A3B8", fontSize: 11, fontWeight: "600", marginTop: 2 },
  statDivider:        { width: 1, height: 32, backgroundColor: "#F1F5F9" },
  checkBtn:           { backgroundColor: "#EEF2FF", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: "#C7D2FE" },
  checkBtnT:          { color: "#6366F1", fontSize: 12, fontWeight: "700" },
  lastCheckT:         { color: "#94A3B8", fontSize: 11, textAlign: "center", paddingVertical: 6, backgroundColor: "#fff" },
  priceStrip:         { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EEF2FF", maxHeight: 52 },
  priceStripContent:  { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: "row" },
  priceChip:          { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#F8FAFF", paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: "#EEF2FF" },
  priceChipSymbol:    { fontSize: 12, fontWeight: "700" },
  priceChipValue:     { fontSize: 12, color: "#1E1B4B", fontWeight: "600" },
  list:               { padding: 16 },
  empty:              { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyIcon:          { fontSize: 48, color: "#CBD5E1", marginBottom: 16 },
  emptyTitle:         { color: "#1E1B4B", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptySub:           { color: "#94A3B8", fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  emptyBtn:           { backgroundColor: "#6366F1", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, marginBottom: 32 },
  emptyBtnT:          { color: "#fff", fontSize: 15, fontWeight: "700" },
  examplesWrap:       { backgroundColor: "#fff", borderRadius: 16, padding: 16, width: "100%", borderWidth: 1, borderColor: "#EEF2FF" },
  examplesTitle:      { color: "#64748B", fontSize: 13, fontWeight: "600", marginBottom: 12 },
  exampleRow:         { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "flex-start" },
  exampleDot:         { color: "#6366F1", fontSize: 12, fontWeight: "700" },
  exampleT:           { color: "#1E1B4B", fontSize: 13, flex: 1 },
  clearTriggeredBtn:  { alignSelf: "center", marginTop: 8, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
  clearTriggeredBtnT: { color: "#EF4444", fontSize: 13, fontWeight: "600" },
})

const r = StyleSheet.create({
  row:            { backgroundColor: "#fff", borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "flex-start", gap: 12, shadowColor: "#6366F1", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  rowDisabled:    { opacity: 0.5 },
  tokenBadge:     { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  tokenBadgeT:    { fontSize: 16, fontWeight: "800" },
  mid:            { flex: 1 },
  topRow:         { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" },
  symbol:         { color: "#1E1B4B", fontSize: 15, fontWeight: "800" },
  condBadge:      { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 },
  condBadgeT:     { fontSize: 12, fontWeight: "700" },
  bottomRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  currentPrice:   { color: "#64748B", fontSize: 12, fontWeight: "600" },
  pctAway:        { color: "#94A3B8", fontSize: 12 },
  metBadge:       { backgroundColor: "#FEF3C7", paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8 },
  metBadgeT:      { color: "#D97706", fontSize: 11, fontWeight: "700" },
  metaRow:        { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  freq:           { color: "#94A3B8", fontSize: 11 },
  lastTriggered:  { color: "#94A3B8", fontSize: 11 },
  triggeredBadge: { backgroundColor: "#D1FAE5", paddingVertical: 2, paddingHorizontal: 8, borderRadius: 8 },
  triggeredBadgeT:{ color: "#10B981", fontSize: 11, fontWeight: "700" },
  controls:       { alignItems: "center", gap: 8 },
  deleteBtn:      { width: 30, height: 30, borderRadius: 15, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  deleteBtnT:     { color: "#EF4444", fontSize: 12, fontWeight: "700" },
})

const m = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet:          { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, maxHeight: "90%" },
  handle:         { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginBottom: 20 },
  title:          { color: "#1E1B4B", fontSize: 18, fontWeight: "800", marginBottom: 20 },
  fieldLabel:     { color: "#64748B", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  tokenBtn:       { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFF", borderRadius: 14, borderWidth: 1.5, padding: 12, gap: 12, marginBottom: 16 },
  tokenDot:       { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  tokenDotT:      { fontSize: 14, fontWeight: "800" },
  tokenName:      { color: "#1E1B4B", fontSize: 15, fontWeight: "600" },
  tokenPrice:     { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  tokenChev:      { color: "#94A3B8", fontSize: 12 },
  tokenList:      { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16, overflow: "hidden" },
  tokenOption:    { flexDirection: "row", alignItems: "center", padding: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  tokenOptionName:{ flex: 1, color: "#1E1B4B", fontSize: 14, fontWeight: "600" },
  tokenOptionPrice:{ color: "#94A3B8", fontSize: 13 },
  check:          { fontSize: 14, fontWeight: "800" },
  condRow:        { flexDirection: "row", gap: 10, marginBottom: 16 },
  condBtn:        { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", borderWidth: 1.5, borderColor: "transparent" },
  condBtnActive:  { backgroundColor: "#EEF2FF", borderColor: "#6366F1" },
  condBtnT:       { color: "#64748B", fontSize: 14, fontWeight: "600" },
  condBtnTActive: { color: "#6366F1", fontWeight: "700" },
  thresholdWrap:  { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFF", borderRadius: 14, borderWidth: 1.5, borderColor: "#E2E8F0", paddingHorizontal: 16, height: 56, marginBottom: 16 },
  dollarSign:     { color: "#94A3B8", fontSize: 20, fontWeight: "700", marginRight: 4 },
  thresholdInput: { flex: 1, color: "#1E1B4B", fontSize: 22, fontWeight: "700", height: 56 },
  useCurrentBtn:  { backgroundColor: "#EEF2FF", paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  useCurrentBtnT: { color: "#6366F1", fontSize: 12, fontWeight: "600" },
  summary:        { backgroundColor: "#EEF2FF", borderRadius: 12, padding: 12, marginBottom: 16 },
  summaryT:       { color: "#6366F1", fontSize: 13, fontWeight: "600", textAlign: "center" },
  btnRow:         { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn:      { flex: 1, paddingVertical: 15, borderRadius: 14, backgroundColor: "#F1F5F9", alignItems: "center" },
  cancelBtnT:     { color: "#64748B", fontSize: 15, fontWeight: "700" },
  saveBtn:        { flex: 2, paddingVertical: 15, borderRadius: 14, backgroundColor: "#6366F1", alignItems: "center" },
  saveBtnT:       { color: "#fff", fontSize: 15, fontWeight: "700" },
})
