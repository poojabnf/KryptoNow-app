import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, SafeAreaView, Clipboard,
} from 'react-native'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { ethers } from 'ethers'
import { useTheme } from '../context/ThemeContext'
import { useWalletStore } from '../store/walletStore'
import { useToast } from '../context/ToastContext'
import { getProvider } from '../utils/chains'

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
]

type TokenInfo = {
  address:  string
  name:     string
  symbol:   string
  decimals: number
  balance:  string
}

type CustomToken = TokenInfo & {
  chainId: number
}

const STORAGE_KEY = 'kryptonow_custom_tokens_v1'

function loadCustomTokens(): CustomToken[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw)
    }
  } catch {}
  return []
}

function saveCustomTokens(tokens: CustomToken[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
    }
  } catch {}
}

export function getCustomTokensForChain(chainId: number): CustomToken[] {
  return loadCustomTokens().filter(t => t.chainId === chainId)
}

export default function TokenImportScreen() {
  const { theme } = useTheme()
  const activeChain = useWalletStore(s => s.activeChain)
  const addr        = useWalletStore(s => s.address)
  const toast       = useToast()

  const [contractAddr, setContractAddr] = useState('')
  const [loading,      setLoading]      = useState(false)
  const [tokenInfo,    setTokenInfo]    = useState<TokenInfo | null>(null)
  const [error,        setError]        = useState('')
  const [imported,     setImported]     = useState<CustomToken[]>(
    getCustomTokensForChain(activeChain.id)
  )

  const isValidAddr = ethers.isAddress(contractAddr.trim())

  async function lookup() {
    setError(''); setTokenInfo(null)
    const a = contractAddr.trim()
    if (!ethers.isAddress(a)) { setError('Invalid contract address'); return }

    setLoading(true)
    try {
      const provider = getProvider(activeChain)
      const contract = new ethers.Contract(a, ERC20_ABI, provider)
      const [name, symbol, decimals, rawBal] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
        addr ? contract.balanceOf(addr) : Promise.resolve(0n),
      ])
      const balance = addr
        ? parseFloat(ethers.formatUnits(rawBal, decimals)).toFixed(6)
        : '0'
      setTokenInfo({ address: a, name, symbol, decimals, balance })
    } catch (e: any) {
      setError('Not a valid ERC-20 token on ' + activeChain.name)
    } finally {
      setLoading(false)
    }
  }

  function importToken() {
    if (!tokenInfo) return
    const existing = loadCustomTokens()
    const already  = existing.some(
      t => t.address.toLowerCase() === tokenInfo.address.toLowerCase() && t.chainId === activeChain.id
    )
    if (already) { toast.warning('Token already imported'); return }

    const newEntry: CustomToken = { ...tokenInfo, chainId: activeChain.id }
    const updated = [...existing, newEntry]
    saveCustomTokens(updated)
    setImported(updated.filter(t => t.chainId === activeChain.id))
    setTokenInfo(null)
    setContractAddr('')
    toast.success(`${newEntry.symbol} added to your wallet`)
  }

  function removeToken(address: string) {
    const existing = loadCustomTokens()
    const updated  = existing.filter(
      t => !(t.address.toLowerCase() === address.toLowerCase() && t.chainId === activeChain.id)
    )
    saveCustomTokens(updated)
    setImported(updated.filter(t => t.chainId === activeChain.id))
    toast.info('Token removed')
  }

  async function pasteFromClipboard() {
    try {
      const text = await Clipboard.getString()
      if (text) setContractAddr(text.trim())
    } catch {}
  }

  return (
    <SafeAreaView style={[st.safe, { backgroundColor: theme.bgApp }]}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity style={[st.back, { backgroundColor: theme.bgCard, borderColor: theme.border }]} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </TouchableOpacity>
        <Text style={[st.title, { color: theme.textPrimary }]}>Import Token</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }} showsVerticalScrollIndicator={false}>

        {/* Chain badge */}
        <View style={[st.chainBadge, { backgroundColor: activeChain.color + '15', borderColor: activeChain.color + '40' }]}>
          <View style={[st.chainDot, { backgroundColor: activeChain.color }]} />
          <Text style={[st.chainName, { color: activeChain.color }]}>Importing on {activeChain.name}</Text>
        </View>

        {/* Input */}
        <Text style={[st.label, { color: theme.textSecondary }]}>Token Contract Address</Text>
        <View style={[st.inputWrap, { backgroundColor: theme.bgCard, borderColor: error ? theme.error : isValidAddr ? activeChain.color + '66' : theme.border }]}>
          <TextInput
            style={[st.input, { color: theme.textPrimary }]}
            value={contractAddr}
            onChangeText={v => { setContractAddr(v); setError(''); setTokenInfo(null) }}
            placeholder="0x..."
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity onPress={pasteFromClipboard} style={st.pasteBtn} activeOpacity={0.7}>
            <Text style={[st.pasteBtnT, { color: activeChain.color }]}>Paste</Text>
          </TouchableOpacity>
        </View>
        {!!error && <Text style={[st.errorT, { color: theme.error }]}>{error}</Text>}

        {/* Lookup button */}
        <TouchableOpacity
          style={[st.lookupBtn, { backgroundColor: isValidAddr ? activeChain.color : theme.bgCard, borderColor: theme.border }]}
          onPress={lookup}
          disabled={!isValidAddr || loading}
          activeOpacity={0.85}
        >
          {loading
            ? <ActivityIndicator color={isValidAddr ? '#fff' : theme.textMuted} />
            : <Text style={[st.lookupBtnT, { color: isValidAddr ? '#fff' : theme.textMuted }]}>
                <Ionicons name="search-outline" size={15} /> Search Token
              </Text>
          }
        </TouchableOpacity>

        {/* Token preview */}
        {tokenInfo && (
          <View style={[st.previewCard, { backgroundColor: theme.bgCard, borderColor: activeChain.color + '40' }]}>
            <View style={[st.tokenIcon, { backgroundColor: activeChain.color + '18' }]}>
              <Text style={[st.tokenIconT, { color: activeChain.color }]}>
                {tokenInfo.symbol.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[st.tokenName, { color: theme.textPrimary }]}>{tokenInfo.name}</Text>
              <Text style={[st.tokenSym, { color: theme.textSecondary }]}>{tokenInfo.symbol}  •  {tokenInfo.decimals} decimals</Text>
              <Text style={[st.tokenBal, { color: theme.textMuted }]}>Balance: {tokenInfo.balance} {tokenInfo.symbol}</Text>
            </View>
            <TouchableOpacity
              style={[st.addBtn, { backgroundColor: activeChain.color }]}
              onPress={importToken}
              activeOpacity={0.85}
            >
              <Text style={st.addBtnT}>Add</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Already imported tokens */}
        {imported.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <Text style={[st.sectionLabel, { color: theme.textSecondary }]}>Imported on {activeChain.name}</Text>
            {imported.map(t => (
              <View key={t.address} style={[st.importedRow, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
                <View style={[st.tokenIcon, { backgroundColor: activeChain.color + '15' }]}>
                  <Text style={[st.tokenIconT, { color: activeChain.color }]}>
                    {t.symbol.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.tokenName, { color: theme.textPrimary }]}>{t.name}</Text>
                  <Text style={[st.tokenSym, { color: theme.textMuted }]}>
                    {t.address.slice(0, 10)}...{t.address.slice(-6)}
                  </Text>
                </View>
                <Text style={[st.tokenBal, { color: theme.textSecondary }]}>{t.balance} {t.symbol}</Text>
                <TouchableOpacity
                  style={st.removeBtn}
                  onPress={() => removeToken(t.address)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.error} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Disclaimer */}
        <View style={[st.disclaimer, { backgroundColor: theme.bgCard, borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={16} color={theme.textMuted} style={{ marginRight: 8, flexShrink: 0 }} />
          <Text style={[st.disclaimerT, { color: theme.textMuted }]}>
            Anyone can create a token with any name or symbol. Verify the contract address from official sources before importing.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const st = StyleSheet.create({
  safe:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  back:        { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title:       { fontSize: 18, fontWeight: '700' },
  chainBadge:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, alignSelf: 'flex-start', marginBottom: 20 },
  chainDot:    { width: 6, height: 6, borderRadius: 3 },
  chainName:   { fontSize: 13, fontWeight: '600' },
  label:       { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, marginBottom: 4 },
  input:       { flex: 1, paddingVertical: 14, fontSize: 14, fontFamily: 'monospace' as any },
  pasteBtn:    { paddingLeft: 10 },
  pasteBtnT:   { fontSize: 13, fontWeight: '700' },
  errorT:      { fontSize: 12, marginBottom: 8 },
  lookupBtn:   { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 12, borderWidth: 1 },
  lookupBtnT:  { fontSize: 15, fontWeight: '700' },
  previewCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1.5, padding: 16, gap: 12, marginTop: 16 },
  tokenIcon:   { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  tokenIconT:  { fontSize: 15, fontWeight: '800' },
  tokenName:   { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  tokenSym:    { fontSize: 12, marginBottom: 2 },
  tokenBal:    { fontSize: 12 },
  addBtn:      { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
  addBtnT:     { color: '#fff', fontSize: 14, fontWeight: '700' },
  sectionLabel:{ fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  importedRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, padding: 14, gap: 12, marginBottom: 8 },
  removeBtn:   { padding: 4 },
  disclaimer:  { flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 24 },
  disclaimerT: { flex: 1, fontSize: 12, lineHeight: 18 },
})
