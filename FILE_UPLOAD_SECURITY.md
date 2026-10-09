# Dosya yükleme güvenliği

Sohbette gönderilen dosyalar ve site logoları için kurallar. Değerler
`backend/src/middleware/upload.ts` dosyasındakilerdir; genel güvenlik
özeti `SECURITY.md` içinde.

## Kabul edilen türler

- **Görsel:** JPEG, PNG, GIF, WebP
- **Belge:** PDF, düz metin (.txt), Word (.doc, .docx), Excel (.xls, .xlsx)
- **Arşiv (ZIP, RAR):** varsayılan olarak kapalı; yalnızca
  `ALLOW_ARCHIVE_UPLOADS=true` ile açılır. Arşivin içi taranmadığı için
  açılması bilinçli bir karardır.

Tür, dosyanın adından ya da tarayıcının bildirdiği türden değil, içeriğin
ilk baytlarından (imza) okunur. Bildirilen tür ile içerik uyuşmazsa dosya
reddedilir.

## Boyut

- Sohbet dosyası: en fazla **10 MB**
- Logo: en fazla **5 MB**

## Görseller yeniden kodlanır

Her görsel çözülüp yeniden kodlanır. Böylece EXIF bilgileri (kamera, konum)
ve dosyanın sonuna eklenmiş her şey düşer; çözülemeyen bir "görsel"
reddedilir.

## Saklama ve erişim

- Sohbet ekleri **gizlidir**: kurumun kendi önekinde
  (`org/<kurum>/site/<site>/<rastgele-ad>`) saklanır. Panel ve widget
  dosyayı 12 saat geçerli imzalı bir bağlantıyla açar; bağlantı S3'te 5
  dakikalık bir ön-imzalı adrese yönlendirir. Oturumsuz ve imzasız istek
  dosyayı göremez.
- Yalnızca logolar herkese açıktır (`logos/` öneki).
- Ziyaretçinin yüklediği dosya, sunucunun verdiği 15 dakikalık bir
  "bu dosyayı biz yükledik" kanıtıyla mesaja bağlanır; başka bir sitenin ya
  da uydurma bir dosyanın adresi mesaja konamaz.
- Konuşma silindiğinde, saklama süresi dolduğunda, bir ziyaretçinin verisi
  silindiğinde ya da çalışma alanı kapatıldığında dosyalar da depolamadan
  silinir.

## Depolama

Üretimde S3 uyumlu depolama zorunludur (`UPLOAD_STORAGE=s3`). Yerel disk
yalnızca `ALLOW_LOCAL_UPLOADS=true` ile seçilebilir; disk yedeklenmediği ve
sunucular arasında paylaşılmadığı için önerilmez.

## Hız sınırı

Yükleme uçları API'nin genel sınırına ve widget oturumuna bağlıdır; widget
oturumu olmayan ya da engellenmiş bir ziyaretçi dosya yükleyemez.
