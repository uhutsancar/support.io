/**
 * Pazarlama sayfalarının tasarım kiti.
 *
 * Neden var: önceden her sayfa kendi butonunu, kendi başlık boyutunu ve kendi
 * bölüm dolgusunu elle yazıyordu. Aynı sitede üç farklı buton yüksekliği ve
 * dört farklı başlık ölçeği vardı; sayfaların birbirine yabancı görünme sebebi
 * tek tek "kötü" olmaları değil, ortak bir ölçeğin hiç olmamasıydı.
 *
 * Buradaki her parça hem açık hem koyu temada tanımlıdır. Bir rengin yalnızca
 * `dark:` altında tanımlandığı tek bir yer yoktur.
 */

/* ------------------------------------------------------------------ renkler */

/**
 * Özellik ailelerinin renkleri. Panelin kendi kart renkleriyle aynıdır;
 * ziyaretçi sitede gördüğü moru panelde de mor olarak bulur.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';

export const ACCENTS = {
  indigo: {
    text: 'text-indigo-600 dark:text-indigo-400',
    bg: 'bg-indigo-600',
    soft: 'bg-indigo-50 dark:bg-indigo-500/10',
    softText: 'text-indigo-700 dark:text-indigo-300',
    ring: 'ring-indigo-500/20',
    border: 'border-indigo-200 dark:border-indigo-500/25',
    dot: 'bg-indigo-500'
  },
  violet: {
    text: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-600',
    soft: 'bg-violet-50 dark:bg-violet-500/10',
    softText: 'text-violet-700 dark:text-violet-300',
    ring: 'ring-violet-500/20',
    border: 'border-violet-200 dark:border-violet-500/25',
    dot: 'bg-violet-500'
  },
  sky: {
    text: 'text-sky-600 dark:text-sky-400',
    bg: 'bg-sky-600',
    soft: 'bg-sky-50 dark:bg-sky-500/10',
    softText: 'text-sky-700 dark:text-sky-300',
    ring: 'ring-sky-500/20',
    border: 'border-sky-200 dark:border-sky-500/25',
    dot: 'bg-sky-500'
  },
  emerald: {
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-600',
    soft: 'bg-emerald-50 dark:bg-emerald-500/10',
    softText: 'text-emerald-700 dark:text-emerald-300',
    ring: 'ring-emerald-500/20',
    border: 'border-emerald-200 dark:border-emerald-500/25',
    dot: 'bg-emerald-500'
  },
  amber: {
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500',
    soft: 'bg-amber-50 dark:bg-amber-500/10',
    softText: 'text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-500/20',
    border: 'border-amber-200 dark:border-amber-500/25',
    dot: 'bg-amber-500'
  },
  rose: {
    text: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-600',
    soft: 'bg-rose-50 dark:bg-rose-500/10',
    softText: 'text-rose-700 dark:text-rose-300',
    ring: 'ring-rose-500/20',
    border: 'border-rose-200 dark:border-rose-500/25',
    dot: 'bg-rose-500'
  }
};

/** The accent families the marketing pages colour sections with. */
export type AccentTone = keyof typeof ACCENTS;

export const accent = (name: string | undefined): (typeof ACCENTS)['indigo'] =>
  ACCENTS[name as AccentTone] || ACCENTS.indigo;

/**
 * `t(key, { returnObjects: true })` bir dizi bekler ama anahtar eksikse
 * i18next ANAHTARIN KENDISINI, yani bir string dondurur. Ustune `.map`
 * cagrilinca React agaci patlar ve sayfa tamamen beyaz kalir -- tek bir
 * cevirinin eksik olmasi butun sayfayi dusurmemeli.
 */
export const asList = <TItem = any,>(value: unknown): TItem[] => (Array.isArray(value) ? value : []);

/* ------------------------------------------------------------------ butonlar */

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ' +
  'dark:focus-visible:ring-offset-gray-950 disabled:opacity-60 disabled:pointer-events-none';

