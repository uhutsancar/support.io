# Yapay zekâ şeffaflığı — hukukçu için not

> Bu belge hukuki görüş değildir. Ürünün bugün ne yaptığını ve konuyla ilgili
> bilinen düzenlemeleri, hukukçunun değerlendirmesi için bir araya getirir.
> Tarih: 7 Ekim 2026.

## Ürün ne yapıyor

Site sahibi "Yapay zekâ asistanı"nı açtığında, ziyaretçinin sorusuna ilk
yanıtı sitenin herkese açık SSS içeriğinden — Pro ve Kurumsal planda ayrıca
site sahibinin eklediği kendi site sayfalarından ve yüklediği PDF
belgelerden (PRD-21) — bir yapay zekâ modeli üretir. Belgenin kendisi
saklanmaz, metni saklanır; modele yalnızca soruyla ilgili bölümler gider.
Panel, yalnızca herkese açık bilgi eklenmesini ve kişisel veri içeren belge
yüklenmemesini ister.

Ziyaretçiye gösterilenler (sohbet balonu, `backend/src/widget/widget.ts`):

- Pencere başlığında: **"Otomatik asistan · Temsilciye bağlan"** — tek
  tıkla insana geçiş.
- Asistanın her yanıtının üstünde **"Yapay zekâ asistanı"** rozeti.
- İlk yanıtın altında: **"Otomatik yanıt · Bir temsilciye bağlanmak için
  yazın: temsilci"** (İngilizce sitelerde: "Automatic answer · To reach a
  person, type: agent").
- Sağlayıcının (Google) ya da modelin adı ziyaretçiye gösterilmez.

Asistan şu durumlarda hiç yanıt vermeden konuşmayı bir insana devreder:
ziyaretçi temsilci isterse; mesajda kart, IBAN veya kimlik numarası varsa;
SSS ve eklenen kaynaklar soruyu yanıtlamıyorsa ya da yanıt bunlardan birine
dayanmıyorsa; plan
kotası dolduysa; servis yanıt vermezse. Bir temsilci yazdığı anda asistan o
konuşmada susar.

Site sahibine gösterilenler (panel): asistanı açarken onay penceresi
(SSS içeriği ve maskelenmiş ziyaretçi sorularının yapay zekâ hizmet
sağlayıcısına gideceği, aktarımın yurt dışında olabileceği, ziyaretçiye
yapay zekâ ile yazıştığının gösterileceği). Onaylayan kişi ve zaman
denetim kaydına yazılır (`ASSISTANT_ENABLED`). Ayarlarda: "Asistanın
yanıtları ziyaretçiye 'Yapay zekâ asistanı' olarak işaretlenir."

## İlgili düzenlemeler (bilgi amaçlı)

- **AB Yapay Zekâ Yasası (Regulation (EU) 2024/1689), madde 50(1):**
  insanlarla doğrudan etkileşen yapay zekâ sistemlerinin sağlayıcıları,
  kişilerin bir yapay zekâ sistemiyle etkileştiklerini bilecekleri biçimde
  tasarım yapmakla yükümlüdür (durum bağlamdan açıkça anlaşılmıyorsa).
  Madde 50 yükümlülükleri **2 Ağustos 2026'dan beri uygulanmaktadır**.
  Kamuya açık değerlendirmelere göre "Digital Omnibus" değişiklikleri 50(1)'i
  ertelememiştir; yalnızca 50(2)'deki işaretleme yükümlülüğü için, o tarihten
  önce piyasada olan sistemlere 2 Aralık 2026'ya kadar süre tanınmıştır.
  Hukukçunun teyit etmesi gerekenler:
  - Support.io bu düzende "sağlayıcı" mı, yoksa asistanı sitesinde kullanan
    müşteri "uygulayıcı" (deployer) mı; her birinin yükümlülüğü ne?
  - Yukarıdaki ekran metinleri 50(1) için yeterli mi?
  - Türkiye'deki müşterilerin AB'deki ziyaretçileri için durum.
- **Türkiye:** Yapay zekâya özgü yürürlükte bir kanun bilinmiyor; kişisel
  verilerin işlenmesi ve yurt dışı aktarım KVKK'ya tabidir
  (bkz. `kvkk-transfer-checklist.md`).
- **Google Gemini API şartları:** ücretsiz katmanda gönderilen içerik
  Google ürünlerini geliştirmek için kullanılabilir ve insan
  değerlendiricilerce okunabilir; AEA, İsviçre ve Birleşik Krallık'taki
  kullanıcılara sunulan uygulamalar yalnızca ücretli hizmeti kullanabilir.
  Ürün, ücretsiz katmanda bu bölgelerden gelen ziyaretçileri modele hiç
  göndermez (`GEMINI_TIER=free`, Cloudflare'in ülke bilgisine göre).
  Ücretli katmana geçiş kararı sahibindir (KARAR-AI-1).

## Kaynaklar

- Goodwin, "Not Delayed, Not Deferred: EU AI Act Transparency Obligations
  Are Now in Force" (Ağustos 2026)
- McCann FitzGerald, "One Month to Go: EU AI Act Transparency Compliance"
- Regulation (EU) 2024/1689, madde 50 ve 113
- Google, Gemini API Additional Terms of Service
