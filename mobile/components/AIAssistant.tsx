import { useState, useRef, useCallback, useEffect } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator, Animated,
  PanResponder, Dimensions,
} from 'react-native'
import { useWalletStore } from '../store/walletStore'

const GROQ_API_KEY = 'process.env.EXPO_PUBLIC_GROQ_API_KEY ?? ""'
const GROQ_MODEL   = 'llama-3.3-70b-versatile'
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions'

const { width: SW, height: SH } = Dimensions.get('window')
const BUBBLE_SIZE  = 56
const EDGE_PADDING = 16
const DEFAULT_X    = SW - BUBBLE_SIZE - EDGE_PADDING
const DEFAULT_Y    = SH - BUBBLE_SIZE - 100

type Role    = 'user' | 'assistant'
type Message = { role: Role; content: string; id: number }

const QUICK_PROMPTS = [
  { label: '📊 Market overview',  text: 'Give me a quick crypto market overview today.' },
  { label: '⛽ Gas fees',         text: 'What are current Ethereum gas fees and how can I reduce them?' },
  { label: '🔀 Bridge guide',     text: 'How do I bridge tokens from Ethereum to Polygon safely?' },
  { label: '🛡️ Wallet security',  text: 'What are the best practices to keep my crypto wallet secure?' },
  { label: '📈 DeFi explained',   text: 'Explain DeFi yield farming in simple terms.' },
  { label: '🪙 Token research',   text: 'What should I check before investing in a new token?' },
]

