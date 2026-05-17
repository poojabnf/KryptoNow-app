import { useState, useEffect, useRef } from "react"
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, Animated, FlatList, ActivityIndicator, Alert,
} from "react-native"
import { Chain } from "../utils/chains"
import { Ionicons } from "@expo/vector-icons"
import {
  CustomToken, POPULAR_TOKENS, loadCustomTokens, saveCustomToken,
  removeCustomToken, lookupContractToken, searchPopularTokens,
} from "../utils/tokenSearch"

type TabKey = "search" | "custom"

function TokenRow({
  token, onAdd, onRemove, isAdded, isCustom,
}: {
  token: Omit<CustomToken, "addedAt" | "verified" | "chainId"> & Partial<CustomToken>
  onAdd:    () => void
  onRemove?: () => void
  isAdded:  boolean
  isCustom: boolean
}) {
  return (
    <View style={r.row}>
      <View style={[r.dot, { backgroundColor: token.color + "20" }]}>
        <Text style={[r.dotT, { color: token.color }]}>{token.symbol.slice(0, 2)}</Text>
      </View>
      <View style={r.mid}>
        <View style={r.topRow}>
          <Text style={r.sym}>{token.symbol}</Text>
          {isCustom && !("verified" in token && token.verified) && (
            <View style={r.unverifiedBadge}>
              <View style={{ flexDirection:"row", alignItems:"center", gap:3 }}>
                <Ionicons name="help-circle-outline" size={11} color="#F59E0B" />
                <Text style={r.unverifiedT}>Unverified</Text>
              </View>
            </View>
          )}
        </View>
        <Text style={r.name} numberOfLines={1}>{token.name}</Text>
        <Text style={r.addr} numberOfLines={1}>
          {token.address.slice(0, 8)}...{token.address.slice(-6)}
        </Text>
        {"balance" in token && token.balance && parseFloat(token.balance) > 0 && (
          <Text style={r.balance}>Balance: {token.balance} {token.symbol}</Text>
        )}
      </View>
      {isAdded ? (
        <TouchableOpacity
          style={r.removeBtn}
          onPress={onRemove}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={16} color="#EF4444" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={r.addBtn}
          onPress={onAdd}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection:"row", alignItems:"center", gap:4 }}>
            <Ionicons name="add" size={14} color="#6366F1" />
            <Text style={r.addBtnT}>Add</Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  )
}

