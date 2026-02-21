import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Paperclip, Image as ImageIcon } from 'lucide-react';

/**
 * Widget Preview Component
 * Mimics the actual widget behavior for live preview
 * Uses the same styling logic as the production widget
 */
const WidgetPreview = ({ config, isOpen = true, onToggle }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    
    const newMessage = {
      id: Date.now(),
      content: inputValue,
      senderType: 'visitor',
      senderName: 'You',
      createdAt: new Date()
    };
    
    setMessages([...messages, newMessage]);
    setInputValue('');
    
    // Simulate agent response
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const agentMessage = {
          id: Date.now() + 1,
          content: 'Thank you for your message! How can I help you today?',
          senderType: 'agent',
          senderName: config?.branding?.brandName || 'Support',
          createdAt: new Date()
        };
        setMessages(prev => [...prev, agentMessage]);
      }, 1500);
    }, 500);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getStyles = () => {
    const colors = config?.colors || {};
    const button = config?.button || {};
    const window = config?.window || {};
    const typography = config?.typography || {};
    const branding = config?.branding || {};
    
    const primaryColor = colors.primary || '#4F46E5';
    const headerColor = colors.header || primaryColor;
    const backgroundColor = colors.background || '#FFFFFF';
    const textColor = colors.text || '#1F2937';
    const textSecondaryColor = colors.textSecondary || '#6B7280';
    const borderColor = colors.border || '#E5E7EB';
    const visitorMsgBg = colors.visitorMessageBg || primaryColor;
    const agentMsgBg = colors.agentMessageBg || '#F3F4F6';
    
    return {
      button: {
        backgroundColor: primaryColor,
        borderRadius: button.borderRadius === 50 ? '50%' : `${button.borderRadius || 50}%`,
        boxShadow: button.shadow !== false ? `0 4px 12px ${button.shadowColor || 'rgba(0,0,0,0.15)'}` : 'none',
        width: button.size === 'small' ? '50px' : button.size === 'large' ? '70px' : '60px',
        height: button.size === 'small' ? '50px' : button.size === 'large' ? '70px' : '60px',
      },
      window: {
        width: `${window.width || 400}px`,
        height: `${window.height || 650}px`,
        borderRadius: `${window.borderRadius || 16}px`,
        fontFamily: typography.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      header: {
        backgroundColor: headerColor,
        height: `${window.headerHeight || 60}px`,
        color: '#FFFFFF',
        display: window.showHeader !== false ? 'flex' : 'none',
      },
      messageVisitor: {
        backgroundColor: visitorMsgBg,
        color: '#FFFFFF',
        borderRadius: `${config?.messages?.messageBubbleRadius || 12}px`,
      },
      messageAgent: {
        backgroundColor: agentMsgBg,
        color: textColor,
        borderRadius: `${config?.messages?.messageBubbleRadius || 12}px`,
      },
      input: {
        borderColor: borderColor,
        color: textColor,
        backgroundColor: backgroundColor,
      },
      sendButton: {
        backgroundColor: primaryColor,
      },
    };
  };

  const styles = getStyles();
  const colors = config?.colors || {};
  const branding = config?.branding || {};
  const button = config?.button || {};
  const messagesConfig = config?.messages || {};

  if (!isOpen) {
    return (
      <div 
        className="fixed z-50 transition-all duration-300"
        style={{
          [button.position?.includes('right') ? 'right' : 'left']: '20px',
          [button.position?.includes('bottom') ? 'bottom' : 'top']: '20px',
        }}
      >
        <button
          onClick={onToggle}
          className="flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
          style={styles.button}
        >
          <MessageSquare className="w-6 h-6 text-white" />
        </button>
      </div>
    );
  }

  return (
    <div 
      className="fixed z-50 flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300"
      style={{
        ...styles.window,
        [button.position?.includes('right') ? 'right' : 'left']: '20px',
        [button.position?.includes('bottom') ? 'bottom' : 'top']: '20px',
      }}
    >
      {/* Header */}
      {config?.window?.showHeader !== false && (
        <div 
          className="flex items-center justify-between px-4 py-3"
          style={styles.header}
        >
          <div className="flex items-center gap-3">
            {config?.branding?.logo && (
              <img 
                src={config.branding.logo.startsWith('http') 
                  ? config.branding.logo 
                  : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${config.branding.logo}`}
                alt="Logo"
                className="object-contain"
                style={{
                  width: config.branding.logoWidth || 40,
                  height: config.branding.logoHeight || 40,
                }}
              />
            )}
            {config?.branding?.showBrandName !== false && (
              <div>
                <div className="font-semibold text-sm">{config.branding.brandName || 'Support'}</div>
                <div className="text-xs opacity-90">Online</div>
              </div>
            )}
          </div>
          {config?.window?.showCloseButton !== false && (
            <button
              onClick={onToggle}
              className="p-1 rounded-full hover:bg-white/20 transition"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {/* Welcome Message */}
      {messages.length === 0 && config?.messages?.welcomeMessage && (
        <div className="px-4 py-6 text-center" style={{ color: colors.textSecondary || '#6B7280' }}>
          <p className="text-sm">{config.messages.welcomeMessage}</p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ backgroundColor: colors.background || '#FFFFFF' }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderType === 'visitor' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[75%] px-4 py-2 text-sm"
              style={msg.senderType === 'visitor' ? styles.messageVisitor : styles.messageAgent}
            >
              {config?.messages?.showAvatars !== false && msg.senderType === 'agent' && (
                <div className="text-xs mb-1 opacity-75">{msg.senderName}</div>
              )}
              <div>{msg.content}</div>
              {config?.messages?.showTimestamps !== false && (
                <div 
                  className="text-xs mt-1 opacity-60"
                  style={{ fontSize: '10px' }}
                >
                  {new Date(msg.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex justify-start">
            <div className="px-4 py-2 rounded-lg bg-gray-100">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3" style={{ borderColor: colors.border || '#E5E7EB' }}>
        <div className="flex items-end gap-2">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition">
            <Paperclip className="w-5 h-5" style={{ color: colors.textSecondary || '#6B7280' }} />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={config?.messages?.placeholderText || 'Type your message...'}
            className="flex-1 px-4 py-2 border rounded-lg outline-none focus:ring-2 transition"
            style={{
              ...styles.input,
              focusRingColor: colors.primary || '#4F46E5',
            }}
          />
          <button
            onClick={handleSend}
            className="p-2 rounded-lg transition hover:opacity-90"
            style={styles.sendButton}
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default WidgetPreview;
