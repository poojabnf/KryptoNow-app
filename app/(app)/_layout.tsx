import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const ACCENT = "#00D4AA";

export default function AppLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: ACCENT,
      tabBarInactiveTintColor: "#64748B",
      tabBarStyle: {
        backgroundColor: "#0A2424",
        borderTopColor: "#1a3a3a",
        borderTopWidth: 1,
        paddingBottom: Platform.OS === "ios" ? 20 : 8,
        paddingTop: 8,
        height: Platform.OS === "ios" ? 82 : 62,
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
    }}>
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="portfolio" options={{ title: "Portfolio", tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="swap"      options={{ title: "Swap",      tabBarIcon: ({ color, size }) => <Ionicons name="repeat-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="history"   options={{ title: "Activity",  tabBarIcon: ({ color, size }) => <Ionicons name="receipt-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="settings"  options={{ title: "Settings",  tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} /> }} />
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
  );
}
