/**
 * Support.io Widget
 * Embeddable customer support chat widget
 * Version: 2.0.0
 * Build: Feb 10, 2026 - Modern UI with FAQ and Multi-View System
 */

(function() {
  'use strict';

  const API_URL = 'http://localhost:5000';
  const SOCKET_URL = 'http://localhost:5000';

  class SupportIOWidget {
    constructor(config) {
      this.config = {
        siteKey: config.siteKey,
        position: config.position || 'bottom-right',
        primaryColor: config.primaryColor || '#4F46E5',
        brandName: config.brandName || 'Support',
        ...config
      };

      this.socket = null;
      this.conversationId = null;
      this.visitorId = this.getOrCreateVisitorId();
      this.isOpen = false;
      this.isMinimized = true;
      this.currentView = 'home'; // home, messages, help
      this.faqs = [];
      this.siteSettings = null;
      this.messagesEnabled = false;

      this.init();
    }

    init() {
      this.injectStyles();
      this.createWidget();
      this.loadSiteSettings();
      this.loadFAQs();
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

    adjustColor(color, amount) {
      return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
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
          width: 400px;
          height: 650px;
          background: #f8f9fa;
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
          background: linear-gradient(135deg, ${this.config.primaryColor} 0%, ${this.adjustColor(this.config.primaryColor, -20)} 100%);
          color: white;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .sc-header-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sc-header-logo {
          width: 40px;
          height: 40px;
          object-fit: contain;
        }
        .sc-header-text {
          flex: 1;
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
          flex-shrink: 0;
        }
        .sc-close-btn:hover {
          background: rgba(255,255,255,0.3);
        }

        /* Views Container */
        .sc-content {
          flex: 1;
          overflow: hidden;
          position: relative;
          background: #f8f9fa;
        }

        .sc-view {
          display: none;
          flex-direction: column;
          height: 100%;
          animation: fadeIn 0.3s ease-out;
        }
        .sc-view.active {
          display: flex;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        /* Home View */
        .sc-home-content {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }
        .sc-welcome {
          background: white;
          border-radius: 12px;
          padding: 24px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .sc-welcome h2 {
          font-size: 24px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 8px;
        }
        .sc-welcome p {
          font-size: 15px;
          color: #666;
          line-height: 1.5;
        }
        .sc-status-card {
          background: white;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .sc-status-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .sc-status-icon.online {
          background: #10b981;
        }
        .sc-status-icon.offline {
          background: #ef4444;
        }
        .sc-status-text {
          flex: 1;
        }
        .sc-status-title {
          font-size: 14px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 2px;
        }
        .sc-status-subtitle {
          font-size: 12px;
          color: #666;
        }
        .sc-quick-links {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .sc-quick-links h3 {
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 16px;
        }
        .sc-quick-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid #f0f0f0;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .sc-quick-link:last-child {
          border-bottom: none;
        }
        .sc-quick-link:hover {
          opacity: 0.7;
        }
        .sc-quick-link-text {
          font-size: 14px;
          color: #333;
        }
        .sc-quick-link-arrow {
          color: #999;
        }

        /* Help/FAQ View */
        .sc-help-content {
          flex: 1;
          overflow-y: auto;
        }
        .sc-search-box {
          padding: 16px 20px;
          background: white;
          border-bottom: 1px solid #e5e5e5;
        }
        .sc-search-input {
          width: 100%;
          padding: 12px 40px 12px 16px;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }
        .sc-search-input:focus {
          border-color: ${this.config.primaryColor};
        }
        .sc-faq-list {
          padding: 12px 20px;
        }
        .sc-faq-item {
          background: white;
          border-radius: 8px;
          margin-bottom: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .sc-faq-question {
          padding: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: space-between;
          transition: background 0.2s;
        }
        .sc-faq-question:hover {
          background: #f8f9fa;
        }
        .sc-faq-question-text {
          font-size: 14px;
          font-weight: 500;
          color: #1a1a1a;
          flex: 1;
        }
        .sc-faq-arrow {
          width: 16px;
          height: 16px;
          transition: transform 0.3s;
          color: #666;
        }
        .sc-faq-item.open .sc-faq-arrow {
          transform: rotate(180deg);
        }
        .sc-faq-answer {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease-out;
          padding: 0 16px;
          color: #666;
          font-size: 14px;
          line-height: 1.6;
        }
        .sc-faq-item.open .sc-faq-answer {
          max-height: 500px;
          padding: 0 16px 16px 16px;
        }
        .sc-no-faqs {
          text-align: center;
          padding: 60px 20px;
          color: #999;
        }

        /* Messages View */
        .sc-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #f8f9fa;
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

        .sc-disabled-message {
          text-align: center;
          padding: 60px 20px;
          color: #999;
        }
        .sc-disabled-message h3 {
          font-size: 18px;
          color: #666;
          margin-bottom: 8px;
        }
        .sc-disabled-message p {
          font-size: 14px;
        }

        /* Bottom Navigation */
        .sc-bottom-nav {
          display: flex;
          background: white;
          border-top: 1px solid #e5e5e5;
          padding: 8px 0;
        }
        .sc-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px;
          cursor: pointer;
          transition: all 0.2s;
          border: none;
          background: none;
          color: #666;
        }
        .sc-nav-item:hover {
          background: #f8f9fa;
        }
        .sc-nav-item.active {
          color: ${this.config.primaryColor};
        }
        .sc-nav-item.disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .sc-nav-item.disabled:hover {
          background: none;
        }
        .sc-nav-icon {
          width: 24px;
          height: 24px;
        }
        .sc-nav-label {
          font-size: 12px;
          font-weight: 500;
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
      
      const brandInitials = this.config.brandName.substring(0, 2).toUpperCase();
      
      container.innerHTML = `
        <div class="sc-chat-bubble" id="sc-bubble">
          <svg viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
          </svg>
        </div>

        <div class="sc-chat-window" id="sc-chat-window">
          <div class="sc-header">
            <div class="sc-header-info">
              <img src="http://localhost:5000/support.io_logo.webp" class="sc-header-logo" alt="${this.config.brandName}" />
              <div class="sc-header-text">
                <div class="sc-header-title">${this.config.brandName}</div>
                <div class="sc-header-subtitle">We're here to help!</div>
              </div>
            </div>
            <button class="sc-close-btn" id="sc-close">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                <path d="M15 1L1 15M1 1l14 14" stroke="currentColor" stroke-width="2"/>
              </svg>
            </button>
          </div>

          <div class="sc-content">
            <!-- Home View -->
            <div class="sc-view active" id="sc-view-home">
              <div class="sc-home-content">
                <div class="sc-welcome">
                  <h2>Hello! How can we help?</h2>
                  <p>Get quick answers or start a conversation with our team.</p>
                </div>

                <div class="sc-status-card">
                  <div class="sc-status-icon online"></div>
                  <div class="sc-status-text">
                    <div class="sc-status-title">Status: All Systems Operational</div>
                    <div class="sc-status-subtitle" id="sc-status-time">Updated recently</div>
                  </div>
                </div>

                <div class="sc-quick-links">
                  <h3>Quick Actions</h3>
                  <div class="sc-quick-link" data-link="help">
                    <div class="sc-quick-link-text">Browse Help Articles</div>
                    <div class="sc-quick-link-arrow">→</div>
                  </div>
                  <div class="sc-quick-link" data-link="messages">
                    <div class="sc-quick-link-text">Start a Conversation</div>
                    <div class="sc-quick-link-arrow">→</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Messages View -->
            <div class="sc-view" id="sc-view-messages">
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
            </div>

            <!-- Help/FAQ View -->
            <div class="sc-view" id="sc-view-help">
              <div class="sc-help-content">
                <div class="sc-search-box">
                  <input 
                    type="text" 
                    class="sc-search-input" 
                    id="sc-search-faq" 
                    placeholder="Search for help..."
                  />
                </div>
                <div class="sc-faq-list" id="sc-faq-list">
                  <!-- FAQs will be rendered here -->
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Navigation -->
          <div class="sc-bottom-nav">
            <button class="sc-nav-item active" data-view="home">
              <svg class="sc-nav-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
              <span class="sc-nav-label">Home</span>
            </button>
            <button class="sc-nav-item" id="sc-nav-messages" data-view="messages">
              <svg class="sc-nav-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
              </svg>
              <span class="sc-nav-label">Messages</span>
            </button>
            <button class="sc-nav-item" data-view="help">
              <svg class="sc-nav-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z"/>
              </svg>
              <span class="sc-nav-label">Help</span>
            </button>
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
        send: document.getElementById('sc-send'),
        viewHome: document.getElementById('sc-view-home'),
        viewMessages: document.getElementById('sc-view-messages'),
        viewHelp: document.getElementById('sc-view-help'),
        faqList: document.getElementById('sc-faq-list'),
        searchFaq: document.getElementById('sc-search-faq'),
        navMessages: document.getElementById('sc-nav-messages')
      };
    }

    setupEventListeners() {
      // Open/close chat
      this.elements.bubble.addEventListener('click', () => this.toggleChat());
      this.elements.close.addEventListener('click', () => this.toggleChat());

      // Bottom navigation
      const navItems = document.querySelectorAll('.sc-nav-item');
      navItems.forEach(item => {
        item.addEventListener('click', (e) => {
          const view = item.getAttribute('data-view');
          if (!item.classList.contains('disabled')) {
            this.switchView(view);
          }
        });
      });

      // Quick links
      const quickLinks = document.querySelectorAll('.sc-quick-link');
      quickLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          const target = link.getAttribute('data-link');
          this.switchView(target);
        });
      });

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

      // FAQ search
      if (this.elements.searchFaq) {
        this.elements.searchFaq.addEventListener('input', (e) => {
          this.filterFAQs(e.target.value);
        });
      }
    }

    toggleChat() {
      this.isOpen = !this.isOpen;
      
      if (this.isOpen) {
        this.elements.window.classList.add('open');
        this.elements.bubble.style.display = 'none';
        
        // Update status time
        const now = new Date();
        const timeString = now.toLocaleString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
        const statusTime = document.getElementById('sc-status-time');
        if (statusTime) {
          statusTime.textContent = `Updated ${timeString}`;
        }

        // Join conversation on first open if messages are enabled
        if (!this.conversationId && this.messagesEnabled) {
          this.joinConversation();
        }
      } else {
        this.elements.window.classList.remove('open');
        this.elements.bubble.style.display = 'flex';
      }
    }

    switchView(viewName) {
      // Check if messages view is disabled
      if (viewName === 'messages' && !this.messagesEnabled) {
        this.showDisabledMessage();
        return;
      }

      // Update active view
      const views = document.querySelectorAll('.sc-view');
      views.forEach(view => view.classList.remove('active'));
      
      const targetView = document.getElementById(`sc-view-${viewName}`);
      if (targetView) {
        targetView.classList.add('active');
      }

      // Update active nav item
      const navItems = document.querySelectorAll('.sc-nav-item');
      navItems.forEach(item => item.classList.remove('active'));
      
      const activeNav = document.querySelector(`.sc-nav-item[data-view="${viewName}"]`);
      if (activeNav) {
        activeNav.classList.add('active');
      }

      this.currentView = viewName;

      // Focus input if switching to messages
      if (viewName === 'messages' && this.messagesEnabled) {
        setTimeout(() => this.elements.input.focus(), 100);
      }
    }

    async loadSiteSettings() {
      try {
        const response = await fetch(`${API_URL}/api/widget/settings?siteKey=${this.config.siteKey}`);
        if (response.ok) {
          const data = await response.json();
          this.siteSettings = data.site;
          this.messagesEnabled = data.site.isActive || false;
          
          // Update messages nav based on availability
          if (!this.messagesEnabled) {
            this.elements.navMessages.classList.add('disabled');
          }
        }
      } catch (error) {
        console.error('Failed to load site settings:', error);
        this.messagesEnabled = false;
      }
    }

    async loadFAQs() {
      try {
        const response = await fetch(`${API_URL}/api/faqs/search?siteKey=${this.config.siteKey}`);
        if (response.ok) {
          const data = await response.json();
          this.faqs = data.faqs || [];
          this.renderFAQs(this.faqs);
        }
      } catch (error) {
        console.error('Failed to load FAQs:', error);
      }
    }

    renderFAQs(faqs) {
      if (!faqs || faqs.length === 0) {
        this.elements.faqList.innerHTML = `
          <div class="sc-no-faqs">
            <p>No help articles available at the moment.</p>
          </div>
        `;
        return;
      }

      this.elements.faqList.innerHTML = faqs.map((faq, index) => `
        <div class="sc-faq-item" data-faq-id="${index}">
          <div class="sc-faq-question">
            <div class="sc-faq-question-text">${this.escapeHtml(faq.question)}</div>
            <svg class="sc-faq-arrow" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </div>
          <div class="sc-faq-answer">${this.escapeHtml(faq.answer)}</div>
        </div>
      `).join('');

      // Add click handlers
      const faqItems = this.elements.faqList.querySelectorAll('.sc-faq-item');
      faqItems.forEach(item => {
        const question = item.querySelector('.sc-faq-question');
        question.addEventListener('click', () => {
          const isOpen = item.classList.contains('open');
          
          // Close all other items
          faqItems.forEach(i => i.classList.remove('open'));
          
          // Toggle current item
          if (!isOpen) {
            item.classList.add('open');
          }
        });
      });
    }

    filterFAQs(searchTerm) {
      if (!searchTerm || searchTerm.trim() === '') {
        this.renderFAQs(this.faqs);
        return;
      }

      const term = searchTerm.toLowerCase();
      const filtered = this.faqs.filter(faq => 
        faq.question.toLowerCase().includes(term) || 
        faq.answer.toLowerCase().includes(term) ||
        (faq.keywords && faq.keywords.some(k => k.toLowerCase().includes(term)))
      );

      this.renderFAQs(filtered);
    }

    showDisabledMessage() {
      // Show disabled message in messages view
      this.elements.messages.innerHTML = `
        <div class="sc-disabled-message">
          <h3>Messages Not Available</h3>
          <p>This feature is currently not active. Please check our Help section for answers to common questions.</p>
        </div>
      `;
      
      // Switch to messages view to show the message
      const views = document.querySelectorAll('.sc-view');
      views.forEach(view => view.classList.remove('active'));
      this.elements.viewMessages.classList.add('active');

      const navItems = document.querySelectorAll('.sc-nav-item');
      navItems.forEach(item => item.classList.remove('active'));
      this.elements.navMessages.classList.add('active');
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
          console.error('Support.io error:', data.message);
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
  function initSupportIO() {
    if (window.SupportIOConfig) {
      window.SupportIO = new SupportIOWidget(window.SupportIOConfig);
    } else {
      console.error('SupportIOConfig not found. Please configure the widget.');
    }
  }

  // Auto-initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupportIO);
  } else {
    initSupportIO();
  }

})();
