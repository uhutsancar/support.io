/**
 * Pazarlama sayfalarının tasarım kiti.
 *
 * Her sayfa aynı ölçeği kullanır: tek buton yüksekliği, tek başlık ölçeği,
 * tek bölüm dolgusu. Etkileşimli parçalar elle yazılmaz; akordeon ve sekmeler
 * Radix'ten, kaydırma animasyonları `motion`dan gelir. Klavye, ekran okuyucu
 * ve "hareketi azalt" tercihi bu kütüphanelerin kendi işidir — burada
 * yeniden kurulmaz.
 *
 * Buradaki her parça hem açık hem koyu temada tanımlıdır.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { ArrowRight, Plus } from 'lucide-react';

/* ------------------------------------------------------------------ renkler */

/**
 * Özellik ailelerinin renkleri. Panelin kendi kart renkleriyle aynıdır;
 * ziyaretçi sitede gördüğü moru panelde de mor olarak bulur.
 */
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
export const asList = <TItem = any,>(value: unknown): TItem[] =>
  Array.isArray(value) ? value : [];

/* -------------------------------------------------------------- hareket */

/**
 * Kaydırınca görünür olan blok.
 *
 * Yalnızca bir kez oynar; yukarı kaydırınca içerik tekrar kaybolmaz. "Hareketi
 * azalt" tercihi Shell'deki `MotionConfig reducedMotion="user"` ile uygulanır:
 * o durumda blok konumsuz, yalnızca opaklıkla belirir.
 */
export const Reveal = ({
  children,
  delay = 0,
  y = 22,
  className = '',
  as = 'div'
}: {
  children?: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  as?: 'div' | 'li' | 'section';
}) => {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -12% 0px' }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </Tag>
  );
};

/* ------------------------------------------------------------------ butonlar */

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ' +
  'dark:focus-visible:ring-offset-gray-950 disabled:opacity-60 disabled:pointer-events-none';

const BUTTON_SIZE = {
  sm: 'px-4 py-2 text-[13.5px]',
  md: 'px-5 py-2.5 text-[14.5px]',
  lg: 'px-7 py-3.5 text-[15px]'
};

const BUTTON_VARIANT = {
  primary:
    'bg-indigo-600 text-white shadow-[0_8px_20px_-8px_rgba(79,70,229,.6)] ' +
    'hover:bg-indigo-700 hover:shadow-[0_12px_28px_-8px_rgba(79,70,229,.7)] active:translate-y-px',
  secondary:
    'bg-white dark:bg-white/[0.04] text-gray-900 dark:text-gray-100 ' +
    'border border-gray-200 dark:border-white/10 ' +
    'hover:bg-gray-50 dark:hover:bg-white/[0.08] hover:border-gray-300 dark:hover:border-white/20 active:translate-y-px',
  ghost:
    'text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white ' +
    'hover:bg-gray-100 dark:hover:bg-white/[0.06]',
  inverse:
    'bg-white text-gray-900 hover:bg-indigo-50 active:translate-y-px ' +
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
  as,
  to,
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  arrow = false,
  ...rest
}: ButtonProps) => {
  const cls = [BUTTON_BASE, BUTTON_SIZE[size], BUTTON_VARIANT[variant], className].join(' ');
  const inner = (
    <>
      {children}
      {arrow && <ArrowRight className="w-4 h-4 shrink-0" />}
    </>
  );
  if (to)
    return (
      <Link to={to} className={cls} {...rest}>
        {inner}
      </Link>
    );
  if (href)
    return (
      <a href={href} className={cls} {...rest}>
        {inner}
      </a>
    );
  const Tag = as || 'button';
  return (
    <Tag className={cls} {...rest}>
      {inner}
    </Tag>
  );
};

