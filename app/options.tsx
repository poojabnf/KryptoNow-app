import { useState, useEffect, useCallback } from "react"
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, TextInput, Alert, Modal,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { useWalletStore } from "../store/walletStore"
import { loadPrivateKey } from "../store/keyStore"
import { ethers } from "ethers"
import { getProvider } from "../utils/chains"

//  Types 
type OptionType   = "call" | "put"
type OptionExpiry = "weekly" | "monthly" | "quarterly"
type GreekKey     = "delta" | "gamma" | "theta" | "vega"

interface OptionContract {
  id:           string
  protocol:     string
  protocolColor:string
  underlying:   string
  type:         OptionType
  strike:       number
  expiry:       string
  expiryDays:   number
  premium:      number
  premiumUSD:   number
  iv:           number
  openInterest: string
  greeks:       Record<GreekKey, number>
  moneyness:    "ITM" | "ATM" | "OTM"
  chain:        string
  chainId:      number
}

interface Position {
  id:           string
  contract:     OptionContract
  size:         number
  entryPremium: number
  entryTime:    number
  pnl:          number
  pnlPct:       number
}

//  Mock live data (replace with Lyra/Premia SDK) 
function generateOptions(
  underlying: string,
  spotPrice: number,
  type: OptionType,
): OptionContract[] {
  const strikes = [
    spotPrice * 0.80, spotPrice * 0.85, spotPrice * 0.90, spotPrice * 0.95,
    spotPrice,
    spotPrice * 1.05, spotPrice * 1.10, spotPrice * 1.15, spotPrice * 1.20,
  ].map(s => Math.round(s / 100) * 100)

  const expiries = [
    { label: "7D",  days: 7,   type: "weekly"    as OptionExpiry },
    { label: "30D", days: 30,  type: "monthly"   as OptionExpiry },
    { label: "90D", days: 90,  type: "quarterly" as OptionExpiry },
  ]

  const protocols = [
    { name: "Lyra",   color: "#6366F1", chain: "Arbitrum", chainId: 42161 },
    { name: "Premia", color: "#F59E0B", chain: "Arbitrum", chainId: 42161 },
    { name: "Dopex",  color: "#EF4444", chain: "Arbitrum", chainId: 42161 },
  ]

  return strikes.flatMap((strike, si) =>
    expiries.map((exp, ei) => {
      const protocol  = protocols[(si + ei) % protocols.length]
      const moneyness = strike < spotPrice * 0.98 ? (type === "call" ? "OTM" : "ITM")
                      : strike > spotPrice * 1.02 ? (type === "call" ? "ITM" : "OTM")
                      : "ATM"
      const iv        = 0.6 + Math.random() * 0.4
      const t         = exp.days / 365
      const intrinsic = type === "call"
        ? Math.max(0, spotPrice - strike)
        : Math.max(0, strike - spotPrice)
      const timeValue = spotPrice * iv * Math.sqrt(t) * 0.4
      const premium   = (intrinsic + timeValue) / spotPrice * 0.08

      // Simplified Greeks
      const delta = type === "call"
        ? Math.max(0.05, Math.min(0.95, 0.5 + (spotPrice - strike) / (spotPrice * iv * Math.sqrt(t))))
        : Math.max(-0.95, Math.min(-0.05, -0.5 + (spotPrice - strike) / (spotPrice * iv * Math.sqrt(t))))
      const gamma = 0.01 + Math.random() * 0.03
      const theta = -(premium * spotPrice * 0.01) / exp.days
      const vega  = premium * spotPrice * Math.sqrt(t) * 0.1

      return {
        id:            `${protocol.name}-${underlying}-${type}-${strike}-${exp.label}`,
        protocol:      protocol.name,
        protocolColor: protocol.color,
        underlying,
        type,
        strike,
        expiry:        exp.label,
        expiryDays:    exp.days,
        premium:       parseFloat(premium.toFixed(4)),
        premiumUSD:    parseFloat((premium * spotPrice).toFixed(2)),
        iv:            parseFloat((iv * 100).toFixed(1)),
        openInterest:  `$${(Math.random() * 50 + 5).toFixed(1)}M`,
        greeks:        {
          delta: parseFloat(delta.toFixed(3)),
          gamma: parseFloat(gamma.toFixed(4)),
          theta: parseFloat(theta.toFixed(4)),
          vega:  parseFloat(vega.toFixed(4)),
        },
        moneyness,
        chain:   protocol.chain,
        chainId: protocol.chainId,
      }
    })
  )
}

