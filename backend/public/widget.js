/*!
 * Support.io Widget Runtime
 * Universal, framework-agnostic embeddable chat widget.
 *
 * Kurulum (TEK satir, her stack icin ayni):
 *
 *   <script src="https://YOUR_HOST/widget.js" data-site-key="SITE_KEY" async></script>
 *
 * Tasarim notlari:
 *
 * - Tek dosya, bagimliliksiz. Yalnizca Socket.IO istemcisi disaridan yuklenir
 *   ve o da BIZIM sunucumuzdan (`/socket.io/socket.io.js`) gelir. Eski surum
 *   ucuncu parti bir CDN'den (cdn.socket.io) yukluyordu: musterinin CSP'si
 *   script-src'yi kisitliyorsa widget hic acilmiyordu ve musteriye baska bir
 *   alan adina guvenmesi dayatiliyordu.
 *
 * - API adresi kod icine GOMULU DEGILDIR. Script'in kendi `src`'inden turetilir
 *   (document.currentScript). Eski surumde `http://localhost:5000` sabiti vardi
 *   ve yapilandirilmadiginda widget musterinin sitesinde sessizce olu kaliyordu.
 *
 * - Tum DOM ve CSS bir Shadow Root icindedir. Host sitenin `* { box-sizing }`,
 *   `button {}`, `input {}` gibi global kurallari widget'i bozamaz; widget'in
 *   kendi CSS'i de host sayfaya sizamaz.
 *
 * - Singleton. Script iki kez eklenirse, React bileseni iki kez mount olursa
 *   veya SPA yonlendirmesi tekrar init cagirirsa ikinci bir widget OLUSMAZ.
 *
 * - SPA farkindaligi. history.pushState/replaceState/popstate dinlenir; sayfa
 *   degisimi sunucuya bildirilir ama soket ve konusma korunur.
 */
