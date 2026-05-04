import { useState, useCallback } from "react"
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from "react-native"
import { router } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { ethers } from "ethers"
import { useWalletStore } from "../store/walletStore"
import { loadPrivateKey } from "../store/keyStore"
import { isValidAddress } from "../utils/crypto"
import { getProvider, getTxUrl } from "../utils/chains"
import { sendBatchUserOp, chainSupportsAA, encodeERC20Transfer } from "../utils/aa"

//  Types 
interface BatchItem {
  id: string
  to: string
  amount: string
  memo: string
  status: "pending" | "sending" | "success" | "failed"
  txHash?: string
  error?: string
}

interface BatchResult {
  to: string
  amount: string
  txHash?: string
  error?: string
  status: "success" | "failed"
}

//  Helpers 
function makeId() { return Math.random().toString(36).slice(2, 8) }

function shortAddr(addr: string) {
  return addr.length > 10 ? addr.slice(0, 6) + "..." + addr.slice(-4) : addr
}

//  Main Component 
export default function BatchSend() {
  const activeChain = useWalletStore(s => s.activeChain)
  const addr        = useWalletStore(s => s.address)

  const [items, setItems] = useState<BatchItem[]>([
    { id: makeId(), to: "", amount: "", memo: "", status: "pending" },
    { id: makeId(), to: "", amount: "", memo: "", status: "pending" },
  ])
  const [sending, setSending]   = useState(false)
  const [results, setResults]   = useState<BatchResult[] | null>(null)
  const [gasEst,  setGasEst]    = useState<string | null>(null)
  const [estimating, setEst]    = useState(false)

  //  Add / Remove 
  const addItem = () => {
    if (items.length >= 10) return Alert.alert("Max 10 transactions per batch")
    setItems(prev => [...prev, { id: makeId(), to: "", amount: "", memo: "", status: "pending" }])
  }

  const removeItem = (id: string) => {
    if (items.length <= 1) return
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const updateItem = (id: string, field: keyof BatchItem, value: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  //  Validation 
  const validate = (): string | null => {
    for (const item of items) {
      if (!item.to.trim()) return "All recipient addresses are required"
      if (!isValidAddress(item.to.trim())) return `Invalid address: ${shortAddr(item.to)}`
      if (!item.amount || isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0)
        return `Invalid amount for ${shortAddr(item.to)}`
    }
    return null
  }

  //  Gas Estimation 
  const estimateGas = useCallback(async () => {
    const err = validate()
    if (err) return Alert.alert("Fix errors first", err)

    setEst(true)
    try {
      const provider  = getProvider(activeChain)
      const feeData   = await provider.getFeeData()
      const gasPrice  = feeData.gasPrice ?? ethers.parseUnits("20", "gwei")
      const gasPerTx  = BigInt(21000)
      const totalGas  = gasPerTx * BigInt(items.length)
      const totalCost = totalGas * gasPrice
      setGasEst(ethers.formatEther(totalCost))
    } catch {
      setGasEst("Unable to estimate")
    } finally {
      setEst(false)
    }
  }, [items, activeChain])

  //  Send Batch 
  const sendBatch = async () => {
    const err = validate()
    if (err) return Alert.alert("Validation Error", err)

    Alert.alert(
      "Confirm Batch",
      `Send ${items.length} transactions on ${activeChain.name}?\n\n${chainSupportsAA(activeChain.id) ? "Atomic: all succeed or all revert in one UserOp." : "Sequential: each tx is independent."}`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send All", style: "destructive", onPress: executeBatch },
      ]
    )
  }

  const executeBatch = async () => {
    setSending(true)
    const batchResults: BatchResult[] = []

    try {
      const privateKey = await loadPrivateKey()
      if (!privateKey) throw new Error("Could not load private key")

      //  ERC-4337 atomic batch (all chains except BSC) 
      if (chainSupportsAA(activeChain.id)) {
        // Mark all as sending
        setItems(prev => prev.map(it => ({ ...it, status: "sending" })))

        const calls = items.map(item => ({
          to:    item.to.trim(),
          value: ethers.parseEther(item.amount),
          data:  "0x",
        }))

        const result = await sendBatchUserOp(privateKey, activeChain.id, calls)

        if (result.ok) {
          // All succeeded  one txHash for the whole batch
          setItems(prev => prev.map(it => ({ ...it, status: "success", txHash: result.txHash })))
          items.forEach(item => batchResults.push({
            to: item.to, amount: item.amount,
            txHash: result.txHash, status: "success",
          }))
        } else {
          // Atomic revert  all failed together
          setItems(prev => prev.map(it => ({ ...it, status: "failed", error: result.error })))
          items.forEach(item => batchResults.push({
            to: item.to, amount: item.amount,
            error: result.error, status: "failed",
          }))
          Alert.alert("Batch Reverted", result.error ?? "All transactions reverted atomically.")
        }

      //  Legacy sequential fallback (BSC) 
      } else {
        const provider = getProvider(activeChain)
        const wallet   = new ethers.Wallet(privateKey, provider)
        let nonce      = await provider.getTransactionCount(wallet.address, "latest")
        const feeData  = await provider.getFeeData()

        for (let i = 0; i < items.length; i++) {
          const item = items[i]
          setItems(prev => prev.map(it =>
            it.id === item.id ? { ...it, status: "sending" } : it
          ))
          try {
            const tx = await wallet.sendTransaction({
              to:                   item.to.trim(),
              value:                ethers.parseEther(item.amount),
              nonce:                nonce++,
              maxFeePerGas:         feeData.maxFeePerGas         ?? undefined,
              maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
            })
            setItems(prev => prev.map(it =>
              it.id === item.id ? { ...it, status: "success", txHash: tx.hash } : it
            ))
            batchResults.push({ to: item.to, amount: item.amount, txHash: tx.hash, status: "success" })
          } catch (e: any) {
            setItems(prev => prev.map(it =>
              it.id === item.id ? { ...it, status: "failed", error: e.message } : it
            ))
            batchResults.push({ to: item.to, amount: item.amount, error: e.message, status: "failed" })
          }
        }
      }
    } catch (e: any) {
      Alert.alert("Batch Failed", e.message)
    } finally {
      setSending(false)
      setResults(batchResults)
    }
  }

  //  Results Screen 
  if (results) {
    const success = results.filter(r => r.status === "success").length
    const failed  = results.filter(r => r.status === "failed").length

    return (
      <ScrollView style={s.container} contentContainerStyle={s.content}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#1E1B4B" />
          </TouchableOpacity>
          <Text style={s.title}>Batch Results</Text>
        </View>

        {/* Summary */}
        <View style={s.summaryRow}>
          <View style={[s.summaryCard, { borderColor: "#10B981" }]}>
            <Text style={[s.summaryNum, { color: "#10B981" }]}>{success}</Text>
            <Text style={s.summaryLabel}>Successful</Text>
          </View>
          <View style={[s.summaryCard, { borderColor: "#EF4444" }]}>
            <Text style={[s.summaryNum, { color: "#EF4444" }]}>{failed}</Text>
            <Text style={s.summaryLabel}>Failed</Text>
          </View>
          <View style={[s.summaryCard, { borderColor: activeChain.color }]}>
            <Text style={[s.summaryNum, { color: activeChain.color }]}>{results.length}</Text>
            <Text style={s.summaryLabel}>Total</Text>
          </View>
        </View>

        {/* Individual results */}
        {results.map((r, i) => (
          <View key={i} style={[s.resultCard, { borderLeftColor: r.status === "success" ? "#10B981" : "#EF4444" }]}>
            <View style={s.resultRow}>
              <Ionicons
                name={r.status === "success" ? "checkmark-circle" : "close-circle"}
                size={20}
                color={r.status === "success" ? "#10B981" : "#EF4444"}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.resultTo}>{shortAddr(r.to)}</Text>
                <Text style={s.resultAmount}>{r.amount} {activeChain.symbol}</Text>
              </View>
            </View>
            {r.txHash && (
              <TouchableOpacity onPress={() => {}}>
                <Text style={[s.txHash, { color: activeChain.color }]}>
                  {r.txHash.slice(0, 20)}...
                </Text>
              </TouchableOpacity>
            )}
            {r.error && <Text style={s.errorText}>{r.error}</Text>}
          </View>
        ))}

        <TouchableOpacity
          style={[s.doneBtn, { backgroundColor: activeChain.color }]}
          onPress={() => router.push("/dashboard" as any)}
        >
          <Text style={s.doneBtnText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    )
  }

  //  Builder Screen 
  const totalAmount = items.reduce((sum, i) => {
    const n = parseFloat(i.amount)
    return sum + (isNaN(n) ? 0 : n)
  }, 0)

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E1B4B" />
        </TouchableOpacity>
        <View>
          <Text style={s.title}>Batch Send</Text>
          <Text style={s.subtitle}>{activeChain.name}  {items.length} transactions</Text>
        </View>
      </View>

      {/* Info banner */}
      <View style={[s.banner, { backgroundColor: activeChain.color + "15", borderColor: activeChain.color + "33" }]}>
        <Ionicons name="information-circle-outline" size={18} color={activeChain.color} />
        <Text style={[s.bannerText, { color: activeChain.color }]}>
          {chainSupportsAA(activeChain.id)
            ? "Atomic batch  all transactions execute in one UserOp. All succeed or all revert."
            : "Transactions execute sequentially. BSC uses legacy mode (no ERC-4337 bundler)."}
        </Text>
      </View>

      {/* Transaction items */}
      {items.map((item, i) => (
        <View key={item.id} style={[s.card, item.status === "sending" && { borderColor: activeChain.color }]}>
          <View style={s.cardHeader}>
            <View style={[s.indexBadge, { backgroundColor: activeChain.color }]}>
              <Text style={s.indexText}>{i + 1}</Text>
            </View>
            <Text style={s.cardTitle}>Transaction {i + 1}</Text>
            {item.status === "sending" && <ActivityIndicator size="small" color={activeChain.color} />}
            {item.status === "success" && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
            {item.status === "failed"  && <Ionicons name="close-circle"    size={20} color="#EF4444" />}
            {items.length > 1 && item.status === "pending" && (
              <TouchableOpacity onPress={() => removeItem(item.id)} style={s.removeBtn}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>

          <Text style={s.inputLabel}>Recipient Address</Text>
          <TextInput
            style={[s.input, !isValidAddress(item.to) && item.to.length > 0 && s.inputError]}
            placeholder="0x..."
            value={item.to}
            onChangeText={v => updateItem(item.id, "to", v)}
            autoCapitalize="none"
            editable={!sending}
          />

          <Text style={s.inputLabel}>Amount ({activeChain.symbol})</Text>
          <TextInput
            style={s.input}
            placeholder="0.0"
            value={item.amount}
            onChangeText={v => updateItem(item.id, "amount", v)}
            keyboardType="decimal-pad"
            editable={!sending}
          />

          <Text style={s.inputLabel}>Memo (optional)</Text>
          <TextInput
            style={s.input}
            placeholder="Note for this transaction"
            value={item.memo}
            onChangeText={v => updateItem(item.id, "memo", v)}
            editable={!sending}
          />
        </View>
      ))}

      {/* Add button */}
      {!sending && (
        <TouchableOpacity style={[s.addBtn, { borderColor: activeChain.color }]} onPress={addItem}>
          <Ionicons name="add-circle-outline" size={20} color={activeChain.color} />
          <Text style={[s.addBtnText, { color: activeChain.color }]}>Add Transaction</Text>
        </TouchableOpacity>
      )}

      {/* Summary */}
      <View style={[s.summaryBox, { backgroundColor: activeChain.color + "10", borderColor: activeChain.color + "33" }]}>
        <View style={s.summaryLine}>
          <Text style={s.summaryKey}>Transactions</Text>
          <Text style={s.summaryVal}>{items.length}</Text>
        </View>
        <View style={s.summaryLine}>
          <Text style={s.summaryKey}>Total Amount</Text>
          <Text style={[s.summaryVal, { color: activeChain.color }]}>
            {totalAmount.toFixed(6)} {activeChain.symbol}
          </Text>
        </View>
        {gasEst && (
          <View style={s.summaryLine}>
            <Text style={s.summaryKey}>Est. Gas</Text>
            <Text style={s.summaryVal}>~{parseFloat(gasEst).toFixed(6)} {activeChain.symbol}</Text>
          </View>
        )}
      </View>

      {/* Actions */}
      <TouchableOpacity
        style={[s.estimateBtn, { borderColor: activeChain.color }]}
        onPress={estimateGas}
        disabled={estimating}
      >
        {estimating
          ? <ActivityIndicator size="small" color={activeChain.color} />
          : <Text style={[s.estimateBtnText, { color: activeChain.color }]}>Estimate Gas</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.sendBtn, { backgroundColor: sending ? "#94A3B8" : activeChain.color }]}
        onPress={sendBatch}
        disabled={sending}
      >
        {sending ? (
          <View style={s.sendingRow}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={s.sendBtnText}>Sending Batch...</Text>
          </View>
        ) : (
          <Text style={s.sendBtnText}>Send {items.length} Transactions</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

//  Styles 
const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#F8FAFC" },
  content:      { padding: 16, paddingBottom: 40 },
  header:       { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 12 },
  backBtn:      { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  title:        { fontSize: 22, fontWeight: "800", color: "#1E1B4B" },
  subtitle:     { fontSize: 13, color: "#64748B", marginTop: 2 },
  banner:       { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 20 },
  bannerText:   { flex: 1, fontSize: 13, fontWeight: "500", lineHeight: 18 },
  card:         { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1.5, borderColor: "#F1F5F9" },
  cardHeader:   { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  indexBadge:   { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  indexText:    { color: "#fff", fontSize: 12, fontWeight: "800" },
  cardTitle:    { flex: 1, fontSize: 15, fontWeight: "700", color: "#1E1B4B" },
  removeBtn:    { padding: 4 },
  inputLabel:   { fontSize: 12, fontWeight: "600", color: "#64748B", marginBottom: 6 },
  input:        { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, fontSize: 14, color: "#1E1B4B", borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 12 },
  inputError:   { borderColor: "#EF4444" },
  addBtn:       { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", marginBottom: 16 },
  addBtnText:   { fontWeight: "700", fontSize: 14 },
  summaryBox:   { borderRadius: 14, padding: 16, borderWidth: 1, marginBottom: 16 },
  summaryLine:  { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  summaryKey:   { fontSize: 13, color: "#64748B", fontWeight: "500" },
  summaryVal:   { fontSize: 13, fontWeight: "700", color: "#1E1B4B" },
  estimateBtn:  { padding: 14, borderRadius: 14, borderWidth: 1.5, alignItems: "center", marginBottom: 10 },
  estimateBtnText: { fontWeight: "700", fontSize: 14 },
  sendBtn:      { padding: 16, borderRadius: 16, alignItems: "center", marginBottom: 16 },
  sendBtnText:  { color: "#fff", fontSize: 16, fontWeight: "800" },
  sendingRow:   { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryRow:   { flexDirection: "row", gap: 10, marginBottom: 20 },
  summaryCard:  { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 14, alignItems: "center", borderWidth: 1.5 },
  summaryNum:   { fontSize: 28, fontWeight: "800" },
  summaryLabel: { fontSize: 12, color: "#64748B", marginTop: 4, fontWeight: "500" },
  resultCard:   { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4 },
  resultRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  resultTo:     { fontSize: 14, fontWeight: "700", color: "#1E1B4B" },
  resultAmount: { fontSize: 13, color: "#64748B" },
  txHash:       { fontSize: 12, fontWeight: "600", marginTop: 4 },
  errorText:    { fontSize: 12, color: "#EF4444", marginTop: 4 },
  doneBtn:      { padding: 16, borderRadius: 16, alignItems: "center", marginTop: 8 },
  doneBtnText:  { color: "#fff", fontSize: 16, fontWeight: "800" },
})