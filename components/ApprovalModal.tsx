/**
 * components/ApprovalModal.tsx
 *
 * Approval popup for dApp signing requests.
 * Replaces raw JSON display with human-readable decoded fields.
 *
 * Handles:
 *   sendTransaction   tx details with to/value/data
 *   signTypedData     EIP-712 decoded (permit, permit2, seaport, safe, generic)
 *   sign              personal_sign with hex decode attempt
 */

import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native'
import { useWalletStore } from '../store/walletStore'
import { decodeTypedData, decodePersonalSign, type DecodedField } from '../utils/eip712Decoder'

interface ApprovalRequest {
  type: string
  data: any
  resolve: (approved: boolean) => void
}

//  Risk badge 

function RiskBadge({ level, reason }: { level: 'safe' | 'caution' | 'danger'; reason?: string }) {
  const config = {
    safe:    { bg: '#D1FAE5', color: '#065F46', icon: '', label: 'Safe'    },
    caution: { bg: '#FEF3C7', color: '#92400E', icon: '', label: 'Caution' },
    danger:  { bg: '#FEE2E2', color: '#991B1B', icon: '', label: 'Danger'  },
  }[level]

  return (
    <View style={[rb.wrap, { backgroundColor: config.bg }]}>
      <Text style={[rb.icon, { color: config.color }]}>{config.icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[rb.label, { color: config.color }]}>{config.label}</Text>
        {reason && <Text style={[rb.reason, { color: config.color }]}>{reason}</Text>}
      </View>
    </View>
  )
}

const rb = StyleSheet.create({
  wrap:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderRadius: 10, padding: 10, marginBottom: 12 },
  icon:   { fontSize: 14, fontWeight: '800', marginTop: 1 },
  label:  { fontSize: 12, fontWeight: '800' },
  reason: { fontSize: 11, marginTop: 2, lineHeight: 16, opacity: 0.85 },
})

//  Decoded field row 

function FieldRow({ field }: { field: DecodedField }) {
  const valueColor =
    field.type === 'warning' ? '#DC2626'
    : field.type === 'deadline' ? '#D97706'
    : field.type === 'address' ? '#2563EB'
    : '#1E293B'

  return (
    <View style={f.row}>
      <Text style={f.label}>{field.label}</Text>
      <Text style={[f.value, { color: valueColor }]} numberOfLines={2}>
        {field.value}
      </Text>
    </View>
  )
}

const f = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12 },
  label: { fontSize: 12, color: '#94A3B8', fontWeight: '600', flex: 0.45 },
  value: { fontSize: 12, fontWeight: '700', flex: 0.55, textAlign: 'right' },
})

//  Transaction display 

function TxDetails({ data }: { data: any }) {
  const fields = [
    { label: 'To',    value: data.to   ? data.to.slice(0,8)+'...'+data.to.slice(-6)   : '' },
    { label: 'Value', value: data.value ? (parseInt(data.value, 16) / 1e18).toFixed(6) + ' ETH' : '0 ETH' },
    { label: 'Data',  value: data.data && data.data !== '0x' ? data.data.slice(0,12)+'...' : 'None' },
    { label: 'Gas',   value: data.gas  ? parseInt(data.gas, 16).toLocaleString() + ' units' : 'Auto' },
  ]
  return (
    <View>
      <RiskBadge level="caution" reason="Review destination and value before approving" />
      {fields.map(f => (
        <View key={f.label} style={f2.row}>
          <Text style={f2.label}>{f.label}</Text>
          <Text style={f2.value}>{f.value}</Text>
        </View>
      ))}
    </View>
  )
}

const f2 = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  label: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  value: { fontSize: 12, color: '#1E293B', fontWeight: '700', maxWidth: '60%', textAlign: 'right' },
})

//  Main Modal 

