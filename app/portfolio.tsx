/**
 * app/portfolio.tsx
 * Portfolio chart — 7d/30d/1y balance history with P&L
 * Uses react-native-svg for the chart (already a common Expo dep)
 * Install: npx expo install react-native-svg
 */

import { useEffect, useState, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Dimensions, ActivityIndicator, PanResponder,
} from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line, Text as SvgText, Rect } from 'react-native-svg'
import { router } from 'expo-router'
import { useWalletStore } from '../store/walletStore'
import { usePortfolioHistory, DataPoint, TimeRange } from '../hooks/usePortfolioHistory'

const { width: SCREEN_W } = Dimensions.get('window')
const CHART_W   = SCREEN_W - 32
const CHART_H   = 200
const PAD_LEFT  = 0
const PAD_RIGHT = 0
const PAD_TOP   = 20
const PAD_BOT   = 32

// ─── SVG Line Chart ───────────────────────────────────────────────────────────
function LineChart({
  data, color, isPositive,
}: {
  data: DataPoint[]; color: string; isPositive: boolean
}) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; point: DataPoint } | null>(null)

  if (data.length < 2) return null

  const innerW = CHART_W - PAD_LEFT - PAD_RIGHT
  const innerH = CHART_H - PAD_TOP  - PAD_BOT

  const values   = data.map(d => d.balanceUSD)
  const minVal   = Math.min(...values)
  const maxVal   = Math.max(...values)
  const range    = maxVal - minVal || 1

  const xScale = (i: number) => PAD_LEFT + (i / (data.length - 1)) * innerW
  const yScale = (v: number) => PAD_TOP  + (1 - (v - minVal) / range) * innerH

  // Build SVG path
  const points = data.map((d, i) => ({ x: xScale(i), y: yScale(d.balanceUSD) }))
  const pathD  = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')

  // Area fill path
  const areaD  = pathD
    + ` L ${points[points.length - 1].x.toFixed(1)} ${(CHART_H - PAD_BOT).toFixed(1)}`
    + ` L ${points[0].x.toFixed(1)} ${(CHART_H - PAD_BOT).toFixed(1)} Z`

  // Touch handler for tooltip
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (evt) => handleTouch(evt.nativeEvent.locationX),
      onPanResponderMove:  (evt) => handleTouch(evt.nativeEvent.locationX),
      onPanResponderRelease: () => setTimeout(() => setTooltip(null), 1500),
    })
  ).current

  function handleTouch(x: number) {
    const idx   = Math.round(((x - PAD_LEFT) / innerW) * (data.length - 1))
    const clamp = Math.max(0, Math.min(data.length - 1, idx))
    const point = data[clamp]
    const px    = xScale(clamp)
    const py    = yScale(point.balanceUSD)
    setTooltip({ x: px, y: py, point })
  }

  // Y-axis labels (3 gridlines)
  const gridLines = [0, 0.5, 1].map(pct => ({
    y:     PAD_TOP + pct * innerH,
    value: maxVal - pct * range,
  }))

  // X-axis labels — show ~5 evenly spaced
  const xLabelIndices = [0, 0.25, 0.5, 0.75, 1].map(p =>
    Math.round(p * (data.length - 1))
  )

  const gradId   = `grad-${isPositive ? 'pos' : 'neg'}`

  return (
    <View style={{ width: CHART_W, height: CHART_H }} {...panResponder.panHandlers}>
      <Svg width={CHART_W} height={CHART_H}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%"   stopColor={color} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <Line key={i} x1={PAD_LEFT} x2={CHART_W - PAD_RIGHT}
            y1={g.y} y2={g.y} stroke="#F1F5F9" strokeWidth="1" strokeDasharray="4 4" />
        ))}

        {/* Area fill */}
        <Path d={areaD} fill={`url(#${gradId})`} />

        {/* Line */}
        <Path d={pathD} stroke={color} strokeWidth="2.5" fill="none"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* X labels */}
        {xLabelIndices.map(idx => (
          <SvgText
            key={idx}
            x={xScale(idx)} y={CHART_H - 4}
            fontSize="10" fill="#94A3B8"
            textAnchor={idx === 0 ? 'start' : idx === data.length - 1 ? 'end' : 'middle'}
          >
            {data[idx]?.label ?? ''}
          </SvgText>
        ))}

        {/* Tooltip */}
        {tooltip && (
          <>
            <Line x1={tooltip.x} x2={tooltip.x}
              y1={PAD_TOP} y2={CHART_H - PAD_BOT}
              stroke={color} strokeWidth="1" strokeDasharray="3 3" />
            <Circle cx={tooltip.x} cy={tooltip.y} r="5"
              fill={color} stroke="#fff" strokeWidth="2" />

            {/* Tooltip box */}
            <Rect
              x={Math.min(tooltip.x - 60, CHART_W - 130)}
              y={Math.max(PAD_TOP - 4, tooltip.y - 52)}
              width={120} height={44} rx={8}
              fill="#1E1B4B" opacity="0.9"
            />
            <SvgText
              x={Math.min(tooltip.x, CHART_W - 70)}
              y={Math.max(PAD_TOP + 14, tooltip.y - 32)}
              fontSize="12" fill="#fff" textAnchor="middle" fontWeight="700"
            >
              ${tooltip.point.balanceUSD.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </SvgText>
            <SvgText
              x={Math.min(tooltip.x, CHART_W - 70)}
              y={Math.max(PAD_TOP + 30, tooltip.y - 16)}
              fontSize="10" fill="rgba(255,255,255,0.7)" textAnchor="middle"
            >
              {tooltip.point.label}
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <View style={c.statCard}>
      <Text style={c.statLabel}>{label}</Text>
      <Text style={[c.statValue, color ? { color } : {}]}>{value}</Text>
      {sub ? <Text style={c.statSub}>{sub}</Text> : null}
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function Portfolio() {
  const addr  = useWalletStore(s => s.address)
  const { data, stats, loading, error, range, setRange, refresh } = usePortfolioHistory(addr)

  useEffect(() => { refresh() }, [])

  const chartColor = stats?.isPositive !== false ? '#10B981' : '#EF4444'

  const fmt = (n: number) =>
    `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const fmtPct = (n: number) =>
    `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

  const RANGES: TimeRange[] = ['7d', '30d', '1y']

  return (
    <View style={s.c}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Text style={s.backT}>←</Text>
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Portfolio</Text>
        <TouchableOpacity onPress={refresh}>
          <Text style={{ color: '#6366F1', fontSize: 18 }}>↺</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Balance summary */}
        <View style={s.balanceCard}>
          {loading && !stats ? (
            <View style={{ paddingVertical: 32, alignItems: 'center' }}>
              <ActivityIndicator color="#6366F1" />
              <Text style={{ color: '#94A3B8', marginTop: 10, fontSize: 13 }}>
                Loading portfolio history…
              </Text>
            </View>
          ) : stats ? (
            <>
              <Text style={s.balLabel}>Total Portfolio Value</Text>
              <Text style={s.balAmount}>{fmt(stats.currentUSD)}</Text>
              <Text style={s.balETH}>{stats.currentETH.toFixed(4)} ETH</Text>

              <View style={[s.changeBadge, {
                backgroundColor: stats.isPositive ? '#D1FAE5' : '#FEF2F2'
              }]}>
                <Text style={[s.changeT, { color: stats.isPositive ? '#059669' : '#DC2626' }]}>
                  {stats.isPositive ? '▲' : '▼'} {fmt(stats.changeUSD)} ({fmtPct(stats.changePct)}) · {range}
                </Text>
              </View>
            </>
          ) : (
            <Text style={{ color: '#94A3B8', padding: 20, textAlign: 'center' }}>
              {error || 'No data available'}
            </Text>
          )}
        </View>

        {/* Time range selector */}
        <View style={s.rangeRow}>
          {RANGES.map(r => (
            <TouchableOpacity
              key={r}
              style={[s.rangeBtn, range === r && s.rangeBtnActive]}
              onPress={() => setRange(r)}
            >
              <Text style={[s.rangeBtnT, range === r && s.rangeBtnTActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Chart */}
        <View style={s.chartCard}>
          {loading ? (
            <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={chartColor} />
            </View>
          ) : data.length > 1 ? (
            <LineChart data={data} color={chartColor} isPositive={stats?.isPositive ?? true} />
          ) : (
            <View style={{ height: CHART_H, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#CBD5E1', fontSize: 13 }}>
                {error ? `⚠ ${error}` : 'Not enough data for chart'}
              </Text>
            </View>
          )}
          <Text style={s.chartHint}>Touch and drag to inspect values</Text>
        </View>

        {/* Stats grid */}
        {stats && (
          <View style={s.statsGrid}>
            <StatCard
              label={`P&L (${range})`}
              value={`${stats.isPositive ? '+' : ''}${fmt(stats.changeUSD)}`}
              sub={fmtPct(stats.changePct)}
              color={stats.isPositive ? '#10B981' : '#EF4444'}
            />
            <StatCard label="Period High" value={fmt(stats.highUSD)} />
            <StatCard label="Period Low"  value={fmt(stats.lowUSD)} />
            <StatCard label="Average"     value={fmt(stats.avgUSD)} />
          </View>
        )}

        {/* Quick actions */}
        <View style={s.actionsCard}>
          <Text style={s.actionsTitle}>Analytics</Text>
          <TouchableOpacity style={s.actionRow} onPress={() => router.push('/analytics' as any)}>
            <View style={s.actionIcon}><Text style={{ fontSize: 18 }}>🏷</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.actionTitle}>Transaction Categories</Text>
              <Text style={s.actionSub}>Auto-tagged swaps, DeFi, transfers</Text>
            </View>
            <Text style={s.actionArrow}>→</Text>
          </TouchableOpacity>
          <View style={s.actionDivider} />
          <TouchableOpacity style={s.actionRow} onPress={() => router.push('/taxreport' as any)}>
            <View style={s.actionIcon}><Text style={{ fontSize: 18 }}>📄</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={s.actionTitle}>Tax Report</Text>
              <Text style={s.actionSub}>Export CSV for tax filing</Text>
            </View>
            <Text style={s.actionArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Data note */}
        <View style={s.noteCard}>
          <Text style={s.noteT}>
            ℹ  Portfolio values are calculated using ETH price history from CoinGecko and on-chain transaction data from Etherscan. Values are estimates and may not reflect ERC-20 token balances.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  c:             { flex: 1, backgroundColor: '#F8FAFF' },
  hdr:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  back:          { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  backT:         { color: '#6366F1', fontSize: 18 },
  hdrTitle:      { color: '#1E1B4B', fontSize: 17, fontWeight: '700' },
  balanceCard:   { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#6366F1', borderRadius: 24, padding: 24, alignItems: 'center', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
  balLabel:      { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 6 },
  balAmount:     { color: '#fff', fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  balETH:        { color: 'rgba(255,255,255,0.65)', fontSize: 14, marginTop: 4, marginBottom: 12 },
  changeBadge:   { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 20 },
  changeT:       { fontSize: 13, fontWeight: '700' },
  rangeRow:      { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 12, paddingHorizontal: 16 },
  rangeBtn:      { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0' },
  rangeBtnActive:{ backgroundColor: '#1E1B4B', borderColor: '#1E1B4B' },
  rangeBtnT:     { color: '#64748B', fontSize: 13, fontWeight: '600' },
  rangeBtnTActive:{ color: '#fff' },
  chartCard:     { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 16, overflow: 'hidden' },
  chartHint:     { color: '#CBD5E1', fontSize: 11, textAlign: 'center', marginTop: 6 },
  statsGrid:     { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  actionsCard:   { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 12 },
  actionsTitle:  { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  actionRow:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionIcon:    { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  actionTitle:   { color: '#1E1B4B', fontSize: 14, fontWeight: '600', marginBottom: 2 },
  actionSub:     { color: '#94A3B8', fontSize: 12 },
  actionArrow:   { color: '#CBD5E1', fontSize: 18 },
  actionDivider: { height: 1, backgroundColor: '#F8FAFF', marginVertical: 12 },
  noteCard:      { marginHorizontal: 16, backgroundColor: '#EEF2FF', borderRadius: 12, borderWidth: 1, borderColor: '#C7D2FE', padding: 14 },
  noteT:         { color: '#4338CA', fontSize: 12, lineHeight: 19 },
})

const c = StyleSheet.create({
  statCard:  { width: '48%', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', padding: 14 },
  statLabel: { color: '#94A3B8', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 },
  statValue: { color: '#1E1B4B', fontSize: 18, fontWeight: '800', marginBottom: 2 },
  statSub:   { color: '#94A3B8', fontSize: 12 },
})
