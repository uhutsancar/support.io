/**
 * Support.io marka kimliği.
 *
 * Mark: marka renginde yuvarlatılmış kare, içinde beyaz bir konuşma balonu
 * ve balonun içinde "yazıyor" üç noktası. Önceki işaret üst üste binmiş iki
 * balondu; küçük boyutta karışıyor ve leke gibi duruyordu. Bu geometri
 * header'da, panelde, favicon'da ve uygulama ikonlarında birebir aynıdır
 * (scripts/build-icons.ts aynı ölçüleri çizer) — her yerde tek logo.
 *
 * Neden bileşen, neden .webp değil: SVG bileşeni `currentColor` üzerinden
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
    {/* konuşma balonu ve kuyruğu */}
    <rect x="8" y="9.5" width="24" height="17" rx="6.5" fill="#fff" />
    <path d="M12.5 24L11.5 31.5L19 26z" fill="#fff" />
    {/* "yazıyor" noktaları */}
    <circle cx="14.5" cy="18" r="2.1" fill={color} />
    <circle cx="20" cy="18" r="2.1" fill={color} />
    <circle cx="25.5" cy="18" r="2.1" fill={color} />
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
