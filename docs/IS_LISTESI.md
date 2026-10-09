# Support.io — İş listesi

Tüm isteklerin tek listesi: plan (8) "AI'sız Production SaaS", plan (9) "Gemini
asistanı" ve sohbette verilen ek istekler. Her madde bitince işaretlenir ve
hangi commit'te yapıldığı yazılır. `[ ]` bekliyor · `[~]` yarım · `[x]` bitti ·
`[!]` kullanıcı adımı gerekiyor (sunucu, DNS, ödeme hesabı gibi dış dünya).

Not: Plan (8)/(9) işleri `feat/production-saas` dalında yapıldı. Plan v10
işleri (bölüm E) `feat/prod-readiness-v10` dalında; push ve `main`'e
birleştirme sahibin talimatıyla, tüm doğrulamalar geçtikten sonra yapılır.

## A. Plan (8) — production SaaS

| # | İş | Durum | Commit |
|---|---|---|---|
| 1 | Keşif, baseline | [x] | — |
| 2 | Hızlı prod düzeltmeleri (HSTS, sabit IP, `/` rotası, `/demo`, upload, lockfile) | [x] | 039d624 |
| 3 | Eski self-hosted AI'ın kaldırılması | [x] | 6c188b6 |
| 4 | İmzalı widget oturumu + site başına izinli adresler | [x] | d5c312d |
| 5 | Tenant izolasyonu + IDOR testleri | [x] | d64795d |
| 6 | Versiyonlu migration'lar | [x] | d5c312d |
| 7 | Mesaj güvenilirliği (idempotency, ack, reconnect, socket limitleri) | [x] | 7a38ba5 |
| 8 | E-posta servisi, doğrulama, şifre sıfırlama | [x] | 72c1ec8 |
| 9 | Davet akışı | [x] | eee0d93 |
| 10 | Plan limitleri + aylık konuşma kotası | [x] | eee0d93 |
| 11 | Paddle sandbox: webhook, abonelik, plan geçişleri (backend) | [x] | d66ad81 |
| 11b | Paddle: panelde Faturalandırma + ödeme sayfası | [x] | 18a6de7 |
| 12 | `/health` + `/ready`, env fail-fast, graceful shutdown, upload kararı (A: S3 uyumlu depo) | [x] | a763cd5 |
| 13 | CI (GitHub Actions) + release (GHCR) — dosyalar hazır, ilk çalıştırma push sonrası | [x] | 424bc92, dce2f92 |
| 14 | Prod compose, Caddy, deploy/rollback/backup/restore script'leri | [x] | 0d584de |
| 15 | VPS + Cloudflare kurulum adımları — runbook yazıldı (docs/production-runbook.md); sunucu, alan adı, Cloudflare hesabı sizde | [!] | 0d584de |
| 16 | Staging + kabul testleri — runbook'ta adımlar var; sunucu gerekiyor | [!] | |
| 17–18 | Kapalı beta, ücretli lansman | [!] | |
| P2 | Yapılandırılmış log, KVKK dışa aktarma, IP saklama süresi (90 gün), Gizlilik/Şartlar sayfaları | [x] | 342b942 |
| — | Bağımlılık güvenliği: nodemailer 10, `npm audit` 0 açık (iki pakette de) | [x] | 9cc5b3c |

### §18 Testler

| Test | Durum | Sonuç | Commit |
|---|---|---|---|
| Birim + DB/e2e (izolasyon, sahte ziyaretçi, mükerrer mesaj, eşzamanlı açılış/kota/davet, Paddle sırası, token tekrarı) | [x] | 133/133 | (her görevle) |
| Redis düşme testi: Redis durdur → REST ve mesaj kaydı → geri gelince bağlantı | [x] | Redis kapalıyken API asılı kalıyordu, düzeltildi; kapalıyken ve geri gelince 19/19 | 1cf8b7f |
| E2E (Playwright): kayıt → doğrulama → site → widget mesajı → temsilci cevabı → yenileme sonrası geçmiş → kapatma → yükseltme ve limit artışı | [x] | 2/2, yerelde ve CI benzeri ortamda; CI'da ayrı iş | a794c6a |
| Bu testin bulduğu hata: widget bağlanmadan yazılan ilk mesaj kayboluyordu | [x] | Düzeltildi, regresyon testi eski kodda düşüyor, yenide geçiyor | 03438d5 |
| Yük testi: 100 / 500 / 1.000 soket, 50 mesaj/sn | [x] | Hatasız; ayrıntı ve sınırları `docs/load-test.md` | b9f218e |
| Yük testinin bulduğu darboğaz: konuşma açılışı iki satırda sıraya giriyordu (500 sokette 216/500 mesaj zaman aşımı) | [x] | Düzeltildi; 0 hata, ACK p95 0,6–1,5 sn | a2b5137 |

