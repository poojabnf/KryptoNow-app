import { kryptoNowProvider } from '../utils/eip1193'
import { Ionicons } from '@expo/vector-icons'
import { useEffect, useState, useCallback, useRef } from "react"
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, Modal, Animated, Platform, useWindowDimensions,
} from "react-native"
import { router } from "expo-router"
import { ethers } from "ethers"
import { useWalletStore } from "../store/walletStore"
import { useTransactions, Tx, TxType } from "../hooks/useTransactions"
import { CHAINS, Chain, getProvider } from "../utils/chains"
import { fetchChainTokenBalances } from "../utils/tokens"
import { getUnreadCount } from "../utils/notifications"
import { startTxWatcher, requestPushPermission } from "../utils/pushService"
import { useTheme } from "../context/ThemeContext"
import { useAuth } from "@clerk/expo"

type TokenRow = {
  symbol: string; name: string
  balance: string; price: number; change24h: number; valueUSD: number
  isNative: boolean; icon?: string; color?: string
}

const TX_META: Record<TxType, { icon: string; color: string; bg: string; label: string }> = {
  send:          { icon: "UP", label: "Sent",     color: "#EF4444", bg: "#FEF2F2" },
  receive:       { icon: "DN", label: "Received", color: "#10B981", bg: "#D1FAE5" },
  token_send:    { icon: "UP", label: "Sent",     color: "#F59E0B", bg: "#FEF3C7" },
  token_receive: { icon: "DN", label: "Received", color: "#06B6D4", bg: "#CFFAFE" },
  contract:      { icon: "FN", label: "Contract", color: "#8B5CF6", bg: "#EDE9FE" },
}

const NATIVE_CG: Record<number, string> = {
  1: "ethereum", 137: "matic-network",
  42161: "ethereum", 10: "ethereum", 56: "binancecoin", 8453: "ethereum",
}
const NATIVE_BINANCE: Record<number, string> = {
  1: "ETHUSDT", 137: "MATICUSDT",
  42161: "ETHUSDT", 10: "ETHUSDT", 56: "BNBUSDT", 8453: "ETHUSDT",
}
const NATIVE_CC: Record<number, string> = {
  1: "ETH", 137: "MATIC", 42161: "ETH", 10: "ETH", 56: "BNB", 8453: "ETH",
}

