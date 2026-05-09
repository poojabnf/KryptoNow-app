import React from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { router } from "expo-router";

export default function Settings() {
  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={s.backText}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.content}>
        
        {/* Network Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Network</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={s.rowLeft}>
                <Text style={s.rowTitle}>Active RPC</Text>
                <Text style={s.rowSub}>Mainnet</Text>
              </View>
              <TouchableOpacity>
                <Text style={s.actionText}>Change</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Security Section */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Security</Text>
          <View style={s.card}>
            <View style={s.row}>
              <View style={s.rowLeft}>
                <Text style={s.rowTitle}>Reveal Seed Phrase</Text>
                <Text style={s.rowSub}>Requires confirmation</Text>
              </View>
              <TouchableOpacity style={s.dangerBtn}>
                <Text style={s.dangerText}>Reveal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EEF2FF" },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 16, color: "#6366F1", fontWeight: "800" },
  title: { color: "#0F172A", fontSize: 18, fontWeight: "800" },
  content: { padding: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { color: "#64748B", fontSize: 13, fontWeight: "700", textTransform: "uppercase", marginBottom: 8, paddingLeft: 4 },
  card: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
  rowLeft: { flex: 1 },
  rowTitle: { color: "#0F172A", fontSize: 15, fontWeight: "600", marginBottom: 2 },
  rowSub: { color: "#64748B", fontSize: 13 },
  actionText: { color: "#6366F1", fontSize: 14, fontWeight: "700" },
  dangerBtn: { backgroundColor: "#FEF2F2", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  dangerText: { color: "#EF4444", fontSize: 14, fontWeight: "700" },
});
