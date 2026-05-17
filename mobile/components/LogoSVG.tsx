import React, { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import Svg, {
  Defs, LinearGradient, Stop, Filter,
  FeGaussianBlur, FeMerge, FeMergeNode,
  Polygon, Line, Circle, G,
} from 'react-native-svg'

type Props = { size?: number }

const NODES = [
  { cx: 100, cy:  15, r: 7,   fill: '#C084FC' },
  { cx:  25, cy:  65, r: 6,   fill: '#818CF8' },
  { cx: 175, cy:  65, r: 6,   fill: '#F0ABFC' },
  { cx:  15, cy: 135, r: 8,   fill: '#6366F1' },
  { cx: 185, cy: 135, r: 8,   fill: '#A78BFA' },
  { cx:  60, cy: 190, r: 6,   fill: '#818CF8' },
  { cx: 140, cy: 190, r: 6,   fill: '#C084FC' },
  { cx: 100, cy: 208, r: 9.5, fill: '#7C3AED' },
]

const EDGES: [number, number][] = [
  [0,1],[0,2],[1,2],
  [1,3],[2,4],[1,4],[2,3],
  [3,5],[4,6],[3,6],[4,5],
  [5,7],[6,7],[5,6],
  [0,3],[0,4],[3,4],
]

export default function LogoSVG({ size = 260 }: Props) {
  const float = useRef(new Animated.Value(0)).current
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: -10, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(float, { toValue: 0,   duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start()
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start()
  }, [])

  return (
    <Animated.View style={{ transform: [{ translateY: float }, { scale: pulse }] }}>
      <Svg width={size} height={size * 215 / 200} viewBox="0 0 200 215">
        <Defs>
          <LinearGradient id="gFL" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#4338CA" />
            <Stop offset="100%" stopColor="#5B52E0" />
          </LinearGradient>
          <LinearGradient id="gIL" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#5B52E8" />
            <Stop offset="100%" stopColor="#818CF8" />
          </LinearGradient>
          <LinearGradient id="gIR" x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#6366F1" />
            <Stop offset="100%" stopColor="#A78BFA" />
          </LinearGradient>
          <LinearGradient id="gFR" x1="1" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#818CF8" />
            <Stop offset="100%" stopColor="#C084FC" />
          </LinearGradient>
          <LinearGradient id="gTop" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="rgba(255,255,255,0.72)" />
            <Stop offset="100%" stopColor="rgba(167,139,250,0.45)" />
          </LinearGradient>
          <Filter id="ng" x="-80%" y="-80%" width="260%" height="260%">
            <FeGaussianBlur stdDeviation="2.5" result="blur" />
            <FeMerge>
              <FeMergeNode in="blur" />
              <FeMergeNode in="SourceGraphic" />
            </FeMerge>
          </Filter>
          <Filter id="vshadow" x="-20%" y="-10%" width="140%" height="130%">
            <FeGaussianBlur stdDeviation="6" result="blur" />
            <FeMerge>
              <FeMergeNode in="blur" />
              <FeMergeNode in="SourceGraphic" />
            </FeMerge>
          </Filter>
        </Defs>

        <G opacity={0.9}>
          {EDGES.map(([ai, bi], i) => (
            <Line
              key={i}
              x1={NODES[ai].cx} y1={NODES[ai].cy}
              x2={NODES[bi].cx} y2={NODES[bi].cy}
              stroke="rgba(99,102,241,0.28)"
              strokeWidth={1.2}
            />
          ))}
          <Line x1={100} y1={15}  x2={15}  y2={135} stroke="rgba(99,102,241,0.1)" strokeWidth={1} />
          <Line x1={100} y1={15}  x2={185} y2={135} stroke="rgba(99,102,241,0.1)" strokeWidth={1} />
          <Line x1={25}  y1={65}  x2={185} y2={135} stroke="rgba(99,102,241,0.1)" strokeWidth={1} />
          <Line x1={175} y1={65}  x2={15}  y2={135} stroke="rgba(99,102,241,0.1)" strokeWidth={1} />
        </G>

        <G filter="url(#vshadow)">
          <Polygon points="38,52 72,52 100,172" fill="url(#gFL)" opacity={0.97} />
          <Polygon points="72,52 100,122 100,172" fill="url(#gIL)" opacity={0.92} />
          <Polygon points="100,122 128,52 100,172" fill="url(#gIR)" opacity={0.92} />
          <Polygon points="128,52 162,52 100,172" fill="url(#gFR)" opacity={0.97} />
          <Polygon points="38,52 72,52 100,72 128,52 162,52 100,48" fill="url(#gTop)" opacity={0.85} />
        </G>

        <Line x1={38}  y1={52} x2={100} y2={172} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
        <Line x1={162} y1={52} x2={100} y2={172} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
        <Line x1={38}  y1={52} x2={162} y2={52}  stroke="rgba(255,255,255,0.55)" strokeWidth={1.8} />
        <Line x1={100} y1={48} x2={100} y2={172} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />

        {NODES.map((n, i) => (
          <G key={i} filter="url(#ng)">
            <Circle cx={n.cx} cy={n.cy} r={n.r} fill={n.fill} opacity={0.95} />
            <Circle cx={n.cx} cy={n.cy} r={n.r * 0.42} fill="rgba(255,255,255,0.72)" />
          </G>
        ))}
      </Svg>
    </Animated.View>
  )
}