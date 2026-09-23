# Support.io — Proje Yapısı

Bu belge deponun gerçek yapısını anlatır. Aşağıdaki her dosya, tablo ve uç nokta
depoda mevcuttur; örnek/temsili yapı yazılmamıştır.

---

## 1. Proje Genel Bakış

Support.io, bir web sitesine tek satırlık script ile gömülen canlı destek
widget'ı ve bu widget'a gelen konuşmaları yöneten çok kiracılı (multi-tenant) bir
destek platformudur.

Ürün üç parçadan oluşur:

| Parça | Ne yapar |
| --- | --- |
| **Widget** (`backend/public/widget.js`) | Müşterinin sitesinde çalışan, bağımlılığı olmayan sohbet arayüzü |
| **Backend** (`backend/`) | REST API + Socket.IO gerçek zamanlı katman + kural motorları + AI |
| **Admin panel** (`admin-panel/`) | Temsilcilerin ve yöneticilerin kullandığı React arayüzü |

Desteklenen yetenekler: canlı sohbet, ticket/SLA yönetimi, departman ve otomatik
atama, ekip içi sohbet, CRM fırsat hattı, otomasyon kuralları, proaktif mesajlar,
SSS tabanlı otomatik yanıt, analitik, denetim kaydı ve AI asistan.

---

## 2. Mimari

```
                    ┌──────────────────────────┐
   Müşteri sitesi   │  widget.js (vanilla JS)  │
                    └────────────┬─────────────┘
                                 │ Socket.IO  /widget
                                 ▼
┌──────────────────────────────────────────────────────────────┐
│                    Backend (Express + Socket.IO)             │
│                                                              │
│  REST /api/*        Socket.IO            Servisler           │
│  ├ auth             ├ /widget  (ziyaretçi)  ├ autoAssignment │
│  ├ conversations    └ /admin   (temsilci)   ├ businessHours  │
│  ├ analytics                                ├ escalation     │
│  ├ ai                                       ├ automationEngine│
│  └ … (82 uç nokta)                          ├ proactiveEngine│
│                                             ├ auditService   │
│                                             └ aiService      │
└───────────┬──────────────────────────┬───────────────┬───────┘
            │                          │               │
            ▼                          ▼               ▼
     PostgreSQL 16              AWS S3            vLLM (llm)
     (29 tablo)             (logo + dosya)      (yerel model, ops.)
            ▲
            │ REST + Socket.IO /admin
┌───────────┴──────────────────────────┐
│   Admin panel (React 18 + Vite)      │
└──────────────────────────────────────┘
```

**Cache:** Projede Redis yoktur. Kısa ömürlü GET önbelleği tarayıcı tarafında
`admin-panel/src/services/api.js` içindeki `Map` ile tutulur. Source of truth her
zaman PostgreSQL'dir.

**Kuyruk/worker:** Ayrı bir job sistemi yoktur. Uzun sürebilecek tek iş olan
otomasyon kuralı çalıştırma, socket akışını bloklamadan `.catch()` ile ayrık
tetiklenir (`socketHandler.runAutomation`).

---

## 3. Dizin Yapısı

```
support_chat_app/
├── admin-panel/                React yönetim paneli (Vite)
│   ├── src/
│   │   ├── components/         Paylaşılan bileşenler
│   │   ├── contexts/           Auth / tema / dil sağlayıcıları
│   │   ├── layouts/            Dashboard kabuğu ve yan menü
│   │   ├── locales/            tr / en çeviri sözlükleri
│   │   ├── pages/              Rotaya bağlı sayfalar
│   │   └── services/api.js     Tüm HTTP çağrıları
│   ├── Dockerfile
│   └── vite.config.js
│
├── backend/                    Express API + Socket.IO
│   ├── src/
│   │   ├── config/database.js  Bağlantı açma + şema uygulama
│   │   ├── db/                 Şema, ORM çalışma zamanı, elle yazılmış SQL
│   │   ├── events/             Süreç içi olay yayını (EventEmitter)
│   │   ├── middleware/         Kimlik, yetki, dosya yükleme
│   │   ├── models/             19 model tanımı
│   │   ├── routes/             REST uç noktaları
│   │   ├── services/           İş mantığı ve motorlar
│   │   │   └── ai/             AI sağlayıcı soyutlaması
│   │   ├── socket/             Gerçek zamanlı olay işleyicileri
│   │   └── server.js           Uygulama girişi
│   ├── public/widget.js        Gömülebilir widget
│   ├── tests/                  Uçtan uca ve birim testler
│   └── Dockerfile
│
├── demo/index.html             Widget entegrasyon örneği
├── uploads/                    Yerel yükleme dizini (S3 kullanılmıyorsa)
├── Caddyfile                   Docker'daki ters vekil kuralları
├── docker-compose.yml          Geliştirme yığını
├── ARCHITECTURE.md             Sistem tasarımı notları
├── SECURITY.md                 Güvenlik notları
├── FILE_UPLOAD_SECURITY.md     Dosya yükleme sertleştirmesi
└── PROJECT_STRUCTURE.md        Bu dosya
```