Yük testi rakamları geliştirme makinesini anlatır (dizüstü, Docker Desktop,
geliştirme modu); üretim kapasitesi diye yazılmaz. Staging'de tekrar ölçülmeli.

## A2. Plan (6) — ayrıntılı plan, madde madde kontrol

Plan (8), plan (6)'nın depoya göre kısaltılmış hâlidir. Plan (6) baştan sona
ayrıca okundu; plan (8)'de karşılığı olmayan ya da eksik kalan maddeler
bulunup tamamlandı:

| Plan (6) maddesi | Bulunan durum | Yapılan |
|---|---|---|
| §8.2 Hız sınırları: site oluşturma, davet, soket bağlantısı | Yoktu (davet e-postasıyla spam açığı) | Kurum başına saatte 20 site / 20 davet; soket: panel IP başına dakikada 30, widget site+IP başına 60; widget ve panel sınıra takılınca kendiliğinden yeniden dener |
| §21 Denetim kaydı: site ekleme/değiştirme/silme, widget ayarları, konuşma atama | Yazılmıyordu | Beş yeni eylem (migration 0008), panelde filtre ve Türkçe/İngilizce adlar; içerik değil yalnızca neyin değiştiği yazılır |
| §22 Kurum (çalışma alanı) silme | Sahip "Hesabı sil" deyince yalnızca kendi satırı kapanıyordu; siteler ve ziyaretçi verisi kalıyordu | Şifre onayıyla tüm çalışma alanı, verisi ve yüklenen dosyaları silinir; hesaplar anonimleşir; aktif abonelik önce iptal ister |
| §39.1 Başlangıç adımları: "test mesajı gönder" | Listede yoktu | Panelde kurulum listesine eklendi |
| §46 Yönetim betikleri: kurumları listele, siteyi kapat | Yalnızca plan değiştirme vardı | `org:list`, `site:disable` (denetim kaydıyla) |
| §49 Güvenlik listesi: izinsiz CORS, SQL benzeri arama, hata yanıtında yığın izi | Testi yoktu; bozuk JSON 500 dönüyordu | Testler eklendi; bozuk JSON artık 400 |
| Müşteriye sağlayıcı adı | Asistan kapalıyken bir hata mesajında `GEMINI_API_KEY` yazıyordu | Nötr mesaj |

Plan (6)'da olup zaten tamam olanlar (kodda doğrulandı): giriş hatasında
e-posta ifşası yok; tek SLA zamanlayıcısı; SSS otomatik cevabı varsayılan
kapalı; Caddy'de Cloudflare IP'leri ve güvenlik başlıkları; dağıtım kilidi
(flock) ve dağıtım öncesi yedek; yedekte sha256, şifreleme, off-site ve
7/4/3 saklama; kurulum rehberinde CSP ve gizlilik notu; widget konumu ve
sürüm sabitleme.

Plan (6) "AI YOK" der; plan (9) ve sizin sonraki isteğiniz bunu değiştirdi:
yalnızca SSS'den yanıt veren yapay zekâ asistanı var, müşteriye sağlayıcı adı
gösterilmez.

## B. Plan (9) — Yapay zekâ asistanı (Gemini)

