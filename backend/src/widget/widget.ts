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
import trStrings from './locales/tr.json';
import enStrings from './locales/en.json';

/**
 * One language's texts. Turkish and English are in the bundle; the other
 * languages are fetched from our origin when a visitor needs them
 * (/widget/v4/locales/<code>.json), so a Turkish or English visitor never
 * downloads them. Every file has the English keys; a missing one reads in
 * English.
 */
type WidgetStrings = typeof enStrings;

// ---------------------------------------------------------------------------
// Shapes
//
// The runtime is written in the constructor-function style it has always used,
// so the receiver of each prototype method is declared here rather than
// inferred. Everything that crosses a boundary — the embed's configuration, the
// bootstrap response, a message — is described; the DOM handles it builds are
// held in one map so a lookup cannot be misspelled.
// ---------------------------------------------------------------------------

/** What the embed was configured with, from attributes, globals or init(). */
interface WidgetConfig {
  siteKey: string | null;
  apiUrl: string | null;
  socketUrl: string | null;
  locale: string | null;
  theme: string | null;
  position: string | null;
  zIndex: string | number | null;
  autoOpen?: boolean;
  hidden?: boolean;
  user: WidgetIdentity | null;
  attributes?: Record<string, unknown> | null;
  [option: string]: unknown;
}

/** The visitor, when the host site knows who they are. */
interface WidgetIdentity {
  userId?: string | null;
  name?: string | null;
  email?: string | null;
  avatar?: string | null;
  /** HMAC of the user id, when the tenant has identity verification on. */
  userHash?: string | null;
  [field: string]: unknown;
}

/** One message in the thread, as the API and the socket both deliver it. */
interface WidgetMessage {
  _id?: string;
  id?: string;
  clientMessageId?: string;
  senderType?: string;
  senderName?: string;
  senderId?: string;
  content?: string;
  messageType?: string;
  /** Set on the assistant's messages: what it cited, or why it handed over. */
  assistant?: { sources?: string[]; handoff?: string | null } | null;
  fileData?: Record<string, any> | null;
  createdAt?: string | number | Date;
  [field: string]: unknown;
}

/** A published answer shown before the visitor writes anything. */
interface WidgetFaq {
  _id?: string;
  question?: string;
  answer?: string;
  [field: string]: unknown;
}

/** Everything POST /api/widget/session hands back. */
interface WidgetBootstrap {
  /** The signed widget session; the only credential the widget holds. */
  token: string;
  expiresAt: string;
  /** Minted by the server and carried inside the token. */
  visitorId: string;
  config: Record<string, any>;
  site: Record<string, any>;
  faqs: WidgetFaq[];
  availability: string;
  /** True when the site's FAQ assistant answers first. */
  assistant?: boolean;
  [field: string]: unknown;
}

type EventHandler = (payload?: any) => void;

interface EmitterInstance {
  _handlers: Record<string, EventHandler[]>;
  on(event: string, handler: EventHandler): () => void;
  off(event: string, handler?: EventHandler): void;
  emit(event: string, payload?: unknown): void;
}

/** The named nodes inside the shadow root. */
type WidgetElements = Record<string, any>;

interface WidgetInstance extends EmitterInstance {
  config: WidgetConfig;
  locale: string;
  t: Record<string, any>;
  /** The resolved colour scheme: 'light' or 'dark'. */
  theme: string;

  /** The server's id for this visitor; null until the first session lands. */
  visitorId: string | null;
  /** The signed widget session, kept in localStorage per site key. */
  token: string | null;
  sessionId: string;
  identity: WidgetIdentity | null;
  attributes: Record<string, unknown>;

  /**
   * The bootstrap response. Null until _bootstrap() lands, which every path
   * that reads it waits for; the guards that predate this type still hold.
   */
  remote: WidgetBootstrap;
  faqs: WidgetFaq[];
  availability: string;

  socket: any;
  connection: string;
  conversationId: string | null;

  isOpen: boolean;
  isHidden: boolean;
  destroyed: boolean;
  /** Set when a failure is terminal; the banner renders its message. */
  fatal: { code: string; message: string } | null;
  view: string;
  unread: number;

  /** Message ids already rendered, so a socket echo cannot double a bubble. */
  seen: Record<string, boolean>;
  pending: Record<string, any>;
  selectedFile: File | null;

  // Built by _render() and torn down by _teardownDom(); every method that
  // touches them runs between those two points.
  host: HTMLElement;
  root: ShadowRoot;
  el: WidgetElements | null;

  _listeners: Array<{
    target: EventTarget;
    type: string;
    handler: EventListener;
    options?: AddEventListenerOptions | boolean;
  }>;
  _timers: Array<ReturnType<typeof setTimeout>>;
  _timer(fn: () => void, ms: number): ReturnType<typeof setTimeout>;
  _listen(
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions
  ): void;

  _audio: any;
  _bannerTimer: ReturnType<typeof setTimeout> | null;
  /** The original history methods, kept so destroy() can put them back. */
  _historyPatch: Record<string, (...args: any[]) => any> | null;
  /** While the window fills a phone's screen: what to put back (UX-03). */
  _phone: {
    htmlOverflow: string;
    bodyOverflow: string;
    fit: (() => void) | null;
    back: boolean;
  } | null;
  /** The next popstate is the one our own history.back() caused. */
  _ignorePop: boolean;
  /** Answers counted into the tab title, "(2) …" (UX-04). */
  _titleCount: number;
  _lastTypingAt: number;
  _lightColors: boolean;
  _typingTimer: ReturnType<typeof setTimeout> | null;

  [member: string]: any;
}

declare global {
  interface Window {
    SupportChat?: any;
    SupportIO?: any;
    SupportChatConfig?: Partial<WidgetConfig>;
    SupportIOConfig?: Partial<WidgetConfig>;
    /** The Socket.IO client, once it has been loaded from our own origin. */
    io?: any;
    /** Legacy IE/Edge alias, still probed before falling back to Math.random. */
    msCrypto?: Crypto;
  }
}

