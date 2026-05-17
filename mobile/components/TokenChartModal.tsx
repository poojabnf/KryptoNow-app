import { useRef, useEffect, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, Modal, StyleSheet,
  Animated, ActivityIndicator, Dimensions,
} from 'react-native'
import { WebView } from 'react-native-webview'
import { usePriceChart, Range } from '../hooks/usePriceChart'
import { COINGECKO_IDS } from '../constants/coinGeckoIdMap'

const { width: SCREEN_W } = Dimensions.get('window')
const CHART_H = 220

interface Props {
  symbol: string
  name: string
  chainColor: string
  onClose: () => void
}

const RANGES: Range[] = ['1', '7', '30', '90']
const RANGE_LABELS: Record<Range, string> = { '1':'1D', '7':'7D', '30':'30D', '90':'90D' }

function buildChartHtml(data: { time: number; value: number }[], color: string): string {
  const json = JSON.stringify(data)
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>* { margin:0;padding:0;box-sizing:border-box; } html,body { background:transparent; width:100%; height:${CHART_H}px; overflow:hidden; } #chart { width:100%;height:${CHART_H}px; }</style>
</head>
<body>
<div id="chart"></div>
<script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"></script>
<script>
  const chart = LightweightCharts.createChart(document.getElementById('chart'), {
    width: window.innerWidth, height: ${CHART_H},
    layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#94A3B8' },
    grid: { vertLines: { visible: false }, horzLines: { color: 'rgba(148,163,184,0.12)' } },
    crosshair: { mode: 1 },
    rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.1, bottom: 0.1 } },
    timeScale: { borderVisible: false, timeVisible: true, fixLeftEdge: true, fixRightEdge: true },
    handleScroll: false, handleScale: false,
  });
  const series = chart.addAreaSeries({
    lineColor: '${color}', topColor: '${color}40', bottomColor: '${color}08',
    lineWidth: 2, priceLineVisible: false,
    crosshairMarkerVisible: true, crosshairMarkerRadius: 5,
    crosshairMarkerBorderColor: '#fff', crosshairMarkerBackgroundColor: '${color}',
  });
  series.setData(${json});
  chart.timeScale().fitContent();
  window.addEventListener('resize', () => { chart.applyOptions({ width: window.innerWidth }); chart.timeScale().fitContent(); });
