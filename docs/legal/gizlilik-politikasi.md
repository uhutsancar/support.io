# Gizlilik Politikası — güncelleme taslağı

> **TASLAK — hukukçu onayı olmadan yayına alınmaz** (plan v10 LEG-01 madde 1).
> Yayındaki sürüm: `admin-panel/src/locales/pages.tr.ts` → `legal.privacy`
> (7 Ekim 2026). Bu taslak onu genişletir: alt işleyenler adlarıyla, yurt
> dışı aktarım, saklama süreleri tablo hâlinde, haklar ve başvuru yolu.
> Kodla uyumu: saklama süreleri `domain/plans.ts` (`retention`),
> `db/retention.ts`; yapay zekâya giden veri `services/assistant`.

---

## Türkçe

**Son güncelleme:** [SAHİP: yayın tarihi]

Support.io, işletmelerin sitelerine canlı destek ve yapay zekâ asistanı
eklemesini sağlayan bir hizmettir. Bu politika, Support.io hesabı açan
işletmeler ve ekipleri ile bu işletmelerin sitelerinde sohbet balonunu
kullanan ziyaretçiler için geçerlidir. KVKK kapsamındaki aydınlatma
metnimiz ayrı bir sayfadadır: [KVKK Aydınlatma Metni](/kvkk-aydinlatma-metni).

### 1. Kim sorumlu

- **Hesap verileri** (işletmeler ve ekip üyeleri) için veri sorumlusu:
  [SAHİP: ticari unvan], [SAHİP: adres], MERSİS [SAHİP], e-posta
  [SAHİP: kvkk@alan-adı].
- **Ziyaretçi verileri** için veri sorumlusu, sohbet balonunu sitesine
  ekleyen işletmedir. Support.io bu verileri işletme adına ve onun
  talimatıyla işler (veri işleyen). İşletmeyle aramızdaki ilişki Veri İşleme
  Sözleşmesi ile düzenlenir.

### 2. İşlediğimiz veriler

| Kimin | Veri | Nereden |
|---|---|---|
| Hesap sahibi ve ekip | Ad, e-posta, rol, şifrenin geri döndürülemez özeti, iki adımlı doğrulama sırrı (şifreli), profil fotoğrafı, telefon ve kısa tanıtım (isteğe bağlı), oturum ve işlem kayıtları (IP adresi, tarayıcı bilgisi) | Kendiniz, kullanım sırasında |
| Ziyaretçi | Sohbet mesajları ve gönderilen dosyalar; ziyaretçi yazarsa ad, e-posta, telefon; bulunduğu sayfa ve geldiği sayfa, tarayıcı, işletim sistemi, IP adresi ve ülke; memnuniyet puanı | Sohbet balonu |
| Ödeme yapan işletme | Fatura adı ve adresi, vergi numarası, ödeme durumu. **Kart bilgisi bize ulaşmaz.** | Paddle |
| Kurumsal müşteri adayı (CRM) | Ad, e-posta, telefon, şirket, not | Ekibiniz panele girerse |

### 3. Amaçlar ve hukuki sebepler

| Amaç | Hukuki sebep (KVKK m.5/2) |
|---|---|
| Hizmeti sunmak: mesajları iletmek, saklamak, ekibe göstermek, bildirim göndermek | Sözleşmenin kurulması ve ifası (c) |
| Hesap e-postaları: adres doğrulama, şifre sıfırlama, ekip daveti, kullanım ve ödeme uyarıları | Sözleşmenin ifası (c) |
| Güvenlik: yetkisiz erişimi ve kötüye kullanımı önlemek, hız sınırı, işlem kaydı | Meşru menfaat (f); hukuki yükümlülük (ç) |
| Faturalandırma ve vergi | Hukuki yükümlülük (ç); sözleşmenin ifası (c) |
| Hizmeti iyileştirmek için toplu, kişiyi tanımlamayan kullanım sayıları | Meşru menfaat (f) |

Pazarlama e-postası göndermiyoruz. Gönderirsek önceden ayrıca onayınızı
alırız.

### 4. Yapay zekâ asistanı

İşletme asistanı açarsa, ziyaretçinin sorusu ve sitenin herkese açık SSS
kayıtları yanıt üretmek için yapay zekâ hizmet sağlayıcımıza gönderilir.

- Sorudaki e-posta adresleri ve telefon numaraları gönderilmeden önce
  gizlenir.
