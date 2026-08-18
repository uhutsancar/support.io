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
│  │   REST API   │  │   Socket.IO  │  │ PostgreSQL│ │
│  │              │  │              │  │           │ │
│  │ - Auth       │  │ - Widget NS  │  │ - sites   │ │
│  │ - Sites      │  │ - Admin NS   │  │ - users   │ │
│  │ - FAQs       │  │              │  │ - convos  │ │
│  │ - Convos     │  │              │  │ - messages│ │
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
Save to PostgreSQL
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
Save to PostgreSQL
    ↓
Emit to visitor + other agents
    ↓
Visitor receives in widget
```

---

## 📦 Database Schema

PostgreSQL. The full DDL lives in `backend/src/db/schema.sql`; each table is
declared to the model runtime under `backend/src/models/`.

Primary keys are 24-character hexadecimal strings, carried over unchanged from
the identifiers the previous document store used, so existing tokens and links
keep working.

### Core tables

| Table | Purpose | Notable columns |
| --- | --- | --- |
| `organizations` | Tenant, plan and owner | `plan_type`, `owner_user_id` |
| `users` | Accounts created by sign-up | `email` (unique), `role`, `organization_id` |
| `teams` | Agents created from the admin panel | `email` (unique), `skills`, `current_load`, `max_capacity` |
| `sites` | Installed widgets | `site_key` (unique), `widget_settings`, `ai_settings` |
| `departments` | Routing groups per site | `business_hours`, `sla`, `stats` |
| `conversations` | Tickets | `ticket_number` (unique), `status`, `priority`, `sla`, `tags` |
| `messages` | Chat transcript | `sender_type`, `file_data`, `is_read` |
| `faqs` | Auto-answer knowledge base | `search_vector` (generated tsvector) |
| `visitors` | Live visitor presence | `visitor_id`, `last_active_at` |
| `widget_configs` | Appearance per site | one row per site |
| `deals` | CRM pipeline | `stage`, `value` |
| `audit_logs` | Append-only trail | updates blocked by a trigger |
| `team_chats`, `team_messages` | Internal chat | `chat_id` (unique on chats) |
| `automation_rules`, `automation_logs` | Rule engine | rule bodies stored as JSONB |
| `proactive_rules`, `proactive_trigger_logs`, `event_logs` | Proactive engagement | 30 day retention sweep |
| `counters` | Sequential ticket numbers | atomic upsert |

### Arrays that became their own tables

Embedded arrays that carry relationships are stored relationally:

| Previous embedded array | Table |
| --- | --- |
| `user.assignedSites`, `team.assignedSites` | `user_assigned_sites`, `team_assigned_sites` |
| `user.departments`, `team.departments` | `user_departments`, `team_departments` |
| `department.members` | `department_members` |
| `conversation.internalNotes` | `conversation_internal_notes` |
| `teamChat.participants` | `team_chat_participants` |
| `teamMessage.readBy`, `teamMessage.participants` | `team_message_read_by`, `team_message_participants` |

Configuration objects with no independent identity — widget colours, SLA targets,
permissions, statistics, business hours, rule bodies — stay in `jsonb` columns and
are read and written as a whole. Plain value lists such as `tags`, `skills` and
`keywords` use native `text[]` columns.

### Referential rules

- Deleting a site cascades to its departments, conversations, FAQs, visitors,
  widget config and rules. Deleting a conversation cascades to its messages and
  internal notes.
- `conversations.department_id` is set to NULL when the department goes away, so
  the ticket survives.
- Agent references (`assigned_agent_id`, `assigned_by_id`,
  `department_members.user_id`, team chat participants) may point at either
  `users` or `teams`. They are indexed but deliberately carry no foreign key,
  because the application treats both tables as agents.


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

1. **PostgreSQL Indexes**
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
- PostgreSQL on same machine
- Handles ~100 concurrent connections

### Production
- Load balancer
- Multiple backend instances
- PostgreSQL streaming replication
- Redis for session/socket state
- CDN for widget.js
- Handles ~10,000+ concurrent connections

### Scaling Path
```
Step 1: Separate PostgreSQL → managed PostgreSQL service
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
