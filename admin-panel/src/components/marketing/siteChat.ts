/**
 * Pazarlama sitesindeki sohbet balonu — ürünün kendisi.
 *
 * Sayfalarda "sorunuz varsa sohbetten yazın" yazıyordu ama sitede hiçbir
 * widget kurulu değildi. Artık `VITE_SUPPORT_SITE_KEY` tanımlıysa müşterilere
 * verdiğimiz aynı tek satır (`/widget.js` + `data-site-key`) burada da
 * yüklenir; gelen mesajlar o sitenin panelindeki gelen kutusuna düşer.
 *
 * Panel de aynı SPA'nın içinde. Balon panele geçince yalnızca gizlenmiyor,
 * tamamen kapatılıyor (destroy): gizli bir balon soketini açık tutuyor, panel
 * kullanıcısını sitenin ziyaretçisi gibi sayıyor ve gelen bir mesajla panelin
 * üstünde yeniden açılabiliyordu. Siteye dönünce aynı script'ten yeniden
 * başlatılır (init); script bir kez yüklenir, ikinci kez eklemek ikinci bir
 * kopya çalıştırırdı.
 */
import { useEffect } from 'react';

interface SupportChatApi {
  __runtime?: unknown;
  init(): void;
  destroy(): void;
  open(): void;
  show(): void;
  setLocale(locale: string): void;
}

const SCRIPT_ID = 'supportio-site-chat';
const siteKey = import.meta.env.VITE_SUPPORT_SITE_KEY as string | undefined;

/** Kaç pazarlama kabuğu açık — yükleme bitene kadar kabuk kapanmış olabilir. */
let mounted = 0;

/**
 * Sayfadan sayfaya geçerken eski kabuk kapanır, yenisi hemen ardından açılır
 * (yavaş bir sayfa parçası yüklenirken biraz sonra). Kapatma bu yüzden
 * kısa bir süre bekler: yeni bir pazarlama sayfası gelirse iptal edilir ve
 * açık sohbet kopmaz; panele geçildiyse balon kapanır.
 */
const DESTROY_DELAY_MS = 1500;
let destroyTimer: ReturnType<typeof setTimeout> | null = null;

const api = (): SupportChatApi | undefined =>
  (window as unknown as { SupportChat?: SupportChatApi }).SupportChat;

function load(language: string) {
  if (document.getElementById(SCRIPT_ID)) return;
  const origin = (import.meta.env.VITE_API_URL as string | undefined) || window.location.origin;
  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.src = origin.replace(/\/+$/, '') + '/widget.js';
  script.async = true;
  script.dataset.siteKey = siteKey;
  script.dataset.locale = language;
  // Yükleme sürerken ziyaretçi panele geçtiyse balon orada açılmasın.
  script.onload = () => {
    if (mounted === 0) api()?.destroy();
  };
  document.body.appendChild(script);
}

/** Balon yalnızca pazarlama kabuğu açıkken vardır. */
export function useSiteChat(language: string) {
  useEffect(() => {
    if (!siteKey) return undefined;
    mounted += 1;
    if (destroyTimer) {
      clearTimeout(destroyTimer);
      destroyTimer = null;
    }
    const chat = api();
    if (!document.getElementById(SCRIPT_ID)) load(language);
    else if (chat && !chat.__runtime) chat.init();
    return () => {
      mounted -= 1;
      if (mounted > 0) return;
      destroyTimer = setTimeout(() => {
        destroyTimer = null;
        if (mounted === 0) api()?.destroy();
      }, DESTROY_DELAY_MS);
    };
    // Dil aşağıdaki efektte izlenir; burada yalnızca ilk yüklemenin dili lazım.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (siteKey && api()?.__runtime) api()?.setLocale(language);
  }, [language]);
}

/** True when the page has a real chat to open. */
export const siteChatAvailable = Boolean(siteKey);

/**
 * "Ekibimizle konuşun" bağlantıları için. Balon yoksa (anahtar tanımsız ya da
 * henüz yüklenmedi) false döner ve çağıran e-postaya düşer.
 */
export function openSiteChat(): boolean {
  const chat = api();
  if (!chat?.__runtime) return false;
  chat.show();
  chat.open();
  return true;
}
