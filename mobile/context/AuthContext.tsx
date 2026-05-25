/**
 * context/AuthContext.tsx
 * -----------------------
 * Unified Authentication and Profile Context.
 * Uses Firebase Auth for identity and Firestore NoSQL for syncing user preferences
 * (name, avatar, currency, etc.) across devices securely.
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { auth, db } from '../config/firebase'
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { storage } from '../utils/storage'

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserProfile = {
  name:         string
  avatar:       string   // emoji character
  defaultChain: number   // chain id
  currency:     string   // "USD", "EUR", …
  onboarded:    boolean
}

type AuthContextType = {
  authUser:      User | null
  user:          UserProfile | null
  loading:       boolean
  isLoaded:      boolean
  isSignedIn:    boolean
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>
  signOut:       () => Promise<void>
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_PROFILE: UserProfile = {
  name:         '',
  avatar:       '🦊',
  defaultChain: 1,
  currency:     'USD',
  onboarded:    false,
}

const LOCAL_STORAGE_KEY = 'kryptonow_profile_fallback'

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType>({
  authUser:      null,
  user:          null,
  loading:       true,
  isLoaded:      false,
  isSignedIn:    false,
  updateProfile: async () => {},
  signOut:       async () => {},
})

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthUser(firebaseUser)
      if (!firebaseUser) {
        // Fallback to local storage if signed out, so onboarding state doesn't crash
        try {
          const raw = await storage.get(LOCAL_STORAGE_KEY)
          setUser(raw ? { ...DEFAULT_PROFILE, ...JSON.parse(raw) } : DEFAULT_PROFILE)
        } catch {
          setUser(DEFAULT_PROFILE)
        }
        setLoading(false)
        return
      }

      // If signed in, bind to Firestore NoSQL Document
      const docRef = doc(db, 'users', firebaseUser.uid)
      
      const snapUnsub = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          setUser({ ...DEFAULT_PROFILE, ...(docSnap.data() as UserProfile) })
        } else {
          // Initialize new document for new user
          setDoc(docRef, DEFAULT_PROFILE, { merge: true })
          setUser(DEFAULT_PROFILE)
        }
        setLoading(false)
      }, (err) => {
        console.error("Firestore read error:", err)
        setLoading(false)
      })

      return () => snapUnsub()
    })
    return () => unsubscribe()
  }, [])

  const updateProfile = async (updates: Partial<UserProfile>) => {
    const next = { ...(user ?? DEFAULT_PROFILE), ...updates }
    setUser(next)
    
    if (authUser) {
      const docRef = doc(db, 'users', authUser.uid)
      await setDoc(docRef, updates, { merge: true })
    } else {
      await storage.set(LOCAL_STORAGE_KEY, JSON.stringify(next))
    }
  }

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
    } catch (e) {
      console.error("Sign out error", e)
    }
  }

  return (
    <AuthContext.Provider value={{ 
      authUser, 
      user, 
      loading, 
      isLoaded: !loading,
      isSignedIn: !!authUser,
      updateProfile, 
      signOut 
    }}>
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
