/**
 * context/AuthContext.tsx
 * -----------------------
 * Lightweight profile context used by the Onboarding screen.
 * Stores non-sensitive user preferences (name, avatar, currency, etc.)
 * in AsyncStorage and exposes them app-wide.
 *
 * Note: Authentication itself is handled by Clerk (@clerk/expo).
 * This context is specifically for the in-app profile/preferences.
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserProfile = {
  name:         string
  avatar:       string   // emoji character
  defaultChain: number   // chain id
  currency:     string   // "USD", "EUR", …
  onboarded:    boolean
}

type AuthContextType = {
  user:          UserProfile | null
  loading:       boolean
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  clearProfile:  () => Promise<void>
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: UserProfile = {
  name:         '',
  avatar:       '🦊',
  defaultChain: 1,
  currency:     'USD',
  onboarded:    false,
}

const STORAGE_KEY = 'kryptonow_profile'

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  user:          null,
  loading:       true,
  updateProfile: async () => {},
  clearProfile:  async () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Load profile on mount
  useEffect(() => {
    ;(async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY)
        setUser(raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : DEFAULT_PROFILE)
      } catch {
        setUser(DEFAULT_PROFILE)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const next = { ...(user ?? DEFAULT_PROFILE), ...updates }
    setUser(next)
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const clearProfile = async () => {
    setUser(DEFAULT_PROFILE)
    await AsyncStorage.removeItem(STORAGE_KEY)
  }

  return (
    <AuthContext.Provider value={{ user, loading, updateProfile, clearProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
