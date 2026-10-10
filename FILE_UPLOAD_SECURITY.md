# Dosya yükleme güvenliği

Sohbette gönderilen dosyalar ve site logoları için kurallar. Değerler
`backend/src/middleware/upload.ts` dosyasındakilerdir; genel güvenlik
özeti `SECURITY.md` içinde.

## Kabul edilen türler

- **Görsel:** JPEG, PNG, GIF, WebP
- **Belge:** PDF, düz metin (.txt), Word (.docx), Excel (.xlsx)
- **Eski Office biçimleri (.doc, .xls):** AV/CDR motoru bulunmadığı için
  reddedilir.
- **Arşiv (ZIP, RAR):** varsayılan olarak kapalı; yalnızca
  `ALLOW_ARCHIVE_UPLOADS=true` ile açılır. Arşivin içi taranmadığı için
  açılması bilinçli bir karardır.

Tür, dosyanın adından ya da tarayıcının bildirdiği türden değil, içeriğin
imzasından okunur. Bildirilen tür ile içerik uyuşmazsa dosya reddedilir.
DOCX/XLSX için yalnız ZIP başlığı yeterli değildir: merkezi dizin, parça
sayıları ve açılmış boyutlar sınırlandırılır; gerekli OOXML parçaları ve içerik
türleri doğrulanır. Makro, embedded object, ActiveX ve dış ilişki içeren paket
reddedilir.

## Boyut

- Sohbet dosyası: en fazla **10 MB**
- Logo: en fazla **5 MB**

## Görseller yeniden kodlanır

Her görsel çözülüp yeniden kodlanır. Böylece EXIF bilgileri (kamera, konum)
ve dosyanın sonuna eklenmiş her şey düşer; çözülemeyen bir "görsel"
reddedilir. Piksel ve kare sayıları sınırlıdır; GIF tek güvenli kare olarak
yeniden kodlanır.

## Saklama ve erişim

- Sohbet ekleri **gizlidir**: kurumun kendi önekinde
  (`org/<kurum>/site/<site>/<rastgele-ad>`) saklanır. Panel ve widget
  dosyayı 15 dakika geçerli imzalı bir bağlantıyla açar; bağlantı S3'te 5
  dakikalık bir ön-imzalı adrese yönlendirir. Oturumsuz ve imzasız istek
  dosyayı göremez.
- Yalnızca logolar herkese açıktır (`logos/` öneki).
- Her yükleme DB'de site, principal ve widget session ile bağlı bir kayıt
  oluşturur. Sunucunun verdiği 15 dakikalık kanıt yalnız bu kaydı taşıyabilir;
  ilk mesaj kaydı atomik olarak tek konuşmaya bağlar. Başka ziyaretçi/session
  kanıtı tekrar kullanamaz. Süresi dolmuş, iptal edilmiş veya silinmiş kayıt
  indirilemez.
- Konuşma silindiğinde, saklama süresi dolduğunda, bir ziyaretçinin verisi
  silindiğinde ya da çalışma alanı kapatıldığında dosyalar da depolamadan
  silinir.

## Depolama

Üretimde S3 uyumlu depolama zorunludur (`UPLOAD_STORAGE=s3`). Yerel disk
yalnızca `ALLOW_LOCAL_UPLOADS=true` ile seçilebilir; disk yedeklenmediği ve
sunucular arasında paylaşılmadığı için önerilmez.

## Hız sınırı

Yükleme uçları API'nin genel sınırına ve widget oturumuna bağlıdır; widget
oturumu olmayan ya da engellenmiş bir ziyaretçi dosya yükleyemez. Global eş
zamanlı yükleme bütçesi ve site başına günlük byte kotası depolamadan önce
uygulanır; tamamlanmayan geçici kayıtlar retention işiyle temizlenir.

## Kalan operasyonel sınır

Uygulamada yerleşik antivirüs veya Content Disarm and Reconstruction (CDR)
motoru yoktur. Bu nedenle arşivler varsayılan kapalıdır ve eski binary Office
biçimleri kabul edilmez. Arşivleri açmak için ayrı karantina alanında çalışan,
timeout/byte/decompression sınırları olan fail-closed bir tarayıcı staging'de
doğrulanmalıdır; yalnız dosya imzası kötü amaçlı içerik bulunmadığını kanıtlamaz.
