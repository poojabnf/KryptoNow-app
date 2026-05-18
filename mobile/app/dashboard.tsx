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
import Svg, { Path } from "react-native-svg"

type TokenRow = {
  symbol: string; name: string
  balance: string; price: number; change24h: number; valueUSD: number
  isNative: boolean; icon?: string; color?: string
}

const TX_META: Record<TxType, { icon: string; color: string; bg: string; label: string }> = {
  send:          { icon: "UP", label: "Sent",     color: "#EF4444", bg: "rgba(239, 68, 68, 0.12)" },
  receive:       { icon: "DN", label: "Received", color: "#10B981", bg: "rgba(16, 185, 129, 0.12)" },
  token_send:    { icon: "UP", label: "Sent",     color: "#F59E0B", bg: "rgba(245, 158, 11, 0.12)" },
  token_receive: { icon: "DN", label: "Received", color: "#06B6D4", bg: "rgba(6, 182, 212, 0.12)" },
  contract:      { icon: "FN", label: "Contract", color: "#8B5CF6", bg: "rgba(139, 92, 246, 0.12)" },
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

const TEAL   = "#0D2E2E"
const ACCENT = "#00D4AA"
const ACCENT2 = "#00B8FF"
const BG_DARK = "#092020"
const BG_SIDEBAR = "#061515"

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

function Sparkline({ change24h, width = 68, height = 24 }: { change24h: number; width?: number; height?: number }) {
  const isPositive = change24h >= 0
  const color = isPositive ? "#10B981" : "#EF4444"
  const seed = Math.abs(change24h) * 12
  const points: number[] = []
  const steps = 7
  for (let i = 0; i < steps; i++) {
    const factor = i / (steps - 1)
    const baseline = isPositive ? factor : (1 - factor)
    const noise = Math.sin(seed + i * 2.3) * 0.15
    let val = baseline + noise
    if (val < 0) val = 0.05
    if (val > 1) val = 0.95
    points.push(val)
  }
  const padding = 2
  const d = points.map((p, idx) => {
    const x = (idx / (steps - 1)) * width
    const y = padding + (1 - p) * (height - 2 * padding)
    return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <View style={{ width, height, justifyContent: "center" }}>
      <Svg width={width} height={height}>
        <Path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
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
  { label: "Hardware",       icon: "hardware-chip-outline", route: "/hardware",      active: false },
  { label: "Options",        icon: "trending-up-outline",   route: "/options",       active: false },
  { label: "Portfolio",     icon: "pie-chart-outline",     route: "/portfolio",     active: false },
  { label: "NFTs",           icon: "image-outline",          route: "/nfts",          active: false },
  { label: "WalletConnect",  icon: "link-outline",           route: "/walletconnect", active: false },
  { label: "Recovery",       icon: "shield-checkmark-outline", route: "/recovery",      active: false },
  { label: "Price Alerts",  icon: "trending-up-outline",  route: "/pricealerts",   active: false },
  { label: "Notifications", icon: "notifications-outline", route: "/notifications", active: false },
  { label: "Settings",      icon: "settings-outline",      route: "/settings",      active: false },
]

// --- Sidebar (web only) ---
function Sidebar({
  activeChain, addr, unreadCount, onSignOut, accounts, activeAccountIndex, onSwitchClick,
}: {
  activeChain: Chain
  addr: string | null
  unreadCount: number
  onSignOut: () => void
  accounts: any[]
  activeAccountIndex: number
  onSwitchClick: () => void
}) {
  const short = addr ? addr.slice(0, 6) + "..." + addr.slice(-4) : ""
  return (
    <View style={sb.sidebar}>
      {/* Dynamic Brand Logo */}
      <View style={sb.logoWrap}>
        <View style={sb.logoIcon}>
          {/* Shield Diamond */}
          <View style={sb.logoShield}>
            <View style={sb.logoShieldInner}>
              <View style={sb.logoCore} />
            </View>
          </View>
          {/* Orbital Ring */}
          <View style={sb.logoRing} />
        </View>
        <View>
          <Text style={sb.logoTitle}>KryptoNow</Text>
          <Text style={sb.logoSub}>Cryptographic Vault</Text>
        </View>
      </View>

      {/* Wallet info card */}
      <TouchableOpacity
        style={[sb.walletCard, { backgroundColor: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.06)" }]}
        onPress={onSwitchClick}
        activeOpacity={0.7}
      >
        <View style={[sb.walletAvatar, { backgroundColor: activeChain.color }]}>
          <Text style={sb.walletAvatarT}>{addr ? addr.slice(2,4).toUpperCase() : "KN"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={sb.walletName}>Account #{activeAccountIndex + 1}</Text>
            <Ionicons name="chevron-down" size={12} color={activeChain.color} />
          </View>
          <Text style={sb.walletAddr}>{short}</Text>
        </View>
      </TouchableOpacity>

      {/* Nav links */}
      <ScrollView style={sb.navScroll} showsVerticalScrollIndicator={false}>
        {NAV_ITEMS.map(item => {
          const isNotif = item.route === "/notifications"
          return (
            <TouchableOpacity
              key={item.route}
              style={[sb.navItem, item.active && { backgroundColor: "rgba(255,255,255,0.04)" }]}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <View style={[sb.navIcon, item.active && { backgroundColor: activeChain.color }]}>
                <Ionicons name={item.icon as any} size={16} color={item.active ? "#fff" : "rgba(255,255,255,0.5)"} />
              </View>
              <Text style={[sb.navLabel, item.active && { color: "#fff", fontWeight: "700" }]}>
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
          <Ionicons name="log-out-outline" size={18} color="#FF6B6B" style={{ marginRight: 6 }} />
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
  const addr                  = useWalletStore(s => s.address)
  const isWalletLoaded        = useWalletStore(s => s.isLoaded)
  const initFromStorage       = useWalletStore(s => s.initFromStorage)
  const activeChain           = useWalletStore(s => s.activeChain)
  const setActiveChain        = useWalletStore(s => s.setActiveChain)
  const setChainCache         = useWalletStore(s => s.setChainCache)
  const getChainCache         = useWalletStore(s => s.getChainCache)
  const accounts              = useWalletStore(s => s.accounts)
  const activeAccountIndex    = useWalletStore(s => s.activeAccountIndex)
  const setActiveAccountIndex = useWalletStore(s => s.setActiveAccountIndex)
  const { signOut }           = useAuth()

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
  const [walletSwitcherOpen, setWalletSwitcherOpen] = useState(false)
  const [fundSheet,   setFundSheet]   = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [drawerOpen,   setDrawerOpen]   = useState(false)
  const drawerAnim = useRef(new Animated.Value(-260)).current

  const [portfolioView, setPortfolioView] = useState<"chain" | "portfolio">("chain")
  const [allChainsBalances, setAllChainsBalances] = useState<Record<number, { balanceUSD: number; balanceNative: string; symbol: string }>>({})
  const [portfolioLoading, setPortfolioLoading] = useState(false)

  const fetchAllChainsBalances = useCallback(async () => {
    if (!addr) return
    setPortfolioLoading(true)
    const results: Record<number, { balanceUSD: number; balanceNative: string; symbol: string }> = {}
    
    for (const chain of CHAINS) {
      const cached = getChainCache(chain.id)
      if (cached) {
        results[chain.id] = {
          balanceUSD: cached.nativeUSD + (cached.tokens ? cached.tokens.reduce((s: number, t: any) => s + (t.valueUSD || 0), 0) : 0),
          balanceNative: cached.nativeBalance,
          symbol: chain.symbol,
        }
      } else {
        results[chain.id] = {
          balanceUSD: 0,
          balanceNative: "0.0000",
          symbol: chain.symbol,
        }
      }
    }
    setAllChainsBalances({ ...results })

    try {
      await Promise.all(CHAINS.map(async (chain) => {
        try {
          const provider = getProvider(chain)
          const weiBalance = await Promise.race([
            provider.getBalance(addr),
            new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 6000)),
          ])
          const nativeBal = parseFloat(ethers.formatEther(weiBalance))
          
          let price = 0
          try {
            const cgKey = chain.coingeckoId
            const cgRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgKey}&vs_currencies=usd`)
            if (cgRes.ok) {
              const cgData = await cgRes.json()
              price = cgData[cgKey]?.usd ?? 0
            }
          } catch {}

          if (price === 0) {
            try {
              const ccRes = await fetch(`https://min-api.cryptocompare.com/data/price?fsym=${chain.symbol}&tsyms=USD`)
              if (ccRes.ok) {
                const ccData = await ccRes.json()
                price = ccData.USD ?? 0
              }
            } catch {}
          }

          const balUSD = nativeBal * price
          results[chain.id] = {
            balanceUSD: balUSD,
            balanceNative: nativeBal.toFixed(4),
            symbol: chain.symbol,
          }
        } catch (e) {
          // Keep cached
        }
      }))
      setAllChainsBalances({ ...results })
    } catch {} finally {
      setPortfolioLoading(false)
    }
  }, [addr, getChainCache])

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
          kryptoNowProvider.init(addr, activeChain.id, activeChain.rpc)
        } catch {}
      }
    }
  }, [addr, activeChain])

  const zeroBalanceState = useCallback(() => {
    const nativeRow: TokenRow = {
      symbol: activeChain.symbol,
      name: activeChain.nativeName,
      balance: '0.000000',
      price: 0,
      change24h: 0,
      valueUSD: 0,
      isNative: true,
    }
    setTokens([nativeRow])
    setTotalUSD(0)
    setLoading(false)
    setRefreshing(false)
  }, [activeChain])

  const fetchBalances = useCallback(async (force = false) => {
    if (!addr) {
      zeroBalanceState()
      return
    }
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
    } catch {
      setError(true)
      zeroBalanceState()
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [addr, activeChain, zeroBalanceState])

  useEffect(() => {
    if (!isWalletLoaded) initFromStorage()
  }, [isWalletLoaded, initFromStorage])

  useEffect(() => {
    if (!isWalletLoaded) return
    setLoading(true)
    setError(false)
    setTokens([])
    setTotalUSD(0)
    fetchBalances(false)
    fetchAllChainsBalances()
    refreshTxns()
  }, [activeChain.id, addr, isWalletLoaded])

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
      (count: number) => setUnreadCount(prev => prev + count)
    )
    return () => stop()
  }, [addr, activeChain.id])

  const onRefresh = () => { setRefreshing(true); fetchBalances(true); fetchAllChainsBalances(); refreshTxns() }

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
      {/* Decorative Orbs inside main view */}
      <View style={s.bgCircle1} />
      <View style={s.bgCircle2} />

      {/* Balance Card */}
      <View style={s.balanceCard}>
        {/* Coloured header band */}
        <View style={[s.balCardBand, { backgroundColor: activeChain.color }]}>
          <View style={[s.avatarWrap, { backgroundColor: "rgba(255,255,255,0.22)" }]}>
            <Text style={s.avatarText}>{addr ? addr.slice(2, 4).toUpperCase() : "--"}</Text>
          </View>
          <Text style={s.walletAddr}>{short}</Text>
          <View style={[s.networkBadge, { backgroundColor: "rgba(255,255,255,0.18)", borderColor: "rgba(255,255,255,0.25)" }]}>
            <View style={s.networkDot} />
            <Text style={s.networkBadgeText}>{activeChain.name}</Text>
            <Text style={s.networkEncrypted}>• Encrypted</Text>
          </View>
        </View>
        {/* Body */}
        <View style={s.balCardBody}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <View style={{ flexDirection: "row", gap: 6, backgroundColor: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 3, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" }}>
              <TouchableOpacity
                onPress={() => setPortfolioView("chain")}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  backgroundColor: portfolioView === "chain" ? "rgba(255,255,255,0.08)" : "transparent"
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: portfolioView === "chain" ? ACCENT : "rgba(255,255,255,0.5)" }}>
                  Active Chain
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPortfolioView("portfolio")}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  backgroundColor: portfolioView === "portfolio" ? "rgba(255,255,255,0.08)" : "transparent"
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: "800", color: portfolioView === "portfolio" ? ACCENT : "rgba(255,255,255,0.5)" }}>
                  All Chains
                </Text>
              </TouchableOpacity>
            </View>
            {portfolioLoading && <ActivityIndicator size="small" color={activeChain.color} />}
          </View>

          <Text style={s.balLabel}>
            {portfolioView === "chain" ? "Chain Assets" : "Aggregate Portfolio"}
          </Text>

          {loading
            ? <ActivityIndicator color={activeChain.color} size="large" style={{ marginVertical: 12 }} />
            : <Text style={s.balAmount}>
                {portfolioView === "chain"
                  ? fmt(totalUSD)
                  : fmt(Object.values(allChainsBalances).reduce((sum, c) => sum + c.balanceUSD, 0))
                }
              </Text>
          }

          {portfolioView === "chain" && !loading && (
            <View style={s.balMeta}>
              <Text style={s.balNative}>
                {parseFloat(tokens[0]?.balance ?? '0').toFixed(4)} {activeChain.symbol}
              </Text>
              <View style={[s.changePill, { backgroundColor: (tokens[0]?.change24h ?? 0) >= 0 ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)" }]}>
                <Text style={[s.changeText, { color: (tokens[0]?.change24h ?? 0) >= 0 ? "#10B981" : "#EF4444" }]}>
                  {(tokens[0]?.change24h ?? 0) >= 0 ? "▲" : "▼"} {Math.abs(tokens[0]?.change24h ?? 0).toFixed(2)}%
                </Text>
              </View>
            </View>
          )}

          {portfolioView === "portfolio" && !loading && (
            <View style={{ marginTop: 12, flexDirection: "row", gap: 3, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.06)", width: "100%" }}>
              {CHAINS.map(c => {
                const chainVal = allChainsBalances[c.id]?.balanceUSD || 0
                const totalVal = Object.values(allChainsBalances).reduce((sum, ch) => sum + ch.balanceUSD, 0) || 1
                const pct = (chainVal / totalVal) * 100
                if (pct === 0) return null
                return (
                  <View
                    key={c.id}
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      backgroundColor: c.color
                    }}
                  />
                )
              })}
            </View>
          )}
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
        {ACTIONS.map(a => {
          const isPrimary = a.l === "Swap"
          return (
            <TouchableOpacity
              key={a.l}
              style={s.actionItem}
              onPress={() => router.push(a.route as any)}
              activeOpacity={0.75}
            >
              <View style={[
                s.actionBtn,
                isPrimary
                  ? { backgroundColor: activeChain.color, borderColor: "transparent", shadowColor: activeChain.color, shadowOpacity: 0.45, shadowRadius: 14, elevation: 8 }
                  : { borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }
              ]}>
                <Ionicons name={a.icon as any} size={22} color={isPrimary ? "#fff" : activeChain.color} />
              </View>
              <Text style={[s.actionLabel, isPrimary && { color: activeChain.color, fontWeight: "800" }]}>{a.l}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Assets */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>
          {portfolioView === "chain" ? `Assets on ${activeChain.name}` : "Multi-Chain Allocation"}
        </Text>
        {portfolioView === "portfolio" ? (
          CHAINS.map((c) => {
            const val = allChainsBalances[c.id]?.balanceUSD ?? 0
            const bal = allChainsBalances[c.id]?.balanceNative ?? "0.0000"
            const totalVal = Object.values(allChainsBalances).reduce((sum, ch) => sum + ch.balanceUSD, 0) || 1
            const pct = (val / totalVal) * 100
            const isActive = c.id === activeChain.id

            return (
              <TouchableOpacity
                key={c.id}
                style={[s.assetRow, isActive && { backgroundColor: "rgba(255,255,255,0.04)", borderColor: c.color, borderWidth: 1.5 }]}
                onPress={() => {
                  setActiveChain(c)
                  setPortfolioView("chain")
                }}
                activeOpacity={0.75}
              >
                <View style={[s.assetIcon, { backgroundColor: c.color + "22" }]}>
                  <Text style={[s.assetIconText, { color: c.color, fontSize: 13, fontWeight: "800" }]}>{c.icon}</Text>
                </View>
                <View style={s.assetMid}>
                  <Text style={s.assetName}>{c.name}</Text>
                  <Text style={s.assetBal}>{parseFloat(bal).toFixed(4)} {c.symbol}</Text>
                </View>
                
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                  <Sparkline change24h={isActive && tokens[0] ? tokens[0].change24h : (c.id === 1 ? 1.4 : -0.8)} />
                </View>

                <View style={{ marginRight: 10, backgroundColor: c.color + "1a", paddingVertical: 3, paddingHorizontal: 8, borderRadius: 8 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: c.color }}>
                    {pct.toFixed(1)}%
                  </Text>
                </View>
                
                <View style={s.assetRight}>
                  <Text style={s.assetValue}>{fmt(val)}</Text>
                  <Text style={[s.assetChange, { color: isActive ? c.color : "rgba(255,255,255,0.4)", fontWeight: "800", fontSize: 10 }]}>
                    {isActive ? "ACTIVE" : "SWITCH"}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          })
        ) : (
          loading ? (
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
                <View style={[s.assetIcon, { backgroundColor: (t.color ?? activeChain.color) + "22" }]}>
                  <Text style={[s.assetIconText, { color: t.color ?? activeChain.color }]}>
                    {t.isNative ? activeChain.icon : (t.icon ?? t.symbol.slice(0, 2))}
                  </Text>
                </View>
                <View style={s.assetMid}>
                  <Text style={s.assetName}>{t.name}</Text>
                  <Text style={s.assetBal}>{parseFloat(t.balance).toFixed(4)} {t.symbol}</Text>
                </View>
                
                <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                  <Sparkline change24h={t.change24h} />
                </View>

                <View style={s.assetRight}>
                  <Text style={s.assetValue}>{fmt(t.valueUSD)}</Text>
                  <Text style={[s.assetChange, { color: t.change24h >= 0 ? "#10B981" : "#EF4444" }]}>
                    {t.change24h === 0 ? "--" : (t.change24h >= 0 ? "+" : "") + t.change24h.toFixed(2) + "%"}
                  </Text>
                </View>
              </View>
            ))
          )
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
                  <Text style={{ fontSize: 10, fontWeight: "900", color: meta.color }}>
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
    <View style={s.c}>
      {/* WEB LAYOUT: sidebar + content */}
      {isLargeScreen ? (
        <View style={s.webLayout}>
          <Sidebar
            activeChain={activeChain}
            addr={addr}
            unreadCount={unreadCount}
            onSignOut={handleSignOut}
            accounts={accounts}
            activeAccountIndex={activeAccountIndex}
            onSwitchClick={() => setWalletSwitcherOpen(true)}
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
                <Text style={s.chainName}>{activeChain.name}</Text>
                <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.4)" />
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
                  accounts={accounts}
                  activeAccountIndex={activeAccountIndex}
                  onSwitchClick={() => setWalletSwitcherOpen(true)}
                />
              </Animated.View>
            </>
          )}
          <View style={s.header}>
            <TouchableOpacity
              style={s.hamburger}
              onPress={openDrawer}
              activeOpacity={0.7}
            >
              <Ionicons name="menu-outline" size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.chainPill}
              onPress={() => setChainModal(true)}
              activeOpacity={0.7}
            >
              <View style={[s.chainDot, { backgroundColor: activeChain.color }]} />
              <Text style={s.chainName}>{activeChain.name}</Text>
              <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
            <View style={s.headerRight}>
              <TouchableOpacity style={s.iconBtn} onPress={() => setFundSheet(true)}>
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
          <View style={[m.balCard, { backgroundColor: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.05)" }]}>
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
            { icon: "$", bg: "rgba(0, 212, 170, 0.1)", title: "Buy Crypto",    desc: "Purchase with card via MoonPay, Transak & more", route: "/buy"     },
            { icon: "v", bg: "rgba(255, 255, 255, 0.05)", title: "Receive Crypto", desc: "Deposit from another wallet or exchange",       route: "/receive" },
          ].map(item => (
            <TouchableOpacity
              key={item.title}
              style={m.fundCard}
              activeOpacity={0.85}
              onPress={() => { setFundSheet(false); router.push(item.route as any) }}
            >
              <View style={[m.fundIconWrap, { backgroundColor: item.bg }]}>
                <Text style={[m.fundIconText, { color: activeChain.color }]}>{item.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={m.fundCardTitle}>{item.title}</Text>
                <Text style={m.fundCardDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
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

      {/* Sleek 1-Tap Wallet Switcher Modal */}
      <Modal visible={walletSwitcherOpen} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Switch Wallet</Text>
              <TouchableOpacity onPress={() => setWalletSwitcherOpen(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.modalScroll} showsVerticalScrollIndicator={false}>
              {accounts.map((acc, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    s.walletSelectorItem,
                    { borderColor: activeAccountIndex === acc.accountIndex ? activeChain.color : "rgba(255, 255, 255, 0.05)" }
                  ]}
                  onPress={async () => {
                    await setActiveAccountIndex(acc.accountIndex)
                    setWalletSwitcherOpen(false)
                    closeDrawer()
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={[s.walletAvatarSmall, { backgroundColor: activeChain.color }]}>
                        <Text style={s.walletAvatarSmallT}>{acc.address ? acc.address.slice(2,4).toUpperCase() : "KN"}</Text>
                      </View>
                      <View>
                        <Text style={s.walletItemNum}>Account #{acc.accountIndex + 1}</Text>
                        <Text style={s.walletItemAddr}>
                          {acc.address ? `${acc.address.slice(0, 10)}...${acc.address.slice(-8)}` : ""}
                        </Text>
                      </View>
                    </View>
                    {activeAccountIndex === acc.accountIndex && (
                      <Ionicons name="checkmark-circle" size={24} color={activeChain.color} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[s.manageBtn, { borderColor: activeChain.color }]}
              onPress={() => {
                setWalletSwitcherOpen(false)
                closeDrawer()
                router.push("/settings" as any)
              }}
            >
              <Text style={[s.manageBtnT, { color: activeChain.color }]}>Manage All Wallets</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

// --- Sidebar Styles ---
const sb = StyleSheet.create({
  sidebar:       { width: 260, backgroundColor: BG_SIDEBAR, borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.05)", paddingTop: 24, paddingBottom: 16, flexDirection: "column", height: "100vh" as any, position: "sticky" as any, top: 0, overflow: "hidden" as any, flexShrink: 0 },
  logoWrap:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, marginBottom: 24 },
  logoIcon:      { position: "relative", width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  logoShield:    { width: 20, height: 20, borderRadius: 5, backgroundColor: ACCENT, transform: [{ rotate: "45deg" }], alignItems: "center", justifyContent: "center", position: "absolute" },
  logoShieldInner: { width: 14, height: 14, borderRadius: 3, backgroundColor: BG_SIDEBAR, transform: [{ rotate: "45deg" }], alignItems: "center", justifyContent: "center" },
  logoCore:      { width: 4, height: 4, borderRadius: 2, backgroundColor: "#ffffff" },
  logoRing:      { position: "absolute", width: 32, height: 12, borderRadius: 6, borderWidth: 1.8, borderColor: ACCENT2, transform: [{ rotate: "-15deg" }], zIndex: 10 },
  logoTitle:     { color: "#ffffff", fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  logoSub:       { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "600" },
  walletCard:    { marginHorizontal: 16, marginBottom: 20, borderRadius: 14, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  walletAvatar:  { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  walletAvatarT: { color: "#fff", fontSize: 13, fontWeight: "800" },
  walletName:    { color: "#ffffff", fontSize: 13, fontWeight: "800" },
  walletAddr:    { color: "rgba(255,255,255,0.4)", fontSize: 11, fontFamily: "monospace", marginTop: 2 },
  navScroll:     { flex: 1, paddingHorizontal: 12, overflow: "scroll" as any, maxHeight: "calc(100vh - 240px)" as any },
  navItem:       { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, marginBottom: 2, position: "relative" },
  navIcon:       { width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.03)", alignItems: "center", justifyContent: "center" },
  navLabel:      { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "700", flex: 1 },
  notifBadge:    { backgroundColor: "#EF4444", borderRadius: 10, minWidth: 18, height: 18, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  notifBadgeT:   { color: "#fff", fontSize: 10, fontWeight: "700" },
  activeBar:     { position: "absolute", right: 0, top: 8, bottom: 8, width: 3, borderRadius: 2 },
  bottomWrap:    { paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.05)" },
  signOutBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 14, backgroundColor: "rgba(239, 68, 68, 0.08)", borderWidth: 1.5, borderColor: "rgba(239, 68, 68, 0.2)" },
  signOutT:      { color: "#FF6B6B", fontSize: 14, fontWeight: "800" },
})

// --- Main Styles ---
const s = StyleSheet.create({
  c:               { flex: 1, backgroundColor: TEAL },
  webLayout:       { flex: 1, flexDirection: "row", height: "100vh" as any, overflow: "hidden" as any },
  hamburger:       { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginRight: 4 },
  drawer:          { position: "absolute", left: 0, top: 0, bottom: 0, width: 260, zIndex: 100, backgroundColor: BG_SIDEBAR, shadowColor: "#000", shadowOffset: { width: 4, height: 0 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 20 },
  drawerOverlay:   { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 99 },
  webMain:         { flex: 1, backgroundColor: TEAL, overflow: "scroll" as any, height: "100vh" as any },
  webTopBar:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 28, paddingVertical: 16, backgroundColor: BG_SIDEBAR, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  header:          { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 },
  chainPill:       { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.03)", paddingVertical: 9, paddingHorizontal: 16, borderRadius: 24, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.05)" },
  chainDot:        { width: 8, height: 8, borderRadius: 4 },
  chainName:       { fontSize: 13, fontWeight: "800", color: "#ffffff" },
  headerRight:     { flexDirection: "row", gap: 8 },
  iconBtn:         { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center" },
  bellBtn:         { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.03)", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.05)", alignItems: "center", justifyContent: "center", position: "relative" },
  bellBadge:       { position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#F6465D", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: BG_SIDEBAR },
  bellBadgeT:      { color: "#fff", fontSize: 9, fontWeight: "800" },
  
  /* Balance Card */
  balanceCard:     { marginHorizontal: 20, marginBottom: 24, borderRadius: 28, overflow: "hidden", backgroundColor: BG_DARK, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.05)", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
  balCardBand:     { paddingTop: 24, paddingBottom: 20, paddingHorizontal: 24, alignItems: "center" },
  balCardBody:     { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24, alignItems: "center", backgroundColor: "transparent" },
  avatarWrap:      { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 10, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" },
  avatarText:      { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
  walletAddr:      { color: "rgba(255,255,255,0.75)", fontSize: 12, marginBottom: 12, letterSpacing: 0.8, fontFamily: "monospace" },
  balLabel:        { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "700", marginBottom: 4, letterSpacing: 1, textTransform: "uppercase" },
  balAmount:       { color: "#ffffff", fontSize: 44, fontWeight: "900", letterSpacing: -1.5 },
  balMeta:         { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  balNative:       { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "600" },
  changePill:      { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  changeText:      { fontSize: 12, fontWeight: "800" },
  networkBadge:    { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 5, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  networkDot:      { width: 6, height: 6, borderRadius: 3, backgroundColor: "#00D4AA" },
  networkBadgeText:{ color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: "800" },
  networkEncrypted:{ color: "rgba(255,255,255,0.55)", fontSize: 11 },
  
  errorBanner:     { marginHorizontal: 16, marginBottom: 12, backgroundColor: "rgba(239, 68, 68, 0.08)", borderRadius: 14, borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.2)", padding: 13 },
  errorText:       { color: "#F6465D", fontSize: 13, textAlign: "center", fontWeight: "600" },
  actions:         { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 16, marginBottom: 32 },
  actionItem:      { alignItems: "center", gap: 8 },
  actionBtn:       { width: 60, height: 60, borderRadius: 30, backgroundColor: "rgba(255,255,255,0.02)", alignItems: "center", justifyContent: "center", borderWidth: 1.5, shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, elevation: 5 },
  actionLabel:     { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
  
  /* Section Elements */
  section:         { paddingHorizontal: 20, marginBottom: 28, maxWidth: 680, alignSelf: "center", width: "100%" },
  sectionHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle:    { color: "#ffffff", fontSize: 18, fontWeight: "900", marginBottom: 16, letterSpacing: -0.3 },
  viewAll:         { fontSize: 13, fontWeight: "800" },
  loadBox:         { backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 18, padding: 28, alignItems: "center", gap: 12, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.05)" },
  loadText:        { color: "rgba(255,255,255,0.4)", fontSize: 13 },
  emptyBox:        { backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 20, padding: 28, alignItems: "center", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.05)" },
  emptyIcon:       { fontSize: 36, marginBottom: 10 },
  emptyTitle:      { color: "#ffffff", fontSize: 15, fontWeight: "800", marginBottom: 4 },
  emptySub:        { color: "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "center" },
  
  /* List Rows */
  assetRow:        { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, marginBottom: 8, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.04)", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 2 },
  assetIcon:       { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", marginRight: 14 },
  assetIconText:   { fontSize: 18, fontWeight: "900" },
  assetMid:        { flex: 1 },
  assetName:       { color: "#ffffff", fontSize: 14, fontWeight: "800", marginBottom: 2 },
  assetBal:        { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },
  assetRight:      { alignItems: "flex-end" },
  assetValue:      { color: "#ffffff", fontSize: 15, fontWeight: "900" },
  assetChange:     { fontSize: 12, fontWeight: "800", marginTop: 3 },
  
  txRow:           { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 18, paddingVertical: 13, paddingHorizontal: 16, marginBottom: 8, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.04)", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 1 },
  txIcon:          { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginRight: 14 },
  txMid:           { flex: 1 },
  txLabel:         { color: "#ffffff", fontSize: 14, fontWeight: "800" },
  txAddr:          { color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 },
  txTime:          { color: "rgba(255,255,255,0.3)", fontSize: 11, marginTop: 1 },
  txAmt:           { fontSize: 14, fontWeight: "900" },

  /* Background Decorative Orbs */
  bgCircle1: {
    position: "absolute",
    top: 40,
    right: -40,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: ACCENT,
    opacity: 0.04,
  },
  bgCircle2: {
    position: "absolute",
    top: "35%",
    left: -60,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: ACCENT2,
    opacity: 0.03,
  },

  // Wallet Switcher Modal styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.7)", justifyContent: "flex-end" },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: "80%", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.05)" },
  modalHeader:  { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle:   { fontSize: 20, fontWeight: "900", color: "#ffffff" },
  modalScroll:  { paddingBottom: 20 },
  walletSelectorItem: { borderRadius: 18, padding: 14, borderWidth: 1.5, marginBottom: 12, backgroundColor: "rgba(255, 255, 255, 0.01)" },
  walletAvatarSmall: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  walletAvatarSmallT: { color: "#fff", fontSize: 11, fontWeight: "800" },
  walletItemNum: { fontSize: 14, fontWeight: "800", color: "#ffffff" },
  walletItemAddr: { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 2, color: "rgba(255,255,255,0.4)" },
  manageBtn: { width: "100%", paddingVertical: 14, borderRadius: 16, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 8 },
  manageBtnT: { fontSize: 14, fontWeight: "800" },
})

const m = StyleSheet.create({
  overlay:        { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.7)" },
  sheet:          { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: BG_DARK, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 36, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.05)" },
  handle:         { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)", alignSelf: "center", marginBottom: 20 },
  title:          { color: "#ffffff", fontSize: 18, fontWeight: "900", marginBottom: 4, paddingLeft: 4 },
  row:            { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, marginBottom: 8, backgroundColor: "rgba(255,255,255,0.01)" },
  rowActive:      { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  iconWrap:       { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginRight: 14 },
  icon:           { fontSize: 18, fontWeight: "800" },
  mid:            { flex: 1 },
  chainName:      { color: "#ffffff", fontSize: 15, fontWeight: "800" },
  chainSymbol:    { color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 2 },
  activeDot:      { width: 10, height: 10, borderRadius: 5 },
  fundSheet:      { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: BG_DARK, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 44, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.05)" },
  fundSub:        { color: "rgba(255,255,255,0.4)", fontSize: 13, marginBottom: 20, paddingLeft: 4 },
  balCard:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 18, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.05)", padding: 18, marginBottom: 20 },
  balCardLabel:   { color: "rgba(255,255,255,0.4)", fontSize: 11, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  balCardAmount:  { fontSize: 24, fontWeight: "900", letterSpacing: -0.5, marginBottom: 2 },
  balCardSub:     { color: "rgba(255,255,255,0.4)", fontSize: 12 },
  balChainBadge:  { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  balChainIcon:   { fontSize: 22, color: "#fff" },
  fundCard:       { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "rgba(255,255,255,0.02)", borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.04)" },
  fundIconWrap:   { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  fundIconText:   { fontSize: 22, fontWeight: "900" },
  fundCardTitle:  { color: "#ffffff", fontSize: 15, fontWeight: "800", marginBottom: 3 },
  fundCardDesc:   { color: "rgba(255,255,255,0.6)", fontSize: 12, lineHeight: 18 },
})