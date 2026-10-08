/**
 * Hesap güvenliği, kayıt ve deneme süresi metinleri (Türkçe).
 *
 * i18n.ts bu ağacı temel çevirinin üzerine derin birleştirir; `audit.actions`
 * altındaki yeni adlar mevcut listeye eklenir.
 */

export default {
  account: {
    register: {
      checkInboxTitle: 'Gelen kutunuzu kontrol edin',
      checkInboxBody:
        '{{email}} adresine bir doğrulama bağlantısı gönderdik. Bağlantıyı açtığınızda hesabınız açılır ve kuruluma geçersiniz.',
      checkInboxHint: 'E-posta birkaç dakika içinde gelmezse istenmeyen klasörüne bakın.',
      resend: 'Bağlantıyı yeniden gönder',
      resent: 'Bağlantı yeniden gönderildi.',
      otherAddress: 'Farklı bir adresle kayıt ol',
      trialNote: '14 gün boyunca Pro özellikleri ücretsiz; kredi kartı gerekmez.',
      securityCheck: 'Güvenlik doğrulaması yükleniyor…'
    },
    login: {
      notVerified:
        'E-posta adresiniz henüz doğrulanmadı. Size yeni bir doğrulama bağlantısı gönderebiliriz.',
      sendLink: 'Doğrulama bağlantısı gönder',
      linkSent: 'Doğrulama bağlantısı gönderildi. Gelen kutunuzu kontrol edin.',
      mfaTitle: 'İki adımlı doğrulama',
      mfaSubtitle: 'Doğrulama uygulamanızdaki 6 haneli kodu girin.',
      mfaRecoverySubtitle:
        'Kaydettiğiniz kurtarma kodlarından birini girin. Her kod bir kez çalışır.',
      code: 'Doğrulama kodu',
      recoveryCode: 'Kurtarma kodu',
      useRecovery: 'Telefonuma erişemiyorum, kurtarma kodu kullan',
      useApp: 'Uygulamadaki kodu kullan',
      verify: 'Doğrula',
      startOver: 'Baştan başla'
    },
    verify: {
      signedIn: 'E-posta adresiniz doğrulandı. Hesabınıza yönlendiriliyorsunuz…',
      done: 'E-posta adresiniz doğrulandı. Şimdi giriş yapabilirsiniz.'
    },
    confirmEmail: {
      title: 'Yeni e-posta adresi',
      working: 'Adres onaylanıyor…',
      done: 'E-posta adresiniz değişti. Bundan sonra {{email}} ile giriş yapın.',
      failed:
        'Bu bağlantı geçersiz ya da süresi dolmuş. Ayarlar sayfasından yeniden isteyebilirsiniz.',
      taken: 'Bu adres artık kullanılamıyor. Başka bir adres deneyin.'
    },
    security: {
      title: 'Hesap güvenliği',
      description: 'Şifrenizi, e-posta adresinizi ve girişte istenen ikinci adımı buradan yönetin.',
      password: {
        title: 'Şifre',
        current: 'Mevcut şifre',
        next: 'Yeni şifre',
        confirm: 'Yeni şifre (tekrar)',
        hint: 'En az 10 karakter. Kaydettiğinizde diğer cihazlardaki oturumlarınız kapanır.',
        save: 'Şifreyi değiştir',
        changed: 'Şifreniz değişti. Diğer cihazlardaki oturumlarınız kapatıldı.',
        mismatch: 'Yeni şifreler aynı değil'
      },
      email: {
        title: 'E-posta adresi',
        current: 'Şu anki adres: {{email}}',
        next: 'Yeni e-posta adresi',
        password: 'Şifreniz',
        send: 'Onay bağlantısı gönder',
        sent: 'Onay bağlantısı yeni adrese gönderildi. Bağlantı açılana kadar mevcut adresiniz geçerli kalır.'
      },
      sessions: {
        title: 'Açık oturumlar',
        body: 'Hesabınız başka bir bilgisayarda ya da telefonda açık kaldıysa oradaki tüm oturumları kapatın. Bu tarayıcıda oturumunuz açık kalır.',
        button: 'Diğer tüm cihazlardan çıkış yap',
        done: 'Diğer tüm cihazlardaki oturumlar kapatıldı.'
      },
      mfa: {
        title: 'İki adımlı doğrulama',
        body: 'Girişte şifrenize ek olarak telefonunuzdaki doğrulama uygulamasının (Google Authenticator, Microsoft Authenticator, 1Password vb.) ürettiği kod istenir.',
        on: 'Açık',
        off: 'Kapalı',
        enable: 'İki adımlı doğrulamayı aç',
        disable: 'Kapat',
        passwordPrompt: 'Devam etmek için şifrenizi girin',
        continue: 'Devam et',
        scan: 'Doğrulama uygulamanızla bu QR kodunu okutun.',
        manual: 'QR okutamıyorsanız bu anahtarı elle girin:',
        codeLabel: 'Uygulamadaki 6 haneli kod',
        confirm: 'Doğrula ve aç',
        recoveryTitle: 'Kurtarma kodlarınız',
        recoveryBody:
          'Telefonunuza erişemezseniz bu kodlarla giriş yapabilirsiniz. Her kod bir kez çalışır. Şimdi güvenli bir yere kaydedin: bir daha gösterilmeyecekler.',
        copy: 'Kopyala',
        copied: 'Kopyalandı',
        download: 'İndir',
        saved: 'Kaydettim',
        enabled: 'İki adımlı doğrulama açıldı.',
        disabled: 'İki adımlı doğrulama kapatıldı.',
        disableBody:
          'Kapatmak için şifrenizi ve uygulamadaki güncel kodu (ya da bir kurtarma kodunu) girin.',
        recoveryLeft: '{{count}} kurtarma kodu kaldı.',
        regenerate: 'Yeni kurtarma kodları oluştur',
        regenerateBody: 'Yeni kodlar oluşturduğunuzda eski kodların hiçbiri çalışmaz.',
        enforcedNote: 'Kuruluşunuz iki adımlı doğrulamayı zorunlu tuttuğu için kapatılamaz.'
      },
      enforce: {
        title: 'Tüm ekip için zorunlu kıl',
        body: 'Açıkken iki adımlı doğrulaması olmayan üyeler, kurmadan panelin geri kalanını kullanamaz.',
        enterpriseOnly: 'Kurumsal planda kullanılabilir.',
        turnOn: 'Zorunlu kıl',
        turnOff: 'Zorunluluğu kaldır',
        updated: 'Ekip güvenlik ayarı kaydedildi.'
      },
      required: {
        title: 'Kuruluşunuz iki adımlı doğrulama istiyor',
        body: 'Panele devam etmek için hesabınızda iki adımlı doğrulamayı açın. Birkaç dakika sürer.'
      }
    },
    chatSettings: {
      button: 'Sohbet ayarları',
      title: 'Sohbet ayarları',
      saved: 'Sohbet ayarları kaydedildi.',
      save: 'Kaydet',
      missedTitle: 'Yanıtlanmamış sohbetler',
      missedHelp:
        'Bir ziyaretçi yazdığında belirlediğiniz süre içinde kimse yanıt vermezse (ya da kimse çevrimiçi değilse) ekibe e-posta gider.',
      delay: 'Bekleme süresi (dakika)',
      notify: 'Kime gitsin',
      notifyAll: 'Siteyle çalışan herkese',
      notifyAssigned: 'Atanan temsilciye (atanmamışsa herkese)',
      notifyOff: 'Kimseye',
      offlineForm: 'Çevrimdışıyken e-posta sor',
      offlineFormHelp:
        'Kimse çevrimiçi değilken balon, ziyaretçiden yanıtı e-postayla almak için adresini ister.',
      emailReplies: 'Ayrılan ziyaretçiye yanıtı e-postayla gönder',
      emailRepliesHelp:
        'Ziyaretçi adresini bıraktıysa ve sayfadan ayrıldıysa, temsilci yanıtları e-postayla ve sohbete dönüş bağlantısıyla gider.',
      preChatTitle: 'Sohbet öncesi form',
      preChatMode: 'Form',
      modeOff: 'Kapalı',
      modeOptional: 'İsteğe bağlı',
      modeRequired: 'Zorunlu',
      fieldName: 'Ad',
      fieldEmail: 'E-posta',
      fieldPhone: 'Telefon',
      customFields: 'Ek sorular (en fazla 3, her satıra bir tane)',
      consentTitle: 'KVKK / aydınlatma onayı',
      consentMode: 'Onay kutusu',
      policyUrl: 'Aydınlatma metninizin adresi',
      policyUrlHelp:
        'Onay kutusunun yanındaki bağlantı bu sayfayı açar. Ziyaretçinin onay zamanı konuşmaya kaydedilir.',
      csatTitle: 'Memnuniyet puanı',
      csatEnabled: 'Sohbet bitince puan iste',
      csatStyle: 'Biçim',
      styleThumbs: 'Beğendim / beğenmedim',
      styleStars: '1–5 yıldız',
      csatEmail: 'Puan vermeden ayrılana e-postayla sor',
      transcript: 'Ziyaretçi sohbet dökümünü e-postayla isteyebilsin',
      spamMode: 'Spam koruması',
      spamModeHelp:
        'Henüz yanıt almamış ziyaretçiler dakikada en fazla 3 mesaj, 5 dakikada bir bağlantılı mesaj gönderebilir. Çok bağlantılı ya da üst üste tekrarlanan mesajlar her durumda “spam” etiketi alır.'
    },
    notifications: {
      title: 'Bildirimler',
      description: 'Yeni ve yanıtlanmamış sohbetleri nasıl duyacağınızı seçin.',
      missedEmail: 'Yanıtlanmamış sohbet e-postaları',
      instant: 'Hemen (10 dakikada bir toplanır)',
      hourly: 'Saatlik özet',
      off: 'Kapalı',
      desktopTitle: 'Masaüstü bildirimleri',
      desktopHelp: 'Panel arka plandayken tarayıcı bildirimi gösterilir.',
      allow: 'Bildirimlere izin ver',
      allowed: 'Bu tarayıcıda izin verildi.',
      blocked: 'Bu tarayıcıda bildirimler engelli. Tarayıcı ayarlarından açabilirsiniz.',
      newConversation: 'Yeni konuşma',
      assigned: 'Bana atanan konuşma',
      allMessages: 'Tüm yeni mesajlar',
      sound: 'Bildirim sesi',
      activation: 'Hesap kurulumu e-postaları (ilk ay)',
      language: 'E-postaların dili',
      saved: 'Bildirim tercihleri kaydedildi.'
    },
    rating: {
      title: 'Görüşmeyi değerlendirin',
      subtitle: '{{site}} ile sohbetinizi nasıl buldunuz?',
      up: 'Memnun kaldım',
      down: 'Memnun kalmadım',
      star: '{{n}} yıldız',
      feedback: 'Eklemek istediğiniz bir şey var mı? (isteğe bağlı)',
      send: 'Gönder',
      thanks: 'Değerlendirmeniz için teşekkürler!',
      already: 'Bu sohbeti zaten değerlendirdiniz. Teşekkürler!',
      invalid: 'Bu bağlantı geçersiz ya da süresi dolmuş.',
      low: 'Düşük puan',
      label: 'Memnuniyet'
    },
    payment: {
      banner:
        'Son ödemeniz alınamadı. Planınız {{date}} tarihine kadar açık; ödeme yönteminizi güncelleyin.',
      bannerNoDate: 'Son ödemeniz alınamadı; ödeme yönteminizi güncelleyin.',
      action: 'Ödemeyi güncelle'
    },
    trial: {
      banner: 'Pro deneme sürenizin bitmesine {{count}} gün kaldı.',
      lastDay: 'Pro deneme süreniz bugün bitiyor.',
      choose: 'Planı seç',
      label: 'Ücretsiz deneme',
      billingNote:
        'Pro deneme: {{date}} tarihine kadar. Kart bilgisi istemedik; otomatik ücret alınmaz.'
    },
    errors: {
      PASSWORD_TOO_SHORT: 'Şifre en az 10 karakter olmalı.',
      PASSWORD_TOO_LONG: 'Şifre çok uzun.',
      PASSWORD_TOO_COMMON: 'Bu şifre çok yaygın; tahmin edilmesi zor bir şifre seçin.',
      PASSWORD_CONTAINS_EMAIL: 'Şifre e-posta adresinizi içermemeli.',
      PASSWORD_REQUIRED: 'Şifre gerekli.',
      PASSWORD_UNCHANGED: 'Yeni şifre mevcut şifreyle aynı olamaz.',
      EMAIL_DISPOSABLE: 'Lütfen kalıcı bir e-posta adresi kullanın.',
      EMAIL_INVALID: 'Geçerli bir e-posta adresi yazın.',
      EMAIL_UNCHANGED: 'Bu zaten sizin adresiniz.',
      CAPTCHA_FAILED: 'Güvenlik doğrulaması tamamlanamadı, lütfen tekrar deneyin.',
      MFA_CODE_INVALID: 'Kod doğru değil.',
      MFA_EXPIRED: 'Giriş süresi doldu, lütfen baştan başlayın.',
      MFA_ENFORCED: 'Kuruluşunuz iki adımlı doğrulamayı zorunlu tutuyor.',
      MFA_REQUIRED_FIRST: 'Önce kendi hesabınızda iki adımlı doğrulamayı açın.',
      TOO_MANY_ACCOUNT_CHANGES:
        'Çok fazla değişiklik denemesi yapıldı. Bir saat sonra tekrar deneyin.',
      TOO_MANY_MFA_ATTEMPTS: 'Çok fazla kod denemesi yapıldı. Biraz sonra yeniden giriş yapın.',
      INVALID_TOKEN: 'Bu bağlantı geçersiz ya da süresi dolmuş.'
    }
  },
  a11y: {
    siteSelect: 'Site',
    department: 'Departman',
    assignee: 'Atanan temsilci'
  },
  overage: {
    title: 'Plan sınırının üzerindekiler askıda',
    description:
      'Planınız {{sites}} site ve {{agents}} kişilik ekip içeriyor. Fazlası askıda: askıdaki sitelerde sohbet balonu görünmez ve panelde yalnızca okunur; askıdaki ekip üyeleri giriş yapıp okuyabilir ama yanıt yazamaz. Hiçbir veri silinmedi. Hangilerinin açık kalacağını seçin.',
    sites: 'Açık kalacak siteler ({{chosen}}/{{limit}})',
    members: 'Yanıt yazabilecek ekip ({{chosen}}/{{limit}})',
    owner: 'Hesap sahibi, her zaman açık',
    suspended: 'Askıda',
    active: 'Açık',
    save: 'Seçimi kaydet',
    saved: 'Seçiminiz kaydedildi.',
    saveError: 'Seçim kaydedilemedi.',
    upgrade: 'Ya da planınızı yükseltip hepsini açın',
    choose: 'Seçimi yap',
    ownerBanner:
      'Planınızın sınırını aşan siteler veya ekip üyeleri askıda. Hangilerinin açık kalacağını seçin.',
    seatBanner:
      'Ekibin kişi sınırı aşıldığı için hesabınız şimdilik salt okunur: konuşmaları okuyabilirsiniz ama yanıt yazamazsınız. Hesap sahibi sizi yeniden açabilir.',
    siteHint: 'Plan sınırının üzerinde: sohbet balonu gizli, ayarlar salt okunur.',
    blocked: 'Kapatıldı',
    blockedHint:
      'Kullanım şartlarına aykırı kullanım nedeniyle Support.io tarafından kapatıldı. Ayrıntı için destek ekibimize yazın.'
  },
  errors: {
    seatSuspended:
      'Hesabınız plan sınırı nedeniyle salt okunur; yanıt yazamaz ve değişiklik yapamazsınız.',
    siteSuspended:
      'Bu site plan sınırının üzerinde olduğu için askıda; okunabilir ama değiştirilemez.',
    overPlanLimit: 'Planınızın izin verdiğinden fazlasını seçtiniz.',
    siteBlocked: 'Bu site Support.io tarafından kapatıldı; açılması için destek ekibimize yazın.'
  },
  retention: {
    title: 'Konuşma saklama süresi',
    description:
      'Son mesajından bu süre geçen konuşmalar mesajları ve ekleriyle birlikte her gece kalıcı olarak silinir.',
    keep: 'Konuşmaları sakla:',
    days_one: '{{count}} gün',
    days_other: '{{count}} gün',
    years_one: '{{count}} yıl',
    years_other: '{{count}} yıl',
    default: 'varsayılan',
    fixed: 'Ücretsiz planda konuşmalar {{period}} saklanır.',
    upgrade: 'Daha uzun süre için planınızı yükseltin',
    saved: 'Saklama süresi kaydedildi.'
  },
  visitorErase: {
    button: 'Bu ziyaretçinin verilerini sil',
    title: 'Ziyaretçinin verileri silinsin mi?',
    message:
      'Bu ziyaretçinin bu sitedeki tüm konuşmaları, mesajları, gönderdiği dosyalar, ziyaretçi kaydı ve sayfa hareketleri kalıcı olarak silinir. KVKK kapsamındaki silme talepleri için kullanın. Bu işlem geri alınamaz.',
    confirm: 'Kalıcı olarak sil',
    done_one: 'Ziyaretçinin verileri silindi ({{count}} konuşma).',
    done_other: 'Ziyaretçinin verileri silindi ({{count}} konuşma).'
  },
  visitorBlocks: {
    block: 'Ziyaretçiyi engelle',
    explain:
      'Ziyaretçi bu sitede sohbet açamaz; açık penceresi hemen kapanır. Engel, ziyaretçi kimliğine ve son görüldüğü bağlantıya uygulanır.',
    period: 'Süre',
    days_one: '{{count}} gün',
    days_other: '{{count}} gün',
    reason: 'Gerekçe (isteğe bağlı, yalnızca ekibiniz görür)',
    confirm: 'Engelle',
    blocked: 'Ziyaretçi engellendi.',
    listTitle: 'Engellenen ziyaretçiler',
    empty: 'Bu sitede engellenen ziyaretçi yok.',
    noReason: 'Gerekçe belirtilmedi',
    range: '{{from}} – {{to}}',
    unblock: 'Engeli kaldır',
    unblocked: 'Engel kaldırıldı.'
  },
  savedReplies: {
    title: 'Hazır yanıtlar',
    description: 'Sık yazdığınız cevapları kaydedin; yanıt kutusunda "/" yazınca listelenir.',
    shortcut: 'Kısayol',
    titleLabel: 'Başlık',
    body: 'Metin',
    variables: 'Kullanabileceğiniz değişkenler:',
    site: 'Geçerli olduğu site',
    allSites: 'Tüm siteler',
    add: 'Ekle',
    update: 'Güncelle',
    edit: 'Düzenle',
    delete: 'Sil',
    saved: 'Hazır yanıt kaydedildi.',
    empty: 'Henüz hazır yanıt yok.',
    none: 'Eşleşen hazır yanıt yok',
    placeholder: 'Mesajınızı yazın… (hazır yanıt için /)'
  },
  audit: {
    actions: {
      LOGIN_FAILED_LOCKED: 'Hesap Geçici Olarak Kilitlendi',
      PASSWORD_CHANGED: 'Şifre Değiştirildi',
      EMAIL_CHANGE_REQUESTED: 'E-posta Değişikliği İstendi',
      EMAIL_CHANGED: 'E-posta Adresi Değişti',
      MFA_ENABLED: 'İki Adımlı Doğrulama Açıldı',
      MFA_DISABLED: 'İki Adımlı Doğrulama Kapatıldı',
      MFA_RECOVERY_USED: 'Kurtarma Koduyla Giriş',
      SESSIONS_REVOKED: 'Tüm Cihazlardan Çıkış',
      SECURITY_SETTINGS_UPDATED: 'Ekip Güvenlik Ayarı Değişti',
      VISITOR_BLOCKED: 'Ziyaretçi Engellendi',
      VISITOR_UNBLOCKED: 'Ziyaretçi Engeli Kaldırıldı',
      VISITOR_DATA_DELETED: 'Ziyaretçi Verisi Silindi',
      RETENTION_PURGE: 'Saklama Süresi Dolan Veri Silindi',
      RETENTION_SETTINGS_UPDATED: 'Saklama Süresi Değişti',
      ASSISTANT_ENABLED: 'Yapay Zekâ Asistanı Açıldı',
      ASSISTANT_KILL_SWITCH: 'Asistan Platform Genelinde Durduruldu',
      API_KEY_CREATED: 'API Anahtarı Oluşturuldu',
      API_KEY_REVOKED: 'API Anahtarı İptal Edildi',
      WEBHOOK_CREATED: 'Webhook Eklendi',
      WEBHOOK_UPDATED: 'Webhook Değişti',
      WEBHOOK_DELETED: 'Webhook Silindi',
      SITE_SUSPENDED: 'Site Askıya Alındı',
      SITE_REACTIVATED: 'Site Yeniden Açıldı',
      SEAT_SUSPENDED: 'Ekip Üyesi Askıya Alındı',
      SEAT_RESTORED: 'Ekip Üyesi Yeniden Açıldı',
      TRIAL_STARTED: 'Pro Deneme Başladı',
      TRIAL_ENDED: 'Pro Deneme Bitti',
      SAVED_REPLY_CREATED: 'Hazır Yanıt Eklendi',
      SAVED_REPLY_UPDATED: 'Hazır Yanıt Değişti',
      SAVED_REPLY_DELETED: 'Hazır Yanıt Silindi',
      CONVERSATIONS_MERGED: 'Konuşmalar Birleştirildi'
    }
  }
};
