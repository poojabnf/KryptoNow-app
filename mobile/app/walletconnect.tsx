import { useState, useEffect } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { ethers } from 'ethers'
import { getProvider } from '../utils/chains'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform, ScrollView, TextInput } from 'react-native'
import { router } from 'expo-router'
import { goBack } from '../utils/navigation'
import { useWalletStore } from '../store/walletStore'
import { loadPrivateKey } from '../store/keyStore'

const WC_PROJECT_ID = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID ?? '840ef497a12aaf23a2e31c1c4013d68d'
const SUPPORTED_CHAINS  = ['eip155:1','eip155:137','eip155:42161','eip155:10','eip155:56']
const SUPPORTED_METHODS = ['eth_sendTransaction','eth_sign','personal_sign','eth_signTypedData_v4']
const SUPPORTED_EVENTS  = ['chainChanged','accountsChanged']

type WCSession = { topic: string; name: string; url: string }
type WCRequest  = { id: number; topic: string; method: string; params: any; origin: string }
let walletkit: any = null


// --- Web-compatible scan/paste tab -------------------------------------------
function WCScanTab({ onScan, onStartScan, connecting }: {
  onScan: (uri: string) => void
  onStartScan: () => void
  connecting: boolean
}) {
  const [uri, setUri] = useState('')
  const isWeb = Platform.OS === 'web'

  return (
    <View style={{ flex: 1, padding: 24 }}>
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Ionicons name="qr-code-outline" size={40} color="#6366F1" />
        </View>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#1E1B4B', marginBottom: 8, textAlign: 'center' }}>Connect to a dApp</Text>
        <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 }}>
          {isWeb
            ? 'Paste a WalletConnect URI from any dApp'
            : 'Scan a WalletConnect QR code from any dApp'}
        </Text>
      </View>

      {!isWeb && (
        <TouchableOpacity
          style={{ backgroundColor: '#6366F1', paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginBottom: 16 }}
          onPress={onStartScan}
          disabled={connecting}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="scan-outline" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Scan QR Code</Text>
          </View>
        </TouchableOpacity>
      )}

      <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', padding: 16, marginBottom: 12 }}>
        <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {isWeb ? 'Paste URI' : 'Or paste URI'}
        </Text>
        <TextInput
          style={{ fontSize: 13, color: '#1E1B4B', minHeight: 60, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}
          value={uri}
          onChangeText={setUri}
          placeholder="wc:..."
          placeholderTextColor="#CBD5E1"
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <TouchableOpacity
        style={[{ backgroundColor: '#6366F1', paddingVertical: 16, borderRadius: 16, alignItems: 'center' }, (!uri.trim().startsWith('wc:') || connecting) && { opacity: 0.4 }]}
        onPress={() => { if (uri.trim().startsWith('wc:')) { onScan(uri.trim()); setUri('') } }}
        disabled={!uri.trim().startsWith('wc:') || connecting}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name="link-outline" size={18} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Connect</Text>
        </View>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 20, padding: 14, backgroundColor: '#FFFBEB', borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A' }}>
        <Ionicons name="information-circle-outline" size={18} color="#92400E" />
        <Text style={{ flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 }}>
          Only connect to dApps you trust. KryptoNow will never ask for your seed phrase.
        </Text>
      </View>
    </View>
  )
}

