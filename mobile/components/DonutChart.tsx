import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Path, Circle } from 'react-native-svg'

interface Slice { color: string; pct: number; label: string }

function polarToXY(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function slicePath(cx: number, cy: number, r: number, start: number, end: number): string {
  const gap = 1.5
  const s = start + gap / 2
  const e = end - gap / 2
  const p1 = polarToXY(cx, cy, r, s)
  const p2 = polarToXY(cx, cy, r, e)
  const large = e - s > 180 ? 1 : 0
  return 'M' + cx + ',' + cy + ' L' + p1.x + ',' + p1.y + ' A' + r + ',' + r + ' 0 ' + large + ',1 ' + p2.x + ',' + p2.y + ' Z'
}

interface Props { slices: Slice[]; size?: number; innerRatio?: number }

export default function DonutChart({ slices, size = 180, innerRatio = 0.58 }: Props) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 6

  const paths = useMemo(() => {
    let cursor = 0
    return slices.map(s => {
      const sweep = (s.pct / 100) * 360
      const path = slicePath(cx, cy, r, cursor, cursor + sweep)
      cursor += sweep
      return { ...s, path }
    })
  }, [slices, cx, cy, r])

  const topSlice = slices[0]

  return (
    <View style={[st.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {paths.map((p, i) => (
          <Path key={i} d={p.path} fill={p.color} opacity={0.92} />
        ))}
        <Circle cx={cx} cy={cy} r={r * innerRatio} fill='white' />
      </Svg>
      {topSlice && (
        <View style={st.center} pointerEvents='none'>
          <Text style={[st.pct, { color: topSlice.color }]}>
            {topSlice.pct.toFixed(1)}%
          </Text>
          <Text style={st.label} numberOfLines={1}>{topSlice.label}</Text>
        </View>
      )}
    </View>
  )
}

const st = StyleSheet.create({
  wrap:   { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center', width: '58%' },
  pct:    { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  label:  { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
})
