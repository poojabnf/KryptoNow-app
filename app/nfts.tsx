/**
 * app/nfts.tsx
 * NFT Gallery — fetches NFTs via Alchemy NFT API across all chains
 * Install: already using ethers — no new packages needed
 * Alchemy NFT API is free tier: 300M compute units/month
 */

import { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  Image, ActivityIndicator, RefreshControl, Modal,
  ScrollView, Linking, Dimensions, Alert,
} from 'react-native'
import { router } from 'expo-router'
import { useWalletStore } from '../store/walletStore'

const { width: SCREEN_W } = Dimensions.get('window')
const CARD_W = (SCREEN_W - 48) / 2   // 2-column grid with 16px padding + 16px gap

const ALCHEMY_KEY = 'HJfOuVkHmg_PM66WyXNjT'  // ← replace — free at alchemy.com

const ALCHEMY_BASE: Record<number, string> = {
  1:     `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}`,
  137:   `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}`,
  42161: `https://arb-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}`,
  10:    `https://opt-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}`,
}

const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum', 137: 'Polygon', 42161: 'Arbitrum', 10: 'Optimism', 56: 'BNB Chain',
}

export type NFT = {
  tokenId:         string
  contractAddress: string
  name:            string
  description:     string
  image:           string
  collection:      string
  floorPrice?:     number
  floorSymbol?:    string
  chainId:         number
  tokenType:       'ERC721' | 'ERC1155'
  attributes?:     { trait_type: string; value: string }[]
}

// ─── Fetch NFTs from Alchemy ──────────────────────────────────────────────────
async function fetchNFTs(address: string, chainId: number): Promise<NFT[]> {
  const base = ALCHEMY_BASE[chainId]
  if (!base) return []

  try {
    const res  = await fetch(
      `${base}/getNFTsForOwner?owner=${address}&withMetadata=true&pageSize=100`
    )
    const data = await res.json()
    const nfts = (data.ownedNfts ?? []) as any[]

    return nfts.map(n => {
      // Resolve image URL — handle ipfs:// and arweave://
      let image = n.image?.cachedUrl
        ?? n.image?.originalUrl
        ?? n.image?.thumbnailUrl
        ?? ''
      if (image.startsWith('ipfs://')) {
        image = `https://ipfs.io/ipfs/${image.slice(7)}`
      }
      if (image.startsWith('ar://')) {
        image = `https://arweave.net/${image.slice(5)}`
      }

      return {
        tokenId:         n.tokenId ?? '0',
        contractAddress: n.contract?.address ?? '',
        name:            n.name ?? n.contract?.name ?? `#${n.tokenId}`,
        description:     n.description ?? '',
        image,
        collection:      n.contract?.name ?? 'Unknown Collection',
        floorPrice:      n.contract?.openSeaMetadata?.floorPrice ?? undefined,
        floorSymbol:     'ETH',
        chainId,
        tokenType:       n.tokenType ?? 'ERC721',
        attributes:      n.raw?.metadata?.attributes ?? [],
      }
    })
  } catch {
    return []
  }
}