export default function AIAssistant() {
  const addr        = useWalletStore(s => s.address)
  const activeChain = useWalletStore(s => s.activeChain)

  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const scrollRef  = useRef<ScrollView>(null)
  const msgId      = useRef(0)

  // ── Draggable position ────────────────────────────────────────────────────
  const pan        = useRef(new Animated.ValueXY({ x: DEFAULT_X, y: DEFAULT_Y })).current
  const panOffset  = useRef({ x: DEFAULT_X, y: DEFAULT_Y })
  const isDragging = useRef(false)
  const dragStart  = useRef({ x: 0, y: 0 })
  const scaleAnim  = useRef(new Animated.Value(1)).current

  // Keep panOffset in sync
  useEffect(() => {
    const xId = pan.x.addListener(({ value }) => { panOffset.current.x = value })
    const yId = pan.y.addListener(({ value }) => { panOffset.current.y = value })
    return () => { pan.x.removeListener(xId); pan.y.removeListener(yId) }
  }, [])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,

      onPanResponderGrant: (e) => {
        isDragging.current = false
        dragStart.current  = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY }
        pan.setOffset({ x: panOffset.current.x, y: panOffset.current.y })
        pan.setValue({ x: 0, y: 0 })
        Animated.spring(scaleAnim, { toValue: 1.15, useNativeDriver: false, speed: 30 }).start()
      },

      onPanResponderMove: (e, g) => {
        if (Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6) isDragging.current = true
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(e, g)
      },

      onPanResponderRelease: (_, g) => {
        pan.flattenOffset()
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: false, speed: 25 }).start()

        // Snap to nearest edge
        const curX = panOffset.current.x
        const curY = panOffset.current.y
        const snapX = curX < SW / 2
          ? EDGE_PADDING
          : SW - BUBBLE_SIZE - EDGE_PADDING
        const clampedY = Math.max(60, Math.min(SH - BUBBLE_SIZE - 60, curY))

        Animated.spring(pan, {
          toValue:        { x: snapX, y: clampedY },
          useNativeDriver: false,
          tension:         80,
          friction:        10,
        }).start(() => {
          panOffset.current = { x: snapX, y: clampedY }
        })

        // If not dragging → open chat
        if (!isDragging.current) {
          setOpen(true)
        }
      },
    })
  ).current

  // ── System prompt ─────────────────────────────────────────────────────────
  const buildSystemPrompt = useCallback(() => {
    const shortAddr = addr ? addr.slice(0, 6) + '...' + addr.slice(-4) : 'not connected'
    return `You are Kryptonow AI, a helpful crypto wallet assistant.
WALLET CONTEXT:
- Wallet: ${shortAddr}
- Chain: ${activeChain.name} (ID: ${activeChain.id})
- Native token: ${activeChain.symbol}
Be concise, friendly and clear. Use bullet points for lists. Max 200 words unless asked for detail. Always mention risks for investments.`
  }, [addr, activeChain])

  // ── Send message ──────────────────────────────────────────────────────────
  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    setInput('')
    setLoading(true)
    const userMsg: Message = { role: 'user', content: trimmed, id: ++msgId.current }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)

    try {
      const res = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'system', content: buildSystemPrompt() },
            ...newMessages.map(m => ({ role: m.role, content: m.content })),
          ],
          max_tokens: 512,
          temperature: 0.7,
        }),
      })
      const data  = await res.json()
      const reply = data.choices?.[0]?.message?.content ?? 'Sorry, no response generated.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply, id: ++msgId.current }])
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ ${e?.message ?? 'Could not reach Groq API.'}`,
        id: ++msgId.current,
      }])
    } finally {
      setLoading(false)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150)
    }
  }

  return (
    <>
      {/* ── Draggable floating bubble ──────────────────────────────────── */}
      <Animated.View
        style={[
          b.bubble,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
              { scale: scaleAnim },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={[b.bubbleBtn, { backgroundColor: activeChain.color }]}>
          <Text style={b.bubbleIcon}>🤖</Text>
          {messages.length > 0 && (
            <View style={b.badge}>
              <Text style={b.badgeT}>{messages.filter(m => m.role === 'assistant').length}</Text>
            </View>
          )}
        </View>
        {/* Drag hint ring — visible briefly */}
        <View style={[b.ring, { borderColor: activeChain.color + '40' }]} />
      </Animated.View>

      {/* ── Chat Modal ────────────────────────────────────────────────── */}
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={c.backdrop} activeOpacity={1} onPress={() => setOpen(false)} />
          <View style={c.sheet}>

            {/* Header */}
            <View style={c.header}>
              <View style={c.headerLeft}>
                <View style={[c.aiDot, { backgroundColor: activeChain.color }]}>
                  <Text style={{ fontSize: 16 }}>🤖</Text>
                </View>
                <View>
                  <Text style={c.headerTitle}>Kryptonow AI</Text>
                  <Text style={c.headerSub}>{activeChain.name} · {addr ? addr.slice(0,6)+'...'+addr.slice(-4) : 'No wallet'}</Text>
                </View>
              </View>
              <View style={c.headerRight}>
                {messages.length > 0 && (
                  <TouchableOpacity style={c.clearBtn} onPress={() => setMessages([])}>
                    <Text style={c.clearBtnT}>Clear</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={c.closeBtn} onPress={() => setOpen(false)}>
                  <Text style={c.closeBtnT}>✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Messages */}
            <ScrollView
              ref={scrollRef}
              style={c.messages}
              contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {messages.length === 0 && (
                <View style={c.welcome}>
                  <Text style={c.welcomeEmoji}>🤖</Text>
                  <Text style={c.welcomeTitle}>Hi! I'm Kryptonow AI</Text>
                  <Text style={c.welcomeSub}>Ask me anything about crypto, DeFi, gas fees or your wallet.</Text>
                  <View style={c.quickGrid}>
                    {QUICK_PROMPTS.map(q => (
                      <TouchableOpacity
                        key={q.label}
                        style={[c.quickPill, { borderColor: activeChain.color + '55' }]}
                        onPress={() => sendMessage(q.text)}
                        activeOpacity={0.75}
                      >
                        <Text style={[c.quickPillT, { color: activeChain.color }]}>{q.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {messages.map(msg => (
                <View key={msg.id} style={[c.msgRow, msg.role === 'user' ? c.msgRowUser : c.msgRowAI]}>
                  {msg.role === 'assistant' && (
                    <View style={[c.avatar, { backgroundColor: activeChain.color + '22' }]}>
                      <Text style={{ fontSize: 13 }}>🤖</Text>
                    </View>
                  )}
                  <View style={[
                    c.bubble2,
                    msg.role === 'user'
                      ? [c.bubbleUser, { backgroundColor: activeChain.color }]
                      : c.bubbleAI,
                  ]}>
                    <Text style={[c.bubbleText, msg.role === 'user' ? { color: '#fff' } : { color: '#1E1B4B' }]}>
                      {msg.content}
                    </Text>
                  </View>
                </View>
              ))}

              {loading && (
                <View style={[c.msgRow, c.msgRowAI]}>
                  <View style={[c.avatar, { backgroundColor: activeChain.color + '22' }]}>
                    <Text style={{ fontSize: 13 }}>🤖</Text>
                  </View>
                  <View style={c.typingBubble}>
                    <ActivityIndicator size="small" color={activeChain.color} />
                    <Text style={[c.typingT, { color: activeChain.color }]}>Thinking...</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Input */}
            <View style={c.inputBar}>
              <TextInput
                style={c.input}
                placeholder="Ask anything about crypto..."
                placeholderTextColor="#94A3B8"
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={500}
                onSubmitEditing={() => sendMessage(input)}
                returnKeyType="send"
                editable={!loading}
              />
              <TouchableOpacity
                style={[c.sendBtn, { backgroundColor: input.trim() && !loading ? activeChain.color : '#E2E8F0' }]}
                onPress={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                activeOpacity={0.85}
              >
                <Text style={[c.sendBtnT, { color: input.trim() && !loading ? '#fff' : '#94A3B8' }]}>↑</Text>
              </TouchableOpacity>
            </View>

          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const b = StyleSheet.create({
  bubble:    { position: 'absolute', width: BUBBLE_SIZE, height: BUBBLE_SIZE, zIndex: 999 },
  bubbleBtn: { width: BUBBLE_SIZE, height: BUBBLE_SIZE, borderRadius: BUBBLE_SIZE / 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 8 },
  bubbleIcon:{ fontSize: 26 },
  badge:     { position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  badgeT:    { color: '#fff', fontSize: 9, fontWeight: '700' },
  ring:      { position: 'absolute', top: -4, left: -4, width: BUBBLE_SIZE + 8, height: BUBBLE_SIZE + 8, borderRadius: (BUBBLE_SIZE + 8) / 2, borderWidth: 1.5 },
})

const c = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet:        { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%', minHeight: '65%' },
  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiDot:        { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle:  { color: '#1E1B4B', fontSize: 16, fontWeight: '700' },
  headerSub:    { color: '#94A3B8', fontSize: 11, marginTop: 1 },
  headerRight:  { flexDirection: 'row', gap: 8, alignItems: 'center' },
  clearBtn:     { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#F1F5F9' },
  clearBtnT:    { color: '#64748B', fontSize: 12, fontWeight: '600' },
  closeBtn:     { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  closeBtnT:    { color: '#64748B', fontSize: 14, fontWeight: '700' },
  messages:     { flex: 1 },
  welcome:      { alignItems: 'center', paddingTop: 16, paddingBottom: 8 },
  welcomeEmoji: { fontSize: 48, marginBottom: 12 },
  welcomeTitle: { color: '#1E1B4B', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  welcomeSub:   { color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 280, marginBottom: 20 },
  quickGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  quickPill:    { borderRadius: 20, borderWidth: 1.5, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: '#F8FAFF' },
  quickPillT:   { fontSize: 12, fontWeight: '600' },
  msgRow:       { flexDirection: 'row', marginBottom: 12, alignItems: 'flex-end', gap: 8 },
  msgRowUser:   { justifyContent: 'flex-end' },
  msgRowAI:     { justifyContent: 'flex-start' },
  avatar:       { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  bubble2:      { maxWidth: '78%', borderRadius: 18, padding: 12 },
  bubbleUser:   { borderBottomRightRadius: 4 },
  bubbleAI:     { backgroundColor: '#F1F5F9', borderBottomLeftRadius: 4 },
  bubbleText:   { fontSize: 14, lineHeight: 20 },
  typingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F1F5F9', borderRadius: 18, borderBottomLeftRadius: 4, padding: 12 },
  typingT:      { fontSize: 13, fontWeight: '500' },
  inputBar:     { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  input:        { flex: 1, backgroundColor: '#F8FAFF', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: '#1E1B4B', borderWidth: 1, borderColor: '#E2E8F0', maxHeight: 100 },
  sendBtn:      { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  sendBtnT:     { fontSize: 20, fontWeight: '700' },
})

