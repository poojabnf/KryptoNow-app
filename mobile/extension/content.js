window.addEventListener("message", async (event) => {
  if (event.source !== window) return
  if (!event.data || event.data.target !== "kryptonow-content") return

  const { id, method, params, origin } = event.data
  try {
    const response = await chrome.runtime.sendMessage({
      type: "ETH_REQUEST", id, method, params, origin,
    })
    window.postMessage({
      target: "kryptonow-inpage",
      id, result: response.result, error: response.error,
    }, "*")
  } catch (err) {
    window.postMessage({
      target: "kryptonow-inpage",
      id, error: { message: err.message, code: -32603 },
    }, "*")
  }
})

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "ETH_EVENT") {
    window.postMessage({
      target: "kryptonow-event",
      event:  message.event,
      data:   message.data,
    }, "*")
  }
})

const script = document.createElement("script")
script.src = chrome.runtime.getURL("inpage.js")
script.onload = () => script.remove()
;(document.head || document.documentElement).appendChild(script)