const BUTTON_SIZE = {
  sm: 'px-3.5 py-2 text-[13.5px]',
  md: 'px-5 py-2.5 text-[14.5px]',
  lg: 'px-6 py-3.5 text-[15px]'
};

const BUTTON_VARIANT = {
  // Ana eylem marka rengindedir. Eskiden siyahtı: logosu indigo olan bir sitede
  // birincil butonun nötr siyah olması markayı sayfadan siliyordu.
  primary:
    'bg-indigo-600 text-white shadow-[0_8px_20px_-8px_rgba(79,70,229,.6)] ' +
    'hover:bg-indigo-700 hover:shadow-[0_12px_28px_-8px_rgba(79,70,229,.7)] active:translate-y-px',
  secondary:
    'bg-white dark:bg-white/[0.04] text-gray-800 dark:text-gray-200 ' +
    'border border-gray-200 dark:border-white/10 ' +
    'hover:bg-gray-50 dark:hover:bg-white/[0.08] hover:border-gray-300 dark:hover:border-white/20 active:translate-y-px',
  ghost:
    'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white ' +
    'hover:bg-gray-100 dark:hover:bg-white/[0.06]',
  inverse:
    'bg-white text-indigo-700 hover:bg-indigo-50 active:translate-y-px ' +
    'shadow-[0_8px_24px_-10px_rgba(0,0,0,.5)]'
};

/** A button that renders as a router link, an anchor or any element. */
export interface ButtonProps extends Record<string, any> {
  as?: React.ElementType;
  to?: string;
  href?: string;
  variant?: keyof typeof BUTTON_VARIANT;
  size?: keyof typeof BUTTON_SIZE;
  className?: string;
  children?: React.ReactNode;
  /** Appends the trailing arrow used on calls to action. */
  arrow?: boolean;
}

export const Button = ({
  as, to, href, variant = 'primary', size = 'md', className = '', children, arrow = false, ...rest
}: ButtonProps) => {
  const cls = [BUTTON_BASE, BUTTON_SIZE[size], BUTTON_VARIANT[variant], className].join(' ');
  const inner = (
    <>
      {children}
      {arrow && <ArrowRight className="w-4 h-4 shrink-0" />}
    </>
  );
  if (to) return <Link to={to} className={cls} {...rest}>{inner}</Link>;
  if (href) return <a href={href} className={cls} {...rest}>{inner}</a>;
  const Tag = as || 'button';
  return <Tag className={cls} {...rest}>{inner}</Tag>;
};

/** Ok işareti hover'da ilerleyen metin bağlantısı. */
export const TextLink = ({ to, href, children, tone = 'indigo', className = '' }: {
  to?: string;
  href?: string;
  children?: React.ReactNode;
  /** An accent name; anything unknown falls back to indigo (see `accent`). */
  tone?: string;
  className?: string;
}) => {
  const a = accent(tone);
  const cls = ['group inline-flex items-center gap-1.5 text-[14.5px] font-medium', a.text, className].join(' ');
  const inner = (
    <>
      {children}
      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
    </>
  );
  return href
    ? <a href={href} className={cls}>{inner}</a>
    : <Link to={to || ''} className={cls}>{inner}</Link>;
};

/* ------------------------------------------------------------------ tipografi */

/**
 * Bölüm etiketi.
 *
 * Düz metin. Eskiden yuvarlak köşeli, pastel zeminli, minik büyük harfli bir
 * "çip"ti — yanında bazen nabız gibi atan renkli bir nokta da olurdu. O biçim
 * artık hazır şablon işareti olarak okunuyor: sayfa tasarlanmış değil,
 * bileşen kataloğundan dizilmiş gibi görünüyor. Renk, metnin kendisinde
 * kalıyor; kutuya ihtiyaç yok.
 */
export const Eyebrow = ({ children, tone = 'indigo', className = '' }: {
  children?: React.ReactNode;
  tone?: string;
  className?: string;
}) => {
  const a = accent(tone);
  return (
    <span className={[
      'block text-[12px] font-semibold uppercase tracking-[0.1em]',
      a.text, className
    ].join(' ')}>
      {children}
    </span>
  );
};

