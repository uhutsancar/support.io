# Dosya Yükleme Güvenlik Özellikleri

## 🔒 Güvenlik Katmanları

Bu sistemde dosya yükleme işlemleri için çok katmanlı güvenlik önlemleri alınmıştır.

### 1. Dosya Türü Doğrulama (File Type Validation)

#### İzin Verilen Dosya Türleri
Sadece aşağıdaki dosya türlerine izin verilir:

**Görseller:**
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

**Dokümanlar:**
- PDF (.pdf)
- Word (.doc, .docx)
- Excel (.xls, .xlsx)
- PowerPoint (.ppt, .pptx)

**Metin Dosyaları:**
- Text (.txt)
- CSV (.csv)

**Arşiv Dosyaları:**
- ZIP (.zip)
- RAR (.rar)
- 7Z (.7z)

#### Çift Doğrulama
1. **MIME Type Kontrolü**: Tarayıcı tarafından bildirilen MIME type kontrol edilir
2. **Extension Kontrolü**: Dosya uzantısı MIME type ile eşleşmelidir
3. **İçerik Doğrulama**: `file-type` paketi ile dosya içeriği gerçekten uzantısı ile uyumlu mu kontrol edilir

### 2. Dosya Boyutu Limiti

- **Maksimum boyut**: 10 MB
- Hem frontend hem backend tarafında kontrol edilir
- Rate limiting ile saldırılar engellenir

### 3. Dosya Adı Güvenliği

#### Güvenli Dosya Adı Oluşturma
- Orijinal dosya adı **asla** kullanılmaz
- Kriptografik olarak güvenli rastgele isimler oluşturulur
- Format: `{32_karakter_hex_string}{uzanti}`
- Örnek: `a3f2e9d8c7b6a5f4e3d2c1b0a9f8e7d6.pdf`

#### Path Traversal Koruması
Aşağıdaki tehlikeli karakterler/pattern'ler engellenir:
- `..` (üst dizin)
- `/` ve `\` (dizin ayırıcıları)
- `<>:"|?*` (tehlikeli karakterler)
- Null byte (`\x00-\x1f`)

### 4. Rate Limiting

```javascript
// 15 dakikada maksimum 20 dosya yükleme
windowMs: 15 * 60 * 1000
max: 20
```

Bu, DDoS ve spam saldırılarını önler.

### 5. Site Authentication

- Her dosya yükleme isteği `X-Site-Key` header'ı ile authenticate edilir
- Sadece geçerli site key'e sahip kullanıcılar dosya yükleyebilir
- Yetkisiz erişim engellenir

### 6. Güvenli Dosya Servisi

#### Security Headers
```javascript
X-Content-Type-Options: nosniff
Content-Security-Policy: default-src 'none'
Content-Disposition: inline
```

#### Stream-Based Serving
- Dosyalar stream olarak servis edilir (bellek verimli)
- Büyük dosyalar için daha güvenli

### 7. Malware/Script Koruması

#### Executable Engelleme
- `.exe`, `.bat`, `.sh`, `.cmd` gibi executable dosyalar engellenir
- Script dosyaları (`.js`, `.php`, `.py`) engellenir

#### Content-Type Enforcement
- Dosya içeriği, bildirilen MIME type ile uyuşmalıdır
- Uyuşmazlık durumunda dosya silinir ve hata döner

### 8. Database Security

#### Stored Information
```javascript
fileData: {
  filename: String,        // Hash'lenmiş güvenli ad
  originalName: String,    // Kullanıcıya göstermek için (escaped)
  mimeType: String,        // Doğrulanmış MIME type
  size: Number,            // Boyut kontrolü için
  url: String              // API endpoint URL'i
}
```

- Orijinal dosya adı escape edilir (XSS koruması)
- Fiziksel dosya yolu asla veritabanında saklanmaz

## 🛡️ Saldırı Senaryoları ve Korunma

### 1. Malicious File Upload
**Saldırı**: Zararlı executable dosya yükleme
**Korunma**: 
- Sadece whitelist'teki dosya türlerine izin
- Executable dosyalar tamamen engellenir

### 2. Path Traversal
**Saldırı**: `../../../etc/passwd` gibi dosya adları ile sistem dosyalarına erişim
**Korunma**:
- Path karakterleri engellenir
- Rastgele dosya adları kullanılır
- Dosyalar sadece `uploads/files/` dizininde saklanır

### 3. MIME Type Spoofing
**Saldırı**: Zararlı dosyayı meşru MIME type ile gizleme
**Korunma**:
- `file-type` paketi ile gerçek dosya içeriği kontrol edilir
- MIME type ve extension uyuşmalıdır
- İçerik analizi yapılır