// ─── NFT Detail Modal ─────────────────────────────────────────────────────────
function NFTDetail({
  nft, visible, onClose, onSend,
}: {
  nft: NFT | null; visible: boolean; onClose: () => void; onSend: (nft: NFT) => void
}) {
  if (!nft) return null
  const chainColor: Record<number, string> = {
    1: '#6366F1', 137: '#8247E5', 42161: '#1B4ADD', 10: '#FF0420', 56: '#F0B90B',
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={d.overlay}>
        <View style={d.sheet}>
          <View style={d.handleRow}>
            <View style={d.handle} />
            <TouchableOpacity style={d.closeBtn} onPress={onClose}>
              <Text style={d.closeBtnT}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Image */}
            <View style={d.imgWrap}>
              {nft.image ? (
                <Image source={{ uri: nft.image }} style={d.img} resizeMode="cover" />
              ) : (
                <View style={[d.img, d.imgPlaceholder]}>
                  <Text style={{ fontSize: 48 }}>🖼</Text>
                </View>
              )}
              <View style={[d.chainBadge, { backgroundColor: chainColor[nft.chainId] ?? '#6366F1' }]}>
                <Text style={d.chainBadgeT}>{CHAIN_NAMES[nft.chainId]}</Text>
              </View>
            </View>

            <View style={d.content}>
              <Text style={d.collection}>{nft.collection}</Text>
              <Text style={d.name}>{nft.name}</Text>

              {nft.floorPrice && (
                <View style={d.floorRow}>
                  <Text style={d.floorLabel}>Floor Price</Text>
                  <Text style={d.floorVal}>{nft.floorPrice} {nft.floorSymbol}</Text>
                </View>
              )}

              {nft.description ? (
                <Text style={d.desc} numberOfLines={4}>{nft.description}</Text>
              ) : null}

              {/* Attributes */}
              {nft.attributes && nft.attributes.length > 0 && (
                <>
                  <Text style={d.attrTitle}>Traits</Text>
                  <View style={d.attrGrid}>
                    {nft.attributes.slice(0, 12).map((attr, i) => (
                      <View key={i} style={d.attrCard}>
                        <Text style={d.attrType} numberOfLines={1}>{attr.trait_type}</Text>
                        <Text style={d.attrVal}  numberOfLines={1}>{attr.value}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              {/* Details */}
              <View style={d.detailCard}>
                {[
                  ['Token ID',    `#${nft.tokenId}`],
                  ['Contract',    nft.contractAddress.slice(0,10) + '…' + nft.contractAddress.slice(-6)],
                  ['Token Type',  nft.tokenType],
                  ['Chain',       CHAIN_NAMES[nft.chainId]],
                ].map(([l, v]) => (
                  <View key={l} style={d.detailRow}>
                    <Text style={d.detailL}>{l}</Text>
                    <Text style={d.detailV}>{v}</Text>
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={d.openseaBtn}
                onPress={() => Linking.openURL(`https://opensea.io/assets/${nft.chainId === 1 ? 'ethereum' : 'matic'}/${nft.contractAddress}/${nft.tokenId}`)}
              >
                <Text style={d.openseaBtnT}>View on OpenSea ↗</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={d.actions}>
            <TouchableOpacity style={d.sendBtn} onPress={() => { onClose(); onSend(nft) }}>
              <Text style={d.sendBtnT}>↑  Send NFT</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─── NFT Card ─────────────────────────────────────────────────────────────────
function NFTCard({ nft, onPress }: { nft: NFT; onPress: () => void }) {
  const [imgError, setImgError] = useState(false)
  const chainColor: Record<number, string> = {
    1: '#6366F1', 137: '#8247E5', 42161: '#1B4ADD', 10: '#FF0420', 56: '#F0B90B',
  }
  return (
    <TouchableOpacity style={[g.card, { width: CARD_W }]} onPress={onPress} activeOpacity={0.85}>
      <View style={g.imgContainer}>
        {nft.image && !imgError ? (
          <Image
            source={{ uri: nft.image }}
            style={g.img}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[g.img, g.imgPlaceholder]}>
            <Text style={{ fontSize: 36 }}>🖼</Text>
          </View>
        )}
        <View style={[g.chainDot, { backgroundColor: chainColor[nft.chainId] ?? '#6366F1' }]} />
      </View>
      <View style={g.info}>
        <Text style={g.collection} numberOfLines={1}>{nft.collection}</Text>
        <Text style={g.name} numberOfLines={1}>{nft.name}</Text>
        {nft.floorPrice ? (
          <Text style={g.floor}>{nft.floorPrice} {nft.floorSymbol}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  )
}

// ─── Send NFT Modal ───────────────────────────────────────────────────────────
function SendNFTModal({
  nft, visible, onClose,
}: {
  nft: NFT | null; visible: boolean; onClose: () => void
}) {
  const [toAddress, setToAddress] = useState('')
  const [sending,   setSending]   = useState(false)
  const addr        = useWalletStore(s => s.address)
  const activeChain = useWalletStore(s => s.activeChain)
  const { loadPrivateKey } = require('../store/keyStore')
  const { ethers }         = require('ethers')

  if (!nft) return null

  async function handleSend() {
    if (!toAddress || !toAddress.startsWith('0x') || toAddress.length !== 42) {
      Alert.alert('Invalid address', 'Enter a valid Ethereum address')
      return
    }
    setSending(true)
    try {
      const pk = await loadPrivateKey()
      if (!pk) throw new Error('Authentication failed')

      const provider = getProvider(activeChain)
      const wallet   = new ethers.Wallet(pk, provider)

      const ABI = nft.tokenType === 'ERC721'
        ? ['function transferFrom(address from, address to, uint256 tokenId)']
        : ['function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)']

      const contract = new ethers.Contract(nft.contractAddress, ABI, wallet)
      let tx
      if (nft.tokenType === 'ERC721') {
        tx = await contract.transferFrom(addr, toAddress, BigInt(nft.tokenId))
      } else {
        tx = await contract.safeTransferFrom(addr, toAddress, BigInt(nft.tokenId), 1n, '0x')
      }
      await tx.wait(1)
      Alert.alert('NFT Sent!', `${nft.name} sent to ${toAddress.slice(0, 8)}…`)
      onClose()
    } catch (e: any) {
      Alert.alert('Send failed', e.reason ?? e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View style={sn.overlay}>
        <View style={sn.sheet}>
          <View style={sn.handleRow}>
            <View style={sn.handle} />
            <TouchableOpacity onPress={onClose}><Text style={{ color: '#64748B', fontSize: 13 }}>Cancel</Text></TouchableOpacity>
          </View>
          <Text style={sn.title}>Send {nft.name}</Text>
          <Text style={sn.label}>Recipient Address</Text>
          <View style={sn.inputWrap}>
            <Text style={sn.inputHex}>0x</Text>
            <Text style={sn.inputVal} numberOfLines={1}>
              {toAddress.slice(2) || <Text style={{ color: '#CBD5E1' }}>wallet address…</Text>}
            </Text>
          </View>
          {/* In real app: use TextInput — simplified for illustration */}
          <TouchableOpacity style={sn.addressInput} onPress={() => Alert.alert('Enter address', 'Add a TextInput here for production')}>
            <Text style={sn.addressInputT}>Tap to enter address</Text>
          </TouchableOpacity>
          <View style={sn.warnBox}>
            <Text style={sn.warnT}>⚠  NFT transfers are irreversible. Double-check the address.</Text>
          </View>
          <TouchableOpacity
            style={[sn.sendBtn, sending && { opacity: 0.7 }]}
            onPress={handleSend}
            disabled={sending}
          >
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={sn.sendBtnT}>Send NFT →</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// ─── Main Gallery Screen ──────────────────────────────────────────────────────
export default function NFTGallery() {
  const addr        = useWalletStore(s => s.address)
  const activeChain = useWalletStore(s => s.activeChain)

  const [nfts,        setNfts]        = useState<NFT[]>([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [selected,    setSelected]    = useState<NFT | null>(null)
  const [detailVis,   setDetailVis]   = useState(false)
  const [sendNFT,     setSendNFT]     = useState<NFT | null>(null)
  const [sendVis,     setSendVis]     = useState(false)
  const [filter,      setFilter]      = useState<'all' | 'ERC721' | 'ERC1155'>('all')
  const [noAlchemy,   setNoAlchemy]   = useState(false)

  const fetchAll = useCallback(async () => {
    if (!addr) return
    if (!ALCHEMY_KEY || ALCHEMY_KEY === 'YourAlchemyApiKey') {
      setNoAlchemy(true); setLoading(false); return
    }
    setNoAlchemy(false)
    try {
      // Fetch from active chain + Ethereum mainnet always
      const chainIds = [...new Set([1, activeChain.id])]
      const results  = await Promise.all(chainIds.map(id => fetchNFTs(addr, id)))
      setNfts(results.flat())
    } catch {
      setNfts([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [addr, activeChain.id])

  useEffect(() => { fetchAll() }, [fetchAll])

  const filtered = filter === 'all' ? nfts : nfts.filter(n => n.tokenType === filter)

  // Group by collection
  const collections = [...new Set(filtered.map(n => n.collection))]

  return (
    <View style={s.c}>
      <View style={s.hdr}>
        <TouchableOpacity style={s.back} onPress={() => router.back()}>
          <Text style={s.backT}>←</Text>
        </TouchableOpacity>
        <Text style={s.hdrTitle}>NFT Gallery</Text>
        <View style={s.countBadge}>
          <Text style={s.countBadgeT}>{nfts.length}</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <View style={s.filters}>
        {(['all', 'ERC721', 'ERC1155'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[s.filterTab, filter === f && s.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterTabT, filter === f && s.filterTabTActive]}>
              {f === 'all' ? `All (${nfts.length})` : `${f} (${nfts.filter(n => n.tokenType === f).length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {noAlchemy ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>🔑</Text>
          <Text style={s.centerTitle}>Alchemy API Key Required</Text>
          <Text style={s.centerSub}>NFT data is powered by Alchemy. Add your free API key to utils/nfts.ts to enable this feature.</Text>
          <TouchableOpacity style={s.alchemyBtn} onPress={() => Linking.openURL('https://alchemy.com')}>
            <Text style={s.alchemyBtnT}>Get Free Key →</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={s.centerSub}>Loading your NFTs…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 56, marginBottom: 16 }}>🖼</Text>
          <Text style={s.centerTitle}>No NFTs found</Text>
          <Text style={s.centerSub}>NFTs you own on {CHAIN_NAMES[activeChain.id]} and Ethereum will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={n => `${n.chainId}-${n.contractAddress}-${n.tokenId}`}
          numColumns={2}
          contentContainerStyle={s.grid}
          columnWrapperStyle={{ gap: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAll() }} tintColor="#6366F1" />}
          ListHeaderComponent={
            <View style={s.statsRow}>
              <View style={s.stat}>
                <Text style={s.statVal}>{nfts.length}</Text>
                <Text style={s.statLabel}>Total NFTs</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statVal}>{collections.length}</Text>
                <Text style={s.statLabel}>Collections</Text>
              </View>
              <View style={s.stat}>
                <Text style={s.statVal}>{[...new Set(nfts.map(n => n.chainId))].length}</Text>
                <Text style={s.statLabel}>Chains</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <NFTCard
              nft={item}
              onPress={() => { setSelected(item); setDetailVis(true) }}
            />
          )}
        />
      )}

      <NFTDetail
        nft={selected}
        visible={detailVis}
        onClose={() => setDetailVis(false)}
        onSend={nft => { setSendNFT(nft); setSendVis(true) }}
      />
      <SendNFTModal
        nft={sendNFT}
        visible={sendVis}
        onClose={() => setSendVis(false)}
      />
    </View>
  )
}

const s = StyleSheet.create({
  c:              { flex: 1, backgroundColor: '#F8FAFF' },
  hdr:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  back:           { width: 38, height: 38, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  backT:          { color: '#6366F1', fontSize: 18 },
  hdrTitle:       { color: '#1E1B4B', fontSize: 17, fontWeight: '700' },
  countBadge:     { backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  countBadgeT:    { color: '#6366F1', fontSize: 13, fontWeight: '700' },
  filters:        { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12 },
  filterTab:      { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E2E8F0' },
  filterTabActive:{ backgroundColor: '#6366F1', borderColor: '#6366F1' },
  filterTabT:     { color: '#64748B', fontSize: 12, fontWeight: '600' },
  filterTabTActive:{ color: '#fff' },
  grid:           { paddingHorizontal: 16, paddingBottom: 32 },
  statsRow:       { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, overflow: 'hidden' },
  stat:           { flex: 1, paddingVertical: 14, alignItems: 'center', borderRightWidth: 1, borderRightColor: '#F1F5F9' },
  statVal:        { color: '#1E1B4B', fontSize: 20, fontWeight: '800' },
  statLabel:      { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerTitle:    { color: '#1E1B4B', fontSize: 20, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  centerSub:      { color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 20 },
  alchemyBtn:     { backgroundColor: '#6366F1', paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14 },
  alchemyBtnT:    { color: '#fff', fontSize: 14, fontWeight: '600' },
})

const g = StyleSheet.create({
  card:        { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16, overflow: 'hidden' },
  imgContainer:{ position: 'relative' },
  img:         { width: '100%', height: CARD_W, backgroundColor: '#F1F5F9' },
  imgPlaceholder:{ alignItems: 'center', justifyContent: 'center' },
  chainDot:    { position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#fff' },
  info:        { padding: 10 },
  collection:  { color: '#94A3B8', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  name:        { color: '#1E1B4B', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  floor:       { color: '#6366F1', fontSize: 11, fontWeight: '600' },
})

const d = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%' },
  handleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' },
  closeBtn:    { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  closeBtnT:   { color: '#64748B', fontSize: 12, fontWeight: '600' },
  imgWrap:     { position: 'relative', marginHorizontal: 20, marginBottom: 16 },
  img:         { width: '100%', height: 280, borderRadius: 20, backgroundColor: '#F1F5F9' },
  imgPlaceholder:{ alignItems: 'center', justifyContent: 'center' },
  chainBadge:  { position: 'absolute', top: 12, right: 12, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20 },
  chainBadgeT: { color: '#fff', fontSize: 11, fontWeight: '700' },
  content:     { paddingHorizontal: 20, paddingBottom: 20 },
  collection:  { color: '#94A3B8', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  name:        { color: '#1E1B4B', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  floorRow:    { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#EEF2FF', borderRadius: 12, padding: 12, marginBottom: 12 },
  floorLabel:  { color: '#4338CA', fontSize: 13, fontWeight: '600' },
  floorVal:    { color: '#4338CA', fontSize: 13, fontWeight: '700' },
  desc:        { color: '#64748B', fontSize: 14, lineHeight: 22, marginBottom: 16 },
  attrTitle:   { color: '#1E1B4B', fontSize: 15, fontWeight: '700', marginBottom: 10 },
  attrGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  attrCard:    { backgroundColor: '#F8FAFF', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', padding: 10, minWidth: 80 },
  attrType:    { color: '#94A3B8', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', marginBottom: 3 },
  attrVal:     { color: '#1E1B4B', fontSize: 13, fontWeight: '600' },
  detailCard:  { backgroundColor: '#F8FAFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', marginBottom: 14 },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#fff' },
  detailL:     { color: '#64748B', fontSize: 13 },
  detailV:     { color: '#1E1B4B', fontSize: 13, fontWeight: '500' },
  openseaBtn:  { paddingVertical: 12, alignItems: 'center', backgroundColor: '#F0F9FF', borderRadius: 12, borderWidth: 1, borderColor: '#BAE6FD' },
  openseaBtnT: { color: '#0369A1', fontSize: 14, fontWeight: '600' },
  actions:     { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  sendBtn:     { backgroundColor: '#6366F1', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  sendBtnT:    { color: '#fff', fontSize: 16, fontWeight: '600' },
})

const sn = StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  sheet:       { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24 },
  handleRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: '#E2E8F0' },
  title:       { color: '#1E1B4B', fontSize: 20, fontWeight: '700', marginBottom: 20 },
  label:       { color: '#64748B', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  inputWrap:   { flexDirection: 'row', backgroundColor: '#F8FAFF', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', padding: 14, marginBottom: 10 },
  inputHex:    { color: '#CBD5E1', fontSize: 15 },
  inputVal:    { flex: 1, color: '#1E1B4B', fontSize: 15 },
  addressInput:{ backgroundColor: '#EEF2FF', borderRadius: 12, padding: 14, alignItems: 'center', marginBottom: 14 },
  addressInputT:{ color: '#6366F1', fontSize: 14, fontWeight: '600' },
  warnBox:     { backgroundColor: '#FFFBEB', borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A', padding: 12, marginBottom: 16 },
  warnT:       { color: '#92400E', fontSize: 13 },
  sendBtn:     { backgroundColor: '#6366F1', paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  sendBtnT:    { color: '#fff', fontSize: 16, fontWeight: '600' },
})