//  Fetch spot prices 
async function fetchSpotPrices(): Promise<Record<string, number>> {
  try {
    const res  = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,bitcoin,matic-network&vs_currencies=usd"
    )
    const data = await res.json()
    return {
      ETH:  data.ethereum?.usd    ?? 3200,
      BTC:  data.bitcoin?.usd     ?? 65000,
      MATIC:data["matic-network"]?.usd ?? 0.8,
    }
  } catch {
    return { ETH: 3200, BTC: 65000, MATIC: 0.8 }
  }
}

//  P&L Calculator 
function calcPnL(contract: OptionContract, size: number, spotAtExpiry: number) {
  const cost      = contract.premium * size
  const intrinsic = contract.type === "call"
    ? Math.max(0, spotAtExpiry / contract.strike - 1) * size
    : Math.max(0, 1 - spotAtExpiry / contract.strike) * size
  const pnl       = intrinsic - cost
  const pnlPct    = (pnl / cost) * 100
  const breakeven = contract.type === "call"
    ? contract.strike * (1 + contract.premium)
    : contract.strike * (1 - contract.premium)
  return { pnl, pnlPct, breakeven, maxLoss: -cost, maxProfit: contract.type === "call" ? Infinity : contract.strike * size - cost }
}

//  Option Card 
function OptionCard({
  option, spotPrice, onBuy,
}: {
  option: OptionContract
  spotPrice: number
  onBuy: (o: OptionContract) => void
}) {
  const activeChain = useWalletStore(s => s.activeChain)
  const moneynessColor = option.moneyness === "ITM" ? "#10B981"
    : option.moneyness === "ATM" ? "#F59E0B" : "#64748B"

  return (
    <TouchableOpacity style={oc.card} onPress={() => onBuy(option)} activeOpacity={0.85}>
      <View style={oc.header}>
        <View style={[oc.protocolBadge, { backgroundColor: option.protocolColor + "20" }]}>
          <Text style={[oc.protocolText, { color: option.protocolColor }]}>{option.protocol}</Text>
        </View>
        <View style={[oc.moneynessBadge, { backgroundColor: moneynessColor + "20" }]}>
          <Text style={[oc.moneynessText, { color: moneynessColor }]}>{option.moneyness}</Text>
        </View>
        <Text style={oc.chain}>{option.chain}</Text>
      </View>

      <View style={oc.main}>
        <View>
          <Text style={oc.strike}>${option.strike.toLocaleString()}</Text>
          <Text style={oc.expiry}>Expires in {option.expiryDays}d  IV {option.iv}%</Text>
        </View>
        <View style={oc.premiumWrap}>
          <Text style={[oc.premium, { color: activeChain.color }]}>${option.premiumUSD.toFixed(2)}</Text>
          <Text style={oc.premiumSub}>{option.premium.toFixed(4)} ETH</Text>
        </View>
      </View>

      <View style={oc.greeks}>
        {(Object.entries(option.greeks) as [GreekKey, number][]).map(([key, val]) => (
          <View key={key} style={oc.greek}>
            <Text style={oc.greekLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
            <Text style={oc.greekVal}>{val > 0 ? "+" : ""}{val.toFixed(3)}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={[oc.buyBtn, { backgroundColor: activeChain.color }]} onPress={() => onBuy(option)}>
        <Text style={oc.buyBtnText}>Buy Option</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  )
}

//  Buy Modal 
function BuyModal({
  option, spotPrice, onClose, onConfirm,
}: {
  option: OptionContract
  spotPrice: number
  onClose: () => void
  onConfirm: (size: number) => void
}) {
  const activeChain = useWalletStore(s => s.activeChain)
  const [size,       setSize]       = useState("1")
  const [simPrice,   setSimPrice]   = useState(String(Math.round(spotPrice)))
  const sizeNum     = parseFloat(size)  || 1
  const simPriceNum = parseFloat(simPrice) || spotPrice
  const pnlData     = calcPnL(option, sizeNum, simPriceNum)
  const totalCost   = (option.premiumUSD * sizeNum).toFixed(2)

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={bm.overlay}>
        <View style={bm.sheet}>
          <View style={bm.handle} />

          {/* Header */}
          <View style={bm.header}>
            <View>
              <Text style={bm.title}>
                {option.underlying} ${option.strike.toLocaleString()} {option.type.toUpperCase()}
              </Text>
              <Text style={bm.sub}>{option.protocol}  {option.expiry}  {option.moneyness}</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close-circle" size={28} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Size input */}
            <Text style={bm.label}>Number of Contracts</Text>
            <View style={bm.inputRow}>
              <TouchableOpacity style={bm.stepper} onPress={() => setSize(String(Math.max(1, sizeNum - 1)))}>
                <Ionicons name="remove" size={20} color="#1E1B4B" />
              </TouchableOpacity>
              <TextInput
                style={bm.sizeInput}
                value={size}
                onChangeText={setSize}
                keyboardType="decimal-pad"
                textAlign="center"
              />
              <TouchableOpacity style={bm.stepper} onPress={() => setSize(String(sizeNum + 1))}>
                <Ionicons name="add" size={20} color="#1E1B4B" />
              </TouchableOpacity>
            </View>

            {/* Cost summary */}
            <View style={[bm.costCard, { borderColor: activeChain.color + "33", backgroundColor: activeChain.color + "08" }]}>
              <View style={bm.costRow}>
                <Text style={bm.costLabel}>Premium per contract</Text>
                <Text style={bm.costVal}>${option.premiumUSD.toFixed(2)}</Text>
              </View>
              <View style={bm.costRow}>
                <Text style={bm.costLabel}>Contracts</Text>
                <Text style={bm.costVal}> {sizeNum}</Text>
              </View>
              <View style={[bm.costRow, bm.costTotal]}>
                <Text style={bm.totalLabel}>Total Cost</Text>
                <Text style={[bm.totalVal, { color: activeChain.color }]}>${totalCost}</Text>
              </View>
            </View>

            {/* P&L Simulator */}
            <Text style={bm.label}>P&L Simulator</Text>
            <Text style={bm.sublabel}>Simulate {option.underlying} price at expiry</Text>
            <TextInput
              style={bm.simInput}
              value={simPrice}
              onChangeText={setSimPrice}
              keyboardType="decimal-pad"
              placeholder={String(spotPrice)}
            />

            <View style={bm.pnlCard}>
              <View style={bm.pnlRow}>
                <Text style={bm.pnlLabel}>Breakeven Price</Text>
                <Text style={bm.pnlVal}>${pnlData.breakeven.toLocaleString("en-US", { maximumFractionDigits: 0 })}</Text>
              </View>
              <View style={bm.pnlRow}>
                <Text style={bm.pnlLabel}>Max Loss</Text>
                <Text style={[bm.pnlVal, { color: "#EF4444" }]}>${Math.abs(pnlData.maxLoss).toFixed(2)}</Text>
              </View>
              <View style={bm.pnlRow}>
                <Text style={bm.pnlLabel}>Max Profit</Text>
                <Text style={[bm.pnlVal, { color: "#10B981" }]}>
                  {pnlData.maxProfit === Infinity ? "Unlimited" : `$${pnlData.maxProfit.toFixed(2)}`}
                </Text>
              </View>
              <View style={[bm.pnlRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F1F5F9" }]}>
                <Text style={bm.pnlLabel}>Simulated P&L</Text>
                <Text style={[bm.pnlVal, { color: pnlData.pnl >= 0 ? "#10B981" : "#EF4444", fontSize: 18, fontWeight: "800" }]}>
                  {pnlData.pnl >= 0 ? "+" : ""}${pnlData.pnl.toFixed(2)} ({pnlData.pnlPct.toFixed(1)}%)
                </Text>
              </View>
            </View>

            {/* Risk warning */}
            <View style={bm.warnBox}>
              <Ionicons name="warning-outline" size={16} color="#F59E0B" />
              <Text style={bm.warnText}>
                Options trading carries significant risk. You can lose your entire premium. This is not financial advice.
              </Text>
            </View>

            <TouchableOpacity
              style={[bm.confirmBtn, { backgroundColor: activeChain.color }]}
              onPress={() => onConfirm(sizeNum)}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#0D2E2E" />
              <Text style={bm.confirmBtnText}>Confirm Purchase  ${totalCost}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

//  Main Screen 
export default function Options() {
  const activeChain = useWalletStore(s => s.activeChain)
  const addr        = useWalletStore(s => s.address)

  const [tab,        setTab]        = useState<"buy" | "positions">("buy")
  const [underlying, setUnderlying] = useState<"ETH" | "BTC" | "MATIC">("ETH")
  const [optionType, setOptionType] = useState<OptionType>("call")
  const [expiry,     setExpiry]     = useState<OptionExpiry>("monthly")
  const [spotPrices, setSpotPrices] = useState<Record<string, number>>({})
  const [options,    setOptions]    = useState<OptionContract[]>([])
  const [positions,  setPositions]  = useState<Position[]>([])
  const [loading,    setLoading]    = useState(true)
  const [buying,     setBuying]     = useState(false)
  const [selected,   setSelected]   = useState<OptionContract | null>(null)
  const [sortBy,     setSortBy]     = useState<"strike" | "premium" | "iv">("strike")

  // Load spot prices
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const prices = await fetchSpotPrices()
      setSpotPrices(prices)
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  // Generate options chain
  useEffect(() => {
    if (!spotPrices[underlying]) return
    const chain = generateOptions(underlying, spotPrices[underlying], optionType)
    const filtered = chain.filter(o => o.expiry === (
      expiry === "weekly" ? "7D" : expiry === "monthly" ? "30D" : "90D"
    ))
    const sorted = [...filtered].sort((a, b) =>
      sortBy === "strike"  ? a.strike - b.strike
      : sortBy === "premium" ? b.premiumUSD - a.premiumUSD
      : b.iv - a.iv
    )
    setOptions(sorted)
  }, [spotPrices, underlying, optionType, expiry, sortBy])

  // Buy option
  const handleBuy = useCallback(async (option: OptionContract, size: number) => {
    setBuying(true)
    setSelected(null)
    try {
      // In production: call Lyra/Premia SDK to buy the option on-chain
      // For now: simulate the purchase
      await new Promise(r => setTimeout(r, 2000))
      const newPosition: Position = {
        id:           `pos-${Date.now()}`,
        contract:     option,
        size,
        entryPremium: option.premiumUSD,
        entryTime:    Date.now(),
        pnl:          0,
        pnlPct:       0,
      }
      setPositions(prev => [...prev, newPosition])
      Alert.alert(
        " Option Purchased!",
        `${size}x ${option.underlying} $${option.strike} ${option.type.toUpperCase()} on ${option.protocol}\n\nTotal cost: $${(option.premiumUSD * size).toFixed(2)}`,
        [{ text: "View Positions", onPress: () => setTab("positions") }, { text: "OK" }]
      )
    } catch (e: any) {
      Alert.alert("Purchase Failed", e.message)
    } finally { setBuying(false) }
  }, [])

  const spotPrice = spotPrices[underlying] ?? 0

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <View>
          <Text style={s.title}>Options Trading</Text>
          <Text style={s.subtitle}>DeFi options via Lyra  Premia  Dopex</Text>
        </View>
      </View>

      {/* Spot prices */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tickerScroll} contentContainerStyle={s.tickerContent}>
        {Object.entries(spotPrices).map(([sym, price]) => (
          <TouchableOpacity
            key={sym}
            style={[s.tickerCard, underlying === sym && { borderColor: activeChain.color, backgroundColor: activeChain.color + "10" }]}
            onPress={() => setUnderlying(sym as any)}
          >
            <Text style={s.tickerSym}>{sym}</Text>
            <Text style={[s.tickerPrice, underlying === sym && { color: activeChain.color }]}>
              ${price.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(["buy", "positions"] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[s.tab, tab === t && { borderBottomColor: activeChain.color, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[s.tabText, tab === t && { color: activeChain.color, fontWeight: "700" }]}>
              {t === "buy" ? "Options Chain" : `Positions (${positions.length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "buy" ? (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {/* Filters */}
          <View style={s.filterRow}>
            {/* Call/Put */}
            <View style={s.filterGroup}>
              {(["call", "put"] as OptionType[]).map(t => (
                <TouchableOpacity
                  key={t}
                  style={[s.filterBtn, optionType === t && { backgroundColor: t === "call" ? "#10B981" : "#EF4444" }]}
                  onPress={() => setOptionType(t)}
                >
                  <Text style={[s.filterBtnText, optionType === t && { color: "#fff" }]}>
                    {t === "call" ? " Call" : " Put"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Expiry */}
            <View style={s.filterGroup}>
              {(["weekly", "monthly", "quarterly"] as OptionExpiry[]).map(e => (
                <TouchableOpacity
                  key={e}
                  style={[s.filterBtn, expiry === e && { backgroundColor: activeChain.color }]}
                  onPress={() => setExpiry(e)}
                >
                  <Text style={[s.filterBtnText, expiry === e && { color: "#0D2E2E" }]}>
                    {e === "weekly" ? "7D" : e === "monthly" ? "30D" : "90D"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Sort */}
          <View style={s.sortRow}>
            <Text style={s.sortLabel}>Sort by:</Text>
            {(["strike", "premium", "iv"] as const).map(so => (
              <TouchableOpacity
                key={so}
                style={[s.sortBtn, sortBy === so && { backgroundColor: activeChain.color + "20" }]}
                onPress={() => setSortBy(so)}
              >
                <Text style={[s.sortBtnText, sortBy === so && { color: activeChain.color, fontWeight: "700" }]}>
                  {so === "strike" ? "Strike" : so === "premium" ? "Premium" : "IV"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <View style={s.loadBox}>
              <ActivityIndicator size="large" color={activeChain.color} />
              <Text style={s.loadText}>Fetching options chain...</Text>
            </View>
          ) : options.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="bar-chart-outline" size={48} color="#CBD5E1" />
              <Text style={s.emptyText}>No options available</Text>
            </View>
          ) : (
            options.map(o => (
              <OptionCard key={o.id} option={o} spotPrice={spotPrice} onBuy={setSelected} />
            ))
          )}
        </ScrollView>
      ) : (
        <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
          {positions.length === 0 ? (
            <View style={s.emptyBox}>
              <Ionicons name="receipt-outline" size={48} color="#CBD5E1" />
              <Text style={s.emptyText}>No open positions</Text>
              <Text style={s.emptySub}>Buy options to see them here</Text>
              <TouchableOpacity style={[s.emptyBtn, { backgroundColor: activeChain.color }]} onPress={() => setTab("buy")}>
                <Text style={s.emptyBtnText}>Browse Options</Text>
              </TouchableOpacity>
            </View>
          ) : (
            positions.map(pos => {
              const currentPnL = calcPnL(pos.contract, pos.size, spotPrice)
              return (
                <View key={pos.id} style={pos2.card}>
                  <View style={pos2.header}>
                    <View style={[pos2.typeBadge, { backgroundColor: pos.contract.type === "call" ? "#ECFDF5" : "#FEF2F2" }]}>
                      <Text style={[pos2.typeText, { color: pos.contract.type === "call" ? "#10B981" : "#EF4444" }]}>
                        {pos.contract.type === "call" ? " CALL" : " PUT"}
                      </Text>
                    </View>
                    <Text style={pos2.protocol}>{pos.contract.protocol}</Text>
                  </View>

                  <View style={pos2.details}>
                    <View style={pos2.detail}>
                      <Text style={pos2.detailLabel}>Underlying</Text>
                      <Text style={pos2.detailVal}>{pos.contract.underlying}</Text>
                    </View>
                    <View style={pos2.detail}>
                      <Text style={pos2.detailLabel}>Strike</Text>
                      <Text style={pos2.detailVal}>${pos.contract.strike.toLocaleString()}</Text>
                    </View>
                    <View style={pos2.detail}>
                      <Text style={pos2.detailLabel}>Size</Text>
                      <Text style={pos2.detailVal}>{pos.size}x</Text>
                    </View>
                    <View style={pos2.detail}>
                      <Text style={pos2.detailLabel}>Expires</Text>
                      <Text style={pos2.detailVal}>{pos.contract.expiryDays}d</Text>
                    </View>
                  </View>

                  <View style={pos2.pnlRow}>
                    <View>
                      <Text style={pos2.pnlLabel}>Entry Cost</Text>
                      <Text style={pos2.pnlVal}>${(pos.entryPremium * pos.size).toFixed(2)}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={pos2.pnlLabel}>Current P&L</Text>
                      <Text style={[pos2.pnl, { color: currentPnL.pnl >= 0 ? "#10B981" : "#EF4444" }]}>
                        {currentPnL.pnl >= 0 ? "+" : ""}${currentPnL.pnl.toFixed(2)} ({currentPnL.pnlPct.toFixed(1)}%)
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={pos2.closeBtn}
                    onPress={() => {
                      Alert.alert("Close Position", "Are you sure you want to close this position?", [
                        { text: "Cancel", style: "cancel" },
                        { text: "Close", style: "destructive", onPress: () => setPositions(prev => prev.filter(p => p.id !== pos.id)) }
                      ])
                    }}
                  >
                    <Text style={pos2.closeBtnText}>Close Position</Text>
                  </TouchableOpacity>
                </View>
              )
            })
          )}
        </ScrollView>
      )}

      {/* Buy Modal */}
      {selected && (
        <BuyModal
          option={selected}
          spotPrice={spotPrice}
          onClose={() => setSelected(null)}
          onConfirm={(size) => handleBuy(selected, size)}
        />
      )}

      {/* Buying overlay */}
      {buying && (
        <View style={s.buyingOverlay}>
          <ActivityIndicator size="large" color="#00D4AA" />
          <Text style={s.buyingText}>Executing on-chain...</Text>
        </View>
      )}
    </View>
  )
}

//  Option Card Styles 
const oc = StyleSheet.create({
  card:           { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#F1F5F9", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  header:         { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  protocolBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  protocolText:   { fontSize: 11, fontWeight: "700" },
  moneynessBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  moneynessText:  { fontSize: 11, fontWeight: "700" },
  chain:          { fontSize: 11, color: "#94A3B8", marginLeft: "auto" },
  main:           { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  strike:         { fontSize: 22, fontWeight: "800", color: "#1E1B4B" },
  expiry:         { fontSize: 12, color: "#64748B", marginTop: 2 },
  premiumWrap:    { alignItems: "flex-end" },
  premium:        { fontSize: 20, fontWeight: "800" },
  premiumSub:     { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  greeks:         { flexDirection: "row", backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, marginBottom: 12, justifyContent: "space-around" },
  greek:          { alignItems: "center" },
  greekLabel:     { fontSize: 10, color: "#94A3B8", fontWeight: "600", marginBottom: 2 },
  greekVal:       { fontSize: 12, color: "#1E1B4B", fontWeight: "700" },
  buyBtn:         { padding: 12, borderRadius: 12, alignItems: "center" },
  buyBtnText:     { color: "#0D2E2E", fontWeight: "800", fontSize: 14 },
})

//  Buy Modal Styles 
const bm = StyleSheet.create({
  overlay:       { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet:         { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "90%" },
  handle:        { width: 40, height: 4, backgroundColor: "#E2E8F0", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  header:        { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title:         { fontSize: 18, fontWeight: "800", color: "#1E1B4B" },
  sub:           { fontSize: 13, color: "#64748B", marginTop: 4 },
  label:         { fontSize: 13, fontWeight: "700", color: "#1E1B4B", marginBottom: 8 },
  sublabel:      { fontSize: 12, color: "#64748B", marginBottom: 8, marginTop: -4 },
  inputRow:      { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  stepper:       { width: 40, height: 40, borderRadius: 12, backgroundColor: "#F1F5F9", alignItems: "center", justifyContent: "center" },
  sizeInput:     { flex: 1, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, fontSize: 24, fontWeight: "800", color: "#1E1B4B", borderWidth: 1.5, borderColor: "#E2E8F0" },
  costCard:      { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 20 },
  costRow:       { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  costLabel:     { fontSize: 13, color: "#64748B" },
  costVal:       { fontSize: 13, color: "#1E1B4B", fontWeight: "600" },
  costTotal:     { borderTopWidth: 1, borderTopColor: "#E2E8F0", paddingTop: 8, marginTop: 4 },
  totalLabel:    { fontSize: 15, fontWeight: "700", color: "#1E1B4B" },
  totalVal:      { fontSize: 18, fontWeight: "800" },
  simInput:      { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, fontSize: 16, borderWidth: 1.5, borderColor: "#E2E8F0", marginBottom: 12 },
  pnlCard:       { backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14, marginBottom: 16 },
  pnlRow:        { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  pnlLabel:      { fontSize: 13, color: "#64748B" },
  pnlVal:        { fontSize: 14, fontWeight: "700", color: "#1E1B4B" },
  warnBox:       { flexDirection: "row", gap: 8, backgroundColor: "#FFFBEB", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FDE68A", marginBottom: 16 },
  warnText:      { flex: 1, fontSize: 12, color: "#92400E", lineHeight: 18 },
  confirmBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 16, marginBottom: 8 },
  confirmBtnText:{ color: "#0D2E2E", fontSize: 16, fontWeight: "800" },
})

//  Position Styles 
const pos2 = StyleSheet.create({
  card:        { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#F1F5F9" },
  header:      { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  typeBadge:   { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeText:    { fontSize: 12, fontWeight: "800" },
  protocol:    { fontSize: 13, color: "#64748B", marginLeft: "auto" },
  details:     { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  detail:      { flex: 1, minWidth: "22%", backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10 },
  detailLabel: { fontSize: 10, color: "#94A3B8", fontWeight: "600", marginBottom: 4 },
  detailVal:   { fontSize: 14, fontWeight: "800", color: "#1E1B4B" },
  pnlRow:      { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, marginBottom: 12 },
  pnlLabel:    { fontSize: 12, color: "#94A3B8", marginBottom: 4 },
  pnlVal:      { fontSize: 15, fontWeight: "700", color: "#1E1B4B" },
  pnl:         { fontSize: 18, fontWeight: "800" },
  closeBtn:    { padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#EF4444", alignItems: "center" },
  closeBtnText:{ color: "#EF4444", fontWeight: "700", fontSize: 14 },
})

//  Main Styles 
const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: "#F8FAFC" },
  header:        { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, paddingTop: 20 },
  backBtn:       { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  title:         { fontSize: 20, fontWeight: "800", color: "#1E1B4B" },
  subtitle:      { fontSize: 12, color: "#64748B", marginTop: 2 },
  tickerScroll:  { maxHeight: 80 },
  tickerContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  tickerCard:    { backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: "#E2E8F0", minWidth: 90, alignItems: "center" },
  tickerSym:     { fontSize: 12, fontWeight: "700", color: "#94A3B8", marginBottom: 4 },
  tickerPrice:   { fontSize: 15, fontWeight: "800", color: "#1E1B4B" },
  tabRow:        { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E2E8F0", backgroundColor: "#fff" },
  tab:           { flex: 1, padding: 14, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText:       { fontSize: 14, color: "#94A3B8", fontWeight: "500" },
  scroll:        { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  filterRow:     { gap: 8, marginBottom: 12 },
  filterGroup:   { flexDirection: "row", gap: 6 },
  filterBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: "#F1F5F9" },
  filterBtnText: { fontSize: 13, fontWeight: "600", color: "#64748B" },
  sortRow:       { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  sortLabel:     { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
  sortBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  sortBtnText:   { fontSize: 12, color: "#64748B" },
  loadBox:       { alignItems: "center", paddingVertical: 40, gap: 12 },
  loadText:      { fontSize: 14, color: "#64748B" },
  emptyBox:      { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyText:     { fontSize: 18, fontWeight: "700", color: "#1E1B4B" },
  emptySub:      { fontSize: 14, color: "#64748B" },
  emptyBtn:      { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
  emptyBtnText:  { color: "#0D2E2E", fontWeight: "700" },
  buyingOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", gap: 16 },
  buyingText:    { color: "#fff", fontSize: 16, fontWeight: "600" },
})