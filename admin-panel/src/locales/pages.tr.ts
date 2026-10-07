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
        desc: '“Bu bedeni var mı?”, “Kargo ne kadar sürer?”, “İade nasıl?” Ürün sayfasında soru soran müşteri cevabı beklemeden gider. Sık soruları yapay zekâ asistanı gece gündüz yanıtlar; satışa dönecek konuşmalar ekibinize kalır.',
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
            title: 'Kargo ve iade sorularını yapay zekâ yanıtlar',
            body: 'İade süresi, kargo ücreti, beden tablosu… SSS’nize bir kez yazdığınız cevabı asistan saniyeler içinde verir; bilmediğini ekibinize bırakır.'
          },
          {
            title: 'İade ve değişim doğru ekibe gider',
            body: 'İade talebi operasyona, ürün sorusu satışa. Kampanya haftasında da kimin neye bakacağı bellidir.'
          }
        ],
        wins: [
          { label: 'Ekip satışa odaklanır', body: 'Tekrarlayan soruları yapay zekâ karşılar.' },
          {
            label: 'Daha az terk edilen sepet',
            body: 'Takılan ziyaretçi sessizce gitmeden yardım alır.'
          },
          {
            label: 'Kampanya haftası panik yok',
            body: 'Konuşmalar departmanlara dağılır, kuyruk tek kişide birikmez.'
          }
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
          {
            label: 'Takılan kullanıcı kaybolmaz',
            body: 'Uzun süre aynı ekranda kalana siz yazarsınız.'
          },
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
          {
            title: 'Her site ayrı panel',
            body: 'Müşteri başına ayrı araç, ayrı şifre, ayrı fatura.'
          },
          {
            title: 'Karışan veriler',
            body: 'Bir müşterinin konuşması diğerinin raporunda görünmemeli.'
          },
          {
            title: 'Müşteriye rapor',
            body: 'Ay sonunda her müşteri için ayrı ayrı rakam toplamak saatler alıyor.'
          }
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
          {
            title: 'Hat hep meşgul',
            body: 'Resepsiyon aynı anda hem hastayla hem telefonla ilgileniyor.'
          },
          {
            title: 'Mesai dışı sessizlik',
            body: 'Akşam gelen soru cevapsız kalıyor, hasta başka yere yazıyor.'
          },
          {
            title: 'Aynı bilgiler',
            body: 'Çalışma saati, otopark, fiyat — günde onlarca kez aynı cevap.'
          }
        ],
        uses: [
          {
            title: 'Aynı anda birkaç kişiyle',
            body: 'Telefonda tek kişiyle konuşurken sohbette dört kişiye yanıt verilebilir.'
          },
          {
            title: 'Sık soruları yapay zekâ yanıtlar',
            body: 'Çalışma saatleri, adres, otopark ve hazırlık bilgileri — asistan mesai dışında da SSS’nizden yanıtlar.'
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
          { label: 'Telefon boşalır', body: 'Rutin soruları yapay zekâ asistanı karşılar.' },
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
          {
            title: 'Rezervasyon yarıda kalıyor',
            body: 'Soru soran misafir cevap beklerken başka otele bakıyor.'
          },
          {
            title: 'Farklı dillerde misafir',
            body: 'İngilizce, Almanca, Rusça gelen sorulara aynı hızda dönmek zor.'
          },
          {
            title: 'Tekrarlayan talepler',
            body: 'Havaalanı transferi ve erken giriş talebi her gün yeniden yazılıyor.'
          }
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
            title: 'Sık soruları yapay zekâ yanıtlar',
            body: 'Check-in saati, otopark, kahvaltı ve evcil hayvan kuralı — asistan gece yarısı da saniyeler içinde yanıtlar.'
          },
          {
            title: 'Grup ve etkinlik talepleri takipte',
            body: 'Büyük rezervasyona dönen konuşma fırsat olarak açılır, aşamasıyla izlenir.'
          }
        ],
        wins: [
          { label: 'Rezervasyon yarıda kalmaz', body: 'Soru cevapsız kalmadan yanıtlanır.' },
          {
            label: 'Tekrar yazmak yok',
            body: 'Transfer ve erken giriş cevapları kurala bağlı hazır mesajla gider.'
          },
          { label: 'Grup satışı kaybolmaz', body: 'Büyük talepler ayrı bir hatta izlenir.' }
        ]
      },
      education: {
        name: 'Eğitim',
        tag: 'Kayıt, ders ve ödeme soruları',
        photoAlt: 'Kulaklıkla dizüstü bilgisayarda çevrimiçi derse katılan öğrenci',
        headline: 'Kayıt döneminde gelen soruların altında kalmayın',
        desc: 'Kayıt tarihleri, ders programı, ödeme seçenekleri… Dönem başında gelen yüzlerce soru ekibi boğar. Cevabı belli olanı yapay zekâ asistanı karşılasın, gerisi doğru birime gitsin.',
        pains: [
          {
            title: 'Dönem başı yığılması',
            body: 'İki hafta boyunca gelen kutusu kayıt sorularıyla dolu.'
          },
          {
            title: 'Yanlış birime giden soru',
            body: 'Ödeme sorusu akademik birime, ders sorusu muhasebeye gidiyor.'
          },
          {
            title: 'Görünmeyen yük',
            body: 'Hangi dönemde hangi konuda yoğunluk olduğunu bilmiyorsunuz.'
          }
        ],
        uses: [
          {
            title: 'Cevabı belli soruyu yapay zekâ yanıtlar',
            body: 'Kayıt tarihleri, gerekli belgeler, ödeme seçenekleri — asistan SSS’nizden saniyeler içinde yanıtlar.'
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
          { label: 'Ekip nefes alır', body: 'Rutin soruları yapay zekâ karşılar.' },
          { label: 'Öğrenci beklemez', body: 'Cevabı belli soru saniyeler içinde yanıtlanır.' },
          { label: 'Gelecek dönem hazır', body: 'Hangi konuda yoğunluk olacağını bilirsiniz.' }
        ]
      }
    }
  },

  aiPage: {
    meta: {
      title: 'Yapay zekâ asistanı',
      description:
        'Sitenizdeki sohbet balonunda sık soruları 7/24, saniyeler içinde yanıtlayan yapay zekâ asistanı. Sizin SSS içeriğinizden konuşur, bilmediğini ekibinize devreder.'
    },
    eyebrow: 'Yapay zekâ asistanı',
    title: 'Müşterinize gece gündüz yanıt veren asistan',
    desc: 'Support.io’nun yapay zekâ asistanı sitenizdeki sohbet balonunda sık sorulan soruları saniyeler içinde yanıtlar. Sizin SSS içeriğinizden konuşur, bilmediğini uydurmaz ve gerektiğinde konuşmayı ekibinize devreder.',
    ctaPrimary: 'Ücretsiz başlayın',
    ctaSecondary: 'Planları görün',
    heroPoints: ['Kurulum gerektirmez', 'Her planda dâhil', 'İstediğiniz an kapatın'],

    howEyebrow: 'Nasıl çalışır',
    howTitle: 'Üç adımda devrede',
    how: [
      {
        title: 'SSS’nizi yazın',
        body: 'En çok sorulan soruları ve cevaplarını panele ekleyin. Asistan yalnızca bunlardan yanıt verir.'
      },
      {
        title: 'Asistanı açın',
        body: 'Yapay Zekâ Asistanı ekranında sitenizin anahtarını açın. Kod, entegrasyon ya da eğitim gerekmez.'
      },
      {
        title: 'Ekibiniz rahatlasın',
        body: 'Sık sorular asistanda biter; satışa ve gerçek sorunlara dönen konuşmalar ekibinize düşer.'
      }
    ],

    benefitsEyebrow: 'Neler kazandırır',
    benefitsTitle: 'Ekibiniz aynı soruyu bir daha yazmaz',
    benefits: [
      {
        title: 'Anında yanıt',
        body: 'Ziyaretçi beklemez; sorusunun cevabı saniyeler içinde gelir.'
      },
      {
        title: 'Mesai dışında da açık',
        body: 'Gece ya da hafta sonu gelen sık sorular sabahı beklemez.'
      },
      {
        title: 'Sizin içeriğinizle konuşur',
        body: 'Yalnızca SSS’nizde yazanı söyler; fiyat, tarih ya da vaat uydurmaz.'
      },
      {
        title: 'Akıllı devir',
        body: 'Cevap yoksa, ziyaretçi “temsilci” derse ya da bir aksilik olursa konuşma ekibinize geçer.'
      },
      {
        title: 'Ekip her zaman önde',
        body: 'Temsilci yazdığı ya da “Devral” dediği an asistan o konuşmada susar.'
      },
      {
        title: 'Ne yaptığını görürsünüz',
        body: 'Kaç soruyu yanıtladığını, hangilerini neden devrettiğini panelde izlersiniz.'
      }
    ],

    controlEyebrow: 'Kontrol sizde',
    controlTitle: 'Yanıtlar her zaman sizin bilginize dayanır',
    controlDesc:
      'Asistan her yanıtın altında hangi SSS kaydına dayandığını not eder. Ekibiniz bunu gelen kutusunda görür; eksik ya da eski bir kayıt varsa düzeltmek bir dakikanızı alır.',
    controlPoints: [
      'Dayanak gösteremediği yanıt ziyaretçiye gönderilmez',
      'Ziyaretçi her an “Temsilciye bağlan” düğmesine basabilir',
      'Asistanı site başına açar, istediğiniz an kapatırsınız'
    ],

    trustEyebrow: 'Güven',
    trustTitle: 'Müşteri verisi önce gelir',
    trust: [
      'Ziyaretçinin adı, e-postası ve geçmiş mesajları yapay zekâya gönderilmez.',
      'Sorudaki e-posta ve telefon numaraları gönderilmeden önce gizlenir.',
      'Kart, IBAN ya da kimlik numarası paylaşılırsa soru hiç gönderilmez, konuşma ekibe geçer.',
      'Asistan ziyaretçiden kişisel bilgi istemez.'
    ],

    plansEyebrow: 'Planlar',
    plansTitle: 'Her planda dâhil, ihtiyacınız büyüdükçe genişler',
    plansDesc:
      'Planlar arasındaki fark yanıt sayısı ve derinlik. Hak dolduğunda sohbet durmaz; yeni sorular doğrudan ekibinize gider.',
    perMonth: 'Ayda {{n}} yanıt',
    perConversation: 'Konuşma başına {{count}} yanıt',
    depth: {
      FREE: 'Kısa ve öz yanıtlar',
      PRO: 'Daha ayrıntılı yanıtlar',
      ENTERPRISE: 'En ayrıntılı yanıtlar, en geniş SSS kapsamı'
    },
    seePricing: 'Tüm plan ayrıntıları',

    faqTitle: 'Asistan hakkında sorular',
    faq: [
      {
        q: 'Asistan yanlış bir şey söylerse?',
        a: 'Asistan yalnızca SSS kayıtlarınızdan yanıt verir ve her yanıtta hangi kayda dayandığını belirtir. Dayanak gösteremediği yanıt ziyaretçiye gönderilmez; konuşma ekibinize geçer.'
      },
      {
        q: 'Kurmak için ne gerekiyor?',
        a: 'Teknik bir iş yok. SSS içeriğinizi panele ekleyin, Yapay Zekâ Asistanı ekranından sitenizde açın.'
      },
      {
        q: 'Ziyaretçi bir insanla konuşmak isterse?',
        a: 'Balondaki “Temsilciye bağlan” düğmesine basar ya da bunu yazar; konuşma hemen ekibinize geçer.'
      },
      {
        q: 'Aylık yanıt hakkım dolarsa ne olur?',
        a: 'Sohbet durmaz; yeni sorular doğrudan ekibinize gider. Hak her ayın başında yenilenir, daha fazlası için planınızı yükseltebilirsiniz.'
      },
      { q: 'Hangi dilde yanıt verir?', a: 'Türkçe, kısa ve anlaşılır yanıtlar verir.' }
    ],

    ctaTitle: 'Asistanınız bugün işe başlasın',
    ctaDesc: 'Ücretsiz hesap açın, SSS’nizi ekleyin, asistanı açın. Kredi kartı istemiyoruz.',
    ctaBtn: 'Ücretsiz başlayın'
  },

  legal: {
    updated: 'Son güncelleme: 7 Ekim 2026',
    contact: 'Sorularınız için: destek@support.io',
    privacy: {
      meta: 'Support.io’nun hangi verileri neden işlediği, ne kadar sakladığı ve haklarınız.',
      title: 'Gizlilik Politikası',
      intro:
        'Support.io, işletmelerin sitelerine canlı destek ve yapay zekâ asistanı eklemesini sağlayan bir hizmettir. Bu metin hem Support.io hesabı açan işletmeler hem de bu işletmelerin sitelerinde sohbet balonunu kullanan ziyaretçiler için geçerlidir.',
      sections: [
        {
          h: 'Roller',
          p: [
            'Hesap bilgileriniz için veri sorumlusu Support.io’dur.',
            'Bir sitenin ziyaretçilerinin sohbet verilerinde veri sorumlusu, sohbet balonunu sitesine ekleyen işletmedir; Support.io bu verileri onun adına ve talimatıyla işler.'
          ]
        },
        {
          h: 'İşlediğimiz veriler',
          p: [
            'Hesap: ad, e-posta, rol, şifrenin geri döndürülemez özeti, oturum ve işlem kayıtları.',
            'Ziyaretçi: sohbet mesajları ve gönderilen dosyalar; ziyaretçinin kendisi yazarsa adı ve e-postası; bulunduğu sayfa, tarayıcı ve işletim sistemi, IP adresi ve ülke.',
            'Ödeme: kart bilgileri bize ulaşmaz. Ödemeleri satıcı olarak Paddle alır ve faturalar.'
          ]
        },
        {
          h: 'Ne için kullanıyoruz',
          p: [
            'Hizmeti sunmak: mesajları iletmek, saklamak ve ekibinize göstermek.',
            'Güvenlik: kötüye kullanımı ve yetkisiz erişimi önlemek, hız sınırları uygulamak.',
            'Hesap e-postaları: adres doğrulama, şifre sıfırlama, ekip daveti ve kullanım uyarıları. Pazarlama e-postası göndermeyiz.',
            'Faturalandırma ve yasal yükümlülükler.'
          ]
        },
        {
          h: 'Yapay zekâ asistanı',
          p: [
            'İşletme asistanı açarsa, ziyaretçinin sorusu ve sitenin herkese açık SSS kayıtları yanıt üretmek için yapay zekâ hizmet sağlayıcımıza gönderilir. Sorudaki e-posta adresleri ve telefon numaraları gönderilmeden önce gizlenir.',
            'Ziyaretçinin adı, e-postası ve önceki mesajları gönderilmez. Kart, IBAN ya da kimlik numarası içeren bir soru hiç gönderilmez; konuşma doğrudan ekibe geçer.'
          ]
        },
        {
          h: 'Saklama süreleri',
          p: [
            'Sohbetler son mesajlarından sonra işletmenin seçtiği süre boyunca saklanır: Ücretsiz planda 90 gün, ücretli planlarda 30 gün ile 5 yıl arası. Süre dolan sohbetler ekleriyle birlikte her gece silinir; işletme bir sohbeti daha önce de silebilir.',
            'Ziyaretçilerin IP adresi ve cihaz bilgisi son ziyaretten 90 gün sonra; işlem kayıtlarındaki IP adresleri 90 gün sonra silinir.',
            'Hesap silindiğinde tüm verileri silinir; şifreli yedeklerden en geç üç ay içinde düşer.'
          ]
        },
        {
          h: 'Kimlerle paylaşıyoruz',
          p: [
            'Verileri satmayız. Yalnızca hizmeti sunmak için gereken altyapı sağlayıcılarıyla, gerektiği kadar paylaşırız: barındırma, dosya depolama, e-posta gönderimi, ödeme ve yapay zekâ hizmeti.'
          ]
        },
        {
          h: 'Çerezler ve tarayıcı deposu',
          p: [
            'Panelde oturumunuz için zorunlu bir çerez (sc_session) ve bir güvenlik çerezi (sc_csrf) kullanılır.',
            'Sohbet balonu, sayfa değişse de konuşmanın sürmesi için tarayıcının yerel deposunda imzalı bir ziyaretçi oturumu (sc_widget_session) ve ziyaretçi yazdıysa adını ve e-postasını (sc_visitor_name, sc_visitor_email) tutar. Reklam ya da izleme çerezi kullanılmaz.'
          ]
        },
        {
          h: 'Haklarınız',
          p: [
            'KVKK ve GDPR kapsamında verilerinize erişme, düzeltilmesini, silinmesini ve aktarılmasını isteme, işlenmesine itiraz etme haklarınız vardır.',
            'Hesap sahipleri tüm veriyi panelde Ayarlar → Veri ve gizlilik bölümünden indirebilir ve hesabı silebilir. Ziyaretçiler taleplerini ilgili işletmeye ya da bize iletebilir; işletme bir ziyaretçinin o sitedeki tüm verisini panelden tek adımda silebilir.'
          ]
        }
      ]
    },
    terms: {
      meta: 'Support.io hizmetinin kullanım şartları.',
      title: 'Kullanım Şartları',
      intro: 'Support.io’yu kullanarak bu şartları kabul etmiş olursunuz. Kısa tutmaya çalıştık.',
      sections: [
        {
          h: 'Hizmet',
          p: [
            'Support.io, sitenize sohbet balonu, yapay zekâ asistanı ve ekibiniz için bir yönetim paneli sağlar. Özellikler planınıza göre değişir.'
          ]
        },
        {
          h: 'Hesap',
          p: [
            'Hesap açarken doğru bilgi verirsiniz ve şifrenizin güvenliğinden siz sorumlusunuz.',
            'Ekibinize davet ettiğiniz kişilerin hesabınızdaki işlemlerinden de siz sorumlusunuz.'
          ]
        },
        {
          h: 'Planlar ve ödeme',
          p: [
            'Ücretsiz plan süresizdir. Ücretli planlar aylık ya da yıllık olarak peşin faturalandırılır; ödemeleri satıcı olarak Paddle alır.',
            'Aboneliği istediğiniz zaman iptal edebilirsiniz; ödenmiş dönem bitene kadar planınız sürer. Ödeme alınamazsa planınız 7 gün sonra Ücretsiz plana döner.',
            'Planlardaki site, kullanıcı, konuşma ve yapay zekâ yanıtı sınırları sunucuda uygulanır.'
          ]
        },
        {
          h: 'Kabul edilebilir kullanım',
          p: [
            'Hizmeti yasa dışı içerik, istenmeyen toplu mesaj, kötü amaçlı yazılım ya da başkalarının verisini izinsiz toplamak için kullanamazsınız.',
            'Bu kurallara aykırı kullanımda hesabı askıya alabiliriz.'
          ]
        },
        {
          h: 'Ziyaretçi verileri',
          p: [
            'Sitenizin ziyaretçilerinin verilerinde veri sorumlusu sizsiniz. Sitenizin gizlilik metninde canlı destek için Support.io kullandığınızı belirtin.'
          ]
        },
        {
          h: 'Yapay zekâ asistanı',
          p: [
            'Asistan yanıtlarını sizin SSS içeriğinize dayandırır; bu içeriğin doğruluğundan siz sorumlusunuz.',
            'Yapay zekâ hata yapabilir. Asistan emin olmadığında konuşmayı ekibinize devreder ve ekibiniz her an devralabilir.'
          ]
        },
        {
          h: 'Hizmetin sürekliliği',
          p: [
            'Hizmeti kesintisiz sunmak için makul özeni gösteririz ve verileri düzenli olarak yedekleriz; ancak hiçbir kesinti olmayacağını garanti etmeyiz.'
          ]
        },
        {
          h: 'Sorumluluğun sınırı',
          p: [
            'Yasaların izin verdiği ölçüde, dolaylı zararlardan sorumlu değiliz; doğrudan zararlardaki sorumluluğumuz son 12 ayda bize ödediğiniz tutarla sınırlıdır.'
          ]
        },
        {
          id: 'guvenlik',
          h: 'Güvenlik açığı bildirimi',
          p: [
            'Hizmetimizde bir güvenlik açığı bulduğunuzu düşünüyorsanız security@support.io adresine yazın. Açığı nasıl tekrarlayabileceğimizi ve hangi adresi etkilediğini ekleyin. Aynı bilgiler /.well-known/security.txt dosyasında da yer alır.',
            'Bildiriminizi 3 iş günü içinde aldığımızı yanıtlarız ve açığı en geç 90 gün içinde kapatmayı hedefleriz. Düzeltme yayına girene kadar ayrıntıları herkese açık paylaşmamanızı rica ederiz.',
            'Lütfen yalnızca kendi hesabınızda deneme yapın; başkalarının verisine erişmeyin, hizmeti yavaşlatacak yük testleri ve sosyal mühendislik denemeleri yapmayın. Şu an bir ödül programımız yok.'
          ]
        },
        {
          h: 'Değişiklikler ve hukuk',
          p: [
            'Şartları değiştirirsek önemli değişiklikleri e-postayla bildiririz.',
            'Bu şartlara Türkiye Cumhuriyeti kanunları uygulanır.'
          ]
        }
      ]
    }
  }
};
