const fs = require('fs')
const path = require('path')

// Create directory structure
const dirs = [
  'app/sign-in/[[...sign-in]]',
  'app/sign-up/[[...sign-up]]',
  'app/dashboard',
]
dirs.forEach(d => {
  fs.mkdirSync(d, { recursive: true })
  console.log('Created dir: ' + d)
})

// middleware.ts
fs.writeFileSync('middleware.ts', `import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
`)
console.log('✓ middleware.ts')

// app/layout.tsx
fs.writeFileSync('app/layout.tsx', `import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'KryptoNow',
  description: 'Your crypto wallet. Your rules.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
`)
console.log('✓ app/layout.tsx')

// sign-in page
fs.writeFileSync('app/sign-in/[[...sign-in]]/page.tsx', `import { SignIn } from '@clerk/nextjs'
export default function SignInPage() {
  return (
    <main style={{ display:'flex', minHeight:'100vh', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #F8FAFF 0%, #EEF2FF 100%)' }}>
      <SignIn />
    </main>
  )
}
`)
console.log('✓ app/sign-in page')

// sign-up page
fs.writeFileSync('app/sign-up/[[...sign-up]]/page.tsx', `import { SignUp } from '@clerk/nextjs'
export default function SignUpPage() {
  return (
    <main style={{ display:'flex', minHeight:'100vh', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg, #F8FAFF 0%, #EEF2FF 100%)' }}>
      <SignUp />
    </main>
  )
}
`)
console.log('✓ app/sign-up page')

// dashboard page
fs.writeFileSync('app/dashboard/page.tsx', `import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')
  return (
    <main style={{ minHeight:'100vh', background:'#F8FAFF', padding:'40px 24px', fontFamily:'-apple-system, sans-serif' }}>
      <div style={{ maxWidth:600, margin:'0 auto' }}>
        <h1 style={{ color:'#1E1B4B' }}>KryptoNow</h1>
        <p style={{ color:'#818CF8' }}>Welcome, {user.firstName || user.emailAddresses[0].emailAddress}</p>
        <div style={{ background:'linear-gradient(135deg,#6366F1,#8B5CF6)', borderRadius:24, padding:28, textAlign:'center', color:'#fff', marginTop:24 }}>
          <div style={{ fontSize:14, opacity:0.7 }}>Total Balance</div>
          <div style={{ fontSize:48, fontWeight:700 }}>$0.00</div>
        </div>
      </div>
    </main>
  )
}
`)
console.log('✓ app/dashboard page')

// home page redirect
fs.writeFileSync('app/page.tsx', `import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'

export default async function Home() {
  const user = await currentUser()
  if (user) redirect('/dashboard')
  redirect('/sign-in')
}
`)
console.log('✓ app/page.tsx')

console.log('\n=== NEXT STEPS ===')
console.log('1. Add your NEW Clerk keys to .env.local')
console.log('2. Run: npm run dev')
console.log('3. Open: http://localhost:3000')
