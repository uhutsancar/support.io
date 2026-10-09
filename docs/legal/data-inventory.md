# Kişisel veri envanteri

> Plan v10 LEG-03. Koddan çıkarıldı (veritabanı şeması, migration 0015,
> 8 Ekim 2026): hangi tabloda hangi kişisel veri, kimin verisi, neden,
> ne kadar süre ve nasıl silindiği. VERBİS kaydı gerekirse (LEG-03,
> muhasebeci/hukukçu ile) bu tablo envanterin temelidir. Yeni bir tablo ya
> da sütun kişisel veri taşıyorsa bu belge aynı commit'te güncellenir.
>
> **Rol:** "Sorumlu" = Support.io veri sorumlusu (kendi müşterisi ve ekibi);
> "İşleyen" = Support.io müşteri adına veri işleyen (ziyaretçi verisi).
>
> Süre kaynakları: `domain/plans.ts` (`retention`), `services/dataRetention.ts`
> (gece silme, ziyaretçi silme), `db/retention.ts` (saatlik tarama),
> `services/organizationDeletion.ts` (hesap silme).

## Hesap ve ekip (Sorumlu)

| Tablo | Kişisel veri | Amaç | Hukuki sebep | Süre | Silme |
|---|---|---|---|---|---|
| `users` | ad, e-posta, şifre özeti (bcrypt), profil fotoğrafı, iki adımlı sır (şifreli), kurtarma kodu özetleri, bağlı Google hesabının kimliği ve e-postası (PRD-14, kullanıcı bağlarsa), tercih, son durum | Hesap, giriş, güvenlik | Sözleşme | Hesap silinene kadar; doğrulanmamış kayıt 7 gün | Hesap silmede anonimleştirilir (ad, e-posta, şifre, 2FA, Google bağlantısı silinir), oturumlar kapanır |
| `teams` | `users` ile aynı + telefon, kısa tanıtım, beceriler | Ekip üyesi hesabı | Sözleşme | Üye çıkarılana / hesap silinene kadar | `users` ile aynı; telefon ve tanıtım da silinir |
| `invitations` | davet edilen e-posta, rol | Ekip daveti | Sözleşme | Kabul, iptal ya da süre dolumundan 90 gün sonra | Saatlik tarama siler; organizasyonla birlikte silinir |
| `auth_tokens` | e-posta bağlantılarının özeti, (e-posta değişikliğinde) yeni adres | Doğrulama, şifre sıfırlama, e-posta değişikliği | Sözleşme | Süre dolumundan 7 gün sonra | Saatlik tarama |
| `audit_logs` | kullanıcı kimliği, işlem, IP adresi, tarayıcı | Güvenlik, denetim | Hukuki yükümlülük; meşru menfaat | Kayıt organizasyonla birlikte; IP ve tarayıcı 90 gün | Saatlik tarama IP/tarayıcıyı boşaltır |
| `push_subscriptions` | tarayıcı bildirim uç noktası ve anahtarları, tarayıcı | Masaüstü bildirimleri (PRD-09) | Sözleşme (kullanıcı açarsa) | Tablo var, henüz kullanılmıyor; PRD-09 ile süre ve silme yazılır | Organizasyonla |
| `team_chats`, `team_messages` (+ katılımcı tabloları) | ekip içi mesaj, gönderen adı | Ekip sohbeti | Sözleşme | Organizasyon silinene kadar | Organizasyonla birlikte |
| `conversation_internal_notes` | ekip notu | Sohbete iç not | Sözleşme | Sohbetle birlikte | Sohbet silinince (cascade) |
| `assistant_feedback` | temsilcinin yanıt değerlendirmesi ve notu | Asistan kalitesi | Meşru menfaat | Sohbetle birlikte | Sohbet silinince; temsilci geri alabilir |
| `organizations`, `subscriptions`, `billing_events` | sahibin kimliği, plan, Paddle müşteri/abonelik kimliği | Hizmet, faturalandırma | Sözleşme; hukuki yükümlülük | Hesap silinene kadar | Organizasyonla; fatura kayıtlarını Paddle tutar |
| `missed_chat_notices` | hesap kimliği, bildirim zamanı | Kaçan sohbet e-postası | Sözleşme | Organizasyonla | Organizasyonla |

## Ziyaretçi (İşleyen — veri sorumlusu müşteri)