---

## 4. Önemli Klasörler

| Klasör | Görevi |
| --- | --- |
| `backend/src/db/` | Şema (`schema.sql`), Mongoose benzeri ORM (`model.js`), bağlantı havuzu, elle yazılmış toplama sorguları, demo veri üreteci |
| `backend/src/models/` | Her dosya bir tabloyu ORM'e tanıtır: alan → kolon eşlemesi, enum, varsayılan, ilişki, alt tablo |
| `backend/src/routes/` | HTTP uç noktaları. Her biri kimlik doğrulama + kiracı kapsamı + doğrulama yapar |
| `backend/src/services/` | Rotalardan bağımsız iş mantığı: atama, SLA, kural motorları, denetim, AI |
| `backend/src/services/ai/` | Sağlayıcı soyutlaması. API anahtarı yalnızca burada bulunur |
| `backend/src/socket/` | Widget ve admin namespace'lerinin tüm gerçek zamanlı akışı |
| `backend/tests/` | Çalışan sunucuya ve gerçek veritabanına karşı koşan testler |
| `admin-panel/src/pages/` | Her dosya bir rotaya bağlıdır; bağlı olmayan sayfa yoktur |
| `admin-panel/src/services/` | Tek axios örneği, token enjeksiyonu, GET önbelleği, 401 yönlendirmesi |

---

## 5. Önemli Dosyalar

| Dosya | Görevi |
| --- | --- |
| `backend/src/server.js` | Express kurulumu, CORS, güvenlik başlıkları, hız sınırı, rota bağlama, Socket.IO ve kural motorlarının başlatılması |
| `backend/src/db/model.js` | Model tanımlarını gerçek SQL'e çeviren çalışma zamanı (1441 satır): filtre → WHERE, alt dizi → JOIN, `populate` → toplu sorgu |
| `backend/src/db/schema.sql` | Tüm DDL. Her ifade tekrar çalıştırılabilir (idempotent) |
| `backend/src/db/queries.js` | Satır başına sorgu üretecek erişimlerin tek geçişe indirildiği elle yazılmış SQL |
| `backend/src/db/analyticsQueries.js` | Analitik panosunun tüm toplamaları |
| `backend/src/db/seed.js` | İlişkisel demo veri üreteci |
| `backend/src/socket/socketHandler.js` | Konuşma açma, mesaj akışı, atama, SLA, ekip sohbeti (1150+ satır) |
| `backend/src/middleware/auth.js` | JWT doğrulama, kullanıcı/temsilci ayrımı, organizasyon bağlamı |
| `backend/src/middleware/siteAuth.js` | Widget için site anahtarı; panel için `findOwnedSite` sahiplik kontrolü |
| `backend/src/middleware/rbac.js` | Rol → izin tablosu ve plan özellik matrisi |
| `backend/public/widget.js` | Bağımlılıksız gömülebilir widget (1666 satır) |
| `admin-panel/src/App.jsx` | Tüm rotalar; `ProtectedRoute` / `AdminRoute` / `PublicRoute` sarmalayıcıları |
| `admin-panel/src/layouts/DashboardLayout.jsx` | Role ve plana göre kurulan yan menü |

---

## 6. Veritabanı Mimarisi

PostgreSQL 16, 29 tablo. Birincil anahtarlar 24 karakterlik onaltılık dizelerdir.

### Ana tablolar

| Tablo | Amaç | Dikkat çeken kolonlar |
| --- | --- | --- |
| `organizations` | Kiracı, plan, sahip | `plan_type`, `owner_user_id` |
| `users` | Kayıt olan hesaplar | `email` (tekil), `role`, `organization_id` |
| `teams` | Panelden açılan temsilciler | `skills`, `current_load`, `max_capacity` |
| `sites` | Kurulu widget'lar | `site_key` (tekil), `widget_settings` |
| `departments` | Yönlendirme grupları | `business_hours`, `sla`, `stats` |
| `conversations` | Ticket'lar | `ticket_number` (tekil), `status`, `priority`, `sla`, `tags`, `rating` |
| `messages` | Sohbet dökümü | `sender_type`, `file_data`, `is_read` |
| `faqs` | Otomatik yanıt bilgi tabanı | `search_vector` (üretilmiş tsvector) |
| `visitors` | Canlı ziyaretçi varlığı | `visitor_id`, `last_active_at` |
| `widget_configs` | Site başına görünüm | site başına tek satır |
| `deals` | CRM hattı | `stage`, `value` |
| `audit_logs` | Salt-ekleme denetim izi | güncelleme tetikleyici ile engellenir |
| `automation_rules` / `automation_logs` | Kural motoru | kural gövdeleri `jsonb` |
| `proactive_rules` / `proactive_trigger_logs` / `event_logs` | Proaktif etkileşim | 30 günlük saklama süpürmesi |
| `team_chats` / `team_messages` | Ekip içi sohbet | |
| `counters` | Sıralı ticket numarası | atomik upsert |

