import { createContext, useContext, useRef, useState, ReactNode, useCallback } from 'react'
import {
  Animated, Text, View, StyleSheet, Platform,
  TouchableOpacity, SafeAreaView,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

type ToastEntry = {
  id:      number
  message: string
  type:    ToastType
  action?: { label: string; onPress: () => void }
}

type ToastContextType = {
  show: (message: string, type?: ToastType, action?: ToastEntry['action']) => void
  success: (message: string, action?: ToastEntry['action']) => void
  error:   (message: string, action?: ToastEntry['action']) => void
  warning: (message: string, action?: ToastEntry['action']) => void
  info:    (message: string, action?: ToastEntry['action']) => void
}

const ToastContext = createContext<ToastContextType>({
  show:    () => {},
  success: () => {},
  error:   () => {},
  warning: () => {},
  info:    () => {},
})

const COLORS: Record<ToastType, { bg: string; border: string; text: string; icon: string }> = {
  success: { bg: '#022C22', border: '#065F46', text: '#34D399', icon: 'checkmark-circle' },
  error:   { bg: '#1A0000', border: '#7F1D1D', text: '#F87171', icon: 'alert-circle'     },
  warning: { bg: '#1A0F00', border: '#78350F', text: '#FBB024', icon: 'warning'           },
  info:    { bg: '#0F172A', border: '#1E3A5F', text: '#60A5FA', icon: 'information-circle' },
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastEntry
  onDismiss: (id: number) => void
}) {
  const insets = useSafeAreaInsets()
  const opacity     = useRef(new Animated.Value(0)).current
  const translateY  = useRef(new Animated.Value(-20)).current
  const c = COLORS[toast.type]

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -20, duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss(toast.id))
  }, [toast.id])

  // Mount → show
  Animated.parallel([
    Animated.spring(opacity,    { toValue: 1, useNativeDriver: true }),
    Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
  ]).start()

  // Auto-dismiss after 3.5s
  setTimeout(dismiss, 3500)

  return (
    <Animated.View
      style={[
        st.toast,
        { backgroundColor: c.bg, borderColor: c.border, opacity, transform: [{ translateY }] },
        Platform.OS !== 'web' && { marginTop: insets.top + 8 },
      ]}
    >
      <Ionicons name={c.icon as any} size={20} color={c.text} style={{ marginRight: 10 }} />
      <Text style={[st.toastText, { color: c.text }]} numberOfLines={2}>{toast.message}</Text>
      {toast.action && (
        <TouchableOpacity onPress={() => { toast.action!.onPress(); dismiss() }} style={st.actionBtn}>
          <Text style={[st.actionText, { color: c.text }]}>{toast.action.label}</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="close" size={16} color={c.text} style={{ opacity: 0.6 }} />
      </TouchableOpacity>
    </Animated.View>
  )
}

let _nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([])

  const show = useCallback((message: string, type: ToastType = 'info', action?: ToastEntry['action']) => {
    const id = _nextId++
    setToasts(prev => [...prev.slice(-2), { id, message, type, action }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const ctx: ToastContextType = {
    show,
    success: (msg, action) => show(msg, 'success', action),
    error:   (msg, action) => show(msg, 'error',   action),
    warning: (msg, action) => show(msg, 'warning', action),
    info:    (msg, action) => show(msg, 'info',    action),
  }

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <View style={st.container} pointerEvents="box-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </View>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

const st = StyleSheet.create({
  container: {
    position:  'absolute',
    top:       Platform.OS === 'web' ? 20 : 0,
    left:      16,
    right:     16,
    zIndex:    9999,
    alignItems:'center',
    gap:       8,
    pointerEvents: 'box-none' as any,
  },
  toast: {
    flexDirection:  'row',
    alignItems:     'center',
    borderRadius:   16,
    borderWidth:    1,
    paddingVertical:  14,
    paddingHorizontal:16,
    width:          '100%' as any,
    maxWidth:       480,
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 8 },
    shadowOpacity:  0.4,
    shadowRadius:   20,
    elevation:      16,
  },
  toastText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '600',
    lineHeight: 20,
  },
  actionBtn: {
    marginLeft:    8,
    paddingLeft:   12,
    borderLeftWidth:1,
    borderLeftColor:'rgba(255,255,255,0.15)',
  },
  actionText: {
    fontSize:   13,
    fontWeight: '700',
  },
})
