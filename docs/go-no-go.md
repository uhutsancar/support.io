# GO / NO-GO — plan v10 §19

Durum: 9 Ekim 2026, dal `feat/prod-readiness-v10`. Her madde kanıtıyla.
✅ kanıtlandı · ❌ henüz değil (kimin adımı olduğu yanında) · ◐ kısmen.

**Karar: NO-GO.** Kod tarafı kapalı betaya hazır; canlıya çıkışı engelleyenler
sahibin adımları (sunucu, alan adı, Cloudflare, Paddle, hukukçu, anahtar
yenileme) ve ancak staging'de toplanabilecek kanıtlar (yük testi, geri yükleme
ve "sunucu yandı" tatbikatı, alarmların gerçekten gelmesi). Bunlar
tamamlandığında aşağıdaki ❌ maddeler yeniden işaretlenir.

## Güvenlik

| Madde | Durum | Kanıt |
|---|---|---|
| `npm audit --omit=dev` iki pakette 0 critical / 0 high; CI kapısı | ✅ | 62d04b9, c851bde; son çalıştırma bu raporun testlerinde |
| İmajlar digest ile sabit; Trivy düzeltilebilir kritik/yüksek = 0 | ✅ | 9dde8b0, docs/security/image-scan.md; 9 Ekim yeniden tarama: 0 (imaj 294 → 371 MB) |
| Şifre / e-posta değiştirme, tüm cihazlardan çıkış | ✅ | 8fb6e5a, b5c71b7; accountSecurity testleri |
| Upload içerik imzası | ✅ | ac1c78b |
| Turnstile + tek kullanımlık e-posta engeli | ✅ kod · ❌ anahtarlar | 8fb6e5a; `TURNSTILE_*` sahipte |
| Cloudflare Full (strict), WAF, hız kuralları, origin kilidi | ❌ sahip | f72e339 (betik, runbook) |
| VPS sertleştirme uygulandı | ❌ sahip | f72e339, ae7305b |
| Gemini anahtarı ve hesap şifresi yenilendi | ❌ sahip | SAHİP-01, SAHİP-02 |
| Gitleaks temiz; `.env.production` 600; sırlar parola yöneticisinde | ◐ | CI'da gitleaks (c851bde); sunucu ve kasa sahipte |

## Güvenilirlik ve operasyon

| Madde | Durum | Kanıt |
|---|---|---|
| Hata izleme, dış uptime, watchdog — test alarmı alındı | ❌ staging | kod: 1273534, 5afdab0, 80c4430; hesaplar ve deneme alarmı sahipte |
| Gece yedeği + haftalık otomatik geri yükleme yeşil | ❌ staging | a92c248, 2194004 |
| Elle tam geri yükleme ve "sunucu yandı" tatbikatı, süre yazıldı | ❌ staging | docs/disaster-recovery.md |
| Rollback staging'de denendi | ❌ staging | scripts/rollback.sh |
| Olay müdahale ve veri ihlali prosedürü | ✅ | 1bc96df, docs/incident-response.md |

## Performans

| Madde | Durum | Kanıt |
|---|---|---|
| Staging'de ayrı makineden yük testi, kapasite cümlesi | ❌ staging | `npm run loadtest`, docs/load-test.md |
| Yeniden bağlanma fırtınası: mesaj kaybı 0 | ✅ yerel | af2135a |
| Widget gzip ≤ 35 KB | ✅ | 25,6 KB (8674181 sonrası, `scripts/check-bundle-size.mjs`) |
| Mobil Lighthouse ana sayfa ≥ 90 (P2: en az ölçüldü) | ◐ ölçüldü | ana sayfa 49 → 56, fiyatlandırma 74 (40b03e9); hedef karşılanmadı |

## Ürün