### Alt tablolar

Gömülü dizi yerine ilişkisel tutulanlar: `user_assigned_sites`,
`team_assigned_sites`, `user_departments`, `team_departments`,
`department_members`, `conversation_internal_notes`, `team_chat_participants`,
`team_message_read_by`, `team_message_participants`.

Bağımsız kimliği olmayan yapılandırma nesneleri (`sla`, `permissions`, `stats`,
`business_hours`, kural gövdeleri) `jsonb`; düz değer listeleri (`tags`,
`skills`, `keywords`) `text[]` kolonlarında tutulur.

---

## 7. İlişkiler

```
organizations 1─┬─* users
                ├─* teams
                ├─* sites ─┬─* departments ─* department_members
                │          ├─* conversations ─┬─* messages
                │          │                  └─* conversation_internal_notes
                │          ├─* faqs
                │          ├─* visitors
                │          ├─1 widget_configs
                │          ├─* automation_rules ─* automation_logs
                │          └─* proactive_rules ─* proactive_trigger_logs
                ├─* deals
                └─* audit_logs
```

**Silme kuralları:** Site silinince departmanları, konuşmaları, SSS'leri,
ziyaretçileri, widget yapılandırması ve kuralları da silinir. Konuşma silinince
mesajları ve dahili notları silinir. `conversations.department_id` departman
silindiğinde NULL olur, ticket ayakta kalır.

**Yabancı anahtarı olmayan referanslar:** `assigned_agent_id`, `assigned_by_id`,
`department_members.user_id` ve ekip sohbeti katılımcıları hem `users` hem
`teams` tablosunu gösterebildiği için indekslidir ama yabancı anahtar taşımaz.

---

## 8. API Mimarisi

Tüm uç noktalar `/api` altındadır (82 uç nokta).

| Grup | Sorumluluk |
| --- | --- |
| `/api/auth` | Kayıt, giriş, oturum, hesap silme |
| `/api/sites` | Site CRUD, site anahtarı yenileme |
| `/api/conversations` | Liste, detay, atama, üstlenme, durum, öncelik, not, okunmamış sayacı |
| `/api/departments` | Departman CRUD, üyeler, istatistik |
| `/api/team` | Temsilci CRUD, durum, istatistik, `me/performance` |
| `/api/team-chat` | Ekip içi sohbet |
| `/api/faqs` | SSS yönetimi (panel) |
| `/api/widget` + `/api/widget-config` | Widget çalışma zamanı ve görünüm ayarları |
| `/api/files` | Sohbet dosya yükleme |
| `/api/visitors` | Canlı ziyaretçi listesi |
| `/api/deals` | CRM hattı |
| `/api/automation-rules` | Otomasyon kuralı CRUD |
| `/api/proactive-rules` | Proaktif kural CRUD |
| `/api/events` | Widget davranış olaylarının toplu alımı (site anahtarı ile) |
| `/api/analytics` | Panonun tüm toplamaları tek istekte |
| `/api/ai` | AI asistan görevleri |
| `/api/audit` | Denetim kaydı listesi |
| `/api/onboarding` | İlk kurulum akışı |

**Ortak davranış:** JSON gövde, `Authorization: Bearer <jwt>`, hata gövdesi
`{ "error": "..." }`. Doğrulama hataları ek olarak `details` dizisi taşır.

**Bilinen tutarsızlık:** `/api/auth/register` yanıtı `user.id` alanı döndürürken
diğer kaynaklar `_id` kullanır. Panel `user.id` bekler; değiştirmek kırıcı
olacağından olduğu gibi bırakılmıştır.

---

## 9. Kimlik Doğrulama

```
POST /api/auth/register veya /login
   └─ bcrypt ile parola doğrulama
   └─ JWT üretimi: { userId, organizationId, role, userType }
        userType: 'user'  → users tablosu (sahip/yönetici)
                  'team'  → teams tablosu (temsilci)

Her istekte middleware/auth.js:
   └─ token doğrula → kullanıcıyı ilgili tablodan çek (isActive)
   └─ organizasyonu çöz, aktif değilse 403
   └─ token'daki organizasyon ile kullanıcınınki uyuşmuyorsa 403
   └─ req.user / req.userId / req.userType / req.organization doldur
```

