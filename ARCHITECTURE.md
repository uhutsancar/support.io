# SupportChat System Architecture

## 🏗️ System Overview

```
┌─────────────────┐
│  Visitor's      │
│  Website        │
│  (Widget)       │
└────────┬────────┘
         │
         │ WebSocket
         │
┌────────▼────────────────────────────────────────────┐
│                                                      │
│            Backend Server (Express.js)               │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   REST API   │  │   Socket.IO  │  │  MongoDB  │ │
│  │              │  │              │  │           │ │
│  │ - Auth       │  │ - Widget NS  │  │ - Sites   │ │
│  │ - Sites      │  │ - Admin NS   │  │ - Users   │ │
│  │ - FAQs       │  │              │  │ - Convos  │ │
│  │ - Convos     │  │              │  │ - Messages│ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│                                                      │
└───────────────────────┬──────────────────────────────┘
                        │
                        │ REST + WebSocket
                        │
┌───────────────────────▼──────────────────────────────┐
│                                                       │
│          Admin Panel (React)                          │
│                                                       │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ Dashboard  │  │ Sites Mgmt │  │ Live Chat  │    │
│  └────────────┘  └────────────┘  └────────────┘    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │ FAQs       │  │ Agents     │  │ Analytics  │    │
│  └────────────┘  └────────────┘  └────────────┘    │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow

### 1. Widget Integration
```
Website Owner → Admin Panel → Create Site → Get Site Key → Embed Widget
```

### 2. Visitor Starts Chat
```
1. Visitor opens website
2. Widget loads with site key
3. Widget connects to backend via WebSocket
4. Backend validates site key
5. Create/retrieve conversation
6. Load conversation history
7. Display chat interface
```

### 3. Message Flow
```
Visitor sends message
    ↓
Widget emits via WebSocket
    ↓
Backend receives message
    ↓
Save to MongoDB
    ↓
Search for FAQ match
    ↓
Emit to visitor (echo) + admin (notification)
    ↓
If FAQ found → Auto-respond
```

### 4. Agent Response
```
Agent types in admin panel
    ↓
Send via WebSocket
    ↓
Backend receives
    ↓
Save to MongoDB
    ↓
Emit to visitor + other agents
    ↓
