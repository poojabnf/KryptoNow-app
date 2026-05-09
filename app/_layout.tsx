/**
 * app/(app)/_layout.tsx
 * ----------------------
 * UI fix: adds persistent bottom tab bar for main app screens.
 * Replaces the old router.replace() pattern with proper tab navigation.
 */
import { Tabs } from 'expo-router'
import { useAuth } from '@clerk/expo'
import { Redirect } from 'expo-router'
import { ActivityIndicator, View, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'

const TEAL  = '#0D2E2E'
const ACCENT = '#00D4AA'

type IoniconsName = React.ComponentProps<typeof Ionicons>['name']

function TabIcon({ name, color, size }: { name: IoniconsName; color: string; size: number }) {
  return <Ionicons name={name} size={size} color={color} />
}

export default function AppLayout() {
  const { isLoaded, isSignedIn } = useAuth()

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: TEAL }}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    )
  }

  if (!isSignedIn) return <Redirect href="/(auth)/sign-in" />

  return (
    <Tabs
      screenOptions={{
        headerShown:     false,
        tabBarActiveTintColor:   ACCENT,
        tabBarInactiveTintColor: '#64748B',
        tabBarStyle: {
          backgroundColor: '#0A2424',
          borderTopColor:  '#1a3a3a',
          borderTopWidth:  1,
          paddingBottom:   Platform.OS === 'ios' ? 20 : 8,
          paddingTop:      8,
          height:          Platform.OS === 'ios' ? 82 : 62,
        },
        tabBarLabelStyle: {
          fontSize:   11,
          fontWeight: '600',
          marginTop:  2,
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title:    'Home',
          tabBarIcon: ({ color, size }) => <TabIcon name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title:    'Portfolio',
          tabBarIcon: ({ color, size }) => <TabIcon name="pie-chart-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="swap"
        options={{
          title:    'Swap',
          tabBarIcon: ({ color, size }) => <TabIcon name="repeat-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title:    'Activity',
          tabBarIcon: ({ color, size }) => <TabIcon name="receipt-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title:    'Settings',
          tabBarIcon: ({ color, size }) => <TabIcon name="settings-outline" color={color} size={size} />,
        }}
      />

      {/* Hide these from tab bar — accessed via buttons inside screens */}
      <Tabs.Screen name="send"          options={{ href: null }} />
      <Tabs.Screen name="receive"       options={{ href: null }} />
      <Tabs.Screen name="buy"           options={{ href: null }} />
      <Tabs.Screen name="earn"          options={{ href: null }} />
      <Tabs.Screen name="nfts"          options={{ href: null }} />
      <Tabs.Screen name="addressbook"   options={{ href: null }} />
      <Tabs.Screen name="analytics"     options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="premium"       options={{ href: null }} />
      <Tabs.Screen name="walletconnect" options={{ href: null }} />
    </Tabs>
  )
}