/** Ok işareti hover'da ilerleyen metin bağlantısı. */
export const TextLink = ({
  to,
  href,
  onClick,
  children,
  tone = 'indigo',
  className = ''
}: {
  to?: string;
  href?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  /** An accent name; anything unknown falls back to indigo (see `accent`). */
  tone?: string;
  className?: string;
}) => {
  const a = accent(tone);
  const cls = [
    'group inline-flex items-center gap-1.5 text-[14.5px] font-semibold',
    a.text,
    className
  ].join(' ');
  const inner = (
    <>
      {children}
      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
    </>
  );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <Link to={to || ''} className={cls}>
      {inner}
    </Link>
  );
};

/* ------------------------------------------------------------------ tipografi */

/**
 * Bölüm etiketi: "· 02 / KİMLER İÇİN".
 *
 * Numara okuyana sayfanın neresinde olduğunu söyler; uzun bir ana sayfada
 * bölümler birbirinin tekrarı gibi görünmez. Zemin yok, yalnızca metin.
 */
export const Eyebrow = ({
  children,
  index,
  tone = 'indigo',
  className = ''
}: {
  children?: React.ReactNode;
  /** Bölüm numarası; verilirse "· 02 /" önekiyle basılır. */
  index?: number;
  tone?: string;
  className?: string;
}) => {
  const a = accent(tone);
  return (
    <span
      className={[
        'block text-[11.5px] font-semibold uppercase tracking-[0.16em]',
        a.text,
        className
      ].join(' ')}
    >
      {index !== undefined && (
        <span className="tabular-nums">· {String(index).padStart(2, '0')} / </span>
      )}
      {children}
    </span>
  );
};

/** Bölüm başlığı. `align="center"` kısa başlıklar içindir. */
export const SectionHead = ({
  eyebrow,
  index,
  eyebrowTone,
  title,
  description,
  align = 'left',
  className = '',
  children
}: {
  eyebrow?: React.ReactNode;
  index?: number;
  eyebrowTone?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
  children?: React.ReactNode;
}) => (
  <Reveal
    className={[align === 'center' ? 'text-center mx-auto max-w-2xl' : 'max-w-3xl', className].join(
      ' '
    )}
  >
    {eyebrow && (
      <Eyebrow index={index} tone={eyebrowTone}>
        {eyebrow}
      </Eyebrow>
    )}
    {title && (
      <h2
        className={[
          eyebrow ? 'mt-4' : '',
          'text-[31px] sm:text-[42px] font-bold tracking-[-0.035em] leading-[1.08]',
          'text-gray-950 dark:text-white text-balance'
        ].join(' ')}
      >
        {title}
      </h2>
    )}
    {description && (
      <p
        className={[
          'mt-4 text-[16.5px] leading-[1.65] text-gray-600 dark:text-gray-400 max-w-[60ch] text-pretty',
          align === 'center' ? 'mx-auto' : ''
        ].join(' ')}
      >
        {description}
      </p>
    )}
    {children}
  </Reveal>
);

/* -------------------------------------------------------------------- bölüm */

/**
 * Bölüm zeminleri. `mist` ve `cream` sayfaya ritim veren çok açık iki ton:
 * biri markanın indigo'suna, biri sıcak kırık beyaza yaslanır. Aynı zemin iki
 * kez üst üste gelmez, böylece bölümler çizgi çekmeden ayrışır.
 */
const TONE_BG = {
  plain: 'bg-white dark:bg-surface-dark',
  mist: 'bg-gradient-to-b from-[#f4f5ff] to-[#fbfaf7] dark:from-[#0f1120] dark:to-surface-dark',
  cream: 'bg-[#faf8f4] dark:bg-surface-darkSubtle',
  subtle: 'bg-surface-subtle dark:bg-surface-darkSubtle',
  deep: 'bg-[#0b0d17] text-white'
};

export type SectionTone = keyof typeof TONE_BG;

