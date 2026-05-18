(function () {
  const ESTIMATOR_URL = "https://pauly-estimator-1075378753554.us-central1.run.app";
  const SITE_SOURCE   = "website-mi";

  let state = { stage: "greeting", collected: {}, open: false };

  const style = document.createElement("style");
  style.textContent = `
    #ps-chat-btn {
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      background: #7c3aed; color: #fff; border: none; border-radius: 50px;
      padding: 14px 22px; font-size: 15px; font-weight: 600; cursor: pointer;
      box-shadow: 0 4px 20px rgba(124,58,237,0.5);
      display: flex; align-items: center; gap: 8px;
      font-family: Inter, sans-serif;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    #ps-chat-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 24px rgba(124,58,237,0.6); }
    #ps-chat-window {
      position: fixed; bottom: 90px; right: 24px; z-index: 9998;
      width: 360px; max-height: 520px; background: #0f0f1a;
      border: 1px solid #2d2d4e; border-radius: 16px;
      display: flex; flex-direction: column;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      font-family: Inter, sans-serif;
      overflow: hidden;
      transition: opacity 0.2s, transform 0.2s;
    }
    #ps-chat-window.hidden { opacity: 0; pointer-events: none; transform: translateY(16px); }
    #ps-chat-header {
      background: #7c3aed; color: #fff; padding: 14px 18px;
      font-weight: 700; font-size: 15px;
      display: flex; justify-content: space-between; align-items: center;
    }
    #ps-chat-close { cursor: pointer; opacity: 0.8; font-size: 20px; line-height: 1; }
    #ps-chat-close:hover { opacity: 1; }
    #ps-chat-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 12px;
      scrollbar-width: thin; scrollbar-color: #2d2d4e transparent;
    }
    .ps-msg { display: flex; flex-direction: column; gap: 3px; max-width: 88%; }
    .ps-msg.agent { align-self: flex-start; }
    .ps-msg.user  { align-self: flex-end; }
    .ps-msg-name  { font-size: 11px; font-weight: 600; color: #9ca3af; padding-left: 2px; }
    .ps-msg.user .ps-msg-name { text-align: right; }
    .ps-msg-bubble {
      padding: 10px 14px; border-radius: 14px;
      font-size: 14px; line-height: 1.5; color: #f1f1f1;
    }
    .ps-msg.agent .ps-msg-bubble { background: #1e1e36; border-bottom-left-radius: 4px; }
    .ps-msg.user  .ps-msg-bubble { background: #7c3aed; border-bottom-right-radius: 4px; }
    #ps-chat-input-row {
      display: flex; gap: 8px; padding: 12px 14px;
      border-top: 1px solid #2d2d4e; background: #0f0f1a;
    }
    #ps-chat-input {
      flex: 1; background: #1e1e36; border: 1px solid #2d2d4e; border-radius: 10px;
      color: #f1f1f1; padding: 9px 14px; font-size: 14px; outline: none;
      font-family: Inter, sans-serif;
    }
    #ps-chat-input::placeholder { color: #6b7280; }
    #ps-chat-send {
      background: #7c3aed; color: #fff; border: none; border-radius: 10px;
      padding: 9px 16px; cursor: pointer; font-weight: 600; font-size: 14px;
    }
    #ps-chat-send:hover { background: #6d28d9; }
    #ps-chat-send:disabled { opacity: 0.5; cursor: default; }
    .ps-typing { display: flex; gap: 5px; align-items: center; padding: 10px 14px; }
    .ps-typing span { width: 7px; height: 7px; background: #7c3aed; border-radius: 50%;
      animation: ps-bounce 1.2s infinite; }
    .ps-typing span:nth-child(2) { animation-delay: 0.2s; }
    .ps-typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes ps-bounce {
      0%,80%,100% { transform: translateY(0); }
      40% { transform: translateY(-6px); }
    }
    @media (max-width: 420px) {
      #ps-chat-window { width: calc(100vw - 24px); right: 12px; bottom: 80px; }
      #ps-chat-btn { right: 12px; bottom: 16px; }
    }
  `;
  document.head.appendChild(style);

  const btn = document.createElement("button");
  btn.id = "ps-chat-btn";
  btn.innerHTML = "💬 Chat with Andy";

  const win = document.createElement("div");
  win.id = "ps-chat-window";
  win.classList.add("hidden");
  win.innerHTML = `
    <div id="ps-chat-header">
      <span>🔧 Pauly Services — Instant Estimate</span>
      <span id="ps-chat-close">✕</span>
    </div>
    <div id="ps-chat-messages"></div>
    <div id="ps-chat-input-row">
      <input id="ps-chat-input" type="text" placeholder="Describe your drain issue..." />
      <button id="ps-chat-send">Send</button>
    </div>
  `;

  document.body.appendChild(btn);
  document.body.appendChild(win);

  const msgContainer = win.querySelector("#ps-chat-messages");
  const input        = win.querySelector("#ps-chat-input");
  const sendBtn      = win.querySelector("#ps-chat-send");

  function addMsg(role, agentName, text) {
    const div = document.createElement("div");
    div.className = "ps-msg " + role;
    const formatted = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    div.innerHTML =
      '<div class="ps-msg-name">' + agentName + '</div>' +
      '<div class="ps-msg-bubble">' + formatted + '</div>';
    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "ps-msg agent";
    div.id = "ps-typing";
    div.innerHTML = '<div class="ps-msg-name">...</div><div class="ps-typing"><span></span><span></span><span></span></div>';
    msgContainer.appendChild(div);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  function hideTyping() {
    const el = win.querySelector("#ps-typing");
    if (el) el.remove();
  }

  async function sendToApi(userMessage) {
    const payload = {
      stage:        state.stage,
      collected:    state.collected,
      user_message: userMessage,
      source:       SITE_SOURCE,
    };
    const res = await fetch(ESTIMATOR_URL + "/api/estimator/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.json();
  }

  async function handleSend(userText) {
    if (state.stage === "complete" || state.stage === "done") return;
    if (userText) addMsg("user", "You", userText);
    sendBtn.disabled = true;
    input.disabled   = true;
    showTyping();
    try {
      const data = await sendToApi(userText);
      hideTyping();
      state.stage     = data.stage;
      state.collected = data.collected || {};
      addMsg("agent", data.agent || "Andy", data.reply);
      if (data.stage === "complete" || data.stage === "done") {
        input.style.display   = "none";
        sendBtn.style.display = "none";
      }
    } catch (err) {
      hideTyping();
      addMsg("agent", "Andy", "Hmm, something went wrong on our end. Please call us at (810) 479-5806 or try again.");
    } finally {
      sendBtn.disabled = false;
      input.disabled   = false;
      input.focus();
    }
  }

  btn.addEventListener("click", function () {
    state.open = !state.open;
    win.classList.toggle("hidden", !state.open);
    if (state.open && msgContainer.children.length === 0) {
      handleSend("");
    } else {
      input.focus();
    }
  });

  win.querySelector("#ps-chat-close").addEventListener("click", function () {
    state.open = false;
    win.classList.add("hidden");
  });

  sendBtn.addEventListener("click", function () {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    handleSend(text);
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      handleSend(text);
    }
  });
})();
