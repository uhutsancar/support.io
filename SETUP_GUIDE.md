# SupportChat - Complete Setup Guide

## 📋 Prerequisites

Before you begin, make sure you have:
- **Node.js** (v16 or higher)
- **MongoDB** (running locally or cloud)
- **npm** or **yarn**

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Backend Setup

```bash
# Navigate to backend folder
cd backend

# Install dependencies
npm install

# Start MongoDB (if local)
# Windows: mongod
# Mac/Linux: sudo systemctl start mongodb

# Start backend server
npm run dev
```

Backend will run on: **http://localhost:3000**

### Step 2: Admin Panel Setup

Open a new terminal:

```bash
# Navigate to admin panel folder
cd admin-panel

# Install dependencies
npm install

# Start admin panel
npm run dev
```

Admin panel will run on: **http://localhost:3002**

### Step 3: Create Your First Site

1. Open **http://localhost:3002** in your browser
2. Click **"Sign Up"** to create an account
3. After login, go to **"Sites"** from the sidebar
4. Click **"Add Site"** button
5. Fill in:
   - **Site Name**: My Website
   - **Domain**: localhost
6. Click **"Create Site"**
7. **Copy the Site Key** - you'll need this!

### Step 4: Test the Widget

1. Open `demo/index.html` in a text editor
2. Find this line:
   ```javascript
   siteKey: 'YOUR-SITE-KEY-HERE',
   ```
3. Replace `YOUR-SITE-KEY-HERE` with your copied site key
4. Open `demo/index.html` in your browser
5. Click the **chat bubble** in the bottom-right corner
6. Type a message!

### Step 5: Reply from Admin Panel

1. Go back to admin panel (**http://localhost:3002**)
2. Click **"Conversations"** in the sidebar
3. You'll see your conversation
4. Click on it to open
5. Type a reply and hit send!

**🎉 Congratulations! Your SupportChat is working!**

---

## 📁 Project Structure

```
support_chat_app/
├── backend/                 # Express.js API + WebSocket
│   ├── src/
│   │   ├── models/         # MongoDB models
│   │   ├── routes/         # API routes
│   │   ├── socket/         # WebSocket handlers
│   │   ├── middleware/     # Auth & validation
│   │   └── server.js       # Main server file
│   ├── public/
│   │   └── widget.js       # Chat widget script
│   └── package.json
│
├── admin-panel/            # React Admin Dashboard
│   ├── src/
│   │   ├── pages/         # Dashboard pages
│   │   ├── contexts/      # Auth context
│   │   ├── services/      # API service
│   │   └── App.jsx        # Main app
│   └── package.json
│
└── demo/                   # Example integration
    └── index.html
```

---

## 🔧 Configuration

### Backend (.env file)

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/supportchat
JWT_SECRET=your-secret-key-change-this
NODE_ENV=development
```

### Widget Customization

```javascript
window.SupportChatConfig = {
  siteKey: 'your-site-key',
  position: 'bottom-right',  // bottom-right, bottom-left, top-right, top-left
  primaryColor: '#4F46E5',   // Your brand color
};
```

---

## 🌐 Integration Guide

### HTML Website

Add this code before closing `</body>` tag:

```html
<script>
  window.SupportChatConfig = {
    siteKey: 'your-site-key-here'
  };
</script>
<script src="http://localhost:3000/widget.js"></script>
```

### React Website

```javascript
// In your main component or layout
useEffect(() => {
  // Load widget config
  window.SupportChatConfig = {
    siteKey: 'your-site-key-here'
  };

  // Load widget script
  const script = document.createElement('script');
  script.src = 'http://localhost:3000/widget.js';
  script.async = true;
  document.body.appendChild(script);

  return () => {
    document.body.removeChild(script);
  };
}, []);
```

### WordPress

1. Go to **Appearance > Theme Editor**
2. Edit **footer.php**
3. Add widget code before `</body>`
4. Save changes

---

## 🎨 Admin Panel Features

### Dashboard
- Overview statistics
- Quick actions
- Recent conversations

### Sites Management
- Add multiple websites
- Get unique site keys
- Copy installation code
- Configure widget settings

### Conversations (WhatsApp-like)
- Real-time chat interface
- Conversation list with status
- Assign to agents
- Mark as resolved/closed

### FAQs Management
- Create automated responses
- Keyword-based matching
- Page-specific FAQs
- Category organization

---

## 🤖 FAQ Auto-Response

The system automatically searches for matching FAQs when a visitor sends a message:

1. Go to **FAQs** in admin panel
2. Click **"Add FAQ"**
3. Fill in:
   - **Question**: "How do I reset my password?"
   - **Answer**: "Click on 'Forgot Password' on login page..."
   - **Keywords**: "password, reset, forgot"
4. Save

Now when a visitor types something like "forgot password", the bot will automatically respond!

---

## 🔐 Security Best Practices

1. **Change JWT Secret**: Never use default JWT secret in production
2. **Use HTTPS**: Always use SSL in production
3. **Validate Site Keys**: Backend validates site keys on every widget connection
4. **CORS Settings**: Configure CORS properly for production domains

---

## 🚢 Production Deployment

### Backend (Heroku, DigitalOcean, AWS)

```bash
# Set environment variables
PORT=3000
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=super-secret-production-key
NODE_ENV=production

# Build and start
npm install
npm start
```

### Admin Panel (Vercel, Netlify)

```bash
# Build
npm run build

# Deploy build folder
```

### Update Widget URL

In your widget integration, change:
```javascript
// From
<script src="http://localhost:3000/widget.js"></script>

// To
<script src="https://your-domain.com/widget.js"></script>
```

---

## 🐛 Troubleshooting

### Widget not showing?
1. Check if backend is running
2. Verify site key is correct
3. Check browser console for errors
4. Make sure MongoDB is running

### Can't login to admin panel?
1. Check backend is running
2. Verify MongoDB connection
3. Clear browser cache
4. Check network tab for API errors

### Messages not sending?
1. Check WebSocket connection in network tab
2. Verify backend server is running
3. Check firewall settings
4. Look at backend console for errors

---

## 📚 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Sites
- `GET /api/sites` - Get all sites
- `POST /api/sites` - Create site
- `PUT /api/sites/:id` - Update site
- `DELETE /api/sites/:id` - Delete site

### Conversations
- `GET /api/conversations/:siteId` - Get conversations
- `GET /api/conversations/:siteId/:id` - Get single conversation
- `PUT /api/conversations/:id/assign` - Assign agent
- `PUT /api/conversations/:id/status` - Update status

### FAQs
- `GET /api/faqs/admin/:siteId` - Get FAQs
- `POST /api/faqs/admin` - Create FAQ
- `PUT /api/faqs/admin/:id` - Update FAQ
- `DELETE /api/faqs/admin/:id` - Delete FAQ

---

## 💡 Tips & Best Practices

1. **Test with Multiple Browsers**: Open widget in one browser, admin panel in another
2. **Create FAQs First**: Set up common questions before going live
3. **Customize Colors**: Match widget to your brand
4. **Monitor Conversations**: Check admin panel regularly
5. **Use Categories**: Organize FAQs by category for better management

---

## 🎯 Next Steps

1. ✅ Set up the system
2. ✅ Test the widget
3. ✅ Create FAQs
4. 🔜 Add to your real website
5. 🔜 Invite team members
6. 🔜 Deploy to production

---

## 📞 Support

If you need help:
1. Check this documentation
2. Test with demo page first
3. Check browser console
4. Review backend logs

---

**Built with ❤️ - Happy supporting your customers!** 🚀