export const Section = ({
  tone = 'plain',
  bordered = false,
  id,
  className = '',
  innerClassName = '',
  children,
  size = 'md',
  wide = false
}: {
  tone?: SectionTone;
  bordered?: boolean;
  id?: string;
  className?: string;
  innerClassName?: string;
  children?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  wide?: boolean;
}) => {
  const pad =
    size === 'sm' ? 'py-14 sm:py-16' : size === 'lg' ? 'py-24 sm:py-32' : 'py-20 sm:py-28';
  return (
    <section
      id={id}
      className={[
        TONE_BG[tone],
        pad,
        'px-5 sm:px-8',
        bordered ? 'border-t border-gray-200/70 dark:border-white/[0.06]' : '',
        className
      ].join(' ')}
    >
      <div className={[wide ? 'max-w-7xl' : 'max-w-6xl', 'mx-auto', innerClassName].join(' ')}>
        {children}
      </div>
    </section>
  );
};

/* -------------------------------------------------------------------- kartlar */

export const Card = ({
  className = '',
  children,
  hover = false,
  as: Tag = 'div',
  ...rest
}: {
  className?: string;
  children?: React.ReactNode;
  hover?: boolean;
  as?: React.ElementType;
} & Record<string, any>) => (
  <Tag
    className={[
      'rounded-3xl border border-gray-200/80 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.03]',
      'shadow-[0_1px_2px_rgba(15,18,40,.04),0_8px_24px_-12px_rgba(15,18,40,.08)]',
      hover
        ? 'transition-all duration-300 hover:-translate-y-0.5 hover:border-gray-300 dark:hover:border-white/20 hover:shadow-panel-lg'
        : '',
      className
    ].join(' ')}
    {...rest}
  >
    {children}
  </Tag>
);

