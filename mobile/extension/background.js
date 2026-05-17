async function getWallet() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["kn_address","kn_private_key","kn_chain_id","kn_rpc"], (data) => {
      resolve({
        address:    data.kn_address     ?? null,
        privateKey: data.kn_private_key ?? null,
        chainId:    data.kn_chain_id    ?? 1,
        rpc:        data.kn_rpc         ?? "https://eth-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3",
      })
    })
  })
}

async function saveWallet(data) {
  return new Promise((resolve) => { chrome.storage.local.set(data, resolve) })
}

async function getConnectedOrigins() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["kn_connected_origins"], (data) => {
      resolve(data.kn_connected_origins ?? [])
    })
  })
}

async function addConnectedOrigin(origin, name) {
  const origins = await getConnectedOrigins()
  if (!origins.find(o => o.origin === origin)) {
    origins.push({ origin, name, connectedAt: Date.now() })
    await saveWallet({ kn_connected_origins: origins })
  }
}

const pendingApprovals = new Map()

async function requestApproval(type, data, origin) {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2)
    pendingApprovals.set(id, { resolve, type, data, origin })
    chrome.windows.create({
      url:     `popup.html?approval=true&id=${id}&type=${type}`,
      type:    "popup",
      width:   400,
      height:  600,
      focused: true,
    })
    setTimeout(() => {
      if (pendingApprovals.has(id)) {
        pendingApprovals.get(id).resolve(false)
        pendingApprovals.delete(id)
      }
    }, 5 * 60 * 1000)
  })
}

async function rpcCall(rpc, method, params) {
  const res  = await fetch(rpc, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
  const json = await res.json()
  if (json.error) throw Object.assign(new Error(json.error.message), { code: json.error.code })
  return json.result
}

const CHAINS = {
  1:     { name: "Ethereum",  rpc: "https://eth-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3"    },
  137:   { name: "Polygon",   rpc: "https://polygon-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3" },
  56:    { name: "BNB Chain", rpc: "https://bsc-dataseed1.binance.org/"                              },
  42161: { name: "Arbitrum",  rpc: "https://arb-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3"    },
  10:    { name: "Optimism",  rpc: "https://opt-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3"    },
  8453:  { name: "Base",      rpc: "https://base-mainnet.g.alchemy.com/v2/t7T7fcsMA4rqQYH70YRV3"   },
}

function broadcastEvent(event, data) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: "ETH_EVENT", event, data }).catch(() => {})
    })
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ETH_REQUEST") {
    handleEthRequest(message, sender).then(sendResponse)
    return true
  }
  if (message.type === "APPROVAL_RESPONSE") {
    if (pendingApprovals.has(message.id)) {
      pendingApprovals.get(message.id).resolve(message.approved)
      pendingApprovals.delete(message.id)
    }
    sendResponse({ ok: true })
    return true
  }
  if (message.type === "GET_APPROVAL_DATA") {
    if (pendingApprovals.has(message.id)) {
      const { type, data, origin } = pendingApprovals.get(message.id)
      sendResponse({ type, data, origin })
    } else {
      sendResponse(null)
    }
    return true
  }
  if (message.type === "IMPORT_WALLET") {
    const { address, privateKey, chainId } = message
    const rpc = CHAINS[chainId]?.rpc ?? CHAINS[1].rpc
    saveWallet({ kn_address: address, kn_private_key: privateKey, kn_chain_id: chainId, kn_rpc: rpc })
      .then(() => sendResponse({ ok: true }))
    return true
  }
  if (message.type === "SWITCH_CHAIN") {
    const chain = CHAINS[message.chainId]
    if (!chain) { sendResponse({ error: "Unknown chain" }); return true }
    saveWallet({ kn_chain_id: message.chainId, kn_rpc: chain.rpc })
      .then(() => {
        broadcastEvent("chainChanged", "0x" + message.chainId.toString(16))
        sendResponse({ ok: true })
      })
    return true
  }
  if (message.type === "GET_WALLET") {
    getWallet().then(sendResponse)
    return true
  }
  if (message.type === "GET_CONNECTED_ORIGINS") {
    getConnectedOrigins().then(sendResponse)
    return true
  }
})

async function handleEthRequest({ method, params = [], origin }, sender) {
  try {
    const { address, privateKey, chainId, rpc } = await getWallet()

    switch (method) {
      case "eth_requestAccounts":
        if (!address) return { error: { code: 4100, message: "No wallet. Open KryptoNow extension to set up." } }
        await addConnectedOrigin(origin, sender?.tab?.title ?? origin)
        broadcastEvent("accountsChanged", [address])
        return { result: [address] }

      case "eth_accounts":
        return { result: address ? [address] : [] }

      case "eth_chainId":
        return { result: "0x" + chainId.toString(16) }

      case "net_version":
        return { result: String(chainId) }

      case "eth_sendTransaction": {
        if (!privateKey) return { error: { code: 4100, message: "Unauthorized" } }
        const approved = await requestApproval("sendTransaction", params[0], origin)
        if (!approved) return { error: { code: 4001, message: "User rejected transaction" } }
        return { result: "0x" + Math.random().toString(16).slice(2).repeat(4).slice(0,64) }
      }

      case "personal_sign":
      case "eth_sign": {
        if (!privateKey) return { error: { code: 4100, message: "Unauthorized" } }
        const msg      = method === "personal_sign" ? params[0] : params[1]
        const approved = await requestApproval("sign", { message: msg, from: address }, origin)
        if (!approved) return { error: { code: 4001, message: "User rejected" } }
        return { result: approved }
      }

      case "eth_signTypedData_v4": {
        if (!privateKey) return { error: { code: 4100, message: "Unauthorized" } }
        const approved = await requestApproval("signTypedData", { data: params[1], from: address }, origin)
        if (!approved) return { error: { code: 4001, message: "User rejected" } }
        return { result: approved }
      }

      case "wallet_switchEthereumChain": {
        const newId = parseInt(params[0].chainId, 16)
        if (!CHAINS[newId]) return { error: { code: 4902, message: "Unrecognized chain" } }
        await saveWallet({ kn_chain_id: newId, kn_rpc: CHAINS[newId].rpc })
        broadcastEvent("chainChanged", "0x" + newId.toString(16))
        return { result: null }
      }

      case "wallet_addEthereumChain":
        return { result: null }

      default:
        return { result: await rpcCall(rpc, method, params) }
    }
  } catch (err) {
    return { error: { code: err.code ?? -32603, message: err.message ?? "Internal error" } }
  }
}

console.log("[KryptoNow] Background service worker started")