import { useState, useEffect, useRef } from "react"
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  ActivityIndicator, Animated, Modal, ScrollView,
  Linking, Platform, RefreshControl,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useWalletStore } from "../store/walletStore"
import { CHAINS } from "../utils/chains"
import { useTransactions, Tx, TxType } from "../hooks/useTransactions"

// --- Helpers ---
function relativeTime(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts
  if (diff < 60)        return `${diff}s ago`
  if (diff < 3600)      return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)     return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  const d = new Date(ts * 1000)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })
}

function shortAddr(addr: string) {
  return addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : "-"
}

const TYPE_META: Record<TxType, { label: string; icon: string; color: string; bgColor: string }> = {
  send:          { label: "Sent",         icon: "arrow-up-outline",       color: "#EF4444", bgColor: "#FEF2F2" },
  receive:       { label: "Received",     icon: "arrow-down-outline",     color: "#10B981", bgColor: "#D1FAE5" },
  token_send:    { label: "Token Send",   icon: "arrow-up-circle-outline",color: "#F59E0B", bgColor: "#FEF3C7" },
  token_receive: { label: "Token Recv",   icon: "arrow-down-circle-outline",color: "#06B6D4", bgColor: "#CFFAFE" },
  contract:      { label: "Contract",     icon: "code-slash-outline",     color: "#8B5CF6", bgColor: "#EDE9FE" },
}

type FilterKey = "all" | "sent" | "received" | "tokens"

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all",      label: "All"      },
  { key: "sent",     label: "Sent"     },
  { key: "received", label: "Received" },
  { key: "tokens",   label: "Tokens"   },
]

function matchFilter(tx: Tx, filter: FilterKey): boolean {
  if (filter === "all")      return true
  if (filter === "sent")     return tx.type === "send"    || tx.type === "token_send"
  if (filter === "received") return tx.type === "receive" || tx.type === "token_receive"
  if (filter === "tokens")   return tx.isERC20
  return true
}

// --- TxRow ---
function TxRow({ tx, onPress }: { tx: Tx; onPress: () => void }) {
  const meta   = TYPE_META[tx.type]
  const isSend = tx.type === "send" || tx.type === "token_send"

  return (
    <TouchableOpacity style={r.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[r.iconWrap, { backgroundColor: meta.bgColor }]}>
        <Ionicons name={meta.icon as any} size={18} color={meta.color} />
      </View>
      <View style={r.mid}>
        <View style={r.topRow}>
          <Text style={r.label}>{meta.label}</Text>
          {tx.status === "failed" && (
            <View style={r.failBadge}>
              <Text style={r.failBadgeT}>Failed</Text>
            </View>
          )}
          {tx.isERC20 && (
            <View style={r.erc20Badge}>
              <Text style={r.erc20BadgeT}>Token</Text>
            </View>
          )}
        </View>
        <Text style={r.addr}>
          {isSend
            ? `To: ${shortAddr(tx.to)}`
            : `From: ${shortAddr(tx.from)}`}
        </Text>
        <Text style={r.time}>{relativeTime(tx.timestamp)}</Text>
      </View>
      <View style={r.right}>
        <Text style={[r.amount, { color: isSend ? "#EF4444" : "#10B981" }]}>
          {isSend ? "-" : "+"}{tx.value} {tx.symbol}
        </Text>
        <Text style={r.block}>Block #{tx.blockNumber}</Text>
      </View>
    </TouchableOpacity>
  )
}

