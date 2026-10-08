# Çerez Politikası — taslak

> **TASLAK — hukukçu onayı olmadan yayına alınmaz** (plan v10 LEG-01 madde 3).
> Kod üzerinden çıkarılan liste (8 Ekim 2026): panel yalnız zorunlu iki
> çerez ve iki tercih anahtarı; sohbet balonu yalnız yerel depo kullanır.
> Analitik ya da reklam çerezi **yok**; bu yüzden Kurul'un Çerez Uygulamaları
> Hakkında Rehberi'ne göre onay paneli gerekmez, bu bilgilendirme yeterlidir.
> Ziyaret sayımı (KARAR-MKT-3) kodda hazır ama **kapalı**: `ANALYTICS_SCRIPT_URL`
> ve `ANALYTICS_WEBSITE_ID` doldurulursa yalnız herkese açık sayfalarda,
> sahibin kendi sunucusundaki Umami çalışır; çerez kullanmaz, tarayıcının
> "izleme" tercihine uyar, panel sayfalarını saymaz. Açılmadan önce bu metne
> ve gizlilik politikasına eklenir (onay paneli gerekmez; hukukçu teyit eder).
> Yayın yeri: `/cerez-politikasi`, `/en/cookie-policy`.

---

## Türkçe

Support.io yalnızca hizmetin çalışması için zorunlu olan çerezleri ve
tarayıcı deposunu kullanır. Reklam, izleme, analitik ya da üçüncü taraf
çerezi kullanmayız; sohbet balonu müşterinin sitesine üçüncü taraf çerezi
bırakmaz.

### Panel ve web sitesi

| Ad | Tür | Amaç | Süre |
|---|---|---|---|
| `sc_session` | Çerez (HttpOnly, Secure, SameSite) | Oturumunuzu açık tutar | 7 gün; çıkışta silinir |
| `sc_csrf` | Çerez (Secure, SameSite) | İsteklerin sizin sekmenizden geldiğini doğrular (siteler arası istek sahteciliğine karşı) | Oturumla birlikte (7 gün) |
| `language` | Yerel depo | Seçtiğiniz dil | Siz silene kadar |
| `theme` | Yerel depo | Açık / koyu tema tercihi | Siz silene kadar |

### Sohbet balonu (müşterinin sitesinde)

Sohbet balonu çerez kullanmaz; konuşmanın sayfa değişince sürmesi için
tarayıcının **yerel deposunu** (localStorage) kullanır. Yerel depo yalnızca
o sitenin kendi adresine aittir.

| Anahtar | Amaç | Süre |
|---|---|---|
| `sc_widget_session:<site>` | İmzalı ziyaretçi oturumu: aynı konuşmaya geri dönebilmek | Oturumun süresi dolunca yenilenir; ziyaretçi silebilir |
| `sc_contact_<site>` | İletişim formunun doldurulduğu (tekrar sorulmaması için) | Ziyaretçi silene kadar |
| `sc_visitor_name` | Ziyaretçinin kendi yazdığı adı | Ziyaretçi silene kadar |
| `sc_visitor_email` | Ziyaretçinin kendi yazdığı e-posta adresi | Ziyaretçi silene kadar |

Kayıt formunda, insan olduğunuzu doğrulamak için Cloudflare Turnstile
kullanılır (açıksa); Cloudflare bu amaçla teknik çerez kullanabilir.

### Nasıl silinir

Tarayıcınızın ayarlarından çerezleri ve site verilerini silebilirsiniz.
Zorunlu çerezleri silerseniz oturumunuz kapanır; sohbet balonunun deposunu
silerseniz bir sonraki ziyarette yeni bir konuşma başlar.

---

## English

Support.io uses only the cookies and browser storage the service needs to
work. No advertising, tracking, analytics or third-party cookies; the chat
bubble sets no third-party cookie on our customers' sites.

### Panel and website

| Name | Type | Purpose | Lifetime |
|---|---|---|---|
| `sc_session` | Cookie (HttpOnly, Secure, SameSite) | Keeps you signed in | 7 days; removed on sign-out |
| `sc_csrf` | Cookie (Secure, SameSite) | Proves a request came from your own tab (cross-site request forgery protection) | With the session (7 days) |
| `language` | Local storage | The language you chose | Until you clear it |
| `theme` | Local storage | Light or dark theme | Until you clear it |

### Chat bubble (on our customers' sites)

The chat bubble uses no cookies. It keeps a few entries in the site's
**local storage** so a conversation survives a page change; local storage
belongs to that site alone.

| Key | Purpose | Lifetime |
|---|---|---|
| `sc_widget_session:<site>` | Signed visitor session: return to the same conversation | Renewed when it expires; the visitor can clear it |
| `sc_contact_<site>` | That the contact form was filled in (not asked again) | Until the visitor clears it |
| `sc_visitor_name` | The name the visitor typed | Until the visitor clears it |
| `sc_visitor_email` | The e-mail the visitor typed | Until the visitor clears it |

The sign-up form uses Cloudflare Turnstile (when enabled) to tell people
from bots; Cloudflare may set technical cookies for that purpose.

### How to remove them

Clear cookies and site data in your browser settings. Removing the
essential cookies signs you out; clearing the chat bubble's storage starts
a new conversation on the next visit.
