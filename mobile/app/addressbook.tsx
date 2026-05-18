import { useState, useEffect, useCallback } from "react"
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, Alert, Modal, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from "react-native"
import { router } from "expo-router"
import { goBack } from "../utils/navigation"
import * as Clipboard from "expo-clipboard"
import { ethers } from "ethers"
import { storage } from "../utils/storage"

const ENS_PROVIDER = "https://eth.llamarpc.com"
const STORAGE_KEY  = "kryptonow_address_book"

// --- Types ---
export type Contact = {
  id:       string
  name:     string
  address:  string
  ens?:     string
  note?:    string
  color:    string
  addedAt:  number
  chainId?: number
}

// --- Storage Helpers ---
async function saveContacts(contacts: Contact[]): Promise<void> {
  try { await storage.set(STORAGE_KEY, JSON.stringify(contacts)) } catch {}
}

// --- Helpers ---
const COLORS = [
  "#6366F1","#10B981","#F59E0B","#EF4444","#8B5CF6",
  "#06B6D4","#F43F5E","#84CC16","#0EA5E9","#A855F7",
]

function colorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return COLORS[Math.abs(hash) % COLORS.length]
}

function shortAddr(addr: string): string {
  return addr ? addr.slice(0, 8) + "..." + addr.slice(-6) : ""
}

function initials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)
}

async function resolveENS(input: string): Promise<string | null> {
  try {
    if (!input.endsWith(".eth")) return null
    const provider = new ethers.JsonRpcProvider(ENS_PROVIDER)
    const resolved = await provider.resolveName(input)
    return resolved
  } catch { return null }
}

async function lookupENS(address: string): Promise<string | null> {
  try {
    const provider = new ethers.JsonRpcProvider(ENS_PROVIDER)
    return await provider.lookupAddress(address)
  } catch { return null }
}

