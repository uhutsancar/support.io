# İlgili kişi başvuru süreci (KVKK m.11, m.13)

> Plan v10 LEG-03. İç süreç belgesi. Yasal süre: başvuru Support.io'ya
> ulaştıktan sonra en geç **30 gün** içinde, kural olarak ücretsiz
> sonuçlandırılır (KVKK m.13; Veri Sorumlusuna Başvuru Usul ve Esasları
> Hakkında Tebliğ). Bu belge hukuki görüş değildir; hukukçu teyit etmeli.

## Kanallar

- **E-posta:** [SAHİP: kvkk@alan-adı] — kayıtlı e-posta adresinden gelen
  başvuru kimlik için yeterli kabul edilir; başka adresten gelirse ek
  doğrulama istenir.
- **Posta / elden:** [SAHİP: adres], ıslak imzalı dilekçe.
- **KEP:** [SAHİP: varsa KEP adresi].
- Panel: hesap sahipleri dışa aktarma ve hesap silmeyi kendileri yapar
  (*Ayarlar → Veri ve gizlilik*); bu bir başvuru sayılmaz ama yanıtta
  önerilir.

## Akış

1. **Kayıt (aynı gün):** başvuru `docs/` dışındaki başvuru defterine
   [SAHİP: paylaşılan tablo] işlenir: tarih, kanal, kişi, talep türü,
   son yanıt tarihi (+30 gün).
2. **Kimlik:** başvuru sahibinin verinin sahibi olduğu doğrulanır. Ziyaretçi
   için: sohbette verdiği e-posta adresinden yazması ya da sohbetin tarih,
   site ve içeriğinden bir ayrıntı vermesi.
3. **Rol tespiti:**
   - Hesap sahibi / ekip üyesi → Support.io veri sorumlusu, 4. adıma geç.
   - Bir sitenin ziyaretçisi → veri sorumlusu o işletmedir. Başvuru 3 iş
     günü içinde işletmenin hesap sahibine iletilir, başvuru sahibine
     bilgi verilir; işletme isterse panel araçlarıyla yardım edilir (DPA
     madde 7).
4. **Yerine getirme** (Support.io sorumlu olduğunda):

   | Talep | Nasıl |
   |---|---|
   | Bilgi / erişim | Organizasyon dışa aktarması (`GET /api/account/export`, panelde *Ayarlar → Veri ve gizlilik*) ya da kişiye özgü sorgu; şifre özeti ve anahtarlar verilmez |
   | Düzeltme | Kişi panelde kendisi düzeltir; yapamıyorsa destek düzeltir, denetim kaydı düşer |
   | Silme | Hesap silme (sahip için panel; ekip üyesi için sahibin üyeyi çıkarması); ziyaretçi için panelde "Bu ziyaretçinin verilerini sil" (SEC-17) |
   | Aktarılan üçüncü kişiler | [Alt İşleyenler](alt-isleyenler.md) listesi |
   | İtiraz / zarar | Hukukçuya iletilir |

5. **Yanıt:** yazılı, Türkçe, başvurunun geldiği kanaldan; kabul ya da
   gerekçeli ret. Silme yapıldıysa yedeklerden en geç [SAHİP: 3 ay] içinde
   düşeceği belirtilir.
6. **Kapanış:** defterde yanıt tarihi ve sonucu; yanıt kopyası 3 yıl
   saklanır [SAHİP + hukukçu: süre].

## Ziyaretçi verisini silme (panel)

Konuşma ekranındaki **Bu ziyaretçinin verilerini sil** düğmesi:
o sitedeki tüm konuşmaları, mesajları, dosyaları, ziyaretçi kaydını ve
sayfa hareketlerini kalıcı olarak siler ve denetim kaydına
`VISITOR_DATA_DELETED` yazar.
