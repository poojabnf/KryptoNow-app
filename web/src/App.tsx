import { useState, useEffect } from 'react'
import { 
  SignedIn, 
  SignedOut, 
  SignIn, 
  SignUp, 
  useUser, 
  useAuth 
} from "@clerk/clerk-react"
import { 
  Shield, 
  Key, 
  Layers, 
  Bell, 
  ArrowUpRight, 
  RefreshCw, 
  Copy, 
  Plus, 
  Trash, 
  LogOut, 
  Smartphone, 
  Activity, 
  CheckCircle, 
  ExternalLink,
  Lock,
  Eye,
  EyeOff
} from "lucide-react"
import { ethers } from "ethers"
import './App.css'

const NETWORKS = [
  { id: 1, name: "Ethereum Mainnet", icon: "Ξ", color: "#6366F1", symbol: "ETH" },
  { id: 137, name: "Polygon PoS", icon: "💜", color: "#8B5CF6", symbol: "POL" },
  { id: 42161, name: "Arbitrum One", icon: "💙", color: "#3B82F6", symbol: "ETH" },
  { id: 10, name: "Optimism", icon: "🔴", color: "#EF4444", symbol: "ETH" },
]

export default function App() {
  const { user } = useUser()
  const { signOut } = useAuth()

  // State hooks
  const [activeTab, setActiveTab] = useState<"dashboard" | "sandbox" | "transfers" | "alerts">("dashboard")
  const [activeNetwork, setActiveNetwork] = useState(NETWORKS[0])
  const [showQRModal, setShowQRModal] = useState(false)
  const [authView, setAuthView] = useState<"landing" | "signin" | "signup">("landing")
  const [copied, setCopied] = useState(false)

  // Sandboxed Multi-wallet generator state
  const [sandboxMnemonic, setSandboxMnemonic] = useState("")
  const [sandboxWallets, setSandboxWallets] = useState<{ index: number; address: string; privateKey: string }[]>([])
  const [activeSandboxIndex, setActiveSandboxIndex] = useState(0)
  const [revealKeyIndex, setRevealKeyIndex] = useState<number | null>(null)

  // Simulation transfer form state
  const [recipient, setRecipient] = useState("")
  const [amount, setAmount] = useState("")
  const [transferring, setTransferring] = useState(false)
  const [txSuccess, setTxSuccess] = useState<string | null>(null)

  // Alerts state
  const [alerts, setAlerts] = useState<{ id: number; token: string; target: number; condition: "above" | "below" }[]>([
    { id: 1, token: "ETH", target: 4200, condition: "above" },
    { id: 2, token: "BTC", target: 88000, condition: "below" },
  ])
  const [alertToken, setAlertToken] = useState("ETH")
  const [alertTarget, setAlertTarget] = useState("")
  const [alertCondition, setAlertCondition] = useState<"above" | "below">("above")

  // Generate simulated seed words and sandbox primary wallet
  const generateSandboxMnemonic = () => {
    try {
      // Create random 12-word phrase inside sandboxed environment
      const randBytes = ethers.randomBytes(16)
      const mnemonic = ethers.Mnemonic.entropyToPhrase(randBytes)
      setSandboxMnemonic(mnemonic)
      
      const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic)
      setSandboxWallets([{
        index: 0,
        address: hdNode.address,
        privateKey: hdNode.privateKey
      }])
      setActiveSandboxIndex(0)
      setRevealKeyIndex(null)
    } catch (err) {
      console.error(err)
    }
  }

  // Derive next index inside web sandbox
  const deriveNextSandboxWallet = () => {
    if (!sandboxMnemonic) return
    const nextIndex = sandboxWallets.length
    const path = `m/44'/60'/0'/0/${nextIndex}`
    const hdNode = ethers.HDNodeWallet.fromPhrase(sandboxMnemonic, undefined, path)
    
    setSandboxWallets([
      ...sandboxWallets,
      {
        index: nextIndex,
        address: hdNode.address,
        privateKey: hdNode.privateKey
      }
    ])
  }

  // Simulated copy address
  const copyAddressToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Simulated transfers execution
  const handleSimulatedTransfer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!recipient || !amount) return
    setTransferring(true)
    setTxSuccess(null)
    
    setTimeout(() => {
      setTransferring(false)
      const mockHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')
      setTxSuccess(mockHash)
      setRecipient("")
      setAmount("")
    }, 2500)
  }

  // Alerts management
  const addAlert = (e: React.FormEvent) => {
    e.preventDefault()
    if (!alertTarget) return
    setAlerts([
      ...alerts,
      {
        id: Date.now(),
        token: alertToken,
        target: parseFloat(alertTarget),
        condition: alertCondition
      }
    ])
    setAlertTarget("")
  }

  const deleteAlert = (id: number) => {
    setAlerts(alerts.filter(a => a.id !== id))
  }

  // Set default sandbox key on load
  useEffect(() => {
    if (sandboxWallets.length === 0) {
      generateSandboxMnemonic()
    }
  }, [])

  const currentAddress = sandboxWallets[activeSandboxIndex]?.address ?? "0x0000000000000000000000000000000000000000"
  const shortAddress = `${currentAddress.slice(0, 8)}...${currentAddress.slice(-6)}`

  return (
    <>
      <div className="bg-ambient">
        <div className="ambient-orb-1"></div>
        <div className="ambient-orb-2"></div>
      </div>

      <SignedOut>
        {authView === "landing" ? (
          <>
            {/* Landing Navigation Header */}
            <header className="nav-header">
              <div className="nav-container">
                <div className="brand">
                  <div className="brand-icon">K</div>
                  KryptoNow
                </div>
                <nav className="nav-links">
                  <a href="#features" className="nav-link">Features</a>
                  <a href="#how-it-works" className="nav-link">Timeline</a>
                  <a href="#sandbox" className="nav-link">Web Sandbox</a>
                  <button className="btn btn-secondary" onClick={() => setAuthView("signin")}>
                    Sign In
                  </button>
                  <button className="btn btn-primary" onClick={() => setAuthView("signup")}>
                    Launch Portal
                  </button>
                </nav>
              </div>
            </header>

            {/* Landing Content container */}
            <main className="landing-container">
              {/* Hero Spotlight */}
              <section className="hero-section">
                <div className="hero-badge">
                  <Shield size={14} /> Hardware-backed Enclave Vault is Active
                </div>
                <h1 className="hero-title">Your Keys. Isolated in the hardware Secure Enclave.</h1>
                <p className="hero-desc">
                  KryptoNow combines premium Web3 convenience with absolute cold-vault level isolation. Experience biometric-gated multi-wallet derivation, real-time alert configurations, and full account abstracting.
                </p>
                <div className="hero-actions">
                  <button className="btn btn-primary" onClick={() => setAuthView("signup")}>
                    Get Started Free <ArrowUpRight size={18} />
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowQRModal(true)}>
                    <Smartphone size={16} /> Get Mobile App
                  </button>
                </div>
              </section>

              {/* Sandbox Play Area (Try before you buy) */}
              <section id="sandbox" className="timeline-section" style={{ marginBottom: "120px" }}>
                <h2 className="section-title">Test Drive the Sandbox Derivation</h2>
                <p className="section-desc">Try our BIP-39 mnemonic derivation algorithm directly in your browser. All computations are run locally on your device.</p>
                <div className="glass-panel" style={{ padding: "40px", maxWidth: "800px", margin: "0 auto", textAlign: "left" }}>
                  <div className="list-header" style={{ marginBottom: "24px" }}>
                    <div>
                      <h3 style={{ fontSize: "20px" }}>Sandbox Wallet Derivation</h3>
                      <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>Derive multiple isolated account slots from a single master mnemonic phrase.</p>
                    </div>
                    <button className="btn btn-secondary" onClick={generateSandboxMnemonic}>
                      <RefreshCw size={14} /> New Mnemonic
                    </button>
                  </div>

                  <div className="form-group">
                    <span className="form-label">Active Master Mnemonic recovery words (Keep safe)</span>
                    <div className="phrase-box">
                      {sandboxMnemonic}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
                    <button className="btn btn-primary" onClick={deriveNextSandboxWallet}>
                      <Plus size={16} /> Derive Next Account Slot
                    </button>
                  </div>

                  <span className="form-label" style={{ marginBottom: "12px" }}>Derived Accounts List ({sandboxWallets.length})</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {sandboxWallets.map((w, i) => (
                      <div key={i} className="list-row" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(99,102,241,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", color: "var(--primary)" }}>
                            #{w.index + 1}
                          </div>
                          <div>
                            <h4 style={{ fontSize: "14px" }}>Account Slot #{w.index}</h4>
                            <p style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text-secondary)", marginTop: "2px" }}>{w.address}</p>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <button className="btn btn-secondary" style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "11px" }} onClick={() => copyAddressToClipboard(w.address)}>
                            {copied && activeSandboxIndex === w.index ? "Copied" : "Copy"}
                          </button>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "11px" }}
                            onClick={() => setRevealKeyIndex(revealKeyIndex === w.index ? null : w.index)}
                          >
                            {revealKeyIndex === w.index ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                        </div>
                        {revealKeyIndex === w.index && (
                          <div style={{ width: "100%", marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed var(--border-light)", fontSize: "11px", color: "var(--secondary)", fontFamily: "monospace" }}>
                            Private Key: {w.privateKey}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Core features spotlights */}
              <section id="features" style={{ marginBottom: "120px" }}>
                <h2 className="section-title">Premium Web3 Security Features</h2>
                <p className="section-desc">KryptoNow elevates your Web3 safety with curated, state-of-the-art cryptographic vaults.</p>
                
                <div className="features-grid">
                  <div className="glass-panel feature-card">
                    <div className="feature-icon-wrap">
                      <Shield size={20} />
                    </div>
                    <h3>Secure Enclave Vault</h3>
                    <p>Unlike normal web wallets storing private keys in plain browser memory, our mobile core isolates keys inside hardware-level Secure Enclaves, gated strictly by Biometrics.</p>
                  </div>

                  <div className="glass-panel feature-card">
                    <div className="feature-icon-wrap">
                      <Layers size={20} />
                    </div>
                    <h3>Dynamic Multi-Wallet Switcher</h3>
                    <p>Derive, manage, delete, and switch between dozens of active account addresses derived from a single master mnemonic, instantly routing keys on the fly.</p>
                  </div>

                  <div className="glass-panel feature-card">
                    <div className="feature-icon-wrap">
                      <Bell size={20} />
                    </div>
                    <h3>Real-time Alerts</h3>
                    <p>Never miss a price swing. Configure target limits and receive localized push notifications or secure alerts when price thresholds are crossed.</p>
                  </div>
                </div>
              </section>

              {/* How it works Timeline */}
              <section id="how-it-works" className="timeline-section">
                <h2 className="section-title">The KryptoNow Journey</h2>
                <p className="section-desc">Setting up cold-vault grade security takes less than 30 seconds.</p>

                <div className="timeline">
                  <div className="glass-panel timeline-step">
                    <div className="step-num">01</div>
                    <h3>Initialize Key</h3>
                    <p>Create a fresh BIP-39 mnemonic phrase secured locally on your device or import an existing private key.</p>
                  </div>

                  <div className="glass-panel timeline-step">
                    <div className="step-num">02</div>
                    <h3>Secure Enclave Mapping</h3>
                    <p>Enclave migration routes keys automatically to biometric-passcode hardware compartments.</p>
                  </div>

                  <div className="glass-panel timeline-step">
                    <div className="step-num">03</div>
                    <h3>Manage and Swapping</h3>
                    <p>Switch between accounts in 1-tap using our active switcher dropdown on desktop web or mobile drawer.</p>
                  </div>
                </div>
              </section>
            </main>

            {/* Footer */}
            <footer className="footer">
              <div className="footer-content">
                <div className="brand" style={{ fontSize: "18px" }}>KryptoNow</div>
                <div className="footer-text">
                  © 2026 KryptoNow. All rights reserved. Secured with hardware-backed enclave cryptography.
                </div>
              </div>
            </footer>

            {/* Simulated QR Code Modal */}
            {showQRModal && (
              <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
                <div className="glass-panel" style={{ maxWidth: "380px", padding: "32px", textAlign: "center" }}>
                  <h3 style={{ fontSize: "20px", marginBottom: "12px" }}>Download KryptoNow Mobile</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: "13px", lineHeight: "1.6", marginBottom: "24px" }}>Scan this code with your smartphone camera to download the mobile wallet app from the iOS App Store or Google Play Store.</p>
                  
                  {/* Simulated QR graphic inside SVG */}
                  <svg width="200" height="200" style={{ background: "#fff", padding: "16px", borderRadius: "16px", margin: "0 auto 24px", display: "block" }}>
                    <rect x="0" y="0" width="30" height="30" fill="var(--bg-base)" />
                    <rect x="138" y="0" width="30" height="30" fill="var(--bg-base)" />
                    <rect x="0" y="138" width="30" height="30" fill="var(--bg-base)" />
                    <rect x="40" y="40" width="88" height="88" fill="var(--bg-base)" opacity="0.85" />
                    <circle cx="100" cy="100" r="14" fill="var(--primary)" />
                  </svg>

                  <button className="btn btn-primary" style={{ width: "100%" }} onClick={() => setShowQRModal(false)}>
                    Close QR Code
                  </button>
                </div>
              </div>
            )}
          </>
        ) : authView === "signin" ? (
          <div className="clerk-auth-container">
            <div className="glass-panel" style={{ width: "100%", maxWidth: "440px", padding: "40px", position: "relative" }}>
              <button style={{ position: "absolute", top: "24px", right: "24px", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }} onClick={() => setAuthView("landing")}>
                Close
              </button>
              <SignIn routing="hash" signUpUrl="" />
            </div>
          </div>
        ) : (
          <div className="clerk-auth-container">
            <div className="glass-panel" style={{ width: "100%", maxWidth: "440px", padding: "40px", position: "relative" }}>
              <button style={{ position: "absolute", top: "24px", right: "24px", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }} onClick={() => setAuthView("landing")}>
                Close
              </button>
              <SignUp routing="hash" signInUrl="" />
            </div>
          </div>
        )}
      </SignedOut>

      <SignedIn>
        {/* Web Wallet Portal Dashboard */}
        <div className="portal-layout">
          {/* Dashboard Sidebar */}
          <aside className="portal-sidebar">
            <div className="brand">
              <div className="brand-icon">K</div>
              KryptoNow
            </div>

            <nav className="portal-nav">
              <div className={`portal-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
                <Activity size={18} /> Dashboard
              </div>
              <div className={`portal-nav-item ${activeTab === 'sandbox' ? 'active' : ''}`} onClick={() => setActiveTab('sandbox')}>
                <Key size={18} /> Sandbox Derivations
              </div>
              <div className={`portal-nav-item ${activeTab === 'transfers' ? 'active' : ''}`} onClick={() => setActiveTab('transfers')}>
                <ArrowUpRight size={18} /> Send / Simulated TX
              </div>
              <div className={`portal-nav-item ${activeTab === 'alerts' ? 'active' : ''}`} onClick={() => setActiveTab('alerts')}>
                <Bell size={18} /> Price Alerts
              </div>
            </nav>

            <div style={{ marginTop: "auto", borderTop: "1px solid var(--border-light)", paddingTop: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "12px" }}>
                  {user?.firstName?.slice(0, 2).toUpperCase() ?? "U"}
                </div>
                <div style={{ overflow: "hidden" }}>
                  <h4 style={{ fontSize: "13px", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{user?.firstName ?? "Web Portal User"}</h4>
                  <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{user?.primaryEmailAddress?.emailAddress ?? "sandbox@kryptonow.xyz"}</p>
                </div>
              </div>
              <button className="btn btn-secondary" style={{ width: "100%", gap: "6px" }} onClick={() => signOut()}>
                <LogOut size={14} /> Log Out
              </button>
            </div>
          </aside>

          {/* Main Dashboard Portal Space */}
          <main className="portal-main">
            <header className="portal-header">
              <div>
                <h1 style={{ fontSize: "30px", marginBottom: "4px" }}>Welcome Back, {user?.firstName ?? "Web Portal User"}!</h1>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>Connected to KryptoNow Sandbox Environment</p>
              </div>

              {/* Active Network Switcher Pill */}
              <div style={{ display: "flex", gap: "8px" }}>
                {NETWORKS.map(net => (
                  <button
                    key={net.id}
                    className={`network-pill ${activeNetwork.id === net.id ? 'active' : ''}`}
                    onClick={() => setActiveNetwork(net)}
                  >
                    <span>{net.icon}</span> {net.name}
                  </button>
                ))}
              </div>
            </header>

            {activeTab === 'dashboard' && (
              <div className="portal-grid">
                {/* Left Side: Balance & Tokens */}
                <div>
                  <div className="glass-panel balance-card">
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px" }}>
                      Total Wallet Balance ({activeNetwork.symbol})
                    </span>
                    <div className="balance-amount" style={{ color: activeNetwork.color }}>
                      {activeNetwork.id === 1 && "$124,582.40"}
                      {activeNetwork.id === 137 && "$8,241.95"}
                      {activeNetwork.id === 42161 && "$42,912.80"}
                      {activeNetwork.id === 10 && "$19,552.10"}
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "16px" }}>
                      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Active Address:</span>
                      <div className="address-pill" onClick={() => copyAddressToClipboard(currentAddress)}>
                        {shortAddress} <Copy size={12} />
                      </div>
                      {copied && <span style={{ fontSize: "11px", color: "var(--accent)" }}><CheckCircle size={10} style={{ display: "inline", marginRight: "3px" }} /> Copied</span>}
                    </div>
                  </div>

                  {/* Simulated tokens list */}
                  <div className="glass-panel list-card">
                    <div className="list-header">
                      <h3>Asset Balances ({activeNetwork.name})</h3>
                      <Activity size={16} style={{ color: activeNetwork.color }} />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      {[
                        { symbol: activeNetwork.symbol, name: activeNetwork.symbol + " Native", balance: activeNetwork.id === 1 ? "35.204" : activeNetwork.id === 137 ? "8620.15" : activeNetwork.id === 42161 ? "12.14" : "5.51", price: activeNetwork.id === 1 ? 3538.90 : activeNetwork.id === 137 ? 0.95 : 3538.90, color: activeNetwork.color },
                        { symbol: "USDC", name: "USD Coin", balance: "1542.50", price: 1.00, color: "#2775CA" },
                        { symbol: "LINK", name: "Chainlink Token", balance: "24.50", price: 18.24, color: "#375BD2" },
                      ].map((t, idx) => (
                        <div key={idx} className="list-row">
                          <div className="token-info">
                            <div className="token-icon" style={{ backgroundColor: t.color + "18", color: t.color }}>
                              {t.symbol.slice(0, 2)}
                            </div>
                            <div className="token-details">
                              <h4>{t.name}</h4>
                              <p>${t.price.toFixed(2)}</p>
                            </div>
                          </div>
                          <div className="token-values">
                            <div className="token-value-usd">${(parseFloat(t.balance) * t.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className="token-value-crypto">{t.balance} {t.symbol}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Side: Account Manager */}
                <div>
                  <div className="glass-panel list-card" style={{ marginBottom: "32px" }}>
                    <div className="list-header">
                      <h3>Sandboxed Accounts</h3>
                      <button className="btn btn-secondary" style={{ padding: "6px 12px", borderRadius: "8px", fontSize: "11px" }} onClick={deriveNextSandboxWallet}>
                        + Derive
                      </button>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {sandboxWallets.slice(0, 4).map((w, i) => (
                        <div 
                          key={i} 
                          className={`list-row ${activeSandboxIndex === w.index ? 'active' : ''}`}
                          style={{ 
                            cursor: "pointer", 
                            background: activeSandboxIndex === w.index ? "rgba(99,102,241,0.05)" : "transparent",
                            border: activeSandboxIndex === w.index ? "1px solid var(--primary-glow)" : "1px solid transparent"
                          }}
                          onClick={() => {
                            setActiveSandboxIndex(w.index)
                            setRevealKeyIndex(null)
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: activeSandboxIndex === w.index ? activeNetwork.color : "transparent" }} />
                            <div>
                              <h4 style={{ fontSize: "13px" }}>Account #{w.index + 1}</h4>
                              <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{w.address.slice(0,6)}...{w.address.slice(-4)}</p>
                            </div>
                          </div>
                          {activeSandboxIndex === w.index && (
                            <span style={{ fontSize: "11px", color: activeNetwork.color, fontWeight: "bold" }}>Active</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="glass-panel list-card">
                    <h3 style={{ marginBottom: "12px", fontSize: "16px" }}>Security Health</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--accent)", fontSize: "13px", fontWeight: "600", marginBottom: "16px" }}>
                      <Shield size={16} /> Sandbox Enclave Operational
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                      All sandboxed private keys and mnemonics generated here are strictly kept in your browser's private memory state. No keys are ever uploaded to Clerk or KryptoNow servers.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'sandbox' && (
              <div className="glass-panel" style={{ padding: "40px" }}>
                <div className="list-header" style={{ marginBottom: "24px" }}>
                  <div>
                    <h2>Sandboxed Keys & Derivation Playground</h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>Test dynamic key derivation using the master recovery mnemonic generated below.</p>
                  </div>
                  <button className="btn btn-secondary" onClick={generateSandboxMnemonic}>
                    <RefreshCw size={14} /> Re-generate
                  </button>
                </div>

                <div className="form-group">
                  <span className="form-label">Sandboxed Master Mnemonic (BIP-39 Phrase)</span>
                  <div className="phrase-box" style={{ fontSize: "15px" }}>
                    {sandboxMnemonic}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", marginBottom: "32px" }}>
                  <button className="btn btn-primary" onClick={deriveNextSandboxWallet}>
                    <Plus size={16} /> Derive Next Wallet Slot
                  </button>
                </div>

                <span className="form-label">Derived Enclave Addresses ({sandboxWallets.length})</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {sandboxWallets.map((w, i) => (
                    <div key={i} className="list-row" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-light)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", color: "var(--primary)" }}>
                          #{w.index + 1}
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <h4 style={{ fontSize: "14px" }}>Account Slot {w.index}</h4>
                            {activeSandboxIndex === w.index && <span style={{ padding: "2px 8px", background: "var(--primary)", color: "#fff", borderRadius: "10px", fontSize: "10px", fontWeight: "bold" }}>Primary Active</span>}
                          </div>
                          <p style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text-secondary)", marginTop: "3px" }}>{w.address}</p>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <button className="btn btn-secondary" style={{ padding: "8px 14px", borderRadius: "10px", fontSize: "12px" }} onClick={() => {
                          setActiveSandboxIndex(w.index)
                          setRevealKeyIndex(null)
                        }}>
                          Select
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: "8px 14px", borderRadius: "10px", fontSize: "12px" }}
                          onClick={() => setRevealKeyIndex(revealKeyIndex === w.index ? null : w.index)}
                        >
                          {revealKeyIndex === w.index ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {revealKeyIndex === w.index && (
                        <div style={{ width: "100%", marginTop: "14px", paddingTop: "14px", borderTop: "1px dashed var(--border-light)", fontSize: "12px", color: "var(--secondary)", fontFamily: "monospace", overflowX: "auto" }}>
                          Private Key: 0x{w.privateKey.replace('0x','')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'transfers' && (
              <div className="glass-panel" style={{ padding: "40px", maxWidth: "680px", margin: "0 auto" }}>
                <div className="list-header" style={{ marginBottom: "24px" }}>
                  <div>
                    <h2>Simulate Web Transfer</h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>Submit sandboxed transaction tests on the active {activeNetwork.name} network.</p>
                  </div>
                  <ArrowUpRight size={20} style={{ color: activeNetwork.color }} />
                </div>

                <form onSubmit={handleSimulatedTransfer}>
                  <div className="form-group">
                    <span className="form-label">Active Sending Address</span>
                    <div className="address-pill" style={{ width: "100%", justifyContent: "space-between", padding: "14px" }}>
                      {shortAddress} <Lock size={14} style={{ color: "var(--text-muted)" }} />
                    </div>
                  </div>

                  <div className="form-group">
                    <span className="form-label">Recipient Address (0x...)</span>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Enter 0x address or ENS..." 
                      value={recipient}
                      onChange={e => setRecipient(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <span className="form-label">Amount ({activeNetwork.symbol})</span>
                    <input 
                      type="number" 
                      step="any"
                      className="form-input" 
                      placeholder="0.00" 
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      required
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: "100%", backgroundColor: activeNetwork.color, marginTop: "8px" }}
                    disabled={transferring}
                  >
                    {transferring ? (
                      <>
                        <div className="spinner" /> Processing Simulated TX...
                      </>
                    ) : `Sign and Send ${activeNetwork.symbol}`}
                  </button>
                </form>

                {txSuccess && (
                  <div className="success-badge" style={{ width: "100%", display: "flex", flexWrap: "wrap", padding: "16px", borderRadius: "14px", marginTop: "24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%" }}>
                      <CheckCircle size={16} /> <strong>Transaction Confirmed on-chain!</strong>
                    </div>
                    <div style={{ fontFamily: "monospace", fontSize: "11px", marginTop: "8px", wordBreak: "break-all", width: "100%", opacity: 0.8 }}>
                      Hash: {txSuccess}
                    </div>
                    <a href={`https://etherscan.io/tx/${txSuccess}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--accent)", marginTop: "8px", textDecoration: "underline" }}>
                      View on Etherscan <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'alerts' && (
              <div className="glass-panel" style={{ padding: "40px" }}>
                <div className="list-header" style={{ marginBottom: "24px" }}>
                  <div>
                    <h2>Real-time Price Alerts</h2>
                    <p style={{ color: "var(--text-secondary)", fontSize: "13px", marginTop: "4px" }}>Configure targeted threshold limits. Alerts auto-fire when threshold prices are crossed.</p>
                  </div>
                  <Bell size={20} style={{ color: activeNetwork.color }} />
                </div>

                {/* Add alert form */}
                <form onSubmit={addAlert} style={{ display: "flex", gap: "12px", alignItems: "flex-end", flexWrap: "wrap", marginBottom: "32px", background: "rgba(255,255,255,0.02)", padding: "20px", borderRadius: "16px", border: "1px solid var(--border-light)" }}>
                  <div style={{ flex: 1, minWidth: "140px" }}>
                    <span className="form-label">Select Token</span>
                    <select className="form-input" style={{ appearance: "auto" }} value={alertToken} onChange={e => setAlertToken(e.target.value)}>
                      <option value="ETH">ETH (Ethereum)</option>
                      <option value="BTC">BTC (Bitcoin)</option>
                      <option value="USDC">USDC (USD Coin)</option>
                      <option value="LINK">LINK (Chainlink)</option>
                    </select>
                  </div>

                  <div style={{ flex: 1, minWidth: "140px" }}>
                    <span className="form-label">Condition</span>
                    <select className="form-input" style={{ appearance: "auto" }} value={alertCondition} onChange={e => setAlertCondition(e.target.value as any)}>
                      <option value="above">Price Go Above</option>
                      <option value="below">Price Go Below</option>
                    </select>
                  </div>

                  <div style={{ flex: 1.5, minWidth: "180px" }}>
                    <span className="form-label">Target Threshold (USD)</span>
                    <input 
                      type="number" 
                      className="form-input" 
                      placeholder="e.g. 4200" 
                      value={alertTarget}
                      onChange={e => setAlertTarget(e.target.value)}
                      required
                    />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ padding: "14px 28px" }}>
                    Add Alert
                  </button>
                </form>

                <h3 style={{ marginBottom: "16px" }}>Active Price Watchers ({alerts.length})</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {alerts.map(a => (
                    <div key={a.id} className="list-row" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-light)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", fontWeight: "bold", color: "var(--primary)", justifyContent: "center" }}>
                          {a.token}
                        </div>
                        <div>
                          <h4 style={{ fontSize: "14px" }}>Alert Trigger for {a.token}</h4>
                          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                            Triggers when price is <strong>{a.condition}</strong> ${a.target.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <button className="btn btn-secondary" style={{ padding: "8px 12px", borderColor: "rgba(239, 68, 68, 0.3)" }} onClick={() => deleteAlert(a.id)}>
                        <Trash size={14} style={{ color: "#EF4444" }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </main>
        </div>
      </SignedIn>
    </>
  )
}
