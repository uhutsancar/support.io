# 🎯 Quick Reference Guide

## 🚀 Start Commands

### Option 1: Automated Setup (Recommended)
```powershell
# Run the setup script
.\start.ps1
```

### Option 2: Manual Start

**Terminal 1 - Backend:**
```bash
cd backend
npm install      # First time only
npm run dev     # Start server
```

**Terminal 2 - Admin Panel:**
```bash
cd admin-panel
npm install      # First time only
npm run dev     # Start dev server
```

---

## 🌐 URLs

- **Backend API**: http://localhost:3000
- **Admin Panel**: http://localhost:3002
- **Widget Script**: http://localhost:3000/widget.js

---

## 📝 First Time Setup Checklist

- [ ] MongoDB installed and running
- [ ] Node.js v16+ installed
- [ ] Run `npm install` in `backend/`
- [ ] Run `npm install` in `admin-panel/`
- [ ] Backend running on port 3000
- [ ] Admin panel running on port 3002
- [ ] Register account at http://localhost:3002
- [ ] Create your first site
- [ ] Copy site key
- [ ] Test with demo/index.html

---

## 🔧 Common Commands

### Backend
```bash
cd backend
npm run dev       # Development mode with auto-reload
npm start         # Production mode
```

### Admin Panel
```bash
cd admin-panel
npm run dev       # Development server
npm run build     # Build for production
npm run preview   # Preview production build
```

---

## 🐛 Quick Troubleshooting

### Backend won't start?
```bash
# Check if MongoDB is running
# Windows: Check Task Manager for "mongod"
# Or start it: mongod

# Check if port 3000 is free
netstat -ano | findstr :3000
```

### Admin panel won't start?
```bash
# Check if port 3002 is free
netstat -ano | findstr :3002

# Clear cache and reinstall
rm -r node_modules
rm package-lock.json
npm install
```

### Widget not loading?
1. Check browser console for errors
2. Verify backend is running (http://localhost:3000/health)
3. Check site key is correct
4. Open Network tab and look for widget.js

---

## 📋 Test Credentials

After first registration, use your own credentials.
First user becomes admin automatically.

---

## 🎨 Widget Customization

```html
<script>
  window.SupportChatConfig = {
    siteKey: 'your-site-key',
    position: 'bottom-right',     // Position on screen
    primaryColor: '#4F46E5',       // Brand color
  };
</script>
<script src="http://localhost:3000/widget.js"></script>
```

---

## 📊 Database Collections

- **users** - Admin and agent accounts
- **sites** - Registered websites
- **conversations** - Chat sessions
- **messages** - Chat messages
- **faqs** - Automated responses

---

## 🔐 Environment Variables

Backend `.env`:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/supportchat
JWT_SECRET=change-this-in-production
NODE_ENV=development
```

---

## 📱 Features Overview

### ✅ Implemented
- Real-time chat via WebSocket
- Multi-site support
- FAQ auto-responses
- Agent dashboard
- Conversation management
- Visitor identification
- Message history

### 🔜 Coming Soon
- File uploads
- AI chatbot (GPT integration)
- Email notifications
- Analytics dashboard
- Mobile app

---

## 🎯 Usage Flow

1. **Setup** → Install & start backend + admin
2. **Register** → Create admin account
3. **Add Site** → Get site key
4. **Install Widget** → Add code to website
5. **Create FAQs** → Set up auto-responses
6. **Chat** → Talk to customers!

---

## 📞 Need Help?

1. Check [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions
2. Check [ARCHITECTURE.md](ARCHITECTURE.md) for system design
3. Look at demo/index.html for integration example
4. Check browser console for errors
5. Check backend logs in terminal

---

**Happy supporting! 🚀**
