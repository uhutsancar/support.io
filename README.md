# 🚀 Support.io - Professional SaaS Customer Support System

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
- ✅ **Self-hosted AI assistant** - Answers from your FAQ and your shop's order data on your own GPU ([ai/README.md](ai/README.md))
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

One script tag. The same code works in plain HTML, React, Next.js, Vue, Nuxt,
Angular, Svelte, Astro, WordPress, Laravel, PHP and Shopify — there is no
framework-specific embed.

```html
<script
  src="http://localhost:5000/widget.js"
  data-site-key="YOUR_SITE_KEY"
  async></script>
```

The runtime reads its configuration from its own `data-*` attributes and derives
the API origin from its own `src`, so no inline `<script>` block and no global
variable are needed — it works under a strict Content-Security-Policy.

To pin a version so a future deployment cannot change a live installation, use
the major-version path instead: `/widget/v3/widget.js` (served `immutable`).

Public JavaScript API on `window.SupportChat`:

```js
SupportChat.open() / close() / toggle() / show() / hide()
SupportChat.identify({ userId, userHash, name, email })   // after sign-in; userHash: see ai/README.md
SupportChat.logout()                            // after sign-out — mints a new visitor id
SupportChat.setAttributes({ plan: 'pro' })
SupportChat.setLocale('tr' | 'en')
SupportChat.setTheme('light' | 'dark' | 'auto')
SupportChat.on(event, handler)                  // returns an unsubscribe fn
SupportChat.destroy()
SupportChat.debug()                             // diagnostics
```

Full reference, framework guides and troubleshooting: **/dokumantasyon**
(`/en/documentation`). A live integration test page — including deliberately
hostile host CSS — is served at **/demo**.

### For Admins (Dashboard)
Access at: `http://localhost:3002`

---

## 📁 Project Structure

```
support_chat_app/
│
├── 📂 backend/              Express.js + Socket.io API
│   ├── src/
│   │   ├── models/         19 relational models
│   │   ├── db/             PostgreSQL schema, model runtime, migrations
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
- PostgreSQL 13 or higher (local or cloud)
- npm or yarn

### Option 1: Docker (Recommended)
```bash
docker compose up -d
docker compose exec backend npm run db:seed    # optional demo tenant
```
Everything — database, Redis, API, panel and the Caddy proxy — comes up at
**http://localhost**. The self-hosted AI model is optional and starts only
with `COMPOSE_PROFILES=ai` in the root `.env`; see [ai/README.md](ai/README.md).

### Option 2: Manual Setup

**Step 1: Install Dependencies**
```bash
cd backend && npm install
cd ../admin-panel && npm install
```

**Step 2: Start Services**
```bash
cd backend && npm run dev          # API
cd admin-panel && npm run dev      # panel (separate terminal)
```

**Step 3: First Use**
1. Open http://localhost:3002
2. Sign up for an account
3. Create your first site
4. Copy the site key
5. Test with `demo/index.html`

---

## 🗄️ Database

The backend reads its connection details from `backend/.env` only. Provide either
a single URL or the discrete variables:

```
DATABASE_URL=postgresql://user:password@host:5432/dbname
# or
DB_HOST=localhost
DB_PORT=5432
DB_NAME=supportchat
DB_USER=support_user
DB_PASSWORD=...
# optional, defaults to off for a local server
DB_SSL=false
```

The schema is created automatically on boot. To apply it without starting the
server:

```bash
cd backend
npm run db:migrate
```

`backend/src/db/schema.sql` holds the full DDL. Every statement in it is
idempotent, so running it again never destroys or duplicates data.

---

## 📦 File Storage (AWS S3)

Uploaded site logos and chat attachments go straight to S3; nothing is written to
local disk. The credentials are read from `backend/.env`:

```
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=eu-north-1
S3_BUCKET=support-io-bucket
# AWS_BUCKET_NAME is still honoured as a fallback for older deployments
```

Two prefixes are used, both written by `backend/src/middleware/s3Upload.js`:

| Prefix    | Written by                        | Limit |
| --------- | --------------------------------- | ----- |
| `logos/`  | admin panel, site logo upload     | 5 MB  |
| `files/`  | widget, chat file attachments     | 10 MB |

### Bucket setup

The bucket keeps **Object Ownership: bucket owner enforced**, so ACLs are
disabled and the uploader never sends one — sending `acl: 'public-read'` against
such a bucket fails with `AccessControlListNotSupported`. Public read is granted
by a bucket policy scoped to the two upload prefixes, so the rest of the bucket
stays private:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadUploadedAssets",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": [
      "arn:aws:s3:::support-io-bucket/logos/*",
      "arn:aws:s3:::support-io-bucket/files/*"
    ]
  }]
}
```

Block Public Access stays on for ACLs (`BlockPublicAcls`, `IgnorePublicAcls`)
and is off for policies (`BlockPublicPolicy`, `RestrictPublicBuckets`), which is
what lets the policy above take effect.

Set `S3_ACL` only if you move to a bucket that has ACLs enabled; when it is
unset no ACL is sent at all.

---

## 🛠️ Tech Stack

### Backend
- **Express.js** - Web framework
- **Socket.io** - Real-time WebSocket
- **PostgreSQL** - Database (via node-postgres)
- **AWS S3** - File storage (logos, chat attachments)
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

## 🌟 Why Support.io?

| Feature | Support.io | Intercom | Zendesk |
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
- [x] AI assistant on a self-hosted model
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