- Ziyaretçinin adı, e-postası ve önceki mesajları gönderilmez.
- Kart, IBAN ya da T.C. kimlik numarası içeren bir soru hiç gönderilmez;
  konuşma doğrudan ekibe geçer.
- Asistanın yanıtları sohbet balonunda "yapay zekâ" olarak işaretlenir;
  ziyaretçi her an bir insana bağlanmayı isteyebilir.
- [KARAR-AI-1'e göre bir cümle — SAHİP + hukukçu: ücretsiz katmanda
  sağlayıcının gönderilen içeriği hizmetini geliştirmek için
  kullanabileceği; ücretli katmanda kullanmadığı.]

### 5. Kimlerle paylaşıyoruz (alt işleyenler)

Verileri satmayız ve reklam için kullanmayız. Hizmeti sunmak için
yalnızca aşağıdaki sağlayıcılarla, gerektiği kadar paylaşırız. Güncel
liste: [Alt İşleyenler](/alt-isleyenler).

| Sağlayıcı | Ne için | Hangi veri | Konum |
|---|---|---|---|
| [SAHİP: sunucu sağlayıcı] | Barındırma | Tümü | [SAHİP] |
| Cloudflare, Inc. | Alan adı, içerik dağıtımı, saldırı koruması, bot doğrulaması | IP adresi, istek bilgileri | Küresel |
| [SAHİP: Cloudflare R2 / Amazon S3] | Dosya ve şifreli yedek depolama | Gönderilen dosyalar, şifreli veritabanı yedeği | [SAHİP] |
| [SAHİP: e-posta sağlayıcı] | E-posta gönderimi | Ad, e-posta, e-posta içeriği | [SAHİP] |
| Google LLC (Gemini API) | Yapay zekâ asistanının yanıtı (yalnız işletme açarsa) | Gizlenmiş ziyaretçi sorusu, herkese açık SSS içeriği | ABD / küresel |
| Google LLC (Google ile giriş) [taslak — hukukçu onayı] | Kullanıcı “Google ile devam et”i seçerse kimlik doğrulama | Google’ın bize ilettiği hesap kimliği, e-posta adresi ve ad; şifre bize gelmez | ABD / küresel |
| Paddle.com Market Ltd. | Ödeme, fatura, vergi (satıcı) | Fatura bilgileri, e-posta, ülke | Birleşik Krallık / küresel |
| [SAHİP: hata izleme, kurulursa] | Hata kaydı | Teknik veri (e-posta, çerez, IP temizlenmiş) | AB |

Yasal bir zorunluluk olduğunda (mahkeme kararı, yetkili kurum talebi)
verileri ilgili makamla paylaşabiliriz.

### 6. Yurt dışına aktarım

