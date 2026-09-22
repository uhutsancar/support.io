// Oturumun tarayıcı tarafındaki yüzü.
//
// Token artık burada tutulmuyor. Eskiden `localStorage.token` içinde yedi
// günlük tam yetkili bir JWT duruyordu; orayı sayfada çalışan her script
// okuyabilir, yani tek bir XSS bütün oturumu dışarı taşıyabilirdi. Token
// bugün `httpOnly` bir çerezde ve JavaScript onu hiç göremiyor — tarayıcı her
// isteğe kendisi ekliyor.
//
// Geriye tek bir iş kalıyor: çerezle gelen kimlik tarayıcı tarafından
// kendiliğinden eklendiği için, isteğin gerçekten panelden geldiğini
// göstermek gerekiyor. Sunucu okunabilir bir `sc_csrf` çerezi bırakıyor; onu
// okuyup başlığa koyuyoruz. Başka bir köken bu çerezi okuyamadığı için aynı
// başlığı üretemez.

const CSRF_COOKIE = 'sc_csrf';
export const CSRF_HEADER = 'X-CSRF-Token';

/** Sunucunun bıraktığı CSRF eşini okur. */
export function csrfToken(): string | null {
  const prefix = `${CSRF_COOKIE}=`;
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) return decodeURIComponent(trimmed.slice(prefix.length));
  }
  return null;
}

/** Oturumun açık sayılıp sayılmayacağı. Token okunamadığı için, panelin
 *  elindeki tek işaret CSRF eşinin varlığı; gerçek doğrulama her istekte
 *  sunucuda yapılıyor. */
export function hasSession(): boolean {
  return csrfToken() !== null;
}

/**
 * Eski sürümlerin localStorage'a yazdığı oturum verisini temizler.
 *
 * İkisi de artık hiç yazılmıyor:
 *   token  tam yetkili JWT — httpOnly çereze taşındı
 *   user   e-posta, ad, rol, organizasyon — yalnızca bellekte yaşıyor ve her
 *          açılışta sunucudan (/api/auth/me) geliyor
 * Kalıcı depoda durduklarında sayfadaki her script, tarayıcı eklentileri ve
 * çıkış isteği başarısız olmuşsa ortak bilgisayarı kullanan bir sonraki kişi
 * onları okuyabiliyordu. Daha önce giriş yapılmış tarayıcılarda kalmış
 * olabilecekleri için açılışta siliniyorlar.
 */
export function purgeLegacyStorage(): void {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch {
    /* depolama kapalıysa yapacak bir şey yok */
  }
}
