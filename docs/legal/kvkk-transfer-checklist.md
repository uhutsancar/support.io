# KVKK yurt dışı aktarım kontrol listesi

> Bu belge hukuki görüş değildir. Hangi hizmet sağlayıcıya hangi verinin
> gittiğini koddan çıkarır ve sahibin hukukçusuyla tamamlaması gereken
> adımları sıralar. Doldurulmamış hücreler **[SAHİP]** işidir.
> Tarih: 7 Ekim 2026.

## Dayanak (özet, hukukçu teyit etmeli)

- KVKK m.9 (2024 değişikliği) ve Yurt Dışına Kişisel Veri Aktarılmasına
  İlişkin Usul ve Esaslar Yönetmeliği: yeterlilik kararı yoksa uygun
  güvenceler; bunlardan biri Kurul'un ilan ettiği **standart sözleşme**.
- Standart sözleşme imzalandıktan sonra **5 iş günü içinde** Kurum'a
  bildirilir (Standart Sözleşme Bildirim Modülü).
- Açık rıza, Eylül 2024'ten bu yana düzenli aktarımlar için dayanak
  değildir; yalnızca arızi aktarımlarda istisnadır.
- Müşteriyle (site sahibi) ilişkide Support.io **veri işleyen**dir; site
  ziyaretçilerinin verisinde veri sorumlusu müşteridir. Bu ilişki DPA ile
  yazılı hâle getirilmeli (LEG-01 madde 5).

## Sağlayıcılar

| Sağlayıcı                       | Amaç                                  | Giden veri (koddan)                                                                                                                                          | Konum                      | Önerilen dayanak                                                                | Sağlayıcının DPA / SCC belgesi                  | İmza tarihi | Kurum bildirimi |
| ------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------- | ----------- | --------------- |
| Sunucu sağlayıcı (KARAR-INF-1)  | Barındırma                            | Tümü (veritabanı, dosyalar yerelse)                                                                                                                          | **[SAHİP]**                | Yurt içi ise aktarım yok; değilse standart sözleşme                             |                                                 |             |                 |
| Cloudflare                      | DNS, CDN, WAF, Turnstile              | IP adresi, istek başlıkları, ülke                                                                                                                            | Küresel                    | Standart sözleşme (veri işleyen ↔ alt işleyen)                                  | Cloudflare DPA                                  |             |                 |
| Depolama (S3 / R2)              | Sohbet ekleri, logolar, şifreli yedek | Ziyaretçilerin gönderdiği dosyalar; age ile şifreli veritabanı yedeği                                                                                        | **[SAHİP]** (bölge seçimi) | Standart sözleşme                                                               | AWS DPA / Cloudflare DPA                        |             |                 |
| E-posta sağlayıcısı (SMTP)      | Hesap ve bildirim e-postaları         | Ad, e-posta, e-posta içeriği (yanıt e-postalarında mesaj metni)                                                                                              | **[SAHİP]**                | Standart sözleşme                                                               |                                                 |             |                 |
| Google (Gemini API)             | Asistan yanıtı                        | Ziyaretçinin sorusu (e-posta ve telefon maskeli; kart/IBAN/TC içeren soru hiç gitmez), sitenin herkese açık SSS içeriği. Ad, e-posta, önceki mesajlar gitmez | ABD / küresel              | Standart sözleşme + KARAR-AI-1 (ücretsiz katmanda veri eğitimde kullanılabilir) | Google Cloud / Gemini API Data Processing Terms |             |                 |
| Paddle                          | Ödeme, fatura, vergi (satıcı)         | Fatura bilgileri, e-posta, ülke                                                                                                                              | Birleşik Krallık / küresel | Standart sözleşme                                                               | Paddle DPA                                      |             |                 |
| Hata izleme (OBS-01, kurulursa) | Hata kaydı                            | Teknik veri; e-posta, çerez, IP temizlenmiş                                                                                                                  | AB bölgesi seçilmeli       | Standart sözleşme                                                               |                                                 |             |                 |
| Uptime izleme                   | Erişilebilirlik kontrolü              | Kişisel veri yok (yalnızca URL)                                                                                                                              | —                          | Gerekmez                                                                        |                                                 |             |                 |

## Yapılacaklar

- [ ] **[SAHİP]** Sunucu ve depolama bölgelerini seç; tabloya yaz.
- [ ] **[SAHİP + hukukçu]** Her sağlayıcı için Kurul'un standart sözleşme
      tiplerinden uygun olanı seç (veri sorumlusu → veri işleyen, veri işleyen
      → veri işleyen …).
- [ ] **[SAHİP]** Sözleşmeleri imzala; her biri için imza tarihini yaz.
- [ ] **[SAHİP]** İmzadan sonraki 5 iş günü içinde Kurum'a bildir; tarihi yaz.
- [ ] **[SAHİP + hukukçu]** Gizlilik Politikası'ndaki alt işleyen listesini
      bu tabloya göre güncelle (Google burada adıyla yazılır — yasal
      zorunluluk; panelde ve widget'ta yazılmaz).
- [ ] **[SAHİP + hukukçu]** Müşteriler için DPA taslağını onayla.
- [ ] VERBİS kaydı gerekip gerekmediğini muhasebeci/hukukçu ile netleştir
      (LEG-03).
- [ ] Yeni bir sağlayıcı eklendiğinde bu tablo, gizlilik politikası ve
      müşterilere bildirim birlikte güncellenir.
