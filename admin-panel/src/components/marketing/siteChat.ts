/**
 * Pazarlama sitesindeki sohbet balonu — ürünün kendisi.
 *
 * Sayfalarda "sorunuz varsa sohbetten yazın" yazıyordu ama sitede hiçbir
 * widget kurulu değildi. Artık `VITE_SUPPORT_SITE_KEY` tanımlıysa müşterilere
 * verdiğimiz aynı tek satır (`/widget.js` + `data-site-key`) burada da
 * yüklenir; gelen mesajlar o sitenin panelindeki gelen kutusuna düşer.
 *
 * Panel de aynı SPA'nın içinde olduğu için balon panele geçince gizlenir,
 * siteye dönünce yeniden görünür. Script bir kez yüklenir; ikinci kez
 * eklemek ikinci bir soket bağlantısı açardı.
 */
import { useEffect } from 'react';

interface SupportChatApi {
  __runtime?: unknown;
  open(): void;
  show(): void;
  hide(): void;
  setLocale(locale: string): void;
}

const SCRIPT_ID = 'supportio-site-chat';
const siteKey = import.meta.env.VITE_SUPPORT_SITE_KEY as string | undefined;

/** Kaç pazarlama kabuğu açık — yükleme bitene kadar kabuk kapanmış olabilir. */
let mounted = 0;

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
    if (mounted === 0) api()?.hide();
  };
  document.body.appendChild(script);
}

/** Balonu pazarlama kabuğu açıkken gösterir. */
export function useSiteChat(language: string) {
  useEffect(() => {
    if (!siteKey) return undefined;
    mounted += 1;
    if (api()?.__runtime) api()?.show();
    else load(language);
    return () => {
      mounted -= 1;
      if (mounted === 0) api()?.hide();
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
