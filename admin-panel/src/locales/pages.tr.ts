/**
 * Sektör çözümleri sayfalarının metinleri (Türkçe).
 *
 * `marketing.tr.ts` ile aynı kurallar: uydurma sayı yok, pazarlama dilinde
 * teknik terim yok. Her çözüm sayfası aynı ürünü o sektörün kendi
 * sorularıyla anlatır; `uses` dizisi `SOLUTIONS[].features` ile aynı
 * sıradadır ve her madde o özelliğin detay sayfasına bağlanır.
 */

export default {
  solutions: {
    eyebrow: 'Çözümler',
    painsTitle: 'Tanıdık gelen durumlar',
    usesTitle: 'Support.io bu işte nasıl çalışır',
    winsTitle: 'Ne değişir',
    othersTitle: 'Diğer sektörler',
    featureLink: 'Özelliği incele',
    items: {
      ecommerce: {
        name: 'E-ticaret',
        tag: 'Kargo, iade, beden ve ödeme soruları',
        photoAlt: 'Paketlerin arasında telefonundan siparişlere bakan mağaza sahibi',
        headline: 'Sepetteki müşteri sorusunu sorabilsin, sipariş kaçmasın',
        desc: '“Bu bedeni var mı?”, “Kargom nerede?”, “İade nasıl?” Ürün sayfasında soru soran müşteri cevabı beklemeden gider. Sohbet balonu tam o sayfada açılır, cevabı belli sorular yardım içeriğinde kendiliğinden biter.',
        pains: [
          {
            title: 'Aynı soru günde otuz kez',
            body: 'Kargo süresi, iade koşulu, beden tablosu — ekip gününü kopyala-yapıştırla geçiriyor.'
          },
          {
            title: 'Ödeme adımında sessiz kayıp',
            body: 'Takılan ziyaretçi sormuyor, sekmeyi kapatıyor. Neden gittiğini hiç öğrenmiyorsunuz.'
          },
          {
            title: '“Siparişim nerede?” yoğunluğu',
            body: 'Kampanya haftasında gelen kutusu sipariş sorgusuyla doluyor, asıl sorunlar arada kayboluyor.'
          }
        ],
        uses: [
          {
            title: 'Satışa yakın konuşmalar anında düşer',
            body: 'Ürün sayfasından yazan kişinin hangi ürüne baktığını görerek yanıtlarsınız; müşteri beklemez.'
          },
          {
            title: 'Ödemede takılana siz yazarsınız',
            body: 'Ödeme sayfasında 30 saniyeden uzun kalan ziyaretçiye kendiliğinden yardım teklif eden bir mesaj gider.'
          },
          {
            title: 'Kargo ve iade soruları kendiliğinden biter',
            body: 'Yardım içeriğine bir kez yazdığınız cevabı müşteri balonun içinde arayıp bulur.'
          },
          {
            title: 'İade ve değişim doğru ekibe gider',
            body: 'İade talebi operasyona, ürün sorusu satışa. Kampanya haftasında da kimin neye bakacağı bellidir.'
          }
        ],
        wins: [
          { label: 'Ekip satışa odaklanır', body: 'Tekrarlayan sorular yardım içeriğinde kalır.' },
          { label: 'Daha az terk edilen sepet', body: 'Takılan ziyaretçi sessizce gitmeden yardım alır.' },
          { label: 'Kampanya haftası panik yok', body: 'Konuşmalar departmanlara dağılır, kuyruk tek kişide birikmez.' }
        ]
      },
      saas: {
        name: 'Yazılım / SaaS',
        tag: 'Deneme süresi, kurulum ve hata bildirimleri',
        photoAlt: 'Ofiste ekran başında birlikte çalışan yazılım ekibi',
        headline: 'Deneme süresindeki kullanıcıyı takılıp bırakmadan yakalayın',
        desc: 'Ürününüzü yeni deneyen biri takıldığında genellikle sormaz, sessizce çıkar. Kimin nerede takıldığını görün, sorusu doğru ekibe gitsin.',
        pains: [
          {
            title: 'Sessiz terk',
            body: 'Kurulum adımında duran kullanıcı yardım istemiyor; deneme süresi bitince geri gelmiyor.'
          },
          {
            title: 'Her soru destek ekibinde',
            body: 'Fatura sorusu da hata bildirimi de aynı kişiye düşüyor, aktarması saatler sürüyor.'
          },
          {
            title: 'Bağlamsız konuşma',
            body: 'Temsilci kullanıcının hangi ekranda olduğunu, hangi planda olduğunu sorarak başlıyor.'
          }
        ],
        uses: [
          {
            title: 'Konu doğru ekibe gider',
            body: 'Faturalandırma muhasebeye, hata bildirimi teknik ekibe, satış sorusu satışa. Departmanlar bir kez tanımlanır.'
          },
          {
            title: 'Kim nerede, canlı görürsünüz',
            body: 'Hangi kullanıcı hangi sayfada ne kadar kaldı, panelde akar. Takılana siz yazarsınız.'
          },
          {
            title: 'Tekrarlayan işler kurala bağlanır',
            body: '“Mesajda hata geçiyorsa yüksek öncelik ver ve teknik ekibe gönder” gibi kuralları listeden kurarsınız.'
          },
          {
            title: 'Destek yükünü rakamla görürsünüz',
            body: 'Hangi konuda kaç soru geldi, ilk yanıt ne kadar sürdü, hangi ekip ne kadar yük taşıyor.'
          }
        ],
        wins: [
          { label: 'Takılan kullanıcı kaybolmaz', body: 'Uzun süre aynı ekranda kalana siz yazarsınız.' },
          { label: 'Aktarma yok', body: 'Soru ilk seferde doğru ekibe düşer.' },
          { label: 'Bağlam hazır', body: 'Kullanıcı kim, nerede, ne sormuştu — yanınızda.' }
        ]
      },
      agency: {
        name: 'Ajans / Birden çok site',
        tag: 'Müşteri siteleri, ayrı ekipler, ayrı raporlar',
        photoAlt: 'Dizüstü bilgisayar başında gülümseyerek toplanan ajans ekibi',
        headline: 'Tek panelden onlarca siteyi yönetin, veriler karışmasın',
        desc: 'Yönettiğiniz her site kendi kurulum satırını, kendi görünümünü ve kendi raporunu alır. Hangi ekip üyesinin hangi siteyi göreceğini siz seçersiniz.',
        pains: [
          { title: 'Her site ayrı panel', body: 'Müşteri başına ayrı araç, ayrı şifre, ayrı fatura.' },
          { title: 'Karışan veriler', body: 'Bir müşterinin konuşması diğerinin raporunda görünmemeli.' },
          { title: 'Müşteriye rapor', body: 'Ay sonunda her müşteri için ayrı ayrı rakam toplamak saatler alıyor.' }
        ],
        uses: [
          {
            title: 'Her siteye ayrı balon',
            body: 'Rengi, karşılama metni ve konumu site başına ayarlanır; aynı tek satır her altyapıda çalışır.'
          },
          {
            title: 'Kim neyi görür, siz seçersiniz',
            body: 'Ekip üyelerini davet eder, rollerini belirlersiniz. Yetkisi olmayan ekranı açamaz.'
          },
          {
            title: 'Site bazında rapor',
            body: 'Raporları tek siteye süzersiniz; müşteriye göstereceğiniz rakam hazırdır.'
          },
          {
            title: 'Müşteriye göre ekip',
            body: 'Her müşterinin konuşmaları o müşteriye bakan departmana düşer.'
          }
        ],
        wins: [
          { label: 'Tek giriş', body: 'Onlarca site için onlarca panel açmazsınız.' },
          { label: 'Site başına ayrım', body: 'Konuşmalar ve raporlar kendi sitesinde kalır.' },
          { label: 'Hazır rapor', body: 'Ay sonu toplantısına rakamla girersiniz.' }
        ]
      },
      health: {
        name: 'Klinik / Sağlık',
        tag: 'Randevu, fiyat ve yol tarifi soruları',
        photoAlt: 'Klinikte hastasıyla konuşan gülümseyen doktor',
        headline: 'Telefonla sorulan her şeyi yazıyla, mesai dışında da alın',
        desc: 'Randevu, fiyat ve adres soruları telefonu meşgul eder. Aynı sorular sohbetten geldiğinde ekibiniz aynı anda birkaç kişiyle ilgilenebilir.',
        pains: [
          { title: 'Hat hep meşgul', body: 'Resepsiyon aynı anda hem hastayla hem telefonla ilgileniyor.' },
          { title: 'Mesai dışı sessizlik', body: 'Akşam gelen soru cevapsız kalıyor, hasta başka yere yazıyor.' },
          { title: 'Aynı bilgiler', body: 'Çalışma saati, otopark, fiyat — günde onlarca kez aynı cevap.' }
        ],
        uses: [
          {
            title: 'Aynı anda birkaç kişiyle',
            body: 'Telefonda tek kişiyle konuşurken sohbette dört kişiye yanıt verilebilir.'
          },
          {
            title: 'Sık sorular kendiliğinden',
            body: 'Çalışma saatleri, adres ve hazırlık bilgileri yardım içeriğinde; hasta balonun içinde bulur.'
          },
          {
            title: 'Mesai dışında doğru mesaj',
            body: 'Mesai saatleri dışında yazan kişiye ne zaman döneceğiniz söylenir; mesaj sabah gelen kutunuzdadır.'
          },
          {
            title: 'Kim ne sordu, ekip görür',
            body: 'Resepsiyon, fatura ve doktor asistanı aynı konuşmayı birbirine devredebilir.'
          }
        ],
        wins: [
          { label: 'Telefon boşalır', body: 'Rutin sorular yazıya ve yardım içeriğine taşınır.' },
          { label: 'Gece gelen kaybolmaz', body: 'Sabah ilk iş gelen kutusunda durur.' },
          { label: 'Hasta beklemez', body: 'Basit sorunun cevabı saniyeler içinde.' }
        ]
      },
      hospitality: {
        name: 'Otel / Restoran',
        tag: 'Rezervasyon, oda ve menü soruları',
        photoAlt: 'Ahşap detaylı modern otel resepsiyonu',
        headline: 'Rezervasyon sayfasındaki misafir sorusunu anında yanıtlayın',
        desc: 'Oda tipi, erken giriş, otopark, alerjen… Rezervasyon yapmak üzere olan misafir cevabı bulamazsa başka sekmeye geçer.',
        pains: [
          { title: 'Rezervasyon yarıda kalıyor', body: 'Soru soran misafir cevap beklerken başka otele bakıyor.' },
          { title: 'Farklı dillerde misafir', body: 'İngilizce, Almanca, Rusça gelen sorulara aynı hızda dönmek zor.' },
          { title: 'Tekrarlayan talepler', body: 'Havaalanı transferi ve erken giriş talebi her gün yeniden yazılıyor.' }
        ],
        uses: [
          {
            title: 'Rezervasyon sayfasında siz yazarsınız',
            body: 'Oda seçiminde uzun süre kalan misafire yardım teklif eden bir mesaj kendiliğinden gider.'
          },
          {
            title: 'Konuşma anında resepsiyonda',
            body: 'Mesaj yazıldığı an ekibin ekranında; dosya ve fotoğraf da paylaşılabilir.'
          },
          {
            title: 'Sık sorular balonun içinde',
            body: 'Check-in saati, otopark ve kahvaltı gibi soruların cevabını misafir balonun içinde arayıp bulur.'
          },
          {
            title: 'Grup ve etkinlik talepleri takipte',
            body: 'Büyük rezervasyona dönen konuşma fırsat olarak açılır, aşamasıyla izlenir.'
          }
        ],
        wins: [
          { label: 'Rezervasyon yarıda kalmaz', body: 'Soru cevapsız kalmadan yanıtlanır.' },
          { label: 'Tekrar yazmak yok', body: 'Transfer ve erken giriş cevapları kurala bağlı hazır mesajla gider.' },
          { label: 'Grup satışı kaybolmaz', body: 'Büyük talepler ayrı bir hatta izlenir.' }
        ]
      },
      education: {
        name: 'Eğitim',
        tag: 'Kayıt, ders ve ödeme soruları',
        photoAlt: 'Kulaklıkla dizüstü bilgisayarda çevrimiçi derse katılan öğrenci',
        headline: 'Kayıt döneminde gelen soruların altında kalmayın',
        desc: 'Kayıt tarihleri, ders programı, ödeme seçenekleri… Dönem başında gelen yüzlerce soru ekibi boğar. Cevabı belli olanı yardım içeriği karşılasın, gerisi doğru birime gitsin.',
        pains: [
          { title: 'Dönem başı yığılması', body: 'İki hafta boyunca gelen kutusu kayıt sorularıyla dolu.' },
          { title: 'Yanlış birime giden soru', body: 'Ödeme sorusu akademik birime, ders sorusu muhasebeye gidiyor.' },
          { title: 'Görünmeyen yük', body: 'Hangi dönemde hangi konuda yoğunluk olduğunu bilmiyorsunuz.' }
        ],
        uses: [
          {
            title: 'Cevabı belli soru kendiliğinden biter',
            body: 'Kayıt tarihleri ve belgeler yardım içeriğinde; öğrenci balonun içinde arayıp bulur.'
          },
          {
            title: 'Soru yazıldığı an ekipte',
            body: 'Öğrencinin hangi sayfadan yazdığını görerek yanıtlarsınız; telefon sırası beklemez.'
          },
          {
            title: 'Soru doğru birime gider',
            body: 'Kayıt, ödeme ve akademik sorular ayrı departmanlara dağıtılır.'
          },
          {
            title: 'Yoğunluğu önceden görürsünüz',
            body: 'Hangi hafta, hangi konuda ne kadar soru geldiği raporda durur.'
          }
        ],
        wins: [
          { label: 'Ekip nefes alır', body: 'Rutin sorular yardım içeriğinde kalır.' },
          { label: 'Öğrenci beklemez', body: 'Cevabı belli soru saniyeler içinde yanıtlanır.' },
          { label: 'Gelecek dönem hazır', body: 'Hangi konuda yoğunluk olacağını bilirsiniz.' }
        ]
      }
    }
  }
};