### 4. Billion Laughs (ZIP Bomb)
**Saldırı**: Küçük compress'li dosya, açılınca sistemi çökertir
**Korunma**:
- Dosya boyutu limiti (10MB)
- ZIP dosyaları kabul edilse de, otomatik açılmaz
- Kullanıcı manuel indirip açar

### 5. XSS via Filenames
**Saldırı**: `<script>alert('xss')</script>.jpg` gibi dosya adları
**Korunma**:
- Orijinal dosya adı asla kullanılmaz
- Görüntüleme anında escape edilir
- HTML karakterleri temizlenir

### 6. DDoS via File Uploads
**Saldırı**: Sürekli dosya yükleme ile sunucu kaynaklarını tüketme
**Korunma**:
- Rate limiting (15dk/20 dosya)
- Dosya boyutu limiti
- Site authentication zorunlu

### 7. SQL/NoSQL Injection
**Saldırı**: Dosya metadata'sında injection
**Korunma**:
- `express-mongo-sanitize` middleware kullanılır
- Tüm input'lar sanitize edilir
- Mongoose schema validation

## 📋 Kullanım Kılavuzu

### Frontend (Widget)
```javascript
// Dosya seçimi
handleFileSelect(file)
  ├─> Boyut kontrolü (10MB)
  ├─> Tip kontrolü (whitelist)
  └─> Preview göster

// Dosya yükleme
uploadAndSendFile()
  ├─> FormData oluştur
  ├─> X-Site-Key header ile gönder
  ├─> Başarılı ise mesaj olarak gönder
  └─> Hata durumunda kullanıcıya bildir
```

### Frontend (Admin Panel)
```javascript
// Aynı güvenlik kontrolları
// + Authorization header (JWT token)
```

### Backend
```javascript
// Upload route
POST /api/files/upload
  ├─> Rate limiting kontrolü
  ├─> Site authentication (X-Site-Key)
  ├─> Multer file upload
  │   ├─> Boyut kontrolü
  │   ├─> MIME type kontrolü
  │   └─> Extension kontrolü
  ├─> Content validation (file-type)
  └─> Güvenli storage

// Download route
GET /api/files/:filename
  ├─> Filename sanitization
  ├─> File existence check
  ├─> Security headers
  └─> Stream response
```

## 🔧 Konfigürasyon

### Maksimum Dosya Boyutunu Değiştirme
```javascript
// backend/src/middleware/fileUpload.js
const MAX_FILE_SIZE = 10 * 1024 * 1024; // Değiştir
```

### Yeni Dosya Türü Ekleme
```javascript
// backend/src/middleware/fileUpload.js
const ALLOWED_FILE_TYPES = {
  'yeni/mime-type': ['.uzanti'],
  // Ekle...
}
```

### Rate Limit Ayarlama
```javascript
// backend/src/routes/files.js
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Zaman penceresi
  max: 20 // Maksimum istek
});
```

## ⚠️ Önemli Notlar

1. **Production'da**: 
   - Dosyalar S3, Cloudinary gibi cloud storage'da saklanmalı
   - CDN kullanılmalı
   - Virus scanning eklenebilir (ClamAV)

2. **Yedekleme**: 
   - `uploads/` klasörü düzenli yedeklenmeli
   - Ama git'e commit edilmemeli

3. **Monitoring**: 
   - Dosya yükleme logları tutulmalı
   - Anormal aktivite izlenmeli
   - Disk kullanımı takip edilmeli

4. **Cleanup**: 
   - Eski/kullanılmayan dosyalar temizlenmeli
   - Soft-delete yapılan konuşmaların dosyaları silinmeli

## 🧪 Test Senaryoları

### Güvenlik Testleri
- [ ] Executable dosya yükleme denemesi
- [ ] 10MB'den büyük dosya yükleme
- [ ] Geçersiz MIME type ile dosya yükleme
- [ ] Path traversal içeren dosya adı
- [ ] XSS payload içeren dosya adı
- [ ] Rate limit aşımı (20+ dosya/15dk)
- [ ] Geçersiz site key ile yükleme
- [ ] MIME type spoofing

### Fonksiyonel Testler
- [ ] Resim yükleme ve görüntüleme
- [ ] PDF yükleme ve indirme
- [ ] Word/Excel dosyası yükleme
- [ ] ZIP dosyası yükleme
- [ ] Widget'tan dosya gönderme
- [ ] Admin panel'den dosya gönderme
- [ ] Dosya preview'ları doğru görünüyor mu

## 📚 Kaynaklar

- [OWASP File Upload Security](https://owasp.org/www-community/vulnerabilities/Unrestricted_File_Upload)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Multer Documentation](https://github.com/expressjs/multer)
- [File-Type Package](https://github.com/sindresorhus/file-type)
