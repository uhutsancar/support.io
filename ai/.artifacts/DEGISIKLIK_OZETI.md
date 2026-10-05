# Yerel yapay zekâ asistanı: yapılan değişikliklerin özeti

**Tarih:** 24.09.2026
**Dal:** `feat/local-llm-assistant`, GitHub'a gönderildi.
**Hedef:** `main` (birleştirme commit'i `88a246a`, GitHub'a gönderildi: `f684c13..88a246a`).
**Boyut:** 20 commit, 77 dosya, +7600 / −791 satır.

## Kısaca ne yapıldı?

Support.io'ya, Trendyol'un açık modeli **Trendyol-LLM-Asure-12B** ile çalışan yerel bir yapay zekâ asistanı eklendi. Model şirketin kendi sunucusunda (vLLM) çalışır. Hiçbir dış yapay zekâ servisine (OpenAI, Anthropic, Gemini vb.) istek gitmez. Model kapalıysa veya emin değilse konuşma her zaman bir temsilciye devredilir; başka bir modele geçilmez.

Her site için üç mod var:

| Mod | Ne yapar? |
|---|---|
| **Kapalı** | Yapay zekâ kullanılmaz; eski SSS botu bugünkü gibi çalışır. |
| **Temsilci asistanı** | Temsilci özet, cevap taslağı, ton düzeltme ve çeviri alır. Müşteriye hiçbir şey kendiliğinden gitmez. |
| **Otomatik yanıt** | Asistan müşteriye kendisi cevap verir; gerektiğinde temsilciye devreder. |

## Commit'ler (sırasıyla)

### 1. Temizlik ve altyapı
- `90b4119`: Anthropic sağlayıcısı ve `@anthropic-ai/sdk` bağımlılığı kaldırıldı.
- `d824ab6`: `config/ai.ts` ve vLLM sağlayıcısı eklendi. Her isteğin bir zaman aşımı var ve eşzamanlı istek sayısı sınırlı. Model durumu dört değerden biri olarak raporlanıyor: kapalı, yükleniyor, hazır, ulaşılamıyor.
- `71e8767`: Konuşma özeti artık en son mesajlardan kuruluyor. SSS araması müşterinin sorusuna göre yapılıyor.
- `cb91b6a`: Site erişim kontrolü tek bir yerde toplandı. Hız sınırlayıcı Redis üzerinde çalışıyor.

### 2. Yapay zekâ çekirdeği
- `6e604ba`: Sürümlü istemler (prompt) eklendi. Model cevabı sabit bir JSON şemasında dönüyor. Cevap politikası kuralları:
  - Kart numarası, IBAN, T.C. kimlik numarası veya "temsilci istiyorum" gibi mesajlar modele hiç gönderilmiyor.
  - Modelin verdiği her rakam, bağlantı ve kod SSS'de ya da sipariş verisinde geçmek zorunda. Uydurma bilgi içeren cevap müşteriye gönderilmiyor.
- `9baae2a`: Veritabanına şunlar eklendi:
  - site AI ayarları ve entegrasyonları;
  - konuşmanın o an kimde olduğu bilgisi (asistan / temsilci);
  - çift mesajı önleyen mesaj kimliği;
  - AI mesajlarının kaynak bilgisi.
- `6f43c6e`: Otomatik yanıt eklendi:
  - Asistan 800 ms bekleyip müşterinin mesajlarını topluca cevaplıyor.
  - Temsilci yazınca asistan anında susuyor ("Devral" / "AI'ye geri ver").
  - Cevap, göndermeden hemen önce veritabanında son bir kez doğrulanıyor.

### 3. Mağaza entegrasyonları
- `bf3af2d`: Widget'taki `identify()` çağrısının `userHash` imzası artık sunucuda doğrulanıyor. Böylece müşteri kendini başkası gibi gösteremiyor.
- `2ead5d8`: Sipariş sorgulama eklendi. Asistan, giriş yapmış müşterinin siparişini mağazanın kendi servisinden imzalı istekle soruyor. Güvenlik önlemleri:
  - yalnız HTTPS kullanılıyor;
  - iç ağ adreslerine istek atılamıyor;
  - her istek 3 sn'de zaman aşımına uğruyor;
  - yanıt en fazla 64 KB olabiliyor;
  - her kuruluş için bir istek kotası var.