// --- Detail Modal ---
function TxDetail({
  tx, visible, onClose, explorerBase,
}: {
  tx: Tx | null; visible: boolean; onClose: () => void; explorerBase: string
}) {
  const slideAnim = useRef(new Animated.Value(600)).current

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 600,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start()
  }, [visible])

  if (!tx) return null

  const meta   = TYPE_META[tx.type]
  const isSend = tx.type === "send" || tx.type === "token_send"

  const rows = [
    { label: "Status",      value: tx.status.charAt(0).toUpperCase() + tx.status.slice(1),
      color: tx.status === "success" ? "#10B981" : tx.status === "failed" ? "#EF4444" : "#F59E0B" },
    { label: "Type",        value: meta.label },
    { label: "Token",       value: `${tx.tokenName} (${tx.symbol})` },
    { label: "Amount",      value: `${isSend ? "-" : "+"}${tx.value} ${tx.symbol}` },
    { label: "From",        value: tx.from, mono: true },
    { label: "To",          value: tx.to,   mono: true },
    { label: "Block",       value: `#${tx.blockNumber}` },
    { label: "Date",        value: new Date(tx.timestamp * 1000).toLocaleString() },
    { label: "Gas Used",    value: `${parseInt(tx.gasUsed || "0").toLocaleString()} units` },
    { label: "Gas Price",   value: `${tx.gasPrice} Gwei` },
    { label: "Network Fee", value: `${tx.gasCostETH} ETH` },
  ]

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={d.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[d.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={d.handle} />

        <View style={d.hdr}>
          <View style={[d.typeIcon, { backgroundColor: meta.bgColor }]}>
            <Ionicons name={meta.icon as any} size={22} color={meta.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={d.typeLabel}>{meta.label}</Text>
            <Text style={[d.amountLarge, { color: isSend ? "#EF4444" : "#10B981" }]}>
              {isSend ? "-" : "+"}{tx.value} {tx.symbol}
            </Text>
          </View>
          <TouchableOpacity style={d.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View style={d.hashBox}>
          <Text style={d.hashLabel}>Transaction Hash</Text>
          <Text style={d.hash} numberOfLines={1} ellipsizeMode="middle">{tx.hash}</Text>
        </View>

        <ScrollView style={d.scroll} showsVerticalScrollIndicator={false}>
          <View style={d.card}>
            {rows.map((row, i) => (
              <View key={row.label} style={[d.detailRow, i < rows.length - 1 && d.bordered]}>
                <Text style={d.detailL}>{row.label}</Text>
                <Text
                  style={[
                    d.detailV,
                    row.mono ? d.mono : null,
                    row.color ? { color: row.color } : null,
                  ]}
                  numberOfLines={row.mono ? 1 : undefined}
                  ellipsizeMode={row.mono ? "middle" : undefined}
                >
                  {row.value}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={d.explorerBtn}
            onPress={() => Linking.openURL(`${explorerBase}/tx/${tx.hash}`)}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={d.explorerBtnT}>View on Explorer</Text>
              <Ionicons name="open-outline" size={14} color="#6366F1" />
            </View>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </Modal>
  )
}

// --- Main Screen ---
export default function History() {
  const addr        = useWalletStore(s => s.address)
  const activeChain = useWalletStore(s => s.activeChain)
  const { txns, loading, loadingMore, error, hasMore, refresh, loadMore } = useTransactions(addr)

  const [filter,    setFilter]    = useState<FilterKey>("all")
  const [selected,  setSelected]  = useState<Tx | null>(null)
  const [detailVis, setDetailVis] = useState(false)
  const [chainIdx,  setChainIdx]  = useState(
    CHAINS.findIndex(c => c.id === activeChain.id) ?? 0
  )

  const displayChain = CHAINS[chainIdx] ?? activeChain

  useEffect(() => { refresh() }, [refresh])

  const filtered = txns.filter(tx => matchFilter(tx, filter))

  function openDetail(tx: Tx) {
    setSelected(tx)
    setDetailVis(true)
  }

  // Group by date
  type Section = { type: "header"; date: string } | { type: "tx"; tx: Tx }
  const sectioned: Section[] = []
  let lastDate = ""
  for (const tx of filtered) {
    const diff  = Math.floor(Date.now() / 1000 - tx.timestamp) / 86400
    const label = diff < 1 ? "Today"
      : diff < 2 ? "Yesterday"
      : new Date(tx.timestamp * 1000).toLocaleDateString("en-US", {
          weekday: "long", month: "short", day: "numeric"
        })
    if (label !== lastDate) {
      sectioned.push({ type: "header", date: label })
      lastDate = label
    }
    sectioned.push({ type: "tx", tx })
  }

  const countFor = (f: FilterKey) => txns.filter(tx => matchFilter(tx, f)).length

  return (
    <View style={s.c}>

      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Transaction History</Text>
        <TouchableOpacity style={s.refreshBtn} onPress={() => {
          // Force refresh by resetting debounce
          refresh()
        }}>
          <Ionicons name="refresh-outline" size={22} color="#6366F1" />
        </TouchableOpacity>
      </View>

      {/* Chain selector */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.chainScroll}
        contentContainerStyle={s.chainRow}
      >
        {CHAINS.map((chain, idx) => (
          <TouchableOpacity
            key={chain.id}
            style={[
              s.chainTab,
              chainIdx === idx && { backgroundColor: chain.color, borderColor: chain.color }
            ]}
            onPress={() => setChainIdx(idx)}
          >
            <View style={[s.chainDot, { backgroundColor: chainIdx === idx ? "rgba(255,255,255,0.3)" : chain.color + "30" }]}>
              <Text style={[s.chainDotT, { color: chainIdx === idx ? "#fff" : chain.color }]}>{chain.icon}</Text>
            </View>
            <Text style={[s.chainTabT, chainIdx === idx && { color: "#fff" }]}>{chain.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filterWrap}
        contentContainerStyle={s.filters}
      >
        {FILTERS.map(f => {
          const count   = countFor(f.key)
          const isActive = filter === f.key
          return (
            <TouchableOpacity
              key={f.key}
              style={[s.filterTab, isActive && s.filterTabActive]}
              onPress={() => setFilter(f.key)}
            >
              <Text style={[s.filterTabT, isActive && s.filterTabTActive]}>{f.label}</Text>
              {isActive && count > 0 && (
                <View style={s.filterBadge}>
                  <Text style={s.filterBadgeT}>{count}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={s.loadT}>Loading transactions...</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={56} color="#CBD5E1" />
          <Text style={s.errTitle}>Could not load transactions</Text>
          <Text style={s.errSub}>Check your connection or try again</Text>
          <TouchableOpacity style={s.retryBtn} onPress={refresh}>
            <Text style={s.retryBtnT}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="receipt-outline" size={56} color="#CBD5E1" />
          <Text style={s.errTitle}>No transactions yet</Text>
          <Text style={s.errSub}>
            {filter === "all"
              ? "Send or receive crypto to see your history"
              : `No ${filter} transactions found`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={sectioned}
          keyExtractor={(item, i) =>
            item.type === "header" ? `hdr-${item.date}-${i}` : `${item.tx.hash}-${i}`
          }
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={true}
          persistentScrollbar={true}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#6366F1" />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          renderItem={({ item }) =>
            item.type === "header" ? (
              <Text style={s.sectionHdr}>{item.date}</Text>
            ) : (
              <TxRow tx={item.tx} onPress={() => openDetail(item.tx)} />
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={s.loadMoreWrap}>
                <ActivityIndicator color="#6366F1" />
                <Text style={s.loadMoreT}>Loading more...</Text>
              </View>
            ) : !hasMore && filtered.length > 0 ? (
              <Text style={s.endT}>--- All transactions loaded ---</Text>
            ) : null
          }
        />
      )}

      <TxDetail
        tx={selected}
        visible={detailVis}
        onClose={() => setDetailVis(false)}
        explorerBase={displayChain.explorer}
      />
    </View>
  )
}

// --- Styles ---
const s = StyleSheet.create({
  c:                { flex: 1, backgroundColor: "#F8FAFF" },
  hdr:              { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  back:             { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  backT:            { color: "#6366F1", fontSize: 18, fontWeight: "700" },
  hdrTitle:         { color: "#1E1B4B", fontSize: 17, fontWeight: "700" },
  refreshBtn:       { width: 38, height: 38, borderRadius: 12, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  refreshBtnT:      { color: "#6366F1", fontSize: 14, fontWeight: "700" },
  chainScroll:      { maxHeight: 56, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  chainRow:         { paddingHorizontal: 16, paddingVertical: 8, gap: 8, flexDirection: "row" },
  chainTab:         { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E2E8F0" },
  chainDot:         { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  chainDotT:        { fontSize: 10, fontWeight: "800" },
  chainTabT:        { color: "#64748B", fontSize: 12, fontWeight: "600" },
  filterWrap:       { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  filters:          { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: "row" },
  filterTab:        { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E2E8F0" },
  filterTabActive:  { backgroundColor: "#6366F1", borderColor: "#6366F1" },
  filterTabT:       { color: "#64748B", fontSize: 13, fontWeight: "600" },
  filterTabTActive: { color: "#fff" },
  filterBadge:      { backgroundColor: "rgba(255,255,255,0.3)", width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  filterBadgeT:     { color: "#fff", fontSize: 10, fontWeight: "700" },
  list:             { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },
  sectionHdr:       { color: "#94A3B8", fontSize: 12, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 16, marginBottom: 8, marginLeft: 4 },
  center:           { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  loadT:            { color: "#94A3B8", fontSize: 14, marginTop: 12 },
  errIcon:          { fontSize: 40, marginBottom: 12, color: "#94A3B8" },
  errTitle:         { color: "#1E1B4B", fontSize: 18, fontWeight: "700", marginBottom: 6, textAlign: "center" },
  errSub:           { color: "#94A3B8", fontSize: 14, textAlign: "center", lineHeight: 20 },
  retryBtn:         { marginTop: 20, backgroundColor: "#6366F1", paddingVertical: 12, paddingHorizontal: 28, borderRadius: 12 },
  retryBtnT:        { color: "#fff", fontSize: 14, fontWeight: "600" },
  loadMoreWrap:     { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 20 },
  loadMoreT:        { color: "#94A3B8", fontSize: 13 },
  endT:             { color: "#CBD5E1", fontSize: 12, textAlign: "center", paddingVertical: 20 },
})

const r = StyleSheet.create({
  row:          { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#F1F5F9", shadowColor: "#64748B", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  iconWrap:     { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 12 },
  icon:         { fontSize: 13, fontWeight: "800" },
  mid:          { flex: 1 },
  topRow:       { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  label:        { color: "#1E1B4B", fontSize: 14, fontWeight: "600" },
  failBadge:    { backgroundColor: "#FEF2F2", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  failBadgeT:   { color: "#EF4444", fontSize: 10, fontWeight: "700" },
  erc20Badge:   { backgroundColor: "#EEF2FF", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  erc20BadgeT:  { color: "#6366F1", fontSize: 10, fontWeight: "700" },
  addr:         { color: "#94A3B8", fontSize: 12, marginBottom: 2 },
  time:         { color: "#CBD5E1", fontSize: 11 },
  right:        { alignItems: "flex-end" },
  amount:       { fontSize: 14, fontWeight: "600", marginBottom: 3 },
  block:        { color: "#CBD5E1", fontSize: 11 },
})

const d = StyleSheet.create({
  overlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.5)" },
  sheet:        { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "85%", paddingTop: 12 },
  handle:       { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginBottom: 16 },
  hdr:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, gap: 14, marginBottom: 16 },
  typeIcon:     { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  typeIconT:    { fontSize: 16, fontWeight: "800" },
  typeLabel:    { color: "#94A3B8", fontSize: 13, fontWeight: "500", marginBottom: 2 },
  amountLarge:  { fontSize: 24, fontWeight: "700" },
  closeBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  closeBtnT:    { color: "#64748B", fontSize: 12, fontWeight: "700" },
  hashBox:      { marginHorizontal: 20, backgroundColor: "#F8FAFF", borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", padding: 12, marginBottom: 16 },
  hashLabel:    { color: "#94A3B8", fontSize: 11, fontWeight: "600", marginBottom: 4 },
  hash:         { color: "#6366F1", fontSize: 12, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  scroll:       { paddingHorizontal: 20 },
  card:         { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden", marginBottom: 14 },
  detailRow:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16 },
  bordered:     { borderBottomWidth: 1, borderBottomColor: "#F8FAFF" },
  detailL:      { color: "#94A3B8", fontSize: 13, flex: 1 },
  detailV:      { color: "#1E1B4B", fontSize: 13, fontWeight: "500", flex: 2, textAlign: "right" },
  mono:         { fontFamily: Platform.OS === "ios" ? "Courier" : "monospace", fontSize: 11 },
  explorerBtn:  { backgroundColor: "#EEF2FF", paddingVertical: 14, borderRadius: 14, alignItems: "center", borderWidth: 1.5, borderColor: "#C7D2FE" },
  explorerBtnT: { color: "#6366F1", fontSize: 14, fontWeight: "600" },
})