| İş | Durum | Commit |
|---|---|---|
| Asistan backend (yalnız SSS'den yanıt, devir, gizlilik, kota/hata yönetimi) | [x] | 6c188b6 |
| Gerçek anahtarla bağlantı testi (ücretsiz katman) | [x] | 6c188b6 |
| Panelde site başına aç/kapat, gelen kutusunda "Asistan" etiketi, Devral | [x] | 6c188b6 |

## C. Sohbette verilen ek istekler

| İş | Durum | Commit |
|---|---|---|
| Pazarlama metinleri: e-ticaret demo sohbeti yerine mantıklı Support.io sohbeti | [x] | acbcdcd |
| Kurulum rehberi: rakipler gibi kısa; React/Vue/Angular/Next.js kopyala-yapıştır; localhost yok | [x] | acbcdcd |
| Header açılır menüleri kendi başlığının altında açılsın | [x] | acbcdcd |
| Fiyatlar sunucudaki plan tablosundan gelsin | [x] | acbcdcd |
| **Yapay zekâ asistanı sitede ve panelde ürün olarak anlatılsın** (ayrı sayfa, ana sayfada bölüm, ürünler arasında; Gemini/teknik bilgi yazılmaz) | [x] | 09a0508, 18a6de7 |
| Panelde ayrı "Yapay Zekâ Asistanı" sayfası (site başına aç/kapat, son 30 gün) | [x] | 18a6de7 |
| Planlarda yapay zekâ farkı (Kurumsal'da daha iyi deneyim, kullanım limitleri) | [x] | 18a6de7 |
| Kurumsal plan: "Size özel" yok; aylık 1.449 TL, somut özellikler | [x] | 18a6de7, 09a0508 |
| Ödeme ekranı sayfası (Pro/Kurumsal'a geçiş) + uygun yerlerden yönlendirme | [x] | 18a6de7 |
| Fiyatlar sayfasında giriş yapmış kullanıcı doğrudan ödeme sayfasına; yıllık indirim satırı, sipariş özeti | [x] | d25bfbc |
| Ücretli özellik ücretsiz planda açılınca "planınızı yükseltin" mesajı + yönlendirme | [x] | 18a6de7 |
| sancaruhut@gmail.com: sahip (owner) + en yüksek plan, her şeyi kullanabilsin | [x] | (veritabanı, denetim kaydıyla; 2026-10-06 tekrar doğrulandı: owner, aktif, doğrulanmış, ENTERPRISE, tüm izinler) |
| Admin panelde sitenin kendi sohbet balonu görünmesin | [x] | 18a6de7 |
| Siteler kartı taşıyor (rozetler, kurulum kodu, butonlar) | [x] | 18a6de7 |
| Ekip sohbeti: "+" ile açılan "Üye seçin" / "Grup oluştur" panelleri siyah görünüyor | [x] | 18a6de7 |
| Konuşmalar sayfası çok dar; daha geniş ve ferah olsun | [x] | 18a6de7 |
| Konuşmalar arasında geçerken ekran zıplıyor (sonsuz yeniden yükleme + sayfa kaydırma hatası) | [x] | 18a6de7 |
| Gereksiz yazılar kalksın: "Bu tek satır her framework'te aynıdır…", "Balon yapıştırdığınız dakika içinde görünür", "Fiyatlara KDV dâhil değildir…" | [x] | 09a0508 |
| Başlıkların üstündeki "01 / Ürün turu" gibi numaralar kalksın | [x] | 09a0508 |
| Özellik sayfalarındaki "Teknik not" bölümleri ve teknik anlatımlar kalksın | [x] | 09a0508 |
| Logo her yerde aynı ve düzgün olsun | [x] | 09a0508 |
| Tüm sayfalar gözden geçirilsin: gereksiz bilgi yok, rakipler gibi satışa yönelik metin | [x] | 09a0508 ve sonrası |

## D. Sizin yapmanız gerekenler (dış dünya)

Kod tarafı hazır; aşağıdakiler hesap, ödeme veya karar gerektirdiği için
yapılmadı ve "bitti" sayılmadı. Ayrıntılı adımlar: `docs/production-runbook.md`.

1. Dalı GitHub'a push edip CI'ın yeşil yandığını görmek; `main`'e birleştirmek
   (release iş akışı imajı GHCR'a o zaman koyar).
2. VPS kiralamak (Ubuntu 24.04, 2 vCPU / 4 GB), alan adını Cloudflare'e almak.
3. `.env.production` doldurmak: SMTP sağlayıcısı, S3/R2 bucket, güçlü
   `JWT_SECRET` ve `DB_PASSWORD`, (isterseniz) `GEMINI_API_KEY`.
4. Yedekler için off-site bucket + `rclone` + `age` anahtarı; ayda bir geri
   yükleme testi.
5. Paddle sandbox hesabı: ürün/fiyatlar (Pro 490 TL, Kurumsal 1.449 TL; aylık
   ve yıllık), API anahtarı, client token, webhook adresi; sandbox kabul testi.
6. Gizlilik Politikası ve Kullanım Şartları metinlerini bir hukukçuya
   kontrol ettirmek (alt işleyenlerin adlarının yazılması gerekebilir).
7. Paddle'ın kendi ödeme penceresinde sandbox kartıyla bir ödeme yapmak:
   E2E testi Paddle'ın ödeme sonrası gönderdiği imzalı bildirimi taklit eder,
   gerçek pencere sandbox hesabı ister.
8. Staging sunucusunda `npm run loadtest` ile ölçüm (kapasite rakamı ancak
   oradan söylenebilir).
9. Production veritabanı boş başlar: canlıda sancaruhut@gmail.com ile kayıt
   olduktan sonra bir kez
   `exec backend npm run plan:set:prod -- sancaruhut@gmail.com ENTERPRISE`
   çalıştırın (runbook §3). Sohbette yazdığınız şifreyi de değiştirin.

Not: `Downloads/plan (6).md` planın eski (v6) sürümüdür; yerini plan (8)
(v7) aldı. Bu liste plan (8) ve plan (9)'a göre tutulur.

## E. Plan v10 — Production'a çıkış planı

Dal: `feat/prod-readiness-v10`. `[x]` kodda yapıldı ve test edildi ·
`[!]` kod/belge hazır, son adım sizin (hesap, ödeme, hukukçu, sunucu) ·
`[ ]` yapılmadı (gerekçesi yanında).

### Başlangıç durumu (F0-01)

`main` 1d9c050 (6 Ekim 2026): backend testleri 141/141 geçiyordu; planın
B-01…B-20 bulguları (bağımlılık açıkları, eksik oturum yönetimi, dosya imzası
denetimi yok, yedek doğrulaması yok, hukuk sayfaları eksik…) tek tek
doğrulandı ve aşağıdaki görevlerle kapatıldı.

### Görevler

| Görev | Durum | Commit |
|---|---|---|
| F0-01 Başlangıç ölçümü | [x] | bu bölüm |
| F0-02 İş listesi | [x] | bu bölüm |
| SEC-01 Üretim bağımlılık açıkları | [x] | 62d04b9 |
| SEC-02 CI bağımlılık kapısı | [x] | c851bde |
| SEC-03 Şifre/e-posta değiştirme, tüm cihazlardan çıkış | [x] | 8fb6e5a, b5c71b7 |
| SEC-04 İki adımlı doğrulama | [x] | 8fb6e5a, b5c71b7 |
| SEC-05 Platform yöneticisi ayrımı | [!] | 8fb6e5a (2FA); canlıda `plan:set:prod … --exempt` ve 2FA açma sizde (SAHİP-16) |
| SEC-06 Kayıt kötüye kullanımı (Turnstile, tek kullanımlık e-posta) | [x] | 8fb6e5a, f2ee414 |
| SEC-07 Dosya içerik imzası | [x] | ac1c78b |
| SEC-08 Özel dosyalar, imzalı bağlantı | [x] | ac1c78b |
| SEC-09 Ziyaretçi engelleme, spam | [x] | 3283fbd |
| SEC-10 security.txt | [x] | 48e5ddd, f12b920 |
| SEC-11 CSP raporlama | [x] | d8fbfef |
| SEC-12 Redis savunması | [x] | 9dde8b0 |
| SEC-13 Cloudflare sertleştirme | [!] | f72e339 (betik ve runbook); Cloudflare panelinde uygulama sizde |
| SEC-14 VPS sertleştirme | [!] | f72e339, ae7305b; sunucuda çalıştırma sizde |
| SEC-15 Socket olay şeması | [x] | cb565a8 |
| SEC-16 Loglarda kişisel veri | [x] | 89e0012 |
| SEC-17 Saklama süreleri | [x] | ef0502a |
| SEC-18 Sır döndürme | [x] | 381e392 |
| SUP-01 Caddy sürümü | [x] | 9dde8b0 |
| SUP-02 İmajlar digest ile | [x] | 9dde8b0 |
| SUP-03 İmaj taraması, SBOM | [x] | c851bde |
| SUP-04 Runtime imajı sertleştirme | [x] | 9dde8b0 |
| SUP-05 Lisanslar | [x] | d888739 |
| SUP-06 GitHub depo ayarları | [!] | d888739 (belge); ayarları açmak sizde (SAHİP-10) |
| SUP-07 Sürüm planı | [x] | d888739 |
| DOC-01 SECURITY.md | [x] | f12b920 |
| AI-01 Model adı ve açılış denetimi | [x] | ea13a8f |
| AI-02 Bölgesel kullanım | [x] | dec6d5b |
| AI-03 Şeffaflık etiketi | [x] | 5eb560c |
| AI-04 KVKK ve sözleşme zemini | [!] | 5eb560c (onay penceresi); hukukçu ve aktarım sözleşmeleri sizde |
| AI-05 Değerlendirme seti | [x] | c691d55 |
| AI-06 Çıktı güvenliği | [x] | c691d55 |
| AI-07 Maliyet, kapatma düğmesi | [x] | ea13a8f |
| AI-08 Sayfa/PDF bilgi kaynağı | [x] | 37fac53 — yanıt önerisi, özet, ton, çeviri PRD-20 ile (aşağıda) |
| OBS-01 Hata izleme | [!] | 1273534 (SDK'sız, Sentry protokolü); DSN için hesap sizde |
| OBS-03 Operasyon metrikleri | [x] | 80c4430 |
| OBS-04 Eşik alarmları | [x] | 5afdab0, 80c4430 |
| OBS-05 Log toplama | [x] | 5afdab0 |
| OBS-06 Durum sayfası, olay yönetimi | [x] | 1bc96df |
| OBS-07 Ürün raporu | [x] | 6b13f49 |
| PERF-01 Performans bütçeleri | [x] | 40b03e9, c851bde |
| PERF-02 Widget yükleme | [x] | d9c298d |
| PERF-03 Veritabanı | [x] | 86297f5 |
| PERF-04 Uygulama içi önbellek | [x] | ea7e0ab |
| PERF-06 Yeniden bağlanma fırtınası | [x] | af2135a |
| PERF-07 24 saatlik dayanıklılık | [x] | af2135a (betik); staging'de çalıştırma sizde |
| PERF-08 Pazarlama sitesi performansı | [x] | 40b03e9 |
| DR-01 RPO/RTO hedefleri | [!] | 2194004; hedefleri onaylamak sizde (KARAR-DR-1) |
| DR-02 PITR (WAL-G) | [x] | 2194004 |
| DR-03 Yedek doğrulama | [x] | a92c248 |
| DR-04 Dosya ve Caddy verisi | [!] | 9dde8b0 (yerel yükleme açılışta reddedilir), 2194004 (bucket sürümleme adımı); bucket ayarı sizde |
| DR-05 "Sunucu yandı" tatbikatı | [!] | 2194004 (prosedür); staging'de tatbikat sizde |
| DR-06 Sırların saklanması | [!] | 2194004 (belge); parola yöneticisi sizde |
| UX-01 Widget erişilebilirliği | [x] | acf873c |
| UX-02 Panel erişilebilirliği | [x] | 64d7730, 09021ec |
| UX-03 Mobil widget | [x] | 3335903 |
| UX-04 Widget kullanılabilirliği | [x] | 7b544ac |
| UX-05 Panel kullanılabilirlik incelemesi | [x] | 737b199 |
| UX-06 i18n | [x] | 594510d |
| MKT-01 Alan adı bağımsız SEO | [x] | 5b195cc, ec159b5 |
| MKT-02 robots, sitemap | [x] | 5b195cc |
| MKT-03 Sayfa başlıkları, önizleme | [x] | ec159b5 |
| MKT-04 İçerik, karşılaştırma, KDV notu | [x] | c642ce8, 502c654, a0f4f04, 9589af0 — karşılaştırmalar hukukçu onayına kadar yayında değil |
| MKT-05 Marka ve alan adı | [!] | sizde (SAHİP-05) |
| LEG-01 Hukuk sayfaları | [!] | 04a910c, 488dcec (taslaklar); hukukçu onayı sizde |
| LEG-02 Şirket ve vergi | [!] | sizde |
| LEG-03 KVKK işlemleri | [!] | 04a910c (envanter, aktarım listesi); başvurular sizde |
| LEG-04 Müşteri sitesi gizlilik paragrafı | [x] | 97e5db2 |
| LEG-05 Kabul edilebilir kullanım | [!] | 488dcec; hukukçu onayı sizde |
| LEG-06 Ticari elektronik ileti | [!] | sizde |
| LEG-07 Erişilebilirlik ve yapay zekâ beyanı | [x] | 9e443d3 — yayın hukukçu onayıyla |
| BIL-01 Paddle hesabı | [!] | 37bba3d (kontrol listesi); hesap sizde |
| BIL-02 Sandbox kabul senaryoları | [!] | 37bba3d; sandbox kartıyla deneme sizde |
| BIL-03 Fiyat kaynağının tekliği | [x] | 3d26b8f |
| BIL-04 Plan düşürmede limit aşımı | [x] | f342229 |
| BIL-05 Başarısız ödeme | [x] | a8af727 |
| BIL-06 Kurumsal fatura | [x] | 6758f34 |
| TST-01 Playwright senaryoları | [x] | da207c8, 5072da5 ve her PRD'nin kendi senaryosu |
| TST-02 Backend kapsamı | [x] | 9937ebf |
| TST-03 Güvenlik testleri | [x] | 8dffeef |
| TST-04 Bağımsız sızma testi | [!] | 5df7356 (kapsam); firma sizde (SAHİP-15) |
| TST-05 Sürüm duman testi | [x] | 0beefdf |
| INF-01 Sunucu ve bölge | [!] | 31e075c; seçim sizde (KARAR-INF-1) |
| INF-02 Kurulum betiği | [x] | ae7305b |
| INF-03 Staging | [x] | 31e075c |
| INF-04 `.env.production` denetimi | [x] | 9e02e4d |
| INF-05 Harici servis hesapları | [!] | sizde |
| INF-06 Kesintisiz dağıtım | [!] | 4d17f9a — lansman sonrası (KARAR-INF-2) |
| PRD-01…06 Çevrimdışı akış, bildirimler, hazır yanıtlar, puan, ön form, döküm | [x] | 862eae6, ea8fcb2 |
| PRD-07 Gelen kutusu araçları | [x] | bf6c2fd, 16a6692 |
| PRD-08 Aktivasyon akışı | [x] | ea8fcb2 |
| PRD-09 PWA ve anlık bildirim | [x] | 596f236 |
| PRD-10 Yardım merkezi | [x] | 5adcf75 |
| PRD-11 Slack, Telegram, webhook | [x] | 4f00421 |
| PRD-12 Açık API | [x] | 94252e8, cbc4c5a |
| PRD-13 Kurulum kanalları | [!] | 070bdb6; WordPress.org, GTM galerisi, Shopify hesapları sizde |
| PRD-14 Google ile giriş | [!] | 08bfb3d; Google Cloud OAuth istemcisi sizde |
| PRD-15 Ücretsiz deneme | [x] | 8fb6e5a, 3d618f5 |
| PRD-16 Widget dilleri | [x] | 8674181 |
| PRD-17 E-posta kanalı | [ ] | lansman sonrası (L-03); gelen e-posta sağlayıcısı seçimi ve hesabı sizde |
| PRD-18 WhatsApp | [ ] | lansman sonrası; Meta doğrulaması ve KARAR-PRD-1 sizde |
| PRD-19 Instagram, Messenger, Telegram kanalı | [ ] | lansman sonrası; Meta hesapları sizde |
| PRD-20 Yapay zekâ yardımcı pilot | [ ] | plan §21 gereği KARAR-AI-2 ve ayrı tasarım olmadan yapılmaz |
| PRD-21 Sayfa ve PDF bilgi kaynakları | [x] | 37fac53 |
| PRD-22 Raporlar | [x] | 37ec031 |
| PRD-23 Tavsiye programı | [!] | d399917; Paddle indirimi (`PADDLE_REFERRAL_DISCOUNT_ID`) sizde |

### Kararlar

Her karar için seçenekler ilgili belgede; ajan varsayılanı (önerileni) uyguladı.

| Karar | Uygulanan | Nerede |
|---|---|---|
| KARAR-AI-1 Ücretsiz/ücretli katman | ücretsiz katman, AEA/İngiltere/İsviçre ziyaretçisine yanıt yok | `GEMINI_TIER`, docs/env-checklist.md — **sizin kararınız** |
| KARAR-AI-2 Yardımcı pilot | yapılmadı | PRD-20 |
| KARAR-BIL-1 Düşürmede fazlalık | askıya alma, silme yok; sahip seçer | migration 0015 |
| KARAR-DR-1 RPO/RTO | RPO ≤ 15 dk (WAL-G açıkken; kapalı betada ≤ 24 saat), RTO ≤ 2 saat | docs/disaster-recovery.md — onay sizde |
| KARAR-DR-2 PITR aracı | WAL-G | 2194004 |
| KARAR-INF-1 Sunucu ve bölge | açık | sizde |
| KARAR-INF-2 Kesintisiz dağıtım | lansman sonrası | docs/production-runbook.md |
| KARAR-LEG-1 İade penceresi | taslakta seçenekler | docs/legal/iade-ve-iptal.md — hukukçu |
| KARAR-LEG-2 Yetkili mahkeme | İstanbul (Çağlayan) taslağı | docs/legal/kullanim-sartlari.md — hukukçu |
| KARAR-MKT-1 Ön-oluşturma | sunucu `<head>`'i sayfaya göre yazar (headless tarayıcı yok) | backend/src/services/seoHead.ts |
| KARAR-MKT-2 KDV notu | "KDV ödeme sırasında hesaplanır" | Pricing |
| KARAR-MKT-3 Ziyaret sayımı | Umami hazır, kapalı | docs/env-checklist.md |
| KARAR-OBS-1 Hata izleme | Sentry protokolü, SDK'sız; DSN boşsa kapalı | 1273534 |
| KARAR-OBS-2 Pano | yalnız eşik alarmları | 5afdab0 |
| KARAR-OBS-3 Log | son 24 saat gzip ile yedek bucket'ına, 30 gün | 5afdab0 |
| KARAR-PRD-1 WhatsApp ücretleri | açık | PRD-18 ile |
| KARAR-SEC-1 Bot denetimi | Cloudflare Turnstile | 8fb6e5a |
| KARAR-SEC-2 Resim EXIF | `sharp` ile yeniden kodlama | ac1c78b |
| KARAR-SEC-3 ZIP/RAR | varsayılan kapalı (`ALLOW_ARCHIVE_UPLOADS`) | ac1c78b |
| KARAR-SUP-1 Redis sürümü | 7.4'te kal | docs/upgrade-roadmap.md |
| KARAR-SUP-2 İmaj imzası | cosign açık | c851bde |
| KARAR-SUP-3 Distroless | Alpine + sertleştirme | 9dde8b0 |
| KARAR-UX-1 Saat dilimi | görüntüleyenin cihazı | docs/ux-review.md |
| PRD-12 API hangi planda | Kurumsal (plan "Kurumsal veya Pro+" diyordu) | 94252e8 |
| PRD-13 Alan adı belli değil | eklenti kurulum kodunu okur; GTM/Shopify/readme'de `__APP_DOMAIN__`, `integrations/release.mjs` doldurur | 070bdb6 |
| PRD-16 Asistanın sabit cümleleri | Türkçe kalır (plan 9) | 8674181 |
| PRD-21 Kaynak sınırı | Pro 50, Kurumsal 500, Free yok | 37fac53 |
| PRD-22 Haftalık rapor | pazartesi 08:00 (İstanbul), boş haftada yok | 37ec031 |

### Sizin yapacaklarınız (plan §20, SAHİP-01…16)

Plan §20'deki sıra geçerli. Bu çalışmanın eklediği hesaplar: Google Cloud
OAuth istemcisi (`GOOGLE_CLIENT_ID/SECRET`), Paddle'da tavsiye indirimi
(`PADDLE_REFERRAL_DISCOUNT_ID`), WordPress.org / GTM galerisi / Shopify
Partner hesapları (`integrations/README.md`), alan adı belli olunca
`node integrations/release.mjs <alan-adı>`.
