/**
 * Sektör çözümleri ve yapay zekâ sayfasının metinleri (Türkçe).
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
        desc: '“Bu bedeni var mı?”, “Kargom nerede?”, “İade nasıl?” Günde yüzlerce kez gelen bu soruları asistan yanıtlar; satışa dönecek konuşmalar ekibinize kalır.',
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
            title: 'Sipariş durumunu asistan söyler',
            body: 'Giriş yapmış müşteri “kargom nerede” dediğinde asistan siparişi mağazanızın sisteminden bakar ve durumu yazar. Adres değişikliği gibi işlem gerektiren her şey ekibinize geçer.'
          },
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
          }
        ],
        wins: [
          { label: 'Ekip satışa odaklanır', body: 'Tekrarlayan sorular asistanda ve yardım içeriğinde kalır.' },
          { label: 'Daha az terk edilen sepet', body: 'Takılan ziyaretçi sessizce gitmeden yardım alır.' },
          { label: 'Kampanya haftası panik yok', body: 'Sipariş sorguları kuyruğu doldurmaz.' }
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
            title: 'Asistan sık soruları yanıtlar',
            body: 'Check-in saati, otopark ve kahvaltı gibi soruları yardım içeriğinizden yanıtlar; temsilciye taslak ve çeviri önerir.'
          },
          {
            title: 'Konuşma anında resepsiyonda',
            body: 'Mesaj yazıldığı an ekibin ekranında; dosya ve fotoğraf da paylaşılabilir.'
          },
          {
            title: 'Grup ve etkinlik talepleri takipte',
            body: 'Büyük rezervasyona dönen konuşma fırsat olarak açılır, aşamasıyla izlenir.'
          }
        ],
        wins: [
          { label: 'Rezervasyon yarıda kalmaz', body: 'Soru cevapsız kalmadan yanıtlanır.' },
          { label: 'Her dilde', body: 'Temsilci yanıtını misafirin diline çevirerek gönderir.' },
          { label: 'Grup satışı kaybolmaz', body: 'Büyük talepler ayrı bir hatta izlenir.' }
        ]
      },
      education: {
        name: 'Eğitim',
        tag: 'Kayıt, ders ve ödeme soruları',
        photoAlt: 'Kulaklıkla dizüstü bilgisayarda çevrimiçi derse katılan öğrenci',
        headline: 'Kayıt döneminde gelen soruların altında kalmayın',
        desc: 'Kayıt tarihleri, ders programı, ödeme seçenekleri… Dönem başında gelen yüzlerce soru ekibi boğar. Cevabı belli olanı asistan ve yardım içeriği karşılasın.',
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
            title: 'Asistan ilk yanıtı verir',
            body: 'Yardım içeriğinden yanıtlayabileceği soruları kendisi yanıtlar; emin olmadığı an bir kişiye bırakır.'
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
          { label: 'Ekip nefes alır', body: 'Rutin sorular yardım içeriği ve asistanda kalır.' },
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
        'Kendi sunucunuzda çalışan, müşterilerinize yardım içeriğinizden yanıt veren ve emin olmadığında ekibinize devreden yapay zekâ asistanı.'
    },
    eyebrow: 'Yapay zekâ asistanı',
    title: 'Basit soruları asistan yanıtlasın, gerisini ekibiniz',
    desc: 'Asistan yalnızca sizin yardım içeriğinizde yazanı söyler, giriş yapmış müşterinin siparişine bakar ve emin olmadığı an bir kişiye devreder. Model sizin sunucunuzda çalışır; konuşmalar hiçbir yere gitmez.',
    ctaPrimary: 'Ücretsiz başlayın',
    ctaSecondary: 'Kurulum rehberi',
    heroPoints: ['Soru başına ücret yok', 'Veri sunucunuzdan çıkmaz', 'Her an insana devir'],

    modesEyebrow: 'Üç mod',
    modesTitle: 'Asistanın ne kadar söz sahibi olacağına siz karar verin',
    modesDesc: 'Mod site başına seçilir. Yeni bir site her zaman kapalı başlar.',
    modes: [
      {
        name: 'Kapalı',
        tag: 'Varsayılan',
        body: 'Asistan yok. Konuşmalar doğrudan ekibinize düşer; eskisi gibi.',
        points: ['Hiçbir mesaj modele gitmez', 'Sık sorulan anahtar kelime cevapları çalışmaya devam eder']
      },
      {
        name: 'Yardımcı',
        tag: 'Temsilci için',
        body: 'Asistan ziyaretçiye yazmaz; temsilcinin yanında durur ve önerir.',
        points: ['Uzun konuşmanın özeti', 'Yanıt taslağı ve ton düzeltme', 'Çeviri ve yardım içeriğine soru']
      },
      {
        name: 'Otomatik yanıt',
        tag: 'Ziyaretçi için',
        body: 'Asistan ziyaretçiye kendisi yanıt verir; gerektiğinde konuşmayı devreder.',
        points: ['Selamlaşma ve SSS cevapları', 'Sipariş durumu sorgusu', 'Kapsam dışını kibarca reddetme']
      }
    ],

    doesEyebrow: 'Otomatik yanıtta',
    doesTitle: 'Asistan neyi yapar, neyi asla yapmaz',
    does: [
      { title: 'Selamlar ve yönlendirir', body: 'Neye yardım edebileceğini söyler; müşteri boşlukta kalmaz.' },
      { title: 'Yardım içeriğinizden yanıtlar', body: 'Yalnızca eşleşen SSS kayıtlarına dayanarak, kısa ve sade.' },
      { title: 'Siparişe bakar', body: 'Kimliği doğrulanmış müşterinin siparişini mağazanızın sisteminden sorgular.' },
      { title: 'Kapsam dışını reddeder', body: 'İşinizle ilgisi olmayan soruya kibarca hayır der.' },
      { title: 'Mesai saatini bilir', body: 'Mesai dışında devrederken müşteriye ne zaman döneceğinizi söyler.' },
      { title: 'Devreder', body: 'İnsan istendiğinde, şikâyette, işlem gerektiğinde ya da şüphede.' }
    ],
    neverTitle: 'Kodla engellenen şeyler',
    never: [
      'Kart, IBAN ya da kimlik numarası modele hiç gönderilmez',
      'Kaynakta olmayan rakam, tarih ya da bağlantı içeren cevap müşteriye gitmez',
      '“İadenizi yaptım” gibi yapılmamış bir işlemi iddia eden cevap gönderilmez',
      'Temsilci konuşmayı devraldığı an asistan susar',
      'Belirlediğiniz sayıdan fazla otomatik yanıt verilmez',
      'Model kapalı ya da yoğunsa konuşma beklemeden bir kişiye geçer'
    ],

    copilotEyebrow: 'Temsilcinin yanında',
    copilotTitle: 'Uzun konuşmayı baştan okumadan devralın',
    copilotDesc: 'Yardımcı mod her konuşmanın yanında bir panel açar. Öneriler her zaman temsilciye gösterilir; siz onaylamadan müşteriye gitmez.',
    copilot: ['Konuşma özeti', 'Yanıt taslağı', 'Tonu yumuşat ya da resmileştir', 'Müşterinin diline çevir', 'Duygu ve öncelik analizi', 'Yardım içeriğine soru sor'],

    orderEyebrow: 'Sipariş sorgusu',
    orderTitle: '“Kargom nerede?” sorusu ekibinize hiç ulaşmasın',
    orderDesc: 'Müşteri sitenizde giriş yapmışsa asistan siparişini mağazanızın kendi sisteminden bakar. Kimin siparişine bakıldığını sunucunuz imzayla doğrular; başka birinin siparişi asla görünmez.',
    orderSteps: [
      { title: 'Müşteri giriş yapmış', body: 'Siteniz müşterinin kimliğini imzalı olarak balona bildirir.' },
      { title: 'Asistan sorar', body: 'Mağazanızın sipariş servisine imzalı bir istek gider; yalnızca o müşterinin siparişleri döner.' },
      { title: 'Müşteri öğrenir', body: 'Durum, kargo firması ve tahmini teslim tarihi sade bir cümleyle yazılır.' }
    ],

    privacyEyebrow: 'Gizlilik',
    privacyTitle: 'Model sizin makinenizde. Nokta.',
    privacyDesc: 'Asistan, açık kaynaklı bir dil modelini sizin ekran kartınızda çalıştırır. Başka bir şirketin servisine yedek olarak bile gidilmez: model kapalıysa konuşmalar doğrudan ekibinize düşer.',
    requirements: [
      { label: 'Ekran kartı', value: '12–16 GB bellekli NVIDIA' },
      { label: 'Bellek', value: '16 GB (32 GB önerilir)' },
      { label: 'Disk', value: 'Yaklaşık 40 GB' },
      { label: 'Soru başına ücret', value: 'Yok' }
    ],

    faqTitle: 'Asistan hakkında sorular',
    faq: [
      {
        q: 'Ekran kartım yoksa ne olur?',
        a: 'Ürünün geri kalanı olduğu gibi çalışır; yalnızca asistan kapalı görünür. Canlı sohbet, gelen kutusu ve otomatik kurallar modele ihtiyaç duymaz.'
      },
      {
        q: 'Asistan her soruyu yanıtlamaya çalışır mı?',
        a: 'Hayır. Yardım içeriğinizde cevabı olmayan, işlem gerektiren ya da müşterinin kişi istediği her konuşmayı ekibinize bırakır.'
      },
      {
        q: 'Müşteri asistanla konuştuğunu bilir mi?',
        a: 'Evet. Asistanın mesajları balonda “Asistan” etiketiyle görünür ve müşteri istediği an “temsilciye bağlan” diyebilir.'
      },
      {
        q: 'Türkçe ve İngilizce yanıt verir mi?',
        a: 'Evet; müşteri hangi dilde yazıyorsa o dilde yanıtlar. Devir ve uyarı metinleri de iki dilde hazırdır.'
      }
    ]
  }
};
