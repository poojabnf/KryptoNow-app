// Kryptonow  Fiat On-Ramp
// MoonPay + Transak integration
// No API key needed for the widget URLs  keys go server-side later

export interface OnRampProvider {
  id: string
  name: string
  description: string
  fees: string
  methods: string[]
  color: string
  icon: string
  minAmount: number
}

export const ONRAMP_PROVIDERS: OnRampProvider[] = [
  {
    id: 'moonpay',
    name: 'MoonPay',
    description: 'Buy crypto instantly with card or bank transfer',
    fees: '1.5% - 4.5%',
    methods: ['Visa', 'Mastercard', 'Apple Pay', 'Bank Transfer'],
    color: '#7B2FF7',
    icon: 'M',
    minAmount: 20,
  },
  {
    id: 'transak',
    name: 'Transak',
    description: 'Low fees, 100+ countries, 10+ payment methods',
    fees: '0.99% - 2.5%',
    methods: ['Visa', 'Mastercard', 'Google Pay', 'SEPA', 'UPI'],
    color: '#0066FF',
    icon: 'T',
    minAmount: 10,
  },
]

export function getMoonPayUrl(address: string, currency: string, amount: number): string {
  const base = 'https://buy.moonpay.com'
  return base + '?apiKey=pk_live_YOUR_KEY&walletAddress=' + address + '&currencyCode=' + currency.toLowerCase() + '&baseCurrencyAmount=' + amount + '&colorCode=%236366F1'
}

export function getTransakUrl(address: string, currency: string, amount: number): string {
  const base = 'https://global.transak.com'
  return base + '?apiKey=YOUR_KEY&walletAddress=' + address + '&cryptoCurrencyCode=' + currency + '&defaultFiatAmount=' + amount + '&themeColor=6366F1&hideMenu=true'
}

