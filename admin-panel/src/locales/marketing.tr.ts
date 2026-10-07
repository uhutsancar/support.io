/**
 * Pazarlama sayfalarının metinleri (Türkçe).
 *
 * Ayrı dosyada durmasının sebebi: `tr.js` 1800 satırlık panel çevirisidir ve
 * pazarlama metni sürekli değişir. İkisi aynı dosyada olunca bir başlık
 * değişikliği için panelin tamamını taşıyan bir dosya açmak gerekiyordu.
 * `i18n.js` bu ağacı temel çevirinin ÜZERİNE derin birleştirir.
 *
 * Dil kuralı — bu dosyada geçerli olan tek kural:
 *
 *   Alıcı bir destek ekibi yöneticisidir, geliştirici değildir. Burada
 *   "WebSocket", "Shadow DOM", "round-robin", "MIME denetimi" gibi kelimeler
 *   GEÇMEZ. Karşılıkları geçer: "mesaj anında düşer", "sitenizin tasarımını
 *   bozmaz", "sırayla dağıtır", "dosya türü denetlenir". Teknik karşılıklar
 *   silinmedi; özellik detay sayfasındaki kapalı "teknik not" bloğunda ve
 *   dokümantasyonda duruyor.
 *
 * İkinci kural: burada uydurma sayı yok. Müşteri sayısı, memnuniyet oranı,
 * "çalışma süresi %99,9" gibi doğrulanamayan hiçbir iddia bulunmaz.
 */