export default function WalletConnectScreen() {
  const addr        = useWalletStore(s => s.address)
  const activeChain = useWalletStore(s => s.activeChain)
  const [tab,        setTab]        = useState<'scan'|'sessions'>('scan')
  const [sessions,   setSessions]   = useState<WCSession[]>([])
  const [pendingReq, setPendingReq] = useState<WCRequest|null>(null)
  const [connecting, setConnecting] = useState(false)
  const [signing,    setSigning]    = useState(false)
  const [initError,  setInitError]  = useState('')
  const [wcReady,    setWcReady]    = useState(false)
  const [scanning,   setScanning]   = useState(false)

  useEffect(() => { initWC() }, [])

  async function initWC() {
    try {
      const { Core }                  = await import('@walletconnect/core')
      const { WalletKit }             = await import('@reown/walletkit')
      const { buildApprovedNamespaces } = await import('@walletconnect/utils')
      walletkit = await WalletKit.init({ core: new Core({ projectId: WC_PROJECT_ID }), metadata: { name:'Kryptonow',description:'Your vault. Your rules.',url:'https://Kryptonow.io',icons:[] } })
      setWcReady(true)
      refreshSessions()
      walletkit.on('session_proposal', async ({ id, params }: any) => {
        setConnecting(true)
        try {
          const ns = buildApprovedNamespaces({ proposal: params, supportedNamespaces: { eip155: { chains: SUPPORTED_CHAINS, methods: SUPPORTED_METHODS, events: SUPPORTED_EVENTS, accounts: SUPPORTED_CHAINS.map(c => `${c}:${addr}`) } } })
          await walletkit.approveSession({ id, namespaces: ns })
          refreshSessions(); setTab('sessions')
          Alert.alert('Connected!', `${params.proposer.metadata.name} connected.`)
        } catch { const { getSdkError } = await import('@walletconnect/utils'); await walletkit.rejectSession({ id, reason: getSdkError('USER_REJECTED') }) }
        finally { setConnecting(false); setScanning(false) }
      })
      walletkit.on('session_request', async ({ id, topic, params }: any) => {
        const s = walletkit.getActiveSessions()[topic]
        setPendingReq({ id, topic, method: params.request.method, params: params.request.params, origin: s?.peer.metadata.name ?? topic })
      })
      walletkit.on('session_delete', refreshSessions)
    } catch (e: any) { setInitError(e.message) }
  }

  function refreshSessions() {
    if (!walletkit) return
    setSessions(Object.values(walletkit.getActiveSessions()).map((s: any) => ({ topic: s.topic, name: s.peer.metadata.name, url: s.peer.metadata.url })))
  }

  async function startScan() {
    if (Platform.OS === 'web') { Alert.alert('Not supported','QR scanning unavailable on web'); return }
    const { Camera } = await import('expo-camera')
    const { status } = await Camera.requestCameraPermissionsAsync()
    if (status === 'granted') setScanning(true)
    else Alert.alert('Permission needed','Camera access required')
  }

  async function handleQRScan(data: string) {
    if (!data.startsWith('wc:')) return
    setScanning(false); setConnecting(true)
    try { await walletkit.pair({ uri: data }) }
    catch (e: any) { setConnecting(false); Alert.alert('Failed', e.message) }
  }

  async function approveRequest() {
    if (!pendingReq) return
    setSigning(true)
    try {
      const pk = await loadPrivateKey()
      if (!pk) throw new Error('No key')
      const w = new ethers.Wallet(pk, getProvider(activeChain))
      const { method, params } = pendingReq
      let result: string
      if (method === 'personal_sign') result = await w.signMessage(params[0].startsWith('0x') ? ethers.getBytes(params[0]) : params[0])
      else if (method === 'eth_sign') result = await w.signMessage(ethers.getBytes(params[1]))
      else if (method === 'eth_signTypedData_v4') { const t = typeof params[1]==='string'?JSON.parse(params[1]):params[1]; result = await w.signTypedData(t.domain,t.types,t.message) }
      else if (method === 'eth_sendTransaction') { const r = await w.sendTransaction({ to:params[0].to, value:params[0].value?BigInt(params[0].value):0n, data:params[0].data??'0x' }); result = r.hash }
      else throw new Error(`Unsupported: ${method}`)
      await walletkit.respondSessionRequest({ topic: pendingReq.topic, response: { id: pendingReq.id, jsonrpc:'2.0', result } })
      setPendingReq(null)
    } catch (e: any) {
      await walletkit?.respondSessionRequest({ topic: pendingReq.topic, response: { id: pendingReq.id, jsonrpc:'2.0', error: { code:4001, message:e.message } } })
      Alert.alert('Failed', e.message)
    } finally { setSigning(false); setPendingReq(null) }
  }

  async function rejectRequest() {
    if (!pendingReq) return
    const { getSdkError } = await import('@walletconnect/utils')
    await walletkit?.respondSessionRequest({ topic: pendingReq.topic, response: { id: pendingReq.id, jsonrpc:'2.0', error: getSdkError('USER_REJECTED') } })
    setPendingReq(null)
  }

  async function disconnectSession(topic: string) {
    const { getSdkError } = await import('@walletconnect/utils')
    await walletkit?.disconnectSession({ topic, reason: getSdkError('USER_DISCONNECTED') })
    refreshSessions()
  }

  if (connecting) return <View style={s.c}><View style={s.center}><ActivityIndicator size="large" color="#6366F1" /><Text style={s.sub}>Connecting to dApp...</Text></View></View>

  if (scanning) {
    const CameraView = require('expo-camera').CameraView
    return <View style={{flex:1}}><CameraView style={{flex:1}} onBarcodeScanned={({data}:any)=>handleQRScan(data)} barcodeScannerSettings={{barcodeTypes:['qr']}} /><TouchableOpacity style={s.cancelBtn} onPress={()=>setScanning(false)}><Text style={s.cancelBtnT}>Cancel</Text></TouchableOpacity></View>
  }

  if (pendingReq) return (
    <View style={s.c}>
      <View style={s.hdr}><TouchableOpacity style={s.back} onPress={()=>setPendingReq(null)}><Ionicons name="arrow-back" size={22} color="#6366F1" /></TouchableOpacity><Text style={s.title}>Sign Request</Text><View style={{width:38}}/></View>
      <ScrollView style={{flex:1,padding:20}}><View style={s.card}><Text style={{color:'#6366F1',fontWeight:'700',marginBottom:4}}>{pendingReq.origin}</Text><Text style={{color:'#1E1B4B',fontSize:16,fontWeight:'600',marginBottom:12}}>{pendingReq.method}</Text><Text style={{color:'#64748B',fontSize:12,fontFamily:Platform.OS==='ios'?'Courier':'monospace'}}>{JSON.stringify(pendingReq.params,null,2)}</Text></View></ScrollView>
      <View style={s.row}><TouchableOpacity style={s.rejectBtn} onPress={rejectRequest}><Text style={s.rejectT}>Reject</Text></TouchableOpacity><TouchableOpacity style={s.approveBtn} onPress={approveRequest} disabled={signing}>{signing?<ActivityIndicator color="#fff"/>:<Text style={s.approveT}>Approve</Text>}</TouchableOpacity></View>
    </View>
  )

  return (
    <View style={s.c}>
      <View style={s.hdr}><TouchableOpacity style={s.back} onPress={()=>goBack()}><Ionicons name="arrow-back" size={22} color="#6366F1" /></TouchableOpacity><Text style={s.title}>WalletConnect</Text><View style={{width:38}}/></View>
      {initError ? <View style={s.center}><Text style={{color:'#EF4444',textAlign:'center'}}>{initError}</Text></View>
       : !wcReady ? <View style={s.center}><ActivityIndicator color="#6366F1"/><Text style={s.sub}>Initializing...</Text></View>
       : <>
          <View style={s.tabs}>{(['scan','sessions'] as const).map(t=><TouchableOpacity key={t} style={[s.tab,tab===t&&s.tabOn]} onPress={()=>setTab(t)}><Text style={[s.tabT,tab===t&&s.tabTOn]}>{t==='scan'?'Scan QR':`Sessions (${sessions.length})`}</Text></TouchableOpacity>)}</View>
          {tab==='scan'
            ? <WCScanTab onScan={handleQRScan} onStartScan={startScan} connecting={connecting} />
            : <ScrollView style={{flex:1,padding:16}}>{sessions.length===0?<View style={s.center}><Ionicons name="link-outline" size={48} color="#CBD5E1" /><Text style={[s.sub,{marginTop:12}]}>No active sessions</Text></View>:sessions.map(sess=><View key={sess.topic} style={s.sessRow}><View style={{flex:1}}><Text style={{color:'#1E1B4B',fontWeight:'600'}}>{sess.name}</Text><Text style={{color:'#94A3B8',fontSize:12}}>{sess.url}</Text></View><TouchableOpacity style={s.discBtn} onPress={()=>disconnectSession(sess.topic)}><Ionicons name="close-circle-outline" size={14} color="#EF4444" style={{marginRight:4}} /><Text style={s.discT}>Disconnect</Text></TouchableOpacity></View>)}</ScrollView>
          }
        </>
      }
    </View>
  )
}