// --- Add/Edit Modal ---
function ContactModal({
  visible, contact, onSave, onClose,
}: {
  visible:  boolean
  contact?: Contact | null
  onSave:   (c: Contact) => void
  onClose:  () => void
}) {
  const [name,     setName]     = useState("")
  const [address,  setAddress]  = useState("")
  const [note,     setNote]     = useState("")
  const [resolving,setResolving]= useState(false)
  const [ensResult,setEnsResult]= useState<string | null>(null)
  const [ensError, setEnsError] = useState("")

  useEffect(() => {
    if (visible) {
      setName(contact?.name    ?? "")
      setAddress(contact?.address ?? "")
      setNote(contact?.note    ?? "")
      setEnsResult(contact?.ens ?? null)
      setEnsError("")
    }
  }, [visible, contact])

  async function handleAddressChange(val: string) {
    setAddress(val)
    setEnsResult(null)
    setEnsError("")

    if (val.endsWith(".eth")) {
      setResolving(true)
      const resolved = await resolveENS(val)
      setResolving(false)
      if (resolved) {
        setEnsResult(resolved)
        setAddress(resolved)
      } else {
        setEnsError("ENS name not found")
      }
    } else if (ethers.isAddress(val)) {
      setResolving(true)
      const ens = await lookupENS(val)
      setResolving(false)
      if (ens) setEnsResult(ens)
    }
  }

  function handleSave() {
    const trimName = name.trim()
    const trimAddr = address.trim()
    if (!trimName) { Alert.alert("Error", "Please enter a name"); return }
    if (!ethers.isAddress(trimAddr)) { Alert.alert("Error", "Invalid Ethereum address"); return }

    const saved: Contact = {
      id:      contact?.id ?? Math.random().toString(36).slice(2),
      name:    trimName,
      address: ethers.getAddress(trimAddr),
      ens:     ensResult ?? contact?.ens,
      note:    note.trim() || undefined,
      color:   contact?.color ?? colorFor(trimName),
      addedAt: contact?.addedAt ?? Date.now(),
    }
    onSave(saved)
    onClose()
  }

  const addrValid = ethers.isAddress(address.trim())

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={m.overlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={m.sheet}>
          <View style={m.handle} />
          <Text style={m.title}>{contact ? "Edit Contact" : "Add Contact"}</Text>

          {/* Name */}
          <Text style={m.fieldLabel}>Name</Text>
          <TextInput
            style={m.input}
            value={name}
            onChangeText={setName}
            placeholder="Contact name"
            placeholderTextColor="#CBD5E1"
          />

          {/* Address / ENS */}
          <Text style={m.fieldLabel}>Address or ENS</Text>
          <View style={[m.inputWrap, addrValid && m.inputValid, address.length > 0 && !addrValid && !address.endsWith(".eth") && m.inputError]}>
            <TextInput
              style={[m.input, { marginBottom: 0, borderWidth: 0 }]}
              value={address}
              onChangeText={handleAddressChange}
              placeholder="0x... or name.eth"
              placeholderTextColor="#CBD5E1"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {resolving && <ActivityIndicator size="small" color="#6366F1" style={{ marginRight: 12 }} />}
            {addrValid && !resolving && <Text style={m.validMark}>[OK]</Text>}
          </View>
          {ensResult && (
            <View style={m.ensResult}>
              <Text style={m.ensResultT}>[ENS] {ensResult}</Text>
            </View>
          )}
          {ensError ? <Text style={m.ensError}>[!] {ensError}</Text> : null}

          {/* Note */}
          <Text style={m.fieldLabel}>Note (optional)</Text>
          <TextInput
            style={m.input}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. My friend John"
            placeholderTextColor="#CBD5E1"
          />

          {/* Buttons */}
          <View style={m.btnRow}>
            <TouchableOpacity style={m.cancelBtn} onPress={onClose}>
              <Text style={m.cancelBtnT}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[m.saveBtn, !addrValid && { opacity: 0.4 }]}
              onPress={handleSave}
              disabled={!addrValid}
            >
              <Text style={m.saveBtnT}>{contact ? "Save Changes" : "Add Contact"}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ height: 24 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// --- Contact Row ---
function ContactRow({
  contact, onPress, onEdit, onDelete, onSend, onCopy,
}: {
  contact:  Contact
  onPress:  () => void
  onEdit:   () => void
  onDelete: () => void
  onSend:   () => void
  onCopy:   () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <TouchableOpacity
      style={r.row}
      onPress={() => setExpanded(e => !e)}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View style={[r.avatar, { backgroundColor: contact.color + "20" }]}>
        <Text style={[r.avatarT, { color: contact.color }]}>{initials(contact.name)}</Text>
      </View>

      {/* Info */}
      <View style={r.mid}>
        <Text style={r.name}>{contact.name}</Text>
        <Text style={r.addr}>
          {contact.ens ? `${contact.ens} · ` : ""}{shortAddr(contact.address)}
        </Text>
        {contact.note ? <Text style={r.note}>{contact.note}</Text> : null}
      </View>

      {/* Chevron */}
      <Text style={r.chevron}>{expanded ? "[^]" : "[v]"}</Text>

      {/* Expanded actions */}
      {expanded && (
        <View style={r.actions}>
          <TouchableOpacity style={[r.actionBtn, { backgroundColor: "#EEF2FF" }]} onPress={onSend}>
            <Text style={[r.actionBtnT, { color: "#6366F1" }]}>Send</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[r.actionBtn, { backgroundColor: "#ECFDF5" }]} onPress={onCopy}>
            <Text style={[r.actionBtnT, { color: "#10B981" }]}>Copy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[r.actionBtn, { backgroundColor: "#FFF7ED" }]} onPress={onEdit}>
            <Text style={[r.actionBtnT, { color: "#F59E0B" }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[r.actionBtn, { backgroundColor: "#FEF2F2" }]} onPress={onDelete}>
            <Text style={[r.actionBtnT, { color: "#EF4444" }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  )
}

// --- Main Screen ---
export default function AddressBook() {
  const [contacts,  setContacts]  = useState<Contact[]>([])
  const [search,    setSearch]    = useState("")
  const [modalOpen, setModalOpen] = useState(false)
  const [editing,   setEditing]   = useState<Contact | null>(null)
  const [copied,    setCopied]    = useState("")

  useEffect(() => {
    ;(async () => {
      try {
        const raw = await storage.get(STORAGE_KEY)
        if (raw) setContacts(JSON.parse(raw))
      } catch {}
    })()
  }, [])

  const filtered = contacts.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase()) ||
    (c.ens ?? "").toLowerCase().includes(search.toLowerCase())
  )

  async function handleSave(contact: Contact) {
    const updated = contacts.find(c => c.id === contact.id)
      ? contacts.map(c => c.id === contact.id ? contact : c)
      : [contact, ...contacts]
    setContacts(updated)
    await saveContacts(updated)
  }

  function handleDelete(id: string) {
    Alert.alert(
      "Delete Contact",
      "Are you sure you want to remove this contact?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            const updated = contacts.filter(c => c.id !== id)
            setContacts(updated)
            await saveContacts(updated)
          },
        },
      ]
    )
  }

  async function handleCopy(address: string) {
    await Clipboard.setStringAsync(address)
    setCopied(address)
    setTimeout(() => setCopied(""), 2000)
  }

  function handleSend(contact: Contact) {
    router.push({ pathname: "/send", params: { toAddress: contact.address } } as any)
  }

  function openAdd() {
    setEditing(null)
    setModalOpen(true)
  }

  function openEdit(contact: Contact) {
    setEditing(contact)
    setModalOpen(true)
  }

  return (
    <View style={s.c}>
      {/* Header */}
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => goBack()}>
          <Text style={s.backT}>{"<"}</Text>
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Address Book</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Text style={s.addBtnT}>[+]</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Text style={s.searchIcon}>[S]</Text>
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, address or ENS..."
          placeholderTextColor="#CBD5E1"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Text style={s.clearBtn}>[X]</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stats bar */}
      {contacts.length > 0 && (
        <View style={s.statsBar}>
          <Text style={s.statsT}>{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</Text>
          {search.length > 0 && (
            <Text style={s.statsT}>{filtered.length} result{filtered.length !== 1 ? "s" : ""}</Text>
          )}
        </View>
      )}

      {/* List */}
      {contacts.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>[AB]</Text>
          <Text style={s.emptyTitle}>No contacts yet</Text>
          <Text style={s.emptySub}>Add frequently used addresses so you never have to type them again</Text>
          <TouchableOpacity style={s.emptyBtn} onPress={openAdd}>
            <Text style={s.emptyBtnT}>[+] Add First Contact</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>[S]</Text>
          <Text style={s.emptyTitle}>No results</Text>
          <Text style={s.emptySub}>No contacts match "{search}"</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={c => c.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={true}
          persistentScrollbar={true}
          ItemSeparatorComponent={() => <View style={s.separator} />}
          renderItem={({ item }) => (
            <ContactRow
              contact={item}
              onPress={() => {}}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item.id)}
              onSend={() => handleSend(item)}
              onCopy={() => handleCopy(item.address)}
            />
          )}
          ListFooterComponent={<View style={{ height: 48 }} />}
        />
      )}

      {/* Copied toast */}
      {copied ? (
        <View style={s.toast}>
          <Text style={s.toastT}>[OK] Address copied!</Text>
        </View>
      ) : null}

      {/* Add/Edit Modal */}
      <ContactModal
        visible={modalOpen}
        contact={editing}
        onSave={handleSave}
        onClose={() => setModalOpen(false)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  c:           { flex: 1, backgroundColor: "#F4F7FF" },
  hdr:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EEF2FF" },
  back:        { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F4F7FF", borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  backT:       { color: "#6366F1", fontSize: 18, fontWeight: "700" },
  hdrTitle:    { color: "#1E1B4B", fontSize: 17, fontWeight: "800" },
  addBtn:      { width: 38, height: 38, borderRadius: 12, backgroundColor: "#6366F1", alignItems: "center", justifyContent: "center" },
  addBtnT:     { color: "#fff", fontSize: 16, fontWeight: "800" },
  searchWrap:  { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", margin: 16, borderRadius: 14, borderWidth: 1.5, borderColor: "#EEF2FF", paddingHorizontal: 14, height: 48 },
  searchIcon:  { color: "#94A3B8", fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: "#1E1B4B", fontSize: 15, height: 48 },
  clearBtn:    { color: "#94A3B8", fontSize: 13, fontWeight: "700", paddingLeft: 8 },
  statsBar:    { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 20, marginBottom: 8 },
  statsT:      { color: "#94A3B8", fontSize: 12, fontWeight: "600" },
  list:        { paddingHorizontal: 16 },
  separator:   { height: 8 },
  empty:       { flex: 1, alignItems: "center", justifyContent: "center", padding: 48 },
  emptyIcon:   { fontSize: 48, color: "#CBD5E1", marginBottom: 16 },
  emptyTitle:  { color: "#1E1B4B", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptySub:    { color: "#94A3B8", fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  emptyBtn:    { backgroundColor: "#6366F1", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
  emptyBtnT:   { color: "#fff", fontSize: 15, fontWeight: "700" },
  toast:       { position: "absolute", bottom: 32, left: 40, right: 40, backgroundColor: "#1E1B4B", borderRadius: 14, padding: 14, alignItems: "center" },
  toastT:      { color: "#fff", fontSize: 14, fontWeight: "600" },
})

const r = StyleSheet.create({
  row:         { backgroundColor: "#fff", borderRadius: 20, padding: 16, shadowColor: "#6366F1", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  avatar:      { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginRight: 14 },
  avatarT:     { fontSize: 16, fontWeight: "800" },
  mid:         { flex: 1 },
  name:        { color: "#1E1B4B", fontSize: 15, fontWeight: "700", marginBottom: 3 },
  addr:        { color: "#94A3B8", fontSize: 12, fontFamily: Platform.OS === "ios" ? "Courier" : "monospace" },
  note:        { color: "#64748B", fontSize: 12, marginTop: 3 },
  chevron:     { color: "#CBD5E1", fontSize: 12, fontWeight: "700", alignSelf: "flex-start" },
  actions:     { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
  actionBtn:   { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  actionBtnT:  { fontSize: 13, fontWeight: "700" },
})

const m = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", justifyContent: "flex-end" },
  sheet:       { backgroundColor: "#fff", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12 },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginBottom: 20 },
  title:       { color: "#1E1B4B", fontSize: 18, fontWeight: "800", marginBottom: 20 },
  fieldLabel:  { color: "#64748B", fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  input:       { backgroundColor: "#F8FAFF", borderRadius: 14, borderWidth: 1.5, borderColor: "#E2E8F0", paddingHorizontal: 16, height: 50, color: "#1E1B4B", fontSize: 15, marginBottom: 16 },
  inputWrap:   { flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFF", borderRadius: 14, borderWidth: 1.5, borderColor: "#E2E8F0", marginBottom: 8 },
  inputValid:  { borderColor: "#6EE7B7" },
  inputError:  { borderColor: "#FECACA" },
  validMark:   { color: "#10B981", fontSize: 12, fontWeight: "700", paddingRight: 14 },
  ensResult:   { backgroundColor: "#EEF2FF", borderRadius: 10, padding: 10, marginBottom: 12 },
  ensResultT:  { color: "#6366F1", fontSize: 13, fontWeight: "600" },
  ensError:    { color: "#EF4444", fontSize: 12, marginBottom: 12 },
  btnRow:      { flexDirection: "row", gap: 12, marginTop: 8 },
  cancelBtn:   { flex: 1, paddingVertical: 15, borderRadius: 14, backgroundColor: "#F1F5F9", alignItems: "center" },
  cancelBtnT:  { color: "#64748B", fontSize: 15, fontWeight: "700" },
  saveBtn:     { flex: 2, paddingVertical: 15, borderRadius: 14, backgroundColor: "#6366F1", alignItems: "center" },
  saveBtnT:    { color: "#fff", fontSize: 15, fontWeight: "700" },
})