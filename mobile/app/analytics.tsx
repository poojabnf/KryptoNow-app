import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { goBack } from '../utils/navigation'
import { useWalletStore } from '../store/walletStore'
import { useTransactions, Tx, TxType } from '../hooks/useTransactions'

// --- Category definitions -----------------------------------------------------
export type Category =
  | 'swap'
  | 'defi_deposit'
  | 'defi_withdraw'
  | 'nft_buy'
  | 'nft_sell'
  | 'send'
  | 'receive'
  | 'contract'
  | 'gas_fee'
  | 'unknown'

type CategoryMeta = {
  label:    string
  icon:     string
  color:    string
  bgColor:  string
}

const CATEGORY_META: Record<Category, CategoryMeta> = {
  swap:          { label: 'Swap',         icon: '⇄',  color: '#06B6D4', bgColor: '#CFFAFE' },
  defi_deposit:  { label: 'DeFi Deposit', icon: '+',  color: '#10B981', bgColor: '#D1FAE5' },
  defi_withdraw: { label: 'DeFi Withdraw',icon: '-',  color: '#F59E0B', bgColor: '#FEF3C7' },
  nft_buy:       { label: 'NFT Buy',      icon: '*',  color: '#8B5CF6', bgColor: '#EDE9FE' },
  nft_sell:      { label: 'NFT Sell',     icon: '$',  color: '#EC4899', bgColor: '#FCE7F3' },
  send:          { label: 'Send',         icon: '^',  color: '#EF4444', bgColor: '#FEF2F2' },
  receive:       { label: 'Receive',      icon: 'v',  color: '#10B981', bgColor: '#D1FAE5' },
  contract:      { label: 'Contract',     icon: '#',  color: '#6366F1', bgColor: '#EEF2FF' },
  gas_fee:       { label: 'Gas Fee',      icon: 'g',  color: '#94A3B8', bgColor: '#F1F5F9' },
  unknown:       { label: 'Unknown',      icon: '?',  color: '#CBD5E1', bgColor: '#F8FAFF' },
}

// --- Known contract signatures (first 4 bytes of input data) -----------------
const KNOWN_SIGS: Record<string, Category> = {
  // Uniswap v2/v3
  '0x38ed1739': 'swap', '0x8803dbee': 'swap', '0x7ff36ab5': 'swap',
  '0x5c11d795': 'swap', '0x472b43f3': 'swap', '0xb858183f': 'swap',
  '0x04e45aaf': 'swap', '0xe592427a': 'swap', '0x12aa3caf': 'swap',
  // 1inch
  '0x2e95b6c8': 'swap', '0xe449022e': 'swap', '0x3eca9c0a': 'swap',
  // Aave deposit/withdraw
  '0x617ba037': 'defi_deposit', '0xe8eda9df': 'defi_deposit',
  '0x69328dec': 'defi_withdraw','0x2e7dc6af': 'defi_withdraw',
  // Compound
  '0xa0712d68': 'defi_deposit', '0xdb006a75': 'defi_withdraw',
  // Lido staking
  '0xa1903eab': 'defi_deposit',
  // OpenSea / NFT
  '0xfb0f3ee1': 'nft_buy',  '0xab834bab': 'nft_buy',
  '0x96809f90': 'nft_buy',  '0xb3a34c4c': 'nft_sell',
}

// --- Categorise a single transaction -----------------------------------------
export function categorise(tx: Tx): Category {
  // Native ETH sends/receives with no contract call
  if (tx.type === 'receive' && !tx.isERC20) return 'receive'
  if (tx.type === 'send'    && !tx.isERC20) return 'send'
  if (tx.type === 'token_receive') return 'receive'
  if (tx.type === 'token_send')    return 'send'

  // Contract interactions - try to identify by signature
  if (tx.type === 'contract') {
    // We don't have raw input data in our Tx type right now, but
    // we can pattern-match on token symbols and known DEX tokens
    return 'contract'
  }

  return 'unknown'
}

// --- Summary stats ------------------------------------------------------------
type CategorySummary = {
  category:  Category
  count:     number
  totalETH:  number
  txs:       Tx[]
}

