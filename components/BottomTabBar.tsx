import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, usePathname } from 'expo-router'
import { useWalletStore } from '../store/walletStore'

type Tab = {
  label:    string
  icon:     string
  iconSel:  string
  route:    string
}

const TABS: Tab[] = [
  { label: 'Home',     icon: 'home-outline',           iconSel: 'home',            route: '/dashboard'  },
  { label: 'Swap',     icon: 'swap-horizontal-outline', iconSel: 'swap-horizontal', route: '/swap'       },
  { label: 'Buy',      icon: 'add-circle-outline',      iconSel: 'add-circle',      route: '/buy'        },
  { label: 'History',  icon: 'time-outline',            iconSel: 'time',            route: '/history'    },
  { label: 'More',     icon: 'grid-outline',            iconSel: 'grid',            route: '__more__'    },
]

type Props = {
  onOpenDrawer: () => void
}

export default function BottomTabBar({ onOpenDrawer }: Props) {
  const insets      = useSafeAreaInsets()
  const pathname    = usePathname()
  const activeChain = useWalletStore(s => s.activeChain)
  const color       = activeChain.color

  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 4)

  return (
    <View style={[st.wrap, { paddingBottom: bottomPad }]}>
      {/* Frosted top border */}
      <View style={st.topLine} />

      <View style={st.row}>
        {TABS.map(tab => {
          const isActive = tab.route !== '__more__'
            ? pathname === tab.route || (tab.route !== '/dashboard' && pathname.startsWith(tab.route))
            : false

          function handlePress() {
            if (tab.route === '__more__') { onOpenDrawer(); return }
            router.push(tab.route as any)
          }

          return (
            <TouchableOpacity
              key={tab.label}
              style={st.tab}
              onPress={handlePress}
              activeOpacity={0.7}
            >
              {/* Active indicator pill */}
              {isActive && (
                <View style={[st.activePill, { backgroundColor: color + '18' }]} />
              )}

              <View style={[st.iconWrap, isActive && { backgroundColor: color + '15' }]}>
                <Ionicons
                  name={(isActive ? tab.iconSel : tab.icon) as any}
                  size={22}
                  color={isActive ? color : '#94A3B8'}
                />
              </View>
              <Text style={[st.label, { color: isActive ? color : '#94A3B8' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

const st = StyleSheet.create({
  wrap: {
    backgroundColor:  '#FFFFFF',
    shadowColor:      '#64748B',
    shadowOffset:     { width: 0, height: -4 },
    shadowOpacity:    0.08,
    shadowRadius:     16,
    elevation:        16,
  },
  topLine: {
    height:          1,
    backgroundColor: '#F1F5F9',
  },
  row: {
    flexDirection:   'row',
    paddingHorizontal:8,
    paddingTop:      10,
  },
  tab: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 4,
    position:        'relative',
  },
  activePill: {
    position:        'absolute',
    top:             0,
    left:            8,
    right:           8,
    bottom:          0,
    borderRadius:    14,
  },
  iconWrap: {
    width:           40,
    height:          32,
    borderRadius:    12,
    alignItems:      'center',
    justifyContent:  'center',
  },
  label: {
    fontSize:        10,
    fontWeight:      '600',
    marginTop:       3,
    letterSpacing:   0.2,
  },
})
