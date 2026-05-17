const CHAINS=[
  {id:1,    name:"Ethereum",  symbol:"ETH",  color:"#627EEA",icon:"E" },
  {id:137,  name:"Polygon",   symbol:"MATIC",color:"#8247E5",icon:"P" },
  {id:56,   name:"BNB Chain", symbol:"BNB",  color:"#F0B90B",icon:"B" },
  {id:42161,name:"Arbitrum",  symbol:"ETH",  color:"#2D374B",icon:"A" },
  {id:10,   name:"Optimism",  symbol:"ETH",  color:"#FF0420",icon:"O" },
  {id:8453, name:"Base",      symbol:"ETH",  color:"#0052FF",icon:"Ba"},
]

let state={wallet:null,balance:"$0.00",nativeBal:"0.0000",tab:"assets",connectedOrigins:[],screen:"loading"}

const urlParams=new URLSearchParams(window.location.search)
const isApproval=urlParams.get("approval")==="true"
const approvalId=urlParams.get("id")
const approvalType=urlParams.get("type")
let approvalData=null

function app(){return document.getElementById("app")}

function render(){
  if(isApproval&&approvalData){renderApproval();return}
  if(state.screen==="loading"){app().innerHTML='<div class="loading">Loading...</div>';return}
  if(state.screen==="setup"){renderSetup();return}
  if(state.screen==="import"){renderImport();return}
  if(state.screen==="chains"){renderChains();return}
  renderMain()
}

function renderMain(){
  const w=state.wallet
  const chain=CHAINS.find(c=>c.id===w?.chainId)??CHAINS[0]
  const short=w?.address?w.address.slice(0,6)+"..."+w.address.slice(-4):""
  const initials=w?.address?w.address.slice(2,4).toUpperCase():"KN"
  app().innerHTML=`
    <div class="header">
      <div class="logo">
        <div class="logo-icon">KN</div>
        <div><div class="logo-text">KryptoNow</div><div class="logo-sub">Web3 Wallet</div></div>
      </div>
      <div class="header-right">
        <button class="icon-btn" id="btn-chain">${chain.icon}</button>
        <button class="icon-btn" id="btn-app">[->]</button>
      </div>
    </div>
    <div class="balance-card">
      <div class="avatar">${initials}</div>
      <div class="wallet-addr">${short}</div>
      <div class="balance-label">Total Balance</div>
      <div class="balance-amt">${state.balance}</div>
      <div class="chain-badge">
        <div class="chain-dot" style="background:${chain.color}"></div>
        <div class="chain-name">${chain.name}</div>
      </div>
    </div>
    <div class="actions">
      <div class="action-item" id="act-send"><div class="action-btn">[^]</div><div class="action-label">Send</div></div>
      <div class="action-item" id="act-recv"><div class="action-btn">[v]</div><div class="action-label">Receive</div></div>
      <div class="action-item" id="act-swap"><div class="action-btn">[<>]</div><div class="action-label">Swap</div></div>
      <div class="action-item" id="act-buy"><div class="action-btn">[$]</div><div class="action-label">Buy</div></div>
    </div>
    <div class="tabs">
      <button class="tab ${state.tab==="assets"?"active":""}" id="tab-assets">Assets</button>
      <button class="tab ${state.tab==="connected"?"active":""}" id="tab-connected">Connected</button>
      <button class="tab ${state.tab==="settings"?"active":""}" id="tab-settings">Settings</button>
    </div>
    <div class="scroll-content">
      ${state.tab==="assets"?renderAssets():state.tab==="connected"?renderConnected():renderSettings()}
    </div>
  `
  // Attach events after render
  document.getElementById("btn-chain")?.addEventListener("click", showChains)
  document.getElementById("btn-app")?.addEventListener("click", openApp)
  document.getElementById("act-send")?.addEventListener("click", openSend)
  document.getElementById("act-recv")?.addEventListener("click", openReceive)
  document.getElementById("act-swap")?.addEventListener("click", openSwap)
  document.getElementById("act-buy")?.addEventListener("click", openBuy)
  document.getElementById("tab-assets")?.addEventListener("click", ()=>setTab("assets"))
  document.getElementById("tab-connected")?.addEventListener("click", ()=>setTab("connected"))
  document.getElementById("tab-settings")?.addEventListener("click", ()=>setTab("settings"))

  // Disconnect buttons
  document.querySelectorAll(".dapp-disc").forEach(btn => {
    btn.addEventListener("click", () => disconnect(btn.dataset.origin))
  })
}

function renderAssets(){
  const chain=CHAINS.find(c=>c.id===state.wallet?.chainId)??CHAINS[0]
  return `<div class="section">
    <div class="section-title">Assets on ${chain.name}</div>
    <div class="asset-row">
      <div class="asset-icon" style="background:${chain.color}20;color:${chain.color}">${chain.icon}</div>
      <div class="asset-mid"><div class="asset-name">${chain.symbol}</div><div class="asset-bal">${state.nativeBal} ${chain.symbol}</div></div>
      <div class="asset-right"><div class="asset-value">${state.balance}</div></div>
    </div>
  </div>`
}

