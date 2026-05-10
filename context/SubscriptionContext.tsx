/**
 * SubscriptionContext
 * Wraps RevenueCat (react-native-purchases) for iOS/Android in-app purchases.
 * On web, tier is always 'free' — users upgrade via kryptonow.xyz/upgrade.
 *
 * RevenueCat setup:
 *  1. Create account at https://app.revenuecat.com
 *  2. Add your app (iOS + Android)
 *  3. Create products in App Store Connect & Google Play Console:
 *       kryptonow_pro_monthly      $4.99/mo
 *       kryptonow_business_monthly $19.99/mo
 *  4. Create Offerings & Packages in RevenueCat dashboard
 *  5. Replace REVENUECAT_IOS_KEY and REVENUECAT_ANDROID_KEY below
 *  6. Replace entitlement IDs if you customise them (default: "pro", "business")
 */

import React, {
  createContext, useContext, useEffect, useState, useCallback, ReactNode,
} from 'react'
import { Platform, Alert } from 'react-native'

// ─── RevenueCat keys (replace before going to production) ────────────────────
const REVENUECAT_IOS_KEY     = 'appl_REPLACE_WITH_YOUR_IOS_KEY'
const REVENUECAT_ANDROID_KEY = 'goog_REPLACE_WITH_YOUR_ANDROID_KEY'

// ─── Product & entitlement IDs (must match RevenueCat dashboard) ─────────────
export const PRODUCT_PRO      = 'kryptonow_pro_monthly'
export const PRODUCT_BUSINESS = 'kryptonow_business_monthly'
export const ENTITLEMENT_PRO  = 'pro'
export const ENTITLEMENT_BIZ  = 'business'

// ─── Types ───────────────────────────────────────────────────────────────────
export type SubscriptionTier = 'free' | 'pro' | 'business'

type SubscriptionPackage = {
  identifier:    string
  productId:     string
  title:         string
  priceString:   string
  monthlyPrice:  number
}

type SubscriptionContextValue = {
  tier:           SubscriptionTier
  isLoading:      boolean
  packages:       SubscriptionPackage[]
  purchase:       (productId: string) => Promise<boolean>
  restore:        () => Promise<void>
  openUpgrade:    () => void    // navigates to subscription screen
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────
export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [tier,      setTier]      = useState<SubscriptionTier>('free')
  const [isLoading, setIsLoading] = useState(Platform.OS !== 'web')
  const [packages,  setPackages]  = useState<SubscriptionPackage[]>([])

  useEffect(() => {
    if (Platform.OS === 'web') return
    initRevenueCat()
  }, [])

  async function initRevenueCat() {
    try {
      const Purchases = (await import('react-native-purchases')).default
      const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY
      await Purchases.configure({ apiKey })

      const info = await Purchases.getCustomerInfo()
      setTier(resolveTier(info))

      // Load available packages
      const offerings = await Purchases.getOfferings()
      if (offerings.current?.availablePackages) {
        setPackages(offerings.current.availablePackages.map(p => ({
          identifier:   p.identifier,
          productId:    p.product.identifier,
          title:        p.product.title,
          priceString:  p.product.priceString,
          monthlyPrice: p.product.price,
        })))
      }
    } catch (e) {
      console.error('[Subscription] RevenueCat init failed:', e)
    } finally {
      setIsLoading(false)
    }
  }

  function resolveTier(info: any): SubscriptionTier {
    const entitlements = info?.entitlements?.active ?? {}
    if (entitlements[ENTITLEMENT_BIZ]) return 'business'
    if (entitlements[ENTITLEMENT_PRO]) return 'pro'
    return 'free'
  }

  const purchase = useCallback(async (productId: string): Promise<boolean> => {
    if (Platform.OS === 'web') return false
    try {
      setIsLoading(true)
      const Purchases = (await import('react-native-purchases')).default
      const { customerInfo } = await Purchases.purchaseStoreProduct(
        (await Purchases.getProducts([productId]))[0]
      )
      const newTier = resolveTier(customerInfo)
      setTier(newTier)
      return newTier !== 'free'
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Purchase failed', e.message ?? 'Please try again.')
      }
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const restore = useCallback(async () => {
    if (Platform.OS === 'web') return
    try {
      setIsLoading(true)
      const Purchases = (await import('react-native-purchases')).default
      const info = await Purchases.restorePurchases()
      const newTier = resolveTier(info)
      setTier(newTier)
      Alert.alert(
        newTier === 'free' ? 'No purchases found' : 'Restored!',
        newTier === 'free'
          ? 'No active subscriptions were found for this Apple/Google account.'
          : `Your ${newTier} subscription has been restored.`,
      )
    } catch (e: any) {
      Alert.alert('Restore failed', e.message ?? 'Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const openUpgrade = useCallback(() => {
    const { router } = require('expo-router')
    router.push('/subscription')
  }, [])

  return (
    <SubscriptionContext.Provider value={{ tier, isLoading, packages, purchase, restore, openUpgrade }}>
      {children}
    </SubscriptionContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useSubscription() {
  const ctx = useContext(SubscriptionContext)
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider')
  const isPro      = ctx.tier === 'pro' || ctx.tier === 'business'
  const isBusiness = ctx.tier === 'business'
  return { ...ctx, isPro, isBusiness }
}