Giriş uç noktalarında ayrı hız sınırı vardır (15 dakikada 100 deneme).

---

## 10. Yetkilendirme

`backend/src/middleware/rbac.js` içindeki rol → izin tablosu:

| Rol | İzinler |
| --- | --- |
| `owner` | manage_billing, manage_plan, manage_users, manage_sla, manage_integrations, view_analytics, configure_system, manage_sites |
| `admin` | manage_operations, view_all_tickets, assign_tickets, manage_team, manage_users, view_reports, manage_sites |
| `manager` | manage_team, view_reports, assign_tickets |
| `agent` | view_assigned, respond, update_status, team_chat |
| `viewer` | read_only |

Ek olarak plan matrisi (`FREE` / `PRO` / `ENTERPRISE`) bazı özellikleri kapatır.

**Kiracı izolasyonu yetkilendirmenin ikinci katmanıdır ve rolden bağımsızdır.**
Site'e bağlı her kaynak `findOwnedSite(req, siteId)` üzerinden çözülür; başka bir
organizasyonun kimliği tahmin edilse bile 404 döner. Bu kural otomasyon
kuralları, proaktif kurallar, analitik ve AI uç noktalarının tamamında testle
sabitlenmiştir.

> Not: `view_analytics` (owner) ile `view_reports` (admin/manager) farklı
> isimlerdir. Analitik rotası ikisini de kabul eder; tek isim beklemek rollerin
> yarısını yanlışlıkla reddeder.

---

## 11. Gerçek Zamanlı Katman

Socket.IO, iki namespace:

**`/widget`** (ziyaretçi)

| Yön | Olay |
| --- | --- |
| İstemci → Sunucu | `join-conversation`, `send-message`, `typing`, `visitor-page-view` |
| Sunucu → İstemci | `conversation-joined`, `new-message`, `agent-typing`, `error` |

**`/admin`** (temsilci)

| Yön | Olay |
| --- | --- |
| İstemci → Sunucu | `join-site`, `join-conversation`, `send-message`, `typing`, `update-status`, `assign-conversation`, `claim-conversation`, `set-department`, `set-priority`, `resolve-conversation`, `team-chat-*` |
| Sunucu → İstemci | `new-conversation`, `new-message`, `visitor-typing`, `visitor-updated`, `conversation-assigned`, `conversation-department-changed`, `conversation-note-added`, `sla-warning`, `sla-breach-escalation`, `sla-breach-reassigned`, `notification` |

Yayın oda tabanlıdır: `conversation:<id>`, `site:<id>`, `user:<id>`.

> `join-conversation` işleyicisi asenkrondur ve `socket.siteId`'yi iş ortasında
> atar. Bir istemci bağlanır bağlanmaz `send-message` gönderirse mesaj düşer;
> bu yüzden istemci önce `conversation-joined` beklemelidir.

---

## 12. Sohbet Akışı

```
Ziyaretçi mesaj gönderir
  └─ konuşma yoksa oluşturulur
       ├─ departman seçimi (mesaj içeriğine göre anahtar kelime eşleşmesi)
       ├─ SLA hedefleri departman veya öncelik varsayılanından yazılır
       ├─ mesai saati dışıysa bot bilgilendirme mesajı
       ├─ autoAssignConversation → en uygun temsilci
       └─ otomasyon: conversation_created tetikleyicisi
  └─ mesaj kaydedilir, unreadCount artar
  └─ atanan temsilci çevrimdışıysa yeniden atama denenir
  └─ /widget ve /admin odalarına yayın
  └─ otomasyon: message_received tetikleyicisi
  └─ SSS eşleşirse bot otomatik yanıtı
```

Otomasyon çağrısı bilerek `await` edilmez: bir kural mesajın iletimini
geciktirmemeli, bozuk bir kural sohbeti kırmamalıdır.

---

## 13. CRM

`deals` tablosu altı aşamalı bir hat tutar: `new → potential → quoted →
negotiation → won / lost`. Fırsatlar organizasyona aittir, bir temsilciye
atanabilir ve panelde sürükle-bırak ile aşama değiştirir (`PUT /api/deals/:id/stage`).

Müşteri tarafı bilgi `visitors` ve `conversations` üzerinde tutulur: ziyaretçi
kimliği, ülke, tarayıcı, işletim sistemi, gezilen sayfa, ilk/son görülme,
konuşma geçmişi ve etiketler.

---

## 14. Ticket Yaşam Döngüsü

`conversations` tablosu aynı zamanda ticket tablosudur; her satır bir
`ticket_number` ve `#0001` biçiminde `ticket_id` taşır.

