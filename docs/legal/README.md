# Hukuk metinleri

> **Durum: TASLAK.** Bu klasördeki metinler hukuki görüş değildir. Kod
> üzerinden çıkarılan gerçeklere dayanır; **hukukçu onaylamadan yayına
> alınmaz** (plan v10 LEG-01). `[SAHİP: …]` ile işaretli boşlukları sahip
> doldurur.

## Yayındaki metinler

Sitede şu an yalnızca iki metin var; panelin çeviri dosyalarından gelir:

| Sayfa | Adres | Kaynak |
|---|---|---|
| Gizlilik Politikası | `/gizlilik`, `/en/privacy` | `admin-panel/src/locales/pages.{tr,en}.ts` → `legal.privacy` |
| Kullanım Şartları | `/kullanim-sartlari`, `/en/terms` | `legal.terms` (içinde `#guvenlik` güvenlik açığı bildirimi, SEC-10) |

## Taslaklar (LEG-01, LEG-03)

| Metin | Dosya | Yayın yeri (onaydan sonra) | Not |
|---|---|---|---|
| Gizlilik Politikası (güncelleme) | [gizlilik-politikasi.md](gizlilik-politikasi.md) | mevcut sayfa | alt işleyenler adlarıyla, yurt dışı aktarım, başvuru yolu |
| KVKK Aydınlatma Metni | [kvkk-aydinlatma-metni.md](kvkk-aydinlatma-metni.md) | yeni sayfa `/kvkk-aydinlatma-metni` | m.10 unsurları, m.11 hakları |
| Çerez Politikası | [cerez-politikasi.md](cerez-politikasi.md) | yeni sayfa `/cerez-politikasi` | yalnız zorunlu çerez ve yerel depo; onay paneli gerekmez |
| Kullanım Şartları (güncelleme) | [kullanim-sartlari.md](kullanim-sartlari.md) | mevcut sayfa | kabul edilebilir kullanım, askıya alma, plan düşürme, hizmet seviyesi |
| Veri İşleme Sözleşmesi (DPA) | [veri-isleme-sozlesmesi.md](veri-isleme-sozlesmesi.md) | Kurumsal satışta imzaya; isteğe bağlı sayfa | müşteri = veri sorumlusu, Support.io = veri işleyen |
| İade ve İptal Politikası | [iade-ve-iptal.md](iade-ve-iptal.md) | yeni sayfa `/iade-ve-iptal` | Paddle alan adı onayı için gerekli (BIL-01) |
| Alt İşleyenler | [alt-isleyenler.md](alt-isleyenler.md) | yeni sayfa `/alt-isleyenler` | plan Ek B; aktarım ayrıntısı [kvkk-transfer-checklist.md](kvkk-transfer-checklist.md) |
| Künye / İletişim | [kunye.md](kunye.md) | yeni sayfa `/kunye` | 6563 s. Kanun m.3 hizmet sağlayıcı bilgileri |
| Veri envanteri | [data-inventory.md](data-inventory.md) | iç belge | tablo tablo kişisel veri, amaç, süre, silme |
| İlgili kişi başvuru süreci | [basvuru-sureci.md](basvuru-sureci.md) | iç belge | `kvkk@`, 30 gün, panel araçları |
| Yapay zekâ şeffaflığı | [ai-transparency.md](ai-transparency.md) | LEG-07 ile | AI-03 |
| İhlal prosedürü | [breach-procedure.md](breach-procedure.md) | iç belge | OBS |

## Onay ve yayın sırası

1. **[SAHİP]** Şirket bilgileri (LEG-02) ve `[SAHİP: …]` boşlukları.
2. **[SAHİP + hukukçu]** Her taslağı okur, düzeltir, onaylar. Onay tarihi ve
   onaylayan bu tabloya yazılır.
3. Ajan onaylanan metni panelin çeviri dosyalarına (TR + EN) taşır, yeni
   sayfaların rotalarını ve site haritasını ekler; `legal.updated` tarihini
   günceller. Önemli değişiklik, mevcut müşterilere e-postayla bildirilir
   (Kullanım Şartları "Değişiklikler").
4. Yeni bir alt işleyen eklendiğinde: [alt-isleyenler.md](alt-isleyenler.md),
   gizlilik politikası, aktarım kontrol listesi birlikte güncellenir ve
   müşterilere DPA'daki süre kadar önce bildirilir.

| Metin | Onaylayan | Tarih |
|---|---|---|
| | | |

## Sağlayıcı adları

Panelde, sohbet balonunda ve pazarlama sayfalarında yapay zekâ hizmet
sağlayıcısının adı geçmez. **Tek istisna**, yasal zorunluluk gereği alt
işleyen listesidir: Gizlilik Politikası'nın alt işleyenler bölümü ve
Alt İşleyenler sayfası Google'ı (Gemini API) adıyla yazar.