### 4. Panel ve widget
- `c138af4`: Panele şunlar eklendi:
  - site bazında AI ayarları;
  - entegrasyonlar (gizli anahtarlar ekranda gösterilmiyor);
  - Devral / AI'ye geri ver düğmeleri;
  - "Otomatik asistan" etiketi ve devir nedeni;
  - temsilci asistanının tüm düğmeleri.
- `7d512d9`: Widget'a asistan satırı ve "Temsilciye bağlan" düğmesi eklendi.

### 5. Kurulum, ölçüm ve belgeler
- `ea43420`: Docker Compose'a `llm` ve `model-download` servisleri eklendi. `ai` profili açılmadıkça çalışmıyorlar. vLLM imajı sabit bir sürüme bağlandı.
- `fbbdbdf`: Hafif bir ölçüm (benchmark) aracı eklendi (`npm run ai:bench`). 100 senaryoyu çalıştırıp grafikli bir HTML rapor üretiyor.
- `daee3f3`: README ve mimari belgeleri güncellendi. Mağazalar için kimlik doğrulama ve sipariş servisi sözleşmesi `ai/README.md` dosyasında.
- `1c3a104`: Yorumlardan ve senaryolardan firma adları temizlendi.

### 6. Tarayıcı testlerinde bulunan hatalar
- `f14a997`: Otomatik yanıt testleri, veritabanı yoğunken de güvenilir çalışacak şekilde yalıtıldı.
- `58a0f35`: "Otomatik yanıt" onayı, mod değiştirilip geri gelindiğinde yeniden soruluyor.
- `8039082`: Model sunucusu kapalıyken müşteri ~9 sn bekliyordu. Artık ~5 sn içinde temsilciye devrediliyor.
- `c9a7024`: Temsilci yazdıktan sonra panel eski önbellekten "asistan yanıtlıyor" gösteriyordu. Açık konuşma artık her seferinde canlı okunuyor.
- `514c551`: Geçersiz site anahtarında sunucu, belgelerde yazan `WIDGET_NOT_FOUND` kodunu dönüyor. Önceden `NOT_FOUND` dönüyordu ve eski 2 test bu yüzden kalıyordu.

## Nasıl doğrulandı?

- **Otomatik testler:** 130 testin 130'u geçti. Birleştirmeden önce dalda, sonra `main` üzerinde çalıştırıldı.
- **Derleme:** backend ve panel TypeScript kontrolü temiz.
- **Tarayıcı:** önceki turlarda 44 adım, son turda sancaruhut@gmail.com hesabıyla 13 adım denendi; hepsi geçti. Son turda denenenler:
  - giriş ve ana sayfalar;
  - AI ayarları;
  - `/demo`'dan mesaj gönderme ve mesajın panele anında düşmesi;
  - temsilci cevabının widget'a anında düşmesi;
  - mobil görünüm.

## Henüz yapılmayanlar

- **Model gerçekte hiç çalıştırılmadı.** Test bilgisayarının ekran kartı 4 GB; model 4-bit'te bile ~8 GB istiyor. Cevap kalitesi ve hız, 12–16 GB GPU'lu bir makinede şu adımlarla ölçülecek:
  1. `npm run ai:download` ile modeli indirmek.
  2. `.env` dosyasında `COMPOSE_PROFILES=ai` satırını açıp `docker compose up` çalıştırmak.
  3. `npm run ai:bench` ile ölçmek.
- Bu ölçüm yapılana kadar AI sunucuda kapalı; siteler eski SSS botuyla çalışmaya devam ediyor.
- Canlıda "Otomatik yanıt" modunun açılması, ölçüm sonuçlarına göre ayrıca kararlaştırılacak.
