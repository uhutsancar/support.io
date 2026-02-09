/**
 * SupportChat Widget
 * Embeddable customer support chat widget
 * Version: 1.0.0
 */

(function() {
  'use strict';

  const API_URL = 'http://localhost:5000';
  const SOCKET_URL = 'http://localhost:5000';

  class SupportChatWidget {
    constructor(config) {
      this.config = {
        siteKey: config.siteKey,
        position: config.position || 'bottom-right',
        primaryColor: config.primaryColor || '#4F46E5',
        ...config
      };

      this.socket = null;
      this.conversationId = null;
      this.visitorId = this.getOrCreateVisitorId();
      this.isOpen = false;
      this.isMinimized = true;

      this.init();
    }

    init() {
      this.injectStyles();
      this.createWidget();
      this.connectSocket();
      this.setupEventListeners();
    }

    getOrCreateVisitorId() {
      let visitorId = localStorage.getItem('sc_visitor_id');
      if (!visitorId) {
        visitorId = 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('sc_visitor_id', visitorId);
      }
      return visitorId;
    }

    injectStyles() {
      const style = document.createElement('style');
      style.textContent = `
        .sc-widget-container {
          position: fixed;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        .sc-widget-container.bottom-right {
          bottom: 20px;
          right: 20px;
        }
        .sc-widget-container.bottom-left {
          bottom: 20px;
          left: 20px;
        }
        .sc-widget-container.top-right {
          top: 20px;
          right: 20px;
        }
        .sc-widget-container.top-left {
          top: 20px;
          left: 20px;
        }

        .sc-chat-bubble {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: ${this.config.primaryColor};
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .sc-chat-bubble:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0,0,0,0.2);
        }
        .sc-chat-bubble svg {
          width: 28px;
          height: 28px;
          fill: white;
        }

        .sc-chat-window {
          width: 380px;
          height: 600px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          display: none;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.3s ease-out;
        }
        .sc-chat-window.open {
          display: flex;
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .sc-header {
          background: ${this.config.primaryColor};
          color: white;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .sc-header-title {
          font-size: 18px;
          font-weight: 600;
        }
        .sc-header-subtitle {
          font-size: 13px;
          opacity: 0.9;
          margin-top: 2px;
        }
        .sc-close-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        .sc-close-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        .sc-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #f7f7f8;
        }
        .sc-message {
          margin-bottom: 16px;
          animation: messageIn 0.3s ease-out;
        }
        @keyframes messageIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .sc-message-content {
          max-width: 75%;
          padding: 12px 16px;
          border-radius: 12px;
          word-wrap: break-word;
          line-height: 1.4;
        }
        .sc-message.visitor .sc-message-content {
          background: ${this.config.primaryColor};
          color: white;
          margin-left: auto;
          border-bottom-right-radius: 4px;
        }
        .sc-message.agent .sc-message-content,
        .sc-message.bot .sc-message-content {
          background: white;
          color: #333;
          border-bottom-left-radius: 4px;
        }
        .sc-message-sender {
          font-size: 11px;
          color: #666;
          margin-bottom: 4px;
          font-weight: 500;
        }
        .sc-message-time {
          font-size: 11px;
          color: #999;
          margin-top: 4px;
        }

        .sc-typing {
          display: none;
          padding: 12px 16px;
          background: white;
          border-radius: 12px;
          width: fit-content;
          margin-bottom: 16px;
        }
        .sc-typing.active {
          display: block;
        }
        .sc-typing-dots {
          display: flex;
          gap: 4px;
        }
        .sc-typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #999;
          animation: bounce 1.4s infinite;
        }
        .sc-typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        .sc-typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }
        @keyframes bounce {
          0%, 60%, 100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-8px);
          }
        }

        .sc-input-container {
          padding: 16px;
          background: white;
          border-top: 1px solid #e5e5e5;
        }
        .sc-input-wrapper {
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }
        .sc-input {
          flex: 1;
          border: 1px solid #e5e5e5;
          border-radius: 20px;
          padding: 10px 16px;
          font-size: 14px;
          outline: none;
          resize: none;
          max-height: 100px;
          font-family: inherit;
        }
        .sc-input:focus {
          border-color: ${this.config.primaryColor};
        }
        .sc-send-btn {
          background: ${this.config.primaryColor};
          color: white;
          border: none;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
          flex-shrink: 0;
        }
        .sc-send-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }
        .sc-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .sc-send-btn svg {
          width: 20px;
          height: 20px;
          fill: white;
        }

        .sc-powered-by {
          text-align: center;
          padding: 8px;
          font-size: 11px;
          color: #999;
          background: #f7f7f8;
        }

        /* Mobile responsive */
        @media (max-width: 480px) {
          .sc-chat-window {
            width: 100vw;
            height: 100vh;
            border-radius: 0;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
          }
          .sc-widget-container {
            bottom: 16px;
            right: 16px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    createWidget() {
      const container = document.createElement('div');
      container.className = `sc-widget-container ${this.config.position}`;
      container.innerHTML = `
        <div class="sc-chat-bubble" id="sc-bubble">
          <svg viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
        </div>

        <div class="sc-chat-window" id="sc-chat-window">
          <div class="sc-header">
            <div>
              <div class="sc-header-title">Support Chat</div>
              <div class="sc-header-subtitle">We're here to help!</div>
            </div>
            <button class="sc-close-btn" id="sc-close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                <path d="M15 1L1 15M1 1l14 14" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </div>

          <div class="sc-messages" id="sc-messages">
            <!-- Messages will be appended here -->
          </div>

          <div class="sc-input-container">
            <div class="sc-input-wrapper">
              <textarea 
                class="sc-input" 
                id="sc-input" 
                placeholder="Type your message..."
                rows="1"
              ></textarea>
              <button class="sc-send-btn" id="sc-send">
                <svg viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              </button>
            </div>
          </div>

          <div class="sc-powered-by">
            Powered by SupportChat
          </div>
        </div>
      `;

      document.body.appendChild(container);

      this.elements = {
        bubble: document.getElementById('sc-bubble'),
        window: document.getElementById('sc-chat-window'),
        close: document.getElementById('sc-close'),
        messages: document.getElementById('sc-messages'),
        input: document.getElementById('sc-input'),
        send: document.getElementById('sc-send')
      };
    }

    setupEventListeners() {
      // Open/close chat
      this.elements.bubble.addEventListener('click', () => this.toggleChat());
      this.elements.close.addEventListener('click', () => this.toggleChat());

      // Send message
      this.elements.send.addEventListener('click', () => this.sendMessage());
      this.elements.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });

      // Typing indicator
      let typingTimeout;
      this.elements.input.addEventListener('input', () => {
        if (this.socket && this.conversationId) {
          clearTimeout(typingTimeout);
          this.socket.emit('typing');
          typingTimeout = setTimeout(() => {}, 1000);
        }
      });

      // Auto-resize textarea
      this.elements.input.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
      });
    }

    toggleChat() {
      this.isOpen = !this.isOpen;
      
      if (this.isOpen) {
        this.elements.window.classList.add('open');
        this.elements.bubble.style.display = 'none';
        this.elements.input.focus();

        // Join conversation on first open
        if (!this.conversationId) {
          this.joinConversation();
        }
      } else {
        this.elements.window.classList.remove('open');
        this.elements.bubble.style.display = 'flex';
      }
    }

    connectSocket() {
      // Load Socket.io client
      const script = document.createElement('script');
      script.src = 'https://cdn.socket.io/4.6.0/socket.io.min.js';
      script.onload = () => {
        this.socket = io(`${SOCKET_URL}/widget`);

        this.socket.on('connect', () => {
          this.joinConversation();
        });

        this.socket.on('conversation-joined', (data) => {
          this.conversationId = data.conversation._id;
          this.renderMessages(data.messages);
        });

        this.socket.on('new-message', (data) => {
          this.addMessage(data.message);
          this.scrollToBottom();
        });

        this.socket.on('agent-typing', () => {
          this.showTypingIndicator();
          setTimeout(() => this.hideTypingIndicator(), 3000);
        });

        this.socket.on('error', (data) => {
          console.error('SupportChat error:', data.message);
        });
      };
      document.head.appendChild(script);
    }

    joinConversation() {
      if (!this.socket) return;

      this.socket.emit('join-conversation', {
        siteKey: this.config.siteKey,
        visitorId: this.visitorId,
        visitorName: localStorage.getItem('sc_visitor_name') || 'Visitor',
        visitorEmail: localStorage.getItem('sc_visitor_email') || null,
        currentPage: window.location.pathname,
        metadata: {
          userAgent: navigator.userAgent,
          referrer: document.referrer,
          language: navigator.language
        }
      });
    }

    sendMessage() {
      const content = this.elements.input.value.trim();
      if (!content || !this.socket) return;

      this.socket.emit('send-message', {
        content,
        senderName: localStorage.getItem('sc_visitor_name') || 'You'
      });

      this.elements.input.value = '';
      this.elements.input.style.height = 'auto';
    }

    renderMessages(messages) {
      this.elements.messages.innerHTML = '';
      messages.forEach(msg => this.addMessage(msg));
      this.scrollToBottom();
    }

    addMessage(message) {
      const messageEl = document.createElement('div');
      messageEl.className = `sc-message ${message.senderType}`;
      
      const time = new Date(message.createdAt).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      messageEl.innerHTML = `
        ${message.senderType !== 'visitor' ? `<div class="sc-message-sender">${message.senderName}</div>` : ''}
        <div class="sc-message-content">${this.escapeHtml(message.content)}</div>
        <div class="sc-message-time">${time}</div>
      `;

      this.elements.messages.appendChild(messageEl);
    }

    showTypingIndicator() {
      let indicator = document.querySelector('.sc-typing');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'sc-typing';
        indicator.innerHTML = `
          <div class="sc-typing-dots">
            <div class="sc-typing-dot"></div>
            <div class="sc-typing-dot"></div>
            <div class="sc-typing-dot"></div>
          </div>
        `;
        this.elements.messages.appendChild(indicator);
      }
      indicator.classList.add('active');
      this.scrollToBottom();
    }

    hideTypingIndicator() {
      const indicator = document.querySelector('.sc-typing');
      if (indicator) {
        indicator.classList.remove('active');
      }
    }

    scrollToBottom() {
      this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  // Initialize widget
  function initSupportChat() {
    if (window.SupportChatConfig) {
      window.SupportChat = new SupportChatWidget(window.SupportChatConfig);
    } else {
      console.error('SupportChatConfig not found. Please configure the widget.');
    }
  }

  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupportChat);
  } else {
    initSupportChat();
  }

})();
