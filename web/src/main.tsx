import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import './index.css'
import App from './App.tsx'

// Global Clerk Publishable Key (synced with mobile environment)
const CLERK_PUBLISHABLE_KEY = "pk_test_dGhhbmtmdWwtY2hpbXAtNjMuY2xlcmsuYWNjb3VudHMuZGV2JA"

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </StrictMode>,
)
