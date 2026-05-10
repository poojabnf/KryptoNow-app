/**
 * context/AuthContext.tsx
 * Lightweight profile context (non-sensitive preferences stored in AsyncStorage).
 * Authentication is handled by Clerk. This context covers onboarding data,
 * KYC status, referral code, and display preferences.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected'

export type UserProfile = {
  firstName:    string
  lastName:     string
  name:         string        // display name = firstName + ' ' + lastName
  avatar:       string
  defaultChain: number
  currency:     string
  country:      string        // ISO 3166-1 alpha-2, e.g. "IN", "US", "GB"
  kycStatus:    KycStatus
  referralCode: string        // this user's own referral code
  appliedCode:  string        // referral code they used at signup
  onboarded:    boolean
}

type AuthContextType = {
  user:          UserProfile | null
  loading:       boolean
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  clearProfile:  () => Promise<void>
}

const DEFAULT_PROFILE: UserProfile = {
  firstName:    '',
  lastName:     '',
  name:         '',
  avatar:       '🦊',
  defaultChain: 1,
  currency:     'USD',
  country:      '',
  kycStatus:    'none',
  referralCode: '',
  appliedCode:  '',
  onboarded:    false,
}

const STORAGE_KEY = 'kryptonow_profile_v2'

const AuthContext = createContext<AuthContextType>({
  user:          null,
  loading:       true,
  updateProfile: async () => {},
  clearProfile:  async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      try {
        // Migrate from old storage key if needed
        const oldRaw = await AsyncStorage.getItem('kryptonow_profile')
        const raw    = await AsyncStorage.getItem(STORAGE_KEY)
        const base   = raw ? JSON.parse(raw) : (oldRaw ? JSON.parse(oldRaw) : {})
        const profile: UserProfile = { ...DEFAULT_PROFILE, ...base }
        // Back-fill name from firstName+lastName if only old name exists
        if (!profile.firstName && profile.name) {
          const parts = profile.name.split(' ')
          profile.firstName = parts[0] ?? ''
          profile.lastName  = parts.slice(1).join(' ')
        }
        setUser(profile)
      } catch {
        setUser(DEFAULT_PROFILE)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const next = { ...(user ?? DEFAULT_PROFILE), ...updates }
    // Keep display name in sync
    if (updates.firstName !== undefined || updates.lastName !== undefined) {
      next.name = `${next.firstName} ${next.lastName}`.trim()
    }
    setUser(next)
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const clearProfile = async () => {
    setUser(DEFAULT_PROFILE)
    await AsyncStorage.removeItem(STORAGE_KEY)
    await AsyncStorage.removeItem('kryptonow_profile')
  }

  return (
    <AuthContext.Provider value={{ user, loading, updateProfile, clearProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
