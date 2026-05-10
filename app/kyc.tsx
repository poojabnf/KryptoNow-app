import { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, ActivityIndicator, Platform, Alert, Modal,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useAuth } from '../context/AuthContext'
import { useWalletStore } from '../store/walletStore'

const API = process.env.EXPO_PUBLIC_API_URL ?? ''

const KYC_DOCS: Record<string, { label: string; placeholder: string; pattern: RegExp }[]> = {
  IN: [
    { label: 'Aadhaar Number',  placeholder: '1234 5678 9012',        pattern: /^\d{12}$/ },
    { label: 'PAN Number',      placeholder: 'ABCDE1234F',            pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/ },
    { label: 'Passport Number', placeholder: 'A1234567',              pattern: /^[A-Z][0-9]{7}$/ },
    { label: 'Voter ID',        placeholder: 'ABC1234567',            pattern: /^[A-Z]{3}[0-9]{7}$/ },
  ],
  US: [
    { label: 'Social Security Number', placeholder: 'XXX-XX-XXXX',   pattern: /^\d{3}-\d{2}-\d{4}$/ },
    { label: 'Passport Number',        placeholder: 'A12345678',      pattern: /^[A-Z0-9]{6,9}$/ },
    { label: "Driver's License",       placeholder: 'D12345678',      pattern: /^[A-Z0-9]{6,12}$/ },
  ],
  GB: [
    { label: 'National Insurance No.', placeholder: 'AB123456C',      pattern: /^[A-Z]{2}\d{6}[A-D]$/ },
    { label: 'Passport Number',        placeholder: '123456789',      pattern: /^[0-9]{9}$/ },
    { label: "Driver's Licence",       placeholder: 'MORGA753116SM9', pattern: /^[A-Z0-9]{16}$/ },
  ],
  DEFAULT: [
    { label: 'Passport Number', placeholder: 'A1234567',              pattern: /^[A-Z0-9]{6,12}$/ },
    { label: 'National ID',     placeholder: 'ID12345678',            pattern: /^[A-Z0-9]{6,20}$/ },
  ],
}

const STATUS_CONFIG = {
  none:     { color: '#6B7280', bg: '#F3F4F6', icon: 'document-text-outline',  label: 'Not Submitted' },
  pending:  { color: '#D97706', bg: '#FFF7ED', icon: 'time-outline',            label: 'Under Review'  },
  verified: { color: '#059669', bg: '#ECFDF5', icon: 'shield-checkmark-outline', label: 'Verified'     },
  rejected: { color: '#DC2626', bg: '#FEF2F2', icon: 'close-circle-outline',   label: 'Rejected'      },
}

