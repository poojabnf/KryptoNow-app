import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { goBack } from '../utils/navigation'
import { useWalletStore } from '../store/walletStore'
import { getConnectedDApps, disconnectDApp, DAppSession } from '../utils/eip1193'

export default function ConnectedDApps() {
  const activeChain = useWalletStore(s => s.activeChain)
  const [dapps, setDapps] = useState<DAppSession[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(() => {
    setDapps(getConnectedDApps())
  }, [])

  useEffect(() => { load() }, [])

  const onRefresh = () => {
    setRefreshing(true)
    load()
    setRefreshing(false)
  }

  const handleDisconnect = (origin: string) => {
    disconnectDApp(origin)
    load()
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={s.title}>Connected dApps</Text>
      </View>

      {/* Info banner */}
      <View style={[s.banner, { backgroundColor: activeChain.color + '15', borderColor: activeChain.color + '33' }]}>
        <Ionicons name="shield-checkmark-outline" size={20} color={activeChain.color} />
        <Text style={[s.bannerText, { color: activeChain.color }]}>
          These dApps can request transactions. You always approve before anything is signed.
        </Text>
      </View>

      {/* dApps list */}
      {dapps.length === 0 ? (
        <View style={s.emptyBox}>
          <Ionicons name="globe-outline" size={48} color="#CBD5E1" />
          <Text style={s.emptyTitle}>No dApps Connected</Text>
          <Text style={s.emptySub}>Visit a dApp like Uniswap or OpenSea and connect your wallet to see it here.</Text>
          <TouchableOpacity
            style={[s.exploreBtn, { backgroundColor: activeChain.color }]}
            onPress={() => router.push('/swap' as any)}
          >
            <Text style={s.exploreBtnText}>Explore dApps</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={s.sectionTitle}>{dapps.length} Connected App{dapps.length > 1 ? 's' : ''}</Text>
          {dapps.map((dapp, i) => (
            <View key={i} style={s.card}>
              <View style={s.cardLeft}>
                <Image
                  source={{ uri: dapp.icon }}
                  style={s.dappIcon}
                  defaultSource={{ uri: 'https://via.placeholder.com/40' }}
                />
                <View style={s.dappInfo}>
                  <Text style={s.dappName} numberOfLines={1}>{dapp.name}</Text>
                  <Text style={s.dappOrigin} numberOfLines={1}>{dapp.origin}</Text>
                  <Text style={s.dappDate}>Connected {formatDate(dapp.connectedAt)}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={s.disconnectBtn}
                onPress={() => handleDisconnect(dapp.origin)}
              >
                <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                <Text style={s.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Disconnect all */}
          <TouchableOpacity
            style={s.disconnectAllBtn}
            onPress={() => { dapps.forEach(d => disconnectDApp(d.origin)); load() }}
          >
            <Ionicons name="power-outline" size={16} color="#EF4444" />
            <Text style={s.disconnectAllText}>Disconnect All</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#F8FAFC' },
  content:         { padding: 16, paddingBottom: 40 },
  header:          { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  backBtn:         { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  title:           { fontSize: 22, fontWeight: '800', color: '#1E1B4B' },
  banner:          { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 20 },
  bannerText:      { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
  emptyBox:        { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle:      { fontSize: 18, fontWeight: '700', color: '#1E1B4B' },
  emptySub:        { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  exploreBtn:      { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  exploreBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  sectionTitle:    { fontSize: 13, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  card:            { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#F1F5F9' },
  cardLeft:        { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  dappIcon:        { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9' },
  dappInfo:        { flex: 1 },
  dappName:        { fontSize: 15, fontWeight: '700', color: '#1E1B4B' },
  dappOrigin:      { fontSize: 12, color: '#64748B', marginTop: 2 },
  dappDate:        { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  disconnectBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 8, borderRadius: 10, backgroundColor: '#FEF2F2' },
  disconnectText:  { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  disconnectAllBtn:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FFF1F2' },
  disconnectAllText:{ color: '#EF4444', fontWeight: '700', fontSize: 14 },
})