/** Çıplak çizgi ikon, özellik rengiyle. */
export const AccentIcon = ({
  icon: Icon,
  tone = 'indigo',
  size = 'md',
  className = ''
}: {
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
export const SolidIcon = ({
  icon: Icon,
  tone = 'indigo',
  className = ''
}: {
  icon: React.ElementType;
  tone?: string;
  className?: string;
}) => {
  const a = accent(tone);
  return (
    <span
      className={[
        'inline-flex items-center justify-center shrink-0 w-11 h-11 rounded-xl',
        a.bg,
        'shadow-[0_6px_16px_-6px_rgba(15,18,40,.45)]',
        className
      ].join(' ')}
    >
      <Icon className="w-5 h-5 text-white" strokeWidth={2.1} />
    </span>
  );
};

/* ------------------------------------------------------------- çip & rozet */

/**
 * Çerçeveli, büyük harfli çip — bir özelliğin kapsadığı alt başlıklar için
 * ("FORMLAR · SOHBET · E-POSTA"). Dolgusu yok; renk yalnızca çerçevede.
 */
export const Chip = ({
  children,
  className = '',
  tone
}: {
  children?: React.ReactNode;
  className?: string;
  tone?: string;
}) => (
  <span
    className={[
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10.5px] font-semibold',
      'uppercase tracking-[0.08em] border',
      tone
        ? [accent(tone).border, accent(tone).text].join(' ')
        : 'border-gray-200 dark:border-white/15 text-gray-500 dark:text-gray-400',
      className
    ].join(' ')}
  >
    {children}
  </span>
);

/** Küçük rozet (plan adı, kurulum süresi). */
export const Pill = ({
  children,
  className = ''
}: {
  children?: React.ReactNode;
  className?: string;
}) => (
  <span
    className={[
      'inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-full text-[11.5px] font-medium',
      'border border-gray-200 dark:border-white/15 text-gray-600 dark:text-gray-400',
      className
    ].join(' ')}
  >
    {children}
  </span>
);

/* -------------------------------------------------------------------- görsel */

/**
 * Fotoğraf. Genişlik/yükseklik verilir ki yüklenirken sayfa zıplamasın;
 * ekranın altındakiler tembel yüklenir.
 */
export const Photo = ({
  src,
  alt,
  className = '',
  imgClassName = '',
  eager = false,
  children
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  children?: React.ReactNode;
}) => (
  <div className={['relative overflow-hidden', className].join(' ')}>
    <img
      src={src}
      alt={alt}
      width={1400}
      height={934}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={['absolute inset-0 w-full h-full object-cover', imgClassName].join(' ')}
    />
    {children}
  </div>
);

/* -------------------------------------------------------------------- akordeon */

/** One question/answer pair in an Accordion. */
export interface AccordionItem {
  q?: React.ReactNode;
  a?: React.ReactNode;
  [field: string]: any;
}

/**
 * Soru-cevap listesi. Radix Accordion: ok tuşlarıyla gezilir, açılıp kapanma
 * `aria-expanded` ile duyurulur, yükseklik geçişi `--radix-accordion-content-height`
 * üzerinden CSS'te yapılır (bkz. index.css).
 */
export const Accordion = ({
  items,
  numbered = false
}: {
  items: AccordionItem[];
  numbered?: boolean;
}) => (
  <AccordionPrimitive.Root
    type="single"
    collapsible
    className="border-y border-gray-200 dark:border-white/[0.08] divide-y divide-gray-200 dark:divide-white/[0.08]"
  >
    {items.map((item, i) => (
      <AccordionPrimitive.Item key={i} value={'item-' + i}>
        <AccordionPrimitive.Header>
          <AccordionPrimitive.Trigger
            className="group w-full flex items-start gap-5 py-5 text-left
              text-[15.5px] font-medium text-gray-900 dark:text-white
              hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors
              focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:rounded"
          >
            {numbered && (
              <span className="w-6 pt-0.5 text-[11.5px] font-medium tabular-nums text-gray-400 shrink-0">
                {String(i + 1).padStart(2, '0')}
              </span>
            )}
            <span className="flex-1">{item.q}</span>
            <Plus className="w-4 h-4 mt-1 shrink-0 text-gray-400 transition-transform duration-300 group-data-[state=open]:rotate-45" />
          </AccordionPrimitive.Trigger>
        </AccordionPrimitive.Header>
        <AccordionPrimitive.Content className="accordion-content overflow-hidden">
          <div
            className={[
              'pb-6 text-[14.5px] leading-[1.7] text-gray-600 dark:text-gray-400 max-w-[68ch]',
              numbered ? 'pl-11' : ''
            ].join(' ')}
          >
            {item.a}
          </div>
        </AccordionPrimitive.Content>
      </AccordionPrimitive.Item>
    ))}
  </AccordionPrimitive.Root>
);

/* -------------------------------------------------------------------- sekmeler */

/** One tab: the id it is selected by, plus what is shown on it. */
export interface TabItem {
  id: string;
  label?: React.ReactNode;
  icon?: React.ElementType;
  [field: string]: any;
}

/**
 * Sekme şeridi. Radix Tabs kökünü sayfa kurar (içerik panelleri sayfanın
 * düzenine göre değiştiği için); bu bileşen yalnızca listeyi çizer.
 *
 * `variant="pill"` ürün turundaki yuvarlak düğmeli şerit, `underline` alt
 * çizgili klasik sekme.
 */
export const Tabs = ({
  items,
  active,
  onChange,
  className = '',
  variant = 'underline',
  children
}: {
  items: TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
  variant?: 'underline' | 'pill';
  children?: React.ReactNode;
}) => (
  <TabsPrimitive.Root value={active} onValueChange={onChange}>
    <TabsPrimitive.List
      className={[
        'flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        variant === 'underline'
          ? 'gap-6 border-b border-gray-200 dark:border-white/[0.09]'
          : 'gap-1.5 sm:justify-center',
        className
      ].join(' ')}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <TabsPrimitive.Trigger
            key={item.id}
            value={item.id}
            className={[
              'shrink-0 inline-flex items-center gap-2 whitespace-nowrap transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              variant === 'underline'
                ? 'pb-3 -mb-px border-b-2 text-[14.5px] border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white data-[state=active]:border-indigo-600 dark:data-[state=active]:border-indigo-400 data-[state=active]:text-gray-900 dark:data-[state=active]:text-white data-[state=active]:font-medium focus-visible:rounded'
                : 'px-3.5 py-2 rounded-full text-[13.5px] font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/80 dark:hover:bg-white/[0.06] data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-[0_6px_16px_-8px_rgba(79,70,229,.8)]'
            ].join(' ')}
          >
            {Icon && <Icon className="w-4 h-4" strokeWidth={1.9} />}
            {item.label}
          </TabsPrimitive.Trigger>
        );
      })}
    </TabsPrimitive.List>
    {children}
  </TabsPrimitive.Root>
);