Yukarıdaki sağlayıcıların bir kısmı veriyi Türkiye dışında işler. Bu
aktarımlar KVKK m.9 uyarınca Kişisel Verileri Koruma Kurulu'nun ilan ettiği
standart sözleşmelerle yapılır ve sözleşmeler Kurum'a bildirilir.
[SAHİP + hukukçu: imza ve bildirim tarihleri kvkk-transfer-checklist.md'de.]

### 7. Saklama süreleri

| Veri | Süre | Sonra |
|---|---|---|
| Sohbetler, mesajlar, ekler | İşletmenin seçtiği süre: Ücretsiz planda son mesajdan 90 gün; ücretli planlarda 30 gün ile 5 yıl arası | Her gece kalıcı olarak silinir; işletme daha önce de silebilir |
| Ziyaretçinin IP adresi, tarayıcı, işletim sistemi, geldiği sayfa | Son ziyaretten 90 gün | Silinir |
| İşlem kayıtlarındaki IP adresi ve tarayıcı | 90 gün | Silinir; kaydın kendisi denetim için kalır |
| Sayfa hareketi ve otomasyon kayıtları | 30 gün | Silinir |
| E-posta bağlantıları (doğrulama, sıfırlama) | Süresi dolduktan 7 gün sonra | Silinir |
| Doğrulanmamış kayıtlar | 7 gün | Hesap silinir |
| Hesap | Hesap silinene kadar | Ad, e-posta, şifre silinir; işletmenin tüm sohbet ve dosyaları silinir |
| Şifreli yedekler | En fazla [SAHİP: 3 ay] | Yedeklerden düşer |
| Fatura kayıtları | Vergi mevzuatının öngördüğü süre (Paddle tutar) | — |

### 8. Çerezler ve tarayıcı deposu

Yalnızca hizmetin çalışması için zorunlu çerezleri ve tarayıcı deposunu
kullanırız; reklam, izleme ya da analitik çerezi kullanmayız. Ayrıntı:
[Çerez Politikası](/cerez-politikasi).

### 9. Güvenlik

Bağlantılar şifrelidir (HTTPS). Şifreler geri döndürülemez biçimde,
iki adımlı doğrulama sırları ve entegrasyon anahtarları şifreli saklanır.
Yedekler şifrelenir. Erişim rol bazlıdır ve yönetici işlemleri kayda
geçer. Bir veri ihlali olursa KVKK'nın öngördüğü sürede Kurul'a ve
etkilenenlere bildiririz.

### 10. Haklarınız

KVKK m.11 uyarınca verilerinizin işlenip işlenmediğini öğrenme, bilgi
isteme, amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme,
aktarıldığı üçüncü kişileri bilme, düzeltilmesini, silinmesini veya yok
edilmesini isteme, bu işlemlerin aktarılan üçüncü kişilere bildirilmesini
isteme, otomatik sistemlerle analiz sonucu aleyhinize bir sonuca itiraz
etme ve kanuna aykırı işleme nedeniyle zararın giderilmesini isteme
haklarınız vardır. AB'de yaşıyorsanız GDPR'ın tanıdığı haklar (taşınabilirlik
dâhil) da geçerlidir.

**Nasıl başvurulur**

- **Hesap sahipleri:** Panelde *Ayarlar → Veri ve gizlilik* bölümünden tüm
  verinizi indirebilir ve hesabı silebilirsiniz.
- **Ziyaretçiler:** Talebinizi sohbet ettiğiniz işletmeye iletin; işletme bir
  ziyaretçinin o sitedeki tüm verisini panelden tek adımda silebilir. Bize de
  yazabilirsiniz; talebi işletmeye iletir ve yardımcı oluruz.
- **Yazılı başvuru:** [SAHİP: kvkk@alan-adı] adresine kayıtlı e-postanızdan
  ya da [SAHİP: adres] adresine yazılı olarak. Kimliğinizi doğrulamak için ek
  bilgi isteyebiliriz. Başvurunuzu en geç **30 gün** içinde ücretsiz
  yanıtlarız.
- Yanıtımızdan memnun kalmazsanız Kişisel Verileri Koruma Kurulu'na
  şikâyette bulunabilirsiniz.

### 11. Değişiklikler

Bu politikayı değiştirirsek sayfadaki tarihi güncelleriz; önemli
değişiklikleri hesap sahiplerine e-postayla bildiririz.

---

## English

**Last updated:** [OWNER: publication date]

Support.io lets businesses add live chat and an AI assistant to their
websites. This policy applies to businesses with a Support.io account and
their team, and to visitors who use the chat bubble on those businesses'
websites.

### 1. Who is responsible

- **Account data** (businesses and their team): the controller is
  [OWNER: legal name], [OWNER: address], [OWNER: privacy@domain].
- **Visitor data**: the controller is the business that added the chat
  bubble to its site. Support.io processes this data on the business's
  behalf and instructions (processor), under our Data Processing Agreement.

### 2. Data we process

| Whose | Data | Source |
|---|---|---|
| Account owner and team | Name, e-mail, role, a one-way hash of the password, the two-step secret (encrypted), avatar, optional phone and bio, session and activity records (IP address, browser) | You, while using the service |
| Visitor | Chat messages and files sent; name, e-mail and phone if the visitor gives them; current and referring page, browser, operating system, IP address and country; satisfaction rating | The chat bubble |
| Paying business | Billing name and address, tax number, payment status. **Card details never reach us.** | Paddle |
| CRM contacts | Name, e-mail, phone, company, notes | Entered by your team |

### 3. Purposes and legal bases

| Purpose | Legal basis |
|---|---|
| Providing the service: delivering, storing and showing messages, sending notifications | Performance of a contract |
| Account e-mails: address verification, password reset, team invitations, usage and payment notices | Performance of a contract |
| Security: preventing unauthorised access and abuse, rate limits, activity logs | Legitimate interest; legal obligation |
| Billing and tax | Legal obligation; performance of a contract |
| Aggregate, non-identifying usage counts to improve the service | Legitimate interest |

We do not send marketing e-mail. If we ever do, we will ask for your
consent first.

### 4. The AI assistant

If a business turns the assistant on, the visitor's question and the site's
public FAQ entries are sent to our AI service provider to produce an
answer.

- E-mail addresses and phone numbers in the question are masked first.
- The visitor's name, e-mail and earlier messages are not sent.
- A question containing a card number, IBAN or national ID number is not
  sent at all; the conversation goes straight to the team.
- The assistant's answers are labelled as AI in the chat bubble; the visitor
  can ask for a person at any time.
- [Per KARAR-AI-1 — OWNER + lawyer: whether the provider may use submitted
  content to improve its services on the free tier, and does not on the
  paid tier.]

### 5. Who we share data with (sub-processors)

We do not sell data or use it for advertising. We share it only with the
providers below, and only as far as the service needs. Current list:
[Sub-processors](/en/sub-processors).

| Provider | Purpose | Data | Location |
|---|---|---|---|
| [OWNER: hosting provider] | Hosting | All | [OWNER] |
| Cloudflare, Inc. | DNS, content delivery, attack protection, bot check | IP address, request data | Global |
| [OWNER: Cloudflare R2 / Amazon S3] | File and encrypted backup storage | Files sent, encrypted database backup | [OWNER] |
| [OWNER: e-mail provider] | Sending e-mail | Name, e-mail, e-mail content | [OWNER] |
| Google LLC (Gemini API) | The AI assistant's answer (only if the business turns it on) | Masked visitor question, public FAQ content | USA / global |
| Google LLC (Sign in with Google) [draft — lawyer approval] | Authentication, when the user chooses “Continue with Google” | The account id, e-mail address and name Google passes to us; no password reaches us | USA / global |
| Paddle.com Market Ltd. | Payment, invoicing, tax (merchant of record) | Billing details, e-mail, country | UK / global |
| [OWNER: error tracking, if set up] | Error reports | Technical data (e-mail, cookies, IP removed) | EU |

We may disclose data to an authority where the law requires it.

### 6. International transfers

Some of these providers process data outside Türkiye. These transfers rely
on the standard contracts published by the Turkish Personal Data
Protection Board (KVKK art. 9), notified to the Authority; for EU data, on
the EU Standard Contractual Clauses.

### 7. Retention

| Data | Kept for | Then |
|---|---|---|
| Conversations, messages, files | The period the business chooses: 90 days after the last message on Free; 30 days to 5 years on paid plans | Deleted every night; the business can delete earlier |
| Visitor IP address, browser, OS, referrer | 90 days after the last visit | Deleted |
| IP address and browser in activity logs | 90 days | Deleted; the log entry stays for audit |
| Page events and automation logs | 30 days | Deleted |
| E-mail links (verification, reset) | 7 days after they expire | Deleted |
| Unverified sign-ups | 7 days | Account deleted |
| Account | Until it is deleted | Name, e-mail, password removed; all of the business's conversations and files deleted |
| Encrypted backups | Up to [OWNER: 3 months] | Rotated out |
| Billing records | As tax law requires (kept by Paddle) | — |

### 8. Cookies and browser storage

Only what the service needs to work; no advertising, tracking or analytics
cookies. Details: [Cookie Policy](/en/cookie-policy).

### 9. Security

Connections are encrypted (HTTPS). Passwords are stored as one-way hashes;
two-step secrets and integration keys are encrypted. Backups are encrypted.
Access is role-based and administrative actions are logged. In case of a
breach we notify the authority and those affected within the legal
deadline.

### 10. Your rights

You can ask whether we process your data, for access, correction,
deletion, restriction or portability, object to processing, and be told
who it was shared with (KVKK art. 11; GDPR where it applies).

- **Account owners:** download all your data and delete the account under
  *Settings → Data and privacy*.
- **Visitors:** ask the business you chatted with; it can delete all of a
  visitor's data on its site in one step. You can also write to us and we
  will pass the request on and help.
- **In writing:** [OWNER: privacy@domain] from the address you registered
  with, or by post to [OWNER: address]. We may ask for information to verify
  your identity. We answer within **30 days**, free of charge.
- You can complain to the Turkish Personal Data Protection Board, or to the
  supervisory authority where you live in the EU.

### 11. Changes

When this policy changes we update the date above and tell account owners
about important changes by e-mail.