```
open ──(atama)──> assigned ──> pending ──> resolved ──> closed
  │                                            │
  └────────────── unassigned ──────────────────┘
```

`open` + atanmamış hâli panelde "üstlenilebilir" anlamına gelir; yanıt kutusu bu
durumda kilitlidir.

**SLA:** Her ticket `sla` içinde ilk yanıt ve çözüm hedefi (dakika), durumu
(`pending` / `met` / `breached`) ve ihlal zamanını tutar. `calculateSLA()` bir
sonraki kontrol zamanını da hesaplar. İhlalde `escalation.js` uyarı yayınlar,
yöneticilere bildirir ve ilk yanıt ihlalinde yeniden atama dener.

---

## 15. Otomasyon

```
TETİKLEYİCİ            KOŞUL                        AKSİYON
message_received       message.content contains     send_message
conversation_created   visitor.country equals       add_tag
visitor_event          conversation.priority        assign_agent
schedule               … (8 karşılaştırıcı)         assign_team
                                                    change_status
                                                    internal_note
```

Akış: `socketHandler.runAutomation()` → `automationEngine.evaluateEvent()` →
öncelik sırasıyla kurallar → ilk eşleşen kuralın aksiyonları → `automation_logs`
kaydı + kural sayaçları + `AUTOMATION_EXECUTED` denetim kaydı.

Koşul alanları kural düzenleyicinin sunduğu adlarla aynıdır (`message.content`,
`visitor.country`); değiştirilirse kayıtlı tüm kurallar sessizce bozulur.

**Proaktif kurallar** ayrı bir motordur: widget davranış olaylarını
(`time_on_page`, `exit_intent`, `scroll_depth`, `inactivity`, `custom_event`)
`/api/events/track` üzerinden alır ve mesaj gönderme / widget açma / etiketleme
aksiyonlarını çalıştırır.

---

## 16. AI

```
routes/ai.js  ──►  services/aiService.js  ──►  services/ai/index.js
 (yetki, kiracı,      (görevler, prompt,          (sağlayıcı seçimi)
  hız sınırı)          çıktı sınırlama)                 │
                                                        ▼
                                            VllmProvider | DisabledProvider
```

**Görevler:** özet, yanıt önerisi, yeniden yazma, çeviri, analiz (duygu / niyet /
kategori / önerilen öncelik / etiket), bilgi tabanından yanıt.

**Prompt akışı:** Konuşma dökümü (son 40 mesaj, mesaj başına 2000 karakter) +
ticket bağlamı + yanıt önerisinde sitenin yayınlanmış SSS içerikleri.

**Bilgi akışı:** `knowledgeAnswer` yalnızca SSS içeriğine dayanır; içerik yoksa
modele hiç gitmeden `answered: false` döner.

**Güvenlik:**

- API anahtarı yalnızca sunucuda; tarayıcı kendi `/api/ai` uçlarımızı çağırır.
- Her uç noktada organizasyon sahipliği kontrol edilir.
- Dakikada 20 istek sınırı, kullanıcı kimliğine göre.
- Sağlayıcı yapılandırılmamışsa 503 döner; **sahte içerik üretilmez**.
- Model çıktısı sistemin kabul ettiği değerlere kısıtlanır (bilinmeyen duygu →
  `neutral`, bilinmeyen öncelik → öneri yok).

**Danışma sınırı:** Hiçbir AI görevi müşteriye mesaj göndermez, konuşmanın
durumunu, önceliğini veya etiketini değiştirmez. Temsilci öneriyi *kabul eder,
düzenler, yeniden ürettirir veya reddeder*; gönderme her zaman insana aittir. Bu
kural testle sabitlenmiştir.

---

## 17. Bilgi Tabanı

Bugünkü bilgi tabanı `faqs` tablosudur: soru, cevap, kategori, anahtar kelimeler,
sayfa hedefi, yayın durumu (`is_active`), sıra, görüntülenme ve faydalı bulunma
sayacı.

Arama, PostgreSQL `tsvector` üretilmiş kolonu üzerinden yapılır (`simple`
sözlüğü — içerik Türkçedir ve İngilizce köklerle bozulmamalıdır). Aynı içerik
hem widget'ın otomatik yanıtını hem AI'ın `knowledgeAnswer` görevini besler.

---

## 18. Analitik

Tek uç nokta (`GET /api/analytics/overview?range=today|7days|30days|90days`)
panonun tamamını döndürür. Tüm toplamalar PostgreSQL'de yapılır:

- Başlık kutuları: toplam / açık / çözülen konuşma, atanmamış, SLA ihlali,
  ortalama ilk yanıt ve çözüm süresi, CSAT, çevrimiçi ve toplam temsilci
