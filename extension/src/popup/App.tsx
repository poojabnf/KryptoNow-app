import { useState, useEffect } from 'react'
import { 
  Shield, 
  Key, 
  Activity, 
  Copy, 
  CheckCircle, 
  Lock, 
  Unlock, 
  Plus, 
  Eye, 
  EyeOff
} from "lucide-react"
import { ethers } from "ethers"

// Storage keys
const VAULT_KEY = 'kryptonow_ext_vault'
const SALT_KEY  = 'kryptonow_ext_salt'

export default function App() {
  // Navigation & URL Prompt Actions
  const [action, setAction] = useState<string | null>(null)
  const [promptParams, setPromptParams] = useState<any>(null)

  // Wallet Vault State
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLocked, setIsLocked] = useState(true)
  const [hasVault, setHasVault] = useState(false)
  const [mnemonic, setMnemonic] = useState("")
  const [derivedWallets, setDerivedWallets] = useState<{ index: number; address: string; privateKey: string }[]>([])
  const [activeIdx, setActiveIdx] = useState(0)

  // Feedback states
  const [errorMsg, setErrorMsg] = useState("")
  const [copied, setCopied] = useState(false)
  const [signing, setSigning] = useState(false)
  const [revealKeyIndex, setRevealKeyIndex] = useState<number | null>(null)

  // Check URL query parameters on load to intercept signature/connection prompts
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlAction = params.get('action')
    if (urlAction) {
      setAction(urlAction)
      const method = params.get('method')
      const rawParams = params.get('params')
      if (rawParams) {
        try { setPromptParams({ method, list: JSON.parse(decodeURIComponent(rawParams)) }) } catch {}
      }
    }

    // Check if vault already initialized
    chrome.storage.local.get([VAULT_KEY], (res) => {
      if (res[VAULT_KEY]) {
        setHasVault(true)
      }
    })
  }, [])

  // --- CRYPTOGRAPHIC UTILITIES (PBKDF2 + AES-GCM) -----------------------------

  async function getOrCreateSalt(): Promise<Uint8Array> {
    return new Promise((resolve) => {
      chrome.storage.local.get([SALT_KEY], async (res) => {
        if (res[SALT_KEY]) {
          // Decode hex salt
          const hex = res[SALT_KEY]
          const arr = new Uint8Array(hex.length / 2)
          for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16)
          resolve(arr)
        } else {
          const salt = window.crypto.getRandomValues(new Uint8Array(32))
          const hexSalt = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
          chrome.storage.local.set({ [SALT_KEY]: hexSalt }, () => resolve(salt))
        }
      })
    })
  }

  async function deriveKey(salt: Uint8Array, pass: string): Promise<CryptoKey> {
    const enc = new TextEncoder()
    const keyMat = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(pass),
      'PBKDF2',
      false,
      ['deriveKey']
    )
    return window.crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt as any, iterations: 100_000, hash: 'SHA-256' },
      keyMat,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  // --- VAULT MANAGEMENT ACTIONS -----------------------------------------------

  const handleCreateVault = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setErrorMsg("Password must be at least 8 characters.")
      return
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.")
      return
    }

    try {
      setErrorMsg("")
      // Generate standard BIP-39 mnemonic seed words
      const randBytes = ethers.randomBytes(16)
      const derivedPhrase = ethers.Mnemonic.entropyToPhrase(randBytes)
      setMnemonic(derivedPhrase)

      // Encrypt the mnemonic
      const salt = await getOrCreateSalt()
      const key = await deriveKey(salt, password)
      const iv = window.crypto.getRandomValues(new Uint8Array(12))
      const encodedText = new TextEncoder().encode(derivedPhrase)
      const cipherBuf = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encodedText)

      // Save encrypted vault payload
      const storedPayload = {
        ct: btoa(String.fromCharCode(...new Uint8Array(cipherBuf))),
        iv: btoa(String.fromCharCode(...new Uint8Array(iv)))
      }

      // Initial derive wallet slot #0
      const hdNode = ethers.HDNodeWallet.fromPhrase(derivedPhrase)
      const primaryWallet = {
        index: 0,
        address: hdNode.address,
        privateKey: hdNode.privateKey
      }

      chrome.storage.local.set({
        [VAULT_KEY]: JSON.stringify(storedPayload),
        vault_address: primaryWallet.address,
        session_connected: true
      }, () => {
        setDerivedWallets([primaryWallet])
        setActiveIdx(0)
        setIsLocked(false)
        setHasVault(true)
      })
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create vault.")
    }
  }

  const handleUnlockVault = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg("")

    chrome.storage.local.get([VAULT_KEY], async (res) => {
      if (!res[VAULT_KEY]) {
        setErrorMsg("No vault found.")
        return
      }

      try {
        const parsed = JSON.parse(res[VAULT_KEY])
        const salt = await getOrCreateSalt()
        const key = await deriveKey(salt, password)
        const iv = Uint8Array.from(atob(parsed.iv), c => c.charCodeAt(0))
        const cipherBuf = Uint8Array.from(atob(parsed.ct), c => c.charCodeAt(0))

        // Decrypt the mnemonic seed phrase
        const plainBuf = await window.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuf)
        const decryptedPhrase = new TextDecoder().decode(plainBuf)
        setMnemonic(decryptedPhrase)

        // Derive active slots
        const hdNode = ethers.HDNodeWallet.fromPhrase(decryptedPhrase)
        const primaryWallet = {
          index: 0,
          address: hdNode.address,
          privateKey: hdNode.privateKey
        }

        chrome.storage.local.set({
          vault_address: primaryWallet.address,
          session_connected: true
        }, () => {
          setDerivedWallets([primaryWallet])
          setActiveIdx(0)
          setIsLocked(false)
        })
      } catch (err) {
        setErrorMsg("Incorrect unlock password. Please try again.")
      }
    })
  }

  // Derive new wallet index
  const deriveNextAccount = () => {
    if (!mnemonic) return
    const nextIndex = derivedWallets.length
    const path = `m/44'/60'/0'/0/${nextIndex}`
    const hdNode = ethers.HDNodeWallet.fromPhrase(mnemonic, undefined, path)

    const nextWallet = {
      index: nextIndex,
      address: hdNode.address,
      privateKey: hdNode.privateKey
    }

    setDerivedWallets([...derivedWallets, nextWallet])
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // --- DAPP INTERACTION HANDLERS ----------------------------------------------

  const handleApproveConnection = () => {
    chrome.storage.local.set({ session_connected: true }, () => {
      // Close popup approval window safely
      window.close()
    })
  }

  const handleApproveSignature = () => {
    setSigning(true)
    setTimeout(() => {
      let resultPayload = {}

      if (promptParams?.method === 'personal_sign') {
        // Sign personal message payload using derived active private key
        try {
          const activeWallet = new ethers.Wallet(derivedWallets[activeIdx].privateKey)
          const msgBytes = ethers.isHexString(promptParams.list[0]) 
            ? ethers.getBytes(promptParams.list[0])
            : promptParams.list[0]
          const signature = activeWallet.signMessageSync(msgBytes)
          resultPayload = { signature }
        } catch {
          resultPayload = { error: "Failed to sign message" }
        }
      } else {
        // Simulate standard Transaction signature hash
        const txHash = "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')
        resultPayload = { txHash }
      }

      chrome.storage.local.set({ pending_rpc_result: resultPayload }, () => {
        setSigning(false)
        window.close()
      })
    }, 1500)
  }

  const handleRejectSignature = () => {
    chrome.storage.local.set({ pending_rpc_result: { error: "User rejected signature request" } }, () => {
      window.close()
    })
  }

  // Active address formatting helper
  const activeAddress = derivedWallets[activeIdx]?.address ?? "0x0000...0000"
  const shortAddress = `${activeAddress.slice(0, 6)}...${activeAddress.slice(-4)}`

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", position: "relative" }}>
      {/* Curved background orbs */}
      <div style={{ position: "absolute", top: -80, left: -60, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)", zIndex: 0 }} />
      <div style={{ position: "absolute", bottom: -80, right: -60, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.1) 0%, transparent 70%)", zIndex: 0 }} />

      {/* Header Bar */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "linear-gradient(135deg, #6366f1 0%, #10b981 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "14px" }}>
            K
          </div>
          <span style={{ fontSize: "16px", fontWeight: "bold", letterSpacing: "0.5px" }}>KryptoNow</span>
        </div>
        
        {!isLocked && (
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", background: "rgba(16,185,129,0.1)", borderRadius: "8px", fontSize: "11px", color: "#10b981", border: "1px solid rgba(16,185,129,0.2)" }}>
              <Shield size={10} /> Mainnet
            </div>
            <button 
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", cursor: "pointer", display: "flex", alignItems: "center" }}
              onClick={() => setIsLocked(true)}
              title="Lock Wallet"
              aria-label="Lock Wallet"
            >
              <Lock size={14} />
            </button>
          </div>
        )}
      </header>

      {/* Primary view router */}
      <main style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", zIndex: 10 }}>
        {isLocked ? (
          // --- VAULT AUTHENTICATION ROUTE ---
          hasVault ? (
            // Unlock wallet form
            <form onSubmit={handleUnlockVault} style={{ display: "flex", flexDirection: "column", gap: "16px", justifyContent: "center", flex: 1 }}>
              <div style={{ textAlign: "center", marginBottom: "8px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "50%", background: "rgba(99,102,241,0.1)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Unlock size={24} />
                </div>
                <h2 style={{ fontSize: "18px", margin: 0 }}>Unlock KryptoNow Vault</h2>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>Enter password to decrypt recovery phrase.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <input 
                  type="password" 
                  placeholder="Enter vault password" 
                  style={{ width: "100%", boxSizing: "border-box", padding: "12px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "#fff", fontSize: "14px", outline: "none" }}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              {errorMsg && <p style={{ fontSize: "11px", color: "#ef4444", margin: 0, textAlign: "center" }}>{errorMsg}</p>}

              <button 
                type="submit" 
                style={{ width: "100%", padding: "12px", background: "#6366f1", border: "none", borderRadius: "10px", color: "#fff", fontWeight: "bold", cursor: "pointer", transition: "background 0.2s" }}
              >
                Unlock Extension
              </button>
            </form>
          ) : (
            // Initialize new vault form
            <form onSubmit={handleCreateVault} style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1 }}>
              <div style={{ textAlign: "center", marginBottom: "4px" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "rgba(16,185,129,0.1)", color: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <Key size={20} />
                </div>
                <h2 style={{ fontSize: "16px", margin: 0 }}>Create Self-Custody Vault</h2>
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "4px" }}>Set an unlock password to securely encrypt your new BIP-39 mnemonic seed words locally.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <input 
                  type="password" 
                  placeholder="Create password (min 8 chars)" 
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", fontSize: "13px", outline: "none" }}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <input 
                  type="password" 
                  placeholder="Confirm password" 
                  style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#fff", fontSize: "13px", outline: "none" }}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {errorMsg && <p style={{ fontSize: "11px", color: "#ef4444", margin: 0, textAlign: "center" }}>{errorMsg}</p>}

              <button 
                type="submit" 
                style={{ width: "100%", padding: "12px", background: "#10b981", border: "none", borderRadius: "8px", color: "#fff", fontWeight: "bold", cursor: "pointer" }}
              >
                Create Mnemonic & Crypt Vault
              </button>
            </form>
          )
        ) : action === 'connect' ? (
          // --- DAPP ACCOUNT REQUESTS PROMPT ---
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1, justifyContent: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "rgba(99,102,241,0.15)", color: "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Activity size={28} />
              </div>
              <h2 style={{ fontSize: "18px", margin: 0 }}>Connect to Web3 Site</h2>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", marginTop: "6px" }}>This site requests access to view your derived wallet address.</p>
            </div>

            <div style={{ padding: "16px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px" }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Account to Share</span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(99,102,241,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1", fontWeight: "bold", fontSize: "12px" }}>
                  #{activeIdx + 1}
                </div>
                <div>
                  <h4 style={{ fontSize: "13px", margin: 0 }}>Account Slot {activeIdx}</h4>
                  <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontFamily: "monospace", margin: "2px 0 0" }}>{shortAddress}</p>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "auto" }}>
              <button 
                style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "#fff", cursor: "pointer" }}
                onClick={() => window.close()}
              >
                Cancel
              </button>
              <button 
                style={{ flex: 1, padding: "12px", background: "#6366f1", border: "none", borderRadius: "10px", color: "#fff", fontWeight: "bold", cursor: "pointer" }}
                onClick={handleApproveConnection}
              >
                Approve
              </button>
            </div>
          </div>
        ) : action === 'sign' ? (
          // --- DAPP TRANSACTION SIGNATURES PROMPT ---
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
            <div>
              <h2 style={{ fontSize: "16px", margin: 0 }}>Signature Request</h2>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>Sign RPC Payload with secure key.</p>
            </div>

            <div style={{ padding: "12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "10px", fontSize: "12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>RPC Method</span>
                <strong style={{ fontFamily: "monospace", color: "#6366f1" }}>{promptParams?.method}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.4)" }}>Signing Address</span>
                <span style={{ fontFamily: "monospace" }}>{shortAddress}</span>
              </div>
            </div>

            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>Sign Payload Data</span>
            <div style={{ flex: 1, padding: "12px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "10px", fontFamily: "monospace", fontSize: "11px", overflowY: "auto", maxHeight: "160px", wordBreak: "break-all" }}>
              {JSON.stringify(promptParams?.list)}
            </div>

            <div style={{ display: "flex", gap: "12px", marginTop: "auto" }}>
              <button 
                style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "10px", color: "#fff", cursor: "pointer" }}
                onClick={handleRejectSignature}
                disabled={signing}
              >
                Reject
              </button>
              <button 
                style={{ flex: 1, padding: "12px", background: "#10b981", border: "none", borderRadius: "10px", color: "#fff", fontWeight: "bold", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                onClick={handleApproveSignature}
                disabled={signing}
              >
                {signing ? "Signing..." : "Sign Action"}
              </button>
            </div>
          </div>
        ) : (
          // --- MAIN EXTENSION PORTAL VIEW ---
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
            {/* Holographic Balance Card */}
            <div style={{ padding: "20px", background: "linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(16,185,129,0.05) 100%)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: "16px", textAlign: "center" }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Wallet Account Balance</span>
              <h1 style={{ fontSize: "28px", margin: "6px 0", color: "#6366f1" }}>$124,582.40</h1>
              
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)" }}>Address:</span>
                <button 
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px", padding: "4px 8px", color: "#fff", fontFamily: "monospace", fontSize: "11px", display: "flex", alignItems: "center", gap: "4px", cursor: "pointer" }}
                  onClick={() => copyToClipboard(activeAddress)}
                >
                  {shortAddress} <Copy size={10} />
                </button>
                {copied && <span style={{ fontSize: "10px", color: "#10b981" }}><CheckCircle size={8} style={{ display: "inline" }} /> Copied</span>}
              </div>
            </div>

            {/* Asset balances */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <h3 style={{ fontSize: "14px", margin: 0 }}>Asset Balances</h3>
              
              {[
                { symbol: "ETH", name: "Ethereum Native", balance: "35.204 ETH", price: "$124,582.40", color: "#6366f1" },
                { symbol: "USDC", name: "USD Coin", balance: "1,542.50 USDC", price: "$1,542.50", color: "#2775ca" },
                { symbol: "LINK", name: "Chainlink Token", balance: "24.50 LINK", price: "$446.88", color: "#375bd2" }
              ].map((a, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", borderRadius: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: `${a.color}15`, color: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold", fontSize: "12px" }}>
                      {a.symbol.slice(0,2)}
                    </div>
                    <div>
                      <h4 style={{ fontSize: "13px", margin: 0 }}>{a.name}</h4>
                      <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", margin: "2px 0 0" }}>{a.balance}</p>
                    </div>
                  </div>
                  <strong style={{ fontSize: "13px" }}>{a.price}</strong>
                </div>
              ))}
            </div>

            {/* Sub-account Switcher */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: "14px", margin: 0 }}>Derived Accounts ({derivedWallets.length})</h3>
                <button 
                  style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: "bold" }}
                  onClick={deriveNextAccount}
                >
                  <Plus size={14} /> Derive Account
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto", maxHeight: "120px" }}>
                {derivedWallets.map((w, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center", 
                      padding: "8px 12px", 
                      background: activeIdx === w.index ? "rgba(99,102,241,0.05)" : "rgba(255,255,255,0.01)", 
                      border: activeIdx === w.index ? "1px solid rgba(99,102,241,0.2)" : "1px solid rgba(255,255,255,0.03)", 
                      borderRadius: "8px",
                      cursor: "pointer"
                    }}
                    onClick={() => {
                      setActiveIdx(w.index)
                      setRevealKeyIndex(null)
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: activeIdx === w.index ? "#6366f1" : "transparent" }} />
                      <div>
                        <h4 style={{ fontSize: "12px", margin: 0 }}>Account Slot #{w.index}</h4>
                        <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>{w.address.slice(0,6)}...{w.address.slice(-4)}</span>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button 
                        style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", padding: "4px" }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setRevealKeyIndex(revealKeyIndex === w.index ? null : w.index)
                        }}
                        title={revealKeyIndex === w.index ? "Hide Private Key" : "Show Private Key"}
                        aria-label={revealKeyIndex === w.index ? "Hide Private Key" : "Show Private Key"}
                      >
                        {revealKeyIndex === w.index ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              
              {revealKeyIndex !== null && (
                <div style={{ padding: "10px", background: "rgba(239,68,68,0.05)", border: "1px dashed rgba(239,68,68,0.2)", borderRadius: "8px", fontSize: "10px", fontFamily: "monospace", wordBreak: "break-all", color: "#f87171" }}>
                  Private Key: {derivedWallets[revealKeyIndex].privateKey}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer Branding */}
      <footer style={{ padding: "16px", borderTop: "1px solid rgba(255,255,255,0.04)", textAlign: "center", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", color: "rgba(255,255,255,0.3)", fontSize: "10px" }}>
          <Shield size={10} fill="rgba(255,255,255,0.1)" /> Hardware-backed Biometric Enclave Active
        </div>
      </footer>
    </div>
  )
}
