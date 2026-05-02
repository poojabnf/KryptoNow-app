@'
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native'
import { usePortfolio } from '../hooks/usePortfolio'
import DonutChart from '../components/DonutChart'

function useWalletTokens() {
  const { tokens } = useWallet()
  return tokens ?? []
}

export default function PortfolioScreen() {
  const rawTokens = useWalletTokens()
  const { tokens, byChain, totalUSD, loading, error } = usePortfolio(rawTokens)

  const fmtUSD = (n: number) =>
    n >= 1000
      ? `$${(n / 1000).toFixed(2)}k`
      : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  if (loading) return (
    <View style={st.center}>
      <ActivityIndicator size="large" color="#7F77DD" />
      <Text style={st.loadText}>Building portfolio…</Text>
    </View>
  )

  if (error) return (
    <View style={st.center}>
      <Text style={st.errorText}>{error}</Text>
    </View>
  )

  const donutSlices = byChain.map(c => ({ color: c.color, pct: c.pct, label: c.chain }))

  return (
    <ScrollView style={st.scroll} contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>

      {/* Total value */}
      <View style={st.totalCard}>
        <Text style={st.totalLabel}>Total portfolio value</Text>
        <Text style={st.totalValue}>{fmtUSD(totalUSD)}</Text>
        <Text style={st.chainCount}>{byChain.length} chain{byChain.length !== 1 ? 's' : ''} · {tokens.length} assets</Text>
      </View>

      {/* Donut + chain breakdown side by side */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>By chain</Text>
        <View style={st.row}>
          <DonutChart slices={donutSlices} size={160} />
          <View style={st.chainList}>
            {byChain.map((c, i) => (
              <View key={i} style={st.chainRow}>
                <View style={[st.dot, { backgroundColor: c.color }]} />
                <Text style={st.chainName}>{c.chain}</Text>
                <View style={st.barWrap}>
                  <View style={[st.bar, { width: `${c.pct}%`, backgroundColor: c.color + 'CC' }]} />
                </View>
                <Text style={st.chainPct}>{c.pct.toFixed(1)}%</Text>
                <Text style={st.chainVal}>{fmtUSD(c.valueUSD)}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Token allocation list */}
      <View style={st.section}>
        <Text style={st.sectionTitle}>Token allocation</Text>
        {tokens.map((t, i) => (
          <View key={i} style={st.tokenRow}>
            <View style={[st.tokenDot, { backgroundColor: t.chainColor + '22' }]}>
              <Text style={[st.tokenDotTxt, { color: t.chainColor }]}>{t.symbol.slice(0, 2)}</Text>
            </View>
            <View style={st.tokenMid}>
              <Text style={st.tokenName}>{t.symbol}</Text>
              <Text style={st.tokenSub}>{t.name} · {t.chain}</Text>
              <View style={st.allocBarWrap}>
                <View style={[st.allocBar, { width: `${t.pct}%`, backgroundColor: t.chainColor }]} />
              </View>
            </View>
            <View style={st.tokenRight}>
              <Text style={st.tokenValue}>{fmtUSD(t.valueUSD)}</Text>
              <Text style={st.tokenPct}>{t.pct.toFixed(1)}%</Text>
            </View>
          </View>
        ))}
      </View>

    </ScrollView>
  )
}

const st = StyleSheet.create({
  scroll:       { flex: 1, backgroundColor: '#F8FAFF' },
  content:      { padding: 16, paddingBottom: 40 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText:     { fontSize: 14, color: '#94A3B8' },
  errorText:    { fontSize: 14, color: '#EF4444', textAlign: 'center', padding: 20 },
  totalCard:    { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 0.5, borderColor: '#E2E8F0' },
  totalLabel:   { fontSize: 13, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue:   { fontSize: 36, fontWeight: '800', color: '#1E1B4B', letterSpacing: -1, marginTop: 4 },
  chainCount:   { fontSize: 13, color: '#94A3B8', marginTop: 4 },
  section:      { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: '#E2E8F0' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#1E1B4B', marginBottom: 14 },
  row:          { flexDirection: 'row', alignItems: 'center', gap: 16 },
  chainList:    { flex: 1, gap: 10 },
  chainRow:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:          { width: 8, height: 8, borderRadius: 4 },
  chainName:    { fontSize: 12, fontWeight: '600', color: '#1E1B4B', width: 52 },
  barWrap:      { flex: 1, height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' },
  bar:          { height: 6, borderRadius: 3 },
  chainPct:     { fontSize: 11, color: '#94A3B8', width: 36, textAlign: 'right' },
  chainVal:     { fontSize: 11, color: '#64748B', width: 52, textAlign: 'right' },
  tokenRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: '#F1F5F9' },
  tokenDot:     { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  tokenDotTxt:  { fontSize: 13, fontWeight: '800' },
  tokenMid:     { flex: 1, gap: 2 },
  tokenName:    { fontSize: 14, fontWeight: '700', color: '#1E1B4B' },
  tokenSub:     { fontSize: 12, color: '#94A3B8' },
  allocBarWrap: { height: 3, backgroundColor: '#F1F5F9', borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  allocBar:     { height: 3, borderRadius: 2 },
  tokenRight:   { alignItems: 'flex-end', gap: 2 },
  tokenValue:   { fontSize: 14, fontWeight: '700', color: '#1E1B4B' },
  tokenPct:     { fontSize: 12, color: '#94A3B8' },
})
'@ | Set-Content app\portfolio.tsx -Encoding UTF8