// Kryptonow  Premium Tier
// RevenueCat manages subscriptions on iOS + Android
// Install later: npm install react-native-purchases

export interface PremiumFeature {
  icon: string
  title: string
  description: string
  freeAccess: boolean
}

export const PREMIUM_FEATURES: PremiumFeature[] = [
  { icon: '', title: 'Portfolio Analytics',    description: 'P&L tracking, ROI charts, performance vs market',  freeAccess: false },
  { icon: '', title: 'Tax Reports',             description: 'Auto-generate CSV + PDF reports for your accountant', freeAccess: false },
  { icon: '', title: 'Price Alerts',            description: 'Unlimited custom alerts for any token',              freeAccess: false },
  { icon: '', title: 'Priority Gas',            description: 'One-tap fast-lane transactions',                     freeAccess: false },
  { icon: '', title: 'Advanced Security',       description: 'Transaction simulation + phishing detection',         freeAccess: false },
  { icon: '', title: 'Priority Support',        description: '24/7 direct support via chat',                       freeAccess: false },
  { icon: '', title: 'Multi-wallet',            description: 'Manage up to 10 wallets in one app',                 freeAccess: true  },
  { icon: '', title: 'Token Swaps',             description: 'Swap any token at best rates',                       freeAccess: true  },
]

export const PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: '.99',
    period: '/month',
    savings: '',
    color: '#6366F1',
    popular: false,
    revenueCatId: 'Kryptonow_premium_monthly',
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: '.99',
    period: '/year',
    savings: 'Save 33%',
    color: '#10B981',
    popular: true,
    revenueCatId: 'Kryptonow_premium_yearly',
  },
]

// RevenueCat SDK — install via: npx expo install react-native-purchases
// Configure in app entry (_layout.tsx): Purchases.configure({ apiKey: process.env.EXPO_PUBLIC_REVENUECAT_API_KEY })
import Purchases, { PurchasesPackage } from 'react-native-purchases'

export async function purchasePlan(planId: string): Promise<{success: boolean, error?: string}> {
  try {
    const offerings = await Purchases.getOfferings()
    const current = offerings.current
    if (!current) return { success: false, error: 'No offerings available' }

    const plan = PLANS.find(p => p.id === planId)
    if (!plan) return { success: false, error: 'Unknown plan' }

    const pkg: PurchasesPackage | undefined = current.availablePackages.find(
      p => p.product.identifier === plan.revenueCatId,
    )
    if (!pkg) return { success: false, error: 'Plan not found in current offerings' }

    const { customerInfo } = await Purchases.purchasePackage(pkg)
    const isActive = customerInfo.entitlements.active['premium'] !== undefined
    return { success: isActive }
  } catch (e: any) {
    if (e?.userCancelled) return { success: false, error: 'Purchase cancelled' }
    return { success: false, error: e?.message ?? 'Purchase failed' }
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.restorePurchases()
    return customerInfo.entitlements.active['premium'] !== undefined
  } catch {
    return false
  }
}