export default function TokenSearchModal({
  visible, chain, walletAddress, onClose, onTokenAdded,
}: {
  visible:       boolean
  chain:         Chain
  walletAddress: string
  onClose:       () => void
  onTokenAdded:  (token: CustomToken) => void
}) {
  const slideAnim = useRef(new Animated.Value(700)).current

  const [tab,           setTab]           = useState<TabKey>("search")
  const [query,         setQuery]         = useState("")
  const [contractInput, setContractInput] = useState("")
  const [results,       setResults]       = useState<ReturnType<typeof searchPopularTokens>>([])
  const [customTokens,  setCustomTokens]  = useState<CustomToken[]>([])
  const [lookupResult,  setLookupResult]  = useState<CustomToken | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError,   setLookupError]   = useState("")
  const [addedAddresses,setAddedAddresses]= useState<Set<string>>(new Set())

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 700,
      useNativeDriver: true,
      tension: 65, friction: 11,
    }).start()
    if (visible) {
      loadData()
      setQuery("")
      setContractInput("")
      setLookupResult(null)
      setLookupError("")
    }
  }, [visible])

  useEffect(() => {
    setResults(searchPopularTokens(query, chain.id))
  }, [query, chain.id])

  function loadData() {
    const saved = loadCustomTokens(chain.id)
    setCustomTokens(saved)
    setAddedAddresses(new Set(saved.map(t => t.address.toLowerCase())))
  }

  async function handleLookup() {
    const addr = contractInput.trim()
    if (!addr) return
    if (addr.length !== 42 || !addr.startsWith("0x")) {
      setLookupError("Enter a valid 0x contract address (42 chars)")
      return
    }
    setLookupLoading(true)
    setLookupError("")
    setLookupResult(null)
    try {
      const token = await lookupContractToken(addr, chain, walletAddress)
      setLookupResult(token)
    } catch (e: any) {
      setLookupError(e?.message ?? "Could not fetch token info. Is this a valid ERC-20?")
    } finally {
      setLookupLoading(false)
    }
  }

  function handleAdd(token: Omit<CustomToken, "addedAt" | "verified" | "chainId"> & Partial<CustomToken>) {
    const full: CustomToken = {
      address:  token.address,
      symbol:   token.symbol,
      name:     token.name,
      decimals: token.decimals ?? 18,
      color:    token.color,
      chainId:  chain.id,
      verified: false,
      balance:  token.balance,
      addedAt:  Date.now(),
    }
    saveCustomToken(full)
    setAddedAddresses(prev => new Set([...prev, full.address.toLowerCase()]))
    loadData()
    onTokenAdded(full)
    Alert.alert(
      "Token Added",
      `${full.symbol} has been added to your token list on ${chain.name}.`
    )
  }

  function handleRemove(address: string) {
    Alert.alert(
      "Remove Token",
      "Remove this token from your list?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove", style: "destructive",
          onPress: () => {
            removeCustomToken(address, chain.id)
            setAddedAddresses(prev => {
              const next = new Set(prev)
              next.delete(address.toLowerCase())
              return next
            })
            loadData()
          },
        },
      ]
    )
  }

  const isAdded = (address: string) =>
    addedAddresses.has(address.toLowerCase())

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={s.handle} />

        {/* Header */}
        <View style={s.hdr}>
          <View style={s.hdrLeft}>
            <Text style={s.hdrTitle}>Token Search</Text>
            <View style={[s.chainBadge, { backgroundColor: chain.color + "20" }]}>
              <Text style={[s.chainBadgeT, { color: chain.color }]}>{chain.name}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          {([
            { key: "search", label: "Search"   },
            { key: "custom", label: "Custom"   },
          ] as { key: TabKey; label: string }[]).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.tab, tab === t.key && s.tabActive]}
              onPress={() => setTab(t.key)}
            >
              <Text style={[s.tabT, tab === t.key && s.tabTActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* --- SEARCH TAB --- */}
        {tab === "search" && (
          <View style={{ flex: 1 }}>
            <View style={s.searchWrap}>
              <Ionicons name="search-outline" size={16} color="#94A3B8" style={{ paddingLeft:4 }} />
              <TextInput
                style={s.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Search by name or symbol..."
                placeholderTextColor="#CBD5E1"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery("")}>
                  <Ionicons name="close-circle" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={results}
              keyExtractor={t => t.address}
              style={s.list}
              showsVerticalScrollIndicator={true}
              persistentScrollbar={true}
              ListHeaderComponent={
                <Text style={s.listHdr}>
                  {query ? `${results.length} results` : `Popular on ${chain.name}`}
                </Text>
              }
              ListEmptyComponent={
                <View style={s.empty}>
                  <Text style={s.emptyT}>No tokens found for "{query}"</Text>
                  <Text style={s.emptySub}>Try the Custom tab to add by contract address</Text>
                </View>
              }
              renderItem={({ item }) => (
                <TokenRow
                  token={item}
                  isAdded={isAdded(item.address)}
                  isCustom={false}
                  onAdd={() => handleAdd(item)}
                  onRemove={() => handleRemove(item.address)}
                />
              )}
            />
          </View>
        )}

        {/* --- CUSTOM TAB --- */}
        {tab === "custom" && (
          <View style={{ flex: 1 }}>

            {/* Contract input */}
            <View style={s.contractSection}>
              <Text style={s.contractLabel}>Paste Contract Address</Text>
              <View style={s.contractInputWrap}>
                <TextInput
                  style={s.contractInput}
                  value={contractInput}
                  onChangeText={v => {
                    setContractInput(v)
                    setLookupResult(null)
                    setLookupError("")
                  }}
                  placeholder="0x..."
                  placeholderTextColor="#CBD5E1"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {lookupError ? (
                <View style={s.errorBox}>
                  <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                    <Ionicons name="warning-outline" size={14} color="#EF4444" />
                    <Text style={s.errorT}>{lookupError}</Text>
                  </View>
                </View>
              ) : null}

              <TouchableOpacity
                style={[
                  s.lookupBtn,
                  { backgroundColor: chain.color },
                  (!contractInput.trim() || lookupLoading) && { opacity: 0.4 },
                ]}
                onPress={handleLookup}
                disabled={!contractInput.trim() || lookupLoading}
              >
                {lookupLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                    <Ionicons name="search-outline" size={15} color="#fff" />
                    <Text style={s.lookupBtnT}>Look Up Token</Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Lookup result */}
              {lookupResult && (
                <View style={s.lookupResult}>
                  <View style={s.lookupResultHdr}>
                    <Text style={s.lookupResultTitle}>Token Found</Text>
                    <View style={s.unverifiedPill}>
                      <View style={{ flexDirection:"row", alignItems:"center", gap:4 }}>
                        <Ionicons name="help-circle-outline" size={12} color="#F59E0B" />
                        <Text style={s.unverifiedPillT}>Unverified</Text>
                      </View>
                    </View>
                  </View>
                  <View style={s.lookupDetails}>
                    {[
                      { l:"Name",     v: lookupResult.name     },
                      { l:"Symbol",   v: lookupResult.symbol   },
                      { l:"Decimals", v: String(lookupResult.decimals) },
                      { l:"Balance",  v: `${lookupResult.balance} ${lookupResult.symbol}` },
                      { l:"Contract", v: lookupResult.address.slice(0,10)+"..."+lookupResult.address.slice(-8) },
                    ].map(row => (
                      <View key={row.l} style={s.lookupRow}>
                        <Text style={s.lookupL}>{row.l}</Text>
                        <Text style={s.lookupV}>{row.v}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={s.warningBox}>
                    <View style={{ flexDirection:"row", gap:8 }}>
                      <Ionicons name="shield-outline" size={14} color="#C2410C" style={{ marginTop:1 }} />
                      <Text style={[s.warningT, { flex:1 }]}>Always verify contract addresses from official sources. Scam tokens can mimic real ones.</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[s.addTokenBtn, { backgroundColor: chain.color }]}
                    onPress={() => handleAdd(lookupResult)}
                  >
                    <View style={{ flexDirection:"row", alignItems:"center", gap:6 }}>
                      <Ionicons name="add-circle-outline" size={16} color="#fff" />
                      <Text style={s.addTokenBtnT}>Add {lookupResult.symbol} to Wallet</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Saved custom tokens */}
            {customTokens.length > 0 && (
              <View style={{ flex: 1 }}>
                <Text style={s.savedHdr}>Saved Custom Tokens ({customTokens.length})</Text>
                <FlatList
                  data={customTokens}
                  keyExtractor={t => t.address}
                  style={s.list}
                  showsVerticalScrollIndicator={true}
                  renderItem={({ item }) => (
                    <TokenRow
                      token={item}
                      isAdded={true}
                      isCustom={true}
                      onAdd={() => {}}
                      onRemove={() => handleRemove(item.address)}
                    />
                  )}
                />
              </View>
            )}

            {customTokens.length === 0 && !lookupResult && (
              <View style={s.empty}>
                <Text style={s.emptyT}>No custom tokens yet</Text>
                <Text style={s.emptySub}>Paste a contract address above to add any ERC-20 token</Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay:          { ...StyleSheet.absoluteFillObject, backgroundColor:"rgba(15,23,42,0.5)" },
  sheet:            { position:"absolute", bottom:0, left:0, right:0, backgroundColor:"#fff", borderTopLeftRadius:28, borderTopRightRadius:28, maxHeight:"90%", paddingTop:12 },
  handle:           { width:36, height:4, borderRadius:2, backgroundColor:"#E2E8F0", alignSelf:"center", marginBottom:16 },
  hdr:              { flexDirection:"row", alignItems:"center", justifyContent:"space-between", paddingHorizontal:20, marginBottom:14 },
  hdrLeft:          { flexDirection:"row", alignItems:"center", gap:10 },
  hdrTitle:         { color:"#1E1B4B", fontSize:17, fontWeight:"700" },
  chainBadge:       { paddingVertical:4, paddingHorizontal:10, borderRadius:12 },
  chainBadgeT:      { fontSize:12, fontWeight:"700" },
  closeBtn:         { width:32, height:32, borderRadius:16, backgroundColor:"#F1F5F9", alignItems:"center", justifyContent:"center" },
  closeBtnT:        { color:"#64748B", fontSize:12, fontWeight:"700" },
  tabRow:           { flexDirection:"row", marginHorizontal:16, marginBottom:12, backgroundColor:"#F1F5F9", borderRadius:14, padding:4 },
  tab:              { flex:1, paddingVertical:10, alignItems:"center", borderRadius:11 },
  tabActive:        { backgroundColor:"#fff", shadowColor:"#64748B", shadowOffset:{width:0,height:1}, shadowOpacity:0.08, shadowRadius:4, elevation:2 },
  tabT:             { color:"#94A3B8", fontSize:13, fontWeight:"600" },
  tabTActive:       { color:"#1E1B4B", fontWeight:"700" },
  searchWrap:       { flexDirection:"row", alignItems:"center", backgroundColor:"#F8FAFF", borderRadius:14, borderWidth:1.5, borderColor:"#E2E8F0", paddingHorizontal:14, marginHorizontal:16, marginBottom:8, height:48 },
  searchIcon:       { color:"#94A3B8", fontSize:14, marginRight:8 },
  searchInput:      { flex:1, color:"#1E1B4B", fontSize:15, height:48 },
  clearBtn:         { color:"#94A3B8", fontSize:13, fontWeight:"700", marginLeft:8 },
  list:             { flex:1, paddingHorizontal:16 },
  listHdr:          { color:"#94A3B8", fontSize:12, fontWeight:"600", textTransform:"uppercase", letterSpacing:0.5, marginBottom:8, marginTop:4 },
  empty:            { alignItems:"center", padding:40 },
  emptyT:           { color:"#1E1B4B", fontSize:15, fontWeight:"600", marginBottom:6, textAlign:"center" },
  emptySub:         { color:"#94A3B8", fontSize:13, textAlign:"center", lineHeight:20 },
  contractSection:  { paddingHorizontal:16, paddingBottom:8 },
  contractLabel:    { color:"#64748B", fontSize:13, fontWeight:"600", textTransform:"uppercase", letterSpacing:0.3, marginBottom:8 },
  contractInputWrap:{ backgroundColor:"#F8FAFF", borderRadius:14, borderWidth:1.5, borderColor:"#E2E8F0", paddingHorizontal:16, height:52, justifyContent:"center", marginBottom:10 },
  contractInput:    { color:"#1E1B4B", fontSize:14, height:52, fontFamily: "monospace" },
  errorBox:         { backgroundColor:"#FEF2F2", borderRadius:10, padding:12, marginBottom:10, borderWidth:1, borderColor:"#FECACA" },
  errorT:           { color:"#EF4444", fontSize:13 },
  lookupBtn:        { borderRadius:14, paddingVertical:14, alignItems:"center", marginBottom:14 },
  lookupBtnT:       { color:"#fff", fontSize:15, fontWeight:"700" },
  lookupResult:     { backgroundColor:"#F8FAFF", borderRadius:16, borderWidth:1.5, borderColor:"#E2E8F0", padding:16, marginBottom:8 },
  lookupResultHdr:  { flexDirection:"row", alignItems:"center", gap:10, marginBottom:12 },
  lookupResultTitle:{ color:"#1E1B4B", fontSize:15, fontWeight:"700" },
  unverifiedPill:   { backgroundColor:"#FEF3C7", paddingVertical:3, paddingHorizontal:8, borderRadius:8 },
  unverifiedPillT:  { color:"#D97706", fontSize:11, fontWeight:"600" },
  lookupDetails:    { backgroundColor:"#fff", borderRadius:12, borderWidth:1, borderColor:"#E2E8F0", overflow:"hidden", marginBottom:12 },
  lookupRow:        { flexDirection:"row", justifyContent:"space-between", padding:12, borderBottomWidth:1, borderBottomColor:"#F8FAFF" },
  lookupL:          { color:"#94A3B8", fontSize:13 },
  lookupV:          { color:"#1E1B4B", fontSize:13, fontWeight:"600" },
  warningBox:       { backgroundColor:"#FFF7ED", borderRadius:10, padding:12, marginBottom:12, borderWidth:1, borderColor:"#FED7AA" },
  warningT:         { color:"#C2410C", fontSize:12, lineHeight:18 },
  addTokenBtn:      { borderRadius:14, paddingVertical:14, alignItems:"center" },
  addTokenBtnT:     { color:"#fff", fontSize:15, fontWeight:"700" },
  savedHdr:         { color:"#94A3B8", fontSize:12, fontWeight:"600", textTransform:"uppercase", letterSpacing:0.5, paddingHorizontal:16, marginBottom:8, marginTop:4 },
})

const r = StyleSheet.create({
  row:            { flexDirection:"row", alignItems:"center", backgroundColor:"#fff", borderRadius:14, padding:14, marginBottom:8, borderWidth:1, borderColor:"#F1F5F9", gap:12 },
  dot:            { width:42, height:42, borderRadius:21, alignItems:"center", justifyContent:"center" },
  dotT:           { fontSize:14, fontWeight:"800" },
  mid:            { flex:1 },
  topRow:         { flexDirection:"row", alignItems:"center", gap:6, marginBottom:2 },
  sym:            { color:"#1E1B4B", fontSize:15, fontWeight:"700" },
  unverifiedBadge:{ backgroundColor:"#FEF3C7", paddingVertical:2, paddingHorizontal:6, borderRadius:6 },
  unverifiedT:    { color:"#D97706", fontSize:10, fontWeight:"600" },
  name:           { color:"#64748B", fontSize:12, marginBottom:2 },
  addr:           { color:"#CBD5E1", fontSize:11, fontFamily:"monospace" },
  balance:        { color:"#10B981", fontSize:11, fontWeight:"600", marginTop:2 },
  addBtn:         { backgroundColor:"#EEF2FF", paddingVertical:8, paddingHorizontal:14, borderRadius:10, borderWidth:1.5, borderColor:"#C7D2FE" },
  addBtnT:        { color:"#6366F1", fontSize:12, fontWeight:"700" },
  removeBtn:      { backgroundColor:"#FEF2F2", paddingVertical:8, paddingHorizontal:14, borderRadius:10, borderWidth:1.5, borderColor:"#FECACA" },
  removeBtnT:     { color:"#EF4444", fontSize:12, fontWeight:"700" },
})