const s = StyleSheet.create({
  c:{flex:1,backgroundColor:'#F8FAFF'}, hdr:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:20,paddingTop:60,paddingBottom:16},
  back:{width:38,height:38,borderRadius:12,backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0',alignItems:'center',justifyContent:'center'}, backT:{color:'#6366F1',fontSize:18},
  title:{color:'#1E1B4B',fontSize:17,fontWeight:'700'}, center:{flex:1,alignItems:'center',justifyContent:'center',padding:32},
  sub:{color:'#64748B',marginTop:12,fontSize:14,textAlign:'center'}, h2:{color:'#1E1B4B',fontSize:22,fontWeight:'700',marginBottom:8,textAlign:'center'},
  tabs:{flexDirection:'row',paddingHorizontal:16,gap:8,marginBottom:8},
  tab:{flex:1,paddingVertical:10,borderRadius:12,backgroundColor:'#fff',borderWidth:1.5,borderColor:'#E2E8F0',alignItems:'center'},
  tabOn:{backgroundColor:'#6366F1',borderColor:'#6366F1'}, tabT:{color:'#64748B',fontSize:13,fontWeight:'600'}, tabTOn:{color:'#fff'},
  scanBtn:{backgroundColor:'#6366F1',paddingVertical:16,paddingHorizontal:32,borderRadius:16,marginTop:8}, scanBtnT:{color:'#fff',fontSize:16,fontWeight:'600'},
  cancelBtn:{position:'absolute',bottom:40,alignSelf:'center',backgroundColor:'#1E1B4B',paddingVertical:14,paddingHorizontal:32,borderRadius:16}, cancelBtnT:{color:'#fff',fontSize:16,fontWeight:'600'},
  card:{backgroundColor:'#fff',borderRadius:16,padding:16,borderWidth:1,borderColor:'#E2E8F0'},
  row:{flexDirection:'row',padding:20,gap:12},
  rejectBtn:{flex:1,paddingVertical:16,borderRadius:14,borderWidth:1.5,borderColor:'#EF4444',alignItems:'center'}, rejectT:{color:'#EF4444',fontSize:15,fontWeight:'600'},
  approveBtn:{flex:2,paddingVertical:16,borderRadius:14,backgroundColor:'#6366F1',alignItems:'center'}, approveT:{color:'#fff',fontSize:15,fontWeight:'600'},
  sessRow:{flexDirection:'row',alignItems:'center',backgroundColor:'#fff',borderRadius:14,padding:14,marginBottom:10,borderWidth:1,borderColor:'#E2E8F0'},
  discBtn:{backgroundColor:'#FEF2F2',paddingVertical:8,paddingHorizontal:12,borderRadius:10}, discT:{color:'#EF4444',fontSize:13,fontWeight:'600'},
})