| Madde | Durum | Kanıt |
|---|---|---|
| Çevrimdışı akış + kaçırılan sohbet e-postası (PRD-01) | ✅ | 862eae6 |
| Bildirimler, hazır yanıtlar, CSAT, ön form + KVKK onayı, aktivasyon | ✅ | 862eae6, ea8fcb2 |
| Widget erişilebilirliği axe 0 ciddi; mobil widget | ✅ emülasyon · ❌ gerçek cihaz | acf873c, 3335903; iOS/Android cihaz denemesi sahipte |
| Playwright ≥ 14 senaryo yeşil | ✅ | 39 senaryo: 37 geçti, 2 bilinçli atlandı, 0 başarısız |

## Yapay zekâ

| Madde | Durum | Kanıt |
|---|---|---|
| KARAR-AI-1 verildi; free modda AEA/CH/GB engeli test edildi | ◐ | engel test edildi (dec6d5b); karar sahipte (SAHİP-03) |
| Model adı doğrulandı (GA), şeffaflık etiketi, kapatma düğmesi | ✅ kod | ea13a8f, 5eb560c; gerçek anahtarla açılış denetimi sahipte |
| Değerlendirme seti: halüsinasyon < %2, kişisel veri sızıntısı 0 | ❌ sahip | set ve koşucu c691d55; gerçek modelle koşu sahibin anahtarıyla |

## Hukuk ve ticari

| Madde | Durum | Kanıt |
|---|---|---|
| Gizlilik, Aydınlatma, Çerez, Şartlar, DPA, İade, Alt İşleyenler, Künye — hukukçu onaylı | ❌ hukukçu | taslaklar docs/legal (04a910c ve sonrası) |
| KVKK yurt dışı aktarım sözleşmeleri ve bildirim | ❌ sahip | docs/legal/kvkk-transfer-checklist.md |
| Şirket, Paddle canlı hesap, sandbox kabul 8/8 | ❌ sahip | docs/billing-acceptance.md |
| Alan adı ve marka; SPF/DKIM/DMARC | ❌ sahip | SAHİP-05 |
| sitemap/robots/canonical doğru alan adı | ✅ kod | 5b195cc — alan adı çalıştığı ortamdan gelir |

## Rapor (plan §22)

```text
Faz: Plan v10 — tamamı (Faz 0–14)
Tamamlanan görevler: docs/IS_LISTESI.md bölüm E — her görev, durumu ve commit'i
Testler: backend 305/307 geçti, 1 bilinçli atlandı (gerçek modelle asistan
         denemesi), 1 sıra varsayımı düzeltildi ve tekrar geçti (a8e53e8);
         playwright 37/39 geçti, 2 bilinçli atlandı (gerçek modelle asistan,
         WordPress — WP_URL olmadan), 0 başarısız — 6 tarayıcı/cihaz profili;
         npm audit (prod) backend 0 / panel 0 açık; imaj taraması (Trivy, supportio:local,
         Alpine 3.24.2) düzeltilebilir kritik/yüksek 0; yerel üretim yığınında
         göçler 0000–0024 temiz veritabanına uygulandı, duman testi 23/23 geçti
Ölçümler: widget 25,6 KB gzip (bütçe 35); panel ilk yükleme 191,5 KB gzip
          (bütçe 250); mobil Lighthouse ana sayfa 49 → 56, fiyatlandırma 74
          (hedef 90 karşılanmadı)
Sahibe kalan: SAHİP-01…16 (plan §20) + Google OAuth istemcisi, Paddle tavsiye
              indirimi, WordPress.org / GTM galerisi / Shopify Partner hesapları
Açık riskler / kabul edilenler: docs/security/accepted-risks.md (gosu'nun Go
              çalışma zamanı, Redis'in TLS'siz OpenSSL'i); mobil Lighthouse 90'ın
              altında; asistan değerlendirmesi gerçek modelle henüz koşulmadı;
              kurulum kanalları ve Google ile giriş gerçek hesaplarla denenmedi
              (stand-in'lerle denendi); PRD-17…20 lansman sonrasına kaldı
Karar bekleyenler: KARAR-AI-1, KARAR-DR-1, KARAR-INF-1, KARAR-LEG-1/2,
              KARAR-PRD-1, KARAR-AI-2 — seçenekler ve öneriler IS_LISTESI
              bölüm E'de ve ilgili belgelerde
```