(function () {
  'use strict';

  var SDK_VERSION = '3.0.0';
  var NAMESPACE = 'SupportChat';
  var LEGACY_NAMESPACE = 'SupportIO';

  // Ayni sayfada ikinci kez calisirsa hicbir sey yapma. Bu, "widget iki kere
  // gorunuyor" siniflarinin tamamini kokten keser (cift script etiketi, SPA
  // remount, Next.js strict mode double-effect, WordPress eklenti cakismasi).
  if (window[NAMESPACE] && window[NAMESPACE].__runtime) {
    return;
  }

  // -------------------------------------------------------------------------
  // 0. Yardimcilar
  // -------------------------------------------------------------------------

  /** localStorage private mode / disabled cookies durumunda ERROR ATAR. */
  var store = {
    get: function (key) {
      try { return window.localStorage.getItem(key); } catch (e) { return memory[key] || null; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, value); } catch (e) { memory[key] = value; }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(key); } catch (e) { delete memory[key]; }
    }
  };
  var memory = {};

  function uid(prefix) {
    var rnd;
    try {
      var buf = new Uint8Array(8);
      (window.crypto || window.msCrypto).getRandomValues(buf);
      rnd = Array.prototype.map.call(buf, function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    } catch (e) {
      rnd = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    }
    return prefix + '_' + Date.now().toString(36) + '_' + rnd;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Rengin uzerine okunur metin rengi secer (WCAG luminance). */
  function readableOn(hex) {
    var c = String(hex || '').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    if (c.length !== 6) return '#FFFFFF';
    var r = parseInt(c.slice(0, 2), 16) / 255;
    var g = parseInt(c.slice(2, 4), 16) / 255;
    var b = parseInt(c.slice(4, 6), 16) / 255;
    var f = function (v) { return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    var L = 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    return L > 0.45 ? '#111827' : '#FFFFFF';
  }

  function withAlpha(hex, alpha) {
    var c = String(hex || '').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    if (c.length !== 6) return 'rgba(0,0,0,' + alpha + ')';
    return 'rgba(' + parseInt(c.slice(0, 2), 16) + ',' + parseInt(c.slice(2, 4), 16) + ',' + parseInt(c.slice(4, 6), 16) + ',' + alpha + ')';
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    var units = ['B', 'KB', 'MB'];
    var i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return Math.round((bytes / Math.pow(1024, i)) * 10) / 10 + ' ' + units[i];
  }

  // -------------------------------------------------------------------------
  // 1. Yerellestirme
  //
  // Widget'in ic metinleri paneldeki i18n'den bagimsizdir: musterinin sitesi
  // baska bir dilde olabilir. Dil sirasi: acik ayar > <html lang> > tarayici.
  // -------------------------------------------------------------------------
  var STRINGS = {
    tr: {
      launcherLabel: 'Destek sohbetini ac',
      close: 'Kapat',
      back: 'Geri',
      home: 'Ana sayfa',
      messages: 'Mesajlar',
      help: 'Yardim',
      online: 'Cevrimici',
      away: 'Kisa sure icinde donecegiz',
      offline: 'Su anda cevrimdisiyiz',
      connecting: 'Baglaniyor...',
      reconnecting: 'Yeniden baglaniyor...',
      disconnected: 'Baglanti kesildi',
      connectionLost: 'Baglanti koptu. Yeniden deneniyor...',
      connectionRestored: 'Baglanti geri geldi',
      placeholder: 'Mesajinizi yazin...',
      send: 'Gonder',
      attach: 'Dosya ekle',
      startConversation: 'Sohbet baslat',
      replyFast: 'Genelde birkac dakika icinde yanitliyoruz',
      replyOffline: 'Mesajinizi birakin, dondugumuzde yanitlayalim',
      greeting: 'Merhaba!',
      greetingSub: 'Size nasil yardimci olabiliriz?',
      searchHelp: 'Yardim konularinda ara...',
      noResults: 'Sonuc bulunamadi',
      noFaqs: 'Henuz yardim icerigi eklenmemis',
      emptyThread: 'Sohbeti baslatmak icin bir mesaj yazin',
      typing: 'yaziyor...',
      sending: 'Gonderiliyor',
      failed: 'Gonderilemedi',
      retry: 'Tekrar dene',
      fileTooLarge: 'Dosya cok buyuk. En fazla 10MB.',
      fileTypeBlocked: 'Bu dosya turu desteklenmiyor.',
      uploadFailed: 'Dosya yuklenemedi.',
      loadFailed: 'Sohbet yuklenemedi. Lutfen sayfayi yenileyin.',
      offlineNotice: 'Su anda cevrimdisiyiz. Mesajinizi birakin, en kisa surede donelim.',
      poweredBy: 'Support.io ile guclendirilmistir'
    },
    en: {
      launcherLabel: 'Open support chat',
      close: 'Close',
      back: 'Back',
      home: 'Home',
      messages: 'Messages',
      help: 'Help',
      online: 'Online',
      away: 'Back shortly',
      offline: 'We are offline right now',
      connecting: 'Connecting...',
      reconnecting: 'Reconnecting...',
      disconnected: 'Disconnected',
      connectionLost: 'Connection lost. Retrying...',
      connectionRestored: 'Back online',
      placeholder: 'Type your message...',
      send: 'Send',
      attach: 'Attach a file',
      startConversation: 'Start a conversation',
      replyFast: 'We usually reply within a few minutes',
      replyOffline: 'Leave a message and we will get back to you',
      greeting: 'Hi there!',
      greetingSub: 'How can we help you today?',
      searchHelp: 'Search help articles...',
      noResults: 'No results found',
      noFaqs: 'No help articles yet',
      emptyThread: 'Send a message to start the conversation',
      typing: 'is typing...',
      sending: 'Sending',
      failed: 'Not sent',
      retry: 'Retry',
      fileTooLarge: 'File is too large. Maximum 10MB.',
      fileTypeBlocked: 'This file type is not supported.',
      uploadFailed: 'Upload failed.',
      loadFailed: 'Could not load the chat. Please refresh the page.',
      offlineNotice: 'We are offline right now. Leave a message and we will get back to you.',
      poweredBy: 'Powered by Support.io'
    }
  };

  function pickLocale(explicit) {
    var candidates = [
      explicit,
      document.documentElement.getAttribute('lang'),
      navigator.language,
      (navigator.languages || [])[0]
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (!candidates[i]) continue;
      var code = String(candidates[i]).toLowerCase().slice(0, 2);
      if (STRINGS[code]) return code;
    }
    return 'en';
  }

  // -------------------------------------------------------------------------
  // 2. Olay yayinlayici
  // -------------------------------------------------------------------------
  function Emitter() {
    this._handlers = {};
  }
  Emitter.prototype.on = function (event, handler) {
    if (typeof handler !== 'function') return function () {};
    (this._handlers[event] = this._handlers[event] || []).push(handler);
    var self = this;
    return function () { self.off(event, handler); };
  };
  Emitter.prototype.off = function (event, handler) {
    if (!this._handlers[event]) return;
    if (!handler) { delete this._handlers[event]; return; }
    this._handlers[event] = this._handlers[event].filter(function (h) { return h !== handler; });
  };
  Emitter.prototype.emit = function (event, payload) {
    var list = (this._handlers[event] || []).slice();
    for (var i = 0; i < list.length; i++) {
      // Bir dinleyicinin hatasi digerlerini ve widget'i durdurmamali. Host
      // sitenin callback'i bizim kontrolumuzde degil.
      try { list[i](payload); } catch (e) {
        if (window.console && console.error) console.error('[SupportChat] listener error for "' + event + '"', e);
      }
    }
    var star = (this._handlers['*'] || []).slice();
    for (var j = 0; j < star.length; j++) {
      try { star[j]({ type: event, payload: payload }); } catch (e) {}
    }
  };

  // -------------------------------------------------------------------------
  // 3. Yapilandirma cozumlemesi
  // -------------------------------------------------------------------------

  // Script etiketini bul. `document.currentScript` async yuklemede de dogru
  // calisir; yine de eski tarayicilar ve bazi paketleyiciler icin yedek arama.
  function findScriptTag() {
    if (document.currentScript && document.currentScript.src) return document.currentScript;
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      var src = all[i].src || '';
      if (/\/widget(\/v\d+)?(\/widget)?\.js(\?|$)/.test(src) || all[i].hasAttribute('data-site-key')) {
        return all[i];
      }
    }
    return null;
  }

  var scriptTag = findScriptTag();

  function attr(name) {
    return scriptTag ? scriptTag.getAttribute(name) : null;
  }

  function bool(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() !== 'false' && String(value) !== '0';
  }

  function resolveConfig(overrides) {
    // Eski entegrasyonlar `window.SupportIOConfig` kullaniyordu; kirilmasin.
    var legacy = window.SupportIOConfig || {};
    var modern = window.SupportChatConfig || {};
    var o = overrides || {};

    var siteKey =
      o.siteKey || attr('data-site-key') || attr('data-widget-id') ||
      modern.siteKey || legacy.siteKey || null;

    // API adresi sirasi: acik ayar > data-api-url > script'in kendi origin'i.
    var apiUrl = o.apiUrl || attr('data-api-url') || modern.apiUrl || legacy.apiUrl || null;
    if (!apiUrl && scriptTag && scriptTag.src) {
      try { apiUrl = new URL(scriptTag.src, window.location.href).origin; } catch (e) { apiUrl = null; }
    }
    if (apiUrl) apiUrl = String(apiUrl).replace(/\/+$/, '');

    return {
      siteKey: siteKey,
      apiUrl: apiUrl,
      socketUrl: o.socketUrl || attr('data-socket-url') || modern.socketUrl || legacy.socketUrl || apiUrl,
      locale: o.locale || attr('data-locale') || modern.locale || legacy.locale || null,
      theme: o.theme || attr('data-theme') || modern.theme || null,
      position: o.position || attr('data-position') || modern.position || legacy.position || null,
      zIndex: o.zIndex || attr('data-z-index') || modern.zIndex || null,
      autoOpen: o.autoOpen !== undefined ? o.autoOpen : (attr('data-auto-open') !== null ? bool(attr('data-auto-open')) : modern.autoOpen),
      hidden: o.hidden !== undefined ? o.hidden : bool(attr('data-hidden'), false),
      user: o.user || modern.user || null,
      attributes: o.attributes || modern.attributes || null
    };
  }

  // -------------------------------------------------------------------------
  // 4. Widget
  // -------------------------------------------------------------------------

  var MAX_FILE_BYTES = 10 * 1024 * 1024;
  var ALLOWED_MIME = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  function Widget(config) {
    Emitter.call(this);

    this.config = config;
    this.locale = pickLocale(config.locale);
    this.t = STRINGS[this.locale];

    this.visitorId = store.get('sc_visitor_id');
    if (!this.visitorId) {
      this.visitorId = uid('v');
      store.set('sc_visitor_id', this.visitorId);
    }
    // Oturum id'si sekme omurludur: proaktif kurallarin "bu ziyarette" mantigi
    // buna dayanir.
    this.sessionId = uid('s');

    this.identity = null;
    this.attributes = {};

    this.remote = null;          // bootstrap yaniti
    this.faqs = [];
    this.availability = 'offline';

    this.socket = null;
    this.connection = 'idle';    // idle|connecting|connected|reconnecting|disconnected|error
    this.conversationId = null;

    this.isOpen = false;
    this.isHidden = Boolean(config.hidden);
    this.destroyed = false;
    this.view = 'home';
    this.unread = 0;

    // Mesaj tekrarini KIMLIK uzerinden onler. API yaniti ve soket olayi ayni
    // mesaji iki kez getirebiliyordu; eski surumde bu ekranda cift bubble
    // olarak goruluyordu.
    this.seen = Object.create(null);
    this.pending = Object.create(null);
    this.selectedFile = null;

    this._listeners = [];  // {target, type, handler} — destroy'da sokulur
    this._timers = [];
  }
  Widget.prototype = Object.create(Emitter.prototype);
  Widget.prototype.constructor = Widget;

  // --- yasam dongusu yardimcilari ------------------------------------------

  Widget.prototype._listen = function (target, type, handler, options) {
    target.addEventListener(type, handler, options);
    this._listeners.push({ target: target, type: type, handler: handler, options: options });
  };

  Widget.prototype._timer = function (fn, ms) {
    var id = setTimeout(fn, ms);
    this._timers.push(id);
    return id;
  };

  Widget.prototype._api = function (path) {
    return this.config.apiUrl + path;
  };

  // --- baslangic ------------------------------------------------------------

  Widget.prototype.init = async function () {
    if (!this.config.siteKey) {
      this._fail('MISSING_SITE_KEY', 'data-site-key is required on the widget script tag');
      return;
    }
    if (!this.config.apiUrl) {
      this._fail('MISSING_API_URL', 'Could not determine the API url from the script src');
      return;
    }

    var ok = await this._bootstrap();
    if (!ok) return;

    if (!this._shouldShowOnThisPage()) {
      this.isHidden = true;
    }

    this._render();
    this._connect();
    this._reportInstallation();
    this._watchNavigation();

    if (this.config.user) this.identify(this.config.user);
    if (this.config.attributes) this.setAttributes(this.config.attributes);

    var behavior = this.remote.config.behavior || {};
    var autoOpen = this.config.autoOpen !== undefined && this.config.autoOpen !== null
      ? this.config.autoOpen
      : behavior.autoOpen;
    if (autoOpen && !this.isHidden) {
      this._timer(this.open.bind(this), Number(behavior.autoOpenDelay) || 5000);
    }

    this.emit('ready', { siteKey: this.config.siteKey, locale: this.locale, version: SDK_VERSION });
  };

  Widget.prototype._fail = function (code, message) {
    this.fatal = { code: code, message: message };
    if (window.console && console.error) console.error('[SupportChat] ' + code + ': ' + message);
    this.emit('error', { code: code, message: message });
  };

  Widget.prototype._bootstrap = async function () {
    try {
      var res = await fetch(this._api('/api/widget/bootstrap?siteKey=' + encodeURIComponent(this.config.siteKey)), {
        credentials: 'omit',
        headers: { Accept: 'application/json' }
      });
      if (!res.ok) {
        var body = await res.json().catch(function () { return {}; });
        this._fail(body.code || 'WIDGET_NOT_FOUND', body.error || ('Bootstrap failed with HTTP ' + res.status));
        return false;
      }
      this.remote = await res.json();
      this.faqs = this.remote.faqs || [];
      this.availability = this.remote.availability || 'offline';
      // Sunucu bir dil onerisi vermez; ama config'te bir locale varsa o kazanir.
      if (this.config.locale) this.setLocale(this.config.locale, true);
      return true;
    } catch (error) {
      this._fail('NETWORK_ERROR', error.message);
      return false;
    }
  };

  // showOnPages / hideOnPages kurallari. Kurallar basit glob desenleridir.
  Widget.prototype._shouldShowOnThisPage = function () {
    var behavior = (this.remote && this.remote.config.behavior) || {};
    var path = window.location.pathname;
    var match = function (pattern) {
      if (!pattern) return false;
      var rx = new RegExp('^' + String(pattern)
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*') + '$');
      return rx.test(path);
    };
    var hide = behavior.hideOnPages || [];
    for (var i = 0; i < hide.length; i++) if (match(hide[i])) return false;
    var show = behavior.showOnPages || [];
    if (show.length === 0) return true;
    for (var j = 0; j < show.length; j++) if (match(show[j])) return true;
    return false;
  };

  Widget.prototype._reportInstallation = function () {
    // Panelde "Kurulum bekleniyor" rozetini kapatir. Basarisiz olursa sessiz
    // gecilir: kurulum dogrulamasi sohbetin calismasi icin gerekli degildir.
    var payload = JSON.stringify({
      siteKey: this.config.siteKey,
      url: window.location.href,
      sdkVersion: SDK_VERSION
    });
    try {
      fetch(this._api('/api/widget/installed'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        credentials: 'omit',
        keepalive: true
      }).catch(function () {});
    } catch (e) {}
  };

  // -------------------------------------------------------------------------
  // 5. SPA gezinme takibi
  //
  // React Router / Next.js / Vue Router tam sayfa yenilemez; `popstate` de
  // pushState icin tetiklenmez. History metodlari sarilir. ONEMLI: orijinal
  // metodlar saklanir ve destroy() sirasinda geri konur, aksi halde widget
  // kaldirildiktan sonra bile host sitenin router'i bizim sarmalayicimizdan
  // gecmeye devam ederdi.
  // -------------------------------------------------------------------------
  Widget.prototype._watchNavigation = function () {
    var self = this;
    var last = window.location.href;

    var announce = function () {
      if (window.location.href === last) return;
      last = window.location.href;

      var visible = self._shouldShowOnThisPage();
      if (visible === self.isHidden) {
        self.isHidden = !visible;
        self._applyVisibility();
      }
      if (self.socket && self.socket.connected) {
        self.socket.emit('visitor-page-view', { currentPage: window.location.pathname });
      }
      self.emit('navigate', { url: window.location.href, path: window.location.pathname });
    };

    this._historyPatch = {};
    ['pushState', 'replaceState'].forEach(function (method) {
      var original = window.history[method];
      self._historyPatch[method] = original;
      window.history[method] = function () {
        var result = original.apply(this, arguments);
        // Router'in kendi state guncellemesi bitsin diye bir tick beklenir.
        setTimeout(announce, 0);
        return result;
      };
    });

    this._listen(window, 'popstate', announce);
    this._listen(window, 'hashchange', announce);
  };

  // -------------------------------------------------------------------------
  // 6. Soket
  // -------------------------------------------------------------------------

  Widget.prototype._loadSocketClient = function () {
    if (window.io) return Promise.resolve(window.io);
    if (Widget._ioPromise) return Widget._ioPromise;

    var src = this.config.socketUrl + '/socket.io/socket.io.js';
    Widget._ioPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = function () {
        window.io ? resolve(window.io) : reject(new Error('socket.io client loaded but window.io is missing'));
      };
      script.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(script);
    });
    return Widget._ioPromise;
  };

  Widget.prototype._setConnection = function (state, detail) {
    if (this.connection === state) return;
    this.connection = state;
    this._renderConnection();
    this.emit('connection', { state: state, detail: detail || null });
  };

  Widget.prototype._connect = async function () {
    var self = this;
    this._setConnection('connecting');

    var io;
    try {
      io = await this._loadSocketClient();
    } catch (error) {
      this._setConnection('error', error.message);
      this._fail('SOCKET_ERROR', error.message);
      return;
    }
    if (this.destroyed) return;

    this.socket = io(this.config.socketUrl + '/widget', {
      transports: ['websocket', 'polling'],
      // Kendi baglantimizi yonetiriz; host sitenin baska bir socket.io
      // baglantisiyla paylasmayiz.
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 8000,
      timeout: 10000
    });

    this.socket.on('connect', function () {
      var wasDown = self.connection === 'reconnecting' || self.connection === 'disconnected';
      self._setConnection('connected');
      self._join();
      if (wasDown) self._notice(self.t.connectionRestored, 'ok');
    });

    this.socket.on('disconnect', function (reason) {
      // 'io client disconnect' bizim destroy()'umuzdur; kullaniciya
      // "baglanti koptu" demek yanlis olur.
      if (reason === 'io client disconnect') return;
      self._setConnection('disconnected', reason);
    });

    this.socket.io.on('reconnect_attempt', function () { self._setConnection('reconnecting'); });
    this.socket.io.on('error', function (err) { self._setConnection('error', err && err.message); });

    this.socket.on('conversation-joined', function (data) {
      if (data && data.conversation) {
        self.conversationId = data.conversation._id;
        self._renderThread(data.messages || []);
      } else {
        self.conversationId = null;
        self._renderThread([]);
        var welcome = (data && data.welcomeMessage) ||
          (self.remote.config.messages && self.remote.config.messages.welcomeMessage);
        if (welcome) {
          self._appendMessage({
            _id: 'welcome',
            senderType: 'bot',
            senderName: self.remote.config.branding.brandName,
            content: welcome,
            createdAt: new Date().toISOString()
          });
        }
        self._renderEmptyStateIfNeeded();
      }
      self.emit('conversation:ready', { conversationId: self.conversationId });
    });

    this.socket.on('new-message', function (data) {
      var message = data && data.message;
      if (!message) return;
      self._appendMessage(message);
      if (message.senderType !== 'visitor' && !self.isOpen) {
        self.unread += 1;
        self._renderBadge();
        self._playSound();
      }
      self.emit('message', { message: message });
    });

    this.socket.on('agent-typing', function () { self._showTyping(); });

    this.socket.on('error', function (data) {
      var message = (data && data.message) || 'Unknown socket error';
      self.emit('error', { code: 'SOCKET_ERROR', message: message });
      self._notice(message, 'error');
    });
  };

  Widget.prototype._join = function () {
    if (!this.socket) return;
    this.socket.emit('join-conversation', {
      siteKey: this.config.siteKey,
      visitorId: this.visitorId,
      visitorName: (this.identity && this.identity.name) || store.get('sc_visitor_name') || 'Visitor',
      visitorEmail: (this.identity && this.identity.email) || store.get('sc_visitor_email') || null,
      currentPage: window.location.pathname,
      metadata: {
        userAgent: navigator.userAgent,
        referrer: document.referrer,
        language: navigator.language,
        sessionId: this.sessionId,
        attributes: this.attributes
      }
    });
  };

  // -------------------------------------------------------------------------
  // 7. Arayuz — Shadow DOM
  // -------------------------------------------------------------------------

  Widget.prototype._css = function () {
    var c = this.remote.config;
    var colors = c.colors;
    var button = c.button;
    var win = c.window;
    var advanced = c.advanced;
    var typo = c.typography;

    var primary = colors.primary;
    var onPrimary = readableOn(primary);
    var header = colors.header || primary;
    var onHeader = readableOn(header);
    var visitorBg = colors.visitorMessageBg || primary;
    var onVisitor = readableOn(visitorBg);
    var agentBg = colors.agentMessageBg;
    var onAgent = readableOn(agentBg);

    var size = button.size === 'small' ? 52 : button.size === 'large' ? 68 : 60;
    var radius = typeof button.borderRadius === 'number' ? button.borderRadius : 50;
    var bubbleRadius = radius >= 50 ? '50%' : radius + 'px';
    var fontFamily = typo.fontFamily ||
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    var speed = advanced.animationSpeed === 'slow' ? 320 : advanced.animationSpeed === 'fast' ? 120 : 200;

    var vertical = button.position.indexOf('top') === 0 ? 'top' : 'bottom';
    var horizontal = button.position.indexOf('left') > -1 ? 'left' : 'right';

    return [
      /* Shadow root icinde bile :host'a yazmak gerekir; host sayfanin
         `div { display: ... }` gibi kurallari host elemani etkileyebilir. */
      ':host{all:initial;position:fixed;' + vertical + ':0;' + horizontal + ':0;',
      'width:auto;height:auto;z-index:' + (this.config.zIndex || advanced.zIndex || 2147483000) + ';',
      'font-family:' + fontFamily + ';color-scheme:light;}',
      '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}',
      /* SVG icin TABAN olcu.
         viewBox'i olup width/height'i olmayan bir inline <svg> kabina gore
         esnetilir: `.cta` gibi bir flex kutusunda dev bir ikona donusuyordu.
         Shadow Root icinde host sayfanin `svg { width: ... }` kurali da
         gecmedigi icin bu olcuyu burada bizim vermemiz gerekir. */
      'svg{width:18px;height:18px;flex:0 0 auto;display:block;}',
      'button{font:inherit;color:inherit;}',
      '.root{position:fixed;' + vertical + ':20px;' + horizontal + ':20px;display:flex;flex-direction:column;',
      'align-items:flex-' + (horizontal === 'right' ? 'end' : 'start') + ';gap:12px;}',
      '.root[hidden]{display:none;}',

      /* --- launcher --- */
      '.launcher{width:' + size + 'px;height:' + size + 'px;border-radius:' + bubbleRadius + ';',
      'background:' + primary + ';color:' + onPrimary + ';border:0;cursor:pointer;display:flex;',
      'align-items:center;justify-content:center;position:relative;',
      'box-shadow:' + (button.shadow === false ? 'none' : '0 8px 24px ' + withAlpha(primary, 0.32) + ',0 2px 6px rgba(0,0,0,.12)') + ';',
      'transition:transform ' + speed + 'ms cubic-bezier(.2,.8,.2,1),box-shadow ' + speed + 'ms ease;}',
      '.launcher:hover{transform:translateY(-2px) scale(1.04);}',
      '.launcher:active{transform:scale(.96);}',
      '.launcher:focus-visible{outline:3px solid ' + withAlpha(primary, 0.5) + ';outline-offset:3px;}',
      '.launcher svg{width:26px;height:26px;}',
      '.launcher .close-icon{display:none;}',
      '.root.open .launcher .open-icon{display:none;}',
      '.root.open .launcher .close-icon{display:block;}',
      '.badge{position:absolute;top:-2px;' + horizontal + ':-2px;min-width:20px;height:20px;padding:0 6px;',
      'border-radius:10px;background:#EF4444;color:#fff;font-size:11px;font-weight:700;line-height:20px;',
      'text-align:center;box-shadow:0 0 0 2px #fff;}',
      '.badge[hidden]{display:none;}',

      /* --- panel --- */
      '.panel{width:' + win.width + 'px;max-width:calc(100vw - 40px);height:' + win.height + 'px;',
      'max-height:calc(100vh - 120px);background:' + colors.background + ';color:' + colors.text + ';',
      'border-radius:' + win.borderRadius + 'px;overflow:hidden;display:none;flex-direction:column;',
      'box-shadow:0 24px 64px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.08);',
      'border:1px solid ' + colors.border + ';',
      'opacity:0;transform:translateY(12px) scale(.98);',
      'transition:opacity ' + speed + 'ms ease,transform ' + speed + 'ms cubic-bezier(.2,.8,.2,1);}',
      '.root.open .panel{display:flex;opacity:1;transform:none;}',

      /* --- header --- */
      '.header{background:' + header + ';color:' + onHeader + ';padding:16px 18px;display:flex;',
      'align-items:center;gap:12px;min-height:' + win.headerHeight + 'px;flex:0 0 auto;}',
      '.header-logo{width:' + c.branding.logoWidth + 'px;height:' + c.branding.logoHeight + 'px;',
      'object-fit:contain;border-radius:8px;background:rgba(255,255,255,.14);flex:0 0 auto;}',
      '.header-text{flex:1;min-width:0;}',
      '.header-title{font-size:15px;font-weight:650;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.header-status{font-size:12px;opacity:.85;display:flex;align-items:center;gap:6px;margin-top:2px;}',
      '.dot{width:7px;height:7px;border-radius:50%;background:#9CA3AF;flex:0 0 auto;}',
      '.dot.online{background:#22C55E;}.dot.away{background:#F59E0B;}',
      '.dot.pulse{animation:pulse 1.4s ease-in-out infinite;}',
      '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}',
      '.icon-btn{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:inherit;',
      'cursor:pointer;display:flex;align-items:center;justify-content:center;flex:0 0 auto;',
      'transition:background 140ms ease;}',
      '.icon-btn:hover{background:rgba(255,255,255,.16);}',
      '.icon-btn:focus-visible{outline:2px solid currentColor;outline-offset:2px;}',
      '.icon-btn svg{width:18px;height:18px;}',

      /* --- banner --- */
      '.banner{padding:8px 16px;font-size:12px;text-align:center;flex:0 0 auto;display:none;}',
      '.banner.show{display:block;}',
      '.banner.warn{background:#FEF3C7;color:#92400E;}',
      '.banner.error{background:#FEE2E2;color:#991B1B;}',
      '.banner.ok{background:#DCFCE7;color:#166534;}',

      /* --- views --- */
      '.body{flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;}',
      '.view{display:none;flex:1;min-height:0;flex-direction:column;overflow:hidden;}',
      '.view.active{display:flex;}',

      /* --- home ---
         Duzen: karsilama blogu, ardindan tiklanabilir bir "eylem karti" ve
         altinda yardim baslıklari. Onceki surumde burada tek bir dev buton
         vardi; ikonun olcusu yoktu ve butonu tamamen dolduruyordu. */
      '.home{overflow-y:auto;padding:26px 20px 20px;}',
      '.home h2{font-size:23px;font-weight:680;letter-spacing:-.02em;line-height:1.25;}',
      '.home p.sub{margin-top:7px;font-size:14.5px;color:' + colors.textSecondary + ';line-height:1.55;}',

      '.card{margin-top:22px;width:100%;padding:14px;border:1px solid ' + colors.border + ';',
      'border-radius:14px;background:' + colors.background + ';cursor:pointer;text-align:left;',
      'display:flex;align-items:center;gap:12px;',
      'transition:border-color 160ms ease,box-shadow 160ms ease,transform 160ms ease;}',
      '.card:hover{border-color:' + withAlpha(primary, 0.45) + ';box-shadow:0 6px 18px ' + withAlpha(primary, 0.13) + ';transform:translateY(-1px);}',
      '.card:active{transform:translateY(0);}',
      '.card:focus-visible{outline:2px solid ' + primary + ';outline-offset:2px;}',
      '.card-icon{width:38px;height:38px;border-radius:11px;background:' + primary + ';color:' + onPrimary + ';',
      'display:flex;align-items:center;justify-content:center;flex:0 0 auto;}',
      '.card-icon svg{width:19px;height:19px;}',
      '.card-body{flex:1;min-width:0;}',
      '.card-title{font-size:14.5px;font-weight:600;line-height:1.3;}',
      '.card-sub{margin-top:2px;font-size:12.5px;color:' + colors.textSecondary + ';line-height:1.4;}',
      '.card-go{flex:0 0 auto;color:' + colors.textSecondary + ';opacity:.55;}',
      '.card-go svg{width:16px;height:16px;transform:rotate(-90deg);}',

      '.faq-preview{margin-top:22px;}',
      '.faq-preview h3{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.07em;',
      'color:' + colors.textSecondary + ';margin-bottom:8px;padding:0 2px;}',
      '.faq-preview .faq-q{font-size:13.5px;padding:11px 12px;}',
      '.faq-preview .faq-q svg{width:15px;height:15px;transform:rotate(-90deg);}',

      /* faq */
      '.help{overflow:hidden;}',
      '.search{padding:14px 16px;border-bottom:1px solid ' + colors.border + ';flex:0 0 auto;}',
      '.search input{width:100%;padding:10px 12px;border:1px solid ' + colors.border + ';border-radius:10px;',
      'font-size:14px;font-family:inherit;background:' + colors.background + ';color:' + colors.text + ';outline:none;}',
      '.search input:focus{border-color:' + primary + ';box-shadow:0 0 0 3px ' + withAlpha(primary, 0.16) + ';}',
      '.faq-list{flex:1;overflow-y:auto;padding:8px;}',
      '.faq{border-radius:10px;overflow:hidden;}',
      '.faq + .faq{margin-top:2px;}',
      '.faq-q{width:100%;text-align:left;padding:12px 14px;border:0;background:transparent;cursor:pointer;',
      'font-size:14px;font-weight:550;font-family:inherit;color:' + colors.text + ';display:flex;',
      'align-items:center;justify-content:space-between;gap:10px;border-radius:10px;transition:background 140ms ease;}',
      '.faq-q:hover{background:' + withAlpha(colors.textSecondary, 0.08) + ';}',
      '.faq-q svg{width:16px;height:16px;flex:0 0 auto;opacity:.5;transition:transform 180ms ease;}',
      '.faq.open .faq-q svg{transform:rotate(180deg);}',
      '.faq-a{display:none;padding:0 14px 14px;font-size:13.5px;line-height:1.6;color:' + colors.textSecondary + ';}',
      '.faq.open .faq-a{display:block;}',

      /* thread */
      '.messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;',
      'scroll-behavior:smooth;overscroll-behavior:contain;}',
      '.msg{max-width:82%;display:flex;flex-direction:column;gap:3px;}',
      '.msg.visitor{align-self:flex-end;align-items:flex-end;}',
      '.msg.agent,.msg.bot,.msg.system{align-self:flex-start;}',
      '.msg-sender{font-size:11px;font-weight:600;color:' + colors.textSecondary + ';padding:0 4px;}',
      '.bubble{padding:10px 13px;border-radius:' + c.messages.messageBubbleRadius + 'px;font-size:14px;',
      'line-height:1.5;word-break:break-word;white-space:pre-wrap;}',
      '.msg.visitor .bubble{background:' + visitorBg + ';color:' + onVisitor + ';border-bottom-right-radius:5px;}',
      '.msg.agent .bubble,.msg.bot .bubble{background:' + agentBg + ';color:' + onAgent + ';border-bottom-left-radius:5px;}',
      '.msg.system .bubble{background:transparent;border:1px dashed ' + colors.border + ';color:' + colors.textSecondary + ';font-size:13px;}',
      '.meta{font-size:10.5px;color:' + colors.textSecondary + ';padding:0 4px;display:flex;align-items:center;gap:5px;}',
      '.msg.pending{opacity:.62;}',
      '.msg.failed .bubble{background:#FEE2E2;color:#991B1B;}',
      '.retry{border:0;background:none;color:#DC2626;font-size:10.5px;font-weight:600;cursor:pointer;',
      'text-decoration:underline;font-family:inherit;padding:0;}',
      '.attachment{margin-top:8px;display:block;}',
      '.attachment img{max-width:100%;border-radius:10px;display:block;cursor:pointer;}',
      '.file{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:10px;',
      'background:' + withAlpha(colors.textSecondary, 0.1) + ';text-decoration:none;color:inherit;}',
      '.file svg{width:18px;height:18px;flex:0 0 auto;opacity:.7;}',
      '.file-name{font-size:12.5px;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.file-size{font-size:10.5px;opacity:.7;}',
      '.typing{align-self:flex-start;display:none;gap:4px;padding:11px 14px;border-radius:14px;',
      'background:' + agentBg + ';}',
      '.typing.show{display:flex;}',
      '.typing i{width:6px;height:6px;border-radius:50%;background:' + colors.textSecondary + ';',
      'animation:bounce 1.2s infinite;}',
      '.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}',
      '@keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}',
      '.empty{margin:auto;text-align:center;color:' + colors.textSecondary + ';font-size:13.5px;padding:24px;line-height:1.6;}',

      /* composer */
      '.composer{flex:0 0 auto;border-top:1px solid ' + colors.border + ';padding:10px 12px;',
      'display:flex;align-items:flex-end;gap:8px;background:' + colors.background + ';',
      'padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));}',
      '.composer textarea{flex:1;min-width:0;resize:none;border:1px solid ' + colors.border + ';',
      'border-radius:12px;padding:10px 12px;font-size:14px;font-family:inherit;line-height:1.45;',
      'max-height:120px;background:' + colors.background + ';color:' + colors.text + ';outline:none;}',
      '.composer textarea:focus{border-color:' + primary + ';box-shadow:0 0 0 3px ' + withAlpha(primary, 0.16) + ';}',
      '.composer textarea::placeholder{color:' + colors.textSecondary + ';opacity:.75;}',
      '.send{width:38px;height:38px;flex:0 0 auto;border:0;border-radius:11px;background:' + primary + ';',
      'color:' + onPrimary + ';cursor:pointer;display:flex;align-items:center;justify-content:center;',
      'transition:filter 140ms ease,transform 140ms ease;}',
      '.send:hover:not(:disabled){filter:brightness(1.08);}',
      '.send:active:not(:disabled){transform:scale(.94);}',
      '.send:disabled{opacity:.4;cursor:not-allowed;}',
      '.send svg{width:17px;height:17px;}',
      '.file-chip{display:none;align-items:center;gap:8px;margin:0 12px 8px;padding:8px 10px;',
      'border-radius:10px;background:' + withAlpha(primary, 0.09) + ';font-size:12px;}',
      '.file-chip.show{display:flex;}',
      '.file-chip button{margin-left:auto;border:0;background:none;cursor:pointer;color:inherit;',
      'opacity:.6;display:flex;padding:2px;}',
      '.file-chip button:hover{opacity:1;}',

      /* nav */
      '.nav{flex:0 0 auto;display:flex;border-top:1px solid ' + colors.border + ';',
      'padding-bottom:env(safe-area-inset-bottom,0px);}',
      '.nav button{flex:1;padding:10px 4px;border:0;background:none;cursor:pointer;font-family:inherit;',
      'font-size:11px;font-weight:550;color:' + colors.textSecondary + ';display:flex;flex-direction:column;',
      'align-items:center;gap:3px;transition:color 140ms ease;}',
      '.nav button svg{width:19px;height:19px;}',
      '.nav button.active{color:' + primary + ';}',
      '.nav button:focus-visible{outline:2px solid ' + primary + ';outline-offset:-2px;}',

      '.footer{flex:0 0 auto;padding:7px;text-align:center;font-size:10.5px;color:' + colors.textSecondary + ';',
      'opacity:.7;border-top:1px solid ' + colors.border + ';}',

      /* --- mobil ---
         100vh mobil tarayicilarda adres cubugunun ALTINA tasar. 100dvh dogru
         olcudur; desteklenmeyen tarayicilar icin once 100vh yazilir. */
      '@media (max-width:480px){',
      '.root{' + vertical + ':0;' + horizontal + ':0;left:0;right:0;bottom:0;align-items:flex-end;padding:16px;gap:0;}',
      '.root.open{padding:0;}',
      '.root.open .launcher{display:none;}',
      '.panel{position:fixed;inset:0;width:100%;max-width:none;height:100vh;height:100dvh;',
      'max-height:none;border-radius:0;border:0;}',
      '.header{padding-top:calc(16px + env(safe-area-inset-top,0px));}',
      '}',
      '@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms !important;transition-duration:.01ms !important;}}'
    ].join('');
  };

  var ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    minimize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>',
    paperclip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
    message: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'
  };

  Widget.prototype._render = function () {
    var self = this;
    var c = this.remote.config;
    var t = this.t;

    // Host elemani. Shadow DOM host sayfanin CSS'inden yalitir; `all:initial`
    // ile birlikte kalitim yollarinin ikisi de kapanir.
    var host = document.createElement('div');
    host.id = 'support-chat-widget';
    host.setAttribute('data-sdk-version', SDK_VERSION);

    var root;
    if (host.attachShadow) {
      root = host.attachShadow({ mode: 'open' });
    } else {
      // Shadow DOM yoksa (cok eski tarayici) widget yine calisir; yalitim
      // sinif adlarina duser. Sessizce bozulmaktansa zayif yalitim iyidir.
      root = host;
    }
    this.host = host;
    this.root = root;

    var style = document.createElement('style');
    style.textContent = this._css();
    root.appendChild(style);

    if (c.advanced.customCSS) {
      var custom = document.createElement('style');
      custom.textContent = String(c.advanced.customCSS);
      root.appendChild(custom);
    }

    var brand = escapeHtml(c.branding.brandName);
    var logo = c.branding.logo
      ? '<img class="header-logo" src="' + escapeHtml(c.branding.logo) + '" alt="" />'
      : '';
    var showBrand = c.branding.showBrandName !== false;

    var wrap = document.createElement('div');
    wrap.className = 'root';
    wrap.innerHTML = [
      '<div class="panel" role="dialog" aria-modal="false" aria-label="' + escapeHtml(brand) + '" tabindex="-1">',
        '<div class="header">',
          logo,
          '<div class="header-text">',
            showBrand ? '<div class="header-title">' + brand + '</div>' : '',
            '<div class="header-status"><span class="dot"></span><span class="status-text"></span></div>',
          '</div>',
          c.window.showCloseButton !== false
            ? '<button class="icon-btn js-close" aria-label="' + escapeHtml(t.close) + '">' + ICONS.minimize + '</button>'
            : '',
        '</div>',
        '<div class="banner js-banner" role="status" aria-live="polite"></div>',
        '<div class="body">',

          '<section class="view home js-view-home active" aria-label="' + escapeHtml(t.home) + '">',
            '<h2>' + escapeHtml(t.greeting) + '</h2>',
            '<p class="sub">' + escapeHtml(t.greetingSub) + '</p>',
            '<button class="card js-start">',
              '<span class="card-icon">' + ICONS.message + '</span>',
              '<span class="card-body">',
                '<span class="card-title">' + escapeHtml(t.startConversation) + '</span>',
                '<span class="card-sub js-reply-time"></span>',
              '</span>',
              '<span class="card-go">' + ICONS.chevron + '</span>',
            '</button>',
            '<div class="faq-preview js-faq-preview"></div>',
          '</section>',

          '<section class="view js-view-messages" aria-label="' + escapeHtml(t.messages) + '">',
            '<div class="messages js-messages" role="log" aria-live="polite"></div>',
            '<div class="typing js-typing" aria-hidden="true"><i></i><i></i><i></i></div>',
            '<div class="file-chip js-file-chip">',
              ICONS.file,
              '<span class="file-name js-file-name"></span>',
              '<span class="file-size js-file-size"></span>',
              '<button class="js-file-clear" aria-label="' + escapeHtml(t.close) + '">' + ICONS.close + '</button>',
            '</div>',
            '<div class="composer">',
              '<button class="icon-btn js-attach" aria-label="' + escapeHtml(t.attach) + '" style="color:' + c.colors.textSecondary + '">' + ICONS.paperclip + '</button>',
              '<input type="file" class="js-file-input" hidden />',
              '<textarea class="js-input" rows="1" aria-label="' + escapeHtml(t.placeholder) + '" placeholder="' + escapeHtml(c.messages.placeholderText || t.placeholder) + '"></textarea>',
              '<button class="send js-send" aria-label="' + escapeHtml(t.send) + '" disabled>' + ICONS.send + '</button>',
            '</div>',
          '</section>',

          '<section class="view help js-view-help" aria-label="' + escapeHtml(t.help) + '">',
            '<div class="search"><input type="search" class="js-search" placeholder="' + escapeHtml(t.searchHelp) + '" aria-label="' + escapeHtml(t.searchHelp) + '" /></div>',
            '<div class="faq-list js-faq-list"></div>',
          '</section>',

        '</div>',
        '<nav class="nav" aria-label="' + escapeHtml(brand) + '">',
          '<button class="js-nav-home active" data-view="home">' + ICONS.home + '<span>' + escapeHtml(t.home) + '</span></button>',
          '<button class="js-nav-messages" data-view="messages">' + ICONS.message + '<span>' + escapeHtml(t.messages) + '</span></button>',
          this.faqs.length ? '<button class="js-nav-help" data-view="help">' + ICONS.help + '<span>' + escapeHtml(t.help) + '</span></button>' : '',
        '</nav>',
      '</div>',
      '<button class="launcher js-launcher" aria-label="' + escapeHtml(t.launcherLabel) + '" aria-expanded="false">',
        '<span class="open-icon">' + ICONS.chat + '</span>',
        '<span class="close-icon">' + ICONS.close + '</span>',
        '<span class="badge" hidden>0</span>',
      '</button>'
    ].join('');

    root.appendChild(wrap);
    document.body.appendChild(host);

    var q = function (sel) { return wrap.querySelector(sel); };
    this.el = {
      wrap: wrap,
      panel: q('.panel'),
      launcher: q('.js-launcher'),
      badge: q('.badge'),
      banner: q('.js-banner'),
      statusDot: q('.dot'),
      statusText: q('.status-text'),
      messages: q('.js-messages'),
      typing: q('.js-typing'),
      input: q('.js-input'),
      send: q('.js-send'),
      attach: q('.js-attach'),
      fileInput: q('.js-file-input'),
      fileChip: q('.js-file-chip'),
      fileName: q('.js-file-name'),
      fileSize: q('.js-file-size'),
      search: q('.js-search'),
      faqList: q('.js-faq-list'),
      faqPreview: q('.js-faq-preview'),
      replyTime: q('.js-reply-time'),
      views: {
        home: q('.js-view-home'),
        messages: q('.js-view-messages'),
        help: q('.js-view-help')
      },
      nav: wrap.querySelectorAll('.nav button')
    };

    // --- olay baglamalari ---
    this._listen(this.el.launcher, 'click', function () { self.toggle(); });
    var closeBtn = q('.js-close');
    if (closeBtn) this._listen(closeBtn, 'click', function () { self.close(); });
    this._listen(q('.js-start'), 'click', function () { self._setView('messages'); self.el.input.focus(); });

    for (var i = 0; i < this.el.nav.length; i++) {
      this._listen(this.el.nav[i], 'click', function (e) {
        self._setView(e.currentTarget.getAttribute('data-view'));
      });
    }

    this._listen(this.el.input, 'input', function () {
      var el = self.el.input;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
      self.el.send.disabled = !el.value.trim() && !self.selectedFile;
      self._emitTyping();
    });

    this._listen(this.el.input, 'keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        self.sendMessage();
      }
    });

    this._listen(this.el.send, 'click', function () { self.sendMessage(); });
    this._listen(this.el.attach, 'click', function () { self.el.fileInput.click(); });
    this._listen(this.el.fileInput, 'change', function (e) { self._pickFile(e.target.files[0]); });
    this._listen(q('.js-file-clear'), 'click', function () { self._clearFile(); });

    if (this.el.search) {
      this._listen(this.el.search, 'input', function (e) { self._renderFaqs(e.target.value); });
    }

    // Esc ile kapat — dialog davranisinin beklenen parcasi.
    this._listen(document, 'keydown', function (e) {
      if (e.key === 'Escape' && self.isOpen) { self.close(); self.el.launcher.focus(); }
    });

    this._renderFaqs('');
    this._renderFaqPreview();
    this._renderConnection();
    this._applyVisibility();
  };

  Widget.prototype._applyVisibility = function () {
    if (!this.el) return;
    this.el.wrap.hidden = this.isHidden;
  };

  Widget.prototype._setView = function (view) {
    if (!this.el || !this.el.views[view]) return;
    this.view = view;
    for (var key in this.el.views) {
      if (this.el.views[key]) this.el.views[key].classList.toggle('active', key === view);
    }
    for (var i = 0; i < this.el.nav.length; i++) {
      var btn = this.el.nav[i];
      btn.classList.toggle('active', btn.getAttribute('data-view') === view);
    }
    if (view === 'messages') {
      this.unread = 0;
      this._renderBadge();
      this._scrollToEnd();
    }
  };

  Widget.prototype._renderConnection = function () {
    if (!this.el) return;
    var t = this.t;
    var state = this.connection;
    var dot = this.el.statusDot;
    var text = this.el.statusText;

    dot.className = 'dot';
    if (state === 'connecting' || state === 'reconnecting') {
      dot.classList.add('pulse');
      text.textContent = state === 'connecting' ? t.connecting : t.reconnecting;
    } else if (state === 'disconnected' || state === 'error') {
      text.textContent = t.disconnected;
    } else if (state === 'connected') {
      dot.classList.add(this.availability === 'online' ? 'online' : this.availability === 'away' ? 'away' : '');
      text.textContent = this.availability === 'online' ? t.online
        : this.availability === 'away' ? t.away : t.offline;
    } else {
      text.textContent = '';
    }

    // Ana ekrandaki eylem kartinin alt metni de uygunluga gore degisir:
    // cevrimdisi bir ekip icin "birkac dakika icinde yanitliyoruz" yazmak
    // ziyaretciye yanlis beklenti verir.
    if (this.el.replyTime) {
      this.el.replyTime.textContent = this.availability === 'offline' ? t.replyOffline : t.replyFast;
    }

    // Bant yalnizca gercek bir kopma varken gorunur; her yeniden baglanma
    // denemesinde yanip sonen bir uyari dikkat dagitir.
    if (state === 'disconnected' || state === 'error') {
      this._banner(t.connectionLost, 'error', 0);
    } else if (state === 'connected') {
      this._hideBanner();
    }
  };

  Widget.prototype._banner = function (message, kind, autoHideMs) {
    if (!this.el) return;
    var b = this.el.banner;
    b.textContent = message;
    b.className = 'banner show ' + (kind || 'warn');
    if (this._bannerTimer) clearTimeout(this._bannerTimer);
    if (autoHideMs !== 0) {
      var self = this;
      this._bannerTimer = setTimeout(function () { self._hideBanner(); }, autoHideMs || 4000);
    }
  };

  Widget.prototype._hideBanner = function () {
    if (!this.el) return;
    this.el.banner.className = 'banner';
  };

  Widget.prototype._notice = function (message, kind) {
    this._banner(message, kind, 3500);
  };

  Widget.prototype._renderBadge = function () {
    if (!this.el) return;
    var behavior = this.remote.config.behavior || {};
    var show = behavior.showUnreadBadge !== false && this.unread > 0 && !this.isOpen;
    this.el.badge.hidden = !show;
    this.el.badge.textContent = this.unread > 99 ? '99+' : String(this.unread);
    this.emit('unread', { count: this.unread });
  };

  Widget.prototype._playSound = function () {
    var behavior = this.remote.config.behavior || {};
    if (behavior.enableSound === false) return;
    // Harici bir ses dosyasi indirmek yerine WebAudio ile kisa bir ton uretilir:
    // ek istek yok, CORS yok, CSP media-src sorunu yok.
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this._audio = this._audio || new Ctx();
      var ctx = this._audio;
      if (ctx.state === 'suspended') return;   // kullanici henuz etkilesmedi
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.24);
    } catch (e) {}
  };

  // --- FAQ ------------------------------------------------------------------

  Widget.prototype._renderFaqPreview = function () {
    if (!this.el || !this.faqs.length) return;
    var top = this.faqs.slice(0, 3);
    var self = this;
    this.el.faqPreview.innerHTML =
      '<h3>' + escapeHtml(this.t.help) + '</h3>' +
      top.map(function (f) {
        return '<div class="faq"><button class="faq-q" data-id="' + escapeHtml(f.id) + '">' +
          '<span>' + escapeHtml(f.question) + '</span>' + ICONS.chevron + '</button></div>';
      }).join('');
    var buttons = this.el.faqPreview.querySelectorAll('.faq-q');
    for (var i = 0; i < buttons.length; i++) {
      this._listen(buttons[i], 'click', function () {
        self._setView('help');
      });
    }
  };

  Widget.prototype._renderFaqs = function (term) {
    if (!this.el || !this.el.faqList) return;
    var self = this;
    var query = String(term || '').trim().toLowerCase();
    var list = query
      ? this.faqs.filter(function (f) {
          return (f.question + ' ' + f.answer).toLowerCase().indexOf(query) > -1;
        })
      : this.faqs;

    if (!list.length) {
      this.el.faqList.innerHTML = '<div class="empty">' +
        escapeHtml(this.faqs.length ? this.t.noResults : this.t.noFaqs) + '</div>';
      return;
    }

    this.el.faqList.innerHTML = list.map(function (f) {
      return '<div class="faq">' +
        '<button class="faq-q"><span>' + escapeHtml(f.question) + '</span>' + ICONS.chevron + '</button>' +
        '<div class="faq-a">' + escapeHtml(f.answer) + '</div>' +
        '</div>';
    }).join('');

    var buttons = this.el.faqList.querySelectorAll('.faq-q');
    for (var i = 0; i < buttons.length; i++) {
      this._listen(buttons[i], 'click', function (e) {
        var faq = e.currentTarget.parentNode;
        var wasOpen = faq.classList.contains('open');
        var all = self.el.faqList.querySelectorAll('.faq');
        for (var k = 0; k < all.length; k++) all[k].classList.remove('open');
        if (!wasOpen) faq.classList.add('open');
      });
    }
  };

  // --- mesajlar -------------------------------------------------------------

  Widget.prototype._renderThread = function (messages) {
    if (!this.el) return;
    this.el.messages.innerHTML = '';
    this.seen = Object.create(null);
    for (var i = 0; i < messages.length; i++) this._appendMessage(messages[i], true);
    this._renderEmptyStateIfNeeded();
    this._scrollToEnd();
  };

  Widget.prototype._renderEmptyStateIfNeeded = function () {
    if (!this.el) return;
    if (this.el.messages.children.length === 0) {
      var notice = this.availability === 'offline' ? this.t.offlineNotice : this.t.emptyThread;
      this.el.messages.innerHTML = '<div class="empty">' + escapeHtml(notice) + '</div>';
    }
  };

  Widget.prototype._appendMessage = function (message, bulk) {
    if (!this.el) return;
    var id = String(message._id || message.id || '');

    // Ayni mesaj hem POST yanitindan hem soket olayindan gelebilir.
    if (id && this.seen[id]) return;
    if (id) this.seen[id] = true;

    // Iyimser gonderilen mesajin sunucu karsiligi geldiginde yerel kopyayi
    // degistir; yoksa ayni mesaj iki kere gorunur.
    var clientId = message.clientMessageId;
    if (clientId && this.pending[clientId]) {
      var placeholder = this.pending[clientId];
      delete this.pending[clientId];
      placeholder.node.classList.remove('pending');
      placeholder.node.querySelector('.meta').textContent = this._time(message.createdAt);
      return;
    }

    var emptyState = this.el.messages.querySelector('.empty');
    if (emptyState) emptyState.remove();

    var node = this._messageNode(message);
    this.el.messages.appendChild(node);
    if (!bulk) this._scrollToEnd();
    return node;
  };

  Widget.prototype._time = function (value) {
    try {
      return new Date(value).toLocaleTimeString(this.locale === 'tr' ? 'tr-TR' : 'en-US', {
        hour: '2-digit', minute: '2-digit'
      });
    } catch (e) { return ''; }
  };

  Widget.prototype._messageNode = function (message) {
    var c = this.remote.config;
    var type = message.senderType || 'agent';
    var node = document.createElement('div');
    node.className = 'msg ' + type;

    var parts = [];
    if (type !== 'visitor' && c.messages.showAvatars !== false && message.senderName) {
      parts.push('<div class="msg-sender">' + escapeHtml(message.senderName) + '</div>');
    }

    var attachment = '';
    var file = message.fileData;
    if (file && file.url) {
      var url = /^https?:/i.test(file.url) ? file.url : this.config.apiUrl + file.url;
      if (message.messageType === 'image') {
        attachment = '<span class="attachment"><a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' +
          '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(file.originalName || '') + '" /></a></span>';
      } else {
        attachment = '<span class="attachment"><a class="file" href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' +
          ICONS.file +
          '<span><span class="file-name">' + escapeHtml(file.originalName || 'file') + '</span>' +
          '<span class="file-size"> ' + escapeHtml(formatBytes(file.size)) + '</span></span></a></span>';
      }
    }

    parts.push('<div class="bubble">' + escapeHtml(message.content || '') + attachment + '</div>');
    if (c.messages.showTimestamps !== false) {
      parts.push('<div class="meta">' + escapeHtml(this._time(message.createdAt || Date.now())) + '</div>');
    } else {
      parts.push('<div class="meta"></div>');
    }

    node.innerHTML = parts.join('');
    return node;
  };

  Widget.prototype._scrollToEnd = function () {
    if (!this.el) return;
    var box = this.el.messages;
    // rAF: DOM guncellemesi tamamlanmadan scrollHeight eski degeri verir.
    requestAnimationFrame(function () { box.scrollTop = box.scrollHeight; });
  };

  Widget.prototype._showTyping = function () {
    if (!this.el) return;
    this.el.typing.classList.add('show');
    this._scrollToEnd();
    if (this._typingTimer) clearTimeout(this._typingTimer);
    var self = this;
    this._typingTimer = setTimeout(function () {
      if (self.el) self.el.typing.classList.remove('show');
    }, 3000);
  };

  Widget.prototype._emitTyping = function () {
    if (!this.socket || !this.socket.connected || !this.conversationId) return;
    // Her tusa basista emit etmek gereksiz trafik uretir; saniyede bir yeter.
    var now = Date.now();
    if (this._lastTypingAt && now - this._lastTypingAt < 1000) return;
    this._lastTypingAt = now;
    this.socket.emit('typing');
  };

  Widget.prototype._pickFile = function (file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { this._notice(this.t.fileTooLarge, 'error'); return; }
    if (ALLOWED_MIME.indexOf(file.type) === -1) { this._notice(this.t.fileTypeBlocked, 'error'); return; }
    this.selectedFile = file;
    this.el.fileName.textContent = file.name;
    this.el.fileSize.textContent = formatBytes(file.size);
    this.el.fileChip.classList.add('show');
    this.el.send.disabled = false;
  };

  Widget.prototype._clearFile = function () {
    this.selectedFile = null;
    if (!this.el) return;
    this.el.fileInput.value = '';
    this.el.fileChip.classList.remove('show');
    this.el.send.disabled = !this.el.input.value.trim();
  };

  Widget.prototype.sendMessage = async function () {
    if (this.fatal) { this._notice(this.fatal.message, 'error'); return; }
    var content = this.el.input.value.trim();
    if (!content && !this.selectedFile) return;
    if (!this.socket || !this.socket.connected) { this._notice(this.t.connectionLost, 'error'); return; }

    var clientMessageId = uid('c');
    var file = this.selectedFile;

    // Iyimser gorunum: kullanici gonderdigini ANINDA gorur. Sunucu onayi
    // gelince "pending" kalkar, hata olursa "failed" + tekrar dene cikar.
    var localMessage = {
      _id: clientMessageId,
      clientMessageId: clientMessageId,
      senderType: 'visitor',
      content: content || (file ? file.name : ''),
      createdAt: new Date().toISOString()
    };
    var node = this._appendMessage(localMessage);
    if (node) {
      node.classList.add('pending');
      node.querySelector('.meta').textContent = this.t.sending;
      this.pending[clientMessageId] = { node: node, content: content, file: file };
    }

    this.el.input.value = '';
    this.el.input.style.height = 'auto';
    this.el.send.disabled = true;
    this._clearFile();

    try {
      var payload = {
        content: content,
        senderName: (this.identity && this.identity.name) || store.get('sc_visitor_name') || 'Visitor',
        clientMessageId: clientMessageId
      };

      if (file) {
        var uploaded = await this._upload(file);
        payload.messageType = file.type.indexOf('image/') === 0 ? 'image' : 'file';
        payload.fileData = uploaded;
        if (!payload.content) payload.content = file.name;
      }

      this.socket.emit('send-message', payload);
      this.emit('message:sent', { content: payload.content, clientMessageId: clientMessageId });

      // Sunucu 12 saniyede yankilamazsa gonderim basarisiz sayilir. Sessizce
      // "gonderiliyor" durumunda asili kalmak en kotu sonuctur.
      var self = this;
      this._timer(function () {
        var still = self.pending[clientMessageId];
        if (!still) return;
        delete self.pending[clientMessageId];
        self._markFailed(still, clientMessageId);
      }, 12000);
    } catch (error) {
      var entry = this.pending[clientMessageId];
      delete this.pending[clientMessageId];
      if (entry) this._markFailed(entry, clientMessageId);
      this._notice(this.t.uploadFailed, 'error');
      this.emit('error', { code: 'SEND_FAILED', message: error.message });
    }
  };

  Widget.prototype._markFailed = function (entry, clientMessageId) {
    var self = this;
    entry.node.classList.remove('pending');
    entry.node.classList.add('failed');
    var meta = entry.node.querySelector('.meta');
    meta.innerHTML = escapeHtml(this.t.failed) + ' <button class="retry">' + escapeHtml(this.t.retry) + '</button>';
    this._listen(meta.querySelector('.retry'), 'click', function () {
      entry.node.remove();
      delete self.seen[clientMessageId];
      self.el.input.value = entry.content;
      self.selectedFile = entry.file || null;
      self.el.send.disabled = false;
      self.sendMessage();
    });
  };

  Widget.prototype._upload = async function (file) {
    var form = new FormData();
    form.append('file', file);
    var res = await fetch(this._api('/api/files/upload'), {
      method: 'POST',
      headers: { 'X-Site-Key': this.config.siteKey },
      body: form
    });
    if (!res.ok) throw new Error('Upload failed with HTTP ' + res.status);
    var data = await res.json();
    return data.file;
  };

  // -------------------------------------------------------------------------
  // 8. Public API
  // -------------------------------------------------------------------------

  Widget.prototype.open = function () {
    if (this.destroyed || !this.el || this.isHidden) return;
    this.isOpen = true;
    this.el.wrap.classList.add('open');
    this.el.launcher.setAttribute('aria-expanded', 'true');
    this.unread = 0;
    this._renderBadge();
    if (this.view === 'messages') this._scrollToEnd();
    // Odagi panele tasi — klavye kullanicisi acildiktan sonra sayfanin
    // basindan devam etmemeli.
    var panel = this.el.panel;
    setTimeout(function () { panel.focus(); }, 50);
    this.emit('open', {});
  };

  Widget.prototype.close = function () {
    if (this.destroyed || !this.el) return;
    this.isOpen = false;
    this.el.wrap.classList.remove('open');
    this.el.launcher.setAttribute('aria-expanded', 'false');
    this.emit('close', {});
  };

  Widget.prototype.toggle = function () {
    this.isOpen ? this.close() : this.open();
  };

  Widget.prototype.show = function () {
    this.isHidden = false;
    this._applyVisibility();
    this.emit('show', {});
  };

  Widget.prototype.hide = function () {
    this.isHidden = true;
    this.close();
    this._applyVisibility();
    this.emit('hide', {});
  };

  /**
   * Oturum acmis kullaniciyi tanitir.
   *
   * GUVENLIK: Buradaki alanlara tek basina GUVENILMEZ. Sunucu bunlari yalnizca
   * gosterim icin kullanir; yetkilendirme kararlari asla ziyaretcinin gonderdigi
   * kimlige dayandirilmaz. Imzali kimlik (HMAC) destegi eklendiginde `userHash`
   * alani buradan gecirilecektir.
   */
  Widget.prototype.identify = function (user) {
    if (!user || typeof user !== 'object') return;
    this.identity = {
      userId: user.userId || user.id || null,
      name: user.name || null,
      email: user.email || null,
      avatar: user.avatar || null,
      userHash: user.userHash || null
    };
    if (this.identity.name) store.set('sc_visitor_name', this.identity.name);
    if (this.identity.email) store.set('sc_visitor_email', this.identity.email);

    // Zaten bagliysa sunucudaki ziyaretci kaydi guncellensin.
    if (this.socket && this.socket.connected) this._join();
    this.emit('identify', { user: this.identity });
  };

  /**
   * Kullanici cikis yaptiginda cagrilir. YENI bir ziyaretci kimligi uretilir:
   * aksi halde ortak bir bilgisayarda ikinci kullanici, birincinin sohbet
   * gecmisini gorurdu.
   */
  Widget.prototype.logout = function () {
    this.identity = null;
    this.attributes = {};
    this.conversationId = null;
    store.remove('sc_visitor_name');
    store.remove('sc_visitor_email');
    this.visitorId = uid('v');
    store.set('sc_visitor_id', this.visitorId);
    this.sessionId = uid('s');
    this.unread = 0;
    this._renderBadge();
    if (this.el) this._renderThread([]);
    if (this.socket && this.socket.connected) this._join();
    this.emit('logout', {});
  };

  Widget.prototype.setAttributes = function (attributes) {
    if (!attributes || typeof attributes !== 'object') return;
    for (var key in attributes) {
      if (Object.prototype.hasOwnProperty.call(attributes, key)) this.attributes[key] = attributes[key];
    }
    if (this.socket && this.socket.connected) this._join();
    this.emit('attributes', { attributes: this.attributes });
  };

  Widget.prototype.setLocale = function (locale, silent) {
    var next = pickLocale(locale);
    if (next === this.locale && !silent) return;
    this.locale = next;
    this.t = STRINGS[next];
    if (this.el && !silent) {
      // Metinleri yeniden ciz. Sohbet gecmisi korunur.
      var openState = this.isOpen;
      var view = this.view;
      var messages = Array.prototype.map.call(this.el.messages.children, function (n) { return n; });
      this._teardownDom();
      this._render();
      for (var i = 0; i < messages.length; i++) this.el.messages.appendChild(messages[i]);
      this._renderEmptyStateIfNeeded();
      this._setView(view);
      if (openState) this.open();
    }
    this.emit('locale', { locale: next });
  };

  /** theme: 'light' | 'dark' | 'auto' — panel arkaplan/metin renklerini cevirir. */
  Widget.prototype.setTheme = function (theme) {
    var resolved = theme;
    if (theme === 'auto' || !theme) {
      resolved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    var colors = this.remote.config.colors;
    if (resolved === 'dark') {
      this._lightColors = this._lightColors || Object.assign({}, colors);
      colors.background = '#111827';
      colors.text = '#F9FAFB';
      colors.textSecondary = '#9CA3AF';
      colors.border = '#1F2937';
      colors.agentMessageBg = '#1F2937';
    } else if (this._lightColors) {
      Object.assign(colors, this._lightColors);
    }
    this.theme = resolved;
    if (this.el) {
      var styleEl = this.root.querySelector('style');
      if (styleEl) styleEl.textContent = this._css();
    }
    this.emit('theme', { theme: resolved });
  };

  Widget.prototype._teardownDom = function () {
    // Yalnizca DOM'u soker; soket ve durum korunur (setLocale yeniden cizimi).
    for (var i = 0; i < this._listeners.length; i++) {
      var l = this._listeners[i];
      l.target.removeEventListener(l.type, l.handler, l.options);
    }
    this._listeners = [];
    if (this.host && this.host.parentNode) this.host.parentNode.removeChild(this.host);
    this.el = null;
  };

  /**
   * Widget'i tamamen kaldirir. SPA'da uygulama unmount olurken cagrilmalidir:
   * cagrilmazsa soket acik kalir, history sarmalayicisi yerinde durur ve
   * dinleyiciler sizar.
   */
  Widget.prototype.destroy = function () {
    if (this.destroyed) return;
    this.destroyed = true;

    for (var i = 0; i < this._timers.length; i++) clearTimeout(this._timers[i]);
    this._timers = [];
    if (this._bannerTimer) clearTimeout(this._bannerTimer);
    if (this._typingTimer) clearTimeout(this._typingTimer);

    // history metodlari geri konur. Bunu yapmazsak widget yok olduktan sonra
    // bile host sitenin her yonlendirmesi bizim koddan gecerdi.
    if (this._historyPatch) {
      var self = this;
      Object.keys(this._historyPatch).forEach(function (method) {
        window.history[method] = self._historyPatch[method];
      });
      this._historyPatch = null;
    }

    this._teardownDom();

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    if (this._audio && this._audio.close) { try { this._audio.close(); } catch (e) {} }

    this.emit('destroy', {});
    this._handlers = {};

    if (window[NAMESPACE] && window[NAMESPACE].__runtime === this) {
      delete window[NAMESPACE].__runtime;
    }
  };

  // -------------------------------------------------------------------------
  // 9. Global arayuz
  //
  // Global alan kirliligi tek bir isimle sinirli: `window.SupportChat`.
  // `window.SupportIO` yalnizca eski entegrasyonlar icin bir takma addir.
  // -------------------------------------------------------------------------

  // Script yuklenmeden once birikmis komutlar. Musteri sitesi su kaliplari
  // kullanabilir ve hicbiri kaybolmaz:
  //   SupportChat.q = SupportChat.q || []; SupportChat.q.push(['open']);
  var queued = (window[NAMESPACE] && window[NAMESPACE].q) || [];

  var api = {
    version: SDK_VERSION,
    __runtime: null,

    init: function (overrides) {
      if (api.__runtime && !api.__runtime.destroyed) return api.__runtime;
      var widget = new Widget(resolveConfig(overrides));
      api.__runtime = widget;
      // `on()` init'ten once cagrilmis olabilir; bekleyen dinleyiciler tasinir.
      for (var i = 0; i < earlyListeners.length; i++) {
        widget.on(earlyListeners[i][0], earlyListeners[i][1]);
      }
      widget.init();
      return widget;
    },

    open: function () { api.__runtime && api.__runtime.open(); },
    close: function () { api.__runtime && api.__runtime.close(); },
    toggle: function () { api.__runtime && api.__runtime.toggle(); },
    show: function () { api.__runtime && api.__runtime.show(); },
    hide: function () { api.__runtime && api.__runtime.hide(); },
    identify: function (user) { api.__runtime && api.__runtime.identify(user); },
    logout: function () { api.__runtime && api.__runtime.logout(); },
    setAttributes: function (attrs) { api.__runtime && api.__runtime.setAttributes(attrs); },
    setLocale: function (locale) { api.__runtime && api.__runtime.setLocale(locale); },
    setTheme: function (theme) { api.__runtime && api.__runtime.setTheme(theme); },
    sendMessage: function () { api.__runtime && api.__runtime.sendMessage(); },

    on: function (event, handler) {
      if (api.__runtime) return api.__runtime.on(event, handler);
      earlyListeners.push([event, handler]);
      return function () {
        earlyListeners = earlyListeners.filter(function (pair) {
          return !(pair[0] === event && pair[1] === handler);
        });
      };
    },
    off: function (event, handler) { api.__runtime && api.__runtime.off(event, handler); },

    destroy: function () {
      if (api.__runtime) { api.__runtime.destroy(); api.__runtime = null; }
    },

    /** Tanilama: entegrasyon sorunlarinda ilk bakilacak yer. */
    debug: function () {
      var w = api.__runtime;
      return {
        version: SDK_VERSION,
        initialized: Boolean(w),
        siteKey: w && w.config.siteKey,
        apiUrl: w && w.config.apiUrl,
        connection: w && w.connection,
        availability: w && w.availability,
        conversationId: w && w.conversationId,
        visitorId: w && w.visitorId,
        locale: w && w.locale,
        hidden: w && w.isHidden,
        fatal: w && w.fatal
      };
    }
  };

  var earlyListeners = [];

  window[NAMESPACE] = api;
  // Eski API yuzeyi: window.SupportIO.openWidget() cagiran sayfalar bozulmasin.
  window[LEGACY_NAMESPACE] = window[LEGACY_NAMESPACE] || {};
  window[LEGACY_NAMESPACE].openWidget = api.open;
  window[LEGACY_NAMESPACE].closeWidget = api.close;
  window.SupportIOWidget = { openWidget: api.open, closeWidget: api.close };

  // Kuyruktaki komutlari isle.
  function drain() {
    for (var i = 0; i < queued.length; i++) {
      var entry = queued[i];
      var method = Array.isArray(entry) ? entry[0] : entry;
      var args = Array.isArray(entry) ? entry.slice(1) : [];
      if (typeof api[method] === 'function') {
        try { api[method].apply(null, args); } catch (e) {}
      }
    }
    queued.length = 0;
  }

  function boot() {
    // `data-defer` verilmisse otomatik baslatilmaz; sayfa kendi zamanlamasiyla
    // SupportChat.init() cagirir. Cerez onayi arkasinda calistirmak icin.
    if (attr('data-defer') === null || attr('data-defer') === 'false') {
      api.init();
    }
    drain();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
