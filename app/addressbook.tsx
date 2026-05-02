/**
 * app/addressbook.tsx
 * Address Book - save labelled contacts, ENS resolution, recent addresses
 * No new packages needed - ethers.js handles ENS
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, Alert, Modal, KeyboardAvoidingView,
  Platform, ActivityIndicator, Animated,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { Ionicons } from '@expo/vector-icons'

import { ethers } from 'ethers'

const ENS_PROVIDER = 'https://eth.llamarpc.com'
const STORAGE_KEY  = 'Kryptonow_address_book'
const RECENT_KEY   = 'Kryptonow_recent_addresses'

// --- Types --------------------------------------------------------------------
export type Contact = {
  id:        string
  name:      string
  address:   string
  ens?:      string       // resolved ENS name
  note?:     string
  emoji:     string       // avatar emoji
  addedAt:   number
  chainId?:  number       // optional: lock to specific chain
}

export type RecentAddress = {
  address:   string
  ens?:      string
  lastUsed:  number
  txCount:   number
}

const EMOJIS = ['👤','🦊','🐻','🦁','🐯','🦅','🌟','💎','🚀','🔥','⚡','🌈']

function randomEmoji() {
  return EMOJIS[Math.floor(Math.random() * EMOJIS.length)]
}

function isValidAddress(addr: string): boolean {
  try { ethers.getAddress(addr); return true } catch { return false }
}

// --- ENS Resolution -----------------------------------------------------------
async function resolveENS(input: string): Promise<{ address: string; ens?: string } | null> {
  try {
    const provider = new ethers.JsonRpcProvider(ENS_PROVIDER)
    if (input.endsWith('.eth') || input.includes('.')) {
      // Input is ENS name - resolve to address
      const address = await provider.resolveName(input)
      if (!address) return null
      return { address, ens: input }
    } else if (isValidAddress(input)) {
      // Input is address - try reverse lookup for ENS
      const ens = await provider.lookupAddress(input)
      return { address: input, ens: ens ?? undefined }
    }
    return null
  } catch {
    return null
  }
}

// --- Storage helpers ----------------------------------------------------------
function loadContacts(): Contact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveContacts(contacts: Contact[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts)) } catch {}
}

export function loadRecents(): RecentAddress[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

export function recordRecentAddress(address: string, ens?: string): void {
  try {
    const recents = loadRecents()
    const existing = recents.find(r => r.address.toLowerCase() === address.toLowerCase())
    if (existing) {
      existing.lastUsed = Date.now()
      existing.txCount  += 1
      if (ens) existing.ens = ens
    } else {
      recents.unshift({ address, ens, lastUsed: Date.now(), txCount: 1 })
    }
    const trimmed = recents.slice(0, 20)  // keep last 20
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(trimmed)) } catch {}
  } catch {}
}

// --- Add/Edit Contact Modal ---------------------------------------------------
function ContactModal({
  visible, existing, onSave, onClose,
}: {
  visible: boolean
  existing: Contact | null
  onSave: (c: Contact) => void
  onClose: () => void
}) {
  const [name,       setName]       = useState('')
  const [address,    setAddress]    = useState('')
  const [note,       setNote]       = useState('')
  const [emoji,      setEmoji]      = useState(randomEmoji())
  const [resolving,  setResolving]  = useState(false)
  const [resolvedENS,setResolvedENS]= useState<string | undefined>()
  const [addrError,  setAddrError]  = useState('')

  useEffect(() => {
    if (existing) {
      setName(existing.name)
      setAddress(existing.ens ?? existing.address)
      setNote(existing.note ?? '')
      setEmoji(existing.emoji)
      setResolvedENS(existing.ens)
    } else {
      setName(''); setAddress(''); setNote('')
      setEmoji(randomEmoji()); setResolvedENS(undefined)
    }
    setAddrError('')
  }, [existing, visible])

  async function handleAddressBlur() {
    if (!address.trim()) return
    setResolving(true)
    setAddrError('')
    const result = await resolveENS(address.trim())
    if (result) {
      setAddress(result.ens ?? result.address)
      setResolvedENS(result.ens)
      if (result.ens && !name) setName(result.ens.replace('.eth', ''))
    } else {
      setAddrError('Could not resolve address or ENS name')
    }
    setResolving(false)
  }

  function handleSave() {
    if (!name.trim())    { Alert.alert('Name required'); return }
    if (!address.trim()) { Alert.alert('Address required'); return }

    const rawAddr = resolvedENS
      ? address
      : isValidAddress(address) ? ethers.getAddress(address) : null

    if (!rawAddr && !resolvedENS) {
      setAddrError('Invalid address')
      return
    }

    const contact: Contact = {
      id:      existing?.id ?? `contact-${Date.now()}`,
      name:    name.trim(),
      address: rawAddr ?? address,
      ens:     resolvedENS,
      note:    note.trim() || undefined,
      emoji,
      addedAt: existing?.addedAt ?? Date.now(),
    }
    onSave(contact)
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={onClose} />
        <View style={m.sheet}>
          <View style={m.handleRow}>
            <View style={m.handle} />
            <TouchableOpacity onPress={onClose}>
              <Text style={{ color: '#64748B', fontSize: 13 }}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <Text style={m.title}>{existing ? 'Edit Contact' : 'New Contact'}</Text>

          {/* Emoji picker */}
          <View style={m.emojiRow}>
            {EMOJIS.map(e => (
              <TouchableOpacity
                key={e}
                style={[m.emojiBtn, emoji === e && m.emojiBtnActive]}
                onPress={() => setEmoji(e)}
              >
                <Text style={m.emojiT}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Name</Text>
          <TextInput
            style={m.input}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Alice, My Ledger, DeFi wallet"
            placeholderTextColor="#CBD5E1"
          />

          <Text style={[m.label, { marginTop: 14 }]}>Address or ENS</Text>
          <View style={[m.inputWrap, addrError ? m.inputError : resolvedENS ? m.inputValid : {}]}>
            <TextInput
              style={[m.input, { flex: 1, borderWidth: 0, marginBottom: 0 }]}
              value={address}
              onChangeText={v => { setAddress(v); setAddrError(''); setResolvedENS(undefined) }}
              onBlur={handleAddressBlur}
              placeholder="0x... or name.eth"
              placeholderTextColor="#CBD5E1"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {resolving && <ActivityIndicator size="small" color="#6366F1" style={{ paddingRight: 12 }} />}
            {resolvedENS && !resolving && <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ paddingRight:12 }} />}
          </View>

          {resolvedENS && (
            <Text style={m.ensResolved}>
              {address.endsWith('.eth')
                ? `Resolves to ${resolvedENS}`
                : `ENS: ${resolvedENS}`}
            </Text>
          )}
          {addrError ? <Text style={m.errText}>{addrError}</Text> : null}

          <Text style={[m.label, { marginTop: 14 }]}>Note (optional)</Text>
          <TextInput
            style={m.input}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Trading wallet, DCA address"
            placeholderTextColor="#CBD5E1"
          />

          <TouchableOpacity style={m.saveBtn} onPress={handleSave}>
            <Text style={m.saveBtnT}>{existing ? 'Save Changes' : 'Add Contact'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// --- Contact Row --------------------------------------------------------------
function ContactRow({
  contact, onPress, onLongPress,
}: {
  contact: Contact
  onPress: () => void
  onLongPress: () => void
}) {
  return (
    <TouchableOpacity
      style={r.row}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={r.avatar}>
        <Text style={r.avatarEmoji}>{contact.emoji}</Text>
      </View>
      <View style={r.mid}>
        <Text style={r.name}>{contact.name}</Text>
        <Text style={r.addr} numberOfLines={1}>
          {contact.ens ?? contact.address.slice(0, 8) + '...' + contact.address.slice(-6)}
        </Text>
        {contact.note ? <Text style={r.note} numberOfLines={1}>{contact.note}</Text> : null}
      </View>
      <TouchableOpacity style={r.sendBtn} onPress={onPress}>
        <Ionicons name="send-outline" size={14} color="#6366F1" />
        <Text style={r.sendBtnT}>Send</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

// --- Main Screen --------------------------------------------------------------
export default function AddressBook() {
  const [contacts,  setContacts]  = useState<Contact[]>([])
  const [recents,   setRecents]   = useState<RecentAddress[]>([])
  const [search,    setSearch]    = useState('')
  const [tab,       setTab]       = useState<'contacts' | 'recent'>('contacts')
  const [modalVis,  setModalVis]  = useState(false)
  const [editing,   setEditing]   = useState<Contact | null>(null)
  const [loading,   setLoading]   = useState(true)

  const load = useCallback(() => {
    const c = loadContacts()
    const r = loadRecents()
    setContacts(c)
    setRecents(r)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave(contact: Contact) {
    const updated = editing
      ? contacts.map(c => c.id === contact.id ? contact : c)
      : [...contacts, contact]
    setContacts(updated)
    saveContacts(updated)
    setModalVis(false)
    setEditing(null)
  }

  async function handleDelete(id: string) {
    const updated = contacts.filter(c => c.id !== id)
    setContacts(updated)
    saveContacts(updated)
  }

  function handleLongPress(contact: Contact) {
    Alert.alert(contact.name, contact.ens ?? contact.address, [
      { text: 'Edit',   onPress: () => { setEditing(contact); setModalVis(true) } },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(contact.id) },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  function handleSendTo(address: string) {
    router.push({ pathname: '/send', params: { toAddress: address } } as any)
  }

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase()) ||
    c.ens?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredRecents = recents.filter(r =>
    r.address.toLowerCase().includes(search.toLowerCase()) ||
    r.ens?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <View style={s.c}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Text style={s.backT}>←</Text>
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Address Book</Text>
        <TouchableOpacity
          style={s.addBtn}
          onPress={() => { setEditing(null); setModalVis(true) }}
        >
          <View style={{ flexDirection:'row', alignItems:'center', gap:4 }}>
            <Ionicons name="add" size={16} color="#6366F1" />
            <Text style={s.addBtnT}>Add</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, address, or ENS..."
          placeholderTextColor="#CBD5E1"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Text style={{ color: '#CBD5E1', paddingRight: 14, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['contacts', 'recent'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && s.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabT, tab === t && s.tabTActive]}>
              {t === 'contacts' ? `👥  Contacts (${contacts.length})` : `🕐  Recent (${recents.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#6366F1" />
        </View>
      ) : tab === 'contacts' ? (
        filteredContacts.length === 0 ? (
          <View style={s.center}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>👤</Text>
            <Text style={s.emptyTitle}>
              {search ? 'No contacts found' : 'No contacts yet'}
            </Text>
            <Text style={s.emptySub}>
              {search ? 'Try a different search' : 'Save addresses to quickly send crypto to people you trust.'}
            </Text>
            {!search && (
              <TouchableOpacity
                style={s.emptyAddBtn}
                onPress={() => { setEditing(null); setModalVis(true) }}
              >
                <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                  <Ionicons name="person-add-outline" size={16} color="#fff" />
                  <Text style={s.emptyAddBtnT}>Add First Contact</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredContacts}
            keyExtractor={c => c.id}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <ContactRow
                contact={item}
                onPress={() => handleSendTo(item.address)}
                onLongPress={() => handleLongPress(item)}
              />
            )}
            ListHeaderComponent={
              <Text style={s.sectionLabel}>
                {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
              </Text>
            }
          />
        )
      ) : (
        filteredRecents.length === 0 ? (
          <View style={s.center}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🕐</Text>
            <Text style={s.emptyTitle}>No recent addresses</Text>
            <Text style={s.emptySub}>Addresses you send to will appear here.</Text>
          </View>
        ) : (
          <FlatList
            data={filteredRecents}
            keyExtractor={r => r.address}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={<Text style={s.sectionLabel}>Recent recipients</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={r2.row}
                onPress={() => handleSendTo(item.address)}
                activeOpacity={0.7}
              >
                <View style={r2.avatar}>
                  <Text style={r2.avatarT}>
                    {item.address.slice(2, 4).toUpperCase()}
                  </Text>
                </View>
                <View style={r2.mid}>
                  <Text style={r2.addr}>
                    {item.ens ?? item.address.slice(0, 8) + '...' + item.address.slice(-6)}
                  </Text>
                  <Text style={r2.meta}>
                    {item.txCount} tx · Last {new Date(item.lastUsed).toLocaleDateString()}
                  </Text>
                </View>
                <View style={r2.actions}>
                  <TouchableOpacity
                    style={r2.saveBtn}
                    onPress={() => {
                      setEditing(null)
                      setModalVis(true)
                    }}
                  >
                    <Text style={r2.saveBtnT}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={r2.sendBtn} onPress={() => handleSendTo(item.address)}>
                    <Text style={r2.sendBtnT}>Send</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            )}
          />
        )
      )}

      <ContactModal
        visible={modalVis}
        existing={editing}
        onSave={handleSave}
        onClose={() => { setModalVis(false); setEditing(null) }}
      />
    </View>
  )
}

const s = StyleSheet.create({
  c:            { flex: 1, backgroundColor: '#F8FAFF' },
  hdr:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  back:         { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  backT:        { color: '#6366F1', fontSize: 18 },
  hdrTitle:     { color: '#1E1B4B', fontSize: 17, fontWeight: '700' },
  addBtn:       { backgroundColor: '#6366F1', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20 },
  addBtnT:      { color: '#fff', fontSize: 13, fontWeight: '600' },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', marginHorizontal: 16, marginBottom: 12, paddingLeft: 14, gap: 8 },
  searchIcon:   { fontSize: 14 },
  searchInput:  { flex: 1, color: '#1E1B4B', fontSize: 15, paddingVertical: 12 },
  tabs:         { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 8 },
  tab:          { flex: 1, paddingVertical: 10, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center' },
  tabActive:    { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  tabT:         { color: '#64748B', fontSize: 13, fontWeight: '600' },
  tabTActive:   { color: '#fff' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle:   { color: '#1E1B4B', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  emptySub:     { color: '#94A3B8', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  emptyAddBtn:  { backgroundColor: '#6366F1', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 14 },
  emptyAddBtnT: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sectionLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
})

const r = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9', gap: 12 },
  avatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  avatarEmoji:{ fontSize: 22 },
  mid:        { flex: 1 },
  name:       { color: '#1E1B4B', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  addr:       { color: '#94A3B8', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  note:       { color: '#CBD5E1', fontSize: 11, marginTop: 3 },
  sendBtn:    { backgroundColor: '#EEF2FF', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  sendBtnT:   { color: '#6366F1', fontSize: 13, fontWeight: '600' },
})

const r2 = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9', gap: 12 },
  avatar:     { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  avatarT:    { color: '#64748B', fontSize: 13, fontWeight: '700' },
  mid:        { flex: 1 },
  addr:       { color: '#1E1B4B', fontSize: 13, fontWeight: '600', marginBottom: 3 },
  meta:       { color: '#CBD5E1', fontSize: 11 },
  actions:    { flexDirection: 'row', gap: 6 },
  saveBtn:    { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 9, borderWidth: 1, borderColor: '#E2E8F0' },
  saveBtnT:   { color: '#64748B', fontSize: 12, fontWeight: '600' },
  sendBtn:    { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 9, backgroundColor: '#EEF2FF' },
  sendBtnT:   { color: '#6366F1', fontSize: 12, fontWeight: '600' },
})

const m = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet:      { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  handleRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  handle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' },
  title:      { color: '#1E1B4B', fontSize: 20, fontWeight: '700', marginBottom: 16 },
  emojiRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  emojiBtn:   { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F8FAFF', borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  emojiBtnActive: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  emojiT:     { fontSize: 22 },
  label:      { color: '#64748B', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input:      { backgroundColor: '#F8FAFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', padding: 13, fontSize: 15, color: '#1E1B4B', marginBottom: 4 },
  inputWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFF', borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 4 },
  inputValid: { borderColor: '#6366F1' },
  inputError: { borderColor: '#EF4444' },
  ensResolved:{ color: '#10B981', fontSize: 12, marginBottom: 8 },
  errText:    { color: '#EF4444', fontSize: 12, marginBottom: 8 },
  saveBtn:    { backgroundColor: '#6366F1', paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 20 },
  saveBtnT:   { color: '#fff', fontSize: 16, fontWeight: '600' },
})