</script>
</body>
</html>`
}

export default function TokenChartModal({ symbol, name, chainColor, onClose }: Props) {
  const [range, setRange] = useState<Range>('7')
  const coinId = COINGECKO_IDS[symbol.toUpperCase()] ?? symbol.toLowerCase()
  const { data, loading, error } = usePriceChart(coinId, range)
  const slide = useRef(new Animated.Value(600)).current

  useEffect(() => {
    Animated.spring(slide, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start()
  }, [])

  const handleClose = useCallback(() => {
    Animated.timing(slide, { toValue: 600, duration: 220, useNativeDriver: true }).start(onClose)
  }, [onClose])

  const currentPrice = data.length > 0 ? data[data.length - 1].value : null
  const openPrice    = data.length > 0 ? data[0].value : null
  const pctChange    = currentPrice && openPrice && openPrice !== 0
    ? ((currentPrice - openPrice) / openPrice) * 100 : null
  const isPositive   = pctChange !== null && pctChange >= 0
  const high = data.length > 0 ? Math.max(...data.map(d => d.value)) : null
  const low  = data.length > 0 ? Math.min(...data.map(d => d.value)) : null

  const fmtPrice = (n: number) =>
    n < 0.01 ? `$${n.toFixed(6)}`
    : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const chartHtml = data.length > 0 ? buildChartHtml(data, chainColor) : null

  return (
    <Modal transparent visible animationType="none" onRequestClose={handleClose}>
      <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={handleClose} />
      <Animated.View style={[st.sheet, { transform: [{ translateY: slide }] }]}>
        <View style={st.handle} />
        <View style={st.headerRow}>
          <View style={[st.tokenDot, { backgroundColor: chainColor + '22' }]}>
            <Text style={[st.tokenDotText, { color: chainColor }]}>{symbol.slice(0, 2)}</Text>
          </View>
          <View style={st.headerMid}>
            <Text style={st.tokenName}>{name}</Text>
            <Text style={st.tokenSymbol}>{symbol}</Text>
          </View>
          <TouchableOpacity style={st.closeBtn} onPress={handleClose} activeOpacity={0.7}>
            <Text style={st.closeBtnText}></Text>
          </TouchableOpacity>
        </View>
        <View style={st.priceRow}>
          {loading ? (
            <ActivityIndicator color={chainColor} style={{ marginVertical: 8 }} />
          ) : currentPrice ? (
            <>
              <Text style={st.price}>{fmtPrice(currentPrice)}</Text>
              {pctChange !== null && (
                <View style={[st.changePill, { backgroundColor: isPositive ? '#D1FAE5' : '#FEE2E2' }]}>
                  <Text style={[st.changeText, { color: isPositive ? '#059669' : '#DC2626' }]}>
                    {isPositive ? '+' : ''}{pctChange.toFixed(2)}%
                  </Text>
                </View>
              )}
            </>
          ) : error ? (
            <Text style={st.errorText}>{error}</Text>
          ) : null}
        </View>
        <View style={st.tabs}>
          {RANGES.map(r => (
            <TouchableOpacity
              key={r}
              style={[st.tab, r === range && { backgroundColor: chainColor, borderColor: chainColor }]}
              onPress={() => setRange(r)}
              activeOpacity={0.75}
            >
              <Text style={[st.tabText, r === range && { color: '#fff' }]}>{RANGE_LABELS[r]}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[st.chartWrap, { height: CHART_H }]}>
          {loading && (
            <View style={st.chartLoader}>
              <ActivityIndicator color={chainColor} size="large" />
              <Text style={st.chartLoaderText}>Loading chart...</Text>
            </View>
          )}
          {!loading && error && (
            <View style={st.chartLoader}>
              <Text style={st.errorText}>Unable to load chart data</Text>
            </View>
          )}
          {!loading && !error && chartHtml && (
            <WebView
              source={{ html: chartHtml }}
              style={{ width: SCREEN_W - 32, height: CHART_H, backgroundColor: 'transparent' }}
              scrollEnabled={false}
              bounces={false}
              originWhitelist={['*']}
              javaScriptEnabled
            />
          )}
        </View>
        {!loading && !error && high !== null && low !== null && (
          <View style={st.statsRow}>
            <View style={st.statBox}>
              <Text style={st.statLabel}>{RANGE_LABELS[range]} High</Text>
              <Text style={[st.statValue, { color: '#10B981' }]}>{fmtPrice(high)}</Text>
            </View>
            <View style={[st.statDivider, { backgroundColor: chainColor + '30' }]} />
            <View style={st.statBox}>
              <Text style={st.statLabel}>{RANGE_LABELS[range]} Low</Text>
              <Text style={[st.statValue, { color: '#EF4444' }]}>{fmtPrice(low)}</Text>
            </View>
            <View style={[st.statDivider, { backgroundColor: chainColor + '30' }]} />
            <View style={st.statBox}>
              <Text style={st.statLabel}>Open</Text>
              <Text style={st.statValue}>{openPrice ? fmtPrice(openPrice) : '--'}</Text>
            </View>
          </View>
        )}
      </Animated.View>
    </Modal>
  )
}

const st = StyleSheet.create({
  backdrop:        { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.55)' },
  sheet:           { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 40 },
  handle:          { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 20 },
  headerRow:       { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  tokenDot:        { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  tokenDotText:    { fontSize: 14, fontWeight: '800' },
  headerMid:       { flex: 1 },
  tokenName:       { fontSize: 16, fontWeight: '700', color: '#1E1B4B' },
  tokenSymbol:     { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  closeBtn:        { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  closeBtnText:    { fontSize: 14, color: '#64748B' },
  priceRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16, minHeight: 40 },
  price:           { fontSize: 28, fontWeight: '800', color: '#1E1B4B', letterSpacing: -0.5 },
  changePill:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  changeText:      { fontSize: 13, fontWeight: '700' },
  errorText:       { fontSize: 13, color: '#EF4444', textAlign: 'center' },
  tabs:            { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab:             { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFF' },
  tabText:         { fontSize: 13, fontWeight: '600', color: '#64748B' },
  chartWrap:       { borderRadius: 16, overflow: 'hidden', backgroundColor: '#F8FAFF', marginBottom: 16 },
  chartLoader:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  chartLoaderText: { fontSize: 13, color: '#94A3B8' },
  statsRow:        { flexDirection: 'row', backgroundColor: '#F8FAFF', borderRadius: 16, padding: 16 },
  statBox:         { flex: 1, alignItems: 'center' },
  statLabel:       { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  statValue:       { fontSize: 13, fontWeight: '700', color: '#1E1B4B' },
  statDivider:     { width: 1, marginHorizontal: 8 },
})