- Günlük seri (boş günler dahil), saat bazlı yanıt süresi
- Kanal dağılımı, SLA uyumu (ilk yanıt ve çözüm), durum ve öncelik kırılımı
- Departman ve temsilci kırılımı

Temsilcinin kendi sayfası için ayrı uç: `GET /api/team/me/performance?range=7d|30d|90d`.

> Ölçülemeyen bir metrik `null` döner ve arayüzde `—` görünür. Sıfır göstermek
> "anında yanıt" veya "sıfır memnuniyet" anlamına geleceği için yanlıştır.

---

## 19. Bildirimler

Ayrı bir `notifications` tablosu **yoktur**. Bildirimler bugün iki yoldan gider:

1. **Gerçek zamanlı:** `/admin` namespace'ine `notification`, `sla-warning`,
   `sla-breach-escalation` olayları; panel bunları toast olarak gösterir.
2. **Kalıcı sayaç:** Okunmamış mesaj sayısı `conversations.unread_count`
   üzerinden, ekip sohbeti okunmamışları `team_message_read_by` üzerinden
   hesaplanır.

Okundu/okunmadı durumu veritabanında tutulan tam bir bildirim merkezi henüz
yoktur; bkz. bölüm 28.

---

## 20. Denetim Kayıtları

`audit_logs` salt-eklemedir: bir tetikleyici UPDATE'i veritabanı seviyesinde
reddeder.

Her kayıt: `organization_id`, `user_id` (aktör), `action`, `entity_type`,
`entity_id`, `metadata` (jsonb), `ip_address`, `user_agent`, `created_at`.

Kaydedilen eylemler: `LOGIN_SUCCESS`, `LOGIN_FAILED`, `CREATE_AGENT`,
`DELETE_AGENT`, `UPDATE_AGENT_ROLE`, `PLAN_CHANGED`, `UPDATE_SLA`,
`TICKET_CLOSED`, `TICKET_REOPENED`, `SLA_BREACH`, `AUTOMATION_RULE_CREATED`,
`AUTOMATION_RULE_UPDATED`, `AUTOMATION_RULE_DELETED`, `AUTOMATION_EXECUTED`.

Yazma yolu gevşek bağlıdır: rotalar `events.emit(...)` çağırır, `auditService`
dinler. Denetim yazımının başarısız olması asıl işlemi bozmaz.

Yeni bir eylem eklerken hem model enum'u hem `audit_logs_action_check` kısıtı
güncellenmelidir; `schema.sql` bu kısıtı her açılışta düşürüp yeniden kurar.

---

## 21. Widget

`backend/public/widget.js` bağımlılıksız çalışır ve şu adımları izler:

```
1. window.SupportIOConfig.siteKey okunur
2. localStorage'dan kalıcı visitorId alınır (yoksa üretilir)
3. /api/widget-config/public/:siteKey ile görünüm çekilir
4. Socket.IO /widget namespace'ine bağlanılır
5. join-conversation → conversation-joined (geçmiş + karşılama mesajı)
6. Mesajlaşma, yazıyor göstergesi, dosya ekleme
```

Görünüm (renk, konum, marka, karşılama metni, ön-sohbet formu) panelden
`widget_configs` tablosuna yazılır ve widget'ın bir sonraki yüklemesinde etkilidir.

---

## 22. Ortam Değişkenleri

`backend/.env` (örnek için `backend/.env.example`):

| Değişken | Zorunlu | Açıklama |
| --- | --- | --- |
| `PORT` | hayır | Varsayılan 3000 |
| `NODE_ENV` | hayır | `development` / `production` |
| `JWT_SECRET` | **evet** | Token imzalama anahtarı |
| `DATABASE_URL` | evet* | Tam bağlantı dizesi |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | evet* | `DATABASE_URL` yoksa kullanılır |
| `DB_SSL` | hayır | `true` yönetilen veritabanları için |
| `DB_POOL_MAX` | hayır | Varsayılan 10 |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `S3_BUCKET` | dosya yükleme için | Logo ve sohbet eki depolama |
| `S3_ACL` | hayır | Yalnızca ACL açık bucket'larda |
| `AI_*` | hayır | Yerel model ayarları; kök `.env` dosyasından gelir (bkz. `ai/README.md`) |
| `WIDGET_URL` / `ADMIN_URL` | hayır | Bilgilendirme amaçlı |

\* `DATABASE_URL` **veya** `DB_*` grubundan biri zorunludur.

`admin-panel/.env`:

| Değişken | Açıklama |
| --- | --- |
| `VITE_API_URL` | Backend kök adresi. Tarayıcıda çalışır, gizli değer konulmamalıdır |

---

## 23. Yerel Geliştirme

