import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator, Modal, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useWalletStore } from '../store/walletStore'
import { loadPrivateKey } from '../store/keyStore'
import {
  Guardian, RecoveryConfig, RecoveryRequest,
  loadRecoveryConfig, saveRecoveryConfig,
  loadRecoveryRequests, saveRecoveryRequest,
  createGuardian, validateGuardianSetup,
  signRecoveryRequest, verifyGuardianSig,
} from '../utils/socialRecovery'
import { notifyRecoveryInitiated } from '../utils/recoveryNotification'
import { shareRecoveryLink, buildRecoveryLink } from '../utils/recoveryDeepLink'

type Tab = 'guardians' | 'recover'

export default function SocialRecoveryScreen() {
  const activeChain       = useWalletStore(s => s.activeChain)
  const smartAccountAddr  = useWalletStore(s => s.smartAccountAddress)
  const addr              = useWalletStore(s => s.address)

  const [tab,           setTab]           = useState<Tab>('guardians')
  const [config,        setConfig]        = useState<RecoveryConfig | null>(null)
  const [requests,      setRequests]      = useState<RecoveryRequest[]>([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [showAddModal,  setShowAddModal]  = useState(false)
  const [showRecModal,  setShowRecModal]  = useState(false)
  const [newAddr,       setNewAddr]       = useState('')
  const [newNick,       setNewNick]       = useState('')
  const [threshold,     setThreshold]     = useState(1)
  const [recNewOwner,   setRecNewOwner]   = useState('')
  const [recSigning,    setRecSigning]    = useState(false)

  const saAddr = smartAccountAddr ?? addr ?? ''

  useEffect(() => { loadData() }, [saAddr])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [cfg, reqs] = await Promise.all([
      loadRecoveryConfig(saAddr),
      loadRecoveryRequests(saAddr),
    ])
    setConfig(cfg)
    setRequests(reqs)
    setThreshold(cfg?.threshold ?? 1)
    setLoading(false)
  }, [saAddr])

  //  Add guardian 

  async function handleAddGuardian() {
    if (!newAddr.trim() || !newNick.trim()) {
      Alert.alert('Required', 'Enter both address and nickname')
      return
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(newAddr.trim())) {
      Alert.alert('Invalid', 'Enter a valid 0x Ethereum address')
      return
    }
    if (newAddr.toLowerCase() === addr?.toLowerCase()) {
      Alert.alert('Invalid', 'You cannot add yourself as a guardian')
      return
    }

    const guardian = createGuardian(newAddr.trim(), newNick.trim())
    const existing = config?.guardians ?? []

    if (existing.find(g => g.address === guardian.address)) {
      Alert.alert('Duplicate', 'This address is already a guardian')
      return
    }

    const updated: RecoveryConfig = {
      guardians:        [...existing, guardian],
      threshold:        Math.min(threshold, existing.length + 1),
      smartAccountAddr: saAddr,
      chainId:          activeChain.id,
      createdAt:        config?.createdAt ?? Date.now(),
    }

    setSaving(true)
    await saveRecoveryConfig(updated)
    setConfig(updated)
    setThreshold(updated.threshold)
    setNewAddr('')
    setNewNick('')
    setShowAddModal(false)
    setSaving(false)
    Alert.alert('Guardian added', `${guardian.nickname} can now help recover your wallet.`)
  }

  //  Remove guardian 

  function handleRemoveGuardian(id: string) {
    Alert.alert(
      'Remove guardian',
      'Are you sure? They will no longer be able to help recover your wallet.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            const updated: RecoveryConfig = {
              ...config!,
              guardians: config!.guardians.filter(g => g.id !== id),
              threshold: Math.min(threshold, (config!.guardians.length - 1) || 1),
            }
            await saveRecoveryConfig(updated)
            setConfig(updated)
            setThreshold(updated.threshold)
          },
        },
      ]
    )
  }

  //  Update threshold 

  async function handleSaveThreshold(t: number) {
    if (!config) return
    const err = validateGuardianSetup(config.guardians, t)
    if (err) { Alert.alert('Invalid', err); return }
    const updated = { ...config, threshold: t }
    await saveRecoveryConfig(updated)
    setConfig(updated)
    setThreshold(t)
  }

  //  Initiate recovery (guardian signs) 

  async function handleSignRecovery() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(recNewOwner.trim())) {
      Alert.alert('Invalid', 'Enter a valid new owner address')
      return
    }

    setRecSigning(true)
    try {
      const pk = await loadPrivateKey()
      if (!pk) throw new Error('Could not load private key')

      const deadline = Math.floor(Date.now() / 1000) + 7 * 24 * 3600 // 7 days

      const sig = await signRecoveryRequest(
        pk,
        saAddr,
        recNewOwner.trim(),
        activeChain.id,
        deadline,
      )

      const req: RecoveryRequest = {
        id:               `recovery-${Date.now()}`,
        smartAccountAddr: saAddr,
        newOwnerAddr:     recNewOwner.trim(),
        chainId:          activeChain.id,
        deadline,
        signatures:       [{ guardianAddr: addr ?? '', sig }],
        status:           'pending',
        createdAt:        Date.now(),
      }

      await saveRecoveryRequest(saAddr, req)
      setRequests(prev => [req, ...prev])
      setShowRecModal(false)
      setRecNewOwner('')

      Alert.alert(
        'Recovery initiated',
        `Share this recovery request with ${config?.threshold ?? 1} guardian(s) to complete recovery.\n\nRequest ID: ${req.id}`,
        [{ text: 'OK' }]
      )
    } catch (e: any) {
      Alert.alert('Failed', e.message)
    } finally {
      setRecSigning(false)
    }
  }

  //  UI helpers 

  const guardians  = config?.guardians ?? []
  const setupError = config ? validateGuardianSetup(guardians, threshold) : null
  const isReady    = guardians.length >= 1 && !setupError

  if (loading) return (
    <View style={s.center}>
      <ActivityIndicator size='large' color='#6366F1' />
    </View>
  )

  return (
    <View style={s.c}>
      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Ionicons name='arrow-back' size={22} color='#1E1B4B' />
        </TouchableOpacity>
        <Text style={s.title}>Social Recovery</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Status banner */}
      <View style={[s.banner, isReady ? s.bannerGreen : s.bannerAmber]}>
        <Ionicons
          name={isReady ? 'shield-checkmark-outline' : 'shield-outline'}
          size={18}
          color={isReady ? '#059669' : '#D97706'}
        />
        <Text style={[s.bannerT, { color: isReady ? '#059669' : '#D97706' }]}>
          {isReady
            ? `Protected  ${guardians.length} guardian${guardians.length !== 1 ? 's' : ''}  ${threshold}-of-${guardians.length} threshold`
            : 'Not configured  Add guardians to protect your wallet'}
        </Text>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['guardians', 'recover'] as Tab[]).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabOn]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabT, tab === t && s.tabTOn]}>
              {t === 'guardians' ? `Guardians (${guardians.length})` : 'Recovery'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/*  GUARDIANS TAB  */}
        {tab === 'guardians' && (
          <>
            {/* Explainer */}
            <View style={s.infoCard}>
              <Ionicons name='information-circle-outline' size={18} color='#6366F1' />
              <Text style={s.infoT}>
                Guardians are trusted contacts who can help recover your wallet if you lose access.
                They cannot move your funds  only help transfer ownership to a new address.
              </Text>
            </View>

            {/* Threshold picker */}
            {guardians.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Recovery threshold</Text>
                <Text style={s.sectionSub}>How many guardians must approve a recovery</Text>
                <View style={s.thresholdRow}>
                  {Array.from({ length: guardians.length }, (_, i) => i + 1).map(n => (
                    <TouchableOpacity
                      key={n}
                      style={[s.thresholdBtn, threshold === n && s.thresholdBtnOn]}
                      onPress={() => handleSaveThreshold(n)}
                    >
                      <Text style={[s.thresholdBtnT, threshold === n && { color: '#fff' }]}>
                        {n}-of-{guardians.length}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {/* Guardian list */}
            {guardians.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Your guardians</Text>
                {guardians.map((g, i) => (
                  <View key={g.id} style={s.guardianRow}>
                    <View style={s.guardianAvatar}>
                      <Text style={s.guardianAvatarT}>{g.nickname.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={s.guardianMid}>
                      <Text style={s.guardianName}>{g.nickname}</Text>
                      <Text style={s.guardianAddr}>
                        {g.address.slice(0, 8)}...{g.address.slice(-6)}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={s.removeBtn}
                      onPress={() => handleRemoveGuardian(g.id)}
                    >
                      <Ionicons name='trash-outline' size={16} color='#EF4444' />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Add guardian button */}
            {guardians.length < 5 && (
              <TouchableOpacity
                style={s.addBtn}
                onPress={() => setShowAddModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name='person-add-outline' size={18} color='#6366F1' />
                <Text style={s.addBtnT}>Add Guardian</Text>
              </TouchableOpacity>
            )}

            {/* Best practices */}
            <View style={[s.infoCard, { marginTop: 16, backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
              <Ionicons name='bulb-outline' size={18} color='#D97706' />
              <Text style={[s.infoT, { color: '#92400E' }]}>
                Best practice: use 3 guardians with a 2-of-3 threshold.
                Choose people you trust who are unlikely to collude.
                Store their addresses securely.
              </Text>
            </View>
          </>
        )}

        {/*  RECOVERY TAB  */}
        {tab === 'recover' && (
          <>
            <View style={s.infoCard}>
              <Ionicons name='information-circle-outline' size={18} color='#6366F1' />
              <Text style={s.infoT}>
                If you have lost access to your wallet, initiate a recovery request here.
                Your guardians will need to approve it before your ownership transfers.
              </Text>
            </View>

            <TouchableOpacity
              style={[s.addBtn, { backgroundColor: '#EEF2FF', marginBottom: 20 }]}
              onPress={() => setShowRecModal(true)}
            >
              <Ionicons name='refresh-circle-outline' size={18} color='#6366F1' />
              <Text style={s.addBtnT}>Initiate Recovery</Text>
            </TouchableOpacity>

            {requests.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Recovery requests</Text>
                {requests.map(req => (
                  <View key={req.id} style={s.reqCard}>
                    <View style={s.reqHeader}>
                      <View style={[
                        s.statusDot,
                        { backgroundColor: req.status === 'executed' ? '#10B981' : req.status === 'expired' ? '#94A3B8' : '#F59E0B' }
                      ]} />
                      <Text style={s.reqStatus}>{req.status.toUpperCase()}</Text>
                      <Text style={s.reqDate}>
                        {new Date(req.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    <Text style={s.reqLabel}>New owner</Text>
                    <Text style={s.reqAddr}>
                      {req.newOwnerAddr.slice(0, 10)}...{req.newOwnerAddr.slice(-8)}
                    </Text>
                    <Text style={s.reqLabel}>Signatures</Text>
                    <Text style={s.reqSigs}>
                      {req.signatures.length} / {config?.threshold ?? 1} required
                    </Text>
                    <Text style={s.reqLabel}>Expires</Text>
                    <Text style={s.reqSigs}>
                      {new Date(req.deadline * 1000).toLocaleDateString()}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {requests.length === 0 && (
              <View style={s.emptyState}>
                <Ionicons name='lock-closed-outline' size={48} color='#CBD5E1' />
                <Text style={s.emptyTitle}>No recovery requests</Text>
                <Text style={s.emptySub}>
                  Initiate a recovery request if you have lost access to your wallet.
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/*  Add Guardian Modal  */}
      <Modal transparent animationType='slide' visible={showAddModal} onRequestClose={() => setShowAddModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowAddModal(false)} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Add Guardian</Text>

          <Text style={s.fieldLabel}>Guardian Nickname</Text>
          <TextInput
            style={s.input}
            value={newNick}
            onChangeText={setNewNick}
            placeholder='e.g. Alice, My Brother, Hardware Wallet'
            placeholderTextColor='#CBD5E1'
          />

          <Text style={s.fieldLabel}>Guardian Ethereum Address</Text>
          <TextInput
            style={s.input}
            value={newAddr}
            onChangeText={setNewAddr}
            placeholder='0x...'
            placeholderTextColor='#CBD5E1'
            autoCapitalize='none'
            autoCorrect={false}
          />

          <View style={s.warnBox}>
            <Ionicons name='warning-outline' size={14} color='#C2410C' />
            <Text style={s.warnT}>
              Make sure this address is correct. You cannot undo this without removing the guardian.
            </Text>
          </View>

          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleAddGuardian}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator color='#fff' />
              : <Text style={s.saveBtnT}>Add Guardian</Text>
            }
          </TouchableOpacity>
        </View>
      </Modal>

      {/*  Initiate Recovery Modal  */}
      <Modal transparent animationType='slide' visible={showRecModal} onRequestClose={() => setShowRecModal(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShowRecModal(false)} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>Initiate Recovery</Text>

          <Text style={s.fieldLabel}>New Owner Address</Text>
          <Text style={s.fieldSub}>The new wallet address that should control your smart account</Text>
          <TextInput
            style={s.input}
            value={recNewOwner}
            onChangeText={setRecNewOwner}
            placeholder='0x...'
            placeholderTextColor='#CBD5E1'
            autoCapitalize='none'
            autoCorrect={false}
          />

          <View style={[s.warnBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
            <Ionicons name='alert-circle-outline' size={14} color='#DC2626' />
            <Text style={[s.warnT, { color: '#DC2626', flex: 1 }]}>
              This will transfer ownership of your smart account. Only proceed if you have lost access to your current wallet.
            </Text>
          </View>

          <TouchableOpacity
            style={[s.saveBtn, { backgroundColor: '#EF4444' }, recSigning && { opacity: 0.6 }]}
            onPress={handleSignRecovery}
            disabled={recSigning}
          >
            {recSigning
              ? <ActivityIndicator color='#fff' />
              : <Text style={s.saveBtnT}>Sign Recovery Request</Text>
            }
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  c:               { flex: 1, backgroundColor: '#F8FAFF' },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hdr:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back:            { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  title:           { fontSize: 17, fontWeight: '700', color: '#1E1B4B' },
  banner:          { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  bannerGreen:     { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' },
  bannerAmber:     { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  bannerT:         { fontSize: 13, fontWeight: '600', flex: 1 },
  tabs:            { flexDirection: 'row', marginHorizontal: 16, gap: 8, marginBottom: 8 },
  tab:             { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center' },
  tabOn:           { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  tabT:            { fontSize: 13, fontWeight: '600', color: '#64748B' },
  tabTOn:          { color: '#fff' },
  infoCard:        { flexDirection: 'row', gap: 10, backgroundColor: '#EEF2FF', borderRadius: 12, borderWidth: 1, borderColor: '#C7D2FE', padding: 14, marginBottom: 16 },
  infoT:           { flex: 1, fontSize: 13, color: '#4338CA', lineHeight: 20 },
  section:         { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, marginBottom: 16 },
  sectionTitle:    { fontSize: 14, fontWeight: '700', color: '#1E1B4B', marginBottom: 4 },
  sectionSub:      { fontSize: 12, color: '#94A3B8', marginBottom: 12 },
  thresholdRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thresholdBtn:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFF' },
  thresholdBtnOn:  { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  thresholdBtnT:   { fontSize: 13, fontWeight: '600', color: '#64748B' },
  guardianRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  guardianAvatar:  { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  guardianAvatarT: { fontSize: 14, fontWeight: '700', color: '#6366F1' },
  guardianMid:     { flex: 1 },
  guardianName:    { fontSize: 14, fontWeight: '600', color: '#1E1B4B' },
  guardianAddr:    { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  removeBtn:       { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  addBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EEF2FF', borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: '#C7D2FE' },
  addBtnT:         { fontSize: 14, fontWeight: '600', color: '#6366F1' },
  reqCard:         { backgroundColor: '#F8FAFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginBottom: 10 },
  reqHeader:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  statusDot:       { width: 8, height: 8, borderRadius: 4 },
  reqStatus:       { fontSize: 12, fontWeight: '700', color: '#1E1B4B', flex: 1 },
  reqDate:         { fontSize: 11, color: '#94A3B8' },
  reqLabel:        { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  reqAddr:         { fontSize: 13, fontWeight: '600', color: '#1E1B4B', marginBottom: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  reqSigs:         { fontSize: 13, fontWeight: '600', color: '#1E1B4B', marginBottom: 8 },
  emptyState:      { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyTitle:      { fontSize: 18, fontWeight: '700', color: '#1E1B4B' },
  emptySub:        { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 },
  overlay:         { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.5)' },
  modalSheet:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalHandle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0', alignSelf: 'center', marginBottom: 20 },
  modalTitle:      { fontSize: 20, fontWeight: '700', color: '#1E1B4B', marginBottom: 20 },
  fieldLabel:      { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
  fieldSub:        { fontSize: 12, color: '#94A3B8', marginBottom: 8, marginTop: -2 },
  input:           { backgroundColor: '#F8FAFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', padding: 14, fontSize: 14, color: '#1E1B4B', marginBottom: 14 },
  warnBox:         { flexDirection: 'row', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A', padding: 12, marginBottom: 16 },
  warnT:           { fontSize: 12, color: '#92400E', lineHeight: 18 },
  saveBtn:         { backgroundColor: '#6366F1', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  saveBtnT:        { color: '#fff', fontSize: 16, fontWeight: '600' },
})
