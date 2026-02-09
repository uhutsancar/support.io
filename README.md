# 🚀 SupportChat - Professional SaaS Customer Support System

> Modern, real-time customer support chat widget system - like Intercom, Zendesk, but **yours**!

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Node](https://img.shields.io/badge/node-%3E%3D16-green)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

---

## ✨ Features

### 🎯 Core Features
- ✅ **One-Line Integration** - Embed with a single script tag
- ✅ **Real-time Chat** - WebSocket-powered instant messaging
- ✅ **Smart FAQ Bot** - Automated responses with keyword matching
- ✅ **Multi-site Support** - Manage multiple websites from one dashboard
- ✅ **WhatsApp-like Interface** - Modern, familiar chat experience
- ✅ **Mobile Responsive** - Perfect on all devices
- ✅ **Visitor Tracking** - Persistent visitor identification
- ✅ **Page-specific Help** - Contextual support based on current page

### 💼 Admin Features
- ✅ Beautiful React Dashboard
- ✅ Real-time Conversation Inbox
- ✅ FAQ Management
- ✅ Site Management
- ✅ Conversation Assignment
- ✅ Status Tracking

---

## 🎬 Quick Demo

### For Visitors (Widget)
```html
<!-- Add to your website -->
<script>
  window.SupportChatConfig = { siteKey: 'your-key' };
</script>
<script src="http://localhost:3000/widget.js"></script>
```

### For Admins (Dashboard)
Access at: `http://localhost:3002`

---

## 📁 Project Structure

```
support_chat_app/
│
├── 📂 backend/              Express.js + Socket.io API
│   ├── src/
│   │   ├── models/         5 MongoDB models
│   │   ├── routes/         4 API route groups
│   │   ├── socket/         WebSocket handlers
│   │   └── server.js       Main server
│   └── public/
│       └── widget.js       Embeddable widget
│
├── 📂 admin-panel/         React + Tailwind Admin Dashboard
│   └── src/
│       ├── pages/          5 main pages
│       ├── contexts/       Auth management
│       └── services/       API integration
│
├── 📂 demo/                Example integration
│   └── index.html
│
└── 📚 Documentation
    ├── README.md           This file
    ├── SETUP_GUIDE.md      Detailed setup (English)
    ├── BASLANGIC_TR.md     Quick start (Turkish)
    ├── ARCHITECTURE.md     System design
    ├── QUICK_START.md      Quick reference
    └── PROJECT_SUMMARY.md  Complete overview
```

---

## 🚀 Installation & Setup

### Prerequisites
- Node.js v16 or higher
- MongoDB (local or cloud)
- npm or yarn

### Option 1: Automated Setup (Recommended)
```powershell
# Run the setup script
.\start.ps1
```

### Option 2: Manual Setup

**Step 1: Install Dependencies**
```bash
# Backend
cd backend
npm install

# Admin Panel
cd admin-panel
npm install
```

**Step 2: Start Services**

Terminal 1 - Backend:
```bash
cd backend
npm run dev
# Runs on http://localhost:3000
```

Terminal 2 - Admin Panel:
```bash
cd admin-panel
npm run dev
# Runs on http://localhost:3002
```

**Step 3: First Use**
1. Open http://localhost:3002
2. Sign up for an account
3. Create your first site
4. Copy the site key
5. Test with `demo/index.html`

---

## 🛠️ Tech Stack

### Backend
- **Express.js** - Web framework
- **Socket.io** - Real-time WebSocket
- **MongoDB + Mongoose** - Database
- **JWT** - Authentication
- **bcryptjs** - Password security

### Frontend (Admin Panel)
- **React 18** - UI library
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **React Router** - Navigation
- **Axios** - HTTP client
- **Socket.io Client** - WebSocket

### Widget
- **Vanilla JavaScript** - Zero dependencies
- **CSS3** - Modern styling
- **Socket.io Client** - Real-time connection

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Complete setup instructions |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture & design |
| [QUICK_START.md](QUICK_START.md) | Quick reference guide |
| [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) | Full project overview |
| [BASLANGIC_TR.md](BASLANGIC_TR.md) | Turkish quick start |

---

## 🎯 Use Cases

- **E-commerce**: Product questions, order tracking
- **SaaS Products**: Technical support, onboarding
- **Agencies**: Client communication
- **Corporate Sites**: Lead generation, sales
- **Educational**: Student support
- **Any Website**: Customer service!

---

## 🌟 Why SupportChat?

| Feature | SupportChat | Intercom | Zendesk |
|---------|-------------|----------|---------|
| Price | **Free** (Self-hosted) | $39+/mo | $49+/mo |
| Setup Time | **5 minutes** | 15 min | 20 min |
| Customization | **Full Control** | Limited | Limited |
| Self-Hosted | ✅ | ❌ | ❌ |
| Open Source | ✅ | ❌ | ❌ |
| Real-time | ✅ | ✅ | ✅ |

---

## 🔮 Roadmap

### Phase 1 (✅ Done)
- [x] Real-time chat
- [x] FAQ automation
- [x] Admin dashboard
- [x] Multi-site support

### Phase 2 (Coming Soon)
- [ ] File uploads
- [ ] Agent status (online/offline)
- [ ] Email notifications
- [ ] Analytics dashboard

### Phase 3 (Future)
- [ ] AI chatbot (GPT-4)
- [ ] Mobile apps
- [ ] Video chat
- [ ] Advanced analytics

---

## 📞 Support

Need help?
1. Check [SETUP_GUIDE.md](SETUP_GUIDE.md)
2. Review [ARCHITECTURE.md](ARCHITECTURE.md)
3. See `demo/index.html` for example
4. Check browser console for errors

---

## 📄 License

MIT License - Feel free to use for personal or commercial projects!

---

## 🎉 Credits

Built with ❤️ for amazing customer support experiences

**Happy Supporting! 🚀**