```bash
# 1. Bağımlılıklar
cd backend && npm install
cd ../admin-panel && npm install

# 2. Veritabanı şeması
cd ../backend && npm run db:migrate

# 3. Demo veri (opsiyonel ama önerilir)
npm run db:seed

# 4. Backend
npm run dev            # http://localhost:3000 (PORT ile değişir)

# 5. Admin panel (ayrı terminal)
cd ../admin-panel && npm run dev
```

Şema sunucu açılışında da otomatik uygulanır; `db:migrate` yalnızca sunucuyu
başlatmadan uygulamak içindir.

---

## 24. Demo

```bash
cd backend
npm run db:seed              # demo organizasyon zaten varsa reddeder
npm run db:seed -- --reset   # siler ve yeniden kurar
```

Oluşturulan veri, tek bir demo organizasyonuna bağlıdır ve gerçek kiracılara
dokunmaz:

| İçerik | Adet |
| --- | --- |
| Konuşma / mesaj | 24 / 58 |
| Ziyaretçi | 12 |
| Temsilci | 4 (+1 sahip, 1 yönetici) |
| Departman | 3 |
| SSS | 8 |
| Otomasyon / proaktif kural | 3 / 2 |
| CRM fırsatı | 6 |
| Denetim kaydı | 10 |

**Giriş bilgileri**

| Rol | E-posta | Parola |
| --- | --- | --- |
| Sahip | `owner@demo.support.io` | `Demo1234!` |
| Yönetici | `admin@demo.support.io` | `Demo1234!` |
| Temsilci | `mert@demo.support.io` | `Demo1234!` |

Veri ilişkiseldir: konuşmalar var olan ziyaretçilere ait, var olan temsilcilere
atanmış, mesaj zaman damgaları açılış ile çözüm arasında, SLA alanları bu zaman
damgalarıyla tutarlıdır. Bu sayede panolar gerçekçi rakamlar gösterir.

---

## 25. Test

```bash
cd backend
npm start          # testler çalışan sunucuya karşı koşar (ayrı terminal)
npm test
```

Testler Node'un yerleşik koşucusunu kullanır (ek bağımlılık yok):

| Dosya | Kapsam |
| --- | --- |
| `tests/automation.e2e.test.js` | Kural oluşturma → widget mesajı → kural tetikleme → etiket + bot yanıtı + çalışma kaydı + denetim kaydı; kiracı izolasyonu; doğrulama |
| `tests/analytics.e2e.test.js` | Toplamanın 50 satır sınırını aştığı, rakamların satırlarla uyuştuğu, pencere filtresi, kiracı izolasyonu |
| `tests/agentPerformance.e2e.test.js` | Gerçek satırlardan türeyen metrikler, veri yokken `null`, aralık doğrulaması |
| `tests/ai.e2e.test.js` | Her AI görevinde kiracı izolasyonu, doğrulama, danışma sınırı (öneri müşteriye gitmez) |
| `tests/ai.provider.test.js` | Sağlayıcı seçimi, hata çevirisi, JSON ayrıştırma, çıktı sınırlama (ağ gerektirmez) |

Testler gerçek bir model çağırmaz; model davranışı sahte sağlayıcı ve yerel sahte HTTP sunucusuyla sınanır.