/** Bölüm başlığı. `align="center"` yalnızca kısa başlıklar için. */
export const SectionHead = ({ eyebrow, eyebrowTone, title, description, align = 'left', className = '' }: {
  eyebrow?: React.ReactNode;
  eyebrowTone?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) => (
  <div className={[align === 'center' ? 'text-center mx-auto max-w-2xl' : 'max-w-3xl', className].join(' ')}>
    {eyebrow && <Eyebrow tone={eyebrowTone}>{eyebrow}</Eyebrow>}
    {title && (
      <h2 className={[
        eyebrow ? 'mt-4' : '',
        'text-[30px] sm:text-[38px] font-semibold tracking-[-0.03em] leading-[1.12]',
        'text-gray-900 dark:text-white'
      ].join(' ')}>
        {title}
      </h2>
    )}
    {description && (
      <p className={[
        'mt-4 text-[16.5px] leading-[1.65] text-gray-600 dark:text-gray-400 max-w-[60ch]',
        align === 'center' ? 'mx-auto' : ''
      ].join(' ')}>
        {description}
      </p>
    )}
  </div>
);

/* -------------------------------------------------------------------- bölüm */

const TONE_BG = {
  plain: 'bg-white dark:bg-surface-dark',
  subtle: 'bg-surface-subtle dark:bg-surface-darkSubtle',
  // Koyu şerit: sayfanın ritmini kıran, dikkat toplayan bölümler için.
  deep: 'bg-gray-950 dark:bg-black text-white'
};

export const Section = ({
  tone = 'plain', bordered = false, id, className = '', innerClassName = '', children, size = 'md'
}: {
  tone?: keyof typeof TONE_BG;
  bordered?: boolean;
  id?: string;
  className?: string;
  innerClassName?: string;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const pad = size === 'sm' ? 'py-14 sm:py-16' : size === 'lg' ? 'py-24 sm:py-32' : 'py-20 sm:py-24';
  return (
    <section
      id={id}
      className={[
        TONE_BG[tone], pad, 'px-5 sm:px-8',
        bordered ? 'border-t border-gray-200/80 dark:border-white/[0.07]' : '',
        className
      ].join(' ')}
    >
      <div className={['max-w-6xl mx-auto', innerClassName].join(' ')}>{children}</div>
    </section>
  );
};

/* -------------------------------------------------------------------- kartlar */

export const Card = ({ className = '', children, hover = false, as: Tag = 'div', ...rest }: {
  className?: string;
  children?: React.ReactNode;
  hover?: boolean;
  as?: React.ElementType;
} & Record<string, any>) => (
  <Tag
    className={[
      'rounded-2xl border border-gray-200/90 dark:border-white/[0.08] bg-white dark:bg-white/[0.025]',
      hover ? 'transition-all hover:border-gray-300 dark:hover:border-white/20 hover:shadow-panel' : '',
      className
    ].join(' ')}
    {...rest}
  >
    {children}
  </Tag>
);

/**
 * Özellik ikonu.
 *
 * Çıplak çizgi ikon. Eskiden her ikon pastel zeminli yuvarlak bir karonun
 * içindeydi; sayfada yirmi tane yan yana durunca tasarım değil, şablon
 * görünüyordu. Karo yalnızca panelin GERÇEKTEN karo kullandığı yerde
 * (gösterge kartları) kalır — bkz. `SolidIcon`.
 */
export const AccentIcon = ({ icon: Icon, tone = 'indigo', size = 'md', className = '' }: {
  icon: React.ElementType;
  tone?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) => {
  const a = accent(tone);
  const ico = size === 'sm' ? 'w-[18px] h-[18px]' : size === 'lg' ? 'w-6 h-6' : 'w-[21px] h-[21px]';
  return <Icon className={[ico, a.text, 'shrink-0', className].join(' ')} strokeWidth={1.75} />;
};

/** İçi dolu marka renkli karo — panelin gösterge kartlarındaki ile aynı. */
export const SolidIcon = ({ icon: Icon, tone = 'indigo', className = '' }: {
  icon: React.ElementType;
  tone?: string;
  className?: string;
}) => {
  const a = accent(tone);
  return (
    <span className={[
      'inline-flex items-center justify-center shrink-0 w-11 h-11 rounded-xl',
      a.bg, 'shadow-[0_6px_16px_-6px_rgba(15,18,40,.45)]', className
    ].join(' ')}>
      <Icon className="w-5 h-5 text-white" strokeWidth={2.1} />
    </span>
  );
};

/* ------------------------------------------------------------- sayı & rozet */

/**
 * Küçük rozet (plan adı, kurulum süresi).
 *
 * Çerçeveli ve nötr. Pastel dolgulu hâli, sayfadaki diğer pastel çiplerle
 * birlikte her şeyi aynı hazır bileşenden çıkmış gösteriyordu.
 */
export const Pill = ({ children, tone = 'indigo', className = '' }: {
  children?: React.ReactNode;
  tone?: string;
  className?: string;
}) => (
  <span className={[
    'inline-flex items-center gap-1.5 px-2 py-[3px] rounded text-[11.5px] font-medium',
    'border border-gray-200 dark:border-white/15 text-gray-600 dark:text-gray-400',
    className
  ].join(' ')}>
    {children}
  </span>
);

/* -------------------------------------------------------------------- akordeon */

/** One question/answer pair in an Accordion. */
export interface AccordionItem {
  q?: React.ReactNode;
  a?: React.ReactNode;
  [field: string]: any;
}

export const Accordion = ({ items }: { items: AccordionItem[] }) => (
  <div className="divide-y divide-gray-200 dark:divide-white/[0.07] border-y border-gray-200 dark:border-white/[0.07]">
    {items.map((item, i) => (
      <details key={i} className="group">
        <summary
          className="flex items-start justify-between gap-6 py-5 cursor-pointer list-none
            text-[16px] font-medium text-gray-900 dark:text-white
            hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >
          {item.q}
          <Plus className="w-4 h-4 mt-1 shrink-0 text-gray-400 transition-transform duration-200 group-open:rotate-45" />
        </summary>
        <div className="pb-6 -mt-1 text-[14.5px] leading-[1.7] text-gray-600 dark:text-gray-400 max-w-[68ch]">
          {item.a}
        </div>
      </details>
    ))}
  </div>
);

/* -------------------------------------------------------------------- sekmeler */

/**
 * Erişilebilir sekme grubu: ok tuşlarıyla gezilir, seçili sekme `aria-selected`
 * taşır ve panel `role="tabpanel"` ile bağlanır.
 */
/** One tab: the id it is selected by, plus what is shown on it. */
export interface TabItem {
  id: string;
  label?: React.ReactNode;
  icon?: React.ElementType;
  [field: string]: any;
}

export const Tabs = ({ items, active, onChange, className = '' }: {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) => {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = items.length - 1;
    const i = items.findIndex((it) => it.id === active);
    let next = null;
    if (e.key === 'ArrowRight') next = i === last ? 0 : i + 1;
    if (e.key === 'ArrowLeft') next = i === 0 ? last : i - 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = last;
    if (next === null) return;
    e.preventDefault();
    onChange(items[next].id);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={[
        // Alt çizgili sekme — tarayıcıdan bilgisayara herkesin tanıdığı biçim.
        // Eskiden seçili sekme pastel dolgulu yuvarlak bir kutuydu; sayfadaki
        // diğer pastel çiplerle birlikte tasarımı şablona çeviriyordu.
        'flex gap-6 overflow-x-auto border-b border-gray-200 dark:border-white/[0.09]',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className
      ].join(' ')}
    >
      {items.map((item, i) => {
        const selected = item.id === active;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            ref={(el) => (refs.current[i] = el)}
            role="tab"
            id={'tab-' + item.id}
            aria-selected={selected}
            aria-controls={'panel-' + item.id}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={[
              'shrink-0 inline-flex items-center gap-2 pb-3 -mb-px border-b-2',
              'text-[14.5px] transition-colors whitespace-nowrap',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:rounded',
              selected
                ? 'border-indigo-600 dark:border-indigo-400 text-gray-900 dark:text-white font-medium'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            ].join(' ')}
          >
            {Icon && <Icon className="w-[17px] h-[17px]" strokeWidth={1.75} />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

/* -------------------------------------------------------------- numaralı adım */

/**
 * Adım numarası. Sade rakam; pastel zeminli karo değil.
 */
export const StepNumber = ({ n, tone = 'indigo' }: { n: React.ReactNode; tone?: string }) => {
  const a = accent(tone);
  return (
    <span className={[
      'inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-full',
      'border border-gray-200 dark:border-white/15 bg-white dark:bg-transparent',
      'text-[13px] font-semibold tabular-nums', a.text
    ].join(' ')}>
      {n}
    </span>
  );
};

/* ----------------------------------------------------------------- çerçeveler */

/**
 * Ürün görsellerinin etrafındaki uygulama penceresi.
 *
 * Görselleri ekran görüntüsü olarak koymuyoruz: panel hem açık hem koyu temada
 * çalışıyor, PNG yalnızca birinde doğru görünürdü. Bunlar panelin gerçek
 * bileşen dilini taklit eden DOM parçalarıdır; her iki temada da doğru,
 * her ekran yoğunluğunda keskin.
 */
export const AppFrame = ({ label, children, className = '', tone = 'indigo' }: {
  label?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  tone?: string;
}) => {
  const a = accent(tone);
  return (
    <div className={[
      'rounded-2xl border border-gray-200 dark:border-white/[0.09] bg-white dark:bg-[#12141f]',
      'overflow-hidden shadow-panel', className
    ].join(' ')}>
      <div className="flex items-center gap-2 px-3.5 h-10 border-b border-gray-200 dark:border-white/[0.07]
        bg-gray-50/80 dark:bg-white/[0.03]">
        <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-white/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-white/15" />
        <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-white/15" />
        {label && (
          <span className="ml-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-medium
            text-gray-500 dark:text-gray-400">
            <span className={['w-1.5 h-1.5 rounded-full', a.dot].join(' ')} />
            {label}
          </span>
        )}
      </div>
      {children}
    </div>
  );
};

/** Ziyaretçi tarafını göstermek için tarayıcı penceresi. */
export const BrowserFrame = ({ url, children, className = '' }: {
  url?: string;
  children?: React.ReactNode;
  className?: string;
}) => (
  <div className={[
    'rounded-2xl border border-gray-200 dark:border-white/[0.09] bg-white dark:bg-[#12141f]',
    'overflow-hidden shadow-panel', className
  ].join(' ')}>
    <div className="flex items-center gap-2 px-3.5 h-10 border-b border-gray-200 dark:border-white/[0.07]
      bg-gray-50/80 dark:bg-white/[0.03]">
      <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-white/15" />
      <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-white/15" />
      <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-white/15" />
      <span className="ml-2 flex-1 h-6 rounded-md bg-white dark:bg-white/[0.05]
        border border-gray-200 dark:border-white/[0.07] flex items-center px-2.5
        text-[10.5px] text-gray-400 dark:text-gray-500 truncate">
        {url}
      </span>
    </div>
    {children}
  </div>
);

/* ------------------------------------------------------------------- şerit */

/**
 * Sonsuz kayan şerit. İçerik iki kez basılır ve %50 kaydırılır; böylece
 * döngü başa döndüğünde görünür bir sıçrama olmaz.
 */
export const Marquee = ({ children, className = '' }: {
  children?: React.ReactNode;
  className?: string;
}) => (
  <div
    className={['relative overflow-hidden', className].join(' ')}
    style={{
      maskImage: 'linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)',
      WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)'
    }}
  >
    <div className="flex w-max animate-marquee motion-reduce:animate-none hover:[animation-play-state:paused]">
      <div className="flex items-center gap-12 pr-12">{children}</div>
      <div className="flex items-center gap-12 pr-12" aria-hidden="true">{children}</div>
    </div>
  </div>
);