function renderConnected(){
  if(!state.connectedOrigins.length) return '<div class="empty">No connected dApps yet.<br>Visit any Web3 site to connect.</div>'
  return `<div class="section"><div class="section-title">Connected Sites (${state.connectedOrigins.length})</div>
    ${state.connectedOrigins.map(o=>`
      <div class="dapp-row">
        <div class="dapp-icon">${(o.name||o.origin).slice(0,2).toUpperCase()}</div>
        <div class="dapp-name">${o.name||o.origin}</div>
        <button class="dapp-disc" data-origin="${o.origin}">Disconnect</button>
      </div>`).join("")}
  </div>`
}

function renderSettings(){
  return `<div class="section">
    <div class="section-title">Wallet</div>
    <div class="asset-row" id="btn-import" style="cursor:pointer">
      <div class="asset-icon" style="background:#EEF2FF;color:#6366F1">IMP</div>
      <div class="asset-mid"><div class="asset-name">Import Different Wallet</div><div class="asset-bal">Switch to another wallet</div></div>
    </div>
    <div class="asset-row" id="btn-openapp" style="cursor:pointer">
      <div class="asset-icon" style="background:#ECFDF5;color:#10B981">[->]</div>
      <div class="asset-mid"><div class="asset-name">Open Full App</div><div class="asset-bal">kryptonow.xyz</div></div>
    </div>
  </div>`
}

function renderSetup(){
  app().innerHTML=`
    <div class="header"><div class="logo"><div class="logo-icon">KN</div>
    <div><div class="logo-text">KryptoNow</div><div class="logo-sub">Web3 Wallet</div></div></div></div>
    <div class="setup-screen">
      <div class="setup-icon">[K]</div>
      <div class="setup-title">Welcome to KryptoNow</div>
      <div class="setup-sub">Connect your wallet to use this extension with any Web3 dApp.</div>
      <button class="setup-btn" id="btn-goto-import">Import Wallet</button>
      <button class="setup-btn sec" id="btn-goto-app">Open Full App</button>
    </div>`
  document.getElementById("btn-goto-import")?.addEventListener("click", showImport)
  document.getElementById("btn-goto-app")?.addEventListener("click", openApp)
}

function renderImport(){
  app().innerHTML=`
    <div class="header"><div class="logo"><div class="logo-icon">KN</div>
    <div><div class="logo-text">Import Wallet</div></div></div></div>
    <div class="setup-screen">
      <div class="setup-sub">Enter your wallet details to connect to dApps.</div>
      <input class="setup-input" id="inp-addr" placeholder="Wallet address (0x...)"/>
      <input class="setup-input" id="inp-pk" type="password" placeholder="Private key (0x...)"/>
      <select class="setup-input" id="inp-chain">
        ${CHAINS.map(c=>`<option value="${c.id}">${c.name}</option>`).join("")}
      </select>
      <button class="setup-btn" id="btn-do-import">Import Wallet</button>
      <button class="setup-btn sec" id="btn-back">Back</button>
    </div>`
  document.getElementById("btn-do-import")?.addEventListener("click", importWallet)
  document.getElementById("btn-back")?.addEventListener("click", ()=>{state.screen="setup";render()})
}

function renderChains(){
  const w=state.wallet
  app().innerHTML=`
    <div class="header">
      <div class="logo"><div class="logo-icon">KN</div><div><div class="logo-text">Switch Network</div></div></div>
      <button class="icon-btn" id="btn-close-chains">[X]</button>
    </div>
    <div class="section">
      ${CHAINS.map(c=>`
        <div class="chain-row ${c.id===w?.chainId?"active":""}" data-chainid="${c.id}">
          <div class="chain-icon" style="background:${c.color}20;color:${c.color}">${c.icon}</div>
          <div style="flex:1"><div class="chain-nm">${c.name}</div><div class="chain-sym">${c.symbol}</div></div>
          ${c.id===w?.chainId?'<span class="chain-check">[*]</span>':""}
        </div>`).join("")}
    </div>`
  document.getElementById("btn-close-chains")?.addEventListener("click", ()=>{state.screen="main";render()})
  document.querySelectorAll(".chain-row").forEach(row => {
    row.addEventListener("click", ()=>switchChain(parseInt(row.dataset.chainid)))
  })
}