**Son durum:** 37 test — 35 geçti, 2 atlandı, 0 hata (hem yerelde hem Docker'da).

---

## 26. Docker

```bash
docker compose build
docker compose up -d
```

Servisler:

| Servis | İmaj | Port (varsayılan) | Sağlık kontrolü |
| --- | --- | --- | --- |
| `postgres` | postgres:16 | 5432 | `pg_isready` |
| `backend` | yerel derleme (node:22-alpine) | 5000 → 3000 | `/health` (veritabanı bağlantısını da doğrular) |
| `admin` | yerel derleme (node:22-alpine) | 5173 | — |
| `proxy` | caddy:2 | 80 | — |

Tüm host portları değiştirilebilir; makinede zaten PostgreSQL veya 5000'de bir
API varsa gerekir:

```bash
POSTGRES_PORT=5433 BACKEND_PORT=5001 ADMIN_PORT=5174 PROXY_PORT=8081 docker compose up -d
```

Docker içinde migration ve seed:

```bash
docker compose exec backend npm run db:migrate
docker compose exec backend npm run db:seed
docker compose exec backend npm test
```

**Vekil kuralları** (`Caddyfile`): `/api/*`, `/socket.io/*`, `/widget.js` ve
`/health` backend'e; kalan her şey admin paneline gider. `/api` ön eki
**soyulmaz** — backend rotalarını kendisi `/api` altına bağlar.

**node_modules volume'ları:** `backend_node_modules` ve `admin_node_modules`
adlandırılmış volume'lardır ve imajın klasörünü gölgeler. Bağımlılık eklendiğinde
veya Node sürümü değiştiğinde eski içerik kalır; bu durumda:

```bash
docker compose rm -f backend admin
docker volume rm support_chat_app_backend_node_modules support_chat_app_admin_node_modules
docker compose up -d
```

---

## 27. Üretim

`docker-compose.yml` **geliştirme** yığınıdır: admin servisi Vite geliştirme
sunucusunu çalıştırır ve kaynak dizinini bind-mount eder. Üretim için ayrı bir
tanım gerekir; bugünkü depo bunu içermez (bkz. bölüm 28).

Üretim yaklaşımı:

1. `cd admin-panel && npm run build` → statik `dist/`
2. Backend `dist/`i zaten servis eder (`server.js` içinde `express.static`) ve
   SPA geri dönüşü yapar
3. `NODE_ENV=production`, `npm start` (nodemon değil)
4. `JWT_SECRET` ve veritabanı bilgileri ortamdan; `.env` imaja konulmaz
5. `server.js` içindeki `allowedOrigins` listesine üretim alan adı eklenmelidir
6. `app.set('trust proxy', 1)` zaten ayarlı (Cloudflare/ters vekil arkasında
   gerçek IP için)

---

## 28. Bilinen Sınırlar

Bunlar bilinçli olarak açık bırakılmıştır, gizlenmemiştir:

| Konu | Durum |
| --- | --- |
| **Bildirim merkezi** | Gerçek zamanlı bildirim ve okunmamış sayacı var; okundu/okunmadı durumunu veritabanında tutan ayrı `notifications` tablosu yok |
| **Bilgi tabanı** | `faqs` üzerinden çalışıyor; kategori/koleksiyon hiyerarşisi, taslak-yayın-arşiv yaşam döngüsü, sürüm geçmişi ve SEO alanları yok |
| **CSAT toplama** | `conversations.rating` alanı, analitiği ve demo verisi mevcut; sohbet sonunda müşteriye puan soran widget akışı yok |
| **Omnichannel** | `channel` alanı ve modeli `email` / `whatsapp` / `phone` değerlerini destekliyor, ancak **yalnızca `web-chat` için gerçek sağlayıcı entegrasyonu vardır**. Diğer kanallar veri modelinde hazırdır, canlı bağlantısı yoktur |
| **Global arama** | Konuşma listesi içinde filtreleme var; konuşma + müşteri + ticket + makale üzerinde birleşik arama yok |
| **Üretim Docker tanımı** | Yalnızca geliştirme yığını mevcut |
| **Redis / kuyruk** | Kullanılmıyor. Tek sunucu için gerekmiyor; yatay ölçeklemede Socket.IO adaptörü gerekecek |
| **AI canlı testi** | Gerçek model yalnız GPU olan makinede `npm run ai:bench` ile sınanır |

---

## 29. Sorun Giderme

| Belirti | Sebep ve çözüm |
| --- | --- |
| `PostgreSQL connection failed: ECONNREFUSED` | Veritabanı çalışmıyor veya `DB_HOST`/`DB_PORT` yanlış |
| `password authentication failed` | `DB_USER` / `DB_PASSWORD` hatalı |
| `database ... does not exist` | `DB_NAME` ile belirtilen veritabanı oluşturulmamış |
| `secretOrPrivateKey must have a value` | `JWT_SECRET` tanımsız veya **boş string**. Docker'da `- JWT_SECRET` (geçişli) kullanın; `${JWT_SECRET:-}` boş atar ve dotenv onu ezmez |
| `EADDRINUSE :::5000` | Port kullanımda. `PORT` değiştirin veya `BACKEND_PORT` ile Docker portunu kaydırın |
| Docker'da `Cannot find module 'pg'` | `backend_node_modules` volume'u eski. Bölüm 26'daki volume yenileme adımlarını uygulayın |
| Vekil üzerinden API 404 | `Caddyfile` içinde `handle_path` kullanılmış olabilir; ön eki soyar. `handle /api/*` olmalı |
| CORS hatası | `server.js` içindeki `allowedOrigins` listesine panel adresi eklenmemiş |
| AI düğmeleri görünmüyor | Model kapalı/yükleniyor veya `AI_ENABLED=false`. `GET /api/ai/status` durumu söyler |
| `AccessControlListNotSupported` (S3) | Bucket "owner enforced" modunda. `S3_ACL` tanımlı olmamalı |
| Analitikte her şey sıfır | Demo veri yok. `npm run db:seed` çalıştırın |
| Testler `register failed` diyor | Backend çalışmıyor. Testler ayrı terminalde çalışan sunucuya karşı koşar |
