# 🚀 SupportChat - Başlangıç Rehberi (Türkçe)

## Hızlı Başlangıç

### 1. Gereksinimleri Kontrol Et

```powershell
# Node.js versiyonunu kontrol et (16+ olmalı)
node --version

# MongoDB'nin çalıştığını kontrol et
# Windows'ta Task Manager'da "mongod" sürecini ara
# Veya MongoDB Compass'ı aç
```

### 2. Kurulumu Yap

```powershell
# Proje klasörüne git
cd c:\Users\Lenovo\Desktop\support_chat_app

# Otomatik kurulum scripti çalıştır
.\start.ps1
```

### 3. Servisleri Başlat

**Terminal 1 - Backend:**
```powershell
cd backend
npm run dev
```
✅ Backend çalışıyor: http://localhost:3000

**Terminal 2 - Admin Panel:**
```powershell
cd admin-panel
npm run dev
```
✅ Admin panel çalışıyor: http://localhost:3002

### 4. İlk Kullanım

1. **Kayıt Ol**: http://localhost:3002 → Sign Up
2. **Site Ekle**: Sites → Add Site → Site key'i kopyala
3. **Demo Test**: `demo/index.html` dosyasında site key'i yapıştır
4. **Chat Yap**: demo/index.html'i tarayıcıda aç, chat balonu ile test et!

---

## 📁 Klasör Açıklamaları

- `backend/` - Sunucu tarafı (API + WebSocket)
- `admin-panel/` - Yönetim paneli (React)
- `demo/` - Örnek entegrasyon sayfası
- `*.md` - Dokümantasyon dosyaları

---

## 🎯 Sonraki Adımlar

1. FAQ ekle (FAQs menüsünden)
2. Konuşmaları yönet (Conversations)
3. Kendi web sitene widget'ı ekle
4. Takım üyeleri ekle (gelecek özellik)

---

## 🆘 Yardım

- **Detaylı kurulum**: `SETUP_GUIDE.md` oku
- **Sistem mimarisi**: `ARCHITECTURE.md` incele
- **Hızlı referans**: `QUICK_START.md` bak
- **Proje özeti**: `PROJECT_SUMMARY.md` oku

---

**Başarılar! 🎉**
