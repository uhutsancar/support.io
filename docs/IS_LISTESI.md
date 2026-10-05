# Support.io — İş listesi

Tüm isteklerin tek listesi: plan (8) "AI'sız Production SaaS", plan (9) "Gemini
asistanı" ve sohbette verilen ek istekler. Her madde bitince işaretlenir ve
hangi commit'te yapıldığı yazılır. `[ ]` bekliyor · `[~]` yarım · `[x]` bitti ·
`[!]` kullanıcı adımı gerekiyor (sunucu, DNS, ödeme hesabı gibi dış dünya).

Not: Hiçbir commit uzak depoya **push edilmedi**; hepsi yerel
`feat/production-saas` dalında. Push ve main'e birleştirme sizin onayınızla yapılır.

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
| Ücretli özellik ücretsiz planda açılınca "planınızı yükseltin" mesajı + yönlendirme | [x] | 18a6de7 |
| sancaruhut@gmail.com: sahip (owner) + en yüksek plan, her şeyi kullanabilsin | [x] | (veritabanı, denetim kaydıyla) |
| Admin panelde sitenin kendi sohbet balonu görünmesin | [x] | 18a6de7 |
| Siteler kartı taşıyor (rozetler, kurulum kodu, butonlar) | [x] | 18a6de7 |
| Ekip sohbeti: "Üye seçin" / "Grup oluştur" panelleri siyah görünüyor | [x] | 18a6de7 |
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