Visitor receives in widget
```

---

## 📦 Database Schema

### Site Collection
```javascript
{
  _id: ObjectId,
  name: String,
  domain: String,
  siteKey: String (unique),
  userId: ObjectId (ref: User),
  widgetSettings: {
    position: String,
    primaryColor: String,
    welcomeMessage: String,
    ...
  },
  aiSettings: {
    enabled: Boolean,
    fallbackToHuman: Boolean
  },
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Conversation Collection
```javascript
{
  _id: ObjectId,
  siteId: ObjectId (ref: Site),
  visitorId: String,
  visitorName: String,
  visitorEmail: String,
  assignedAgent: ObjectId (ref: User),
  status: 'open' | 'assigned' | 'resolved' | 'closed',
  currentPage: String,
  metadata: {
    userAgent: String,
    ip: String,
    referrer: String
  },
  lastMessageAt: Date,
  createdAt: Date,
  updatedAt: Date
}
```

### Message Collection
```javascript
{
  _id: ObjectId,
  conversationId: ObjectId (ref: Conversation),
  senderType: 'visitor' | 'agent' | 'bot',
  senderId: String,
  senderName: String,
  content: String,
  messageType: 'text' | 'image' | 'file',
  isRead: Boolean,
  readAt: Date,
  createdAt: Date
}
```

### FAQ Collection
```javascript
{
  _id: ObjectId,
  siteId: ObjectId (ref: Site),
  question: String,
  answer: String,
  category: String,
  keywords: [String],
  pageSpecific: String,
  isActive: Boolean,
  viewCount: Number,
  helpfulCount: Number,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔌 WebSocket Events

### Widget Namespace (`/widget`)

**Client → Server**
- `join-conversation` - Join/create conversation
- `send-message` - Send chat message
- `typing` - Typing indicator

**Server → Client**
- `conversation-joined` - Conversation data + history
- `new-message` - New message received
- `agent-typing` - Agent is typing
- `error` - Error occurred

### Admin Namespace (`/admin`)

**Client → Server**
- `join-site` - Subscribe to site updates
- `join-conversation` - Join specific conversation
- `send-message` - Send message to visitor
- `typing` - Typing indicator

**Server → Client**
- `conversation-update` - New/updated conversation
- `new-message` - New message in conversation
- `visitor-typing` - Visitor is typing
- `error` - Error occurred

---

## 🎯 Key Features Implementation

### 1. Site Verification
```javascript
// Every widget connection validates site key
const site = await Site.findOne({ 
  siteKey, 
  isActive: true 
});
if (!site) throw new Error('Invalid site');
```

### 2. Visitor Identification
```javascript
// Persistent visitor ID in localStorage
let visitorId = localStorage.getItem('sc_visitor_id');
if (!visitorId) {
  visitorId = generateUniqueId();
  localStorage.setItem('sc_visitor_id', visitorId);
}
```

### 3. FAQ Auto-Response
```javascript
// Text search with scoring
const faqs = await FAQ.find({
  siteId,
  isActive: true,
  $text: { $search: userMessage }
}, {
  score: { $meta: 'textScore' }
}).sort({ score: { $meta: 'textScore' } });

if (faqs[0].score > 0.5) {
  sendAutoResponse(faqs[0].answer);
}
```

### 4. Real-time Sync
```javascript
// Room-based broadcasting
socket.join(`conversation:${conversationId}`);
io.to(`conversation:${conversationId}`).emit('new-message', data);
```

---

## 🔐 Security Measures

1. **JWT Authentication** for admin panel
2. **Site Key Validation** for widget connections
3. **CORS Configuration** for API access
4. **Input Sanitization** to prevent XSS
5. **Rate Limiting** (to be added)
6. **Message Encryption** (future enhancement)

---

## ⚡ Performance Optimizations

1. **MongoDB Indexes**
   - `siteKey` (unique)
   - `conversationId + createdAt` for messages
   - Text index on FAQ questions/answers

2. **WebSocket Rooms**
   - Efficient broadcasting to specific conversations
   - Site-level rooms for admin notifications

3. **Lazy Loading**
   - Messages loaded on-demand
   - Conversations paginated

4. **Caching** (future)
   - Redis for session storage
   - FAQ cache for fast lookup

---

## 🔮 Future Enhancements

### Phase 2
- [ ] File/Image uploads in chat
- [ ] Typing indicator improvements
- [ ] Read receipts
- [ ] Agent status (online/offline/busy)
- [ ] Conversation tags and filters

### Phase 3
- [ ] AI chatbot integration (GPT-4)
- [ ] Sentiment analysis
- [ ] CSAT surveys
- [ ] Email notifications
- [ ] Mobile apps (React Native)

### Phase 4
- [ ] Video chat
- [ ] Screen sharing
- [ ] Co-browsing
- [ ] Advanced analytics
- [ ] Multi-language support

---

## 📊 Scalability Considerations

### Current (MVP)
- Single server
- MongoDB on same machine
- Handles ~100 concurrent connections

### Production
- Load balancer
- Multiple backend instances
- MongoDB replica set
- Redis for session/socket state
- CDN for widget.js
- Handles ~10,000+ concurrent connections

### Scaling Path
```
Step 1: Separate MongoDB → Cloud MongoDB Atlas
Step 2: Add Redis → Socket.io adapter
Step 3: Multiple servers → Load balancer
Step 4: CDN → Serve widget globally
Step 5: Microservices → Split concerns
```

---

## 🎨 Widget Customization Options

```javascript
window.SupportChatConfig = {
  // Required
  siteKey: 'xxx',
  
  // Appearance
  position: 'bottom-right',
  primaryColor: '#4F46E5',
  
  // Behavior
  autoOpen: false,
  autoOpenDelay: 5000,
  
  // Messages
  welcomeMessage: 'Hi! How can we help?',
  placeholderText: 'Type your message...',
  
  // Advanced (future)
  showOnPages: ['/pricing', '/contact'],
  hideOnPages: ['/checkout'],
  locale: 'en',
  customCSS: 'custom-widget.css'
}
```

---

This is a production-ready architecture that can scale from small websites to enterprise-level support systems! 🚀