function summarise(txs: Tx[]): CategorySummary[] {
  const map = new Map<Category, CategorySummary>()

  for (const tx of txs) {
    const cat = categorise(tx)
    if (!map.has(cat)) {
      map.set(cat, { category: cat, count: 0, totalETH: 0, txs: [] })
    }
    const entry = map.get(cat)!
    entry.count++
    entry.totalETH += parseFloat(tx.value) || 0
    entry.txs.push(tx)
  }

  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

function relTime(ts: number) {
  const d = Math.floor(Date.now() / 1000) - ts
  if (d < 60)    return `${d}s ago`
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

// --- Category pill ------------------------------------------------------------
function CategoryPill({ cat }: { cat: Category }) {
  const meta = CATEGORY_META[cat]
  return (
    <View style={[pill.wrap, { backgroundColor: meta.bgColor }]}>
      <Text style={[pill.icon, { color: meta.color }]}>{meta.icon}</Text>
      <Text style={[pill.label, { color: meta.color }]}>{meta.label}</Text>
    </View>
  )
}

// --- Transaction row ----------------------------------------------------------
function TxRow({ tx }: { tx: Tx }) {
  const cat  = categorise(tx)
  const meta = CATEGORY_META[cat]
  const isSend = tx.type === 'send' || tx.type === 'token_send'

  return (
    <View style={r.row}>
      <View style={[r.iconWrap, { backgroundColor: meta.bgColor }]}>
        <Text style={[r.icon, { color: meta.color }]}>{meta.icon}</Text>
      </View>
      <View style={r.mid}>
        <View style={r.topRow}>
          <Text style={r.label}>{meta.label}</Text>
          <CategoryPill cat={cat} />
        </View>
        <Text style={r.addr} numberOfLines={1}>
          {isSend
            ? `To: ${tx.to.slice(0, 6)}...${tx.to.slice(-4)}`
            : `From: ${tx.from.slice(0, 6)}...${tx.from.slice(-4)}`}
        </Text>
        <Text style={r.time}>{relTime(tx.timestamp)}</Text>
      </View>
      <Text style={[r.amount, { color: isSend ? '#EF4444' : '#10B981' }]}>
        {isSend ? '-' : '+'}{parseFloat(tx.value).toFixed(4)} {tx.symbol}
      </Text>
    </View>
  )
}

// --- Main Screen --------------------------------------------------------------
export default function Analytics() {
  const addr = useWalletStore(s => s.address)
  const { txns, loading, error, refresh } = useTransactions(addr)

  const [activeFilter, setActiveFilter] = useState<Category | 'all'>('all')

  useEffect(() => { refresh() }, [])

  const summaries  = summarise(txns)
  const filtered   = activeFilter === 'all'
    ? txns
    : txns.filter(tx => categorise(tx) === activeFilter)

  const totalTxns  = txns.length
  const categories = summaries.map(s => s.category)

  return (
    <View style={s.c}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => goBack()}>
          <Text style={s.backT}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={s.hdrTitle}>Transaction Analytics</Text>
        <TouchableOpacity onPress={refresh}>
          <Text style={{ color: '#6366F1', fontSize: 18 }}>{'r'}</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(tx, i) => tx.hash + i}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#6366F1" />
        }
        ListHeaderComponent={
          <>
            {/* Summary cards */}
            {!loading && summaries.length > 0 && (
              <View style={s.summaryGrid}>
                {summaries.slice(0, 4).map(sum => {
                  const meta = CATEGORY_META[sum.category]
                  return (
                    <TouchableOpacity
                      key={sum.category}
                      style={[
                        s.summaryCard,
                        activeFilter === sum.category && { borderColor: meta.color, borderWidth: 2 },
                      ]}
                      onPress={() => setActiveFilter(
                        activeFilter === sum.category ? 'all' : sum.category
                      )}
                      activeOpacity={0.8}
                    >
                      <View style={[s.summaryIcon, { backgroundColor: meta.bgColor }]}>
                        <Text style={[s.summaryIconT, { color: meta.color }]}>{meta.icon}</Text>
                      </View>
                      <Text style={s.summaryCount}>{sum.count}</Text>
                      <Text style={s.summaryLabel}>{meta.label}</Text>
                      <Text style={s.summaryPct}>
                        {totalTxns > 0 ? Math.round((sum.count / totalTxns) * 100) : 0}%
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            )}

            {/* Filter tabs */}
            <View style={s.filterScroll}>
              <TouchableOpacity
                style={[s.filterTab, activeFilter === 'all' && s.filterTabActive]}
                onPress={() => setActiveFilter('all')}
              >
                <Text style={[s.filterTabT, activeFilter === 'all' && s.filterTabTActive]}>
                  All ({txns.length})
                </Text>
              </TouchableOpacity>
              {categories.map(cat => {
                const meta = CATEGORY_META[cat]
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      s.filterTab,
                      activeFilter === cat && { backgroundColor: meta.color, borderColor: meta.color },
                    ]}
                    onPress={() => setActiveFilter(cat)}
                  >
                    <Text style={[
                      s.filterTabT,
                      activeFilter === cat && { color: '#fff' },
                    ]}>
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            <Text style={s.sectionLabel}>
              {activeFilter === 'all'
                ? `${txns.length} transactions`
                : `${filtered.length} ${CATEGORY_META[activeFilter as Category]?.label} transactions`}
            </Text>
          </>
        }
        ListEmptyComponent={
          loading ? (
            <View style={s.center}>
              <ActivityIndicator color="#6366F1" />
              <Text style={s.centerT}>Loading transactions...</Text>
            </View>
          ) : error ? (
            <View style={s.center}>
              <Text style={s.centerT}>Could not load transactions</Text>
              <TouchableOpacity style={s.retryBtn} onPress={refresh}>
                <Text style={s.retryBtnT}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.center}>
              <Text style={s.centerT}>No transactions found</Text>
            </View>
          )
        }
        renderItem={({ item }) => <TxRow tx={item} />}
      />
    </View>
  )
}

const s = StyleSheet.create({
  c:              { flex: 1, backgroundColor: '#F8FAFF' },
  hdr:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  back:           { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  backT:          { color: '#6366F1', fontSize: 18, fontWeight: '700' },
  hdrTitle:       { color: '#1E1B4B', fontSize: 17, fontWeight: '700' },
  summaryGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  summaryCard:    { width: '47%', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, alignItems: 'center' },
  summaryIcon:    { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  summaryIconT:   { fontSize: 18, fontWeight: '700' },
  summaryCount:   { color: '#1E1B4B', fontSize: 24, fontWeight: '800' },
  summaryLabel:   { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 2 },
  summaryPct:     { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  filterScroll:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  filterTab:      { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0' },
  filterTabActive:{ backgroundColor: '#6366F1', borderColor: '#6366F1' },
  filterTabT:     { color: '#64748B', fontSize: 12, fontWeight: '600' },
  filterTabTActive:{ color: '#fff' },
  sectionLabel:   { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 10 },
  center:         { paddingVertical: 48, alignItems: 'center' },
  centerT:        { color: '#94A3B8', fontSize: 14, marginTop: 12 },
  retryBtn:       { marginTop: 16, backgroundColor: '#6366F1', paddingVertical: 10, paddingHorizontal: 24, borderRadius: 12 },
  retryBtnT:      { color: '#fff', fontSize: 14, fontWeight: '600' },
})

const r = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9', gap: 12 },
  iconWrap:{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon:    { fontSize: 16, fontWeight: '700' },
  mid:     { flex: 1 },
  topRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  label:   { color: '#1E1B4B', fontSize: 13, fontWeight: '600' },
  addr:    { color: '#94A3B8', fontSize: 11, marginBottom: 2 },
  time:    { color: '#CBD5E1', fontSize: 10 },
  amount:  { fontSize: 13, fontWeight: '700', flexShrink: 0 },
})

const pill = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 2, paddingHorizontal: 7, borderRadius: 20, gap: 3 },
  icon:  { fontSize: 10, fontWeight: '700' },
  label: { fontSize: 10, fontWeight: '600' },
})