export default {
  common: {
    skipToContent: 'İçeriğe geç'
  },

  nav: {
    allFeatures: 'Tüm özellikleri gör',
    product: 'Ürün',
    solutions: 'Çözümler',
    ai: 'Yapay zekâ',
    new: 'Yeni',
    resourcesLabel: 'Kaynaklar',
    resources: {
      docs: { title: 'Kurulum rehberi', body: 'Tek satırdan kimlik doğrulamaya kadar her adım.' },
      about: { title: 'Hakkımızda', body: 'Neden var olduğumuz ve neye göre karar verdiğimiz.' },
      contact: { title: 'Bize yazın', body: 'Bu sitedeki sohbet balonu da aynı ürün.' }
    },
    groups: {
      talk: 'Müşteriyle konuşun',
      organize: 'İşi düzenleyin',
      grow: 'Ölçün ve büyütün'
    }
  },

  /* ------------------------------------------------------ ana sayfa (yeni) */

  homePage: {
    hero: {
      title: 'Her mesaja cevap,',
      accent: 'hiçbir müşteri beklemesin.',
      desc: 'Sitenize tek satırla canlı destek ekleyin. Yapay zekâ asistanı sık soruları saniyeler içinde yanıtlar; gerisini ekibiniz tek gelen kutusundan karşılar.',
      tour: 'Ürünü gezin',
      photoAlt: 'Kulaklıkla bilgisayar başında müşteriye yanıt veren destek temsilcisi',
      notifTitle: 'Yeni konuşma · /fiyatlandirma',
      notifBody: 'Ziyaretçi 40 saniyedir fiyat sayfasında',
      handoff: 'Selin yanıtlıyor'
    },
    tour: {
      eyebrow: 'Ürün turu',
      title: 'Ekibinizin gün boyu açık tuttuğu ekranlar',
      desc: 'Başlıklara tıklayın. Her biri panelde gerçekten var olan, bugün hesabınızı açınca göreceğiniz bir ekran.'
    },
    industries: {
      eyebrow: 'Kimler için',
      title: 'Müşterisiyle konuşan her işletme için',
      desc: 'Mağaza, yazılım, klinik, otel ya da okul — aynı ürün, işinizin diliyle.',
      explore: 'İncele',
      prev: 'Önceki sektör',
      next: 'Sonraki sektör'
    },
    story: {
      eyebrow: 'Bir konuşmanın yolculuğu',
      title: 'Mesaj geldiği andan kapandığı ana kadar',
      desc: 'Aşağı kaydırın; ziyaretçinin yazdığı tek bir cümlenin ekibinizde nasıl ilerlediğini adım adım görün.',
      steps: [
        {
          title: 'Her mesaj tek bir gelen kutusunda',
          body: 'Sohbet balonundan, proaktif mesajdan ya da yardım içeriğinden gelen her soru aynı listeye düşer. Kimin, hangi sayfada, ne sorduğu yanında durur.',
          chips: ['Sohbet', 'Dosya', 'Proaktif', 'Geçmiş']
        },
        {
          title: 'Yapay zekâ ilk cevabı verir',
          body: 'Asistan sorunun cevabını sizin SSS içeriğinizde bulur ve saniyeler içinde yanıtlar. Cevap yoksa ya da ziyaretçi bir kişi isterse konuşma beklemeden ekibinize geçer.',
          chips: ['Yapay zekâ', 'SSS', 'Devir']
        },
        {
          title: 'Kalan iş doğru kişiye gider',
          body: 'Fatura sorusu muhasebeye, plan sorusu satışa. Departmanları bir kez tanımlarsınız; konuşma o an müsait olan temsilciye dağıtılır.',
          chips: ['Departman', 'Sıra', 'Mesai']
        },
        {
          title: 'Tekrarlayan işler kurala bağlanır',
          body: '“Mesajda fatura geçiyorsa etiketle ve muhasebeye gönder” gibi kuralları listeden seçerek kurarsınız. Kod yok, her çalışma kayıtlı.',
          chips: ['Etiket', 'Öncelik', 'Hazır cevap']
        },
        {
          title: 'Ay sonunda ne olduğunu görürsünüz',
          body: 'Kaç soru geldi, ilk cevap kaç dakika sürdü, hangisi çözüldü, hangi temsilci ne yaptı. Tahmin yerine rakam.',
          chips: ['İlk yanıt', 'Çözüm', 'Temsilci']
        }
      ]
    },
    ai: {
      eyebrow: 'Yapay zekâ asistanı',
      title: 'Sık soruları yapay zekâ yanıtlasın, ekibiniz asıl işe odaklansın',
      desc: 'Asistan sitenizdeki sohbet balonunda ilk cevabı verir: fiyatlar, kurulum, teslimat, çalışma saatleri… Cevabı yalnızca sizin SSS içeriğinizden alır; bilmediği soruyu uydurmaz, ekibinize devreder.',
      points: [
        {
          title: '7/24 yanıt',
          body: 'Gece ya da hafta sonu gelen soru sabahı beklemez; asistan saniyeler içinde yanıtlar.'
        },
        {
          title: 'Sizin bilginizle konuşur',
          body: 'Yalnızca SSS’nize dayanır. Her yanıtın hangi kayda dayandığını ekibiniz görür.'
        },
        {
          title: 'Bilmediğini devreder',
          body: 'Cevap yoksa ya da ziyaretçi bir kişi isterse konuşma hemen ekibinize geçer.'
        },
        {
          title: 'Müşteri verisi korunur',
          body: 'Kart, IBAN ya da kimlik numarası paylaşılırsa soru yapay zekâya hiç gönderilmez.'
        }
      ],
      plans: 'Her planda dâhil · ayda {{n}} yanıttan başlar',
      cta: 'Asistanı keşfedin',
      cta2: 'Ücretsiz deneyin'
    },
    setup: {
      eyebrow: 'Kurulum',
      title: 'Tek satır. Birkaç dakikada yayında.',
      desc: 'Satırı yapıştırdığınız an balon sitenizde. Gerisi panelden: rengini seçin, yapay zekâ asistanını açın, ekibinizi davet edin. Yazılımcıya gerek yok.',
      keyPlaceholder: 'SITE_ANAHTARINIZ',
      comment: 'Support.io sohbet balonu',
      noDevs: {
        eyebrow: 'Yazılımcı gerekmez',
        title: 'Kopyala, yapıştır, bitti.',
        body: 'WordPress, Shopify, Wix ya da kendi yazdığınız site — hepsinde aynı satır. React, Vue ya da Angular kullanıyorsanız rehberde hazır kod var.'
      },
      devices: {
        eyebrow: 'Her yerden',
        title: 'Telefondan da yanıtlayın.',
        body: 'Panel tarayıcıda çalışır; masada da yolda da aynı gelen kutusu. Ayrı uygulama indirmeniz gerekmez.',
        desktop: 'Masaüstü',
        tablet: 'Tablet',
        phone: 'Telefon'
      },
      board: {
        title: 'Gösterge paneli',
        sample: 'Örnek',
        replies: 'Bugün verilen yanıt',
        online: '3 temsilci çevrimiçi'
      },
      stats: [
        { label: 'Ortalama ilk yanıt', value: '1 dk 40 sn' },
        { label: 'Çözülen', value: '%92' },
        { label: 'Yapay zekânın yanıtladığı', value: '%41' }
      ]
    },
    features: {
      eyebrow: 'Hepsi bir arada',
      title: 'Hesabınızı açtığınız gün hazır olanlar',
      desc: 'Yol haritası değil; panelde bugün açık olan ekranlar.'
    },
    trustPhotoAlt: 'Masa etrafında toplantı yapan küçük bir ekip',
    faq: {
      eyebrow: 'SSS',
      title: 'Sık sorulan sorular',
      categories: 'Kategoriler',
      still: 'Başka bir sorunuz mu var?',
      chat: 'Ekibimizle konuşun',
      contact: 'Bize ulaşın',
      cat: {
        all: 'Tümü',
        pricing: 'Fiyat',
        setup: 'Kurulum',
        ai: 'Yapay zekâ',
        usage: 'Kullanım',
        security: 'Güvenlik'
      },
      items: [
        {
          cat: 'pricing',
          q: 'Ücretsiz plan gerçekten ücretsiz mi?',
          a: 'Evet. Süresi yok ve kredi kartı istemiyoruz. Bir site, bir kullanıcı ve ayda 100 yeni konuşma içerir.'
        },
        {
          cat: 'pricing',
          q: 'Ekibim büyürse ne olur?',
          a: 'Pro plana geçersiniz: 3 site, 5 kullanıcı ve ayda 2.000 yeni konuşma, sabit aylık ücretle. Kişi başı ücret yoktur.'
        },
        {
          cat: 'pricing',
          q: 'Aylık konuşma sınırı dolarsa ne olur?',
          a: 'Açık konuşmalar sürer, yanıt vermeye devam edersiniz. Sınırın %80’ine geldiğinizde e-postayla haber veririz; yeni konuşmalar bir sonraki ayın başında yeniden açılır.'
        },
        {
          cat: 'setup',
          q: 'Kurulum için yazılımcıya ihtiyacım var mı?',
          a: 'Çoğu durumda hayır. WordPress, Shopify ve benzeri altyapılarda tek satırı ayarlar ekranına yapıştırmanız yeterli. Takılırsanız bize yazın, birlikte yapalım.'
        },
        {
          cat: 'setup',
          q: 'Hangi sitelerde çalışır?',
          a: 'Bir satır HTML ekleyebildiğiniz her sitede: WordPress, Shopify, Wix, Webflow, Ticimax, İdeasoft ya da React, Vue, Angular ve Next.js ile yazılmış uygulamalar. Rehberde her biri için kopyalanabilir kod var.'
        },
        {
          cat: 'setup',
          q: 'Sitemi yavaşlatır mı?',
          a: 'Hayır. Balon sayfanızın geri kalanı yüklendikten sonra devreye girer ve sitenizin tasarımından yalıtılmıştır.'
        },
        {
          cat: 'ai',
          q: 'Yapay zekâ asistanı yanlış bir şey söylerse?',
          a: 'Asistan yalnızca SSS kayıtlarınızdan yanıt verir ve her yanıtta hangi kayda dayandığını belirtir. Dayanak gösteremediği yanıt ziyaretçiye gönderilmez; konuşma ekibinize geçer.'
        },
        {
          cat: 'ai',
          q: 'Asistan için ayrıca ödeme yapıyor muyuz?',
          a: 'Hayır, her planda dâhil. Planlar arasındaki fark aylık yanıt sayısı ve yanıtların derinliği: Ücretsiz’de ayda 50, Pro’da 1.000, Kurumsal’da 5.000 yanıt.'
        },
        {
          cat: 'ai',
          q: 'Müşteri bilgileri yapay zekâya gönderiliyor mu?',
          a: 'Hayır. Ziyaretçinin adı, e-postası ve önceki mesajları gönderilmez; sorudaki e-posta ve telefon numaraları gizlenir. Kart, IBAN ya da kimlik numarası görülürse soru hiç gönderilmeden ekibinize aktarılır.'
        },
        {
          cat: 'usage',
          q: 'Mesai dışında gelen mesajlara ne oluyor?',
          a: 'Kaybolmuyor. Yapay zekâ asistanı açıksa sık soruları o an yanıtlar; gerisi için ziyaretçiye ne zaman döneceğinizi söyleriz ve mesaj gelen kutunuzda sizi bekler.'
        },
        {
          cat: 'usage',
          q: 'Telefondan da cevap verebilir miyim?',
          a: 'Evet. Panel telefon tarayıcısında da çalışır; ayrı bir uygulama indirmeniz gerekmez.'
        },
        {
          cat: 'security',
          q: 'Konuşmalarımızı başkası görebilir mi?',
          a: 'Hayır. Her hesabın verisi kendi sınırında tutulur; ekibinizde de her rol yalnızca yetkisi olan ekranı görür.'
        },
        {
          cat: 'security',
          q: 'Verilerimi dışarı alabilir miyim?',
          a: 'Pro ve Kurumsal planlarda konuşmalarınızı dışa aktarabilirsiniz. Veriler size aittir.'
        }
      ]
    }
  },

  /* --------------------------------------------- oynayan sohbet senaryoları */

  // Bu sitedeki balon Support.io'nun kendi balonu; senaryolar da bu yüzden
  // bize yazan birinin sorularıdır, uydurma bir mağazanın kargo derdi değil.
  demoChat: {
    status: 'Çevrimiçi · genelde birkaç dakikada yanıtlar',
    articleName: 'Yardım makalesi',
    assistantName: 'Yapay zekâ asistanı',
    hero: {
      brand: 'Support.io',
      lines: [
        { from: 'visitor', text: 'Merhaba, sitem WordPress. Kurulum zor mu?' },
        {
          from: 'assistant',
          text: 'Hiç değil! Panelden aldığınız tek satırı sitenizin altbilgisine yapıştırmanız yeterli.',
          source: 'Kaynak: Kurulum'
        },
        { from: 'visitor', text: 'Fiyatlar için biriyle konuşabilir miyim?' },
        { from: 'note', text: 'Selin konuşmaya katıldı' },
        {
          from: 'agent',
          name: 'Selin',
          text: 'Merhaba! Ekibiniz kaç kişi? Size en uygun planı önereyim.'
        }
      ]
    },
    ai: {
      brand: 'Support.io',
      lines: [
        { from: 'note', text: 'Pazar · 23:40' },
        { from: 'visitor', text: 'Yıllık ödersem indirim var mı?' },
        {
          from: 'assistant',
          text: 'Evet, yıllık ödemede %20 indirim var. Ödeme sıklığını plan seçerken belirlersiniz.',
          source: 'Kaynak: Planlar ve fiyatlar'
        },
        { from: 'visitor', text: 'Peki ekibime sonradan kişi ekleyebilir miyim?' },
        {
          from: 'assistant',
          text: 'Elbette. Ekip ekranından davet gönderirsiniz; planınızdaki kullanıcı sayısına kadar ekleyebilirsiniz.',
          source: 'Kaynak: Ekip yönetimi'
        },
        { from: 'visitor', text: 'Gece yarısı bu kadar hızlı cevap, harika 👏' }
      ]
    },
    story: {
      brand: 'Support.io',
      lines: [
        { from: 'visitor', text: 'Ekibime nasıl temsilci eklerim?' },
        {
          from: 'assistant',
          text: 'Ekip → Davet et ekranından e-posta adresini yazın; davet edilen kişi e-postadaki bağlantıyla katılır.',
          source: 'Kaynak: Ekip yönetimi'
        },
        {
          from: 'visitor',
          text: 'Pro’da kaç kişi olabiliyor? Satıştan biriyle konuşabilir miyim?'
        },
        { from: 'note', text: 'Satış departmanına yönlendirildi' },
        {
          from: 'agent',
          name: 'Kerem',
          text: 'Merhaba, ben Kerem. Pro’da 5 kullanıcıya kadar çıkabilirsiniz; daha fazlası için Kurumsal’ı konuşalım.'
        }
      ]
    }
  },

  theme: {
    switchToLight: 'Açık tema',
    switchToDark: 'Koyu tema'
  },

  /* ------------------------------------------------------------ ana sayfa */

  landing: {
    home: {
      metaTitle: 'Support.io — Sitenize canlı destek ekleyin',
      metaDesc:
        'Müşterileriniz sitenizden yazar, ekibiniz tek ekrandan yanıtlar. Kurulum bir satır kod. Ücretsiz planla başlayın.',

      btnStart: 'Ücretsiz başlayın',
      btnDocs: 'Kurulum rehberi',

      trust: {
        free: 'Ücretsiz plan süresizdir',
        card: 'Kredi kartı istemiyoruz',
        setup: 'Kurulum birkaç dakika'
      },

      tour: {
        detail: 'Bu özelliği ayrıntılı gör'
      },

      setup: {
        cta: 'Hesap açıp kodu alın',
        platforms: [
          'WordPress',
          'Shopify',
          'WooCommerce',
          'Wix',
          'Webflow',
          'Ticimax',
          'İdeasoft',
          'Google Tag Manager',
          'React',
          'Next.js',
          'Vue',
          'Angular',
          'Laravel',
          'Django'
        ]
      },

      /* --------------------------------------------------------- güvenlik */
      security: {
        eyebrow: 'Güven',
        title: 'Müşteri verisi sizin, bizde kiracı gibi durmaz',
        desc: 'Bir destek aracı, müşterilerinizin size yazdığı her şeyi görür. Bu yüzden nasıl sakladığımızı açıkça yazıyoruz.',
        items: [
          {
            title: 'Verileriniz ayrı durur',
            body: 'Her hesabın verisi kendi sınırında tutulur. Başka bir firma sizin konuşmalarınızı göremez.'
          },
          {
            title: 'Kim ne görür, siz seçersiniz',
            body: 'Temsilci, yönetici ve izleyici rolleri ayrıdır. Yetkisi olmayan ekranı açamaz.'
          },
          {
            title: 'Balon yalnızca sizin sitenizde açılır',
            body: 'Balonun çalışacağı adresleri siz yazarsınız; anahtarınızı başka bir siteye koyan kişi sohbet başlatamaz.'
          },
          {
            title: 'Eski kayıtlar süresiz birikmez',
            body: 'İşlem kayıtları belirli bir süre sonra kendiliğinden temizlenir.'
          }
        ]
      },

      /* ------------------------------------------------------------ plan */
      plans: {
        eyebrow: 'Fiyat',
        title: 'Ücretsiz başlayın, büyüdükçe geçin',
        desc: 'Ücretsiz planın süresi yok. Tek kişilik başlarsınız, ekip büyüdüğünde plan değiştirirsiniz.',
        link: 'Planları karşılaştır'
      },

      ctaTitle: 'İlk konuşmanız birkaç dakika uzağınızda',
      ctaDesc:
        'Hesabınızı açın, sitenizi ekleyin, satırı yapıştırın. Gerisi kendiliğinden çalışır.',
      ctaBtn1: 'Ücretsiz hesap oluştur',
      ctaBtn2: 'Fiyatlandırmayı gör',
      ctaNote: 'Kredi kartı istemiyoruz · İstediğiniz zaman bırakabilirsiniz',

      footerDesc:
        'Sitenize eklenen canlı destek. Müşteriniz yazar, ekibiniz tek ekrandan yanıtlar.',
      footerMade: 'Türkiye’de geliştirildi',
      footerProduct: 'Ürün',
      footerFeatures: 'Özellikler',
      footerPricing: 'Fiyatlandırma',
      footerDocs: 'Kurulum rehberi',
      footerCompany: 'Şirket',
      footerAbout: 'Hakkımızda',
      footerSupport: 'Hesap',
      footerLogin: 'Giriş yap',
      footerRegister: 'Kayıt ol'
    }
  },

  /* ------------------------------------------------------------- özellikler */

  featuresPage: {
    meta: {
      title: 'Özellikler',
      description:
        'Canlı sohbet, sohbet balonu, departman yönlendirme, otomatik kurallar, proaktif mesaj, yardım içeriği, raporlar ve ekip yönetimi.'
    },
    eyebrow: 'Ürün',
    title: 'Destek ekibinizin gün boyu kullandığı her şey',
    description:
      'Aşağıdakilerin hepsi bugün çalışıyor. Yol haritası değil, bugün hesabınızı açtığınızda karşınıza çıkacak ekranlar.',

    groups: {
      talk: {
        title: 'Müşterinizle konuştuğunuz yer',
        desc: 'Ziyaretçi sitenizden yazar, yapay zekâ sık soruları yanıtlar, ekibiniz gerisini tek gelen kutusundan karşılar.',
        points: [
          'Yapay zekâ asistanı sık soruları 7/24 yanıtlar',
          'Mesaj yazıldığı an ekibinizin ekranında görünür',
          'Dosya, ekran görüntüsü ve bağlantı paylaşılabilir',
          'Ziyaretçi geri döndüğünde konuşma kaldığı yerden açılır',
          'Sık sorulan sorular balonun içinde aranabilir'
        ]
      },
      organize: {
        title: 'İşin kime düşeceğini belirlediğiniz yer',
        desc: 'Departmanlar, otomatik kurallar ve roller. Kim neye bakacak sorusunu bir kez cevaplayın, her gün tekrar uğraşmayın.',
        points: [
          'Konuşmalar doğru departmana kendiliğinden gider',
          'Tekrarlayan işler kurala bağlanır',
          'Her rolün göreceği ekran ayrı tanımlanır',
          'Temsilci çevrimdışı olunca açık işler devredilir'
        ]
      },
      grow: {
        title: 'Ne olduğunu gördüğünüz yer',
        desc: 'Raporlar, canlı ziyaretçiler ve fırsat takibi. Tahmin yerine rakam.',
        points: [
          'Yanıt ve çözüm süreleri, temsilci kırılımıyla',
          'O an sitede kimin hangi sayfada olduğu',
          'Konuşmadan doğan satış fırsatlarının takibi',
          'Geri dönen müşterinin geçmişi yanınızda'
        ]
      }
    },

    benefitsTitle: 'Ne kazandırır',
    howTitle: 'Nasıl kurulur',
    howDesc: 'Hepsi panelden, kod yazmadan. Kurulum sırasında takılırsanız sohbetten yazın.',
    nextFeature: 'Sıradaki',
    moreTitle: 'Bunlarla birlikte kullanılır',
    backToList: 'Tüm özellikler',
    readDocs: 'Kurulum rehberini oku',

    devEyebrow: 'Kurulum',
    devTitle: 'Kurmak dakikalar sürer',
    devDesc: 'Yazılımcınız olmasa da olur. Takılırsanız bize yazın, kurulumu birlikte yapalım.',
    dev: {
      embed: {
        title: 'Kopyala, yapıştır',
        body: 'Panelden aldığınız tek satırı sitenize eklersiniz; balon hemen görünür.'
      },
      sdk: {
        title: 'Her altyapıda',
        body: 'WordPress, Shopify, Wix, Webflow ya da React, Vue, Angular — rehberde hepsi için hazır adımlar var.'
      },
      isolation: {
        title: 'Sitenizi yavaşlatmaz',
        body: 'Balon sayfanız yüklendikten sonra devreye girer ve tasarımınıza karışmaz.'
      },
      control: {
        title: 'Markanızın renginde',
        body: 'Rengi, karşılama mesajını ve konumu panelden seçersiniz; önizlemede anında görürsünüz.'
      }
    },

    notFound: {
      title: 'Böyle bir özellik sayfası yok',
      body: 'Bağlantı eski olabilir. Listeden devam edebilirsiniz.'
    },

    items: {
      'live-chat': {
        title: 'Canlı sohbet',
        short: 'Müşteri yazar, ekibiniz anında görür.',
        plain:
          'Sitenizdeki ziyaretçi sohbet balonundan yazdığı anda mesaj ekibinizin ekranına düşer. Sayfa yenilemek gerekmez, kimse beklemez.',
        setup: 'Hazır gelir',
        benefits: [
          'Mesaj yazıldığı anda görünür, gecikme olmaz',
          'Karşı taraf yazarken üç nokta görünür',
          'Dosya ve ekran görüntüsü paylaşılabilir',
          'Bağlantı koparsa mesaj kaybolmaz, tekrar gönderilir'
        ],
        steps: [
          {
            title: 'Hesabınızı açın',
            body: 'Kayıt olduğunuzda canlı sohbet zaten açıktır, ayrıca kurmanız gerekmez.'
          },
          { title: 'Kurulum satırını yapıştırın', body: 'Balon sitenizde görünmeye başlar.' },
          {
            title: 'Panelden cevaplayın',
            body: 'Gelen kutusunu açık bırakın; yeni mesajda bildirim alırsınız.'
          }
        ]
      },

      'ai-assistant': {
        title: 'Yapay zekâ asistanı',
        short: 'Sık soruları 7/24, saniyeler içinde yanıtlar.',
        plain:
          'Ziyaretçiniz sorusunu yazdığı an asistan cevabı sizin SSS içeriğinizde arar ve kısa, net bir yanıt verir. Cevabı bilmediğinde uydurmaz; konuşmayı hemen ekibinize aktarır.',
        setup: 'Tek tıkla',
        benefits: [
          'Mesai dışında da soruları yanıtlar',
          'Yalnızca sizin SSS içeriğinize dayanır, uydurmaz',
          'Ziyaretçi istediği an temsilciye bağlanır',
          'Her yanıtın hangi SSS’ye dayandığını ekibiniz görür'
        ],
        steps: [
          {
            title: 'SSS’nizi yazın',
            body: 'En çok sorulan soruları ve cevaplarını panele ekleyin; asistan bunlardan yanıt verir.'
          },
          {
            title: 'Asistanı açın',
            body: 'Yapay Zekâ Asistanı ekranında sitenizin anahtarını açmanız yeterli.'
          },
          {
            title: 'Sonuçları izleyin',
            body: 'Kaç soruyu yanıtladığını, hangilerini neden ekibe devrettiğini görün; eksik SSS’leri tamamlayın.'
          }
        ]
      },

      'universal-widget': {
        title: 'Sohbet balonu',
        short: 'Tek satır kod, her sitede aynı şekilde çalışır.',
        plain:
          'Sitenizin köşesinde duran balonun rengini, yazısını ve konumunu siz seçersiniz. Hangi altyapıyı kullanırsanız kullanın aynı tek satırla kurulur.',
        setup: 'Tek satır',
        benefits: [
          'Rengi, yazısı ve konumu panelden ayarlanır',
          'Telefonda ve bilgisayarda aynı şekilde çalışır',
          'Sitenizin tasarımını bozmaz, yavaşlatmaz',
          'Aynı kod WordPress’te de React’te de çalışır'
        ],
        steps: [
          { title: 'Sitenizi ekleyin', body: 'Panelden site adresinizi tanımlayın.' },
          {
            title: 'Görünümü seçin',
            body: 'Renk, karşılama metni ve konumu ayarlayın; önizlemeden görün.'
          },
          { title: 'Satırı yapıştırın', body: 'Sitenizin şablonuna eklemeniz yeterli.' }
        ]
      },

      routing: {
        title: 'Departman yönlendirme',
        short: 'Her soru doğru kişiye düşer.',
        plain:
          'Fatura sorusu muhasebeye, satış sorusu satış ekibine. Departmanları bir kez tanımlarsınız; gelen konuşma o an müsait olan temsilciye kendiliğinden dağıtılır.',
        setup: 'Panelden',
        benefits: [
          'Sırayla ya da en az işi olana dağıtım',
          'Temsilci başına aynı anda bakılacak konuşma sınırı',
          'Departman bazında mesai saati ve mesai dışı mesajı',
          'Temsilci çevrimdışı olunca açık işler devredilir'
        ],
        steps: [
          { title: 'Departmanları tanımlayın', body: 'Satış, destek, muhasebe — işinize göre.' },
          { title: 'Ekibi yerleştirin', body: 'Her temsilciyi ilgili departmana ekleyin.' },
          {
            title: 'Dağıtımı seçin',
            body: 'Sırayla mı, en az işi olana mı? Tek seçimle belirlersiniz.'
          }
        ]
      },

      automation: {
        title: 'Otomatik kurallar',
        short: 'Tekrarlayan işleri bir kez tanımlayın.',
        plain:
          '“Mesajda fatura geçiyorsa muhasebeye yönlendir ve etiketle” gibi kuralları kendiniz kurarsınız. Koşul oluştuğunda kural kendiliğinden çalışır.',
        setup: 'Panelden',
        benefits: [
          'Koşulları ve eylemleri listeden seçersiniz, kod yok',
          'Etiketleme, yönlendirme, öncelik ve hazır cevap',
          'Her çalıştırma kayda geçer, ne olduğunu görürsünüz',
          'Kuralları istediğiniz an kapatıp açabilirsiniz'
        ],
        steps: [
          { title: 'Koşulu seçin', body: 'Mesaj içeriği, sayfa, departman ya da durum.' },
          {
            title: 'Eylemi seçin',
            body: 'Yönlendir, etiketle, önceliği yükselt veya hazır cevap gönder.'
          },
          { title: 'Açın ve izleyin', body: 'Kuralın kaç kez çalıştığını panelden takip edin.' }
        ]
      },

      proactive: {
        title: 'Proaktif mesaj',
        short: 'Siz sormadan siz yazın.',
        plain:
          'Fiyat sayfasında kararsız kalan ya da uzun süre aynı ekranda bekleyen ziyaretçiye kendiliğinden bir mesaj gönderin. Çoğu kişi sormaz, sadece çıkar.',
        setup: 'Panelden',
        benefits: [
          'Sayfada kalma süresi, kaydırma ve çıkış niyetine göre tetikleme',
          'Sadece belirli sayfalarda göstermeyi seçebilirsiniz',
          'Aynı kişiye tekrar tekrar gösterilmez',
          'Hangi mesajın kaç kez gönderildiği kayıtlıdır'
        ],
        steps: [
          { title: 'Sayfayı seçin', body: 'Örneğin fiyatlandırma ya da kayıt sayfası.' },
          {
            title: 'Tetikleyiciyi seçin',
            body: 'Kaç saniye sonra ya da hangi davranışta gösterilsin.'
          },
          {
            title: 'Mesajı yazın',
            body: 'Kısa ve yardım teklif eden bir cümle en iyi sonucu verir.'
          }
        ]
      },

      'knowledge-base': {
        title: 'Yardım içeriği',
        short: 'Müşteri cevabı kendisi bulsun.',
        plain:
          'Sık sorulan soruları bir kez yazarsınız, ziyaretçi sohbet balonunun içinde arayıp bulur. Cevabı kendi bulduğunda size hiç yazmaz.',
        setup: 'Panelden',
        benefits: [
          'Balonun içinde anında arama',
          'En çok sorulanlar ilk ekranda görünür',
          'Hangi cevabın kaç kez okunduğunu görürsünüz',
          'Belirli sayfalarda belirli içerikler gösterilebilir'
        ],
        steps: [
          {
            title: 'İlk on soruyu yazın',
            body: 'Ekibinize “en çok neyi soruyorlar” diye sorun, oradan başlayın.'
          },
          { title: 'Sıralayın', body: 'En çok sorulanı en üste alın.' },
          { title: 'Ölçün', body: 'Okunma sayılarına bakıp eksik kalan konuyu ekleyin.' }
        ]
      },

      analytics: {
        title: 'Raporlar',
        short: 'Ne kadar sürede dönüldü, kaçı çözüldü.',
        plain:
          'Kaç soru geldi, ortalama kaç dakikada cevaplandı, hangi temsilci kaç konuşma kapattı. Tahmin etmek yerine bakarsınız.',
        setup: 'Hazır gelir',
        benefits: [
          'İlk yanıt ve çözüm süreleri',
          'Temsilci bazında kırılım ve kişisel performans ekranı',
          'Hedefin altında kalan konuşmaların ayrı gösterimi',
          'İstediğiniz tarih aralığı için hesaplanır'
        ],
        steps: [
          {
            title: 'Bir hafta kullanın',
            body: 'Rakamların anlamlı olması için biraz veri gerekir.'
          },
          {
            title: 'Aralığı seçin',
            body: 'Son 7 gün, son 30 gün ya da kendi seçtiğiniz tarihler.'
          },
          {
            title: 'Hedef koyun',
            body: 'Yanıt süresi hedefini belirleyin; altında kalanlar işaretlenir.'
          }
        ]
      },

      team: {
        title: 'Ekip yönetimi',
        short: 'Kim neyi görür, kim müsait.',
        plain:
          'Ekip üyelerini davet edersiniz, her birinin rolünü seçersiniz. Kimin çevrimiçi, kimin meşgul olduğunu görürsünüz.',
        setup: 'Panelden',
        benefits: [
          'Sahip, yönetici, müdür, temsilci ve izleyici rolleri',
          'Çevrimiçi, uzakta, meşgul ve çevrimdışı durumları',
          'Ekip içi sohbetle konuşmadan çıkmadan danışma',
          'Yetkisi olmayan ekranı hiç göremez'
        ],
        steps: [
          { title: 'Davet gönderin', body: 'E-posta adresini yazın, davet ulaşsın.' },
          { title: 'Rolü seçin', body: 'Ne görebileceğini rol belirler.' },
          {
            title: 'Departmana ekleyin',
            body: 'Konuşmaların ona düşmesi için departmanına yerleştirin.'
          }
        ]
      },

      visitors: {
        title: 'Canlı ziyaretçiler',
        short: 'O an sitede kim var, hangi sayfada.',
        plain:
          'Sitenizi o anda kimlerin gezdiğini, hangi sayfada olduklarını ve nereden geldiklerini görürsünüz. Daha size yazmadan.',
        setup: 'Hazır gelir',
        benefits: [
          'Canlı liste, sayfa değiştikçe güncellenir',
          'Nereden geldiği ve hangi tarayıcıyı kullandığı',
          'Uzun süre bir sayfada kalanı fark edersiniz',
          'Konuşma açılmadan önce bağlamı bilirsiniz'
        ],
        steps: [
          { title: 'Kurulum satırını ekleyin', body: 'Ziyaretçi takibi balonla birlikte gelir.' },
          { title: 'Ziyaretçiler ekranını açın', body: 'Liste kendiliğinden akmaya başlar.' },
          { title: 'Gerekirse siz başlatın', body: 'Takılan ziyaretçiye proaktif mesaj gönderin.' }
        ]
      },

      crm: {
        title: 'Fırsat takibi',
        short: 'Satışa dönen konuşmaları kaybetmeyin.',
        plain:
          'Bir konuşma satış fırsatına dönüştüğünde kayıt açarsınız. Hangi aşamada, ne kadarlık, kimden sorumlu — hepsi konuşmanın yanında durur.',
        setup: 'Panelden',
        benefits: [
          'Fırsatlar aşamalara göre listelenir',
          'Her fırsat doğduğu konuşmaya bağlı kalır',
          'Sorumlu temsilci ve tutar takip edilir',
          'Müşteri geri döndüğünde geçmişi yanınızda'
        ],
        steps: [
          { title: 'Aşamaları belirleyin', body: 'Örneğin ilk görüşme, teklif, kapanış.' },
          { title: 'Konuşmadan fırsat açın', body: 'Satışa dönen sohbetin üzerinden tek tıkla.' },
          { title: 'Hattı izleyin', body: 'Hangi aşamada ne kadar iş beklediğini görün.' }
        ]
      }
    }
  },

  /* ---------------------------------------------------------- fiyatlandırma */

  pricingPage: {
    meta: {
      title: 'Fiyatlandırma',
      description:
        'Ücretsiz planla başlayın. Ücretli planlarda kişi başı değil, sabit aylık ücret; gizli kalem yok.'
    },
    eyebrow: 'Fiyatlandırma',
    title: 'Ücretsiz başlayın, ekibiniz büyüyünce geçin',
    description:
      'Ücretsiz planın süresi yoktur ve kredi kartı istemiyoruz. Yapay zekâ asistanı her planda dâhil; ücretli planlarda kullanıcı başına değil, plan başına sabit aylık ödersiniz.',

    billing: 'Ödeme sıklığı',
    monthly: 'Aylık',
    yearly: 'Yıllık',
    discount: '%{{percent}} indirim',
    popular: 'En çok tercih edilen',
    perMonth: '/ ay',
    billedMonthly: 'Aylık faturalandırılır',
    billedYearly: 'Yıllık faturalandırılır · yılda {{total}}',
    custom: 'Size özel',
    freeNote: 'Süresiz ücretsiz, faturalandırma yok',
    contactNote: 'İhtiyacınıza göre belirlenir',
    loadError: 'Plan bilgileri şu an yüklenemedi. Sayfayı yenileyip tekrar deneyin.',

    units: {
      sites_one: '{{count}} site',
      sites_other: '{{count}} site',
      agents_one: '{{count}} kullanıcı',
      agents_other: '{{count}} kullanıcı',
      conversations: 'Ayda {{n}} yeni konuşma',
      assistant: 'Ayda {{n}} yapay zekâ yanıtı',
      assistantDepth: 'Konuşma başına {{count}} yapay zekâ yanıtı',
      history: '{{period}} konuşma geçmişi',
      days_one: '{{count}} gün',
      days_other: '{{count}} gün',
      years_one: '{{count}} yıl',
      years_other: '{{count}} yıl'
    },

    chooseEyebrow: 'Karar verirken',
    chooseTitle: 'Hangi plan size uygun?',

    compareTitle: 'Planların karşılaştırması',
    compareDesc:
      'Tablo, sunucunun uyguladığı plan tablosundan gelir; burada yazan sınır, panelde uygulanan sınırdır.',
    feature: 'Özellik',

    faqTitle: 'Fiyat hakkında sık sorulanlar',
    faqDesc: 'Aklınıza takılan başka bir şey varsa sohbetten yazın.',
    faqItems: [
      {
        q: 'Ücretsiz plan ne kadar sürüyor?',
        a: 'Süresi yok. Bir site, bir kullanıcı ve ayda 100 yeni konuşmayla istediğiniz kadar kullanırsınız.'
      },
      {
        q: 'Kredi kartı gerekiyor mu?',
        a: 'Ücretsiz plan için hayır. Sadece e-posta ve şifreyle hesap açarsınız.'
      },
      {
        q: '“Konuşma” ne demek?',
        a: 'Bir ziyaretçinin başlattığı her yeni sohbet bir konuşmadır; içindeki mesaj sayısı önemli değildir. Sınır her ayın başında yenilenir, dolduğunda açık konuşmalar sürer.'
      },
      {
        q: '“Yapay zekâ yanıtı” ne demek?',
        a: 'Asistanın ziyaretçiye gönderdiği her yanıt bir yanıttır; ekibe devir sayılmaz. Hak her ayın başında yenilenir, dolduğunda sorular doğrudan ekibinize gider.'
      },
      {
        q: '“Kullanıcı” ne demek?',
        a: 'Panele giriş yapabilen her ekip üyesi, siz de dâhil, bir kullanıcıdır; bekleyen davetler de sayılır. Müşterilerinizin sayısı ücreti etkilemez.'
      },
      {
        q: 'Planımı sonradan değiştirebilir miyim?',
        a: 'Evet, istediğiniz zaman yükseltip düşürebilirsiniz. Değişiklik kalan sürenize göre oranlanır.'
      },
      {
        q: 'Taahhüt var mı?',
        a: 'Aylık planda yok, istediğiniz ay bırakabilirsiniz. Yıllık planda bir yıllık ücret indirimli olarak peşin alınır.'
      },
      {
        q: 'Kurumsal planda ne farklı?',
        a: 'Daha fazla site, kullanıcı ve konuşma; ayda 5.000 yapay zekâ yanıtı, konuşma başına daha uzun ve ayrıntılı yanıtlar; denetim kayıtları ve kurulumda birebir destek.'
      }
    ],

    plans: {
      free: {
        name: 'Ücretsiz',
        tagline: 'Tek başınıza başlıyorsanız, başlamak için yeterli.',
        cta: 'Ücretsiz başlayın',
        includes: 'İçinde ne var',
        forWho: 'Yeni başlayanlar',
        forWhoBody: 'Tek bir siteniz varsa ve konuşmalara kendiniz bakıyorsanız buradan başlayın.',
        extras: ['Sohbet balonu ve görünüm ayarları', 'Yardım içeriği (SSS)', 'Raporlar']
      },
      pro: {
        name: 'Pro',
        tagline: 'Birden fazla kişi cevap veriyorsa asıl plan bu.',
        cta: 'Pro ile başlayın',
        includes: 'Ücretsiz plandaki her şey, ayrıca',
        forWho: 'Ekip olarak çalışanlar',
        forWhoBody:
          'Birden fazla temsilciniz varsa departman dağıtımına, kurallara ve canlı ziyaretçilere ihtiyacınız olacak.',
        extras: []
      },
      enterprise: {
        name: 'Kurumsal',
        tagline: 'Büyüyen ekipler ve en güçlü yapay zekâ deneyimi için.',
        cta: 'Kurumsal ile başlayın',
        includes: 'Pro’daki her şey, ayrıca',
        forWho: 'Büyük ekipler',
        forWhoBody:
          'Birçok siteyi yönetiyor, yapay zekânın soruların çoğunu karşılamasını ve denetim kayıtlarını istiyorsanız.',
        extras: [
          'Daha ayrıntılı yapay zekâ yanıtları, daha geniş SSS kapsamı',
          'Öncelikli destek ve kurulumda birebir yardım'
        ]
      }
    },

    matrix: {
      sites: 'Site sayısı',
      agents: 'Kullanıcı sayısı',
      conversations: 'Aylık yeni konuşma',
      history: 'Konuşma geçmişi',
      widget: 'Sohbet balonu ve görünüm ayarları',
      faq: 'Yardım içeriği (SSS)',
      assistant: 'Yapay zekâ asistanı',
      assistantReplies: 'Aylık yapay zekâ yanıtı',
      assistantDepth: 'Konuşma başına yapay zekâ yanıtı',
      analytics: 'Raporlar',
      departments: 'Departmanlar ve dağıtım',
      automation: 'Otomatik kurallar',
      proactive: 'Proaktif mesajlar',
      visitors: 'Canlı ziyaretçiler',
      crm: 'Fırsat takibi',
      export: 'Dışa aktarma',
      audit: 'Denetim kayıtları',
      security: 'Ekip için zorunlu iki adımlı doğrulama',
      noBranding: 'Balonda “Support.io” yazısı olmadan'
    }
  },

  /* ------------------------------------------------------------ hakkımızda */

  aboutPage: {
    meta: {
      title: 'Hakkımızda',
      description: 'Support.io neden var ve neye göre karar veriyoruz.'
    },
    eyebrow: 'Hakkımızda',
    title: 'Küçük bir ekibin kendi derdinden doğan araç',
    description:
      'Support.io bir yatırım turunun ürünü değil. Müşteri mesajlarını üç ayrı yerden takip etmekten yorulan bir ekibin kendisi için yazdığı, sonra başkalarına da açtığı bir araç.',

    storyEyebrow: 'Hikâye',
    story: {
      p1: 'Bir destek aracına ihtiyacımız vardı ve baktığımız her şey ya bir kurumsal satış görüşmesiyle başlıyordu ya da ilk faturada şaşırtıyordu.',
      p2: 'Mevcut araçların çoğu iki uçtan birindeydi: ya kurması için ayrı bir ekip gereken devasa platformlar, ya da bir sohbet kutusundan ibaret olup ekip büyüyünce yetmeyen basit eklentiler. Arada bir şey yoktu. Küçük bir ekibin ilk günden kullanabileceği, ama beş kişi olduğunda da bırakmak zorunda kalmayacağı bir araç arıyorduk.',
      p3: 'Bu yüzden kendimiz yazdık. Ürünü önce kendi sitemizde kullanıyoruz — bu sayfada gördüğünüz sohbet balonu da onun ta kendisi. Bir şey bozulursa ilk fark eden biz oluyoruz.'
    },

    principlesEyebrow: 'İlkeler',
    principlesTitle: 'Neye göre karar veriyoruz',
    principlesDesc:
      'Bunlar duvara asılan cümleler değil; ürünün bugünkü hâlini belirleyen, bazıları bize özellik kaybettiren kararlar.',
    principles: {
      own: {
        title: 'Fiyat ortada olsun',
        body: 'Fiyatı görmek için form doldurtmuyoruz. Ücretsiz planın süresi yok ve kredi kartı istemiyoruz — deneyip karar vermeniz için kartınızı almamız gerekmiyor.'
      },
      plain: {
        title: 'Düz konuşalım',
        body: 'Ürünün ne yaptığını gündelik kelimelerle anlatıyoruz. Jargon, büyük laflar ve yerine getirmediğimiz vaatler yok.'
      },
      honest: {
        title: 'Olmayan şeyi yazmayalım',
        body: 'Bu sayfalarda uydurma müşteri sayısı, memnuniyet oranı ya da logo yok. Ürünün bugün gerçekten yaptığını yazıyoruz; yapay zekâ asistanı da dâhil.'
      },
      accessible: {
        title: 'Herkes kullanabilsin',
        body: 'Klavyeyle gezilebilsin, ekran okuyucu okuyabilsin, koyu temada da okunsun. Hareketi rahatsız edici bulanlar için animasyonlar kendiliğinden kapanır.'
      }
    },

    contactEyebrow: 'İletişim',
    contactBody:
      'Sorunuz, öneriniz ya da “bizde şu çalışmıyor” diyeceğiniz bir şey varsa yazın. Bu sitedeki sohbet balonundan da ulaşabilirsiniz; oradan gelen mesajlar da aynı panele düşüyor.'
  },

  /* ------------------------------------------------------- giriş / kayıt */

  authPanel: {
    backHome: 'Ana sayfaya dön',
    login: {
      title: 'Gelen kutunuz sizi bekliyor',
      points: [
        'Bütün konuşmalar tek ekranda',
        'Yeni mesaj anında bildirilir',
        'Telefondan da girebilirsiniz'
      ]
    },
    register: {
      title: 'İki dakika sonra ilk mesajınızı alabilirsiniz',
      points: [
        'Ücretsiz plan süresizdir, kredi kartı istemiyoruz',
        'Sitenize tek satır yapıştırmanız yeterli',
        'Beğenmezseniz hesabınızı tek tıkla silersiniz'
      ]
    }
  },

  login: {
    title: 'Giriş yapın',
    subtitle: 'Hesabınıza girin ve gelen kutunuza dönün.',
    metaTitle: 'Giriş yap — Support.io',
    noAccount: 'Hesabınız yok mu?',
    register: 'Ücretsiz açın'
  },

  register: {
    title: 'Ücretsiz hesap açın',
    subtitle: 'E-posta ve şifre yeterli. Kredi kartı istemiyoruz.',
    metaTitle: 'Ücretsiz hesap açın — Support.io',
    passwordHint: 'En az 10 karakter, tahmin edilmesi kolay olmasın',
    noCard: 'Kayıt olarak kullanım koşullarını kabul etmiş olursunuz.',
    hasAccount: 'Zaten hesabınız var mı?',
    login: 'Giriş yapın'
  },

  /* ------------------------------------------------------ ürün görselleri */

  viz: {
    frameGeneric: 'Support.io paneli',

    inbox: {
      frame: 'Gelen kutusu',
      search: 'Konuşmalarda ara',
      filterOpen: 'Açık',
      count: '12 konuşma',
      online: 'Sitede',
      rows: [
        {
          name: 'Elif Kaya',
          preview: 'Şifre sıfırlama e-postası gelmedi.',
          time: '2dk',
          tag: 'Hesap',
          tone: 'indigo'
        },
        {
          name: 'Burak Şen',
          preview: 'Faturayı şirket adına kesebilir misiniz?',
          time: '14dk',
          tag: 'Fatura',
          tone: 'sky'
        },
        {
          name: 'Zeynep A.',
          preview: 'Yıllık plana geçersem ne değişir?',
          time: '1sa',
          tag: 'Satış',
          tone: 'amber'
        },
        {
          name: 'Deniz Yurt',
          preview: 'Teşekkürler, çözüldü.',
          time: '3sa',
          tag: 'Çözüldü',
          tone: 'emerald'
        }
      ],
      openName: 'Elif Kaya',
      openPage: '/giris sayfasında',
      openStatus: 'Bekliyor',
      today: 'Bugün',
      msg1: 'Merhaba, şifremi sıfırlamak istiyorum ama e-posta gelmedi.',
      msg2: 'Merhaba Elif Hanım! E-postayı yeniden gönderdim, birkaç dakika içinde gelir. Gelmezse gereksiz klasörüne de bakabilirsiniz.',
      msg3: 'Geldi, çok teşekkürler!',
      sentBy: 'Kerem',
      composer: 'Yanıt yazın…'
    },

    widget: {
      title: 'Nova Yazılım',
      status: 'Genelde birkaç dakikada yanıtlıyor',
      bot: 'Merhaba! Size nasıl yardımcı olabiliriz?',
      visitor: 'Deneme süresi kaç gün?',
      agent: '14 gün, kredi kartı istemiyoruz. Kurulumda takılırsanız buradan yazın.',
      quick: ['Fiyatlar', 'Kurulum', 'Fatura'],
      composer: 'Mesajınızı yazın…'
    },

    assistant: {
      frame: 'Yapay zekâ asistanı',
      badge: 'Yapay zekâ yanıtladı',
      page: '/fiyatlandirma sayfasında',
      name: 'Yapay zekâ asistanı',
      q1: 'Ücretsiz planda kaç site ekleyebilirim?',
      a1: 'Ücretsiz planda 1 site ve 1 kullanıcı var; ayda 100 yeni konuşma dâhil.',
      source: 'Kaynak: Planlar ve fiyatlar',
      q2: 'Faturayı şirket adına kesebiliyor musunuz?',
      handoff: 'Cevap SSS’de yok · ekibe aktarıldı',
      agent: 'Ayça · Muhasebe',
      a2: 'Merhaba, ben Ayça. Hemen yardımcı oluyorum; şirket unvanınızı yazar mısınız?'
    },

    metrics: {
      cards: [
        { value: '38', label: 'Açık konuşma', delta: '+12%', up: true },
        { value: '2dk', label: 'Ortalama ilk yanıt', delta: '-18%', up: true },
        { value: '94%', label: 'Çözülen', delta: '+3%', up: true },
        { value: '4,8', label: 'Memnuniyet', delta: '+0,2', up: true }
      ]
    },

    analytics: {
      frame: 'Raporlar',
      title: 'Haftalık konuşma akışı',
      range: 'Son 7 gün',
      s1: 'Gelen',
      s2: 'Çözülen',
      days: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
      alt: 'Son yedi günde gelen ve çözülen konuşma sayılarını gösteren çizgi grafiği.'
    },

    routing: {
      frame: 'Yönlendirme',
      visitor: 'Yeni ziyaretçi',
      message: '“Pro plan hakkında bilgi almak istiyorum”',
      new: 'Yeni',
      depts: [
        { name: 'Satış', load: '2 açık' },
        { name: 'Destek', load: '5 açık' },
        { name: 'Muhasebe', load: '1 açık' }
      ],
      agent: 'Kerem Aslan',
      assigned: 'Atandı · müsait'
    },

    automation: {
      frame: 'Otomatik kurallar',
      ruleName: 'Fatura soruları',
      active: 'Açık',
      ifLabel: 'Eğer',
      and: 've',
      thenLabel: 'O zaman',
      conditions: ['Mesajda “fatura” geçiyorsa', 'Sayfa /hesabim ise'],
      actions: [
        'Muhasebe departmanına yönlendir',
        '“Fatura” etiketi ekle',
        'Hazır fatura cevabını gönder'
      ],
      stat: 'Bu ay 128 kez çalıştı'
    },

    proactive: {
      frame: 'Proaktif mesaj',
      triggers: ['30 saniye sonra', 'Sayfadan çıkarken', 'Sayfa sonuna inince'],
      agent: 'Selin',
      message: 'Planlar arasında kararsız kaldıysanız yardımcı olayım — ekibiniz kaç kişi?'
    },

    knowledge: {
      frame: 'Yardım içeriği',
      query: 'şifre',
      results: [
        { q: 'Şifremi nasıl sıfırlarım?', meta: '412 kez okundu' },
        { q: 'E-posta adresimi nasıl değiştiririm?', meta: '268 kez okundu' },
        { q: 'Faturamı nereden indiririm?', meta: '193 kez okundu' }
      ],
      note: 'Cevabı kendi bulan ziyaretçi size hiç yazmaz.'
    },

    team: {
      frame: 'Ekip',
      members: [
        {
          name: 'Kerem Aslan',
          role: 'Destek · Yönetici',
          state: 'online',
          stateLabel: 'Çevrimiçi',
          load: '3 açık'
        },
        {
          name: 'Selin Duru',
          role: 'Satış · Temsilci',
          state: 'online',
          stateLabel: 'Çevrimiçi',
          load: '2 açık'
        },
        {
          name: 'Mert Yalın',
          role: 'Destek · Temsilci',
          state: 'busy',
          stateLabel: 'Meşgul',
          load: '5 açık'
        },
        {
          name: 'Ayça Toprak',
          role: 'Muhasebe',
          state: 'away',
          stateLabel: 'Uzakta',
          load: '0 açık'
        }
      ]
    },

    visitors: {
      frame: 'Canlı ziyaretçiler',
      title: 'Şu anda sitede 14 kişi var',
      head: ['Konum', 'Bulunduğu sayfa', 'Süre'],
      rows: [
        { city: 'İstanbul', page: '/fiyatlandirma', time: '4dk' },
        { city: 'Ankara', page: '/kayit', time: '2dk' },
        { city: 'İzmir', page: '/yardim/kurulum', time: '7dk' },
        { city: 'Bursa', page: '/iletisim', time: '1dk' }
      ]
    },

    crm: {
      frame: 'Fırsat takibi',
      stages: [
        {
          name: 'İlk görüşme',
          count: '4',
          cards: [
            { title: 'Acme Ltd.', value: '₺24.000' },
            { title: 'Nova Tekstil', value: '₺8.500' }
          ]
        },
        { name: 'Teklif', count: '3', cards: [{ title: 'Beta Yazılım', value: '₺46.000' }] },
        { name: 'Pazarlık', count: '2', cards: [{ title: 'Kaya İnşaat', value: '₺112.000' }] },
        { name: 'Kazanıldı', count: '6', cards: [{ title: 'Deniz Gıda', value: '₺31.000' }] }
      ]
    }
  }
};