export default function KYCScreen() {
  const { user, updateProfile } = useAuth()
  const address = useWalletStore(s => s.address)

  const country  = user?.country || 'DEFAULT'
  const docList  = KYC_DOCS[country] ?? KYC_DOCS.DEFAULT
  const status   = user?.kycStatus ?? 'none'
  const cfg      = STATUS_CONFIG[status]

  const [docType,   setDocType]   = useState(0)
  const [docNumber, setDocNumber] = useState('')
  const [fullName,  setFullName]  = useState(user?.name ?? '')
  const [dob,       setDob]       = useState('')
  const [loading,   setLoading]   = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)

  const selectedDoc = docList[docType]
  const isValid     = fullName.trim().length > 1 &&
                      /^\d{4}-\d{2}-\d{2}$/.test(dob) &&
                      selectedDoc.pattern.test(docNumber.replace(/\s/g, ''))

  async function submit() {
    if (!isValid) return
    setLoading(true)
    try {
      const body = {
        walletAddress: address,
        country,
        docType:   selectedDoc.label,
        docNumber: docNumber.replace(/\s/g, ''),
        fullName:  fullName.trim(),
        dob,
      }
      const res = await fetch(`${API}/api/kyc/submit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      if (res.ok) {
        await updateProfile({ kycStatus: 'pending' })
        Alert.alert(
          'KYC Submitted',
          'Your documents are under review. This usually takes 1–2 business days.',
          [{ text: 'OK', onPress: () => router.back() }],
        )
      } else {
        const err = await res.json().catch(() => ({}))
        Alert.alert('Submission Failed', err.message ?? 'Please try again later.')
      }
    } catch {
      Alert.alert('Offline', 'Could not submit. Please check your internet connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}>
          <Ionicons name="chevron-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <Text style={s.headerT}>KYC Verification</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* Status banner */}
        <View style={[s.statusBanner, { backgroundColor: cfg.bg }]}>
          <View style={[s.statusIcon, { backgroundColor: cfg.color + '20' }]}>
            <Ionicons name={cfg.icon as any} size={28} color={cfg.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
            {status === 'none'     && <Text style={s.statusSub}>Complete KYC to unlock deposits & withdrawals</Text>}
            {status === 'pending'  && <Text style={s.statusSub}>We'll notify you when verification is complete</Text>}
            {status === 'verified' && <Text style={s.statusSub}>Your identity is verified. Full access enabled.</Text>}
            {status === 'rejected' && <Text style={s.statusSub}>Please re-submit with valid documents</Text>}
          </View>
        </View>

        {/* Hero */}
        {(status === 'none' || status === 'rejected') && (
          <LinearGradient colors={['#1E1B4B', '#4F46E5']} style={s.hero}>
            <Ionicons name="shield-checkmark" size={40} color="#fff" />
            <Text style={s.heroTitle}>Identity Verification</Text>
            <Text style={s.heroSub}>
              KYC is required by Indian regulations for fiat transactions.
              Your data is encrypted and retained for 10 years as mandated by law.
            </Text>
          </LinearGradient>
        )}

        {/* Verified state — nothing to fill */}
        {status === 'verified' && (
          <View style={s.verifiedBox}>
            <Ionicons name="checkmark-circle" size={64} color="#059669" />
            <Text style={s.verifiedTitle}>You're Verified!</Text>
            <Text style={s.verifiedSub}>Deposits and withdrawals are fully unlocked.</Text>
          </View>
        )}

        {/* Pending state */}
        {status === 'pending' && (
          <View style={s.pendingBox}>
            <Text style={s.pendingTitle}>Documents submitted</Text>
            <Text style={s.pendingDesc}>
              Our team is reviewing your documents.{'\n'}
              Expected time: 1–2 business days.
            </Text>
          </View>
        )}

        {/* Form — shown for none or rejected */}
        {(status === 'none' || status === 'rejected') && (
          <View style={s.form}>
            {/* Document type picker */}
            <Text style={s.fieldLabel}>Document Type</Text>
            <TouchableOpacity style={s.picker} onPress={() => setPickerOpen(true)} activeOpacity={0.8}>
              <Text style={s.pickerText}>{selectedDoc.label}</Text>
              <Ionicons name="chevron-down" size={18} color="#6B7280" />
            </TouchableOpacity>

            {/* Full name */}
            <Text style={s.fieldLabel}>Full Name (as on document)</Text>
            <TextInput
              style={s.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Rajesh Kumar Sharma"
              placeholderTextColor="#CBD5E1"
              autoCapitalize="words"
            />

            {/* Date of birth */}
            <Text style={s.fieldLabel}>Date of Birth</Text>
            <TextInput
              style={s.input}
              value={dob}
              onChangeText={setDob}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#CBD5E1"
              keyboardType="numeric"
              maxLength={10}
            />

            {/* Document number */}
            <Text style={s.fieldLabel}>{selectedDoc.label}</Text>
            <TextInput
              style={s.input}
              value={docNumber}
              onChangeText={setDocNumber}
              placeholder={selectedDoc.placeholder}
              placeholderTextColor="#CBD5E1"
              autoCapitalize="characters"
            />

            {/* Consent notice */}
            <View style={s.consent}>
              <Ionicons name="lock-closed-outline" size={14} color="#64748B" style={{ marginTop: 1 }} />
              <Text style={s.consentText}>
                Your documents are encrypted end-to-end and retained for 10 years
                as required by PMLA / FEMA regulations. We never share your data
                with third parties without your consent.
              </Text>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[s.submitBtn, !isValid && s.submitDisabled]}
              onPress={submit}
              disabled={!isValid || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.submitT}>Submit for Verification</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Document type modal */}
        <Modal visible={pickerOpen} transparent animationType="slide">
          <View style={s.modalOverlay}>
            <View style={s.modalSheet}>
              <Text style={s.modalTitle}>Select Document Type</Text>
              {docList.map((doc, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.modalOpt, i === docType && s.modalOptActive]}
                  onPress={() => { setDocType(i); setDocNumber(''); setPickerOpen(false) }}
                >
                  <Text style={[s.modalOptT, i === docType && { color: '#4F46E5', fontWeight: '700' }]}>
                    {doc.label}
                  </Text>
                  {i === docType && <Ionicons name="checkmark" size={18} color="#4F46E5" />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={s.modalCancel} onPress={() => setPickerOpen(false)}>
                <Text style={s.modalCancelT}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#F8FAFF' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 56 : 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  back:         { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  headerT:      { fontSize: 17, fontWeight: '800', color: '#1E1B4B' },

  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, margin: 20, borderRadius: 16, padding: 16 },
  statusIcon:   { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statusLabel:  { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  statusSub:    { fontSize: 12, color: '#6B7280', lineHeight: 17 },

  hero:         { marginHorizontal: 20, borderRadius: 20, padding: 28, alignItems: 'center', gap: 12 },
  heroTitle:    { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  heroSub:      { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 20 },

  verifiedBox:  { alignItems: 'center', marginTop: 40, gap: 12 },
  verifiedTitle:{ fontSize: 22, fontWeight: '800', color: '#059669' },
  verifiedSub:  { fontSize: 14, color: '#6B7280' },

  pendingBox:   { margin: 20, backgroundColor: '#FFF7ED', borderRadius: 16, padding: 24, alignItems: 'center' },
  pendingTitle: { fontSize: 16, fontWeight: '700', color: '#92400E', marginBottom: 8 },
  pendingDesc:  { fontSize: 13, color: '#92400E', textAlign: 'center', lineHeight: 20 },

  form:         { margin: 20, gap: 4 },
  fieldLabel:   { fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 0.5, marginTop: 16, marginBottom: 6 },
  input:        { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#1E1B4B' },

  picker:       { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerText:   { fontSize: 15, color: '#1E1B4B', fontWeight: '600' },

  consent:      { flexDirection: 'row', gap: 8, marginTop: 16, backgroundColor: '#F8FAFF', borderRadius: 10, padding: 12 },
  consentText:  { fontSize: 11, color: '#64748B', lineHeight: 17, flex: 1 },

  submitBtn:    { marginTop: 20, backgroundColor: '#4F46E5', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitDisabled:{ opacity: 0.4 },
  submitT:      { fontSize: 16, fontWeight: '800', color: '#fff' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:   { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitle:   { fontSize: 16, fontWeight: '800', color: '#1E1B4B', marginBottom: 16 },
  modalOpt:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalOptActive:{ backgroundColor: '#EEF2FF', borderRadius: 10, paddingHorizontal: 10 },
  modalOptT:    { fontSize: 15, color: '#374151' },
  modalCancel:  { marginTop: 16, alignItems: 'center', paddingVertical: 14 },
  modalCancelT: { fontSize: 15, fontWeight: '700', color: '#6B7280' },
})