export default function ApprovalModal() {
  const [request, setRequest] = useState<ApprovalRequest | null>(null)
  const activeChain = useWalletStore(s => s.activeChain)

  useEffect(() => {
    if (Platform.OS === 'web') {
      const handler = (e: any) => setRequest(e.detail)
      window.addEventListener('kryptonow_sign_request', handler)
      return () => window.removeEventListener('kryptonow_sign_request', handler)
    }
  }, [])

  if (!request) return null

  const approve = () => { request.resolve(true);  setRequest(null) }
  const reject  = () => { request.resolve(false); setRequest(null) }

  //  Decode based on request type 
  const isTypedData    = request.type === 'signTypedData'
  const isPersonalSign = request.type === 'sign'
  const isTx           = request.type === 'sendTransaction'

  const decoded     = isTypedData    ? decodeTypedData(request.data)           : null
  const personalMsg = isPersonalSign ? decodePersonalSign(request.data?.message ?? JSON.stringify(request.data)) : null

  const title = isTx          ? ' Confirm Transaction'
    : isTypedData              ? `  ${decoded?.title ?? 'Sign Typed Data'}`
    : isPersonalSign           ? '  Sign Message'
    : '  Signature Request'

  const headerColor = decoded?.riskLevel === 'danger' ? '#DC2626'
    : decoded?.riskLevel === 'caution'                 ? '#D97706'
    : activeChain.color

  return (
    <View style={s.overlay}>
      <View style={s.modal}>

        {/* Header */}
        <View style={[s.header, { backgroundColor: headerColor }]}>
          <Text style={s.headerTitle}>{title}</Text>
          <Text style={s.headerSub}>
            {decoded?.subtitle ?? 'KryptoNow is requesting your approval'}
          </Text>
          {decoded?.domain?.name && (
            <View style={s.domainBadge}>
              <Text style={s.domainText}>
                {decoded.domain.name}
                {decoded.domain.chainId ? `  Chain ${decoded.domain.chainId}` : ''}
              </Text>
            </View>
          )}
        </View>

        {/* Body */}
        <ScrollView style={s.body} showsVerticalScrollIndicator>

          {/*  EIP-712 typed data  */}
          {isTypedData && decoded && (
            <View>
              <RiskBadge level={decoded.riskLevel} reason={decoded.riskReason} />

              {decoded.domain.contract && (
                <View style={s.contractRow}>
                  <Text style={s.contractLabel}>Contract</Text>
                  <Text style={s.contractVal}>{decoded.domain.contract.slice(0,8)}...{decoded.domain.contract.slice(-6)}</Text>
                </View>
              )}

              <View style={s.fieldsCard}>
                {decoded.fields.map((field, i) => (
                  <FieldRow key={i} field={field} />
                ))}
              </View>
            </View>
          )}

          {/*  Personal sign  */}
          {isPersonalSign && personalMsg && (
            <View>
              <RiskBadge level={personalMsg.riskLevel} reason={personalMsg.riskReason} />
              <Text style={s.sectionLabel}>Message</Text>
              <View style={s.msgBox}>
                <Text style={s.msgText}>{personalMsg.displayText}</Text>
              </View>
              {personalMsg.isHex && (
                <Text style={s.hexNote}>Hex-encoded message  decoded above</Text>
              )}
            </View>
          )}

          {/*  Send transaction  */}
          {isTx && <TxDetails data={request.data} />}

          {/*  Unknown / fallback  */}
          {!isTypedData && !isPersonalSign && !isTx && (
            <View>
              <RiskBadge level="caution" reason="Unknown request type  review carefully" />
              <Text style={s.sectionLabel}>Raw Data</Text>
              <View style={s.rawBox}>
                <Text style={s.rawText}>{JSON.stringify(request.data, null, 2)}</Text>
              </View>
            </View>
          )}

        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          <TouchableOpacity style={s.rejectBtn} onPress={reject}>
            <Text style={s.rejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.approveBtn, { backgroundColor: headerColor }]}
            onPress={approve}
          >
            <Text style={s.approveText}>Approve</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  overlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', zIndex: 9999 },
  modal:        { width: '92%', maxWidth: 480, backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', maxHeight: '85%' },

  header:       { padding: 20, alignItems: 'center' },
  headerTitle:  { color: '#fff', fontSize: 17, fontWeight: '800' },
  headerSub:    { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4, textAlign: 'center' },
  domainBadge:  { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20 },
  domainText:   { color: '#fff', fontSize: 11, fontWeight: '600' },

  body:         { padding: 16, maxHeight: 380 },

  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

  fieldsCard:   { backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#E2E8F0' },

  contractRow:  { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  contractLabel:{ fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  contractVal:  { fontSize: 11, color: '#2563EB', fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  msgBox:       { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8 },
  msgText:      { fontSize: 13, color: '#1E293B', lineHeight: 20 },
  hexNote:      { fontSize: 11, color: '#94A3B8', fontStyle: 'italic', marginBottom: 8 },

  rawBox:       { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  rawText:      { fontSize: 10, color: '#475569', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', lineHeight: 16 },

  footer:       { flexDirection: 'row', padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  rejectBtn:    { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center' },
  rejectText:   { color: '#64748B', fontWeight: '700', fontSize: 14 },
  approveBtn:   { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  approveText:  { color: '#fff', fontWeight: '700', fontSize: 14 },
})
