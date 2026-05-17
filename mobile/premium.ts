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

// Mock purchase function  replace with RevenueCat SDK when ready
export async function purchasePlan(planId: string): Promise<{success: boolean, error?: string}> {
  // TODO: Replace with real RevenueCat call
  // import Purchases from 'react-native-purchases'
  // const { customerInfo } = await Purchases.purchasePackage(package)
  return new Promise(resolve => {
    setTimeout(() => resolve({ success: true }), 1500)
  })
}

export async function restorePurchases(): Promise<boolean> {
  // TODO: Purchases.restorePurchases()
  return false
}

