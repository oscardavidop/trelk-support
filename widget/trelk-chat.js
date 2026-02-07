/**
 * Trelk WebChat Widget
 * Embeddable chat widget for websites
 *
 * Usage:
 * <script src="https://trelk.site/widget/trelk-chat.js"></script>
 * <script>
 *   TrelkChat.init({
 *     projectId: "your-project-id",
 *     user: { name: "User", email: "user@example.com" }
 *   });
 * </script>
 */

(function () {
  "use strict";

  // Prevent double initialization
  if (window.TrelkChat && window.TrelkChat._initialized) {
    console.warn("TrelkChat already initialized");
    return;
  }

  // Configuration
  const DEFAULT_CONFIG = {
    projectId: null,
    theme: "auto",
    position: "right",
    primaryColor: "#4F46E5",
    headerText: "Soporte en vivo",
    welcomeMessage: "¡Hola! 👋 ¿En qué podemos ayudarte?",
    offlineMessage: "No hay agentes disponibles.",
    inputPlaceholder: "Escribe un mensaje...",
    user: null,
    autoOpen: false,
    autoOpenDelay: 0,
    hideWhenOffline: false,
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
  let agentTyping = false;
  let assignedAgent = null;

  // DOM Elements
  let container = null;
  let bubble = null;
  let chatWindow = null;
  let messagesContainer = null;
  let inputField = null;

  // ============= UTILITIES =============

  function generateId() {
    return (
      "vis_" + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)
    );
  }

  function getStoredVisitorId() {
    try {
      return localStorage.getItem("trelk_visitor_id");
    } catch (e) {
      return null;
    }
  }

  function setStoredVisitorId(id) {
    try {
      localStorage.setItem("trelk_visitor_id", id);
    } catch (e) {}
  }

  function getTheme() {
    if (config.theme === "auto") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    return config.theme;
  }

  function formatTime(date) {
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function playNotificationSound() {
    if (!config.enableSoundNotifications) return;
    try {
      const audio = new Audio(
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleicBB5i7voN2B...",
      ); // Short beep
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {}
  }

  // ============= STYLES =============

  function injectStyles() {
    if (document.getElementById("trelk-chat-styles")) return;

    const isDark = getTheme() === "dark";
    const primaryColor = config.primaryColor;
    const position = config.position;

    const styles = document.createElement("style");
    styles.id = "trelk-chat-styles";
    styles.textContent = `
      #trelk-chat-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        position: fixed;
        bottom: 20px;
        ${position}: 20px;
        z-index: ${config.zIndex};
      }

      #trelk-chat-container * {
        box-sizing: border-box;
      }

      /* Bubble */
      #trelk-chat-bubble {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: ${primaryColor};
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s, box-shadow 0.2s;
      }

      #trelk-chat-bubble:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 25px rgba(0, 0, 0, 0.3);
      }

      #trelk-chat-bubble svg {
        width: 28px;
        height: 28px;
        fill: white;
      }

      #trelk-chat-bubble .badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background: #ef4444;
        color: white;
        font-size: 12px;
        font-weight: bold;
        min-width: 20px;
        height: 20px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 6px;
      }

      /* Chat Window */
      #trelk-chat-window {
        position: absolute;
        bottom: 75px;
        ${position}: 0;
        width: 380px;
        max-width: calc(100vw - 40px);
        height: 600px;
        max-height: calc(100vh - 120px);
        background: ${isDark ? "#18181b" : "#ffffff"};
        border-radius: 16px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        display: none;
        flex-direction: column;
        overflow: hidden;
        animation: trelk-slide-up 0.3s ease;
      }

      #trelk-chat-window.open {
        display: flex;
      }

      @keyframes trelk-slide-up {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      /* Header */
      .trelk-header {
        background: ${primaryColor};
        color: white;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .trelk-header-title {
        font-size: 16px;
        font-weight: 600;
      }

      .trelk-header-subtitle {
        font-size: 12px;
        opacity: 0.9;
        margin-top: 2px;
      }

      .trelk-header-close {
        background: rgba(255,255,255,0.2);
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s;
      }

      .trelk-header-close:hover {
        background: rgba(255,255,255,0.3);
      }

      .trelk-header-close svg {
        width: 16px;
        height: 16px;
        fill: white;
      }

      /* Messages */
      .trelk-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: ${isDark ? "#09090b" : "#f4f4f5"};
      }

      .trelk-message {
        max-width: 85%;
        margin-bottom: 12px;
        animation: trelk-fade-in 0.2s ease;
      }

      @keyframes trelk-fade-in {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .trelk-message.user {
        margin-left: auto;
      }

      .trelk-message.agent {
        margin-right: auto;
      }

      .trelk-message-content {
        padding: 10px 14px;
        border-radius: 16px;
        word-wrap: break-word;
      }

      .trelk-message.user .trelk-message-content {
        background: ${primaryColor};
        color: white;
        border-bottom-right-radius: 4px;
      }

      .trelk-message.agent .trelk-message-content {
        background: ${isDark ? "#27272a" : "#ffffff"};
        color: ${isDark ? "#fafafa" : "#18181b"};
        border-bottom-left-radius: 4px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .trelk-message-time {
        font-size: 11px;
        color: ${isDark ? "#71717a" : "#a1a1aa"};
        margin-top: 4px;
        display: block;
      }

      .trelk-message.user .trelk-message-time {
        text-align: right;
      }

      /* Typing indicator */
      .trelk-typing {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 14px;
        background: ${isDark ? "#27272a" : "#ffffff"};
        border-radius: 16px;
        width: fit-content;
        margin-bottom: 12px;
      }

      .trelk-typing-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: ${isDark ? "#71717a" : "#a1a1aa"};
        animation: trelk-bounce 1.4s infinite ease-in-out;
      }

      .trelk-typing-dot:nth-child(1) { animation-delay: 0s; }
      .trelk-typing-dot:nth-child(2) { animation-delay: 0.2s; }
      .trelk-typing-dot:nth-child(3) { animation-delay: 0.4s; }

      @keyframes trelk-bounce {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-6px); }
      }

      /* Input */
      .trelk-input-container {
        padding: 12px 16px;
        background: ${isDark ? "#18181b" : "#ffffff"};
        border-top: 1px solid ${isDark ? "#27272a" : "#e4e4e7"};
        display: flex;
        gap: 10px;
        align-items: flex-end;
      }

      .trelk-input {
        flex: 1;
        border: 1px solid ${isDark ? "#3f3f46" : "#e4e4e7"};
        background: ${isDark ? "#27272a" : "#fafafa"};
        color: ${isDark ? "#fafafa" : "#18181b"};
        border-radius: 20px;
        padding: 10px 16px;
        font-size: 14px;
        outline: none;
        resize: none;
        max-height: 120px;
        min-height: 40px;
        transition: border-color 0.2s;
      }

      .trelk-input:focus {
        border-color: ${primaryColor};
      }

      .trelk-input::placeholder {
        color: ${isDark ? "#71717a" : "#a1a1aa"};
      }

      .trelk-send-btn {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: ${primaryColor};
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: transform 0.2s, opacity 0.2s;
      }

      .trelk-send-btn:hover {
        transform: scale(1.05);
      }

      .trelk-send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .trelk-send-btn svg {
        width: 18px;
        height: 18px;
        fill: white;
      }

      /* Welcome message */
      .trelk-welcome {
        text-align: center;
        padding: 20px;
        color: ${isDark ? "#a1a1aa" : "#71717a"};
      }

      .trelk-welcome-icon {
        width: 48px;
        height: 48px;
        margin: 0 auto 12px;
        background: ${primaryColor}20;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .trelk-welcome-icon svg {
        width: 24px;
        height: 24px;
        fill: ${primaryColor};
      }

      /* Powered by */
      .trelk-powered {
        text-align: center;
        padding: 8px;
        font-size: 11px;
        color: ${isDark ? "#52525b" : "#a1a1aa"};
        background: ${isDark ? "#18181b" : "#ffffff"};
      }

      .trelk-powered a {
        color: ${primaryColor};
        text-decoration: none;
      }

      /* Survey Modal */
      .trelk-survey {
        position: absolute;
        inset: 0;
        background: ${isDark ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.5)"};
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }

      .trelk-survey-content {
        background: ${isDark ? "#18181b" : "#ffffff"};
        border-radius: 16px;
        padding: 24px;
        text-align: center;
        max-width: 320px;
      }

      .trelk-survey-title {
        font-size: 16px;
        font-weight: 600;
        color: ${isDark ? "#fafafa" : "#18181b"};
        margin-bottom: 16px;
      }

      .trelk-survey-stars {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-bottom: 16px;
      }

      .trelk-survey-star {
        width: 40px;
        height: 40px;
        cursor: pointer;
        transition: transform 0.2s;
      }

      .trelk-survey-star:hover {
        transform: scale(1.2);
      }

      .trelk-survey-star svg {
        width: 100%;
        height: 100%;
        fill: ${isDark ? "#3f3f46" : "#e4e4e7"};
        transition: fill 0.2s;
      }

      .trelk-survey-star.active svg {
        fill: #fbbf24;
      }

      .trelk-survey-comment {
        width: 100%;
        border: 1px solid ${isDark ? "#3f3f46" : "#e4e4e7"};
        background: ${isDark ? "#27272a" : "#fafafa"};
        color: ${isDark ? "#fafafa" : "#18181b"};
        border-radius: 8px;
        padding: 10px;
        font-size: 14px;
        resize: none;
        height: 80px;
        margin-bottom: 16px;
      }

      .trelk-survey-submit {
        width: 100%;
        background: ${primaryColor};
        color: white;
        border: none;
        border-radius: 8px;
        padding: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.2s;
      }

      .trelk-survey-submit:hover {
        opacity: 0.9;
      }

      /* Offline state */
      .trelk-offline-banner {
        background: #fef3c7;
        color: #92400e;
        padding: 10px 16px;
        font-size: 13px;
        text-align: center;
      }

      /* Mobile responsive */
      @media (max-width: 480px) {
        #trelk-chat-window {
          width: calc(100vw - 20px);
          height: calc(100vh - 100px);
          bottom: 70px;
          ${position}: 10px;
          border-radius: 12px;
        }

        #trelk-chat-bubble {
          width: 54px;
          height: 54px;
        }
      }
    `;
    document.head.appendChild(styles);
  }

  // ============= DOM CREATION =============

  function createWidget() {
    // Container
    container = document.createElement("div");
    container.id = "trelk-chat-container";

    // Bubble
    bubble = document.createElement("div");
    bubble.id = "trelk-chat-bubble";
    bubble.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
      </svg>
    `;
    bubble.onclick = toggleChat;

    // Chat Window
    chatWindow = document.createElement("div");
    chatWindow.id = "trelk-chat-window";
    chatWindow.innerHTML = `
      <div class="trelk-header">
        <div>
          <div class="trelk-header-title">${escapeHtml(config.headerText)}</div>
          <div class="trelk-header-subtitle">${isOnline ? "En línea" : "Fuera de línea"}</div>
        </div>
        <button class="trelk-header-close" onclick="TrelkChat.close()">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
        </button>
      </div>
      ${!isOnline ? '<div class="trelk-offline-banner">' + escapeHtml(config.offlineMessage) + "</div>" : ""}
      <div class="trelk-messages" id="trelk-messages">
        <div class="trelk-welcome">
          <div class="trelk-welcome-icon">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
          </div>
          <p>${escapeHtml(config.welcomeMessage)}</p>
        </div>
      </div>
      <div class="trelk-input-container">
        <textarea class="trelk-input" id="trelk-input" placeholder="${escapeHtml(config.inputPlaceholder)}" rows="1"></textarea>
        <button class="trelk-send-btn" id="trelk-send-btn">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      ${config.showPoweredBy ? '<div class="trelk-powered">Powered by <a href="https://trelk.site" target="_blank">Trelk</a></div>' : ""}
    `;

    container.appendChild(bubble);
    container.appendChild(chatWindow);
    document.body.appendChild(container);

    // Get references
    messagesContainer = document.getElementById("trelk-messages");
    inputField = document.getElementById("trelk-input");

    // Event listeners
    document.getElementById("trelk-send-btn").onclick = sendMessage;
    inputField.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    inputField.addEventListener("input", handleTyping);
  }

  // ============= CHAT FUNCTIONS =============

  function toggleChat() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  function open() {
    isOpen = true;
    chatWindow.classList.add("open");
    unreadCount = 0;
    updateBadge();
    inputField?.focus();

    // Connect socket if not connected
    if (!socket) {
      connectSocket();
    }
  }

  function close() {
    isOpen = false;
    chatWindow.classList.remove("open");
  }

  function updateBadge() {
    const existingBadge = bubble.querySelector(".badge");
    if (existingBadge) existingBadge.remove();

    if (unreadCount > 0 && !isOpen) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
      bubble.appendChild(badge);
    }
  }

  function addMessage(msg) {
    messages.push(msg);

    // Remove welcome message
    const welcome = messagesContainer.querySelector(".trelk-welcome");
    if (welcome) welcome.remove();

    const msgEl = document.createElement("div");
    msgEl.className = `trelk-message ${msg.senderType === "user" ? "user" : "agent"}`;
    msgEl.innerHTML = `
      <div class="trelk-message-content">${escapeHtml(msg.content)}</div>
      <span class="trelk-message-time">${formatTime(msg.timestamp)}</span>
    `;

    messagesContainer.appendChild(msgEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (msg.senderType !== "user") {
      unreadCount++;
      updateBadge();
      playNotificationSound();
    }
  }

  function sendMessage() {
    const content = inputField.value.trim();
    if (!content) return;

    // Add to UI immediately
    addMessage({
      senderType: "user",
      content,
      timestamp: new Date().toISOString(),
    });

    // Clear input
    inputField.value = "";
    inputField.style.height = "auto";

    // Send via socket
    if (socket) {
      socket.emit("web:message:send", {
        content,
        contentType: "text",
      });
    }
  }

  function handleTyping() {
    if (!socket) return;

    if (!isTyping) {
      isTyping = true;
      socket.emit("web:typing:start");
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      isTyping = false;
      socket.emit("web:typing:stop");
    }, 2000);
  }

  function showTypingIndicator() {
    if (messagesContainer.querySelector(".trelk-typing")) return;

    const typing = document.createElement("div");
    typing.className = "trelk-typing";
    typing.innerHTML = `
      <div class="trelk-typing-dot"></div>
      <div class="trelk-typing-dot"></div>
      <div class="trelk-typing-dot"></div>
    `;
    messagesContainer.appendChild(typing);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function hideTypingIndicator() {
    const typing = messagesContainer.querySelector(".trelk-typing");
    if (typing) typing.remove();
  }

  // ============= SOCKET CONNECTION =============

  function connectSocket() {
    // Load Socket.IO client
    const script = document.createElement("script");
    // modedule type
    script.src = "https://cdn.socket.io/4.8.3/socket.io.min.js";
    script.onload = () => {
      initSocket();
    };
    document.head.appendChild(script);
  }

  function initSocket() {
    socket = io("https://s.trelk.site", {
      path: "/webchat-socket",
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      // Get or generate visitor ID
      visitorId = getStoredVisitorId() || generateId();
      setStoredVisitorId(visitorId);

      // Send connection data
      socket.emit("web:connect", {
        visitorId,
        projectId: config.projectId,
        user: config.user,
        pageUrl: window.location.href,
        pageTitle: document.title,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
      });
    });

    socket.on("web:connected", (data) => {
      sessionId = data.sessionId;
      isOnline = data.isOnline;

      // Load existing messages
      if (data.existingMessages) {
        data.existingMessages.forEach((msg) => {
          addMessage(msg);
        });
      }

      // Show agent if assigned
      if (data.agent) {
        assignedAgent = data.agent;
      }
    });

    socket.on("web:message:new", (msg) => {
      addMessage(msg);
      hideTypingIndicator();
    });

    socket.on("web:typing:agent", (data) => {
      showTypingIndicator();
    });

    socket.on("web:typing:stop", () => {
      hideTypingIndicator();
    });

    socket.on("web:agent:assigned", (data) => {
      assignedAgent = data;
      // Could show a system message
    });

    socket.on("web:chat:closed", (data) => {
      // Show chat closed message
      addMessage({
        senderType: "system",
        content: data.message || "El chat ha sido cerrado.",
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("web:survey:request", (data) => {
      showSurvey(data);
    });

    socket.on("disconnect", () => {
      // Reconnect logic handled by Socket.IO
    });
  }

  // ============= SURVEY =============

  let surveyRating = 0;

  function showSurvey(data) {
    const surveyHtml = `
      <div class="trelk-survey" id="trelk-survey">
        <div class="trelk-survey-content">
          <div class="trelk-survey-title">${escapeHtml(data.question)}</div>
          <div class="trelk-survey-stars">
            ${[1, 2, 3, 4, 5]
              .map(
                (i) => `
              <div class="trelk-survey-star" data-rating="${i}">
                <svg viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
              </div>
            `,
              )
              .join("")}
          </div>
          <textarea class="trelk-survey-comment" id="trelk-survey-comment" placeholder="Comentario opcional..."></textarea>
          <button class="trelk-survey-submit" id="trelk-survey-submit">Enviar</button>
        </div>
      </div>
    `;

    chatWindow.insertAdjacentHTML("beforeend", surveyHtml);

    // Star click handlers
    document.querySelectorAll(".trelk-survey-star").forEach((star) => {
      star.onclick = () => {
        surveyRating = parseInt(star.dataset.rating);
        document.querySelectorAll(".trelk-survey-star").forEach((s, i) => {
          s.classList.toggle("active", i < surveyRating);
        });
      };
    });

    // Submit handler
    document.getElementById("trelk-survey-submit").onclick = () => {
      if (surveyRating === 0) return;

      const comment = document.getElementById("trelk-survey-comment").value;
      socket.emit("web:survey:submit", { rating: surveyRating, comment });
      document.getElementById("trelk-survey").remove();
    };
  }

  // ============= PUBLIC API =============

  window.TrelkChat = {
    _initialized: false,

    init(options) {
      if (this._initialized) {
        console.warn("TrelkChat already initialized");
        return;
      }

      if (!options.projectId) {
        console.error("TrelkChat: projectId is required");
        return;
      }

      config = { ...DEFAULT_CONFIG, ...options };

      // Wait for DOM
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
          this._setup();
        });
      } else {
        this._setup();
      }
    },

    _setup() {
      injectStyles();
      createWidget();
      this._initialized = true;

      // Auto open if configured
      if (config.autoOpen && config.autoOpenDelay > 0) {
        setTimeout(() => open(), config.autoOpenDelay);
      } else if (config.autoOpen) {
        open();
      }

      // Track page changes (SPA support)
      let lastUrl = window.location.href;
      setInterval(() => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          if (socket) {
            socket.emit("web:page:change", {
              url: window.location.href,
              title: document.title,
            });
          }
        }
      }, 1000);
    },

    open() {
      open();
    },

    close() {
      close();
    },

    toggle() {
      toggleChat();
    },

    setUser(user) {
      config.user = user;
      if (socket && visitorId) {
        socket.emit("web:user:update", user);
      }
    },

    sendMessage(content) {
      if (!content) return;
      inputField.value = content;
      sendMessage();
    },

    destroy() {
      if (socket) {
        socket.disconnect();
        socket = null;
      }
      if (container) {
        container.remove();
        container = null;
      }
      this._initialized = false;
    },
  };
})();
