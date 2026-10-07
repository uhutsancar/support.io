# Kişisel veri ihlali prosedürü (taslak)

> Bu belge hukuki görüş değildir; hukukçunun onayından önce yürürlüğe girmez
> [SAHİP]. Ürünün teknik araçlarını ve KVKK'nın bilinen yükümlülüklerini bir
> araya getirir. Tarih: 7 Ekim 2026.

## Ne zaman uygulanır

Kişisel verilerin kanuni olmayan yollarla başkalarınca elde edildiği ya da
elde edilmiş olabileceği her durum: yetkisiz erişim, sızan veritabanı ya da
yedek, yanlış kişiye giden e-posta, açıkta kalan ek dosya, ele geçirilen
hesap, sızan gizli anahtar (`JWT_SECRET`, depolama anahtarları, veritabanı
şifresi). Şüphe yeterlidir; doğrulanmasını beklemeden başlatılır ve
`docs/incident-response.md` kapsamında **SEV1** sayılır.

## Roller

- **Support.io kendi hesaplarının verisi için** (işletme hesapları, ekip
  üyeleri, faturalama) **veri sorumlusudur**: Kurul'a ve ilgili kişilere
  bildirim yükümlülüğü Support.io'dadır.
- **Müşterilerin sitelerindeki ziyaretçi verisi için** (sohbetler, ekler,
  ziyaretçi kayıtları) **veri işleyendir**: ihlali gecikmeksizin ilgili
  müşteriye (veri sorumlusuna) bildirir; Kurul'a ve ziyaretçilere bildirim
  müşterinin yükümlülüğüdür, Support.io ona gereken bilgiyi verir. Süre ve
  içerik DPA'da yazılı olmalıdır (LEG-01 madde 5).

## Süre

- KVKK m.12/5 ve Kurul'un 2019/10 sayılı kararı: veri sorumlusu ihlali
  öğrendiği andan itibaren **en geç 72 saat** içinde Kurul'a bildirir
  (Kurul'un "Veri İhlali Bildirim Formu" ile); gecikirse nedenini açıklar.
- İlgili kişilere, etkilenenler belirlendikten sonra **makul en kısa sürede**
  bildirim yapılır.
- Bilgiler aynı anda toplanamıyorsa bildirim aşamalı yapılabilir.

Hukukçu güncel Kurul kararlarını ve formu teyit etmelidir.

## Adımlar

| Zaman     | Ne                                                                                                                                                                                                                             | Kim             |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| 0         | Olayı kaydet: saat, nasıl fark edildi, ilk bilgiler. Saat buradan başlar.                                                                                                                                                      | Nöbetçi         |
| 0–1 saat  | Sızıntıyı durdur: anahtarı döndür (runbook §8), hesabı kilitle, siteyi kapat (`site:disable`), bağlantıyı kaldır. Kanıtları koru: logları ve ilgili satırları kopyala (`scripts/ship-logs.sh`, denetim kaydı), sunucuyu silme. | Nöbetçi         |
| 1–24 saat | Kapsamı belirle: hangi veri kategorileri, kaç kişi, hangi kurumlar, hangi tarihler. Kaynaklar: denetim kaydı (`audit_logs`), istek logları (istek kimliğiyle), depolama erişim kayıtları, Cloudflare logları.                  | Nöbetçi + sahip |
| 24 saat   | Etkilenen **müşterilere** (veri işleyen olarak) yazılı bildirim: ne oldu, hangi veriler, kaç ziyaretçi, alınan önlemler, irtibat.                                                                                              | Sahip           |
| ≤ 72 saat | Support.io'nun veri sorumlusu olduğu veriler etkilendiyse **Kurul'a bildirim** (form); hukukçu inceler.                                                                                                                        | Sahip + hukukçu |
| Sonra     | İlgili kişilere bildirim (Support.io'nun sorumlu olduğu veriler için); müşterilere ziyaretçilerine bildirim için destek.                                                                                                       | Sahip           |
| 2 hafta   | Olay sonrası rapor (`docs/incidents/`) ve önlemler. İhlal kayıt defterine işle.                                                                                                                                                | Sahip           |

## Bildirimde bulunması gerekenler

- İhlalin ne zaman başladığı, ne zaman fark edildiği
- Etkilenen veri kategorileri (kimlik, iletişim, sohbet içeriği, dosya, IP …)
  ve yaklaşık kişi sayısı
- Olası sonuçlar
- Alınan ve alınacak önlemler
- İrtibat kişisi (`kvkk@<alan adı>`)

## Teknik araçlar

- Oturumları bitirmek: `JWT_SECRET` döndürme, örtüşmesiz (runbook §8);
  tek hesap için şifre değişimi tüm oturumlarını kapatır.
- Bir siteyi kapatmak: `site:disable`.
- Asistanı her yerde kapatmak: `assistant:kill on`.
- Bir ziyaretçinin verisini silmek: panel → konuşma → "Bu ziyaretçinin
  verilerini sil".
- Kimin neyi ne zaman değiştirdiği: panel → Denetim kaydı (Kurumsal plan) ya
  da `audit_logs` tablosu.

## Şablonlar

**Müşteriye (veri işleyen bildirimi)**

> Konu: Hesabınızı etkileyen bir güvenlik olayı hakkında
>
> Merhaba, {tarih saat} tarihinde fark ettiğimiz bir güvenlik olayı
> {sitenizin / hesabınızın} {veri kategorileri} verilerini etkilemiş
> olabilir. Etkilenen kayıt sayısı: {sayı}. Olayı fark ettiğimiz anda
> {alınan önlemler}. Ziyaretçilerinize ve gerekiyorsa Kurul'a bildirim
> yükümlülüğünüz için ihtiyaç duyacağınız tüm bilgileri paylaşmaya hazırız.
> İrtibat: {ad, e-posta, telefon}.

**İlgili kişiye**

> Konu: Kişisel verilerinizi etkileyen bir olay
>
> Merhaba, {tarih} tarihinde yaşanan bir güvenlik olayında {veri
> kategorileri} bilgileriniz yetkisiz kişilerce görülmüş olabilir. Olası
> sonuçlar: {…}. Aldığımız önlemler: {…}. Sizin için önerimiz: {şifrenizi
> değiştirin / dikkatli olun …}. Sorularınız için: kvkk@{alan adı}.