function relTime(ts: number) {
  const d = Math.floor(Date.now() / 1000) - ts
  if (d < 60)    return `${d}s ago`
  if (d < 3600)  return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

function fmt(n: number) {
  if (n === 0) return "$0.00"
  return n >= 1000
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${n.toFixed(2)}`
}

// --- Sidebar Nav Items ---
const NAV_ITEMS = [
  { label: "Dashboard",     icon: "grid-outline",          route: "/dashboard",     active: true  },
  { label: "Send",          icon: "send-outline",          route: "/send",          active: false },
  { label: "Receive",       icon: "download-outline",      route: "/receive",       active: false },
  { label: "Swap",          icon: "swap-horizontal-outline", route: "/swap",          active: false },
  { label: "Buy",           icon: "card-outline",          route: "/buy",           active: false },
  { label: "History",       icon: "time-outline",          route: "/history",       active: false },
  { label: "dApps",          icon: "globe-outline",         route: "/dapps",         active: false },
  { label: "Batch Send",     icon: "layers-outline",        route: "/batch",         active: false },
  { label: "Portfolio",     icon: "pie-chart-outline",     route: "/portfolio",     active: false },
  { label: "NFTs",           icon: "image-outline",          route: "/nfts",          active: false },
  { label: "WalletConnect",  icon: "link-outline",           route: "/walletconnect", active: false },
  { label: "Notifications", icon: "notifications-outline", route: "/notifications", active: false },
  { label: "Settings",      icon: "settings-outline",      route: "/settings",      active: false },
]

// --- Sidebar (web only) ---
function Sidebar({
  activeChain, addr, unreadCount, onSignOut,
}: {
  activeChain: Chain
  addr: string | null
  unreadCount: number
  onSignOut: () => void
}) {
  const short = addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : ""
  return (
    <View style={sb.sidebar}>
      {/* Logo */}
      <View style={sb.logoWrap}>
        <View style={[sb.logoIcon, { backgroundColor: activeChain.color }]}>
          <Text style={sb.logoIconT}>KN</Text>
        </View>
        <View>
          <Text style={sb.logoTitle}>KryptoNow</Text>
          <Text style={sb.logoSub}>Web3 Wallet</Text>
        </View>
      </View>

      {/* Wallet info */}
      <View style={[sb.walletCard, { backgroundColor: activeChain.color + "15", borderColor: activeChain.color + "30" }]}>
        <View style={[sb.walletAvatar, { backgroundColor: activeChain.color }]}>
          <Text style={sb.walletAvatarT}>{addr ? addr.slice(2,4).toUpperCase() : "KN"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={sb.walletAddr}>{short}</Text>
          <View style={sb.chainBadge}>
            <View style={[sb.chainDot, { backgroundColor: activeChain.color }]} />
            <Text style={[sb.chainName, { color: activeChain.color }]}>{activeChain.name}</Text>
          </View>
        </View>
      </View>

      {/* Nav links */}
      <ScrollView style={sb.navScroll} showsVerticalScrollIndicator={false}>
        {NAV_ITEMS.map(item => {
          const isNotif = item.route === "/notifications"
          return (
            <TouchableOpacity
              key={item.route}
              style={[sb.navItem, item.active && { backgroundColor: activeChain.color + "15" }]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <View style={[sb.navIcon, item.active && { backgroundColor: activeChain.color }]}>
                <Ionicons name={item.icon as any} size={18} color={item.active ? "#fff" : "#64748B"} />
              </View>
              <Text style={[sb.navLabel, item.active && { color: activeChain.color, fontWeight: "700" }]}>
                {item.label}
              </Text>
              {isNotif && unreadCount > 0 && (
                <View style={sb.notifBadge}>
                  <Text style={sb.notifBadgeT}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                </View>
              )}
              {item.active && <View style={[sb.activeBar, { backgroundColor: activeChain.color }]} />}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      {/* Bottom actions */}
      <View style={sb.bottomWrap}>
        <TouchableOpacity style={sb.signOutBtn} onPress={onSignOut} activeOpacity={0.8}>
          <Text style={sb.signOutIcon}>O</Text>
          <Text style={sb.signOutT}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// --- Chain Modal ---
function ChainModal({ visible, current, onSelect, onClose }: {
  visible: boolean; current: Chain
  onSelect: (c: Chain) => void; onClose: () => void
}) {
  const slide = useRef(new Animated.Value(500)).current
  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 0 : 500,
      useNativeDriver: true, tension: 65, friction: 11,
    }).start()
  }, [visible])
  return (
    <Modal transparent visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[m.sheet, { transform: [{ translateY: slide }] }]}>
        <View style={m.handle} />
        <Text style={m.title}>Switch Network</Text>
        {CHAINS.map(chain => (
          <TouchableOpacity
            key={chain.id}
            style={[m.row, chain.id === current.id && m.rowActive]}
            onPress={() => { onSelect(chain); onClose() }}
            activeOpacity={0.7}
          >
            <View style={[m.iconWrap, { backgroundColor: chain.color + "22" }]}>
              <Text style={[m.icon, { color: chain.color }]}>{chain.icon}</Text>
            </View>
            <View style={m.mid}>
              <Text style={m.chainName}>{chain.name}</Text>
              <Text style={m.chainSymbol}>{chain.symbol}</Text>
            </View>
            {chain.id === current.id && (
              <View style={[m.activeDot, { backgroundColor: chain.color }]} />
            )}
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Modal>
  )
}

const ACTIONS = [
  { l: "Send",    icon: "send-outline",             route: "/send"    },
  { l: "Receive", icon: "download-outline",         route: "/receive" },
  { l: "Swap",    icon: "swap-horizontal-outline",  route: "/swap"    },
  { l: "Buy",     icon: "add-circle-outline",       route: "/buy"     },
  { l: "Portfolio", icon: "pie-chart-outline", route: "/portfolio" },
]

export default function Dashboard() {
  const { theme, mode } = useTheme()
  const addr           = useWalletStore(s => s.address)
  const activeChain    = useWalletStore(s => s.activeChain)
  const setActiveChain = useWalletStore(s => s.setActiveChain)
  const setChainCache  = useWalletStore(s => s.setChainCache)
  const getChainCache  = useWalletStore(s => s.getChainCache)
  const { signOut }    = useAuth()

  const short = addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : ""
  const isWeb = Platform.OS === "web"
  const { width: screenWidth } = useWindowDimensions()
  const isLargeScreen = isWeb && screenWidth >= 768

  const [tokens,      setTokens]      = useState<TokenRow[]>([])
  const [totalUSD,    setTotalUSD]    = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [error,       setError]       = useState(false)
  const [chainModal,  setChainModal]  = useState(false)
  const [fundSheet,   setFundSheet]   = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const drawerAnim = useRef(new Animated.Value(-260)).current

  function openDrawer() {
    setDrawerOpen(true)
    Animated.spring(drawerAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start()
  }
  function closeDrawer() {
    Animated.timing(drawerAnim, { toValue: -260, duration: 200, useNativeDriver: true }).start(() => setDrawerOpen(false))
  }

  const { txns: recentTxns, loading: txLoading, refresh: refreshTxns } = useTransactions(addr)

  // Init EIP-1193 provider
  useEffect(() => {
    if (addr && activeChain) {
      const wallet = useWalletStore.getState().wallet
      if (wallet?.phrase) {
        try {
          const ETH_PATH = "m/44'/60'/0'/0/0"
          const hdNode   = ethers.HDNodeWallet.fromPhrase(wallet.phrase.trim(), undefined, ETH_PATH)
          kryptoNowProvider.init(addr, hdNode.privateKey, activeChain.id, activeChain.rpc)
        } catch {}
      }
    }
  }, [addr, activeChain])

  const fetchBalances = useCallback(async (force = false) => {
    if (!addr) return
    const cached = getChainCache(activeChain.id)
    if (cached && !force) {
      const nativeRow: TokenRow = {
        symbol: activeChain.symbol, name: activeChain.nativeName,
        balance: cached.nativeBalance,
        price: cached.nativeUSD / (parseFloat(cached.nativeBalance) || 1),
        change24h: 0, valueUSD: cached.nativeUSD, isNative: true,
      }
      setTokens([nativeRow, ...cached.tokens.map(t => ({ ...t, isNative: false }))])
      setTotalUSD(cached.nativeUSD + cached.tokens.reduce((s, t) => s + t.valueUSD, 0))
      setLoading(false)
      return
    }
    setError(false)
    try {
      const provider   = getProvider(activeChain)
      const weiBalance = await Promise.race([
        provider.getBalance(addr),
        new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 7000)),
      ])
      const nativeBal = parseFloat(ethers.formatEther(weiBalance))

      let nativePrice = 0, nativeChange = 0
      try {
        const cgKey = NATIVE_CG[activeChain.id] ?? "ethereum"
        const cgRes = await Promise.race([
          fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgKey}&vs_currencies=usd&include_24hr_change=true`),
          new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 8000)),
        ])
        if ((cgRes as Response).ok) {
          const cgData  = await (cgRes as Response).json()
          nativePrice   = cgData[cgKey]?.usd ?? 0
          nativeChange  = cgData[cgKey]?.usd_24h_change ?? 0
        }
      } catch {}

      if (nativePrice === 0) {
        try {
          const bSym = NATIVE_BINANCE[activeChain.id] ?? "ETHUSDT"
          const bRes = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${bSym}`)
          if (bRes.ok) {
            const bData  = await bRes.json()
            nativePrice  = parseFloat(bData.lastPrice ?? "0")
            nativeChange = parseFloat(bData.priceChangePercent ?? "0")
          }
        } catch {}
      }

      if (nativePrice === 0) {
        try {
          const ccSym = NATIVE_CC[activeChain.id] ?? "ETH"
          const ccRes = await fetch(`https://min-api.cryptocompare.com/data/price?fsym=${ccSym}&tsyms=USD`)
          if (ccRes.ok) { const ccData = await ccRes.json(); nativePrice = ccData.USD ?? 0 }
        } catch {}
      }

      const nativeUSD  = nativeBal * nativePrice
      let tokenRows: TokenRow[] = []
      try {
        const fetched = await fetchChainTokenBalances(addr, activeChain)
        tokenRows = fetched.map(t => ({ ...t, isNative: false }))
      } catch {}

      const nativeRow: TokenRow = {
        symbol: activeChain.symbol, name: activeChain.nativeName,
        balance: nativeBal.toFixed(6),
        price: nativePrice, change24h: nativeChange,
        valueUSD: nativeUSD, isNative: true,
      }
      const allRows = [nativeRow, ...tokenRows]
      setTokens(allRows)
      setTotalUSD(allRows.reduce((s, t) => s + t.valueUSD, 0))
      setChainCache(activeChain.id, {
        nativeBalance: nativeBal.toFixed(6), nativeUSD,
        tokens: tokenRows, lastFetch: Date.now(),
      })
    } catch (e: any) {
      setError(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [addr, activeChain])

  useEffect(() => {
    setLoading(true); setTokens([]); setTotalUSD(0)
    fetchBalances(false); refreshTxns()
  }, [activeChain.id])

  useEffect(() => {
    setUnreadCount(getUnreadCount())
    const interval = setInterval(() => setUnreadCount(getUnreadCount()), 30000)
    return () => clearInterval(interval)
  }, [])

  // Wire push notification watcher
  useEffect(() => {
    if (!addr || Platform.OS === 'web') return
    requestPushPermission()
    const stop = startTxWatcher(
      addr,
      activeChain.id,
      activeChain.symbol,
      (count) => setUnreadCount(prev => prev + count)
    )
    return () => stop()
  }, [addr, activeChain.id])

  const onRefresh = () => { setRefreshing(true); fetchBalances(true); refreshTxns() }

  async function handleSignOut() {
    try {
      await signOut()
      router.replace("/(auth)/sign-in")
    } catch {
      router.replace("/(auth)/sign-in")
    }
  }

  // Main content (shared between web/mobile)
  const mainContent = (
    <ScrollView
      showsVerticalScrollIndicator={true}
      persistentScrollbar={true}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={activeChain.color} />
      }
      contentContainerStyle={{ paddingBottom: 48 }}
    >
      {/* Balance Card */}
      <View style={[s.balanceCard, { backgroundColor: activeChain.color }]}>
        <View style={s.avatarWrap}>
          <Text style={s.avatarText}>{addr ? addr.slice(2, 4).toUpperCase() : "--"}</Text>
        </View>
        <Text style={s.walletAddr}>{short}</Text>
        <Text style={s.balLabel}>Total Balance</Text>
        {loading
          ? <ActivityIndicator color="#fff" size="large" style={{ marginVertical: 12 }} />
          : <Text style={s.balAmount}>{fmt(totalUSD)}</Text>
        }
        {!loading && tokens[0] && (
          <View style={s.balMeta}>
            <Text style={s.balNative}>{parseFloat(tokens[0].balance).toFixed(4)} {activeChain.symbol}</Text>
            <View style={[s.changePill, { backgroundColor: tokens[0].change24h >= 0 ? "rgba(134,239,172,0.25)" : "rgba(252,165,165,0.25)" }]}>
              <Text style={[s.changeText, { color: tokens[0].change24h >= 0 ? "#86EFAC" : "#FCA5A5" }]}>
                {tokens[0].change24h >= 0 ? "+" : ""}{tokens[0].change24h.toFixed(2)}%
              </Text>
            </View>
          </View>
        )}
        <View style={s.networkBadge}>
          <Text style={s.networkBadgeText}>{activeChain.name}  Encrypted</Text>
        </View>
      </View>

      {/* Error */}
      {error && (
        <TouchableOpacity style={s.errorBanner} onPress={() => fetchBalances(true)}>
          <Text style={s.errorText}>[!] Unable to fetch data  tap to retry</Text>
        </TouchableOpacity>
      )}

      {/* Action Buttons */}
      <View style={s.actions}>
        {ACTIONS.map(a => (
          <TouchableOpacity
            key={a.l}
            style={s.actionItem}
            onPress={() => router.push(a.route as any)}
            activeOpacity={0.7}
          >
            <View style={[s.actionBtn, { borderColor: activeChain.color + "55" }]}>
              <Ionicons name={a.icon as any} size={24} color={activeChain.color} />
            </View>
            <Text style={s.actionLabel}>{a.l}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Assets */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Assets on {activeChain.name}</Text>
        {loading ? (
          <View style={s.loadBox}>
            <ActivityIndicator color={activeChain.color} />
            <Text style={s.loadText}>Fetching balances...</Text>
          </View>
        ) : tokens.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>{activeChain.icon}</Text>
            <Text style={s.emptyTitle}>No assets yet</Text>
            <Text style={s.emptySub}>Bridge or receive {activeChain.symbol} to get started</Text>
          </View>
        ) : (
          tokens.map((t, i) => (
            <View key={i} style={s.assetRow}>
              <View style={[s.assetIcon, { backgroundColor: (t.color ?? activeChain.color) + "18" }]}>
                <Text style={[s.assetIconText, { color: t.color ?? activeChain.color }]}>
                  {t.isNative ? activeChain.icon : (t.icon ?? t.symbol.slice(0, 2))}
                </Text>
              </View>
              <View style={s.assetMid}>
                <Text style={s.assetName}>{t.name}</Text>
                <Text style={s.assetBal}>{parseFloat(t.balance).toFixed(4)} {t.symbol}</Text>
              </View>
              <View style={s.assetRight}>
                <Text style={s.assetValue}>{fmt(t.valueUSD)}</Text>
                <Text style={[s.assetChange, { color: t.change24h >= 0 ? "#10B981" : "#EF4444" }]}>
                  {t.change24h === 0 ? "--" : (t.change24h >= 0 ? "+" : "") + t.change24h.toFixed(2) + "%"}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Recent Activity */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Recent Activity</Text>
          <TouchableOpacity onPress={() => router.push("/history" as any)}>
            <Text style={[s.viewAll, { color: activeChain.color }]}>View all</Text>
          </TouchableOpacity>
        </View>
        {txLoading ? (
          <ActivityIndicator color={activeChain.color} style={{ marginTop: 16 }} />
        ) : recentTxns.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyTitle}>No transactions yet</Text>
            <Text style={s.emptySub}>Send or receive to see activity</Text>
          </View>
        ) : (
          recentTxns.slice(0, 5).map((tx, i) => {
            const meta   = TX_META[tx.type]
            const isSend = tx.type === "send" || tx.type === "token_send"
            return (
              <TouchableOpacity
                key={i}
                style={s.txRow}
                onPress={() => router.push("/history" as any)}
                activeOpacity={0.7}
              >
                <View style={[s.txIcon, { backgroundColor: meta.bg }]}>
                  <Text style={{ fontSize: 12, fontWeight: "800", color: meta.color }}>
                    {isSend ? "OUT" : "IN"}
                  </Text>
                </View>
                <View style={s.txMid}>
                  <Text style={s.txLabel}>{meta.label}</Text>
                  <Text style={s.txAddr}>
                    {isSend
                      ? `To: ${tx.to.slice(0,6)}...${tx.to.slice(-4)}`
                      : `From: ${tx.from.slice(0,6)}...${tx.from.slice(-4)}`}
                  </Text>
                  <Text style={s.txTime}>{relTime(tx.timestamp)}</Text>
                </View>
                <Text style={[s.txAmt, { color: meta.color }]}>
                  {isSend ? "-" : "+"}{tx.value} {tx.symbol}
                </Text>
              </TouchableOpacity>
            )
          })
        )}
      </View>
    </ScrollView>
  )

  return (
    <View style={[s.c, { backgroundColor: theme.bgApp }]}>
      {/* WEB LAYOUT: sidebar + content */}
      {isLargeScreen ? (
        <View style={s.webLayout}>
          <Sidebar
            activeChain={activeChain}
            addr={addr}
            unreadCount={unreadCount}
            onSignOut={handleSignOut}
          />
          <View style={s.webMain}>
            {/* Web top bar */}
            <View style={s.webTopBar}>
              <TouchableOpacity
                style={s.chainPill}
                onPress={() => setChainModal(true)}
                activeOpacity={0.7}
              >
                <View style={[s.chainDot, { backgroundColor: activeChain.color }]} />
                <Text style={[s.chainName, { color: theme.textPrimary }]}>{activeChain.name}</Text>
                <Text style={s.chevron}>[v]</Text>
              </TouchableOpacity>
              <View style={s.headerRight}>
                <TouchableOpacity
                  style={s.iconBtn}
                  onPress={() => setFundSheet(true)}
                >
                  <Ionicons name="card-outline" size={20} color={activeChain.color} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.bellBtn}
                  onPress={() => router.push("/notifications" as any)}
                >
                  <Ionicons name="notifications-outline" size={22} color={activeChain.color} />
                  {unreadCount > 0 && (
                    <View style={s.bellBadge}>
                      <Text style={s.bellBadgeT}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/settings" as any)}>
                  <Ionicons name="settings-outline" size={20} color={activeChain.color} />
                </TouchableOpacity>
                <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/support" as any)}>
                  <Ionicons name="help-circle-outline" size={20} color={activeChain.color} />
                </TouchableOpacity>
              </View>
            </View>
            {mainContent}
          </View>
        </View>
      ) : (
        // MOBILE LAYOUT: original header + content
        <>
          {/* Mobile slide-in drawer */}
          {drawerOpen && (
            <>
              <TouchableOpacity
                style={s.drawerOverlay}
                activeOpacity={1}
                onPress={closeDrawer}
              />
              <Animated.View style={[s.drawer, { transform: [{ translateX: drawerAnim }] }]}>
                <Sidebar
                  activeChain={activeChain}
                  addr={addr}
                  unreadCount={unreadCount}
                  onSignOut={() => { closeDrawer(); handleSignOut() }}
                />
              </Animated.View>
            </>
          )}
          <View style={[s.header, { backgroundColor: theme.bgApp }]}>
            <TouchableOpacity
              style={s.hamburger}
              onPress={openDrawer}
              activeOpacity={0.7}
            >
              <Ionicons name="menu-outline" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.chainPill}
              onPress={() => setChainModal(true)}
              activeOpacity={0.7}
            >
              <View style={[s.chainDot, { backgroundColor: activeChain.color }]} />
              <Text style={[s.chainName, { color: theme.textPrimary }]}>{activeChain.name}</Text>
              <Text style={s.chevron}>[v]</Text>
            </TouchableOpacity>
            <View style={s.headerRight}>
              <TouchableOpacity style={[s.iconBtn, { backgroundColor: theme.bgCard, borderColor: theme.border }]} onPress={() => setFundSheet(true)}>
                <Ionicons name="card-outline" size={20} color={activeChain.color} />
              </TouchableOpacity>
              <TouchableOpacity style={s.bellBtn} onPress={() => router.push("/notifications" as any)}>
                <Ionicons name="notifications-outline" size={22} color={activeChain.color} />
                {unreadCount > 0 && (
                  <View style={s.bellBadge}>
                    <Text style={s.bellBadgeT}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/settings" as any)}>
                <Ionicons name="settings-outline" size={20} color={activeChain.color} />
              </TouchableOpacity>
              <TouchableOpacity style={s.iconBtn} onPress={() => router.push("/support" as any)}>
                <Ionicons name="help-circle-outline" size={20} color={activeChain.color} />
              </TouchableOpacity>
            </View>
          </View>
          {mainContent}
        </>
      )}

      {/* Fund Sheet */}
      <Modal transparent visible={fundSheet} onRequestClose={() => setFundSheet(false)}>
        <TouchableOpacity style={m.overlay} activeOpacity={1} onPress={() => setFundSheet(false)} />
        <View style={m.fundSheet}>
          <View style={m.handle} />
          <Text style={m.title}>Add Funds</Text>
          <Text style={m.fundSub}>Choose how to fund your wallet</Text>
          <View style={[m.balCard, { backgroundColor: activeChain.color + "12", borderColor: activeChain.color + "30" }]}>
            <View>
              <Text style={m.balCardLabel}>Wallet Balance</Text>
              <Text style={[m.balCardAmount, { color: activeChain.color }]}>{loading ? "..." : fmt(totalUSD)}</Text>
              <Text style={m.balCardSub}>{tokens[0] ? parseFloat(tokens[0].balance).toFixed(4) + " " + activeChain.symbol : "--"}</Text>
            </View>
            <View style={[m.balChainBadge, { backgroundColor: activeChain.color }]}>
              <Text style={m.balChainIcon}>{activeChain.icon}</Text>
            </View>
          </View>
          {[
            { icon: "$", bg: "#EEF2FF", title: "Buy Crypto",    desc: "Purchase with card via MoonPay, Transak & more", route: "/buy"     },
            { icon: "v", bg: "#FFF7ED", title: "Receive Crypto", desc: "Deposit from another wallet or exchange",       route: "/receive" },
          ].map(item => (
            <TouchableOpacity
              key={item.title}
              style={m.fundCard}
              activeOpacity={0.85}
              onPress={() => { setFundSheet(false); router.push(item.route as any) }}
            >
              <View style={[m.fundIconWrap, { backgroundColor: item.bg }]}>
                <Text style={m.fundIconText}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={m.fundCardTitle}>{item.title}</Text>
                <Text style={m.fundCardDesc}>{item.desc}</Text>
              </View>
              <Text style={m.fundCardChevron}>{">"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

      <ChainModal
        visible={chainModal}
        current={activeChain}
        onSelect={setActiveChain}
        onClose={() => setChainModal(false)}
      />
    </View>
  )
}

// --- Sidebar Styles ---
const sb = StyleSheet.create({
  sidebar:       { width: 240, backgroundColor: "#fff", borderRightWidth: 1, borderRightColor: "#F1F5F9", paddingTop: 24, paddingBottom: 16, flexDirection: "column", height: "100vh" as any, position: "sticky" as any, top: 0, overflow: "hidden" },
  logoWrap:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, marginBottom: 24 },
  logoIcon:      { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  logoIconT:     { color: "#fff", fontSize: 14, fontWeight: "800" },
  logoTitle:     { color: "#1E1B4B", fontSize: 16, fontWeight: "800" },
  logoSub:       { color: "#94A3B8", fontSize: 11 },
  walletCard:    { marginHorizontal: 16, marginBottom: 20, borderRadius: 14, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  walletAvatar:  { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  walletAvatarT: { color: "#fff", fontSize: 13, fontWeight: "800" },
  walletAddr:    { color: "#1E1B4B", fontSize: 13, fontWeight: "600", marginBottom: 4 },
  chainBadge:    { flexDirection: "row", alignItems: "center", gap: 4 },
  chainDot:      { width: 6, height: 6, borderRadius: 3 },
  chainName:     { fontSize: 11, fontWeight: "600" },
  navScroll:     { flex: 1, paddingHorizontal: 12, overflowY: "auto" as any },
  navItem:       { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 12, marginBottom: 4, position: "relative" },
  navIcon:       { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  navIconT:      { fontSize: 13, fontWeight: "700", color: "#64748B" },
  navLabel:      { color: "#64748B", fontSize: 14, fontWeight: "500", flex: 1 },
  notifBadge:    { backgroundColor: "#EF4444", borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  notifBadgeT:   { color: "#fff", fontSize: 10, fontWeight: "700" },
  activeBar:     { position: "absolute", right: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  bottomWrap:    { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  signOutBtn:    { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#FFF1F2", borderWidth: 1, borderColor: "#FECDD3" },
  signOutIcon:   { color: "#F43F5E", fontSize: 14, fontWeight: "800" },
  signOutT:      { color: "#F43F5E", fontSize: 14, fontWeight: "600" },
})

// --- Main Styles ---
const s = StyleSheet.create({
  c:               { flex: 1, backgroundColor: "#F0F4FF" },
  webLayout:       { flex: 1, flexDirection: "row", height: "100vh" as any, overflow: "hidden" },
  webLayoutMobile: { flex: 1, flexDirection: "column" },
  hamburger:       { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 4 },
  drawer:          { position: "absolute", left: 0, top: 0, bottom: 0, width: 260, zIndex: 100, backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 20 },
  drawerOverlay:   { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(15,23,42,0.45)", zIndex: 99 },
  webMain:         { flex: 1, backgroundColor: "#F0F4FF", overflowY: "auto" as any, height: "100vh" as any },
  webTopBar:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 24, paddingVertical: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  header:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  chainPill:       { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#fff", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: "#E2E8F0" },
  chainDot:        { width: 8, height: 8, borderRadius: 4 },
  chainName:       { fontSize: 13, fontWeight: "700", color: "#1E1B4B" },
  chevron:         { fontSize: 12, color: "#94A3B8" },
  headerRight:     { flexDirection: "row", gap: 8 },
  iconBtn:         { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  iconBtnText:     { fontSize: 14, fontWeight: "700" },
  bellBtn:         { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  bellBadge:       { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#fff" },
  bellBadgeT:      { color: "#fff", fontSize: 9, fontWeight: "800" },
  balanceCard:     { marginHorizontal: 16, marginBottom: 20, borderRadius: 28, padding: 28, alignItems: "center", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 12 },
  avatarWrap:      { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 12, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)" },
  avatarText:      { color: "#fff", fontSize: 20, fontWeight: "800" },
  walletAddr:      { color: "rgba(255,255,255,0.65)", fontSize: 12, marginBottom: 16, letterSpacing: 0.5 },
  balLabel:        { color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: "500", marginBottom: 6 },
  balAmount:       { color: "#fff", fontSize: 42, fontWeight: "800", letterSpacing: -1.5 },
  balMeta:         { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, marginBottom: 16 },
  balNative:       { color: "rgba(255,255,255,0.75)", fontSize: 13 },
  changePill:      { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  changeText:      { fontSize: 12, fontWeight: "700" },
  networkBadge:    { backgroundColor: "rgba(255,255,255,0.15)", paddingVertical: 5, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  networkBadgeText:{ color: "#fff", fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
  errorBanner:     { marginHorizontal: 16, marginBottom: 12, backgroundColor: "#FEF2F2", borderRadius: 14, borderWidth: 1, borderColor: "#FECACA", padding: 13 },
  errorText:       { color: "#DC2626", fontSize: 13, textAlign: "center", fontWeight: "500" },
  actions:         { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 16, marginBottom: 28 },
  actionItem:      { alignItems: "center", gap: 8 },
  actionBtn:       { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 2, shadowColor: "#6366F1", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 4 },
  actionIcon:      { fontSize: 16, fontWeight: "800" },
  actionLabel:     { color: "#64748B", fontSize: 12, fontWeight: "600" },
  section:         { paddingHorizontal: 16, marginBottom: 24 },
  sectionHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle:    { color: "#1E1B4B", fontSize: 17, fontWeight: "800", marginBottom: 14 },
  viewAll:         { fontSize: 13, fontWeight: "600" },
  loadBox:         { backgroundColor: "#fff", borderRadius: 18, padding: 28, alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#F1F5F9" },
  loadText:        { color: "#94A3B8", fontSize: 13 },
  emptyBox:        { backgroundColor: "#fff", borderRadius: 20, padding: 28, alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  emptyIcon:       { fontSize: 36, marginBottom: 10 },
  emptyTitle:      { color: "#1E1B4B", fontSize: 15, fontWeight: "700", marginBottom: 4 },
  emptySub:        { color: "#94A3B8", fontSize: 13, textAlign: "center" },
  assetRow:        { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 18, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#F1F5F9" },
  assetIcon:       { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 14 },
  assetIconText:   { fontSize: 16, fontWeight: "800" },
  assetMid:        { flex: 1 },
  assetName:       { color: "#1E1B4B", fontSize: 14, fontWeight: "700" },
  assetBal:        { color: "#94A3B8", fontSize: 12, marginTop: 3 },
  assetRight:      { alignItems: "flex-end" },
  assetValue:      { color: "#1E1B4B", fontSize: 14, fontWeight: "700" },
  assetChange:     { fontSize: 12, fontWeight: "600", marginTop: 3 },
  txRow:           { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#F1F5F9" },
  txIcon:          { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: 14 },
  txMid:           { flex: 1 },
  txLabel:         { color: "#1E1B4B", fontSize: 13, fontWeight: "700" },
  txAddr:          { color: "#94A3B8", fontSize: 11, marginTop: 2 },
  txTime:          { color: "#CBD5E1", fontSize: 11, marginTop: 1 },
  txAmt:           { fontSize: 13, fontWeight: "700" },
})

const m = StyleSheet.create({
  overlay:        { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,23,42,0.6)" },
  sheet:          { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 36 },
  handle:         { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", alignSelf: "center", marginBottom: 20 },
  title:          { color: "#1E1B4B", fontSize: 18, fontWeight: "800", marginBottom: 4, paddingLeft: 4 },
  row:            { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, marginBottom: 8, backgroundColor: "#F8FAFF" },
  rowActive:      { backgroundColor: "#EEF2FF" },
  iconWrap:       { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 14 },
  icon:           { fontSize: 18, fontWeight: "700" },
  mid:            { flex: 1 },
  chainName:      { color: "#1E1B4B", fontSize: 15, fontWeight: "700" },
  chainSymbol:    { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  activeDot:      { width: 10, height: 10, borderRadius: 5 },
  fundSheet:      { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 44 },
  fundSub:        { color: "#94A3B8", fontSize: 13, marginBottom: 20, paddingLeft: 4 },
  balCard:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 18, borderWidth: 1, padding: 18, marginBottom: 20 },
  balCardLabel:   { color: "#64748B", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  balCardAmount:  { fontSize: 24, fontWeight: "800", letterSpacing: -0.5, marginBottom: 2 },
  balCardSub:     { color: "#94A3B8", fontSize: 12 },
  balChainBadge:  { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  balChainIcon:   { fontSize: 22, color: "#fff" },
  fundCard:       { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "#F8FAFF", borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E2E8F0" },
  fundIconWrap:   { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  fundIconText:   { fontSize: 22, fontWeight: "800", color: "#6366F1" },
  fundCardTitle:  { color: "#1E1B4B", fontSize: 15, fontWeight: "700", marginBottom: 3 },
  fundCardDesc:   { color: "#64748B", fontSize: 12, lineHeight: 18 },
  fundCardChevron:{ fontSize: 18, color: "#CBD5E1", fontWeight: "700" },
})