function renderApproval(){
  const d=approvalData
  const type=approvalType
  let content=""
  if(type==="sendTransaction"){
    const tx=d.data??{}
    content=`
      <div class="approval-card"><div class="approval-label">To</div><div class="approval-value">${tx.to??"-"}</div></div>
      <div class="approval-card"><div class="approval-label">Value</div><div class="approval-value">${tx.value?parseInt(tx.value,16)/1e18+" ETH":"0 ETH"}</div></div>
      <div class="approval-card"><div class="approval-label">Data</div><div class="approval-value">${tx.data&&tx.data!=="0x"?tx.data.slice(0,60)+"...":"None"}</div></div>
      <div class="approval-warn"><div class="approval-warn-t">[!] Transactions cannot be reversed.</div></div>`
  } else {
    const msg=d.data?.message??d.data?.data??JSON.stringify(d.data)
    content=`
      <div class="approval-card"><div class="approval-label">Message</div>
      <div class="approval-value" style="max-height:100px;overflow:auto">${String(msg).slice(0,300)}</div></div>
      <div class="approval-warn"><div class="approval-warn-t">[!] Only sign messages from trusted sites.</div></div>`
  }
  app().innerHTML=`
    <div class="header"><div class="logo"><div class="logo-icon">KN</div>
    <div><div class="logo-text">Approval Request</div></div></div></div>
    <div class="approval-screen">
      <div class="approval-title">${type==="sendTransaction"?"Confirm Transaction":type==="sign"?"Sign Message":"Sign Typed Data"}</div>
      <div class="approval-origin">from ${d.origin??"unknown site"}</div>
      ${content}
      <div class="approval-btns">
        <button class="btn-reject" id="btn-reject">Reject</button>
        <button class="btn-approve" id="btn-approve">Approve</button>
      </div>
    </div>`
  document.getElementById("btn-reject")?.addEventListener("click",  ()=>respondApproval(false))
  document.getElementById("btn-approve")?.addEventListener("click", ()=>respondApproval(true))
}

// --- Actions ---
function setTab(t){state.tab=t;render()}
function showChains(){state.screen="chains";render()}
function showImport(){state.screen="import";render()}
function openApp()    {chrome.tabs.create({url:"https://kryptonow.xyz"})}
function openSend()   {chrome.tabs.create({url:"https://kryptonow.xyz/send"})}
function openReceive(){chrome.tabs.create({url:"https://kryptonow.xyz/receive"})}
function openSwap()   {chrome.tabs.create({url:"https://kryptonow.xyz/swap"})}
function openBuy()    {chrome.tabs.create({url:"https://kryptonow.xyz/buy"})}

async function switchChain(chainId){
  await chrome.runtime.sendMessage({type:"SWITCH_CHAIN",chainId})
  state.wallet.chainId=chainId
  state.screen="main"
  await loadBalance()
  render()
}

async function disconnect(origin){
  const origins=state.connectedOrigins.filter(o=>o.origin!==origin)
  await chrome.storage.local.set({kn_connected_origins:origins})
  state.connectedOrigins=origins
  render()
}

async function importWallet(){
  const address=document.getElementById("inp-addr")?.value?.trim()
  const privateKey=document.getElementById("inp-pk")?.value?.trim()
  const chainId=parseInt(document.getElementById("inp-chain")?.value??"1")
  if(!address||!address.startsWith("0x")){alert("Invalid address");return}
  if(!privateKey||!privateKey.startsWith("0x")){alert("Invalid private key");return}
  await chrome.runtime.sendMessage({type:"IMPORT_WALLET",address,privateKey,chainId})
  state.wallet={address,chainId}
  state.screen="main"
  await loadBalance()
  render()
}

async function respondApproval(approved){
  await chrome.runtime.sendMessage({type:"APPROVAL_RESPONSE",id:approvalId,approved})
  window.close()
}

async function loadBalance(){
  const w=state.wallet
  if(!w?.address)return
  const chain=CHAINS.find(c=>c.id===w.chainId)??CHAINS[0]
  const KEY="t7T7fcsMA4rqQYH70YRV3"
  const RPCS={
    1:`https://eth-mainnet.g.alchemy.com/v2/${KEY}`,
    137:`https://polygon-mainnet.g.alchemy.com/v2/${KEY}`,
    56:"https://bsc-dataseed1.binance.org/",
    42161:`https://arb-mainnet.g.alchemy.com/v2/${KEY}`,
    10:`https://opt-mainnet.g.alchemy.com/v2/${KEY}`,
    8453:`https://base-mainnet.g.alchemy.com/v2/${KEY}`
  }
  try{
    const res=await fetch(RPCS[chain.id]??RPCS[1],{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({jsonrpc:"2.0",id:1,method:"eth_getBalance",params:[w.address,"latest"]})
    })
    const json=await res.json()
    const eth=(parseInt(json.result??"0x0",16)/1e18).toFixed(4)
    state.nativeBal=eth
    const CG={1:"ethereum",137:"matic-network",56:"binancecoin",42161:"ethereum",10:"ethereum",8453:"ethereum"}
    const pr=await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${CG[chain.id]}&vs_currencies=usd`)
    const pd=await pr.json()
    const price=pd[CG[chain.id]]?.usd??0
    state.balance="$"+(parseFloat(eth)*price).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})
  }catch{state.balance="$0.00";state.nativeBal="0.0000"}
}

async function init(){
  if(isApproval&&approvalId){
    approvalData=await chrome.runtime.sendMessage({type:"GET_APPROVAL_DATA",id:approvalId})
    if(approvalData){render();return}
  }
  const wallet=await chrome.runtime.sendMessage({type:"GET_WALLET"})
  const origins=await chrome.runtime.sendMessage({type:"GET_CONNECTED_ORIGINS"})
  state.connectedOrigins=origins??[]
  if(!wallet?.address){state.screen="setup";render();return}
  state.wallet=wallet
  state.screen="main"
  await loadBalance()
  render()
}

init()