import { useState, useEffect } from "react"
import {
  View, Text, ScrollView, ActivityIndicator, StyleSheet,
  TouchableOpacity, Platform, Dimensions,
} from "react-native"
import { usePortfolio } from "../hooks/usePortfolio"
import { usePortfolioHistory, TimeRange } from "../hooks/usePortfolioHistory"
import DonutChart from "../components/DonutChart"
import { useWalletStore } from "../store/walletStore"
import { router } from "expo-router"
import { goBack } from "../utils/navigation"
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text as SvgText } from "react-native-svg"

const RANGES: { label: string; value: TimeRange }[] = [
  { label: "7D",  value: "7d"  },
  { label: "30D", value: "30d" },
  { label: "1Y",  value: "1y"  },
]

// --- Mini Line Chart ---
function LineChart({
  data, color, width, height,
}: {
  data: { balanceUSD: number; label: string }[]
  color: string
  width: number
  height: number
}) {
  if (!data || data.length < 2) return (
    <View style={{ width, height, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#94A3B8", fontSize: 12 }}>No chart data</Text>
    </View>
  )

  const values  = data.map(d => d.balanceUSD)
  const minVal  = Math.min(...values)
  const maxVal  = Math.max(...values)
  const range   = maxVal - minVal || 1
  const padX    = 8
  const padY    = 16
  const chartW  = width  - padX * 2
  const chartH  = height - padY * 2

  const points  = data.map((d, i) => ({
    x: padX + (i / (data.length - 1)) * chartW,
    y: padY + chartH - ((d.balanceUSD - minVal) / range) * chartH,
  }))

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")
  const areaPath = linePath + ` L${points[points.length-1].x},${padY + chartH} L${points[0].x},${padY + chartH} Z`

  // Y axis labels
  const yLabels = [maxVal, (maxVal + minVal) / 2, minVal].map((v, i) => ({
    value: v >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v.toFixed(0)}`,
    y: padY + (i / 2) * chartH,
  }))

  // X axis labels - show first, middle, last
  const xLabels = [0, Math.floor(data.length / 2), data.length - 1].map(i => ({
    label: data[i]?.label ?? "",
    x: points[i]?.x ?? 0,
  }))

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0"   stopColor={color} stopOpacity="0.25" />
          <Stop offset="1"   stopColor={color} stopOpacity="0"    />
        </LinearGradient>
      </Defs>

      {/* Grid lines */}
      {yLabels.map((l, i) => (
        <Line
          key={i}
          x1={padX} y1={l.y} x2={padX + chartW} y2={l.y}
          stroke="#F1F5F9" strokeWidth="1"
        />
      ))}

      {/* Area fill */}
      <Path d={areaPath} fill="url(#grad)" />

      {/* Line */}
      <Path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Y labels */}
      {yLabels.map((l, i) => (
        <SvgText key={i} x={padX} y={l.y - 4} fontSize="9" fill="#94A3B8" textAnchor="start">{l.value}</SvgText>
      ))}

      {/* X labels */}
      {xLabels.map((l, i) => (
        <SvgText
          key={i}
          x={l.x}
          y={height - 2}
          fontSize="9"
          fill="#94A3B8"
          textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}
        >{l.label}</SvgText>
      ))}
    </Svg>
  )
}

// --- Main Screen ---
export default function PortfolioScreen() {
  const addr        = useWalletStore(s => s.address)
  const activeChain = useWalletStore(s => s.activeChain)
  const chainCache  = useWalletStore(s => s.chainCache)

  const screenW = Dimensions.get("window").width
  const chartW  = Math.min(screenW - 48, 600)
  const chartH  = 180

  // Portfolio data
  const cached = chainCache[activeChain.id]
  const rawTokens = cached ? [
    {
      symbol:     activeChain.symbol,
      name:       activeChain.nativeName,
      chain:      activeChain.name,
      chainColor: activeChain.color,
      balance:    parseFloat(cached.nativeBalance) || 0,
    },
    ...(cached.tokens ?? []).map((t: any) => ({
      symbol:     t.symbol,
      name:       t.name,
      chain:      activeChain.name,
      chainColor: t.color ?? activeChain.color,
      balance:    parseFloat(t.balance) || 0,
    })),
  ] : []

  const { tokens, byChain, totalUSD, loading, error } = usePortfolio(rawTokens)
  const { data: histData, stats, loading: histLoading, range, setRange, refresh } = usePortfolioHistory(addr)

  useEffect(() => { refresh() }, [addr])

  const fmt = (n: number) =>
    n >= 1000
      ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `$${n.toFixed(2)}`

  const fmtShort = (n: number) =>
    n >= 1000 ? `$${(n/1000).toFixed(2)}k` : `$${n.toFixed(2)}`

  const isPos = stats?.isPositive ?? true

  return (
    <View style={st.c}>
      {/* Header */}
      <View style={st.hdr}>
        <TouchableOpacity style={st.back} onPress={() => goBack()}>
          <Text style={st.backT}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={st.hdrTitle}>Portfolio</Text>
        <TouchableOpacity style={st.refreshBtn} onPress={refresh}>
          <Text style={st.refreshBtnT}>[R]</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.content}
        showsVerticalScrollIndicator={true}
        persistentScrollbar={true}
      >

        {/* ===== TOTAL VALUE CARD ===== */}
        <View style={[st.totalCard, { borderTopColor: activeChain.color, borderTopWidth: 3 }]}>
          <Text style={st.totalLabel}>Total Portfolio Value</Text>
          {loading ? (
            <ActivityIndicator color={activeChain.color} style={{ marginVertical: 8 }} />
          ) : (
            <Text style={st.totalValue}>{fmt(totalUSD)}</Text>
          )}
          {stats && (
            <View style={st.changeRow}>
              <View style={[st.changePill, { backgroundColor: isPos ? "#D1FAE5" : "#FEF2F2" }]}>
                <Text style={[st.changeAmt, { color: isPos ? "#10B981" : "#EF4444" }]}>
                  {isPos ? "+" : ""}{fmt(stats.changeUSD)}
                </Text>
              </View>
              <View style={[st.changePill, { backgroundColor: isPos ? "#D1FAE5" : "#FEF2F2" }]}>
                <Text style={[st.changePct, { color: isPos ? "#10B981" : "#EF4444" }]}>
                  {isPos ? "+" : ""}{stats.changePct.toFixed(2)}%
                </Text>
              </View>
              <Text style={st.changeLabel}>vs period start</Text>
            </View>
          )}
          <View style={st.statsRow}>
            {[
              { label: "High",    value: stats ? fmtShort(stats.highUSD) : "--" },
              { label: "Low",     value: stats ? fmtShort(stats.lowUSD)  : "--" },
              { label: "Average", value: stats ? fmtShort(stats.avgUSD)  : "--" },
            ].map(s => (
              <View key={s.label} style={st.statItem}>
                <Text style={st.statLabel}>{s.label}</Text>
                <Text style={st.statValue}>{s.value}</Text>
              </View>
            ))}
          </View>
          <Text style={st.chainCount}>
            {byChain.length} chain{byChain.length !== 1 ? "s" : ""}  {tokens.length} assets
          </Text>
        </View>

        {/* ===== PRICE HISTORY CHART ===== */}
        <View style={st.chartCard}>
          <View style={st.chartHeader}>
            <Text style={st.sectionTitle}>Portfolio History</Text>
            <View style={st.rangeRow}>
              {RANGES.map(r => (
                <TouchableOpacity
                  key={r.value}
                  style={[st.rangeBtn, range === r.value && { backgroundColor: activeChain.color }]}
                  onPress={() => setRange(r.value)}
                >
                  <Text style={[st.rangeBtnT, range === r.value && { color: "#fff" }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {histLoading ? (
            <View style={[st.chartPlaceholder, { height: chartH }]}>
              <ActivityIndicator color={activeChain.color} />
              <Text style={st.chartLoadT}>Loading history...</Text>
            </View>
          ) : histData.length < 2 ? (
            <View style={[st.chartPlaceholder, { height: chartH }]}>
              <Text style={st.chartEmptyIcon}>[~]</Text>
              <Text style={st.chartEmptyT}>No history data yet</Text>
              <Text style={st.chartEmptySub}>Fund your wallet to see portfolio history</Text>
            </View>
          ) : (
            <View style={{ marginTop: 8 }}>
              <LineChart
                data={histData}
                color={isPos ? "#10B981" : "#EF4444"}
                width={chartW}
                height={chartH}
              />
            </View>
          )}
        </View>

        {/* ===== ALLOCATION DONUT ===== */}
        {byChain.length > 0 && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>By Chain</Text>
            <View style={st.donutRow}>
              <DonutChart slices={byChain.map(c => ({ color: c.color, pct: c.pct, label: c.chain }))} size={160} />
              <View style={st.chainList}>
                {byChain.map((c, i) => (
                  <View key={i} style={st.chainRow}>
                    <View style={[st.dot, { backgroundColor: c.color }]} />
                    <Text style={st.chainName}>{c.chain}</Text>
                    <View style={st.barWrap}>
                      <View style={[st.bar, { width: `${c.pct}%` as any, backgroundColor: c.color + "CC" }]} />
                    </View>
                    <Text style={st.chainPct}>{c.pct.toFixed(1)}%</Text>
                    <Text style={st.chainVal}>{fmtShort(c.valueUSD)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* ===== TOKEN ALLOCATION ===== */}
        {tokens.length > 0 && (
          <View style={st.section}>
            <Text style={st.sectionTitle}>Token Allocation</Text>
            {tokens.map((t, i) => (
              <View key={i} style={st.tokenRow}>
                <View style={[st.tokenDot, { backgroundColor: t.chainColor + "22" }]}>
                  <Text style={[st.tokenDotTxt, { color: t.chainColor }]}>{t.symbol.slice(0, 2)}</Text>
                </View>
                <View style={st.tokenMid}>
                  <View style={st.tokenTopRow}>
                    <Text style={st.tokenName}>{t.symbol}</Text>
                    <Text style={st.tokenValue}>{fmt(t.valueUSD)}</Text>
                  </View>
                  <View style={st.tokenBottomRow}>
                    <Text style={st.tokenSub}>{t.name}  {t.chain}</Text>
                    <Text style={st.tokenPct}>{t.pct.toFixed(1)}%</Text>
                  </View>
                  <View style={st.allocBarWrap}>
                    <View style={[st.allocBar, { width: `${t.pct}%` as any, backgroundColor: t.chainColor }]} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Empty state */}
        {!loading && tokens.length === 0 && (
          <View style={st.emptyCard}>
            <Text style={st.emptyIcon}>[P]</Text>
            <Text style={st.emptyTitle}>No assets yet</Text>
            <Text style={st.emptySub}>Fund your wallet to see your portfolio breakdown</Text>
            <TouchableOpacity
              style={[st.fundBtn, { backgroundColor: activeChain.color }]}
              onPress={() => router.push("/buy" as any)}
            >
              <Text style={st.fundBtnT}>Buy Crypto</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  )
}

const st = StyleSheet.create({
  c:              { flex: 1, backgroundColor: "#F4F7FF" },
  hdr:            { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EEF2FF" },
  back:           { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F4F7FF", borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  backT:          { color: "#6366F1", fontSize: 18, fontWeight: "700" },
  hdrTitle:       { color: "#1E1B4B", fontSize: 17, fontWeight: "800" },
  refreshBtn:     { width: 38, height: 38, borderRadius: 12, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  refreshBtnT:    { color: "#6366F1", fontSize: 13, fontWeight: "700" },
  scroll:         { flex: 1 },
  content:        { padding: 20, paddingBottom: 48 },

  // Total card
  totalCard:      { backgroundColor: "#fff", borderRadius: 24, padding: 24, marginBottom: 16, shadowColor: "#6366F1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  totalLabel:     { fontSize: 12, color: "#94A3B8", fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  totalValue:     { fontSize: 40, fontWeight: "800", color: "#1E1B4B", letterSpacing: -1.5, marginBottom: 12 },
  changeRow:      { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  changePill:     { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
  changeAmt:      { fontSize: 13, fontWeight: "700" },
  changePct:      { fontSize: 13, fontWeight: "700" },
  changeLabel:    { color: "#94A3B8", fontSize: 12 },
  statsRow:       { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#F8FAFF", borderRadius: 14, padding: 14, marginBottom: 12 },
  statItem:       { alignItems: "center", flex: 1 },
  statLabel:      { color: "#94A3B8", fontSize: 11, fontWeight: "600", marginBottom: 4 },
  statValue:      { color: "#1E1B4B", fontSize: 14, fontWeight: "700" },
  chainCount:     { color: "#94A3B8", fontSize: 12 },

  // Chart card
  chartCard:      { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: "#6366F1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  chartHeader:    { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  rangeRow:       { flexDirection: "row", gap: 4 },
  rangeBtn:       { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "#F1F5F9" },
  rangeBtnT:      { color: "#64748B", fontSize: 12, fontWeight: "700" },
  chartPlaceholder:{ alignItems: "center", justifyContent: "center", gap: 8 },
  chartLoadT:     { color: "#94A3B8", fontSize: 13, marginTop: 8 },
  chartEmptyIcon: { fontSize: 32, color: "#CBD5E1" },
  chartEmptyT:    { color: "#1E1B4B", fontSize: 15, fontWeight: "700" },
  chartEmptySub:  { color: "#94A3B8", fontSize: 13, textAlign: "center" },

  // Sections
  section:        { backgroundColor: "#fff", borderRadius: 24, padding: 20, marginBottom: 16, shadowColor: "#6366F1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  sectionTitle:   { fontSize: 15, fontWeight: "800", color: "#1E1B4B", letterSpacing: -0.3 },
  donutRow:       { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 16 },
  chainList:      { flex: 1, gap: 10 },
  chainRow:       { flexDirection: "row", alignItems: "center", gap: 6 },
  dot:            { width: 8, height: 8, borderRadius: 4 },
  chainName:      { fontSize: 12, fontWeight: "600", color: "#1E1B4B", width: 52 },
  barWrap:        { flex: 1, height: 6, backgroundColor: "#F1F5F9", borderRadius: 3, overflow: "hidden" },
  bar:            { height: 6, borderRadius: 3 },
  chainPct:       { fontSize: 11, color: "#94A3B8", width: 36, textAlign: "right" },
  chainVal:       { fontSize: 11, color: "#64748B", width: 52, textAlign: "right" },

  // Token rows
  tokenRow:       { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#F8FAFF" },
  tokenDot:       { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  tokenDotTxt:    { fontSize: 14, fontWeight: "800" },
  tokenMid:       { flex: 1 },
  tokenTopRow:    { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  tokenBottomRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  tokenName:      { fontSize: 14, fontWeight: "700", color: "#1E1B4B" },
  tokenValue:     { fontSize: 14, fontWeight: "800", color: "#1E1B4B" },
  tokenSub:       { fontSize: 12, color: "#94A3B8" },
  tokenPct:       { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
  allocBarWrap:   { height: 4, backgroundColor: "#F1F5F9", borderRadius: 2, overflow: "hidden" },
  allocBar:       { height: 4, borderRadius: 2 },

  // Empty state
  emptyCard:      { backgroundColor: "#fff", borderRadius: 24, padding: 40, alignItems: "center", shadowColor: "#6366F1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 3 },
  emptyIcon:      { fontSize: 48, color: "#CBD5E1", marginBottom: 16 },
  emptyTitle:     { color: "#1E1B4B", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptySub:       { color: "#94A3B8", fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
  fundBtn:        { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 },
  fundBtnT:       { color: "#fff", fontSize: 15, fontWeight: "700" },
})