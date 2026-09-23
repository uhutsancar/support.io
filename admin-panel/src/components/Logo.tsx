/**
 * Support.io marka kimliği.
 *
 * Mark, üst üste binmiş iki konuşma balonundan oluşur: arkadaki yarı saydam
 * balon ziyaretçiyi, öndeki dolu balon destek ekibini temsil eder. Aradaki
 * boşluk (ring) marka renginde çizilerek iki balonun 16px'te bile ayrı
 * okunması sağlanır — favicon boyutunda birleşip lekeye dönüşmemesinin sebebi
 * budur.
 *
 * Neden bileşen, neden .webp değil:
 * Eskiden sidebar'da `support.io_logo.webp` kullanılıyordu ve yanında
 * `dark:invert-0` yazıyordu — bu sınıf hiçbir şey yapmaz, yani logo koyu temada
 * da açık tema rengiyle duruyordu. SVG bileşeni `currentColor` üzerinden
 * temayla birlikte döner ve her boyutta keskin kalır.
 */

const BRAND = '#4F46E5';

export const LogoMark = ({
  size = 32,
  color = BRAND,
  rounded = true,
  className = '',
  title
}: {
  title?: any;
  [prop: string]: any;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    role={title ? 'img' : 'presentation'}
    aria-label={title}
    aria-hidden={title ? undefined : true}
  >
    {rounded && <rect width="40" height="40" rx="11" fill={color} />}
    {/* arka balon — ziyaretçi */}
    <rect x="7" y="6.5" width="19" height="14" rx="5.5" fill="#fff" fillOpacity="0.45" />
    {/* ayırıcı boşluk: öndeki balonun konturu yerine marka renginde bir kesit */}
    <rect x="12.2" y="12.3" width="21.6" height="17" rx="7" fill={color} />
    {/* ön balon — destek ekibi, kuyruğuyla birlikte */}
    <path
      d="M19 13.5h8a5.5 5.5 0 0 1 5.5 5.5v3.5a5.5 5.5 0 0 1-5.5 5.5h-4.3l-6.5 4.8a.6.6 0 0 1-.95-.6l1.2-4.35A5.5 5.5 0 0 1 13.5 22.5V19a5.5 5.5 0 0 1 5.5-5.5z"
      fill="#fff"
    />
  </svg>
);

/**
 * Yatay kilit: mark + kelime markası.
 * Kelime markası `currentColor` kullanır, böylece açık/koyu temada ayrı bir
 * dosya gerekmez.
 */
const Logo = ({ size = 30, className = '', showWordmark = true, color = BRAND }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <LogoMark size={size} color={color} title="Support.io" />
    {showWordmark && (
      <span
        className="font-semibold tracking-[-0.02em] text-gray-900 dark:text-white leading-none"
        style={{ fontSize: Math.round(size * 0.62) }}
      >
        Support<span className="text-indigo-600 dark:text-indigo-400">.io</span>
      </span>
    )}
  </span>
);

export default Logo;
