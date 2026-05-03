import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { useWalletStore } from '../store/walletStore'

interface ApprovalRequest {
  type: string
  data: any
  resolve: (approved: boolean) => void
}

export default function ApprovalModal() {
  const [request, setRequest] = useState<ApprovalRequest | null>(null)
  const activeChain = useWalletStore(s => s.activeChain)

  useEffect(() => {
    const handler = (e: any) => setRequest(e.detail)
    window.addEventListener('kryptonow:approval_request', handler)
    return () => window.removeEventListener('kryptonow:approval_request', handler)
  }, [])

  if (!request) return null

  const approve = () => { request.resolve(true); setRequest(null) }
  const reject  = () => { request.resolve(false); setRequest(null) }

  const title = request.type === 'sendTransaction' ? ' Confirm Transaction'
    : request.type === 'signTypedData' ? ' Sign Typed Data'
    : ' Sign Message'

  return (
    <View style={s.overlay}>
      <View style={s.modal}>
        <View style={[s.header, { backgroundColor: activeChain.color }]}>
          <Text style={s.headerTitle}>{title}</Text>
          <Text style={s.headerSub}>KryptoNow is requesting your approval</Text>
        </View>

        <ScrollView style={s.body}>
          <Text style={s.label}>Request Details</Text>
          <View style={s.dataBox}>
            <Text style={s.dataText}>
              {JSON.stringify(request.data, null, 2)}
            </Text>
          </View>
        </ScrollView>

        <View style={s.footer}>
          <TouchableOpacity style={s.rejectBtn} onPress={reject}>
            <Text style={s.rejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.approveBtn, { backgroundColor: activeChain.color }]} onPress={approve}>
            <Text style={s.approveText}>Approve</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  overlay:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  modal:       { width: '90%', maxWidth: 480, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', maxHeight: '80%' },
  header:      { padding: 20, alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  headerSub:   { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 },
  body:        { padding: 16, maxHeight: 300 },
  label:       { fontSize: 12, fontWeight: '700', color: '#94A3B8', marginBottom: 8, textTransform: 'uppercase' },
  dataBox:     { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  dataText:    { fontSize: 11, color: '#334155', fontFamily: 'monospace' },
  footer:      { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  rejectBtn:   { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  rejectText:  { color: '#64748B', fontWeight: '700' },
  approveBtn:  { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  approveText: { color: '#fff', fontWeight: '700' },
})