export const TabPanel = TabsPrimitive.Content;

/* -------------------------------------------------------------- numaralı adım */

export const StepNumber = ({ n, tone = 'indigo' }: { n: React.ReactNode; tone?: string }) => {
  const a = accent(tone);
  return (
    <span
      className={[
        'inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-full',
        'border border-gray-200 dark:border-white/15 bg-white dark:bg-transparent',
        'text-[13px] font-semibold tabular-nums',
        a.text
      ].join(' ')}
    >
      {n}
    </span>
  );
};

/* ----------------------------------------------------------------- çerçeveler */

/**
 * Ürün görsellerinin etrafındaki uygulama penceresi. İçerik panelin bileşen
 * dilini taklit eden DOM parçasıdır; iki temada da doğru, her yoğunlukta
 * keskin. Başlık çubuğunda pencerenin adı büyük harfle ortada durur.
 */
export const AppFrame = ({
  label,
  children,
  className = '',
  tone = 'indigo'
}: {
  label?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  tone?: string;
}) => {
  const a = accent(tone);
  return (
    <div
      className={[
        'rounded-2xl border border-gray-200/90 dark:border-white/[0.09] bg-white dark:bg-[#12141f]',
        'overflow-hidden shadow-panel-lg',
        className
      ].join(' ')}
    >
      <div
        className="relative flex items-center gap-1.5 px-3.5 h-9 border-b border-gray-200/80 dark:border-white/[0.07]
        bg-gray-50/80 dark:bg-white/[0.03]"
      >
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]/80" />
        {label && (
          <span
            className="absolute left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 text-[10px] font-semibold
            uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 whitespace-nowrap"
          >
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
export const BrowserFrame = ({
  url,
  children,
  className = ''
}: {
  url?: string;
  children?: React.ReactNode;
  className?: string;
}) => (
  <div
    className={[
      'rounded-2xl border border-gray-200 dark:border-white/[0.09] bg-white dark:bg-[#12141f]',
      'overflow-hidden shadow-panel-lg',
      className
    ].join(' ')}
  >
    <div
      className="flex items-center gap-2 px-3.5 h-9 border-b border-gray-200 dark:border-white/[0.07]
      bg-gray-50/80 dark:bg-white/[0.03]"
    >
      <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-white/15" />
      <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-white/15" />
      <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-white/15" />
      <span
        className="ml-2 flex-1 h-6 rounded-md bg-white dark:bg-white/[0.05]
        border border-gray-200 dark:border-white/[0.07] flex items-center px-2.5
        text-[10.5px] text-gray-400 dark:text-gray-500 truncate"
      >
        {url}
      </span>
    </div>
    {children}
  </div>
);

/* ------------------------------------------------------------------- şerit */

/**
 * Sonsuz kayan şerit. İçerik iki kez basılır ve %50 kaydırılır; döngü başa
 * döndüğünde görünür bir sıçrama olmaz.
 */
export const Marquee = ({
  children,
  className = ''
}: {
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
      <div className="flex items-center gap-12 pr-12" aria-hidden="true">
        {children}
      </div>
    </div>
  </div>
);
