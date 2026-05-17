import { Platform, StyleSheet } from 'react-native'

/**
 * Patches StyleSheet on web so boxShadow props from RN shadow* fields work in the browser.
 * No-op on native.
 */
export function applyWebShadowPatch(): void {
  if (Platform.OS !== 'web') return

  const originalCreate = StyleSheet.create.bind(StyleSheet)
  StyleSheet.create = ((styles: Parameters<typeof StyleSheet.create>[0]) => {
    const patched: Record<string, object> = {}
    for (const [key, style] of Object.entries(styles)) {
      const s = { ...style } as Record<string, unknown>
      const color = s.shadowColor as string | undefined
      const opacity = (s.shadowOpacity as number | undefined) ?? 0
      const radius = (s.shadowRadius as number | undefined) ?? 0
      const offset = s.shadowOffset as { width?: number; height?: number } | undefined
      if (color && (opacity > 0 || radius > 0)) {
        const ox = offset?.width ?? 0
        const oy = offset?.height ?? 0
        const alpha = Math.round(opacity * 255)
          .toString(16)
          .padStart(2, '0')
        const hex = color.startsWith('#') && color.length === 7
          ? `${color}${alpha}`
          : color
        s.boxShadow = `${ox}px ${oy}px ${radius}px ${hex}`
      }
      patched[key] = s
    }
    return originalCreate(patched as Parameters<typeof StyleSheet.create>[0])
  }) as typeof StyleSheet.create
}