(function () {
  'use strict';

  var SDK_VERSION = '4.0.0';
  var NAMESPACE = 'SupportChat';
  var LEGACY_NAMESPACE = 'SupportIO';

  // Ayni sayfada ikinci kez calisirsa hicbir sey yapma. Bu, "widget iki kere
  // gorunuyor" siniflarinin tamamini kokten keser (cift script etiketi, SPA
  // remount, Next.js strict mode double-effect, WordPress eklenti cakismasi).
  if ((window as any)[NAMESPACE] && (window as any)[NAMESPACE].__runtime) {
    return;
  }

  // -------------------------------------------------------------------------
  // 0. Yardimcilar
  // -------------------------------------------------------------------------

  /** localStorage private mode / disabled cookies durumunda ERROR ATAR. */
  var store = {
    get: function (key: string): string | null {
      try {
        return window.localStorage.getItem(key);
      } catch (e) {
        return memory[key] || null;
      }
    },
    set: function (key: string, value: string): void {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {
        memory[key] = value;
      }
    },
    remove: function (key: string): void {
      try {
        window.localStorage.removeItem(key);
      } catch (e) {
        delete memory[key];
      }
    }
  };
  var memory: Record<string, string> = {};

  function uid(prefix: string): string {
    var rnd;
    try {
      var buf = new Uint8Array(8);
      (window.crypto || window.msCrypto).getRandomValues(buf);
      rnd = Array.prototype.map
        .call(buf, function (b) {
          return b.toString(16).padStart(2, '0');
        })
        .join('');
    } catch (e) {
      rnd = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    }
    return prefix + '_' + Date.now().toString(36) + '_' + rnd;
  }

  // Common words that say nothing about what the visitor wants; left out
  // when matching help articles to what they type (PRD-10).
  var SUGGEST_STOP = [
    've',
    'ile',
    'bir',
    'için',
    'icin',
    'ama',
    'çok',
    'daha',
    'nasıl',
    'neden',
    'nedir',
    'var',
    'yok',
    'mi',
    'mı',
    'merhaba',
    'selam',
    'iyi',
    'günler',
    'teşekkür',
    'lütfen',
    'the',
    'and',
    'for',
    'how',
    'what',
    'can',
    'you',
    'your',
    'with',
    'hello',
    'please'
  ];

  /** The words of 3+ letters in a text, lower-cased the Turkish way. */
  function suggestWords(text: string): string[] {
    return String(text || '')
      .toLocaleLowerCase('tr')
      .split(/[^0-9a-zçğıöşüâîû]+/)
      .filter(function (w) {
        return w.length >= 3 && SUGGEST_STOP.indexOf(w) < 0;
      });
  }

  function escapeHtml(value: unknown): string {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** Relative luminance (WCAG 2.x); null for a value that is not #rgb/#rrggbb. */
  function luminance(hex: string): number | null {
    var c = String(hex || '').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    if (!/^[0-9a-f]{6}$/i.test(c)) return null;
    var f = function (v: number) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return (
      0.2126 * f(parseInt(c.slice(0, 2), 16)) +
      0.7152 * f(parseInt(c.slice(2, 4), 16)) +
      0.0722 * f(parseInt(c.slice(4, 6), 16))
    );
  }

  /** The WCAG contrast ratio of two colours (1–21); 21 when one is unreadable. */
  function contrast(a: string, b: string): number {
    var la = luminance(a);
    var lb = luminance(b);
    if (la === null || lb === null) return 21;
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /**
   * Text on a background the site owner chose: white or near-black,
   * whichever reads better (WCAG 1.4.3). A luminance cut-off of 0.45 used to
   * put white on mid-tones where it fell to 3:1.
   */
  function readableOn(hex: string): string {
    if (luminance(hex) === null) return '#FFFFFF';
    return contrast(hex, '#FFFFFF') >= contrast(hex, '#111827') ? '#FFFFFF' : '#111827';
  }

  /** The accent as text on a background: itself when it reads (4.5:1), else the text colour. */
  function accentText(accent: string, background: string, fallback: string): string {
    return contrast(accent, background) >= 4.5 ? accent : fallback;
  }

  function withAlpha(hex: string, alpha: number): string {
    var c = String(hex || '').replace('#', '');
    if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
    if (c.length !== 6) return 'rgba(0,0,0,' + alpha + ')';
    return (
      'rgba(' +
      parseInt(c.slice(0, 2), 16) +
      ',' +
      parseInt(c.slice(2, 4), 16) +
      ',' +
      parseInt(c.slice(4, 6), 16) +
      ',' +
      alpha +
      ')'
    );
  }

  /** A short, stable tag for a site in the "Powered by" link (MKT-01): not its key. */
  function shortHash(value: string): string {
    var h = 5381;
    for (var i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
  }

  function formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    var units = ['B', 'KB', 'MB'];
    var i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return Math.round((bytes / Math.pow(1024, i)) * 10) / 10 + ' ' + units[i];
  }

  // -------------------------------------------------------------------------
  // 1. Yerellestirme
  //
  // Widget'in ic metinleri paneldeki i18n'den bagimsizdir: musterinin sitesi
  // baska bir dilde olabilir. Dil sirasi: acik ayar (data-locale, init,
  // setLocale) > sitenin panelde sabitledigi dil > <html lang> > tarayici.
  // -------------------------------------------------------------------------
  var STRINGS: Record<string, WidgetStrings> = { tr: trStrings, en: enStrings };
  /** Every language the widget speaks (PRD-16); the first two are bundled. */
  var LANGUAGES = ['tr', 'en', 'de', 'fr', 'es', 'nl', 'ru', 'ar'];
  /** Written right to left. */
  var RTL: Record<string, boolean> = { ar: true };
  var loadingStrings: Record<string, Promise<boolean>> = {};

  /** Fetches a language's texts once; resolves whether they are there. */
  function loadStrings(code: string, apiUrl: string | null): Promise<boolean> {
    if (STRINGS[code]) return Promise.resolve(true);
    if (!apiUrl || typeof fetch !== 'function') return Promise.resolve(false);
    if (!loadingStrings[code]) {
      loadingStrings[code] = fetch(apiUrl + '/widget/v4/locales/' + code + '.json', {
        credentials: 'omit'
      })
        .then(function (res) {
          return res.ok ? res.json() : null;
        })
        .then(function (data: Record<string, unknown> | null) {
          if (!data) return false;
          var filled = {} as Record<string, string>;
          for (var key in enStrings) {
            var value = data[key];
            filled[key] =
              typeof value === 'string' ? value : (enStrings as Record<string, string>)[key];
          }
          STRINGS[code] = filled as WidgetStrings;
          return true;
        })
        .catch(function () {
          return false;
        });
    }
    return loadingStrings[code];
  }

  function pickLocale(explicit: string | null | undefined): string {
    var candidates = [
      explicit,
      document.documentElement.getAttribute('lang'),
      navigator.language,
      (navigator.languages || [])[0]
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (!candidates[i]) continue;
      var code = String(candidates[i]).toLowerCase().slice(0, 2);
      if (LANGUAGES.indexOf(code) > -1) return code;
    }
    return 'en';
  }

  // -------------------------------------------------------------------------
  // 2. Olay yayinlayici
  // -------------------------------------------------------------------------
  function Emitter(this: EmitterInstance) {
    this._handlers = {};
  }
  Emitter.prototype.on = function (this: EmitterInstance, event: string, handler: EventHandler) {
    if (typeof handler !== 'function') return function () {};
    (this._handlers[event] = this._handlers[event] || []).push(handler);
    var self = this;
    return function () {
      self.off(event, handler);
    };
  };
  Emitter.prototype.off = function (this: EmitterInstance, event: string, handler?: EventHandler) {
    if (!this._handlers[event]) return;
    if (!handler) {
      delete this._handlers[event];
      return;
    }
    this._handlers[event] = this._handlers[event].filter(function (h) {
      return h !== handler;
    });
  };
  Emitter.prototype.emit = function (this: EmitterInstance, event: string, payload?: unknown) {
    var list = (this._handlers[event] || []).slice();
    for (var i = 0; i < list.length; i++) {
      // Bir dinleyicinin hatasi digerlerini ve widget'i durdurmamali. Host
      // sitenin callback'i bizim kontrolumuzde degil.
      try {
        list[i](payload);
      } catch (e) {
        if (window.console && console.error)
          console.error('[SupportChat] listener error for "' + event + '"', e);
      }
    }
    var star = (this._handlers['*'] || []).slice();
    for (var j = 0; j < star.length; j++) {
      try {
        star[j]({ type: event, payload: payload });
      } catch (e) {
        // A customer's own listener threw. Their bug must not stop the rest of
        // the listeners running, and must not surface in their console as if
        // the widget had failed.
      }
    }
  };

  // -------------------------------------------------------------------------
  // 3. Yapilandirma cozumlemesi
  // -------------------------------------------------------------------------

  // Script etiketini bul. `document.currentScript` async yuklemede de dogru
  // calisir; yine de eski tarayicilar ve bazi paketleyiciler icin yedek arama.
  function findScriptTag() {
    var current = document.currentScript as HTMLScriptElement | null;
    if (current && current.src) return current;
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      var src = all[i].src || '';
      if (
        /\/widget(\/v\d+)?(\/widget)?\.js(\?|$)/.test(src) ||
        all[i].hasAttribute('data-site-key')
      ) {
        return all[i];
      }
    }
    return null;
  }

  var scriptTag: HTMLScriptElement | null = findScriptTag();

  /** The in-flight load of the Socket.IO client, shared by every instance. */
  var ioPromise: Promise<unknown> | null = null;

  function attr(name: string): string | null {
    return scriptTag ? scriptTag.getAttribute(name) : null;
  }

  function bool(value: unknown, fallback: boolean): boolean {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() !== 'false' && String(value) !== '0';
  }

  function resolveConfig(overrides?: Partial<WidgetConfig> | null): WidgetConfig {
    // Eski entegrasyonlar `window.SupportIOConfig` kullaniyordu; kirilmasin.
    var legacy = window.SupportIOConfig || {};
    var modern = window.SupportChatConfig || {};
    var o = overrides || {};

    var siteKey =
      o.siteKey ||
      attr('data-site-key') ||
      attr('data-widget-id') ||
      modern.siteKey ||
      legacy.siteKey ||
      null;

    // API adresi sirasi: acik ayar > data-api-url > script'in kendi origin'i.
    var apiUrl = o.apiUrl || attr('data-api-url') || modern.apiUrl || legacy.apiUrl || null;
    if (!apiUrl && scriptTag && scriptTag.src) {
      try {
        apiUrl = new URL(scriptTag.src, window.location.href).origin;
      } catch (e) {
        apiUrl = null;
      }
    }
    if (apiUrl) apiUrl = String(apiUrl).replace(/\/+$/, '');

    return {
      siteKey: siteKey,
      apiUrl: apiUrl,
      socketUrl:
        o.socketUrl || attr('data-socket-url') || modern.socketUrl || legacy.socketUrl || apiUrl,
      locale: o.locale || attr('data-locale') || modern.locale || legacy.locale || null,
      theme: o.theme || attr('data-theme') || modern.theme || null,
      position: o.position || attr('data-position') || modern.position || legacy.position || null,
      zIndex: o.zIndex || attr('data-z-index') || modern.zIndex || null,
      autoOpen:
        o.autoOpen !== undefined
          ? o.autoOpen
          : attr('data-auto-open') !== null
            ? bool(attr('data-auto-open'), false)
            : modern.autoOpen,
      hidden: o.hidden !== undefined ? o.hidden : bool(attr('data-hidden'), false),
      // On a phone the back button closes the open window (UX-03);
      // data-back-button="false" leaves the page's history alone.
      backButton: o.backButton !== undefined ? o.backButton : bool(attr('data-back-button'), true),
      user: o.user || modern.user || null,
      attributes: o.attributes || modern.attributes || null
    };
  }

  // -------------------------------------------------------------------------
  // 4. Widget
  // -------------------------------------------------------------------------

  var MAX_FILE_BYTES = 10 * 1024 * 1024;
  /** The server's limit (domain/constants.ts MAX_MESSAGE_LENGTH). */
  var MAX_MESSAGE_LENGTH = 4000;
  /** How long a sent message waits for the server's acknowledgement. */
  var ACK_TIMEOUT_MS = 12000;
  var ALLOWED_MIME = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];

  function Widget(this: WidgetInstance, config: WidgetConfig) {
    Emitter.call(this);

    this.config = config;
    this.locale = pickLocale(config.locale);
    this.t = STRINGS[this.locale] || STRINGS.en;
    if (!STRINGS[this.locale]) this.setLocale(this.locale, true);

    // The visitor id is the server's: it arrives inside the signed session and
    // is never generated here. Only the token is stored, one per site key.
    // Before v4 the widget made its own id up and the server believed it, so
    // anyone who learned an id could open that visitor's conversation.
    this.visitorId = null;
    this.token = store.get(this._tokenKey());
    store.remove('sc_visitor_id');
    // Oturum id'si sekme omurludur: proaktif kurallarin "bu ziyarette" mantigi
    // buna dayanir.
    this.sessionId = uid('s');

    this.identity = null;
    this.attributes = {};

    // Doldurulana kadar null; okuyan her yol _bootstrap() sonrasi calisir.
    this.remote = null as unknown as WidgetBootstrap; // bootstrap yaniti
    this.faqs = [];
    this.availability = 'offline';

    this.socket = null;
    this.connection = 'idle'; // idle|connecting|connected|reconnecting|disconnected|error
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

    this._listeners = []; // {target, type, handler} — destroy'da sokulur
    this._timers = [];
  }
  Widget.prototype = Object.create(Emitter.prototype);
  Widget.prototype.constructor = Widget;

  // --- yasam dongusu yardimcilari ------------------------------------------

  Widget.prototype._listen = function (
    this: WidgetInstance,
    target: EventTarget,
    type: string,
    handler: EventListener,
    options?: AddEventListenerOptions | boolean
  ) {
    target.addEventListener(type, handler, options);
    this._listeners.push({ target: target, type: type, handler: handler, options: options });
  };

  Widget.prototype._timer = function (this: WidgetInstance, fn: () => void, ms: number) {
    var id = setTimeout(fn, ms);
    this._timers.push(id);
    return id;
  };

  Widget.prototype._api = function (this: WidgetInstance, path: string) {
    return this.config.apiUrl + path;
  };

  Widget.prototype._tokenKey = function (this: WidgetInstance) {
    return 'sc_widget_session:' + String(this.config.siteKey);
  };

  /**
   * A widget API call carrying the session. A 401 means the session expired
   * or the site key was regenerated: one fresh session is fetched and the call
   * repeated once.
   */
  Widget.prototype._authFetch = async function (
    this: WidgetInstance,
    path: string,
    init: RequestInit,
    retried?: boolean
  ): Promise<Response> {
    var headers: Record<string, string> = Object.assign({}, (init.headers as any) || {});
    headers.Authorization = 'Bearer ' + this.token;
    var res = await fetch(
      this._api(path),
      Object.assign({}, init, { headers: headers, credentials: 'omit' })
    );
    if (res.status === 401 && !retried && (await this._session())) {
      return this._authFetch(path, init, true);
    }
    return res;
  };

  // --- baslangic ------------------------------------------------------------

  Widget.prototype.init = async function (this: WidgetInstance) {
    if (!this.config.siteKey) {
      this._fail('MISSING_SITE_KEY', 'data-site-key is required on the widget script tag');
      return;
    }
    if (!this.config.apiUrl) {
      this._fail('MISSING_API_URL', 'Could not determine the API url from the script src');
      return;
    }

    // The link in a reply mail opens the page with ?sc_resume=…: it brings
    // this visitor back to their conversation. Read once, then removed from
    // the address bar so it is not bookmarked or shared.
    try {
      var params = new URLSearchParams(window.location.search);
      var resume = params.get('sc_resume');
      if (resume) {
        this._resumeToken = resume;
        params.delete('sc_resume');
        var rest = params.toString();
        window.history.replaceState(
          window.history.state,
          '',
          window.location.pathname + (rest ? '?' + rest : '') + window.location.hash
        );
      }
    } catch (e) {
      /* an unusual URL: nothing to resume */
    }

    var ok = await this._session();
    if (!ok) return;

    if (!this._shouldShowOnThisPage()) {
      this.isHidden = true;
    }

    this._render();
    if (this._blocked) {
      // Blocked on this site: the bubble stays, with a polite line and no
      // way to write. No socket, no installation report.
      this._enterBlocked();
      this.emit('ready', {
        siteKey: this.config.siteKey,
        locale: this.locale,
        version: SDK_VERSION
      });
      return;
    }
    // The socket opens only when it is needed (PERF-02): a returning visitor
    // whose conversation is still open (a reply must reach them), the link
    // in a reply mail, or later the visitor opening the widget. Until then
    // a small request keeps the panel's live visitor list right.
    if ((this.remote as any).conversationOpen || this._openOnReady) {
      this._ensureSocket();
    } else {
      this._presence();
      this._startPresenceBeat();
    }
    this._reportInstallation();
    this._watchNavigation();

    if (this.config.user) this.identify(this.config.user);
    if (this.config.attributes) this.setAttributes(this.config.attributes);

    var behavior = this.remote.config.behavior || {};
    var autoOpen =
      this.config.autoOpen !== undefined && this.config.autoOpen !== null
        ? this.config.autoOpen
        : behavior.autoOpen;
    if (this._openOnReady && !this.isHidden) {
      // Back from a reply mail: straight to the conversation.
      this.open();
      this._setView('messages');
    } else if (autoOpen && !this.isHidden) {
      this._timer(this.open.bind(this), Number(behavior.autoOpenDelay) || 5000);
    }

    this.emit('ready', { siteKey: this.config.siteKey, locale: this.locale, version: SDK_VERSION });
  };

  Widget.prototype._fail = function (this: WidgetInstance, code: string, message: string) {
    this.fatal = { code: code, message: message };
    if (window.console && console.error) console.error('[SupportChat] ' + code + ': ' + message);
    this.emit('error', { code: code, message: message });
    // Reported to our own API, sampled there (OBS-01). No page address: this
    // runs on a customer's site. A network failure has no one to report to.
    if (code !== 'NETWORK_ERROR' && this.config.apiUrl && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(
          this.config.apiUrl + '/api/widget/telemetry',
          JSON.stringify({ code: code, message: message, sdkVersion: SDK_VERSION })
        );
      } catch (e) {
        /* never let reporting break the page */
      }
    }
  };

  /**
   * Obtains (or renews) the widget session and, with it, everything the widget
   * needs to draw itself. The stored token is offered so a returning visitor
   * keeps their id and their open conversation; the server decides whether it
   * still counts. Returns false when there is no usable session.
   */
  Widget.prototype._session = async function (this: WidgetInstance) {
    if (this._sessionPromise) return this._sessionPromise;
    var self = this;
    this._sessionPromise = (async function () {
      try {
        var res = await fetch(self._api('/api/widget/session'), {
          method: 'POST',
          credentials: 'omit',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            siteKey: self.config.siteKey,
            token: self.token || undefined,
            resumeToken: self._resumeToken || undefined
          })
        });
        if (!res.ok) {
          var body = await res.json().catch(function () {
            return {};
          });
          if (body.code === 'VISITOR_BLOCKED') {
            // The team blocked this visitor. The answer still carries the
            // widget's look, so the bubble can say so instead of vanishing.
            self._blocked = true;
            if (!self.remote && body.details && body.details.config) {
              self.remote = {
                config: body.details.config,
                faqs: [],
                availability: 'offline'
              } as any;
              self.faqs = [];
              self.availability = 'offline';
              self.setLocale(self.config.locale || self._siteLanguage(body.details.config), true);
              return true;
            }
            if (self.remote) self._enterBlocked();
            return false;
          }
          if (body.code === 'ORIGIN_NOT_ALLOWED') {
            self._fail(
              'ORIGIN_NOT_ALLOWED',
              window.location.origin +
                ' is not an allowed origin for this site. Add it under Sites in the Support.io panel.'
            );
          } else {
            self._fail(
              body.code || 'WIDGET_NOT_FOUND',
              body.error || 'Session failed with HTTP ' + res.status
            );
          }
          return false;
        }
        var data = await res.json();
        if (self._resumeToken) {
          self._resumeToken = null;
          if (data.resumed) self._openOnReady = true;
        }
        self.token = data.token;
        self.visitorId = data.visitorId;
        store.set(self._tokenKey(), data.token);
        // The first session also carries the widget's look; a renewal keeps
        // the one already drawn.
        if (!self.remote) {
          self.remote = data;
          self.faqs = data.faqs || [];
          self.availability = data.availability || 'offline';
          // The page's own choice wins, then the language the site fixed in
          // the panel; otherwise the visitor's (<html lang>, the browser).
          self.setLocale(self.config.locale || self._siteLanguage(data.config), true);
        } else {
          self.availability = data.availability || self.availability;
        }
        return true;
      } catch (error) {
        self._fail('NETWORK_ERROR', error.message);
        return false;
      } finally {
        self._sessionPromise = null;
      }
    })();
    return this._sessionPromise;
  };

  // showOnPages / hideOnPages kurallari. Kurallar basit glob desenleridir.
  Widget.prototype._shouldShowOnThisPage = function (this: WidgetInstance) {
    var behavior = (this.remote && this.remote.config.behavior) || {};
    var path = window.location.pathname;
    var match = function (pattern: string) {
      if (!pattern) return false;
      var rx = new RegExp(
        '^' +
          String(pattern)
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*') +
          '$'
      );
      return rx.test(path);
    };
    // No bubble on phone-sized screens, when the site says so (UX-04).
    if (
      behavior.hideOnMobile &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width:480px)').matches
    ) {
      return false;
    }
    var hide = behavior.hideOnPages || [];
    for (var i = 0; i < hide.length; i++) if (match(hide[i])) return false;
    var show = behavior.showOnPages || [];
    if (show.length === 0) return true;
    for (var j = 0; j < show.length; j++) if (match(show[j])) return true;
    return false;
  };

  Widget.prototype._reportInstallation = function (this: WidgetInstance) {
    // Panelde "Kurulum bekleniyor" rozetini kapatir. Basarisiz olursa sessiz
    // gecilir: kurulum dogrulamasi sohbetin calismasi icin gerekli degildir.
    var payload = JSON.stringify({
      url: window.location.href,
      sdkVersion: SDK_VERSION
    });
    try {
      this._authFetch('/api/widget/installed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(function () {
        // Analytics delivery is best effort; a dropped beacon changes nothing
        // the visitor can see.
      });
    } catch (e) {
      // `fetch` with `keepalive` is refused by some browsers during unload.
      // There is no fallback worth attempting and nothing to report.
    }
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
  Widget.prototype._watchNavigation = function (this: WidgetInstance) {
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
        self.socket.emit('visitor-page-view', {
          currentPage: window.location.origin + window.location.pathname
        });
      } else {
        self._presence();
      }
      self.emit('navigate', { url: window.location.href, path: window.location.pathname });
    };

    this._historyPatch = {};
    ['pushState', 'replaceState'].forEach(function (method) {
      var original = (window.history as any)[method];
      (self._historyPatch as Record<string, any>)[method] = original;
      (window.history as any)[method] = function (this: History) {
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

  Widget.prototype._loadSocketClient = function (this: WidgetInstance) {
    if (window.io) return Promise.resolve(window.io);
    if (ioPromise) return ioPromise;

    var src = this.config.socketUrl + '/socket.io/socket.io.js';
    ioPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = function () {
        window.io
          ? resolve(window.io)
          : reject(new Error('socket.io client loaded but window.io is missing'));
      };
      script.onerror = function () {
        reject(new Error('Failed to load ' + src));
      };
      document.head.appendChild(script);
    });
    return ioPromise;
  };

  Widget.prototype._setConnection = function (
    this: WidgetInstance,
    state: string,
    detail?: string
  ) {
    if (this.connection === state) return;
    this.connection = state;
    this._renderConnection();
    this.emit('connection', { state: state, detail: detail || null });
  };

  /** Opens the socket unless it is open, opening, or not allowed (PERF-02). */
  Widget.prototype._ensureSocket = function (this: WidgetInstance) {
    if (this.socket || this._connecting || this._blocked || this.destroyed) return;
    this._connecting = true;
    this._connect();
  };

  /** Runs `fn` once the socket has joined, opening it if needed. */
  Widget.prototype._whenJoined = function (this: WidgetInstance, fn: () => void) {
    if (this.socket && this.socket.connected && this._joinedOnce) {
      fn();
      return;
    }
    (this._afterJoin = this._afterJoin || []).push(fn);
    this._ensureSocket();
  };

  /** What the browser is, for the panel's visitor details. */
  Widget.prototype._browserInfo = function () {
    var ua = navigator.userAgent || '';
    var browser = /Edg\//.test(ua)
      ? 'Edge'
      : /OPR\//.test(ua)
        ? 'Opera'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Firefox\//.test(ua)
            ? 'Firefox'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Other';
    var os = /Windows/i.test(ua)
      ? 'Windows'
      : /Android/i.test(ua)
        ? 'Android'
        : /iPhone|iPad|iPod/i.test(ua)
          ? 'iOS'
          : /Mac OS/i.test(ua)
            ? 'macOS'
            : /Linux/i.test(ua)
              ? 'Linux'
              : 'Other';
    return { browser: browser, os: os };
  };

  /** Tells the server the visitor is on this page, without a socket. */
  Widget.prototype._presence = function (this: WidgetInstance) {
    if (!this.token || this._blocked || this.destroyed) return;
    if (this.socket && this.socket.connected) return;
    var info = this._browserInfo();
    try {
      fetch(this._api('/api/widget/presence'), {
        method: 'POST',
        credentials: 'omit',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.token },
        body: JSON.stringify({
          currentPage: window.location.origin + window.location.pathname,
          browser: info.browser,
          os: info.os,
          referrer: document.referrer || null,
          language: navigator.language || null
        })
      }).catch(function () {
        /* presence is best effort */
      });
    } catch (e) {
      /* presence is best effort */
    }
  };

  /** Every four minutes while the page is visible and no socket is open. */
  Widget.prototype._startPresenceBeat = function (this: WidgetInstance) {
    var self = this;
    if (this._presenceBeat) clearInterval(this._presenceBeat);
    this._presenceBeat = setInterval(
      function () {
        if (document.visibilityState === 'visible') self._presence();
      },
      4 * 60 * 1000
    );
  };

  Widget.prototype._connect = async function (this: WidgetInstance) {
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
    this._connecting = false;
    // From here the socket keeps the visitor record fresh.
    if (this._presenceBeat) clearInterval(this._presenceBeat);
    this._presenceBeat = null;

    this.socket = io(this.config.socketUrl + '/widget', {
      // Read on every (re)connect, so a renewed session is what reconnects.
      auth: function (cb: (data: Record<string, unknown>) => void) {
        cb({ token: self.token });
      },
      transports: ['websocket', 'polling'],
      // Kendi baglantimizi yonetiriz; host sitenin baska bir socket.io
      // baglantisiyla paylasmayiz.
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      // Exponential back-off from 1 s to 30 s with ±50 % jitter (PERF-06):
      // after a deploy thousands of widgets must not knock at the same second.
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      timeout: 10000
    });

    this.socket.on('connect', function () {
      refusals = 0;
      var wasDown = self.connection === 'reconnecting' || self.connection === 'disconnected';
      self._setConnection('connected');
      self._join();
      if (wasDown) self._notice(self.t.connectionRestored, 'ok');
    });

    this.socket.on('disconnect', function (reason: string) {
      // Whatever was in flight may or may not have arrived; it goes again,
      // under the same clientMessageId, once the socket has re-joined.
      for (var id in self.pending) {
        if (self.pending[id] && self.pending[id].state === 'sending') {
          self.pending[id].state = 'waiting';
        }
      }
      // 'io client disconnect' bizim destroy()'umuzdur; kullaniciya
      // "baglanti koptu" demek yanlis olur.
      if (reason === 'io client disconnect') return;
      self._setConnection('disconnected', reason);
    });

    this.socket.io.on('reconnect_attempt', function () {
      self._setConnection('reconnecting');
    });

    // The browser knows first when the network goes: the connection is dropped
    // at once instead of after the ping timeout, so what the visitor writes
    // waits in the queue; and it comes back as soon as the network does,
    // instead of after the backoff (TST-01 #13).
    this._listen(window, 'offline', function () {
      var engine = self.socket && (self.socket.io as any).engine;
      if (self.socket && self.socket.connected && engine) engine.close();
    });
    this._listen(window, 'online', function () {
      if (self.socket && !self.socket.connected && !self.destroyed) {
        self.socket.disconnect();
        self.socket.connect();
      }
    });

    // The handshake refused the session: it expired while the page was open,
    // or the site key was regenerated. A refusal by the server is not retried
    // by Socket.IO itself, so a fresh session is fetched and the socket
    // reconnects with it — a bounded number of times, so a site that keeps
    // refusing does not turn into a request loop.
    var refusals = 0;
    this.socket.on('connect_error', function (err: Error) {
      // Refused for too many connections from this address: temporary, and
      // the client does not retry a middleware refusal by itself.
      if (err && err.message === 'RATE_LIMITED') {
        self._setConnection('reconnecting');
        self._timer(
          function () {
            if (self.socket && !self.destroyed) self.socket.connect();
          },
          5000 + Math.random() * 10000
        );
        return;
      }
      if (err && err.message === 'VISITOR_BLOCKED') {
        self._enterBlocked();
        return;
      }
      if (!err || err.message !== 'WIDGET_SESSION_INVALID') return;
      if (++refusals > 3) {
        self._setConnection('error', err.message);
        return;
      }
      self._setConnection('reconnecting');
      self._session().then(function (ok: boolean) {
        if (ok && self.socket && !self.destroyed) self.socket.connect();
      });
    });
    this.socket.io.on('error', function (err: Error) {
      self._setConnection('error', err && err.message);
    });

    this.socket.on('conversation-joined', function (data: any) {
      if (data && data.conversation) {
        var same = self._joinedOnce && self.conversationId === data.conversation._id;
        self.conversationId = data.conversation._id;
        self._joinedOnce = true;
        if (same) {
          // A re-join after a dropped connection: what the thread already
          // shows stays, and only what was missed is added. Each message is
          // matched by its id, and our own by its clientMessageId.
          var missed = data.messages || [];
          for (var m = 0; m < missed.length; m++) self._appendMessage(missed[m]);
        } else {
          self._renderThread(data.messages || []);
          self._keepPending();
        }
        self._resendPending();
      } else {
        self._joinedOnce = true;
        self.conversationId = null;
        self._renderThread([]);
        // The owner's own words if they wrote some; otherwise the widget's,
        // in the visitor's language.
        var welcome =
          (data && data.welcomeMessage) ||
          (self.remote.config.messages && self.remote.config.messages.welcomeMessage) ||
          self.t.greeting + ' ' + self.t.greetingSub;
        if (welcome) {
          self._appendMessage({
            _id: 'welcome',
            senderType: 'bot',
            senderName: self.remote.config.branding.brandName,
            content: welcome,
            createdAt: new Date().toISOString()
          });
        }
        self._keepPending();
        self._renderEmptyStateIfNeeded();
        // A first message that never reached the server opens the
        // conversation now.
        self._resendPending();
      }
      self.emit('conversation:ready', { conversationId: self.conversationId });
      // What waited for the socket (a form, a rating, a request for a person).
      var waiting = self._afterJoin || [];
      self._afterJoin = [];
      for (var w = 0; w < waiting.length; w++) waiting[w]();
    });

    this.socket.on('new-message', function (data: any) {
      var message = data && data.message;
      if (!message) return;
      // The server creates the conversation from the visitor's first message and
      // joins the socket to its room, but never tells the client its id. Without
      // this the widget stayed at conversationId === null for the whole first
      // session and _emitTyping() bailed out, so the agent never saw the
      // visitor typing until the page was reloaded.
      if (!self.conversationId && message.conversationId) {
        self.conversationId = String(message.conversationId);
      }
      var drawn = self._appendMessage(message);
      if (message.senderType !== 'visitor') {
        self._hideTyping();
        if (drawn) {
          self._announce(message);
          self._titleAlert();
        }
      } else {
        var stale = self.el && self.el.messages.querySelector('.seen');
        if (stale) stale.remove();
      }
      // The FAQ assistant handed over: from here a person answers, so the
      // line offering one has done its job.
      if (message.assistant && message.assistant.handoff) self._hideAssistantLine();
      if (message.senderType !== 'visitor' && !self.isOpen) {
        self.unread += 1;
        self._renderBadge();
        self._playSound();
      }
      self.emit('message', { message: message });
    });

    // The assistant asks for longer than a person's keystroke pause: its
    // answer can take a few seconds to write.
    // The team has read the visitor's messages (UX-04).
    this.socket.on('messages-seen', function () {
      self._markSeen();
    });

    this.socket.on('agent-typing', function (data: any) {
      self._showTyping(data && data.durationMs);
    });

    // The agent closed the conversation: ask for a rating, offer the
    // transcript, as the site's settings say.
    this.socket.on('conversation-ended', function (data: any) {
      self._showEndCard(data || {});
      self.emit('conversation:ended', { conversationId: data && data.conversationId });
    });

    // The team blocked this visitor while the chat was open (SEC-09).
    this.socket.on('visitor-blocked', function () {
      self._enterBlocked();
    });

    this.socket.on('error', function (data: any) {
      if (data && data.code === 'PRECHAT_REQUIRED') {
        self._contactRequired = true;
        self._maybeShowContactForm();
        return;
      }
      // Answered on the message itself, in the visitor's language.
      if (data && (data.code === 'SLOW_DOWN' || data.code === 'VISITOR_BLOCKED')) return;
      var message = (data && data.message) || 'Unknown socket error';
      self.emit('error', { code: 'SOCKET_ERROR', message: message });
      self._notice(message, 'error');
    });
  };

  Widget.prototype._join = function (this: WidgetInstance) {
    if (!this.socket) return;
    var info = this._browserInfo();
    var browser = info.browser;
    var os = info.os;
    // The site and the visitor are not sent: the server reads both from the
    // signed session the socket connected with.
    this.socket.emit('join-conversation', {
      visitorName:
        (this.identity && this.identity.name) || store.get('sc_visitor_name') || 'Visitor',
      visitorEmail: (this.identity && this.identity.email) || store.get('sc_visitor_email') || null,
      // The server accepts the id only when the shop's signature (userHash)
      // checks out; an unsigned or forged pair simply leaves the visitor anonymous.
      userId: (this.identity && this.identity.userId) || null,
      userHash: (this.identity && this.identity.userHash) || null,
      // Query strings often contain tokens or personal data; page context does
      // not need them. Origin + path is useful to the operator and safe to keep.
      currentPage: window.location.origin + window.location.pathname,
      metadata: {
        browser: browser,
        os: os,
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

  Widget.prototype._css = function (this: WidgetInstance) {
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
    var fontFamily =
      typo.fontFamily ||
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    var speed =
      advanced.animationSpeed === 'slow' ? 320 : advanced.animationSpeed === 'fast' ? 120 : 200;

    var vertical = button.position.indexOf('top') === 0 ? 'top' : 'bottom';
    var horizontal = button.position.indexOf('left') > -1 ? 'left' : 'right';

    return [
      /* Shadow root icinde bile :host'a yazmak gerekir; host sayfanin
         `div { display: ... }` gibi kurallari host elemani etkileyebilir. */
      ':host{all:initial;position:fixed;' + vertical + ':0;' + horizontal + ':0;',
      'width:auto;height:auto;z-index:' +
        (this.config.zIndex || advanced.zIndex || 2147483000) +
        ';',
      'font-family:' + fontFamily + ';color-scheme:light;}',
      '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}',
      /* SVG icin TABAN olcu.
         viewBox'i olup width/height'i olmayan bir inline <svg> kabina gore
         esnetilir: `.cta` gibi bir flex kutusunda dev bir ikona donusuyordu.
         Shadow Root icinde host sayfanin `svg { width: ... }` kurali da
         gecmedigi icin bu olcuyu burada bizim vermemiz gerekir. */
      'svg{width:18px;height:18px;flex:0 0 auto;display:block;}',
      'button{font:inherit;color:inherit;}',
      '.root{position:fixed;' +
        vertical +
        ':20px;' +
        horizontal +
        ':20px;display:flex;flex-direction:column;',
      'align-items:flex-' + (horizontal === 'right' ? 'end' : 'start') + ';gap:12px;}',
      '.root[hidden]{display:none;}',

      /* --- launcher --- */
      '.launcher{width:' + size + 'px;height:' + size + 'px;border-radius:' + bubbleRadius + ';',
      'background:' + primary + ';color:' + onPrimary + ';border:0;cursor:pointer;display:flex;',
      'align-items:center;justify-content:center;position:relative;',
      'box-shadow:' +
        (button.shadow === false
          ? 'none'
          : '0 8px 24px ' + withAlpha(primary, 0.32) + ',0 2px 6px rgba(0,0,0,.12)') +
        ';',
      'transition:transform ' +
        speed +
        'ms cubic-bezier(.2,.8,.2,1),box-shadow ' +
        speed +
        'ms ease;}',
      '.launcher:hover{transform:translateY(-2px) scale(1.04);}',
      '.launcher:active{transform:scale(.96);}',
      '.launcher:focus-visible{outline:3px solid ' +
        withAlpha(primary, 0.5) +
        ';outline-offset:3px;}',
      '.launcher svg{width:26px;height:26px;}',
      '.launcher .close-icon{display:none;}',
      '.root.open .launcher .open-icon{display:none;}',
      '.root.open .launcher .close-icon{display:block;}',
      '.badge{position:absolute;top:-2px;' +
        horizontal +
        ':-2px;min-width:20px;height:20px;padding:0 6px;',
      'border-radius:10px;background:#EF4444;color:#fff;font-size:11px;font-weight:700;line-height:20px;',
      'text-align:center;box-shadow:0 0 0 2px #fff;}',
      '.badge[hidden]{display:none;}',

      /* --- panel --- */
      '.panel{width:' + win.width + 'px;max-width:calc(100vw - 40px);height:' + win.height + 'px;',
      'max-height:calc(100vh - 120px);background:' +
        colors.background +
        ';color:' +
        colors.text +
        ';',
      'border-radius:' +
        win.borderRadius +
        'px;overflow:hidden;display:none;flex-direction:column;',
      'box-shadow:0 24px 64px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.08);',
      'border:1px solid ' + colors.border + ';',
      'opacity:0;transform:translateY(12px) scale(.98);',
      'transition:opacity ' +
        speed +
        'ms ease,transform ' +
        speed +
        'ms cubic-bezier(.2,.8,.2,1);}',
      '.root.open .panel{display:flex;opacity:1;transform:none;}',

      /* --- header --- */
      '.header{background:' + header + ';color:' + onHeader + ';padding:16px 18px;display:flex;',
      'align-items:center;gap:12px;min-height:' + win.headerHeight + 'px;flex:0 0 auto;}',
      '.header-logo{width:' + c.branding.logoWidth + 'px;height:' + c.branding.logoHeight + 'px;',
      'object-fit:contain;border-radius:8px;background:rgba(255,255,255,.14);flex:0 0 auto;}',
      '.header-text{flex:1;min-width:0;}',
      '.header-title{font-size:15px;font-weight:650;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.header-status{font-size:12px;display:flex;align-items:center;gap:6px;margin-top:2px;}',
      '.assistant-line{font-size:11px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.link-btn{border:0;background:none;padding:0;color:inherit;font:inherit;cursor:pointer;text-decoration:underline;}',
      '.dot{width:7px;height:7px;border-radius:50%;background:#9CA3AF;flex:0 0 auto;}',
      '.dot.online{background:#22C55E;}.dot.away{background:#F59E0B;}',
      '.dot.pulse{animation:pulse 1.4s ease-in-out infinite;}',
      '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}',
      '.icon-btn{width:44px;height:44px;border:0;border-radius:8px;background:transparent;color:inherit;',
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
      '.banner.success{background:#DCFCE7;color:#166534;}',
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
      '.home p.sub{margin-top:7px;font-size:14.5px;color:' +
        colors.textSecondary +
        ';line-height:1.55;}',

      '.card{margin-top:22px;width:100%;padding:14px;border:1px solid ' + colors.border + ';',
      'border-radius:14px;background:' + colors.background + ';cursor:pointer;text-align:start;',
      'display:flex;align-items:center;gap:12px;',
      'transition:border-color 160ms ease,box-shadow 160ms ease,transform 160ms ease;}',
      '.card:hover{border-color:' +
        withAlpha(primary, 0.45) +
        ';box-shadow:0 6px 18px ' +
        withAlpha(primary, 0.13) +
        ';transform:translateY(-1px);}',
      '.card:active{transform:translateY(0);}',
      '.card:focus-visible{outline:2px solid ' + primary + ';outline-offset:2px;}',
      '.card-icon{width:38px;height:38px;border-radius:11px;background:' +
        primary +
        ';color:' +
        onPrimary +
        ';',
      'display:flex;align-items:center;justify-content:center;flex:0 0 auto;}',
      '.card-icon svg{width:19px;height:19px;}',
      // Iki satir da <span>: kap flex sutunu olmazsa yan yana yapisiyor ve
      // .card-sub'in margin-top'u satir ici oldugu icin yok sayiliyordu.
      '.card-body{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;}',
      '.card-title{font-size:14.5px;font-weight:600;line-height:1.3;}',
      '.card-sub{margin-top:2px;font-size:12.5px;color:' +
        colors.textSecondary +
        ';line-height:1.4;}',
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
      '.search input{width:100%;padding:10px 12px;border:1px solid ' +
        colors.border +
        ';border-radius:10px;',
      'font-size:14px;font-family:inherit;background:' +
        colors.background +
        ';color:' +
        colors.text +
        ';outline:none;}',
      '.search input:focus{border-color:' +
        primary +
        ';box-shadow:0 0 0 3px ' +
        withAlpha(primary, 0.16) +
        ';}',
      '.faq-list{flex:1;overflow-y:auto;padding:8px;}',
      '.faq{border-radius:10px;overflow:hidden;}',
      '.faq + .faq{margin-top:2px;}',
      '.faq-q{width:100%;text-align:start;padding:12px 14px;border:0;background:transparent;cursor:pointer;',
      'font-size:14px;font-weight:550;font-family:inherit;color:' + colors.text + ';display:flex;',
      'align-items:center;justify-content:space-between;gap:10px;border-radius:10px;transition:background 140ms ease;}',
      '.faq-q:hover{background:' + withAlpha(colors.textSecondary, 0.08) + ';}',
      '.faq-q svg{width:16px;height:16px;flex:0 0 auto;opacity:.5;transition:transform 180ms ease;}',
      '.faq.open .faq-q svg{transform:rotate(180deg);}',
      '.faq-a{display:none;padding:0 14px 14px;font-size:13.5px;line-height:1.6;color:' +
        colors.textSecondary +
        ';}',
      '.faq.open .faq-a{display:block;}',
      '.help-all{display:block;margin:4px 8px 10px;padding:12px;min-height:44px;text-align:center;',
      'border-radius:10px;font-size:13.5px;font-weight:600;text-decoration:none;color:' +
        colors.text +
        ';border:1px solid ' +
        colors.border +
        ';}',
      '.help-all:hover{background:' + withAlpha(colors.textSecondary, 0.08) + ';}',
      /* help suggestions while typing (PRD-10) */
      '.suggest{padding:10px 12px 2px;border-top:1px solid ' + colors.border + ';}',
      '.suggest[hidden]{display:none;}',
      '.suggest-title{margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:.06em;',
      'text-transform:uppercase;color:' + colors.textSecondary + ';}',
      '.suggest-item{display:block;width:100%;min-height:44px;margin:0 0 6px;padding:10px 12px;',
      'text-align:start;font:inherit;font-size:13.5px;cursor:pointer;border-radius:10px;background:transparent;color:' +
        colors.text +
        ';border:1px solid ' +
        colors.border +
        ';}',
      '.suggest-item:hover{background:' + withAlpha(colors.textSecondary, 0.08) + ';}',

      /* thread */
      '.messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;',
      'scroll-behavior:smooth;overscroll-behavior:contain;}',
      '.msg{max-width:82%;display:flex;flex-direction:column;gap:3px;}',
      '.msg.visitor{align-self:flex-end;align-items:flex-end;}',
      '.msg.agent,.msg.bot,.msg.system{align-self:flex-start;}',
      '.msg-sender{font-size:11px;font-weight:600;color:' +
        colors.textSecondary +
        ';padding:0 4px;}',
      // The assistant's answers say what they are (AI-03).
      '.msg-badge{font-size:10.5px;font-weight:600;letter-spacing:.01em;padding:1px 7px;border-radius:999px;color:' +
        colors.textSecondary +
        ';border:1px solid currentColor;}',
      '.ai-note{font-size:11px;color:' + colors.textSecondary + ';padding:0 4px;max-width:260px;}',
      '.bubble{padding:10px 13px;border-radius:' +
        c.messages.messageBubbleRadius +
        'px;font-size:14px;',
      'line-height:1.5;word-break:break-word;white-space:pre-wrap;}',
      '.msg.visitor .bubble{background:' +
        visitorBg +
        ';color:' +
        onVisitor +
        ';border-bottom-right-radius:5px;}',
      '.msg.agent .bubble,.msg.bot .bubble{background:' +
        agentBg +
        ';color:' +
        onAgent +
        ';border-bottom-left-radius:5px;}',
      '.msg.system .bubble{background:transparent;border:1px dashed ' +
        colors.border +
        ';color:' +
        colors.textSecondary +
        ';font-size:13px;}',
      '.meta{font-size:10.5px;color:' +
        colors.textSecondary +
        ';padding:0 4px;display:flex;align-items:center;gap:5px;}',
      '.msg.pending{opacity:.62;}',
      '.msg.failed .bubble{background:#FEE2E2;color:#991B1B;}',
      '.retry{border:0;background:none;color:#DC2626;font-size:10.5px;font-weight:600;cursor:pointer;',
      'text-decoration:underline;font-family:inherit;padding:0;}',
      '.attachment{margin-top:8px;display:block;}',
      '.attachment img{max-width:100%;border-radius:10px;display:block;cursor:pointer;}',
      '.file{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:10px;',
      'background:' +
        withAlpha(colors.textSecondary, 0.1) +
        ';text-decoration:none;color:inherit;}',
      '.file svg{width:18px;height:18px;flex:0 0 auto;opacity:.7;}',
      '.file-name{font-size:12.5px;font-weight:550;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.file-size{font-size:10.5px;}',
      '.typing{align-self:flex-start;display:none;gap:4px;padding:11px 14px;border-radius:14px;',
      'background:' + agentBg + ';}',
      '.typing.show{display:flex;}',
      '.typing i{width:6px;height:6px;border-radius:50%;background:' + colors.textSecondary + ';',
      'animation:bounce 1.2s infinite;}',
      '.typing i:nth-child(2){animation-delay:.15s}.typing i:nth-child(3){animation-delay:.3s}',
      '@keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}',
      '.empty{margin:auto;text-align:center;color:' +
        colors.textSecondary +
        ';font-size:13.5px;padding:24px;line-height:1.6;}',

      '.powered{display:block;text-align:center;font-size:11px;padding:4px 0 6px;color:' +
        colors.textSecondary +
        ';text-decoration:none;background:' +
        colors.background +
        ';}',
      '.powered:hover{text-decoration:underline;}',

      /* composer */
      '.composer{position:relative;flex:0 0 auto;border-top:1px solid ' +
        colors.border +
        ';padding:10px 12px;',
      'display:flex;align-items:flex-end;gap:8px;background:' + colors.background + ';',
      'padding-bottom:calc(10px + env(safe-area-inset-bottom,0px));}',
      '.composer textarea{flex:1;min-width:0;resize:none;border:1px solid ' + colors.border + ';',
      'border-radius:12px;padding:10px 12px;font-size:14px;font-family:inherit;line-height:1.45;',
      'max-height:120px;background:' +
        colors.background +
        ';color:' +
        colors.text +
        ';outline:none;}',
      '.composer textarea:focus{border-color:' +
        primary +
        ';box-shadow:0 0 0 3px ' +
        withAlpha(primary, 0.16) +
        ';}',
      '.composer textarea::placeholder{color:' + colors.textSecondary + ';opacity:.75;}',
      '.send{width:44px;height:44px;flex:0 0 auto;border:0;border-radius:11px;background:' +
        primary +
        ';',
      'color:' +
        onPrimary +
        ';cursor:pointer;display:flex;align-items:center;justify-content:center;',
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

      /* pre-chat / offline form and the end-of-chat card */
      '.contact-wrap:empty{display:none;}',
      '.contact,.end-card{margin:8px 12px;padding:14px;border:1px solid ' + colors.border + ';',
      'border-radius:14px;background:' +
        colors.background +
        ';display:flex;flex-direction:column;gap:10px;}',
      '.contact h3,.end-title{font-size:14px;font-weight:650;color:' + colors.text + ';}',
      '.contact .sub,.end-card .sub{font-size:12.5px;color:' +
        colors.textSecondary +
        ';line-height:1.45;}',
      '.contact label.field{display:flex;flex-direction:column;gap:4px;font-size:12px;color:' +
        colors.textSecondary +
        ';}',
      '.contact input[type=text],.contact input[type=email],.contact input[type=tel],.end-card input,.end-card textarea{',
      'width:100%;border:1px solid ' + colors.border + ';border-radius:10px;padding:9px 11px;',
      'font:inherit;font-size:14px;color:' +
        colors.text +
        ';background:' +
        colors.background +
        ';outline:none;}',
      '.contact input:focus,.end-card input:focus,.end-card textarea:focus{border-color:' +
        primary +
        ';box-shadow:0 0 0 3px ' +
        withAlpha(primary, 0.16) +
        ';}',
      '.contact .consent{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:' +
        colors.text +
        ';line-height:1.45;}',
      '.contact .consent input{margin-top:2px;width:16px;height:16px;flex:0 0 auto;accent-color:' +
        primary +
        ';}',
      '.contact .consent a{color:' + primary + ';}',
      '.contact .err{font-size:11.5px;color:#B91C1C;min-height:0;}',
      '.contact .err:empty{display:none;}',
      '.contact .actions,.end-card .actions{display:flex;gap:8px;align-items:center;}',
      '.btn-primary{border:0;border-radius:10px;padding:9px 14px;font:inherit;font-size:13.5px;font-weight:600;',
      'background:' + primary + ';color:' + onPrimary + ';cursor:pointer;}',
      '.btn-primary:disabled{opacity:.45;cursor:not-allowed;}',
      '.btn-link{border:0;background:none;font:inherit;font-size:13px;color:' +
        colors.textSecondary +
        ';cursor:pointer;text-decoration:underline;}',
      '.btn-primary:focus-visible,.btn-link:focus-visible,.choice:focus-visible{outline:2px solid ' +
        primary +
        ';outline-offset:2px;}',
      '.composer.locked{opacity:.5;pointer-events:none;}',
      '.choices{display:flex;gap:8px;}',
      '.choice{min-width:44px;min-height:44px;border:1px solid ' +
        colors.border +
        ';border-radius:12px;',
      'background:' +
        colors.background +
        ';color:' +
        colors.text +
        ';cursor:pointer;font:inherit;font-size:13px;',
      'display:flex;align-items:center;justify-content:center;gap:6px;padding:0 12px;}',
      '.choice svg{width:18px;height:18px;}',
      '.choice[aria-pressed=true]{border-color:' +
        primary +
        ';background:' +
        withAlpha(primary, 0.1) +
        ';color:' +
        accentText(primary, colors.background, colors.text) +
        ';font-weight:600;}',
      '.choice.star{padding:0;font-size:20px;line-height:1;}',
      '.end-card .row{display:flex;gap:8px;}',
      '.end-card .row input{flex:1;min-width:0;}',
      '.end-card .done{font-size:13px;color:' + colors.text + ';}',

      /* nav */
      '.nav{flex:0 0 auto;display:flex;border-top:1px solid ' + colors.border + ';',
      'padding-bottom:env(safe-area-inset-bottom,0px);}',
      '.nav button{flex:1;padding:10px 4px;border:0;background:none;cursor:pointer;font-family:inherit;',
      'font-size:11px;font-weight:550;color:' +
        colors.textSecondary +
        ';display:flex;flex-direction:column;',
      'align-items:center;gap:3px;transition:color 140ms ease;}',
      '.nav button svg{width:19px;height:19px;}',
      '.nav button.active{color:' +
        accentText(primary, colors.background, colors.text) +
        ';box-shadow:inset 0 2px 0 ' +
        primary +
        ';}',
      '.nav button:focus-visible{outline:2px solid ' + primary + ';outline-offset:-2px;}',

      '.footer{flex:0 0 auto;padding:7px;text-align:center;font-size:10.5px;color:' +
        colors.textSecondary +
        ';',
      'border-top:1px solid ' + colors.border + ';}',

      /* --- mobil ---
         100vh mobil tarayicilarda adres cubugunun ALTINA tasar. 100dvh dogru
         olcudur; desteklenmeyen tarayicilar icin once 100vh yazilir. */
      '@media (max-width:480px){',
      '.root{' +
        vertical +
        ':0;' +
        horizontal +
        ':0;left:0;right:0;bottom:0;align-items:flex-end;padding:16px;gap:0;}',
      '.root.open{padding:0;}',
      '.root.open .launcher{display:none;}',
      '.panel{position:fixed;inset:0;width:100%;max-width:none;height:100vh;height:100dvh;',
      'max-height:none;border-radius:0;border:0;}',
      '.header{padding-top:calc(16px + env(safe-area-inset-top,0px));}',
      '}',
      '@media (prefers-reduced-motion:reduce){*{animation-duration:.01ms !important;transition-duration:.01ms !important;}.messages{scroll-behavior:auto;}}',
      // The emoji panel above the message box (UX-04).
      '.emoji-pop{position:absolute;left:8px;right:8px;bottom:calc(100% + 6px);display:grid;grid-template-columns:repeat(8,1fr);gap:2px;',
      'padding:8px;border:1px solid ' +
        colors.border +
        ';border-radius:14px;background:' +
        colors.background +
        ';box-shadow:0 10px 30px rgba(0,0,0,.14);z-index:2;}',
      '.emoji-pop[hidden]{display:none;}',
      '.emoji-pop button{min-width:36px;min-height:36px;border:0;border-radius:8px;background:none;font-size:20px;line-height:1;cursor:pointer;}',
      '.emoji-pop button:hover,.emoji-pop button:focus-visible{background:' +
        withAlpha(primary, 0.1) +
        ';outline:none;}',
      // A file dragged over the conversation.
      '.panel.dragging .messages{outline:2px dashed ' + primary + ';outline-offset:-8px;}',
      // "Seen" under the visitor's last message once the team has read it.
      '.seen{font-size:10.5px;color:' + colors.textSecondary + ';padding:0 4px;}',
      // Read by screen readers, invisible on screen.
      '.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}',
      // Right to left (Arabic): what points or leans one way turns the other.
      // Flex rows, column alignment and text follow `dir` by themselves.
      '[dir=rtl] .msg.visitor .bubble{border-bottom-right-radius:' +
        c.messages.messageBubbleRadius +
        'px;border-bottom-left-radius:5px;}',
      '[dir=rtl] .msg.agent .bubble,[dir=rtl] .msg.bot .bubble{border-bottom-left-radius:' +
        c.messages.messageBubbleRadius +
        'px;border-bottom-right-radius:5px;}',
      '[dir=rtl] .card-go svg{transform:rotate(90deg);}',
      '[dir=rtl] .send svg{transform:scaleX(-1);}',
      '[dir=rtl] .file-chip button{margin-left:0;margin-right:auto;}'
    ].join('');
  };

  var ICONS = {
    smile:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/></svg>',
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    close:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    minimize:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4 20-7z"/></svg>',
    paperclip:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
    message:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>',
    chevron:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>'
  };

  Widget.prototype._render = function (this: WidgetInstance) {
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
    this.root = root as ShadowRoot;

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
    // Screen readers read the texts in their language; Arabic runs right to left.
    wrap.setAttribute('lang', this.locale);
    wrap.setAttribute('dir', RTL[this.locale] ? 'rtl' : 'ltr');
    wrap.innerHTML = [
      '<div class="panel" role="dialog" aria-modal="false" ' +
        (showBrand ? 'aria-labelledby="sc-title"' : 'aria-label="' + brand + '"') +
        ' tabindex="-1">',
      '<div class="header">',
      logo,
      '<div class="header-text">',
      showBrand ? '<div class="header-title" id="sc-title">' + brand + '</div>' : '',
      '<div class="header-status"><span class="dot"></span><span class="status-text"></span></div>',
      // Said plainly when a machine answers first, with the way to a person
      // one click away.
      this.remote.assistant
        ? '<div class="assistant-line js-assistant">' +
          escapeHtml(t.assistantLabel) +
          ' · <button class="link-btn js-human">' +
          escapeHtml(t.talkToHuman) +
          '</button></div>'
        : '',
      '</div>',
      c.window.showCloseButton !== false
        ? '<button class="icon-btn js-close" aria-label="' +
          escapeHtml(t.close) +
          '">' +
          ICONS.minimize +
          '</button>'
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
      '<div class="messages js-messages" role="log" aria-live="off"></div>',
      '<div class="sr-only js-announce" aria-live="polite" aria-atomic="true"></div>',
      '<div class="typing js-typing" aria-hidden="true"><i></i><i></i><i></i></div>',
      // The pre-chat / offline form is drawn here when the site asks for it.
      '<div class="contact-wrap js-contact"></div>',
      '<div class="file-chip js-file-chip">',
      ICONS.file,
      '<span class="file-name js-file-name"></span>',
      '<span class="file-size js-file-size"></span>',
      '<button class="js-file-clear" aria-label="' +
        escapeHtml(t.close) +
        '">' +
        ICONS.close +
        '</button>',
      '</div>',
      // Help articles that match what the visitor is typing, before they
      // send it (PRD-10): an answer found here needs no one, and no AI.
      '<div class="suggest js-suggest" role="region" aria-live="polite" aria-label="' +
        escapeHtml(t.suggestTitle) +
        '" hidden></div>',
      '<div class="composer">',
      '<button class="icon-btn js-attach" aria-label="' +
        escapeHtml(t.attach) +
        '" style="color:' +
        c.colors.textSecondary +
        '">' +
        ICONS.paperclip +
        '</button>',
      '<button class="icon-btn js-emoji" aria-label="' +
        escapeHtml(t.emoji) +
        '" aria-haspopup="true" aria-expanded="false" style="color:' +
        c.colors.textSecondary +
        '">' +
        ICONS.smile +
        '</button>',
      '<div class="emoji-pop js-emoji-pop" role="group" aria-label="' +
        escapeHtml(t.emoji) +
        '" hidden></div>',
      '<input type="file" class="js-file-input" hidden />',
      '<textarea class="js-input" rows="1" maxlength="' +
        MAX_MESSAGE_LENGTH +
        '" aria-label="' +
        escapeHtml(t.placeholder) +
        '" placeholder="' +
        escapeHtml(c.messages.placeholderText || t.placeholder) +
        '"></textarea>',
      '<button class="send js-send" aria-label="' +
        escapeHtml(t.send) +
        '" disabled>' +
        ICONS.send +
        '</button>',
      '</div>',
      '</section>',

      '<section class="view help js-view-help" aria-label="' + escapeHtml(t.help) + '">',
      '<div class="search"><input type="search" class="js-search" placeholder="' +
        escapeHtml(t.searchHelp) +
        '" aria-label="' +
        escapeHtml(t.searchHelp) +
        '" /></div>',
      '<div class="faq-list js-faq-list"></div>',
      this.remote && typeof this.remote.helpUrl === 'string'
        ? '<a class="help-all" href="' +
          escapeHtml(this.remote.helpUrl) +
          '" target="_blank" rel="noopener">' +
          escapeHtml(t.helpCenter) +
          '</a>'
        : '',
      '</section>',

      '</div>',
      '<nav class="nav" aria-label="' + escapeHtml(brand) + '">',
      '<button class="js-nav-home active" data-view="home">' +
        ICONS.home +
        '<span>' +
        escapeHtml(t.home) +
        '</span></button>',
      '<button class="js-nav-messages" data-view="messages">' +
        ICONS.message +
        '<span>' +
        escapeHtml(t.messages) +
        '</span></button>',
      this.faqs.length
        ? '<button class="js-nav-help" data-view="help">' +
          ICONS.help +
          '<span>' +
          escapeHtml(t.help) +
          '</span></button>'
        : '',
      '</nav>',
      // The free plan's widget says where it comes from (plan limits,
      // `branding`); paid plans can leave it out.
      this.remote.branding
        ? '<a class="powered" href="' +
          escapeHtml(
            this.config.apiUrl +
              '/?ref=widget&utm_source=widget&utm_medium=referral&site=' +
              shortHash(this.config.siteKey || '')
          ) +
          '" target="_blank" rel="noopener">' +
          escapeHtml(t.poweredBy) +
          '</a>'
        : '',
      '</div>',
      '<button class="launcher js-launcher" aria-label="' +
        escapeHtml(t.launcherLabel) +
        '" aria-expanded="false">',
      '<span class="open-icon">' + ICONS.chat + '</span>',
      '<span class="close-icon">' + ICONS.close + '</span>',
      '<span class="badge" hidden>0</span>',
      '</button>'
    ].join('');

    root.appendChild(wrap);
    document.body.appendChild(host);

    var q = function (sel: string) {
      return wrap.querySelector(sel) as HTMLElement;
    };
    this.el = {
      wrap: wrap,
      panel: q('.panel'),
      launcher: q('.js-launcher'),
      badge: q('.badge'),
      banner: q('.js-banner'),
      statusDot: q('.dot'),
      statusText: q('.status-text'),
      messages: q('.js-messages'),
      announce: q('.js-announce'),
      typing: q('.js-typing'),
      assistantLine: q('.js-assistant'),
      input: q('.js-input'),
      suggest: q('.js-suggest'),
      send: q('.js-send'),
      attach: q('.js-attach'),
      emoji: q('.js-emoji'),
      emojiPop: q('.js-emoji-pop'),
      fileInput: q('.js-file-input'),
      fileChip: q('.js-file-chip'),
      fileName: q('.js-file-name'),
      fileSize: q('.js-file-size'),
      search: q('.js-search'),
      faqList: q('.js-faq-list'),
      faqPreview: q('.js-faq-preview'),
      replyTime: q('.js-reply-time'),
      contact: q('.js-contact'),
      composer: q('.composer'),
      views: {
        home: q('.js-view-home'),
        messages: q('.js-view-messages'),
        help: q('.js-view-help')
      },
      nav: wrap.querySelectorAll('.nav button')
    };

    // --- olay baglamalari ---
    this._listen(this.el.launcher, 'click', function () {
      self.toggle();
    });
    this._listen(document, 'visibilitychange', function () {
      if (!document.hidden && self.isOpen) self._clearTitleAlert();
    });
    this._listen(window, 'popstate', function (e: Event) {
      if (self._ignorePop) {
        self._ignorePop = false;
        return;
      }
      var state = (e as PopStateEvent).state;
      if (self.isOpen && self._phone && self._phone.back && !(state && state.supportChat)) {
        self.close(true);
      }
    });
    var humanBtn = q('.js-human');
    if (humanBtn)
      this._listen(humanBtn, 'click', function () {
        self.requestHuman();
      });
    var closeBtn = q('.js-close');
    if (closeBtn)
      this._listen(closeBtn, 'click', function () {
        self.close();
      });
    this._listen(q('.js-start'), 'click', function () {
      self._setView('messages');
      self.el!.input.focus();
    });

    for (var i = 0; i < this.el.nav.length; i++) {
      this._listen(this.el.nav[i], 'click', function (e) {
        self._setView((e.currentTarget as HTMLElement).getAttribute('data-view'));
      });
    }

    this._listen(this.el.input, 'input', function () {
      var el = self.el!.input;
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
      self.el!.send.disabled = !el.value.trim() && !self.selectedFile;
      self._emitTyping();
      clearTimeout(self._suggestTimer);
      self._suggestTimer = setTimeout(function () {
        self._suggest(el.value);
      }, 250);
    });

    this._listen(this.el.input, 'keydown', function (e) {
      if ((e as KeyboardEvent).key === 'Enter' && !(e as KeyboardEvent).shiftKey) {
        e.preventDefault();
        self.sendMessage();
      }
    });

    this._listen(this.el.send, 'click', function () {
      self.sendMessage();
    });
    this._listen(this.el!.attach, 'click', function () {
      self.el!.fileInput.click();
    });
    if (this.el.emoji) {
      this._listen(this.el.emoji, 'click', function (e: Event) {
        e.stopPropagation();
        self._toggleEmoji();
      });
      this._listen(this.el.emojiPop, 'keydown', function (e: Event) {
        if ((e as KeyboardEvent).key === 'Escape') {
          e.stopPropagation();
          self._toggleEmoji(false);
          self.el!.emoji.focus();
        }
      });
      this._listen(this.el.panel, 'click', function (e: Event) {
        var target = e.target as Node;
        if (!self.el!.emojiPop.contains(target) && target !== self.el!.emoji) {
          self._toggleEmoji(false);
        }
      });
    }
    // A file dropped on the conversation, or an image pasted into the box,
    // is attached as if picked with the paper clip.
    var canAttach = function () {
      return self.view === 'messages' && !self.el!.composer.classList.contains('locked');
    };
    var hasFiles = function (e: Event) {
      var types = (e as DragEvent).dataTransfer && (e as DragEvent).dataTransfer!.types;
      return Boolean(types && Array.prototype.indexOf.call(types, 'Files') !== -1);
    };
    this._listen(this.el.panel, 'dragover', function (e: Event) {
      if (!canAttach() || !hasFiles(e)) return;
      e.preventDefault();
      self.el!.panel.classList.add('dragging');
    });
    this._listen(this.el.panel, 'dragleave', function (e: Event) {
      if (
        (e as DragEvent).relatedTarget &&
        self.el!.panel.contains((e as DragEvent).relatedTarget as Node)
      )
        return;
      self.el!.panel.classList.remove('dragging');
    });
    this._listen(this.el.panel, 'drop', function (e: Event) {
      self.el!.panel.classList.remove('dragging');
      if (!canAttach() || !hasFiles(e)) return;
      e.preventDefault();
      var files = (e as DragEvent).dataTransfer!.files;
      if (files && files[0]) self._pickFile(files[0]);
    });
    this._listen(this.el.input, 'paste', function (e: Event) {
      var items = (e as ClipboardEvent).clipboardData && (e as ClipboardEvent).clipboardData!.items;
      if (!items || !canAttach()) return;
      for (var k = 0; k < items.length; k++) {
        if (items[k].kind === 'file') {
          var pasted = items[k].getAsFile();
          if (pasted) {
            e.preventDefault();
            self._pickFile(pasted);
            return;
          }
        }
      }
    });
    this._listen(this.el.fileInput, 'change', function (e) {
      self._pickFile((e.target as HTMLInputElement).files?.[0]);
    });
    this._listen(q('.js-file-clear'), 'click', function () {
      self._clearFile();
    });

    if (this.el.search) {
      this._listen(this.el.search, 'input', function (e) {
        self._renderFaqs((e.target as HTMLInputElement).value);
      });
    }

    // Esc ile kapat — dialog davranisinin beklenen parcasi.
    this._listen(document, 'keydown', function (e) {
      if ((e as KeyboardEvent).key === 'Escape' && self.isOpen) {
        self.close();
        self.el!.launcher.focus();
      }
    });

    this._renderFaqs('');
    this._renderFaqPreview();
    this._renderConnection();
    this._applyVisibility();
  };

  Widget.prototype._applyVisibility = function (this: WidgetInstance) {
    if (!this.el) return;
    this.el.wrap.hidden = this.isHidden;
  };

  Widget.prototype._setView = function (this: WidgetInstance, view: string | null) {
    if (!view || !this.el || !this.el.views[view]) return;
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
      this._maybeShowContactForm();
    }
  };

  Widget.prototype._renderConnection = function (this: WidgetInstance) {
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
      // 'offline' has no modifier class, and classList.add('') throws a
      // DOMException that aborted the rest of this function — so the status
      // text below never ran and the header kept the previous state.
      var availabilityClass =
        this.availability === 'online' ? 'online' : this.availability === 'away' ? 'away' : '';
      if (availabilityClass) dot.classList.add(availabilityClass);
      text.textContent =
        this.availability === 'online'
          ? t.online
          : this.availability === 'away'
            ? t.away
            : t.offline;
    } else {
      text.textContent = '';
    }

    // Ana ekrandaki eylem kartinin alt metni de uygunluga gore degisir:
    // cevrimdisi bir ekip icin "birkac dakika icinde yanitliyoruz" yazmak
    // ziyaretciye yanlis beklenti verir.
    if (this.el.replyTime) {
      this.el.replyTime.textContent =
        this.availability === 'offline' ? t.replyOffline : t.replyFast;
    }

    // Bant yalnizca gercek bir kopma varken gorunur; her yeniden baglanma
    // denemesinde yanip sonen bir uyari dikkat dagitir.
    if (state === 'disconnected' || state === 'error') {
      this._banner(t.connectionLost, 'error', 0);
    } else if (state === 'connected') {
      this._hideBanner();
    }
  };

  Widget.prototype._banner = function (
    this: WidgetInstance,
    message: string,
    kind?: string,
    autoHideMs?: number
  ) {
    if (!this.el) return;
    var b = this.el.banner;
    b.textContent = message;
    b.className = 'banner show ' + (kind || 'warn');
    if (this._bannerTimer) clearTimeout(this._bannerTimer);
    if (autoHideMs !== 0) {
      var self = this;
      this._bannerTimer = setTimeout(function () {
        self._hideBanner();
      }, autoHideMs || 4000);
    }
  };

  Widget.prototype._hideBanner = function (this: WidgetInstance) {
    if (!this.el) return;
    this.el.banner.className = 'banner';
  };

  Widget.prototype._notice = function (this: WidgetInstance, message: string, kind?: string) {
    this._banner(message, kind, 3500);
  };

  Widget.prototype._renderBadge = function (this: WidgetInstance) {
    if (!this.el) return;
    var behavior = this.remote.config.behavior || {};
    var show = behavior.showUnreadBadge !== false && this.unread > 0 && !this.isOpen;
    this.el.badge.hidden = !show;
    this.el.badge.textContent = this.unread > 99 ? '99+' : String(this.unread);
    this.emit('unread', { count: this.unread });
  };

  Widget.prototype._playSound = function (this: WidgetInstance) {
    var behavior = this.remote.config.behavior || {};
    if (behavior.enableSound === false) return;
    // Harici bir ses dosyasi indirmek yerine WebAudio ile kisa bir ton uretilir:
    // ek istek yok, CORS yok, CSP media-src sorunu yok.
    try {
      var Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;
      this._audio = this._audio || new Ctx();
      var ctx = this._audio;
      if (ctx.state === 'suspended') return; // kullanici henuz etkilesmedi
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.24);
    } catch (e) {
      // No Web Audio, or autoplay is blocked until the visitor interacts. The
      // notification sound is an enhancement; the message still arrives.
    }
  };

  // --- FAQ ------------------------------------------------------------------

  Widget.prototype._renderFaqPreview = function (this: WidgetInstance) {
    if (!this.el || !this.faqs.length) return;
    var top = this.faqs.slice(0, 3);
    var self = this;
    this.el.faqPreview.innerHTML =
      '<h3>' +
      escapeHtml(this.t.help) +
      '</h3>' +
      top
        .map(function (f) {
          return (
            '<div class="faq"><button class="faq-q" data-id="' +
            escapeHtml(f.id) +
            '">' +
            '<span>' +
            escapeHtml(f.question) +
            '</span>' +
            ICONS.chevron +
            '</button></div>'
          );
        })
        .join('');
    var buttons = this.el.faqPreview.querySelectorAll('.faq-q');
    for (var i = 0; i < buttons.length; i++) {
      this._listen(buttons[i], 'click', function () {
        self._setView('help');
      });
    }
  };

  /**
   * Up to three help articles that share words with what the visitor is
   * typing, shown above the box while no conversation has started (PRD-10).
   * Words are compared by their first letters (four or five, as long as the
   * shorter word allows), so "kargom" finds "kargo" and "iadeler" "iade".
   */
  Widget.prototype._suggest = function (this: WidgetInstance, text: string) {
    var box = this.el && this.el.suggest;
    if (!box) return;
    var self = this;
    var words = suggestWords(text);
    if (this.conversationId || !this.faqs.length || !words.length) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    var scored = this.faqs
      .map(function (f) {
        var own = suggestWords(f.question + ' ' + f.answer);
        var hits = 0;
        // A match on a word of five letters or more is a real topic word.
        var strong = false;
        for (var i = 0; i < words.length; i++) {
          for (var k = 0; k < own.length; k++) {
            var n = Math.min(5, own[k].length, words[i].length);
            if (n >= 4 && own[k].slice(0, n) === words[i].slice(0, n)) {
              hits++;
              if (words[i].length >= 5) strong = true;
              break;
            }
          }
        }
        return { faq: f, score: hits / words.length, hits: hits, strong: strong };
      })
      .filter(function (s) {
        return s.hits > 0 && (s.strong || s.score >= 0.5 || s.hits >= 2);
      })
      .sort(function (a, b) {
        return b.hits - a.hits || b.score - a.score;
      })
      .slice(0, 3);
    if (!scored.length) {
      box.hidden = true;
      box.innerHTML = '';
      return;
    }
    box.innerHTML =
      '<p class="suggest-title">' +
      escapeHtml(this.t.suggestTitle) +
      '</p>' +
      scored
        .map(function (s, i) {
          return (
            '<button type="button" class="suggest-item" data-i="' +
            i +
            '">' +
            escapeHtml(s.faq.question) +
            '</button>'
          );
        })
        .join('');
    box.hidden = false;
    var items = box.querySelectorAll('.suggest-item');
    for (var j = 0; j < items.length; j++) {
      this._listen(items[j], 'click', function (e) {
        var pick = scored[Number((e.currentTarget as HTMLElement).getAttribute('data-i'))];
        if (!pick) return;
        box.hidden = true;
        self._setView('help');
        self.el!.search.value = pick.faq.question;
        self._renderFaqs(pick.faq.question);
        var first = self.el!.faqList.querySelector('.faq');
        if (first) first.classList.add('open');
      });
    }
  };

  Widget.prototype._renderFaqs = function (this: WidgetInstance, term?: string) {
    if (!this.el || !this.el.faqList) return;
    var self = this;
    var query = String(term || '')
      .trim()
      .toLowerCase();
    var list = query
      ? this.faqs.filter(function (f) {
          return (f.question + ' ' + f.answer).toLowerCase().indexOf(query) > -1;
        })
      : this.faqs;

    if (!list.length) {
      this.el.faqList.innerHTML =
        '<div class="empty">' +
        escapeHtml(this.faqs.length ? this.t.noResults : this.t.noFaqs) +
        '</div>';
      return;
    }

    this.el.faqList.innerHTML = list
      .map(function (f) {
        return (
          '<div class="faq">' +
          '<button class="faq-q"><span>' +
          escapeHtml(f.question) +
          '</span>' +
          ICONS.chevron +
          '</button>' +
          '<div class="faq-a">' +
          escapeHtml(f.answer) +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    var buttons = this.el.faqList.querySelectorAll('.faq-q');
    for (var i = 0; i < buttons.length; i++) {
      this._listen(buttons[i], 'click', function (e) {
        var faq = (e.currentTarget as HTMLElement).parentNode as HTMLElement;
        var wasOpen = faq.classList.contains('open');
        var all = self.el!.faqList.querySelectorAll('.faq');
        for (var k = 0; k < all.length; k++) all[k].classList.remove('open');
        if (!wasOpen) faq.classList.add('open');
      });
    }
  };

  // --- mesajlar -------------------------------------------------------------

  Widget.prototype._renderThread = function (this: WidgetInstance, messages: WidgetMessage[]) {
    this._renderThreadMessages(messages);
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i].senderType === 'visitor') {
        if ((messages[i] as WidgetMessage & { isRead?: boolean }).isRead) this._markSeen();
        break;
      }
    }
  };

  Widget.prototype._renderThreadMessages = function (
    this: WidgetInstance,
    messages: WidgetMessage[]
  ) {
    if (!this.el) return;
    this.el.messages.innerHTML = '';
    this.seen = Object.create(null);
    for (var i = 0; i < messages.length; i++) this._appendMessage(messages[i], true);
    this._renderEmptyStateIfNeeded();
    this._scrollToEnd();
  };

  Widget.prototype._renderEmptyStateIfNeeded = function (this: WidgetInstance) {
    if (!this.el) return;
    if (this.el.messages.children.length === 0) {
      var notice = this.availability === 'offline' ? this.t.offlineNotice : this.t.emptyThread;
      this.el.messages.innerHTML = '<div class="empty">' + escapeHtml(notice) + '</div>';
    }
  };

  Widget.prototype._appendMessage = function (
    this: WidgetInstance,
    message: WidgetMessage,
    bulk?: boolean
  ) {
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
      // The thread was redrawn while it was on its way: it goes back where
      // the server has it.
      if (!placeholder.node.isConnected) {
        var stale = this.el.messages.querySelector('.empty');
        if (stale) stale.remove();
        this.el.messages.appendChild(placeholder.node);
      }
      // A picture or file was only a name while it uploaded: drawn now as
      // the server stored it, the same as after a reload.
      if (message.fileData && message.fileData.url) {
        var drawn = this._messageNode(message);
        placeholder.node.replaceWith(drawn);
        placeholder.node = drawn;
        this._scrollToEnd();
      }
      return placeholder.node;
    }

    var emptyState = this.el.messages.querySelector('.empty');
    if (emptyState) emptyState.remove();

    var node = this._messageNode(message);
    this.el.messages.appendChild(node);
    if (!bulk) this._scrollToEnd();
    return node;
  };

  /** Reads a message from the other side out to a screen reader (UX-01). */
  Widget.prototype._announce = function (this: WidgetInstance, message: WidgetMessage) {
    var region = this.el && this.el.announce;
    if (!region) return;
    var who =
      message.senderId === 'assistant'
        ? this.t.aiBadge
        : message.senderName || (message.senderType === 'system' ? '' : this.t.supportTeam);
    var text = String(message.content || '').slice(0, 500);
    // Emptied first so the same words twice are still read twice.
    region.textContent = '';
    setTimeout(function () {
      region.textContent = (who ? who + ': ' : '') + text;
    }, 60);
  };

  Widget.prototype._time = function (
    this: WidgetInstance,
    value: string | number | Date | undefined
  ) {
    try {
      return new Date(value as string | number | Date).toLocaleTimeString(this.locale, {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return '';
    }
  };

  Widget.prototype._messageNode = function (this: WidgetInstance, message: WidgetMessage) {
    var c = this.remote.config;
    var type = message.senderType || 'agent';
    var node = document.createElement('div');
    node.className = 'msg ' + type;

    var parts = [];
    // An answer the assistant wrote is marked as such, whatever the site's
    // avatar setting; the first one also says how to reach a person (AI-03).
    var aiAnswer =
      message.senderId === 'assistant' && !(message.assistant && message.assistant.handoff);
    if (aiAnswer) {
      parts.push('<div class="msg-badge">' + escapeHtml(this.t.aiBadge) + '</div>');
    } else if (type !== 'visitor' && c.messages.showAvatars !== false && message.senderName) {
      parts.push('<div class="msg-sender">' + escapeHtml(message.senderName) + '</div>');
    }

    var attachment = '';
    var file = message.fileData;
    if (file && file.url) {
      var url = /^https?:/i.test(file.url) ? file.url : this.config.apiUrl + file.url;
      if (message.messageType === 'image') {
        attachment =
          '<span class="attachment"><a href="' +
          escapeHtml(url) +
          '" target="_blank" rel="noopener noreferrer">' +
          '<img src="' +
          escapeHtml(url) +
          '" alt="' +
          escapeHtml(file.originalName || '') +
          '" /></a></span>';
      } else {
        attachment =
          '<span class="attachment"><a class="file" href="' +
          escapeHtml(url) +
          '" target="_blank" rel="noopener noreferrer">' +
          ICONS.file +
          '<span><span class="file-name">' +
          escapeHtml(file.originalName || 'file') +
          '</span>' +
          '<span class="file-size"> ' +
          escapeHtml(formatBytes(file.size)) +
          '</span></span></a></span>';
      }
    }

    parts.push('<div class="bubble">' + escapeHtml(message.content || '') + attachment + '</div>');
    if (c.messages.showTimestamps !== false) {
      parts.push(
        '<div class="meta">' + escapeHtml(this._time(message.createdAt || Date.now())) + '</div>'
      );
    } else {
      parts.push('<div class="meta"></div>');
    }
    if (aiAnswer && !(this.el && this.el.messages.querySelector('.ai-note'))) {
      parts.push('<div class="ai-note">' + escapeHtml(this.t.aiNote) + '</div>');
    }

    node.innerHTML = parts.join('');
    return node;
  };

  Widget.prototype._scrollToEnd = function (this: WidgetInstance) {
    if (!this.el) return;
    var box = this.el.messages;
    // rAF: DOM guncellemesi tamamlanmadan scrollHeight eski degeri verir.
    requestAnimationFrame(function () {
      box.scrollTop = box.scrollHeight;
    });
  };

  Widget.prototype._showTyping = function (this: WidgetInstance, durationMs?: number) {
    if (!this.el) return;
    this.el.typing.classList.add('show');
    this._scrollToEnd();
    if (this._typingTimer) clearTimeout(this._typingTimer);
    var self = this;
    // Never longer than 10 s: an indicator that outlives the answer it
    // promised is worse than none.
    var ms = Math.min(Number(durationMs) || 3000, 10000);
    this._typingTimer = setTimeout(function () {
      self._hideTyping();
    }, ms);
  };

  Widget.prototype._hideTyping = function (this: WidgetInstance) {
    if (this._typingTimer) clearTimeout(this._typingTimer);
    this._typingTimer = null;
    if (this.el) this.el.typing.classList.remove('show');
  };

  Widget.prototype._hideAssistantLine = function (this: WidgetInstance) {
    if (this.el && this.el.assistantLine) this.el.assistantLine.style.display = 'none';
  };

  /**
   * "Talk to a person". Before the first message there is nothing to hand
   * over yet; the server then starts the conversation with a person instead.
   */
  Widget.prototype.requestHuman = function (this: WidgetInstance) {
    var self = this;
    if (!this.socket || !this.socket.connected || !this._joinedOnce) {
      // Not connected yet (the socket opens on demand): ask once it has.
      this._whenJoined(function () {
        self.requestHuman();
      });
      this._setView('messages');
      return;
    }
    this.socket.emit('request-human');
    this._hideAssistantLine();
    this._setView('messages');
    this.emit('request-human', {});
  };

  Widget.prototype._emitTyping = function (this: WidgetInstance) {
    if (!this.socket || !this.socket.connected || !this.conversationId) return;
    // Her tusa basista emit etmek gereksiz trafik uretir; saniyede bir yeter.
    var now = Date.now();
    if (this._lastTypingAt && now - this._lastTypingAt < 1000) return;
    this._lastTypingAt = now;
    this.socket.emit('typing');
  };

  // ------------------------------------------------------- emoji (UX-04)
  // A fixed handful drawn on first use: no library, no request.
  var EMOJIS = [
    '😀',
    '😄',
    '😊',
    '🙂',
    '😉',
    '😍',
    '😎',
    '🤔',
    '😐',
    '😕',
    '😢',
    '😭',
    '😡',
    '😅',
    '🙈',
    '🤝',
    '👍',
    '👎',
    '👏',
    '🙏',
    '👋',
    '💪',
    '🎉',
    '✨',
    '❤️',
    '🔥',
    '✅',
    '❌',
    '⚠️',
    '❓',
    '💡',
    '⏰',
    '📦',
    '🚚',
    '🛒',
    '💳',
    '🎁',
    '📞',
    '📧',
    '📍'
  ];

  Widget.prototype._toggleEmoji = function (this: WidgetInstance, force?: boolean) {
    if (!this.el || !this.el.emojiPop) return;
    var pop = this.el.emojiPop as HTMLElement;
    var open = force === undefined ? pop.hidden : force;
    if (open && !pop.childElementCount) {
      var self = this;
      for (var i = 0; i < EMOJIS.length; i++) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = EMOJIS[i];
        this._listen(b, 'click', function (e: Event) {
          e.stopPropagation();
          self._insertText((e.currentTarget as HTMLElement).textContent || '');
          self._toggleEmoji(false);
        });
        pop.appendChild(b);
      }
    }
    pop.hidden = !open;
    this.el.emoji.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) (pop.firstElementChild as HTMLElement | null)?.focus();
  };

  /** Puts text at the cursor in the message box, as typing would. */
  Widget.prototype._insertText = function (this: WidgetInstance, text: string) {
    if (!this.el || !text) return;
    var input = this.el.input as HTMLTextAreaElement;
    var start = input.selectionStart == null ? input.value.length : input.selectionStart;
    var end = input.selectionEnd == null ? start : input.selectionEnd;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    var at = start + text.length;
    input.focus();
    try {
      input.setSelectionRange(at, at);
    } catch (e) {
      /* not focusable yet */
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // ------------------------------------------------- "seen" (UX-04)
  /** "Seen" under the visitor's last message: the team has read up to there. */
  Widget.prototype._markSeen = function (this: WidgetInstance) {
    if (!this.el) return;
    var old = this.el.messages.querySelector('.seen');
    if (old) old.remove();
    var mine = this.el.messages.querySelectorAll('.msg.visitor:not(.pending):not(.failed)');
    var last = mine[mine.length - 1];
    if (!last) return;
    var seen = document.createElement('div');
    seen.className = 'seen';
    seen.textContent = this.t.seen;
    last.appendChild(seen);
  };

  // ------------------------------------------- the page's tab (UX-04)
  var TITLE_PREFIX = /^\(\d+\+?\) /;

  /** "(2) Shop" in the tab while answers wait unread, when the site allows it. */
  Widget.prototype._titleAlert = function (this: WidgetInstance) {
    var behavior = (this.remote && this.remote.config.behavior) || {};
    if (behavior.titleAlert === false) return;
    if (this.isOpen && !document.hidden) return;
    this._titleCount = (this._titleCount || 0) + 1;
    var count = this._titleCount > 9 ? '9+' : String(this._titleCount);
    document.title = '(' + count + ') ' + document.title.replace(TITLE_PREFIX, '');
  };

  Widget.prototype._clearTitleAlert = function (this: WidgetInstance) {
    if (!this._titleCount) return;
    this._titleCount = 0;
    document.title = document.title.replace(TITLE_PREFIX, '');
  };

  Widget.prototype._pickFile = function (this: WidgetInstance, file?: File | null) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      this._notice(this.t.fileTooLarge, 'error');
      return;
    }
    if (ALLOWED_MIME.indexOf(file.type) === -1) {
      this._notice(this.t.fileTypeBlocked, 'error');
      return;
    }
    this.selectedFile = file;
    this.el!.fileName.textContent = file.name;
    this.el!.fileSize.textContent = formatBytes(file.size);
    this.el!.fileChip.classList.add('show');
    this.el!.send.disabled = false;
  };

  Widget.prototype._clearFile = function (this: WidgetInstance) {
    this.selectedFile = null;
    if (!this.el) return;
    this.el.fileInput.value = '';
    this.el.fileChip.classList.remove('show');
    this.el.send.disabled = !this.el.input.value.trim();
  };

  /**
   * The team blocked this visitor on the site (SEC-09): the socket closes for
   * good, the composer locks and a polite line stays in its place.
   */
  Widget.prototype._enterBlocked = function (this: WidgetInstance) {
    this._blocked = true;
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch (e) {
        /* already closed */
      }
    }
    if (this.el && this.el.contact) this.el.contact.innerHTML = '';
    this._setComposerLocked(true);
    this._banner(this.t.blocked, 'warn', 0);
    this.emit('error', { code: 'VISITOR_BLOCKED', message: this.t.blocked });
  };

  Widget.prototype.sendMessage = async function (this: WidgetInstance) {
    if (this._blocked) {
      this._banner(this.t.blocked, 'warn', 0);
      return;
    }
    if (this.fatal) {
      this._notice(this.fatal.message, 'error');
      return;
    }
    var content = this.el!.input.value.trim();
    if (!content && !this.selectedFile) return;
    clearTimeout(this._suggestTimer);
    this._suggest('');
    if (content.length > MAX_MESSAGE_LENGTH) {
      this._notice(this.t.tooLong, 'error');
      return;
    }
    // No socket yet (it opens on demand): the message is queued like one
    // written while offline and goes out with the first join.
    this._ensureSocket();

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
    if (!node) return;
    node.classList.add('pending');
    node.querySelector('.meta').textContent = this.t.sending;
    var entry: any = { node: node, content: content, file: file, payload: null };
    this.pending[clientMessageId] = entry;

    this.el!.input.value = '';
    this.el!.input.style.height = 'auto';
    this.el!.send.disabled = true;
    this._clearFile();

    try {
      var payload: {
        content: string;
        senderName: string;
        clientMessageId: string;
        messageType?: string;
        fileData?: Record<string, any>;
      } = {
        content: content,
        senderName:
          (this.identity && this.identity.name) || store.get('sc_visitor_name') || 'Visitor',
        clientMessageId: clientMessageId
      };

      if (file) {
        var uploaded = await this._upload(file);
        payload.messageType = file.type.indexOf('image/') === 0 ? 'image' : 'file';
        payload.fileData = uploaded;
        if (!payload.content) payload.content = file.name;
      }

      entry.payload = payload;
      this._deliver(clientMessageId);
      this.emit('message:sent', { content: payload.content, clientMessageId: clientMessageId });
    } catch (error) {
      delete this.pending[clientMessageId];
      this._markFailed(entry, clientMessageId);
      this._notice(this.t.uploadFailed, 'error');
      this.emit('error', { code: 'SEND_FAILED', message: error.message });
    }
  };

  /**
   * Sends one pending message and settles it on the server's acknowledgement.
   *
   * The message keeps its clientMessageId for every attempt, so a resend of a
   * message the server did store — its acknowledgement lost with the
   * connection — comes back as that same message, never a second one. While
   * the socket is down the message waits and goes out after the re-join.
   */
  Widget.prototype._deliver = function (this: WidgetInstance, clientMessageId: string) {
    var self = this;
    var entry = this.pending[clientMessageId];
    if (!entry || !entry.payload) return;
    if (!this.socket || !this.socket.connected) {
      entry.state = 'waiting';
      return;
    }
    entry.state = 'sending';
    var attempt = (entry.attempt = (entry.attempt || 0) + 1);
    this.socket
      .timeout(ACK_TIMEOUT_MS)
      .emit('send-message', entry.payload, function (err: Error | null, reply: any) {
        var still = self.pending[clientMessageId];
        // Settled by the echo already, or superseded by a resend after a
        // reconnect: that attempt's answer is the one that counts.
        if (!still || still.attempt !== attempt) return;
        if (err) {
          // No answer in time. Offline: wait for the re-join. Online: give the
          // visitor the retry button rather than an endless spinner.
          if (!self.socket || !self.socket.connected) {
            still.state = 'waiting';
            return;
          }
          delete self.pending[clientMessageId];
          self._markFailed(still, clientMessageId);
          return;
        }
        if (reply && reply.ok && reply.message) {
          self._appendMessage(reply.message);
          return;
        }
        delete self.pending[clientMessageId];
        self._markFailed(still, clientMessageId);
        var code = reply && reply.code;
        if (code === 'RATE_LIMITED') self._notice(self.t.rateLimited, 'error');
        else if (code === 'QUOTA_EXCEEDED') self._notice(self.t.quotaExceeded, 'error');
        else if (code === 'SLOW_DOWN') self._notice(self.t.slowDown, 'warn');
        else if (code === 'VISITOR_BLOCKED') self._enterBlocked();
      });
  };

  /**
   * Shows the messages still on their way again after the thread was redrawn
   * (the first join replaces its contents), after what the server already has.
   */
  Widget.prototype._keepPending = function (this: WidgetInstance) {
    if (!this.el) return;
    for (var id in this.pending) {
      var entry = this.pending[id];
      if (!entry || !entry.node || entry.node.isConnected) continue;
      var empty = this.el.messages.querySelector('.empty');
      if (empty) empty.remove();
      this.el.messages.appendChild(entry.node);
    }
  };

  /** Sends again every message still waiting for the connection, in order. */
  Widget.prototype._resendPending = function (this: WidgetInstance) {
    for (var id in this.pending) {
      if (this.pending[id] && this.pending[id].state === 'waiting') this._deliver(id);
    }
  };

  Widget.prototype._markFailed = function (
    this: WidgetInstance,
    entry: any,
    clientMessageId: string
  ) {
    var self = this;
    entry.node.classList.remove('pending');
    entry.node.classList.add('failed');
    var meta = entry.node.querySelector('.meta');
    meta.innerHTML =
      escapeHtml(this.t.failed) +
      ' <button class="retry">' +
      escapeHtml(this.t.retry) +
      '</button>';
    this._listen(meta.querySelector('.retry'), 'click', function () {
      // The same message, the same clientMessageId: if the first attempt did
      // reach the server after all, this one comes back as it.
      if (entry.payload) {
        entry.node.classList.remove('failed');
        entry.node.classList.add('pending');
        meta.textContent = self.t.sending;
        self.pending[clientMessageId] = entry;
        self._deliver(clientMessageId);
        return;
      }
      // The upload itself failed: start over from the composer.
      entry.node.remove();
      delete self.seen[clientMessageId];
      self.el!.input.value = entry.content;
      self.selectedFile = entry.file || null;
      self.el!.send.disabled = false;
      self.sendMessage();
    });
  };

  Widget.prototype._upload = async function (this: WidgetInstance, file: File) {
    var form = new FormData();
    form.append('file', file);
    var res = await this._authFetch('/api/files/upload', { method: 'POST', body: form });
    if (!res.ok) throw new Error('Upload failed with HTTP ' + res.status);
    var data = await res.json();
    return data.file;
  };

  // -------------------------------------------------------------------------
  // 8. Public API
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Pre-chat / offline form, rating and transcript (plan v10 PRD-01/04/05/06)
  // -------------------------------------------------------------------------

  var EMAIL_RX = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
  var PHONE_RX = /^[+0-9 ()-]{5,40}$/;
  var THUMB_UP =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0 4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.3 8A2 2 0 0 1 18.2 21H7"/></svg>';
  var THUMB_DOWN =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-3zm0 0-4 8a3 3 0 0 1-3-3v-4H4.5a2 2 0 0 1-2-2.3l1.3-8A2 2 0 0 1 5.8 3H17"/></svg>';

  Widget.prototype._contactKey = function (this: WidgetInstance) {
    return 'sc_contact_' + this.config.siteKey;
  };

  /** Sends an event and waits for the server's acknowledgement. */
  Widget.prototype._ask = function (this: WidgetInstance, event: string, payload: unknown) {
    var self = this;
    return new Promise(function (resolve) {
      var send = function () {
        self.socket.timeout(10000).emit(event, payload, function (err: Error | null, reply: any) {
          resolve(err ? { ok: false, code: 'TIMEOUT' } : reply || { ok: false });
        });
      };
      if (self.socket && self.socket.connected && self._joinedOnce) send();
      else self._whenJoined(send);
    });
  };

  Widget.prototype._setComposerLocked = function (this: WidgetInstance, locked: boolean) {
    if (!this.el || !this.el.composer) return;
    // A blocked visitor's composer stays locked, whatever a form says.
    if (this._blocked) locked = true;
    this.el.composer.classList.toggle('locked', locked);
    this.el.composer.setAttribute('aria-disabled', locked ? 'true' : 'false');
    this.el.input.disabled = locked;
  };

  /**
   * Shows the form the site asks for, if any: the pre-chat form before the
   * first message (required, or optional with "Skip"), or — while nobody is
   * online — the short form asking for an address to reply to.
   */
  Widget.prototype._maybeShowContactForm = function (this: WidgetInstance) {
    if (!this.el || !this.el.contact) return;
    if (this._blocked) {
      this.el.contact.innerHTML = '';
      this._setComposerLocked(true);
      this._banner(this.t.blocked, 'warn', 0);
      return;
    }
    var chat = this.remote && (this.remote as any).chat;
    if (!chat) return;
    var pre = chat.preChat || { mode: 'off', consent: { mode: 'off' } };
    var verified = Boolean(this.identity && this.identity.userHash);
    var done = store.get(this._contactKey()) === '1' || this._contactSkipped;
    var wantsPre = !verified && !done && !this.conversationId && pre.mode && pre.mode !== 'off';
    var wantsOffline =
      !done &&
      !store.get('sc_visitor_email') &&
      this.availability === 'offline' &&
      chat.offlineForm;
    var mode = this._contactRequired || wantsPre ? 'prechat' : wantsOffline ? 'offline' : null;
    if (!mode) {
      this.el.contact.innerHTML = '';
      this._contactMode = null;
      this._setComposerLocked(false);
      return;
    }
    if (this._contactMode !== mode || !this.el.contact.firstChild) {
      this._contactMode = mode;
      this._renderContactForm(mode, pre);
    }
    var blocking =
      mode === 'prechat' &&
      (this._contactRequired ||
        pre.mode === 'required' ||
        (pre.consent && pre.consent.mode === 'required'));
    this._setComposerLocked(Boolean(blocking));
  };

  Widget.prototype._renderContactForm = function (
    this: WidgetInstance,
    mode: string,
    pre: Record<string, any>
  ) {
    var t = this.t;
    var self = this;
    var offline = mode === 'offline';
    var required = !offline && pre.mode === 'required';
    var opt = ' <span class="opt">(' + escapeHtml(t.optional) + ')</span>';
    var field = function (
      key: string,
      type: string,
      label: string,
      isRequired: boolean,
      value: string
    ) {
      var id = 'sc-' + key;
      return (
        '<label class="field" for="' +
        id +
        '">' +
        escapeHtml(label) +
        (isRequired ? '' : opt) +
        '<input id="' +
        id +
        '" type="' +
        type +
        '" name="' +
        key +
        '" value="' +
        escapeHtml(value || '') +
        '"' +
        (isRequired ? ' required aria-required="true"' : '') +
        ' aria-describedby="sc-err-' +
        key +
        '" autocomplete="' +
        (key === 'email' ? 'email' : key === 'name' ? 'name' : key === 'phone' ? 'tel' : 'off') +
        '" /><span class="err" id="sc-err-' +
        key +
        '"></span></label>'
      );
    };
    var parts = [
      '<form class="contact js-contact-form" novalidate aria-labelledby="sc-contact-title">',
      '<h3 id="sc-contact-title">' +
        escapeHtml(offline ? t.offlineFormTitle : t.preChatTitle) +
        '</h3>',
      '<p class="sub">' + escapeHtml(offline ? t.offlineFormSub : t.preChatSub) + '</p>'
    ];
    var known = {
      name: (this.identity && this.identity.name) || store.get('sc_visitor_name') || '',
      email: (this.identity && this.identity.email) || store.get('sc_visitor_email') || ''
    };
    if (offline || pre.name)
      parts.push(field('name', 'text', t.nameLabel, required && pre.name, known.name));
    if (offline || pre.email) {
      parts.push(
        field('email', 'email', t.emailLabel, offline || (required && pre.email), known.email)
      );
    }
    if (!offline && pre.phone) parts.push(field('phone', 'tel', t.phoneLabel, required, ''));
    var custom: string[] = (!offline && pre.customFields) || [];
    for (var i = 0; i < custom.length; i++) {
      parts.push(field('custom' + i, 'text', custom[i], required, ''));
    }
    var consent = pre.consent || { mode: 'off' };
    if (consent.mode && consent.mode !== 'off') {
      parts.push(
        '<label class="consent"><input type="checkbox" name="consent"' +
          (consent.mode === 'required' ? ' required aria-required="true"' : '') +
          ' aria-describedby="sc-err-consent" /><span>' +
          escapeHtml(t.consentText) +
          (consent.policyUrl
            ? ' <a href="' +
              escapeHtml(consent.policyUrl) +
              '" target="_blank" rel="noopener noreferrer">' +
              escapeHtml(t.consentLink) +
              '</a>'
            : '') +
          '</span></label><span class="err" id="sc-err-consent"></span>'
      );
    }
    parts.push(
      '<div class="actions"><button type="submit" class="btn-primary">' +
        escapeHtml(t.submitForm) +
        '</button>' +
        (!required && consent.mode !== 'required' && !this._contactRequired
          ? '<button type="button" class="btn-link js-skip">' + escapeHtml(t.skipForm) + '</button>'
          : '') +
        '</div></form>'
    );
    this.el!.contact.innerHTML = parts.join('');
    var form = this.el!.contact.querySelector('.js-contact-form') as HTMLFormElement;
    this._listen(form, 'submit', function (e) {
      e.preventDefault();
      self._submitContact(form, custom);
    });
    var skip = this.el!.contact.querySelector('.js-skip');
    if (skip) {
      this._listen(skip, 'click', function () {
        self._contactSkipped = true;
        self._maybeShowContactForm();
        self.el!.input.focus();
      });
    }
  };

  Widget.prototype._submitContact = async function (
    this: WidgetInstance,
    form: HTMLFormElement,
    custom: string[]
  ) {
    var t = this.t;
    var value = function (name: string) {
      var input = form.querySelector('[name="' + name + '"]') as HTMLInputElement | null;
      return input ? input.value.trim() : '';
    };
    var errors: Record<string, string> = {};
    var inputs = form.querySelectorAll('input');
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i] as HTMLInputElement;
      var err = form.querySelector('#sc-err-' + input.name) as HTMLElement | null;
      if (err) err.textContent = '';
      input.removeAttribute('aria-invalid');
      if (input.type === 'checkbox') {
        if (input.required && !input.checked) errors[input.name] = t.consentRequired;
      } else if (input.required && !input.value.trim()) {
        errors[input.name] = t.fieldRequired;
      } else if (
        input.name === 'email' &&
        input.value.trim() &&
        !EMAIL_RX.test(input.value.trim())
      ) {
        errors.email = t.invalidEmail;
      } else if (
        input.name === 'phone' &&
        input.value.trim() &&
        !PHONE_RX.test(input.value.trim())
      ) {
        errors.phone = t.invalidPhone;
      }
    }
    var showErrors = function () {
      var first: HTMLElement | null = null;
      for (var key in errors) {
        var box = form.querySelector('#sc-err-' + key) as HTMLElement | null;
        if (box) box.textContent = errors[key];
        var field = form.querySelector('[name="' + key + '"]') as HTMLElement | null;
        if (field) {
          field.setAttribute('aria-invalid', 'true');
          if (!first) first = field;
        }
      }
      if (first) first.focus();
    };
    if (Object.keys(errors).length) return showErrors();

    var fields: Record<string, string> = {};
    for (var c = 0; c < custom.length; c++) {
      if (value('custom' + c)) fields[custom[c]] = value('custom' + c);
    }
    var consentBox = form.querySelector('[name="consent"]') as HTMLInputElement | null;
    var payload = {
      name: value('name') || undefined,
      email: value('email') || undefined,
      phone: value('phone') || undefined,
      fields: fields,
      consent: Boolean(consentBox && consentBox.checked)
    };
    var reply: any = await this._ask('visitor-contact', payload);
    if (!reply || !reply.ok) {
      if (reply && reply.code === 'PRECHAT_INVALID' && reply.details && reply.details.field) {
        errors[reply.details.field] =
          reply.details.field === 'phone' ? t.invalidPhone : t.invalidEmail;
        return showErrors();
      }
      this._notice((reply && reply.message) || t.uploadFailed, 'error');
      return;
    }
    if (payload.name) store.set('sc_visitor_name', payload.name);
    if (payload.email) store.set('sc_visitor_email', payload.email);
    store.set(this._contactKey(), '1');
    this._contactRequired = false;
    this._maybeShowContactForm();
    this._notice(t.formSaved, 'success');
    this.emit('contact', { name: payload.name || null, email: payload.email || null });
    // A first message the server refused for the form goes out now.
    this._resendPending();
    if (this.el) this.el.input.focus();
  };

  /** The card at the end of a closed conversation: rating, then transcript. */
  Widget.prototype._showEndCard = function (this: WidgetInstance, data: Record<string, any>) {
    if (!this.el) return;
    var t = this.t;
    var self = this;
    var conversationId = data.conversationId || this.conversationId;
    var card = document.createElement('div');
    card.className = 'end-card';
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', t.chatEnded);
    var html = ['<div class="end-title">' + escapeHtml(t.chatEnded) + '</div>'];
    if (data.csat) {
      var choices = '';
      if (data.csat.style === 'stars') {
        for (var n = 1; n <= 5; n++) {
          choices +=
            '<button type="button" class="choice star" aria-pressed="false" data-score="' +
            n +
            '" aria-label="' +
            escapeHtml(String(t.rateStar).replace('{n}', String(n))) +
            '">★</button>';
        }
      } else {
        choices =
          '<button type="button" class="choice" aria-pressed="false" data-score="5">' +
          THUMB_UP +
          '<span>' +
          escapeHtml(t.rateUp) +
          '</span></button>' +
          '<button type="button" class="choice" aria-pressed="false" data-score="1">' +
          THUMB_DOWN +
          '<span>' +
          escapeHtml(t.rateDown) +
          '</span></button>';
      }
      html.push(
        '<div class="js-rate"><p class="sub">' +
          escapeHtml(t.rateTitle) +
          '</p><div class="choices" role="group" aria-label="' +
          escapeHtml(t.rateTitle) +
          '">' +
          choices +
          '</div><textarea class="js-feedback" rows="2" maxlength="1000" aria-label="' +
          escapeHtml(t.feedbackPlaceholder) +
          '" placeholder="' +
          escapeHtml(t.feedbackPlaceholder) +
          '"></textarea><div class="actions"><button type="button" class="btn-primary js-rate-send" disabled>' +
          escapeHtml(t.rateSubmit) +
          '</button></div></div>'
      );
    }
    if (data.transcript) {
      html.push(
        '<div class="js-transcript"><p class="sub">' +
          escapeHtml(t.transcriptSub) +
          '</p><div class="row"><input type="email" class="js-transcript-email" autocomplete="email" aria-label="' +
          escapeHtml(t.emailLabel) +
          '" value="' +
          escapeHtml(store.get('sc_visitor_email') || '') +
          '" /><button type="button" class="btn-primary js-transcript-send">' +
          escapeHtml(t.transcriptSend) +
          '</button></div></div>'
      );
    }
    if (html.length === 1) return;
    card.innerHTML = html.join('');
    this.el.messages.appendChild(card);
    this._scrollToEnd();

    var score = 0;
    var buttons = card.querySelectorAll('.choice');
    var send = card.querySelector('.js-rate-send') as HTMLButtonElement | null;
    for (var b = 0; b < buttons.length; b++) {
      this._listen(buttons[b], 'click', function (e) {
        var target = e.currentTarget as HTMLElement;
        score = Number(target.getAttribute('data-score'));
        for (var k = 0; k < buttons.length; k++) {
          var on =
            data.csat.style === 'stars'
              ? Number(buttons[k].getAttribute('data-score')) <= score
              : buttons[k] === target;
          buttons[k].setAttribute('aria-pressed', on ? 'true' : 'false');
        }
        if (send) send.disabled = false;
      });
    }
    if (send) {
      this._listen(send, 'click', async function () {
        send!.disabled = true;
        var feedback = (card.querySelector('.js-feedback') as HTMLTextAreaElement).value;
        var reply: any = await self._ask('rate-conversation', {
          conversationId: conversationId,
          score: score,
          feedback: feedback
        });
        var rate = card.querySelector('.js-rate') as HTMLElement;
        if (reply && reply.ok) {
          rate.innerHTML = '<p class="done" role="status">' + escapeHtml(t.rateThanks) + '</p>';
          self.emit('rating', { conversationId: conversationId, score: score });
        } else {
          send!.disabled = false;
          self._notice((reply && reply.message) || t.uploadFailed, 'error');
        }
      });
    }
    var transcriptBtn = card.querySelector('.js-transcript-send');
    if (transcriptBtn) {
      this._listen(transcriptBtn, 'click', async function () {
        var input = card.querySelector('.js-transcript-email') as HTMLInputElement;
        var email = input.value.trim();
        if (!EMAIL_RX.test(email)) {
          input.setAttribute('aria-invalid', 'true');
          self._notice(t.invalidEmail, 'error');
          input.focus();
          return;
        }
        (transcriptBtn as HTMLButtonElement).disabled = true;
        var reply: any = await self._ask('request-transcript', {
          conversationId: conversationId,
          email: email
        });
        var box = card.querySelector('.js-transcript') as HTMLElement;
        if (reply && reply.ok) {
          box.innerHTML = '<p class="done" role="status">' + escapeHtml(t.transcriptSent) + '</p>';
        } else {
          (transcriptBtn as HTMLButtonElement).disabled = false;
          self._notice((reply && reply.message) || t.uploadFailed, 'error');
        }
      });
    }
  };

  Widget.prototype.open = function (this: WidgetInstance) {
    if (this.destroyed || !this.el || this.isHidden) return;
    // The visitor is about to talk: now the socket is worth having.
    this._ensureSocket();
    this.isOpen = true;
    this.el.wrap.classList.add('open');
    this.el.launcher.setAttribute('aria-expanded', 'true');
    this._enterPhoneScreen();
    this._clearTitleAlert();
    this.unread = 0;
    this._renderBadge();
    if (this.view === 'messages') this._scrollToEnd();
    // Odagi panele tasi — klavye kullanicisi acildiktan sonra sayfanin
    // basindan devam etmemeli.
    var panel = this.el.panel;
    var input =
      this.view === 'messages' && !this.el.composer.classList.contains('locked')
        ? this.el.input
        : null;
    setTimeout(function () {
      (input || panel).focus();
    }, 50);
    this.emit('open', {});
  };

  Widget.prototype.close = function (this: WidgetInstance, fromBackButton?: boolean) {
    if (this.destroyed || !this.el) return;
    this.isOpen = false;
    this._leavePhoneScreen(Boolean(fromBackButton));
    // Closed from inside (the close button, Esc): the keyboard goes back to
    // the bubble instead of the top of the page.
    var focusInside =
      this.root && this.root.activeElement && this.root.activeElement !== this.el.launcher;
    this.el.wrap.classList.remove('open');
    this.el.launcher.setAttribute('aria-expanded', 'false');
    if (focusInside) this.el.launcher.focus();
    this.emit('close', {});
  };

  // -------------------------------------------------------- phone screen (UX-03)
  //
  // Under 480 px the window fills the screen (CSS). While it does: the page
  // behind does not scroll, the window follows the visual viewport so the
  // on-screen keyboard (iOS Safari) never covers the message box, and the
  // back button (Android) closes the window instead of leaving the page.

  Widget.prototype._enterPhoneScreen = function (this: WidgetInstance) {
    if (this._phone || !this.el) return;
    if (
      typeof window.matchMedia !== 'function' ||
      !window.matchMedia('(max-width:480px)').matches
    ) {
      return;
    }
    var html = document.documentElement;
    var body = document.body;
    var state: NonNullable<WidgetInstance['_phone']> = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body ? body.style.overflow : '',
      fit: null,
      back: false
    };
    html.style.overflow = 'hidden';
    if (body) body.style.overflow = 'hidden';

    var panel = this.el.panel as HTMLElement;
    var vv = window.visualViewport;
    if (vv) {
      var fit = function () {
        panel.style.top = vv!.offsetTop + 'px';
        panel.style.bottom = 'auto';
        panel.style.height = vv!.height + 'px';
      };
      fit();
      vv.addEventListener('resize', fit);
      vv.addEventListener('scroll', fit);
      state.fit = fit;
    }

    if (this.config.backButton !== false) {
      try {
        // The page's own state is kept, so a router that reads it on the
        // way back finds what it wrote.
        var current = window.history.state;
        var mine: Record<string, unknown> = { supportChat: true };
        if (current && typeof current === 'object') {
          for (var key in current) {
            if (Object.prototype.hasOwnProperty.call(current, key)) mine[key] = current[key];
          }
          mine.supportChat = true;
        }
        var push = (this._historyPatch && this._historyPatch.pushState) || window.history.pushState;
        push.call(window.history, mine, '');
        state.back = true;
      } catch (e) {
        // A sandboxed frame without history: the close button still works.
      }
    }
    this._phone = state;
  };

  Widget.prototype._leavePhoneScreen = function (this: WidgetInstance, fromBackButton: boolean) {
    var state = this._phone;
    if (!state) return;
    this._phone = null;
    document.documentElement.style.overflow = state.htmlOverflow;
    if (document.body) document.body.style.overflow = state.bodyOverflow;
    if (state.fit && window.visualViewport) {
      window.visualViewport.removeEventListener('resize', state.fit);
      window.visualViewport.removeEventListener('scroll', state.fit);
    }
    if (this.el) {
      var panel = this.el.panel as HTMLElement;
      panel.style.top = '';
      panel.style.bottom = '';
      panel.style.height = '';
    }
    // Closed with the close button: our history entry goes too, so the next
    // back press leaves the page as the visitor expects.
    if (state.back && !fromBackButton) {
      var top = window.history.state;
      if (top && top.supportChat) {
        this._ignorePop = true;
        window.history.back();
      }
    }
  };

  Widget.prototype.toggle = function (this: WidgetInstance) {
    this.isOpen ? this.close() : this.open();
  };

  Widget.prototype.show = function (this: WidgetInstance) {
    this.isHidden = false;
    this._applyVisibility();
    this.emit('show', {});
  };

  Widget.prototype.hide = function (this: WidgetInstance) {
    this.isHidden = true;
    this.close();
    this._applyVisibility();
    this.emit('hide', {});
  };

  /**
   * Oturum acmis kullaniciyi tanitir.
   *
   * GUVENLIK: Buradaki alanlara tek basina GUVENILMEZ. `userId` ancak magazanin
   * sunucusunun urettigi `userHash` = HMAC_SHA256(kimlik anahtari, userId)
   * sunucuda dogrulanirsa kimlik sayilir (services/identity.ts); panelde
   * "dogrulanmis musteri" rozeti ve konusma gecmisinin geri acilmasi yalnizca
   * bu kimlikle olur. Ad ve e-posta yalnizca gosterim icindir.
   */
  Widget.prototype.identify = function (this: WidgetInstance, user: WidgetIdentity | null) {
    if (!user || typeof user !== 'object') return;
    this.identity = {
      userId: user.userId || (user.id as string | null) || null,
      name: user.name || null,
      email: user.email || null,
      avatar: (user.avatar as string | null) || null,
      userHash: user.userHash || null
    };
    if (this.identity!.name) store.set('sc_visitor_name', String(this.identity!.name));
    if (this.identity!.email) store.set('sc_visitor_email', String(this.identity!.email));

    // Zaten bagliysa sunucudaki ziyaretci kaydi guncellensin.
    if (this.socket && this.socket.connected) this._join();
    this.emit('identify', { user: this.identity });
  };

  /**
   * Kullanici cikis yaptiginda cagrilir. Oturum birakilir ve sunucudan YENI
   * bir ziyaretci kimligi alinir: aksi halde ortak bir bilgisayarda ikinci
   * kullanici, birincinin sohbet gecmisini gorurdu.
   */
  Widget.prototype.logout = async function (this: WidgetInstance) {
    this.identity = null;
    this.attributes = {};
    this.conversationId = null;
    store.remove('sc_visitor_name');
    store.remove('sc_visitor_email');
    store.remove(this._tokenKey());
    this.token = null;
    this.visitorId = null;
    this.sessionId = uid('s');
    this.unread = 0;
    this._renderBadge();
    if (this.el) this._renderThread([]);
    this.emit('logout', {});
    // A new session means a new visitor; the socket reconnects as them.
    if ((await this._session()) && this.socket) {
      this.socket.disconnect();
      this.socket.connect();
    }
  };

  Widget.prototype.setAttributes = function (
    this: WidgetInstance,
    attributes: Record<string, unknown>
  ) {
    if (!attributes || typeof attributes !== 'object') return;
    for (var key in attributes) {
      if (Object.prototype.hasOwnProperty.call(attributes, key))
        this.attributes[key] = attributes[key];
    }
    if (this.socket && this.socket.connected) this._join();
    this.emit('attributes', { attributes: this.attributes });
  };

  Widget.prototype.setLocale = function (
    this: WidgetInstance,
    locale: string | null,
    silent?: boolean
  ) {
    var next = pickLocale(locale);
    var self = this;
    if (!STRINGS[next]) {
      // Not loaded yet: fetched, then drawn — unless another language was
      // asked for meanwhile.
      this._wantedLocale = next;
      loadStrings(next, this.config.apiUrl).then(function (ok) {
        if (ok && self._wantedLocale === next) self.setLocale(locale, false);
      });
      return;
    }
    this._wantedLocale = next;
    var drawn = this.t === STRINGS[next];
    if (next === this.locale && drawn && !silent) return;
    this.locale = next;
    this.t = STRINGS[next];
    if (this.el && (!silent || !drawn)) {
      // Metinleri yeniden ciz. Sohbet gecmisi korunur.
      var openState = this.isOpen;
      var view = this.view;
      var messages = Array.prototype.map.call(this.el.messages.children, function (n) {
        return n;
      });
      this._teardownDom();
      this._render();
      for (var i = 0; i < messages.length; i++) this.el.messages.appendChild(messages[i]);
      this._renderEmptyStateIfNeeded();
      this._setView(view);
      if (openState) this.open();
    }
    this.emit('locale', { locale: next });
  };

  /** The language the site fixed in the panel, or null for "the visitor's". */
  Widget.prototype._siteLanguage = function (
    this: WidgetInstance,
    config: { behavior?: { language?: string } } | null | undefined
  ) {
    var language = config && config.behavior && config.behavior.language;
    return language && LANGUAGES.indexOf(language) > -1 ? language : null;
  };

  /** theme: 'light' | 'dark' | 'auto' — panel arkaplan/metin renklerini cevirir. */
  Widget.prototype.setTheme = function (this: WidgetInstance, theme: string | null) {
    var resolved = theme;
    if (theme === 'auto' || !theme) {
      resolved =
        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
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
    this.theme = resolved as string;
    if (this.el) {
      var styleEl = this.root.querySelector('style');
      if (styleEl) styleEl.textContent = this._css();
    }
    this.emit('theme', { theme: resolved });
  };

  Widget.prototype._teardownDom = function (this: WidgetInstance) {
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
  Widget.prototype.destroy = function (this: WidgetInstance) {
    if (this.destroyed) return;
    this.destroyed = true;
    // The page scrolls again and keeps its history and title as they were.
    this._leavePhoneScreen(false);
    this._clearTitleAlert();

    for (var i = 0; i < this._timers.length; i++) clearTimeout(this._timers[i]);
    this._timers = [];
    if (this._bannerTimer) clearTimeout(this._bannerTimer);
    if (this._typingTimer) clearTimeout(this._typingTimer);

    // history metodlari geri konur. Bunu yapmazsak widget yok olduktan sonra
    // bile host sitenin her yonlendirmesi bizim koddan gecerdi.
    if (this._historyPatch) {
      var self = this;
      Object.keys(this._historyPatch).forEach(function (method) {
        (window.history as any)[method] = (self._historyPatch as Record<string, any>)[method];
      });
      this._historyPatch = null;
    }

    this._teardownDom();

    if (this._presenceBeat) clearInterval(this._presenceBeat);
    this._presenceBeat = null;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    if (this._audio && this._audio.close) {
      try {
        this._audio.close();
      } catch (e) {
        // Already closed by the browser on navigation.
      }
    }

    this.emit('destroy', {});
    this._handlers = {};

    if ((window as any)[NAMESPACE] && (window as any)[NAMESPACE].__runtime === this) {
      delete (window as any)[NAMESPACE].__runtime;
    }
  };

  // -------------------------------------------------------------------------
  // 9. Global arayuz
  //
  // Global alan kirliligi tek bir isimle sinirli: `window.SupportChat`.
  // `window.SupportIO` yalnizca eski entegrasyonlar icin bir takma addir.
  // -------------------------------------------------------------------------

  // Script yuklenmeden once birikmis komutlar. Musteri sitesi su kalibi
  // kullanabilir ve hicbiri kaybolmaz:
  //   (window.SupportChat = window.SupportChat || { q: [] }).q.push(['open']);
  // Yuklendikten sonra da ayni satir calisir: `api.q.push` komutu hemen
  // yurutur. Boylece sitenin kodu script'in yuklenip yuklenmedigini bilmek
  // zorunda kalmaz.
  var queued = ((window as any)[NAMESPACE] && (window as any)[NAMESPACE].q) || [];

  // Calls that arrive before the runtime exists — between this script running
  // and boot(), or before SupportChat.init() under data-defer — are kept and
  // replayed in order once it does. They used to be dropped silently, so an
  // identify() from a React effect that ran first simply never happened.
  var pendingCalls: Array<[string, unknown[]]> = [];
  var MAX_PENDING_CALLS = 50;

  function forward(method: string) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      var runtime = api.__runtime as unknown as Record<string, (...a: unknown[]) => unknown> | null;
      if (runtime) return runtime[method].apply(runtime, args);
      if (pendingCalls.length < MAX_PENDING_CALLS) pendingCalls.push([method, args]);
      return undefined;
    };
  }

  var api: Record<string, any> = {
    version: SDK_VERSION,
    __runtime: null as WidgetInstance | null,

    init: function (overrides?: Partial<WidgetConfig>) {
      if (api.__runtime && !api.__runtime.destroyed) return api.__runtime;
      var widget = new (Widget as unknown as new (config: WidgetConfig) => WidgetInstance)(
        resolveConfig(overrides)
      );
      api.__runtime = widget;
      // `on()` init'ten once cagrilmis olabilir; bekleyen dinleyiciler tasinir.
      for (var i = 0; i < earlyListeners.length; i++) {
        widget.on(earlyListeners[i][0], earlyListeners[i][1]);
      }
      widget.init();
      var calls = pendingCalls;
      pendingCalls = [];
      for (var j = 0; j < calls.length; j++) {
        try {
          (widget as unknown as Record<string, (...a: unknown[]) => unknown>)[calls[j][0]].apply(
            widget,
            calls[j][1]
          );
        } catch (e) {
          // One early call from the host page was malformed; the rest still run.
        }
      }
      return widget;
    },

    open: forward('open'),
    close: forward('close'),
    toggle: forward('toggle'),
    show: forward('show'),
    hide: forward('hide'),
    identify: forward('identify'),
    logout: forward('logout'),
    setAttributes: forward('setAttributes'),
    setLocale: forward('setLocale'),
    setTheme: forward('setTheme'),
    sendMessage: forward('sendMessage'),

    on: function (event: string, handler: EventHandler) {
      if (api.__runtime) return api.__runtime.on(event, handler);
      earlyListeners.push([event, handler]);
      return function () {
        earlyListeners = earlyListeners.filter(function (pair) {
          return !(pair[0] === event && pair[1] === handler);
        });
      };
    },
    off: function (event: string, handler?: EventHandler) {
      api.__runtime && api.__runtime.off(event, handler);
    },

    destroy: function () {
      if (api.__runtime) {
        api.__runtime.destroy();
        api.__runtime = null;
      }
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

  /** on() may be called before init(); those handlers move onto the instance. */
  var earlyListeners: Array<[string, EventHandler]> = [];

  (window as any)[NAMESPACE] = api;
  // Eski API yuzeyi: window.SupportIO.openWidget() cagiran sayfalar bozulmasin.
  (window as any)[LEGACY_NAMESPACE] = (window as any)[LEGACY_NAMESPACE] || {};
  (window as any)[LEGACY_NAMESPACE].openWidget = api.open;
  (window as any)[LEGACY_NAMESPACE].closeWidget = api.close;
  (window as any).SupportIOWidget = { openWidget: api.open, closeWidget: api.close };

  /** Runs one `['method', ...args]` command from the host page. */
  function run(entry: unknown) {
    var method = Array.isArray(entry) ? entry[0] : entry;
    var args = Array.isArray(entry) ? entry.slice(1) : [];
    if (typeof method === 'string' && method !== 'q' && typeof api[method] === 'function') {
      try {
        api[method].apply(null, args);
      } catch (e) {
        // One queued call from the host page was malformed. The remaining
        // queued calls still run; throwing here would abandon them.
      }
    }
  }

  api.q = {
    push: function () {
      for (var i = 0; i < arguments.length; i++) run(arguments[i]);
      return 0;
    }
  };

  // Kuyruktaki komutlari isle.
  function drain() {
    for (var i = 0; i < queued.length; i++) run(queued[i]);
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
