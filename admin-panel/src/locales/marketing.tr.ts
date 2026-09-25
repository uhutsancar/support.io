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
      desc: 'Ziyaretçiniz sitenizden yazar; asistanınız basit soruları anında yanıtlar, gerisini ekibinize devreder. Bütün konuşmalar tek ekranda, kim neye baktı belli.',
      tour: 'Ürünü gezin',
      photoAlt: 'Kulaklıkla bilgisayar başında müşteriye yanıt veren destek temsilcisi',
      notifTitle: 'Yeni konuşma · /sepet',
      notifBody: 'Ziyaretçi 12 saniyedir ödeme sayfasında',
      handoff: 'Selin konuşmayı devraldı'
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
          title: 'Asistan ilk cevabı verir',
          body: 'Sık sorulan soruları yardım içeriğinizden yanıtlar, giriş yapmış müşterinin siparişini mağazanızın sisteminden bakar. Emin olmadığı an konuşmayı bir kişiye bırakır.',
          chips: ['SSS', 'Sipariş', 'Devir']
        },
        {
          title: 'Kalan iş doğru kişiye gider',
          body: 'Fatura sorusu muhasebeye, iade talebi satışa. Departmanları bir kez tanımlarsınız; konuşma o an müsait olan temsilciye dağıtılır.',
          chips: ['Departman', 'Sıra', 'Mesai']
        },
        {
          title: 'Tekrarlayan işler kurala bağlanır',
          body: '“Mesajda iade geçiyorsa etiketle ve satışa gönder” gibi kuralları listeden seçerek kurarsınız. Kod yok, her çalışma kayıtlı.',
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
      eyebrow: 'Yapay zekâ',
      title: 'Kendi sunucunuzda çalışan, ne zaman susacağını bilen bir asistan',
      desc: 'Asistan müşterilerinizin sorularını sizin yardım içeriğinizden yanıtlar. Model sizin makinenizde çalışır; konuşmalar, müşteri bilgileri hiçbir yere gönderilmez.',
      points: [
        {
          title: 'Veriniz evinizde kalır',
          body: 'Model sizin sunucunuzda çalışır. Başka bir şirketin yapay zekâ servisine tek cümle gitmez.'
        },
        {
          title: 'Hassas bilgi modele hiç ulaşmaz',
          body: 'Kart numarası, IBAN ya da kimlik numarası yazan müşteri uyarılır ve doğrudan bir kişiye aktarılır.'
        },
        {
          title: 'Emin değilse devreder',
          body: 'Müşteri “temsilci” dediğinde, şikâyette ya da bilgi eksikse konuşma ekibinize geçer.'
        },
        {
          title: 'Uydurmaz',
          body: 'Yardım içeriğinizde olmayan bir tarih, fiyat ya da bağlantı içeren cevap müşteriye gitmez.'
        }
      ],
      modes: [
        { name: 'Kapalı', body: 'Asistan yok; her şey ekibinizde.' },
        { name: 'Yardımcı', body: 'Temsilciye özet ve taslak önerir, kendisi göndermez.' },
        { name: 'Otomatik yanıt', body: 'Ziyaretçiye kendisi cevap verir, gerektiğinde devreder.' }
      ],
      cta: 'Asistanı yakından tanıyın',
      cta2: 'Özellik ayrıntıları'
    },
    setup: {
      eyebrow: 'Kurulum',
      title: 'Tek satır. Birkaç dakikada yayında.',
      desc: 'Satırı yapıştırdığınız an balon sitenizde. Gerisi panelden: rengini seçin, ekibinizi davet edin, asistanı açın. Yazılımcıya gerek yok.',
      keyPlaceholder: 'SITE_ANAHTARINIZ',
      comment: 'Support.io sohbet balonu',
      live: 'Balon yapıştırdığınız dakika içinde görünür',
      noDevs: {
        eyebrow: 'Yazılımcı gerekmez',
        title: 'Kopyala, yapıştır, bitti.',
        body: 'WordPress, Shopify, Ticimax ya da kendi yazdığınız site — hepsinde aynı satır, ayarlar ekranına yapıştırılır.'
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
        { label: 'Asistanın yanıtladığı', value: '%38' }
      ]
    },
    features: {
      eyebrow: 'Hepsi bir arada',
      title: 'Bugün çalışan on bir özellik',
      desc: 'Yol haritası değil; hesabınızı açtığınızda karşınıza çıkacak ekranlar.'
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
        security: 'Güvenlik'
      },
      items: [
        {
          cat: 'pricing',
          q: 'Ücretsiz plan gerçekten ücretsiz mi?',
          a: 'Evet, süresi yok ve kredi kartı istemiyoruz. Tek site ve tek kullanıcıyla sınırlıdır; konuşma sayısında sınır yoktur.'
        },
        {
          cat: 'pricing',
          q: 'Ekibim büyürse ne olur?',
          a: 'Pro plana geçersiniz; kullanıcı başına aylık ödersiniz. Müşterilerinizin ya da konuşmalarınızın sayısı ücreti etkilemez.'
        },
        {
          cat: 'setup',
          q: 'Kurulum için yazılımcıya ihtiyacım var mı?',
          a: 'Çoğu durumda hayır. WordPress, Shopify ve benzeri altyapılarda tek satırı ayarlar ekranına yapıştırmanız yeterli. Takılırsanız bize yazın, birlikte yapalım.'
        },
        {
          cat: 'setup',
          q: 'Sitemi yavaşlatır mı?',
          a: 'Hayır. Balon sayfanızın geri kalanı yüklendikten sonra devreye girer ve sitenizin tasarımından yalıtılmıştır.'
        },
        {
          cat: 'ai',
          q: 'Asistan yanlış bir şey söylerse?',
          a: 'Cevap müşteriye gitmeden önce kontrol edilir: yardım içeriğinizde olmayan bir rakam, tarih ya da bağlantı varsa gönderilmez ve konuşma bir kişiye aktarılır.'
        },
        {
          cat: 'ai',
          q: 'Asistan için ayrıca ödeme yapıyor muyuz?',
          a: 'Hayır. Model sizin sunucunuzda çalıştığı için soru başına ücret yoktur. İhtiyaç, yaklaşık 12–16 GB belleği olan bir ekran kartıdır.'
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

  demoChat: {
    status: 'Çevrimiçi · genelde birkaç dakikada yanıtlar',
    botName: 'Asistan',
    hero: {
      brand: 'Acme Mağaza',
      lines: [
        { from: 'visitor', text: 'Merhaba, iade süresi kaç gün?' },
        {
          from: 'bot',
          text: 'Teslimattan itibaren 14 gün içinde ücretsiz iade edebilirsiniz. Kutusu açılmış olması sorun değil.'
        },
        { from: 'visitor', text: 'Yetkiliyle görüşebilir miyim?' },
        { from: 'note', text: 'Selin konuşmaya katıldı' },
        { from: 'agent', name: 'Selin', text: 'Merhaba! Ben Selin, hemen yardımcı olayım.' }
      ]
    },
    story: {
      brand: 'Acme Mağaza',
      lines: [
        { from: 'visitor', text: 'Kargom nerede? Sipariş no 10482' },
        {
          from: 'order',
          order: {
            number: '10482',
            status: 'Kargoda',
            carrier: 'Örnek Kargo',
            eta: 'Tahmini teslim: Perşembe'
          }
        },
        {
          from: 'bot',
          text: 'Siparişiniz dün kargoya verildi, perşembe teslim edilmesi bekleniyor.'
        },
        { from: 'visitor', text: 'Adresimi değiştirmem lazım' },
        { from: 'note', text: 'Asistan konuşmayı ekibe devretti' },
        { from: 'agent', name: 'Kerem', text: 'Hemen kargo firmasıyla adresinizi güncelliyorum.' }
      ]
    },
    ai: {
      brand: 'Acme Mağaza',
      lines: [
        { from: 'visitor', text: 'Merhaba 👋' },
        { from: 'bot', text: 'Merhaba! Siparişiniz, iade ya da ürünlerimizle ilgili sorabilirsiniz.' },
        { from: 'visitor', text: 'Son siparişim ne durumda?' },
        {
          from: 'order',
          order: {
            number: '10482',
            status: 'Kargoda',
            carrier: 'Örnek Kargo',
            eta: 'Tahmini teslim: Perşembe'
          }
        },
        { from: 'bot', text: '10482 numaralı siparişiniz kargoda; perşembe teslim edilmesi bekleniyor.' },
        { from: 'visitor', text: 'Kartımdan iki kez çekilmiş gibi görünüyor' },
        { from: 'note', text: 'Ödeme konusu · temsilciye aktarıldı' },
        { from: 'agent', name: 'Selin', text: 'Hemen kontrol ediyorum, ekstrenizdeki tutarı yazabilir misiniz?' }
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
        'Müşterileriniz sitenizden yazar, ekibiniz tek ekrandan yanıtlar. Kurulum bir satır kod, iki dakika. Ücretsiz planla başlayın.',

      badge: 'Kurulum 2 dakika · Kredi kartı istenmez',
      heroTitle: 'Müşteriniz soru sorduğunda',
      heroTitleAccent: 'orada olun.',
      heroDesc:
        'Sitenizi gezen kişi bir şey merak ettiğinde size yazabilsin. Ekibiniz bütün konuşmaları tek ekranda görsün, kimse cevapsız kalmasın. Kurulumu bir satır, kullanması WhatsApp kadar tanıdık.',

      btnStart: 'Ücretsiz başlayın',
      btnTour: 'Neler yapabildiğine bakın',
      btnDocs: 'Kurulum rehberi',

      trust: {
        free: 'Ücretsiz plan süresizdir',
        card: 'Kredi kartı istemiyoruz',
        setup: 'Kurulum ortalama 2 dakika'
      },

      /* --------------------------------------------------------- problem */
      problem: {
        eyebrow: 'Tanıdık geldi mi',
        title: 'Müşteri mesajları her yere dağılmış durumda',
        desc: 'Biri Instagram’dan yazıyor, biri telefonla arıyor, biri iletişim formunu dolduruyor. Cevaplayan kişi hangisine baktığını unutuyor, cevaplanmayanı kimse fark etmiyor.',
        items: [
          {
            title: 'Mesajlar kayboluyor',
            body: 'Gelen kutusunda biriken bir soru, yoğun bir günde kimsenin dönmediği bir soruya dönüşüyor.'
          },
          {
            title: 'Kim ne yaptı belirsiz',
            body: 'İki kişi aynı müşteriye cevap yazıyor, bir başkası hiç yazılmadığını sanıyor.'
          },
          {
            title: 'Geç kalınıyor',
            body: 'Satın almaya hazır ziyaretçi cevabı beklerken sekmeyi kapatıyor ve geri gelmiyor.'
          },
          {
            title: 'Ölçemiyorsunuz',
            body: 'Kaç soru geldi, ne kadar sürede dönüldü, hangisi çözüldü — elinizde bir rakam yok.'
          }
        ],
        answer:
          'Support.io hepsini tek bir gelen kutusunda toplar. Kim, hangi sayfada, ne sordu, kim cevapladı — hepsi tek ekranda.'
      },

      /* ---------------------------------------------------- nasıl çalışır */
      how: {
        eyebrow: 'Nasıl çalışır',
        title: 'Dört adımda, ilk günden çalışan bir destek hattı',
        desc: 'Kurmak için teknik bilgiye ihtiyacınız yok. Sırayla ne olduğunu aşağıda görebilirsiniz.'
      },

      steps: [
        {
          kicker: 'Ziyaretçi tarafı',
          title: 'Sitenizin köşesinde bir sohbet balonu belirir',
          body: 'Ziyaretçi tıklar, yazar. Kayıt olmasına, e-posta bırakmasına gerek yoktur. Balonun rengini, yazısını ve nerede duracağını siz seçersiniz; sitenizin tasarımına göre görünür.',
          points: [
            'Telefonda da bilgisayarda da aynı şekilde çalışır',
            'Ziyaretçi sayfa değiştirse bile konuşma kapanmaz',
            'Geri döndüğünde eski konuşmasını kaldığı yerden bulur'
          ]
        },
        {
          kicker: 'Ekip tarafı',
          title: 'Mesaj ekibinizin ekranına anında düşer',
          body: 'Sayfayı yenilemeniz gerekmez; mesaj yazıldığı an görünür. Müşterinin hangi sayfada olduğunu, daha önce ne konuştuğunuzu ve kimin ilgilendiğini yanında görürsünüz.',
          points: [
            'Karşı taraf yazarken üç nokta görünür',
            'Dosya ve ekran görüntüsü gönderilebilir',
            'Ekip arkadaşınıza konuşmadan çıkmadan danışabilirsiniz'
          ]
        },
        {
          kicker: 'Düzen',
          title: 'Konuşma doğru kişiye kendiliğinden gider',
          body: 'Fatura sorusu muhasebeye, iade talebi satışa. Departmanları bir kez tanımlarsınız, gelen her konuşma o an müsait olan temsilciye dağıtılır.',
          points: [
            'Sırayla ya da en az işi olana dağıtım',
            'Mesai saatleri dışında otomatik bilgilendirme',
            'Temsilci çevrimdışı olunca işi başkasına devreder'
          ]
        },
        {
          kicker: 'Sonuç',
          title: 'Ay sonunda ne olduğunu rakamla görürsünüz',
          body: 'Kaç soru geldi, ortalama kaç dakikada dönüldü, hangi temsilci kaç konuşma kapattı. Tahmin etmek yerine bakarsınız.',
          points: [
            'İlk yanıt süresi ve çözüm süresi',
            'Temsilci bazında kırılım',
            'Hangi sayfadan kaç soru geldiği'
          ]
        }
      ],

      /* ---------------------------------------------------------- sekmeler */
      tour: {
        eyebrow: 'Ürün turu',
        title: 'Panelin içinde ne var',
        desc: 'Başlıklara tıklayın; her biri ekibinizin gün içinde kullandığı bir ekran.',
        detail: 'Bu özelliği ayrıntılı gör'
      },

      /* ---------------------------------------------------------- sektörler */
      cases: {
        eyebrow: 'Kimler kullanır',
        title: 'Aynı ürün, işinize göre farklı işe yarar',
        desc: 'Soldan işinize en yakın olanı seçin.',
        items: {
          ecommerce: {
            name: 'E-ticaret',
            tag: 'Kargo, iade, beden sorusu',
            headline: 'Sepetteki müşteri sorusunu sorabilsin, sipariş kaçmasın',
            body: 'Ürün sayfasında “bu bedeni var mı”, “kargo ne zaman gelir” diye soran kişi cevabı bekleyemez. Sohbet balonu tam o sayfada açılır, temsilciniz ziyaretçinin hangi ürüne baktığını görerek yanıtlar. Sık sorulan kargo ve iade soruları için hazır cevaplar tanımlarsınız; aynı soruyu günde otuz kez yazmazsınız.',
            wins: [
              {
                label: 'Daha az terk edilen sepet',
                body: 'Ödeme adımında takılan ziyaretçiye kendiliğinden mesaj gider.'
              },
              {
                label: 'Tekrarlayan sorular biter',
                body: 'Kargo ve iade soruları hazır cevapla anında yanıtlanır.'
              },
              {
                label: 'Sipariş bağlamı elinizde',
                body: 'Müşterinin baktığı sayfa ve geçmiş konuşmaları yanınızda durur.'
              }
            ]
          },
          saas: {
            name: 'Yazılım / SaaS',
            tag: 'Deneme süresi, kurulum, hata',
            headline: 'Deneme süresindeki kullanıcıyı takılıp bırakmadan yakalayın',
            body: 'Ürününüzü yeni deneyen biri bir yerde takıldığında genellikle sormaz, sessizce çıkar. Belirli bir sayfada uzun süre kalan ya da kurulum adımında duran kullanıcıya kendiliğinden mesaj gönderebilirsiniz. Gelen her soru ilgili ekibe düşer, teknik olanlar destek ekibinde kalmaz.',
            wins: [
              {
                label: 'Sessiz kaybı görürsünüz',
                body: 'Kim hangi ekranda ne kadar kaldı, panelde canlı akar.'
              },
              {
                label: 'Doğru ekip bakar',
                body: 'Faturalandırma muhasebeye, hata bildirimi teknik ekibe gider.'
              },
              {
                label: 'Cevaplar birikir',
                body: 'Sık sorulanlar yardım içeriğine dönüşür, kullanıcı kendi bulur.'
              }
            ]
          },
          agency: {
            name: 'Ajans / Birden çok site',
            tag: 'Müşteri siteleri, ayrı ekipler',
            headline: 'Tek panelden birden çok siteyi yönetin, veriler birbirine karışmasın',
            body: 'Yönettiğiniz her site için ayrı bir kurulum kodu alırsınız. Konuşmalar, ekip üyeleri ve raporlar site bazında ayrılır; bir müşterinin verisi diğerinde görünmez. Hangi ekip üyesinin hangi siteye erişeceğini siz belirlersiniz.',
            wins: [
              {
                label: 'Site başına ayrım',
                body: 'Her sitenin konuşmaları ve raporları kendi içinde kalır.'
              },
              { label: 'Yetki sizde', body: 'Kim hangi siteyi görecek, tek tek seçilir.' },
              { label: 'Tek giriş', body: 'Onlarca site için onlarca panel açmazsınız.' }
            ]
          },
          service: {
            name: 'Hizmet / Randevu',
            tag: 'Klinik, atölye, danışmanlık',
            headline: 'Telefonla sorulan her şeyi yazıyla, mesai dışında da alın',
            body: 'Randevu, fiyat ve yol tarifi soruları telefonu meşgul eder. Aynı sorular sohbetten geldiğinde ekibiniz aynı anda birkaç kişiyle ilgilenebilir. Mesai saatleri dışında gelen mesaj kaybolmaz; sabah geldiğinizde sizi bekler ve müşteri ne zaman döneceğinizi bilir.',
            wins: [
              {
                label: 'Telefon boşalır',
                body: 'Aynı anda birden fazla kişiyle yazışabilirsiniz.'
              },
              {
                label: 'Mesai dışı kayıp yok',
                body: 'Gece gelen mesaj sabah gelen kutusunda durur.'
              },
              { label: 'Sık sorular hazır', body: 'Fiyat ve adres gibi sorulara tek tıkla cevap.' }
            ]
          }
        }
      },

      /* ---------------------------------------------------------- kurulum */
      setup: {
        eyebrow: 'Kurulum',
        title: 'Bir satır kod, iki dakika',
        desc: 'Hesabı açtıktan sonra size özel bir satır veriyoruz. Sitenizin tasarımını yapan kişiye gönderirsiniz, yapıştırır. Hepsi bu.',
        steps: [
          { title: 'Hesabınızı açın', body: 'E-posta ve şifre yeterli. Kredi kartı istemiyoruz.' },
          {
            title: 'Sitenizi ekleyin',
            body: 'Site adresini yazın, size özel kurulum satırını verelim.'
          },
          {
            title: 'Satırı sitenize yapıştırın',
            body: 'Balon aynı dakika içinde sitenizde görünmeye başlar.'
          }
        ],
        file: 'sitenizin sayfası',
        cta: 'Hesap açıp kodu alın',
        note: 'Sitenizi yapan biri yoksa takılmayın: adresinizi yazın, kurulumu birlikte yapalım.',
        worksWith: 'Hangi altyapıda olursa olsun çalışır',
        platforms: [
          'WordPress',
          'Shopify',
          'WooCommerce',
          'Wix',
          'Webflow',
          'Ticimax',
          'İdeasoft',
          'React',
          'Next.js',
          'Vue',
          'Laravel',
          'PHP',
          'Django',
          'Squarespace'
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
            title: 'Sitenizi yavaşlatmaz, bozmaz',
            body: 'Sohbet balonu sitenizin tasarımından yalıtılmıştır; sayfanızın görünümünü değiştirmez.'
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
        price: { free: '₺0', pro: '₺490', enterprise: 'Size özel' },
        note: {
          free: 'Tek site, tek kullanıcı',
          pro: 'Kullanıcı başına / ay',
          enterprise: 'Büyük ekipler için'
        },
        link: 'Planları karşılaştır'
      },

      /* ------------------------------------------------------------- SSS */
      faq: {
        title: 'Sık sorulanlar',
        desc: 'Başka bir şey merak ediyorsanız sohbetten yazın; bu siteye de aynı ürün kurulu.',
        items: [
          {
            q: 'Kurulum için yazılımcıya ihtiyacım var mı?',
            a: 'Çoğu durumda hayır. WordPress, Shopify ve benzeri altyapılarda tek satırı ayarlar ekranından yapıştırmanız yeterli. Takılırsanız adresinizi yazın, birlikte yapalım.'
          },
          {
            q: 'Ücretsiz plan gerçekten ücretsiz mi?',
            a: 'Evet, süresi yok ve kredi kartı istemiyoruz. Tek site ve tek kullanıcıyla sınırlıdır; sınırsız konuşma yapabilirsiniz.'
          },
          {
            q: 'Sitemi yavaşlatır mı?',
            a: 'Hayır. Sohbet balonu sayfanızın geri kalanı yüklendikten sonra devreye girer, sayfanın açılmasını beklettirmez.'
          },
          {
            q: 'Mesai dışında gelen mesajlara ne oluyor?',
            a: 'Kaybolmuyor. Ziyaretçiye ne zaman döneceğiniz bilgisini gösteriyoruz, mesaj gelen kutunuzda sizi bekliyor.'
          },
          {
            q: 'Telefondan da cevap verebilir miyim?',
            a: 'Evet. Panel telefon tarayıcısında da çalışır; ayrı bir uygulama indirmenize gerek yok.'
          },
          {
            q: 'Verilerimi dışarı alabilir miyim?',
            a: 'Pro ve Kurumsal planlarda konuşmalarınızı dışa aktarabilirsiniz. Veriler size aittir, ayrılırsanız yanınızda götürürsünüz.'
          }
        ]
      },

      ctaTitle: 'İlk konuşmanız iki dakika uzağınızda',
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
        desc: 'Ziyaretçi sitenizden yazar, ekibiniz tek gelen kutusundan yanıtlar. Sık sorulanlara müşteri kendi de bakabilir.',
        points: [
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
        desc: 'Raporlar, canlı ziyaretçiler, fırsat takibi ve yapay zekâ yardımcısı. Tahmin yerine rakam.',
        points: [
          'Yanıt ve çözüm süreleri, temsilci kırılımıyla',
          'O an sitede kimin hangi sayfada olduğu',
          'Konuşmadan doğan satış fırsatlarının takibi',
          'Uzun konuşmaların özeti ve yanıt önerisi'
        ]
      }
    },

    benefitsTitle: 'Ne kazandırır',
    howTitle: 'Nasıl kurulur',
    howDesc: 'Hepsi panelden, kod yazmadan. Kurulum sırasında takılırsanız sohbetten yazın.',
    techTitle: 'Teknik not — nasıl çalıştığını merak edenler için',
    nextFeature: 'Sıradaki',
    moreTitle: 'Bunlarla birlikte kullanılır',
    backToList: 'Tüm özellikler',
    readDocs: 'Kurulum rehberini oku',

    devEyebrow: 'Geliştiriciler için',
    devTitle: 'Yazılımcınız varsa işi daha da kolay',
    devDesc:
      'Entegrasyon bir proje değil, tek satır. Daha fazlasını isteyen ekipler için de bir arayüz var.',
    dev: {
      embed: {
        title: 'Her yerde aynı tek satır',
        body: 'Düz HTML, React, Next.js, Vue, WordPress, Laravel — hepsinde aynı kod. Altyapıya özel kurulum yok.'
      },
      sdk: {
        title: 'Koddan kontrol',
        body: 'Balonu açma/kapama, kullanıcıyı tanıtma, dil ve tema değiştirme gibi işlemler kendi kodunuzdan yapılabilir.'
      },
      isolation: {
        title: 'Sitenizin tasarımını bozmaz',
        body: 'Balon kendi yalıtılmış alanında çalışır. Sitenizin stilleri balona, balonunki sitenize karışmaz.'
      },
      control: {
        title: 'Sürümü sabitleyebilirsiniz',
        body: 'İsterseniz belirli bir sürümü kullanmayı seçersiniz; ilerideki bir güncelleme canlı sitenizi etkilemez.'
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
          'Fatura sorusu muhasebeye, iade satışa. Departmanları bir kez tanımlarsınız; gelen konuşma o an müsait olan temsilciye kendiliğinden dağıtılır.',
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
          '“Mesajda iade geçiyorsa satışa yönlendir ve etiketle” gibi kuralları kendiniz kurarsınız. Koşul oluştuğunda kural kendiliğinden çalışır.',
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
          'Ödeme sayfasında takılan ya da uzun süre aynı ekranda kalan ziyaretçiye kendiliğinden bir mesaj gönderin. Çoğu kişi sormaz, sadece çıkar.',
        setup: 'Panelden',
        benefits: [
          'Sayfada kalma süresi, kaydırma ve çıkış niyetine göre tetikleme',
          'Sadece belirli sayfalarda göstermeyi seçebilirsiniz',
          'Aynı kişiye tekrar tekrar gösterilmez',
          'Hangi mesajın kaç kez gönderildiği kayıtlıdır'
        ],
        steps: [
          { title: 'Sayfayı seçin', body: 'Örneğin ödeme ya da fiyatlandırma sayfası.' },
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

      'ai-assist': {
        title: 'Yapay zekâ asistanı',
        short: 'Basit soruları kendisi yanıtlar, gerisini ekibe devreder.',
        plain:
          'Asistan sık sorulan soruları yardım içeriğinizden yanıtlar, giriş yapmış müşterinin siparişini mağazanızın sisteminden bakar ve emin olmadığı an konuşmayı ekibinize bırakır. Model sizin sunucunuzda çalışır.',
        setup: 'Kendi sunucunuzda',
        benefits: [
          'Otomatik yanıt: selamlaşma, SSS ve sipariş durumu',
          'Müşteri istediği an ya da şikâyette bir kişiye devreder',
          'Temsilciye özet, yanıt taslağı, ton düzeltme ve çeviri',
          'Konuşmalar ve müşteri verisi sunucunuzdan çıkmaz'
        ],
        steps: [
          {
            title: 'Modeli sunucunuzda başlatın',
            body: 'Ekran kartlı bir sunucuda tek komutla ayağa kalkar; hazır olunca panel kendiliğinden fark eder.'
          },
          {
            title: 'Site için modu seçin',
            body: 'Siteler → Yapay zekâ ayarlarından kapalı, yardımcı ya da otomatik yanıt.'
          },
          {
            title: 'Yardım içeriğinizi doldurun',
            body: 'Asistan yalnızca orada yazanı söyler; içerik ne kadar iyiyse cevap o kadar iyi olur.'
          }
        ],
        body: 'Model tek bir sunucu kapsayıcısında çalışır ve backend ona yalnızca iç ağdan ulaşır; hiçbir barındırılan modele geri düşüş yoktur. Ziyaretçi mesajı önce kodla denetlenir (temsilci isteği, kart/IBAN/kimlik numarası, yanıt sınırı), sonra yalnızca eşleşen SSS kayıtlarıyla modele gider. Çıkan cevaptaki rakam, tarih ve bağlantılar kaynaklarla karşılaştırılır; tutmayan cevap gönderilmez ve konuşma bir kişiye aktarılır.',
        points: [
          'Temsilci konuşmayı devraldığı an otomatik yanıt durur',
          'Sipariş sorgusu yalnızca kimliği doğrulanmış müşteri için, imzalı istekle yapılır',
          'Model kapalı ya da yoğunsa konuşma bekletilmeden bir kişiye geçer'
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
        ],
        body: 'Fırsat kayıtları konuşmalarla aynı organizasyon sınırında tutulur ve açıldıkları konuşmaya bağlı kalır. Aşama, tutar ve sorumlu temsilci alanları panelden düzenlenir; her değişiklik denetim kaydına yazılır.',
        points: [
          'Fırsatlar açıldıkları konuşmayla ilişkili kalır',
          'Aşama ve tutar değişiklikleri kayda geçer',
          'Kayıtlar organizasyon sınırında izole edilir'
        ]
      }
    }
  },

  /* ---------------------------------------------------------- fiyatlandırma */

  pricingPage: {
    meta: {
      title: 'Fiyatlandırma',
      description:
        'Ücretsiz planla başlayın. Kullanıcı başına aylık ücretlendirme, gizli ücret yok.'
    },
    eyebrow: 'Fiyatlandırma',
    title: 'Ücretsiz başlayın, ekibiniz büyüdükçe ödeyin',
    description:
      'Ücretsiz planın süresi yoktur ve kredi kartı istemiyoruz. Ücretli planlarda kullanıcı başına aylık ödersiniz; sürpriz kalem yok.',

    billing: 'Ödeme sıklığı',
    monthly: 'Aylık',
    yearly: 'Yıllık',
    discount: '2 ay hediye',
    popular: 'En çok tercih edilen',
    perSeat: '/ kullanıcı / ay',
    billedMonthly: 'Aylık faturalandırılır',
    billedYearly: 'Yıllık faturalandırılır',
    custom: 'Size özel',
    freeNote: 'Süresiz ücretsiz, faturalandırma yok',
    contactNote: 'İhtiyacınıza göre belirlenir',
    vatNote:
      'Fiyatlara KDV dâhil değildir. İstediğiniz zaman plan değiştirebilir veya bırakabilirsiniz.',

    chooseEyebrow: 'Karar verirken',
    chooseTitle: 'Hangi plan size uygun?',

    compareTitle: 'Planların karşılaştırması',
    compareDesc: 'Aşağıdaki tablo panelde gerçekten açık olan ekranları gösterir.',
    feature: 'Özellik',

    faqTitle: 'Fiyat hakkında sık sorulanlar',
    faqDesc: 'Aklınıza takılan başka bir şey varsa sohbetten yazın.',
    faqItems: [
      {
        q: 'Ücretsiz plan ne kadar sürüyor?',
        a: 'Süresi yok. Tek site ve tek kullanıcıyla sınırsız süre kullanabilirsiniz. Konuşma sayısında sınır koymuyoruz.'
      },
      {
        q: 'Kredi kartı gerekiyor mu?',
        a: 'Ücretsiz plan için hayır. Sadece e-posta ve şifreyle hesap açarsınız.'
      },
      {
        q: 'Planımı sonradan değiştirebilir miyim?',
        a: 'Evet, istediğiniz zaman yükseltip düşürebilirsiniz. Değişiklik kalan sürenize göre oranlanır.'
      },
      {
        q: '“Kullanıcı” ne demek?',
        a: 'Panele girip konuşmalara cevap veren her ekip üyesi bir kullanıcıdır. Müşterilerinizin sayısı ücreti etkilemez.'
      },
      {
        q: 'Taahhüt var mı?',
        a: 'Aylık planda yok, istediğiniz ay bırakabilirsiniz. Yıllık planda iki ay hediye edildiği için ödeme peşin alınır.'
      },
      {
        q: 'Kurumsal planda ne farklı?',
        a: 'Sınırsız site, denetim kayıtları ve tek oturum açma desteği eklenir. Kapsamı birlikte belirleriz.'
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
        features: [
          '1 site',
          '1 kullanıcı',
          'Sınırsız konuşma',
          'Sohbet balonu ve görünüm ayarları',
          'Yardım içeriği (SSS)',
          'Otomatik kurallar',
          'Proaktif mesajlar',
          'Yapay zekâ asistanı (kendi sunucunuzda)'
        ]
      },
      pro: {
        name: 'Pro',
        tagline: 'Birden fazla kişi cevap veriyorsa asıl plan bu.',
        cta: 'Pro ile başlayın',
        includes: 'Ücretsiz plandaki her şey, ayrıca',
        forWho: 'Ekip olarak çalışanlar',
        forWhoBody:
          'Birden fazla temsilciniz varsa, raporlara ve departman dağıtımına ihtiyacınız olacak.',
        features: [
          '10 site',
          'Sınırsız kullanıcı',
          'Departmanlar ve dağıtım kuralları',
          'Raporlar ve temsilci performansı',
          'Canlı ziyaretçiler',
          'Fırsat takibi',
          'Dışa aktarma'
        ]
      },
      enterprise: {
        name: 'Kurumsal',
        tagline: 'Çok sayıda site ve sıkı erişim kuralları gerekiyorsa.',
        cta: 'Bize yazın',
        includes: 'Pro’daki her şey, ayrıca',
        forWho: 'Büyük ekipler',
        forWhoBody:
          'Çok sayıda siteyi yönetiyor, denetim ve erişim kayıtlarına ihtiyaç duyuyorsanız.',
        features: [
          'Sınırsız site',
          'Denetim kayıtları',
          'Tek oturum açma (SSO)',
          'Özel kurulum desteği'
        ]
      }
    },

    matrix: {
      sites: 'Site sayısı',
      agents: 'Kullanıcı sayısı',
      conversations: 'Sınırsız konuşma',
      widget: 'Sohbet balonu ve görünüm ayarları',
      faq: 'Yardım içeriği (SSS)',
      departments: 'Departmanlar',
      automation: 'Otomatik kurallar',
      proactive: 'Proaktif mesajlar',
      analytics: 'Raporlar',
      visitors: 'Canlı ziyaretçiler',
      crm: 'Fırsat takibi',
      aiAssist: 'Yapay zekâ asistanı (kendi sunucunuzda)',
      export: 'Dışa aktarma',
      audit: 'Denetim kayıtları',
      sso: 'Tek oturum açma (SSO)'
    }
  },

  /* ------------------------------------------------------------ hakkımızda */

  aboutPage: {
    meta: {
      title: 'Hakkımızda',
      description: 'Support.io neden var, neye göre kuruldu ve neyin üzerine inşa edildi.'
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
        body: 'Bu sitede “yapay zekâ destekli omnichannel çözüm” yazmıyor. Ürünün ne yaptığını gündelik kelimelerle anlatıyoruz; teknik karşılıkları merak edene ayrıca veriyoruz.'
      },
      honest: {
        title: 'Olmayan şeyi yazmayalım',
        body: 'Bu sayfalarda müşteri sayısı, memnuniyet oranı ya da kullanmadığımız firmaların logoları yok. Önceki sürümlerde vardı, hepsi kaldırıldı — çünkü hiçbirinin arkasında veri yoktu.'
      },
      accessible: {
        title: 'Herkes kullanabilsin',
        body: 'Klavyeyle gezilebilsin, ekran okuyucu okuyabilsin, koyu temada da okunsun. Hareketi rahatsız edici bulanlar için animasyonlar kendiliğinden kapanır.'
      }
    },

    stackEyebrow: 'Ne üzerine kurulu',
    stackNote:
      'Merak edenler için. Bunları bilmeniz gerekmiyor — ürünü kullanmak için hiçbirine dokunmuyorsunuz.',
    stack: {
      frontend: 'Panel ve bu site',
      backend: 'Sunucu tarafı',
      db: 'Verilerin tutulduğu yer',
      realtime: 'Mesajların anında iletilmesi',
      storage: 'Paylaşılan dosyalar',
      widget: 'Sitenizden yalıtılmış sohbet balonu'
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
    passwordHint: 'En az 6 karakter',
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
          preview: 'Siparişim ne zaman kargoya verilir?',
          time: '2dk',
          tag: 'Kargo',
          tone: 'indigo'
        },
        {
          name: 'Burak Şen',
          preview: 'Faturamı güncelleyebilir misiniz?',
          time: '14dk',
          tag: 'Fatura',
          tone: 'sky'
        },
        {
          name: 'Zeynep A.',
          preview: 'Bu ürünün M bedeni var mı?',
          time: '1sa',
          tag: 'Ürün',
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
      openPage: '/kargo-takip sayfasında',
      openStatus: 'Bekliyor',
      today: 'Bugün',
      msg1: 'Merhaba, dün verdiğim sipariş hâlâ hazırlanıyor görünüyor. Ne zaman kargoya verilir?',
      msg2: 'Merhaba Elif Hanım! Siparişinizi kontrol ettim, bugün 17:00’ye kadar kargoya veriliyor. Takip numarası SMS ile gelecek.',
      msg3: 'Harika, çok teşekkürler!',
      sentBy: 'Kerem',
      composer: 'Yanıt yazın…'
    },

    widget: {
      title: 'Acme Mağaza',
      status: 'Genelde birkaç dakikada yanıtlıyor',
      bot: 'Merhaba! Size nasıl yardımcı olabiliriz?',
      visitor: 'Kargo ne zaman gelir?',
      agent: 'Aynı gün kargoya veriyoruz, teslimat 1-3 iş günü sürüyor.',
      quick: ['Kargo takibi', 'İade koşulları', 'Fatura'],
      composer: 'Mesajınızı yazın…'
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
      message: '“İade etmek istiyorum”',
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
      ruleName: 'İade talebi',
      active: 'Açık',
      ifLabel: 'Eğer',
      and: 've',
      thenLabel: 'O zaman',
      conditions: ['Mesajda “iade” geçiyorsa', 'Sayfa /siparislerim ise'],
      actions: [
        'Satış departmanına yönlendir',
        '“İade” etiketi ekle',
        'Hazır iade cevabını gönder'
      ],
      stat: 'Bu ay 128 kez çalıştı'
    },

    proactive: {
      frame: 'Proaktif mesaj',
      triggers: ['30 saniye sonra', 'Sayfadan çıkarken', 'Sayfa sonuna inince'],
      agent: 'Selin',
      message: 'Ödeme adımında takıldıysanız yardımcı olayım — hangi kartı kullanmak istiyorsunuz?'
    },

    knowledge: {
      frame: 'Yardım içeriği',
      query: 'kargo ne zaman',
      results: [
        { q: 'Siparişim ne zaman kargoya verilir?', meta: '412 kez okundu' },
        { q: 'Kargo takip numaramı nereden bulurum?', meta: '268 kez okundu' },
        { q: 'Teslimat ne kadar sürer?', meta: '193 kez okundu' }
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
        { city: 'İstanbul', page: '/urun/kis-montu', time: '4dk' },
        { city: 'Ankara', page: '/sepet', time: '2dk' },
        { city: 'İzmir', page: '/kargo-takip', time: '7dk' },
        { city: 'Bursa', page: '/iletisim', time: '1dk' }
      ]
    },

    ai: {
      frame: 'Yapay zekâ yardımcısı',
      incoming: 'Gelen mesaj',
      question: 'Ürünü iade etmek istiyorum ama kutusunu attım, yine de kabul ediyor musunuz?',
      suggestion: 'Önerilen yanıt',
      draft:
        'Merhaba! Orijinal kutusu olmadan da iade kabul ediyoruz; ürünün kullanılmamış olması yeterli. Size iade kodunu hemen iletebilirim.',
      actions: ['Gönder', 'Düzenle', 'Tonunu yumuşat'],
      note: 'Öneri her zaman size gösterilir; siz onaylamadan müşteriye gitmez.'
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
