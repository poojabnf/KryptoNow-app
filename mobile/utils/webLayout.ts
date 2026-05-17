import { Platform, DimensionValue } from 'react-native'

// Max width for web  centers content like a mobile app in browser
export const WEB_MAX_WIDTH = 480
export const IS_WEB = Platform.OS === 'web'

// Use this instead of paddingTop:60 everywhere
export const HEADER_TOP = IS_WEB ? 20 : 60

// Wrap your root <View> with this style for centered web layout
export const webContainer: any = IS_WEB ? {
  flex: 1,
  alignItems: 'center',
  backgroundColor: '#F0F2F8',
} : { flex: 1 }

// Apply to the inner content view
export const webInner: any = IS_WEB ? {
  flex: 1,
  width: '100%',
  maxWidth: WEB_MAX_WIDTH,
  backgroundColor: '#F8FAFF',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.12,
  shadowRadius: 24,
} : { flex: 1 }
