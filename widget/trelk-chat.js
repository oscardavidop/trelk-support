/**
 * Trelk WebChat Widget - Premium Zinc Refactor
 * High-fidelity embeddable chat widget
 *
 * Usage:
 * <script src="https://trelk.site/widget/trelk-chat.js"></script>
 * <script>
 * TrelkChat.init({
 * projectId: "your-project-id",
 * user: { name: "User", email: "user@example.com" }
 * });
 * </script>
 */

(function () {
  "use strict";

  if (window.TrelkChat && window.TrelkChat._initialized) {
    console.warn("TrelkChat already initialized");
    return;
  }

  // ============= CONFIGURATION =============
  const DEFAULT_CONFIG = {
    projectId: null,
    theme: "dark", // Default to dark for Premium Zinc look
    position: "right",
    primaryColor: "#6366f1", // Indigo 500
    headerText: "Soporte Trelk",
    welcomeMessage: "¡Hola! 👋 ¿Cómo podemos ayudarte hoy?",
    offlineMessage: "Nuestro equipo no está disponible en este momento.",
    inputPlaceholder: "Escribe un mensaje...",
    user: null,
    autoOpen: false,
    autoOpenDelay: 0,
    enableSoundNotifications: true,
    showPoweredBy: true,
    zIndex: 999999,
    baseUrl: "https://trelk.site",
  };

  // State
  let config = { ...DEFAULT_CONFIG };
  let isOpen = false;
  let isOnline = true;
  let socket = null;
  let visitorId = null;
  let sessionId = null;
  let messages = [];
  let unreadCount = 0;
  let isTyping = false;
  let typingTimeout = null;
  
  // DOM Elements
  let container, bubble, chatWindow, messagesContainer, inputField, sendBtn;

  // ============= UTILITIES =============
  const generateId = () => "vis_" + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  
  const getStoredVisitorId = () => {
    try { return localStorage.getItem("trelk_visitor_id"); } catch (e) { return null; }
  };

  const setStoredVisitorId = (id) => {
    try { localStorage.setItem("trelk_visitor_id", id); } catch (e) {}
  };

  const formatTime = (date) => new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const escapeHtml = (text) => {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  };

  // ============= STYLES (PREMIUM ZINC) =============
  function injectStyles() {
    if (document.getElementById("trelk-chat-styles")) return;

    const styles = document.createElement("style");
    styles.id = "trelk-chat-styles";
    styles.textContent = `
      :root {
        --tr-bg: #09090b;       /* Zinc 950 */
        --tr-bg-alt: #18181b;   /* Zinc 900 */
        --tr-border: #27272a;   /* Zinc 800 */
        --tr-text: #fafafa;     /* Zinc 50 */
        --tr-text-sec: #a1a1aa; /* Zinc 400 */
        --tr-primary: ${config.primaryColor};
        --tr-primary-glow: rgba(99, 102, 241, 0.3);
      }

      #trelk-chat-container {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        position: fixed;
        bottom: 24px;
        ${config.position}: 24px;
        z-index: ${config.zIndex};
        display: flex;
        flex-direction: column;
        align-items: ${config.position === 'right' ? 'flex-end' : 'flex-start'};
        gap: 16px;
        pointer-events: none; /* Allow clicking through container area */
      }

      #trelk-chat-container * {
        box-sizing: border-box;
        pointer-events: auto;
      }

      /* === LAUNCHER BUBBLE === */
      #trelk-chat-bubble {
        width: 56px;
        height: 56px;
        border-radius: 20px;
        background: var(--tr-bg-alt);
        border: 1px solid var(--tr-border);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(255,255,255,0.05);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        color: var(--tr-text);
      }

      #trelk-chat-bubble:hover {
        transform: translateY(-2px);
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        border-color: var(--tr-text-sec);
      }

      #trelk-chat-bubble svg {
        width: 28px;
        height: 28px;
        stroke: currentColor;
        stroke-width: 2;
      }

      #trelk-chat-bubble .badge {
        position: absolute;
        top: -6px;
        right: -6px;
        background: #ef4444;
        color: white;
        font-size: 11px;
        font-weight: 700;
        min-width: 20px;
        height: 20px;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
        border: 2px solid var(--tr-bg);
        box-shadow: 0 0 0 1px #ef4444;
      }

      /* === MAIN WINDOW === */
      #trelk-chat-window {
        width: 380px;
        height: 650px;
        max-width: calc(100vw - 40px);
        max-height: calc(100vh - 120px);
        background: var(--tr-bg);
        border: 1px solid var(--tr-border);
        border-radius: 24px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transform: scale(0.95) translateY(20px);
        transform-origin: bottom ${config.position};
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        pointer-events: none;
        visibility: hidden;
      }

      #trelk-chat-window.open {
        opacity: 1;
        transform: scale(1) translateY(0);
        pointer-events: auto;
        visibility: visible;
      }

      /* === HEADER === */
      .trelk-header {
        padding: 20px 24px;
        background: rgba(24, 24, 27, 0.6); /* Zinc 900 / 60% */
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-bottom: 1px solid var(--tr-border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        z-index: 10;
      }

      .trelk-brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .trelk-logo {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: rgba(99, 102, 241, 0.1);
        border: 1px solid rgba(99, 102, 241, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--tr-primary);
      }

      .trelk-title h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: var(--tr-text);
        line-height: 1.2;
      }

      .trelk-status {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--tr-text-sec);
        margin-top: 2px;
      }

      .trelk-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #10b981; /* Emerald 500 */
        box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
      }
      .trelk-dot.offline { background: #ef4444; box-shadow: none; }

      /* Actions */
      .trelk-actions { display: flex; gap: 4px; }
      
      .trelk-btn-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: none;
        background: transparent;
        color: var(--tr-text-sec);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }
      .trelk-btn-icon:hover { background: var(--tr-bg-alt); color: var(--tr-text); }

      /* === MESSAGES AREA === */
      .trelk-messages {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        background: radial-gradient(circle at top right, rgba(99,102,241,0.03), transparent 40%);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      /* Scrollbar */
      .trelk-messages::-webkit-scrollbar { width: 4px; }
      .trelk-messages::-webkit-scrollbar-thumb { background: var(--tr-border); border-radius: 4px; }

      .trelk-message-row {
        display: flex;
        gap: 12px;
        max-width: 85%;
      }
      
      .trelk-message-row.user {
        align-self: flex-end;
        flex-direction: row-reverse;
      }

      .trelk-avatar {
        width: 28px;
        height: 28px;
        border-radius: 8px;
        background: var(--tr-border);
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        color: var(--tr-text-sec);
      }

      .trelk-bubble {
        padding: 10px 14px;
        border-radius: 14px;
        font-size: 13px;
        line-height: 1.5;
        position: relative;
      }

      .trelk-message-row.agent .trelk-bubble {
        background: var(--tr-bg-alt);
        border: 1px solid var(--tr-border);
        color: var(--tr-text);
        border-top-left-radius: 2px;
      }

      .trelk-message-row.user .trelk-bubble {
        background: var(--tr-primary);
        color: white;
        border-top-right-radius: 2px;
        box-shadow: 0 4px 12px var(--tr-primary-glow);
      }

      .trelk-time {
        font-size: 10px;
        color: var(--tr-text-sec);
        margin-top: 4px;
        opacity: 0.7;
      }

      /* === SYSTEM MESSAGES === */
      .trelk-message-row.system {
        align-self: center;
        max-width: 90%;
      }
      
      .trelk-message-row.system .trelk-bubble {
        background: transparent;
        border: 1px dashed var(--tr-border);
        color: var(--tr-text-sec);
        font-size: 12px;
        text-align: center;
        padding: 8px 16px;
        border-radius: 8px;
      }

      /* === INLINE BUTTONS (Keyboard) === */
      .trelk-buttons {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-top: 12px;
        width: 100%;
      }

      .trelk-button-row {
        display: flex;
        gap: 8px;
        justify-content: flex-start;
      }

      .trelk-inline-btn {
        flex: 1;
        padding: 10px 16px;
        background: var(--tr-bg-alt);
        border: 1px solid var(--tr-border);
        border-radius: 10px;
        color: var(--tr-text);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        text-align: center;
        min-width: 80px;
      }

      .trelk-inline-btn:hover {
        background: var(--tr-primary);
        border-color: var(--tr-primary);
        color: white;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px var(--tr-primary-glow);
      }

      .trelk-inline-btn:active {
        transform: translateY(0);
      }

      .trelk-inline-btn.url-btn::after {
        content: ' ↗';
        font-size: 11px;
      }

      /* === FOOTER INPUT === */
      .trelk-footer {
        padding: 16px 20px;
        background: var(--tr-bg);
        border-top: 1px solid var(--tr-border);
      }

      .trelk-input-wrapper {
        display: flex;
        align-items: flex-end;
        gap: 8px;
        background: var(--tr-bg-alt);
        border: 1px solid var(--tr-border);
        border-radius: 16px;
        padding: 8px;
        transition: border-color 0.2s;
      }

      .trelk-input-wrapper:focus-within {
        border-color: var(--tr-primary);
        box-shadow: 0 0 0 1px var(--tr-primary);
      }

      .trelk-input {
        flex: 1;
        background: transparent;
        border: none;
        color: var(--tr-text);
        padding: 8px 12px;
        font-size: 14px;
        resize: none;
        max-height: 100px;
        min-height: 24px;
        outline: none;
        font-family: inherit;
      }

      .trelk-send-btn {
        width: 32px;
        height: 32px;
        border-radius: 10px;
        background: var(--tr-primary);
        border: none;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
      }

      .trelk-send-btn:hover {
        opacity: 0.9;
        transform: scale(1.05);
      }

      .trelk-send-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2.5; }

      /* === POWERED BY === */
      .trelk-branding {
        text-align: center;
        padding: 8px;
        font-size: 10px;
        color: var(--tr-text-sec);
        background: var(--tr-bg);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .trelk-branding a { color: var(--tr-text-sec); text-decoration: none; font-weight: 600; }
      .trelk-branding a:hover { color: var(--tr-primary); }

      /* Mobile */
      @media (max-width: 480px) {
        #trelk-chat-window {
          width: 100vw;
          height: 100%;
          max-height: 100vh;
          bottom: 0;
          right: 0;
          left: 0;
          border-radius: 0;
        }
      }
    `;
    document.head.appendChild(styles);
  }

  // ============= DOM BUILDING =============
  function createWidget() {
    container = document.createElement("div");
    container.id = "trelk-chat-container";

    // 1. Bubble Launcher
    bubble = document.createElement("div");
    bubble.id = "trelk-chat-bubble";
    // Lucide MessageCircle Icon
    bubble.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
    `;
    bubble.onclick = toggleChat;

    // 2. Main Window
    chatWindow = document.createElement("div");
    chatWindow.id = "trelk-chat-window";
    
    // Header HTML
    const headerHtml = `
      <div class="trelk-header">
        <div class="trelk-brand">
          <div class="trelk-logo">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="trelk-title">
            <h3>${escapeHtml(config.headerText)}</h3>
            <div class="trelk-status">
              <span class="trelk-dot" id="trelk-status-dot"></span>
              <span id="trelk-status-text">En línea</span>
            </div>
          </div>
        </div>
        <div class="trelk-actions">
          <button class="trelk-btn-icon" id="trelk-close-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>
    `;

    // Body HTML
    const bodyHtml = `
      <div class="trelk-messages" id="trelk-messages">
        <div style="text-align: center; margin-top: auto; margin-bottom: 20px; opacity: 0.5;">
           <p style="font-size: 13px; color: var(--tr-text-sec);">${escapeHtml(config.welcomeMessage)}</p>
        </div>
      </div>
    `;

    // Footer HTML
    const footerHtml = `
      <div class="trelk-footer">
        <div class="trelk-input-wrapper">
          <textarea id="trelk-input" class="trelk-input" placeholder="${escapeHtml(config.inputPlaceholder)}" rows="1"></textarea>
          <button id="trelk-send-btn" class="trelk-send-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>
      </div>
      ${config.showPoweredBy ? '<div class="trelk-branding">Powered by <a href="https://trelk.site" target="_blank">Trelk</a></div>' : ''}
    `;

    chatWindow.innerHTML = headerHtml + bodyHtml + footerHtml;

    container.appendChild(chatWindow);
    container.appendChild(bubble);
    document.body.appendChild(container);

    // References
    messagesContainer = document.getElementById("trelk-messages");
    inputField = document.getElementById("trelk-input");
    sendBtn = document.getElementById("trelk-send-btn");

    // Listeners
    document.getElementById("trelk-close-btn").onclick = close;
    sendBtn.onclick = sendMessage;
    
    inputField.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    // Auto-resize textarea
    inputField.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = (this.scrollHeight) + "px";
      handleTyping();
    });
  }

  // ============= LOGIC =============

  function toggleChat() { isOpen ? close() : open(); }

  function open() {
    isOpen = true;
    chatWindow.classList.add("open");
    bubble.style.transform = "scale(0.9)";
    bubble.style.opacity = "0";
    setTimeout(() => bubble.style.display = 'none', 200); // Hide bubble for cleaner look
    
    unreadCount = 0;
    updateBadge();
    if (!socket) connectSocket();
    setTimeout(() => inputField?.focus(), 300);
  }

  function close() {
    isOpen = false;
    chatWindow.classList.remove("open");
    bubble.style.display = 'flex';
    setTimeout(() => {
       bubble.style.opacity = "1";
       bubble.style.transform = "scale(1)";
    }, 10);
  }

  function updateBadge() {
    const existing = bubble.querySelector(".badge");
    if (existing) existing.remove();
    if (unreadCount > 0) {
      const badge = document.createElement("div");
      badge.className = "badge";
      badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
      bubble.appendChild(badge);
    }
  }

  function addMessage(msg) {
    const isUser = msg.senderType === "user";
    const isSystem = msg.senderType === "system" || msg.senderType === "bot" && msg.contentType === "system";
    const row = document.createElement("div");
    
    // Determine message type
    if (isSystem) {
      row.className = 'trelk-message-row system';
    } else {
      row.className = `trelk-message-row ${isUser ? 'user' : 'agent'}`;
    }
    
    let html = '';
    
    // Avatar for agent (not for system or user)
    if (!isUser && !isSystem) {
      html += `<div class="trelk-avatar">${msg.senderName ? msg.senderName.charAt(0).toUpperCase() : 'AG'}</div>`;
    }

    html += `
      <div class="trelk-message-content">
        <div class="trelk-bubble">${escapeHtml(msg.content)}</div>
    `;
    
    // Handle inline keyboard (buttons) - support both old and new format
    // Old format: msg.keyboard.inline_keyboard
    // New format: msg.inlineKeyboard (from adapter)
    const inlineKeyboard = msg.inlineKeyboard || (msg.keyboard && msg.keyboard.inline_keyboard);
    if (inlineKeyboard && Array.isArray(inlineKeyboard)) {
      html += '<div class="trelk-buttons">';
      inlineKeyboard.forEach(buttonRow => {
        html += '<div class="trelk-button-row">';
        buttonRow.forEach(btn => {
          // Handle both formats: callbackData (new) or callback_data (old/Telegram)
          const callbackData = btn.callbackData || btn.callback_data;
          if (btn.url) {
            // URL button - opens link
            html += `<a href="${escapeHtml(btn.url)}" target="_blank" rel="noopener" class="trelk-inline-btn url-btn">${escapeHtml(btn.text)}</a>`;
          } else if (callbackData) {
            // Callback button - sends callback to server
            html += `<button class="trelk-inline-btn" data-callback="${escapeHtml(callbackData)}">${escapeHtml(btn.text)}</button>`;
          }
        });
        html += '</div>';
      });
      html += '</div>';
    }
    
    // Handle reply keyboard (quick replies) - support both old and new format
    // Old format: msg.keyboard.keyboard
    // New format: msg.replyKeyboard (from adapter)
    const replyKeyboard = msg.replyKeyboard || (msg.keyboard && msg.keyboard.keyboard);
    if (replyKeyboard && Array.isArray(replyKeyboard)) {
      html += '<div class="trelk-buttons">';
      replyKeyboard.forEach(buttonRow => {
        html += '<div class="trelk-button-row">';
        buttonRow.forEach(btn => {
          const text = typeof btn === 'string' ? btn : btn.text;
          html += `<button class="trelk-inline-btn" data-reply="${escapeHtml(text)}">${escapeHtml(text)}</button>`;
        });
        html += '</div>';
      });
      html += '</div>';
    }
    
    if (!isSystem) {
      html += `<div class="trelk-time" style="text-align: ${isUser ? 'right' : 'left'}">${formatTime(msg.timestamp)}</div>`;
    }
    
    html += '</div>';

    row.innerHTML = html;
    
    // Add click handlers for buttons
    row.querySelectorAll('.trelk-inline-btn[data-callback]').forEach(btn => {
      btn.addEventListener('click', () => {
        const callbackData = btn.dataset.callback;
        if (callbackData && socket) {
          socket.emit('web:button:click', { callbackData });
          // Optionally disable button after click
          btn.disabled = true;
          btn.style.opacity = '0.5';
        }
      });
    });
    
    row.querySelectorAll('.trelk-inline-btn[data-reply]').forEach(btn => {
      btn.addEventListener('click', () => {
        const replyText = btn.dataset.reply;
        if (replyText) {
          // Send as a regular message
          addMessage({ senderType: "user", content: replyText, timestamp: new Date() });
          if (socket) socket.emit("web:message:send", { content: replyText, contentType: "text" });
        }
      });
    });
    
    messagesContainer.appendChild(row);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (!isUser && !isSystem && !isOpen) {
      unreadCount++;
      updateBadge();
    }
  }

  function sendMessage() {
    const content = inputField.value.trim();
    if (!content) return;

    addMessage({ senderType: "user", content, timestamp: new Date() });
    inputField.value = "";
    inputField.style.height = "auto";

    if (socket) socket.emit("web:message:send", { content, contentType: "text" });
  }

  function handleTyping() {
    if (!socket || isTyping) return;
    isTyping = true;
    socket.emit("web:typing:start");
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      socket.emit("web:typing:stop");
    }, 2000);
  }

  // ============= SOCKET LOGIC =============
  function connectSocket() {
    const script = document.createElement("script");
    script.src = "https://cdn.socket.io/4.7.4/socket.io.min.js"; // Stable version
    script.onload = () => {
      socket = io(config.baseUrl, { path: "/webchat-socket", transports: ["websocket"] });
      
      socket.on("connect", () => {
        visitorId = getStoredVisitorId() || generateId();
        setStoredVisitorId(visitorId);
        socket.emit("web:connect", { visitorId, projectId: config.projectId, user: config.user });
        document.getElementById("trelk-status-dot").classList.remove("offline");
        document.getElementById("trelk-status-text").textContent = "En línea";
      });

      socket.on("web:message:new", addMessage);
      
      socket.on("disconnect", () => {
        document.getElementById("trelk-status-dot").classList.add("offline");
        document.getElementById("trelk-status-text").textContent = "Desconectado";
      });
    };
    document.head.appendChild(script);
  }

  // ============= PUBLIC API =============
  window.TrelkChat = {
    init(options) {
      if (!options.projectId) return console.error("TrelkChat: Project ID required");
      config = { ...DEFAULT_CONFIG, ...options };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { injectStyles(); createWidget(); });
      else { injectStyles(); createWidget(); }
    },
    open, close, toggle: toggleChat
  };

})();