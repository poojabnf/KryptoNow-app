import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type ThemeMode = 'light' | 'dark' | 'pro'

export type Theme = {
  mode:          ThemeMode
  // Backgrounds
  bgApp:         string
  bgCard:        string
  bgCardAlt:     string
  bgInput:       string
  bgPill:        string
  // Text
  textPrimary:   string
  textSecondary: string
  textMuted:     string
  textInverse:   string
  // Borders
  border:        string
  borderLight:   string
  // Accents
  accent:        string
  accentLight:   string
  accentText:    string
  // Status
  success:       string
  successBg:     string
  error:         string
  errorBg:       string
  warning:       string
  warningBg:     string
  // Special
  cardShadow:    string
  overlay:       string
}

const THEMES: Record<ThemeMode, Theme> = {
  light: {
    mode:          'light',
    bgApp:         '#F0F4FF',
    bgCard:        '#FFFFFF',
    bgCardAlt:     '#F8FAFF',
    bgInput:       '#F8FAFF',
    bgPill:        '#EEF2FF',
    textPrimary:   '#1E1B4B',
    textSecondary: '#64748B',
    textMuted:     '#94A3B8',
    textInverse:   '#FFFFFF',
    border:        '#E2E8F0',
    borderLight:   '#F1F5F9',
    accent:        '#6366F1',
    accentLight:   '#EEF2FF',
    accentText:    '#6366F1',
    success:       '#10B981',
    successBg:     '#D1FAE5',
    error:         '#EF4444',
    errorBg:       '#FEF2F2',
    warning:       '#F59E0B',
    warningBg:     '#FEF3C7',
    cardShadow:    '#64748B',
    overlay:       'rgba(15,23,42,0.6)',
  },
  dark: {
    mode:          'dark',
    bgApp:         '#0F172A',
    bgCard:        '#1E293B',
    bgCardAlt:     '#162032',
    bgInput:       '#1E293B',
    bgPill:        '#312E81',
    textPrimary:   '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted:     '#64748B',
    textInverse:   '#0F172A',
    border:        '#334155',
    borderLight:   '#1E293B',
    accent:        '#818CF8',
    accentLight:   '#1E1B4B',
    accentText:    '#818CF8',
    success:       '#34D399',
    successBg:     '#064E3B',
    error:         '#F87171',
    errorBg:       '#450A0A',
    warning:       '#FBB024',
    warningBg:     '#451A03',
    cardShadow:    '#000000',
    overlay:       'rgba(0,0,0,0.8)',
  },
  pro: {
    mode:          'pro',
    bgApp:         '#000000',
    bgCard:        '#0A0A0A',
    bgCardAlt:     '#111111',
    bgInput:       '#0A0A0A',
    bgPill:        '#1A1500',
    textPrimary:   '#F5E642',
    textSecondary: '#A39200',
    textMuted:     '#4A4200',
    textInverse:   '#000000',
    border:        '#2A2200',
    borderLight:   '#1A1500',
    accent:        '#F5E642',
    accentLight:   '#1A1500',
    accentText:    '#F5E642',
    success:       '#00FF88',
    successBg:     '#001A0D',
    error:         '#FF4444',
    errorBg:       '#1A0000',
    warning:       '#FFB800',
    warningBg:     '#1A0F00',
    cardShadow:    '#F5E642',
    overlay:       'rgba(0,0,0,0.9)',
  },
}

const STORAGE_KEY = 'kryptonow_theme'

type ThemeContextType = {
  theme:     Theme
  mode:      ThemeMode
  setMode:   (m: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme:   THEMES.light,
  mode:    'light',
  setMode: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light')

  useEffect(() => {
    try {
      const saved = (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null) as ThemeMode
      if (saved && THEMES[saved]) setModeState(saved)
    } catch {}
  }, [])

  function setMode(m: ThemeMode) {
    setModeState(m)
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, m) } catch {}
  }

  return (
    <ThemeContext.Provider value={{ theme: THEMES[mode], mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

export { THEMES }