| Tablo | Kişisel veri | Amaç | Süre | Silme |
|---|---|---|---|---|
| `conversations` | ziyaretçi kimliği, verdiyse ad / e-posta / telefon, ön form cevapları, bulunduğu sayfa, onay zamanı, memnuniyet puanı, etiketler | Sohbet | Müşterinin seçtiği süre (Ücretsiz 90 gün; ücretli 30 gün–5 yıl), son mesajdan itibaren | Gece silme (SEC-17); müşteri panelden sohbeti ya da ziyaretçinin tüm verisini siler |
| `messages` | mesaj metni, gönderilen dosyanın adı ve adresi | Sohbet | Sohbetle | Sohbetle (cascade); dosyalar depodan silinir |
| Dosya deposu (yerel / S3 / R2) | ziyaretçinin gönderdiği dosyalar, logolar | Sohbet eki | Sohbetle | Sohbet ve hesap silmede depodan silinir |
| `visitors` | ziyaretçi kimliği, IP adresi, ülke, tarayıcı, işletim sistemi, sayfa, geldiği sayfa | Canlı ziyaretçi listesi, güvenlik | IP/tarayıcı/işletim sistemi/geldiği sayfa son ziyaretten 90 gün | Saatlik tarama boşaltır; ziyaretçi silmede satır silinir |
| `event_logs` | ziyaretçi kimliği, oturum, sayfa adresi, geldiği sayfa, tarayıcı | Sayfa hareketi, proaktif kurallar | 30 gün | Saatlik tarama; ziyaretçi silmede |
| `proactive_trigger_logs` | ziyaretçi kimliği | Proaktif mesaj ölçümü | Kural/site ile | Ziyaretçi silmede; site silmede |
| `visitor_blocks` | ziyaretçi kimliği, IP adresinin tuzlanmış özeti, gerekçe | Kötüye kullanımı engelleme | Engel süresi (müşteri seçer) | Müşteri kaldırır; site/organizasyonla |
| `deals` | kişi adı, e-posta, telefon, not | Müşterinin CRM kaydı | Müşteri silene kadar | Müşteri siler; organizasyonla |
| `knowledge_sources`, `knowledge_chunks` | işletmenin eklediği site sayfalarının ve PDF belgelerinin metni (belgenin kendisi saklanmaz); ekleyen kullanıcının kimliği | Asistanın SSS dışında yanıt verdiği kaynaklar (PRD-21) | Sözleşme | Müşteri kaldırana kadar | Müşteri kaldırır; site ve organizasyonla birlikte silinir (cascade). Panel yalnızca herkese açık bilgi eklenmesini ister |
| Tarayıcı deposu (ziyaretçinin cihazında) | imzalı oturum, verdiyse ad ve e-posta | Konuşmanın sürmesi | Ziyaretçi silene kadar | Ziyaretçinin tarayıcısında ([Çerez Politikası](cerez-politikasi.md)) |

## Kişisel veri içermeyen ya da yalnız toplu sayılar

`sites`, `widget_configs`, `faqs`, `departments` (+ üyelik tabloları),
`automation_rules`, `automation_logs` (30 gün), `proactive_rules`,
`saved_replies`, `conversation_tag_catalog`, `organization_usage_monthly`
(toplu sayılar), `counters`, `schema_migrations`.

> `sites.integrations.identitySecret` bir anahtardır, kişisel veri değildir;
> şifreli saklanır.

## Sistem dışı kopyalar

| Yer | Ne | Süre |
|---|---|---|
| Şifreli veritabanı yedekleri (age) | Tümü | [SAHİP: saklama — runbook §5] |
| WAL arşivi (PITR, açıksa) | Tümü (değişiklik kayıtları) | WAL-G saklama ayarı |
| Uygulama günlükleri | İstek bilgisi; e-posta maskeli, şifre ve anahtar kaydedilmez | Docker günlük döndürmesi; uzak gönderim açıksa orada [SAHİP] |
| Hata raporları (OBS-01, açıksa) | Teknik veri; e-posta, çerez, IP temizlenmiş | Sağlayıcı ayarı |
| Yapay zekâ sağlayıcısı | Gizlenmiş soru + herkese açık SSS, yalnız asistan açıksa | Sağlayıcı şartları (KARAR-AI-1) |

## Açık noktalar

- `team_messages` hesap açık kaldıkça süresiz tutulur. Bir saklama süresi
  (ör. 1 yıl) **[SAHİP]** kararıdır; karar verilirse gece silmeye eklenir.
- Yedek saklama süresi ve WAL-G saklama ayarı canlı sunucuda belirlenince
  bu tabloya ve Gizlilik Politikası'na yazılır.
