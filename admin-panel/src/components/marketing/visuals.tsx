/**
 * Ürün görselleri.
 *
 * Bunlar ekran görüntüsü DEĞİL, panelin bileşen dilini yeniden kuran DOM
 * parçalarıdır. Sebebi üç madde:
 *
 *  1. Panel hem açık hem koyu temada çalışıyor. Tek bir PNG yalnızca birinde
 *     doğru görünür; ikisini de koymak her değişiklikte iki dosya demek.
 *  2. Ekran görüntüsü ürün değiştiği an eskir ve kimse fark etmez. Burada
 *     kullanılan renkler ve bileşenler panelle aynı Tailwind sınıflarından
 *     geliyor; tema değişirse görsel de değişir.
 *  3. Demo veritabanı yük testi satırlarıyla dolu ("Yük Ziyaretçisi 117",
 *     "SLA İhlali 360"). Gerçek ekranın görüntüsü ürünü olduğundan kötü
 *     gösterirdi. Buradaki içerik temsilîdir ve öyle olduğu bellidir.
 *
 * Metinler i18n'den gelir; bileşenler kendi çevirilerini okur, çağıran sayfa
 * onlarca prop taşımak zorunda kalmaz.
 */

/* ------------------------------------------------------------ ortak parçalar */

import { useTranslation } from 'react-i18next';
import {
  Search,
  Paperclip,
  Send,
  Check,
  CheckCheck,
  Zap,
  ArrowRight,
  Sparkles,
  Globe,
  Clock,
  MousePointer2,
  Star,
  ChevronRight,
  Filter
} from 'lucide-react';
import { accent, asList } from './kit';

const Avatar = ({ name, tone = 'indigo', size = 'md' }: { name?: string; [prop: string]: any }) => {
  const a = accent(tone);
  const box =
    size === 'sm'
      ? 'w-6 h-6 text-[10px]'
      : size === 'lg'
        ? 'w-9 h-9 text-[13px]'
        : 'w-7 h-7 text-[11px]';
  return (
    <span
      className={[
        'inline-flex items-center justify-center rounded-full shrink-0 font-semibold',
        box,
        a.soft,
        a.softText
      ].join(' ')}
    >
      {String(name ?? '')
        .charAt(0)
        .toUpperCase()}
    </span>
  );
};

const Dot = ({ tone = 'emerald', pulse = false }) => (
  <span
    className={[
      'w-1.5 h-1.5 rounded-full shrink-0',
      accent(tone).dot,
      pulse ? 'animate-pulse-dot motion-reduce:animate-none' : ''
    ].join(' ')}
  />
);

const Tag = ({ children, tone = 'indigo' }: { children?: any; [prop: string]: any }) => {
  const a = accent(tone);
  return (
    <span
      className={[
        'px-1.5 py-[2px] rounded text-[9.5px] font-semibold shrink-0',
        a.soft,
        a.softText
      ].join(' ')}
    >
      {children}
    </span>
  );
};

/* ------------------------------------------------------------------ 1. Inbox */

/**
 * Gelen kutusu — sitenin ana ürün görseli.
 * Panelin Konuşmalar ekranının birebir düzeni: solda liste, sağda açık
 * konuşma, altta yazma alanı.
 */
export const InboxVisual = ({ compact = false }) => {
  const { t } = useTranslation();
  const rows = t('viz.inbox.rows', { returnObjects: true });
  const list = Array.isArray(rows) ? rows : [];

  return (
    <div
      className={[
        'grid grid-cols-[minmax(0,.85fr)_minmax(0,1.3fr)]',
        compact ? 'h-[300px]' : 'h-[372px]'
      ].join(' ')}
    >
      {/* ---- konuşma listesi ---- */}
      <div className="border-r border-gray-200 dark:border-white/[0.07] flex flex-col min-w-0">
        <div className="p-2.5 border-b border-gray-200 dark:border-white/[0.07]">
          <div
            className="flex items-center gap-2 px-2.5 h-8 rounded-lg bg-gray-50 dark:bg-white/[0.04]
            border border-gray-200 dark:border-white/[0.07]"
          >
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span className="text-[11px] text-gray-400 truncate">{t('viz.inbox.search')}</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium
              bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300"
            >
              <Filter className="w-3 h-3" /> {t('viz.inbox.filterOpen')}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
              {t('viz.inbox.count')}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {list.map((row, i) => (
            <div
              key={i}
              className={[
                'px-2.5 py-2.5 border-b border-gray-100 dark:border-white/[0.05]',
                i === 0
                  ? 'bg-indigo-50/70 dark:bg-indigo-500/[0.09] border-l-2 border-l-indigo-500'
                  : 'border-l-2 border-l-transparent'
              ].join(' ')}
            >
              <div className="flex items-center gap-2">
                <Avatar
                  name={row.name}
                  tone={['violet', 'sky', 'amber', 'emerald'][i % 4]}
                  size="sm"
                />
                <span className="text-[12px] font-medium text-gray-900 dark:text-white truncate flex-1">
                  {row.name}
                </span>
                <span className="text-[9.5px] text-gray-400 shrink-0 tabular-nums">{row.time}</span>
              </div>
              <p className="mt-1 pl-8 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {row.preview}
              </p>
              {row.tag && (
                <div className="mt-1.5 pl-8 flex items-center gap-1">
                  <Tag tone={row.tone || 'indigo'}>{row.tag}</Tag>
                  {i === 0 && <Tag tone="emerald">{t('viz.inbox.online')}</Tag>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ---- açık konuşma ---- */}
      <div className="flex flex-col min-w-0 bg-gray-50/40 dark:bg-transparent">
        <div
          className="px-3.5 py-2.5 border-b border-gray-200 dark:border-white/[0.07]
          flex items-center gap-2.5 bg-white dark:bg-transparent"
        >
          <Avatar name={t('viz.inbox.openName')} tone="violet" />
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-semibold text-gray-900 dark:text-white leading-tight truncate">
              {t('viz.inbox.openName')}
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400">
              <Dot tone="emerald" pulse />
              {t('viz.inbox.openPage')}
            </span>
          </span>
          <Tag tone="amber">{t('viz.inbox.openStatus')}</Tag>
        </div>

        <div className="flex-1 p-3.5 space-y-2.5 overflow-hidden">
          <div className="flex justify-center">
            <span
              className="px-2 py-[3px] rounded-full text-[9.5px] font-medium
              bg-gray-100 dark:bg-white/[0.06] text-gray-500 dark:text-gray-400"
            >
              {t('viz.inbox.today')}
            </span>
          </div>

          <div
            className="max-w-[82%] px-3 py-2 rounded-2xl rounded-bl-md bg-white dark:bg-white/[0.06]
            border border-gray-200 dark:border-transparent
            text-[11.5px] leading-relaxed text-gray-700 dark:text-gray-200 shadow-sm"
          >
            {t('viz.inbox.msg1')}
          </div>

          <div className="max-w-[82%] ml-auto">
            <div
              className="px-3 py-2 rounded-2xl rounded-br-md bg-indigo-600 text-[11.5px]
              leading-relaxed text-white shadow-[0_4px_12px_-4px_rgba(79,70,229,.5)]"
            >
              {t('viz.inbox.msg2')}
            </div>
            <span className="mt-1 flex items-center justify-end gap-1 text-[9.5px] text-gray-400">
              {t('viz.inbox.sentBy')} <CheckCheck className="w-3 h-3 text-indigo-500" />
            </span>
          </div>

          <div
            className="max-w-[82%] px-3 py-2 rounded-2xl rounded-bl-md bg-white dark:bg-white/[0.06]
            border border-gray-200 dark:border-transparent
            text-[11.5px] leading-relaxed text-gray-700 dark:text-gray-200 shadow-sm"
          >
            {t('viz.inbox.msg3')}
          </div>

          {/* yazıyor göstergesi */}
          <div
            className="inline-flex items-center gap-1 px-3 py-2.5 rounded-2xl rounded-bl-md
            bg-white dark:bg-white/[0.06] border border-gray-200 dark:border-transparent shadow-sm"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500
                  animate-typing motion-reduce:animate-none"
                style={{ animationDelay: i * 0.18 + 's' }}
              />
            ))}
          </div>
        </div>

        <div className="p-2.5 border-t border-gray-200 dark:border-white/[0.07] bg-white dark:bg-transparent">
          <div className="flex items-center gap-2">
            <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span
              className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/[0.09]
              text-[11px] text-gray-400 truncate"
            >
              {t('viz.inbox.composer')}
            </span>
            <span className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Send className="w-3 h-3 text-white" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- 2. Widget */

/**
 * Ziyaretçinin gördüğü sohbet balonu — sitenin köşesinde.
 *
 * Kök öğe balonun kendi genişliğinde sabitlenir. Önceden yalnızca `relative`
 * idi ve altındaki başlatıcı düğme `ml-auto` ile SARMALAYICININ sağına
 * yapışıyordu; geniş bir grid kolonunun içine konduğunda düğme balondan
 * yüzlerce piksel uzakta, havada duruyordu.
 */
export const WidgetVisual = ({ className = '', launcher = true }) => {
  const { t } = useTranslation();
  return (
    <div className={['relative w-[268px]', className].join(' ')}>
      <div
        className="w-[268px] rounded-2xl overflow-hidden bg-white dark:bg-[#171a29]
        border border-gray-200 dark:border-white/[0.09] shadow-panel-lg"
      >
        {/* başlık */}
        <div className="px-3.5 py-3 bg-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <span
              className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center
              text-[11px] font-semibold"
            >
              A
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold leading-tight truncate">
                {t('viz.widget.title')}
              </span>
              <span className="flex items-center gap-1 text-[10px] text-white/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                {t('viz.widget.status')}
              </span>
            </span>
          </div>
        </div>

        {/* mesajlar */}
        <div className="p-3 space-y-2 bg-gray-50 dark:bg-transparent">
          <div
            className="max-w-[86%] px-2.5 py-1.5 rounded-xl rounded-bl-sm bg-white dark:bg-white/[0.06]
            border border-gray-200 dark:border-transparent text-[11px] leading-relaxed
            text-gray-700 dark:text-gray-200"
          >
            {t('viz.widget.bot')}
          </div>
          <div
            className="max-w-[86%] ml-auto px-2.5 py-1.5 rounded-xl rounded-br-sm bg-indigo-600
            text-[11px] leading-relaxed text-white"
          >
            {t('viz.widget.visitor')}
          </div>
          <div
            className="max-w-[86%] px-2.5 py-1.5 rounded-xl rounded-bl-sm bg-white dark:bg-white/[0.06]
            border border-gray-200 dark:border-transparent text-[11px] leading-relaxed
            text-gray-700 dark:text-gray-200"
          >
            {t('viz.widget.agent')}
          </div>
        </div>

        {/* hızlı yanıtlar */}
        <div className="px-3 pb-2.5 flex flex-wrap gap-1.5 bg-gray-50 dark:bg-transparent">
          {asList(t('viz.widget.quick', { returnObjects: true })).map((q, i) => (
            <span
              key={i}
              className="px-2 py-1 rounded-full text-[10px] font-medium
              border border-indigo-200 dark:border-indigo-500/30
              text-indigo-700 dark:text-indigo-300 bg-white dark:bg-transparent"
            >
              {q}
            </span>
          ))}
        </div>

        <div
          className="px-3 py-2.5 border-t border-gray-200 dark:border-white/[0.07]
          flex items-center gap-2"
        >
          <span className="flex-1 text-[10.5px] text-gray-400">{t('viz.widget.composer')}</span>
          <Send className="w-3.5 h-3.5 text-indigo-500" />
        </div>
      </div>

      {/* başlatıcı düğme */}
      {launcher && (
        <div
          className="mt-2.5 ml-auto w-12 h-12 rounded-full bg-indigo-600
          shadow-[0_10px_28px_-8px_rgba(79,70,229,.75)] flex items-center justify-center"
        >
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" aria-hidden="true">
            <path
              d="M12 3c-4.97 0-9 3.36-9 7.5 0 2.3 1.25 4.36 3.2 5.72L6 21l4.1-2.4c.61.1 1.25.15 1.9.15 4.97 0 9-3.36 9-7.5S16.97 3 12 3z"
              fill="#fff"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

/* ---------------------------------------------------------- 3. Gösterge kartları */

/** Panelin gösterge panelindeki dolu renkli istatistik kartları. */
export const MetricsVisual = () => {
  const { t } = useTranslation();
  const cards = t('viz.metrics.cards', { returnObjects: true });
  const list = Array.isArray(cards) ? cards : [];
  const tones = ['violet', 'emerald', 'sky', 'amber'];

  return (
    <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
      {list.map((card, i) => {
        const a = accent(tones[i % 4]);
        return (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-white/[0.08]
            bg-white dark:bg-white/[0.03] p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <span
                className={[
                  'inline-flex items-center justify-center w-8 h-8 rounded-lg',
                  a.bg
                ].join(' ')}
              >
                <span className="w-3.5 h-3.5 rounded-[3px] bg-white/90" />
              </span>
              <span
                className={[
                  'text-[10.5px] font-semibold tabular-nums',
                  card.up ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'
                ].join(' ')}
              >
                {card.delta}
              </span>
            </div>
            <p className="mt-2.5 text-[21px] font-semibold tracking-tight text-gray-900 dark:text-white tabular-nums">
              {card.value}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------- 4. Analitik */

/**
 * Yanıt/çözüm eğrisi.
 *
 * Renkler doğrulanmış bir çiftten gelir (OKLCH aydınlık bandı, kroma tabanı,
 * renk körlüğü ayrımı ve zemin kontrastı — hepsi geçti): açık temada
 * #7c3aed / #059669, koyu temada #8b5cf6 / #059669. Değerler `index.css`
 * içinde `--viz-s1` / `--viz-s2` olarak tanımlı, tema ile değişir.
 *
 * İki seri olduğu için lejant ZORUNLU; ayrıca her iki eğri uç noktasında
 * doğrudan etiketlenir, böylece kimlik yalnızca renge bağlı kalmaz.
 */
export const AnalyticsVisual = () => {
  const { t } = useTranslation();

  // Temsilî değerler. Eğri biçimi gerçekçi: hafta sonu düşer, hafta içi artar
  // ve çözülen her zaman gelenin biraz altında seyreder.
  const incoming = [18, 24, 21, 32, 38, 27, 34];
  const solved = [15, 21, 20, 28, 34, 25, 31];
  const days = t('viz.analytics.days', { returnObjects: true });
  const labels = Array.isArray(days) ? days : ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  const W = 460,
    H = 180,
    P = { t: 14, r: 52, b: 26, l: 30 };
  const max = 40;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / (incoming.length - 1);
  const y = (v: any) => P.t + (1 - v / max) * (H - P.t - P.b);
  const line = (arr: any) =>
    arr
      .map((v: any, i: number) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1))
      .join(' ');
  const area = (arr: any) =>
    line(arr) +
    ' L' +
    x(arr.length - 1).toFixed(1) +
    ' ' +
    y(0).toFixed(1) +
    ' L' +
    x(0).toFixed(1) +
    ' ' +
    y(0).toFixed(1) +
    ' Z';

  return (
    <div className="viz p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold text-gray-900 dark:text-white">
            {t('viz.analytics.title')}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">{t('viz.analytics.range')}</p>
        </div>
        {/* Lejant: iki seri olduğunda her zaman var. */}
        <ul className="flex items-center gap-3.5 shrink-0">
          <li className="flex items-center gap-1.5 text-[10.5px] text-gray-600 dark:text-gray-400">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--viz-s1)' }} />
            {t('viz.analytics.s1')}
          </li>
          <li className="flex items-center gap-1.5 text-[10.5px] text-gray-600 dark:text-gray-400">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: 'var(--viz-s2)' }} />
            {t('viz.analytics.s2')}
          </li>
        </ul>
      </div>

      <svg
        viewBox={'0 0 ' + W + ' ' + H}
        className="mt-3 w-full h-auto overflow-visible"
        role="img"
        aria-label={t('viz.analytics.alt')}
      >
        <defs>
          <linearGradient id="viz-fill-1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--viz-s1)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--viz-s1)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Izgara geri planda kalır: ince, soluk, yalnızca yatay. */}
        {[0, 10, 20, 30, 40].map((v) => (
          <g key={v}>
            <line
              x1={P.l}
              x2={W - P.r}
              y1={y(v)}
              y2={y(v)}
              className="stroke-gray-200 dark:stroke-white/10"
              strokeWidth="1"
            />
            <text
              x={P.l - 8}
              y={y(v) + 3}
              textAnchor="end"
              className="fill-gray-400 dark:fill-gray-500"
              fontSize="9"
            >
              {v}
            </text>
          </g>
        ))}

        <path d={area(incoming)} fill="url(#viz-fill-1)" />
        <path
          d={line(incoming)}
          fill="none"
          stroke="var(--viz-s1)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={line(solved)}
          fill="none"
          stroke="var(--viz-s2)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="0"
        />

        {/* Uç işaretçiler: 8px çap, zemin rengiyle halkalanır. */}
        <circle
          cx={x(6)}
          cy={y(incoming[6])}
          r="4"
          fill="var(--viz-s1)"
          className="stroke-white dark:stroke-[#12141f]"
          strokeWidth="2"
        />
        <circle
          cx={x(6)}
          cy={y(solved[6])}
          r="4"
          fill="var(--viz-s2)"
          className="stroke-white dark:stroke-[#12141f]"
          strokeWidth="2"
        />

        {/* Doğrudan etiket — kimlik renge tek başına bırakılmaz. */}
        <text
          x={x(6) + 9}
          y={y(incoming[6]) + 3}
          fontSize="9.5"
          fontWeight="600"
          className="fill-gray-700 dark:fill-gray-200"
        >
          {incoming[6]}
        </text>
        <text
          x={x(6) + 9}
          y={y(solved[6]) + 3}
          fontSize="9.5"
          fontWeight="600"
          className="fill-gray-700 dark:fill-gray-200"
        >
          {solved[6]}
        </text>

        {labels.map((d, i) => (
          <text
            key={d}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize="9"
            className="fill-gray-400 dark:fill-gray-500"
          >
            {d}
          </text>
        ))}
      </svg>
    </div>
  );
};

/* ---------------------------------------------------------- 5. Yönlendirme */

/** Gelen konuşmanın departmana ve temsilciye düşüşü. */
export const RoutingVisual = () => {
  const { t } = useTranslation();
  const depts = t('viz.routing.depts', { returnObjects: true });
  const list = Array.isArray(depts) ? depts : [];
  const tones = ['violet', 'sky', 'emerald'];

  return (
    <div className="p-5">
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl
        border border-gray-200 dark:border-white/[0.08] bg-gray-50 dark:bg-white/[0.03]"
      >
        <Avatar name={t('viz.routing.visitor')} tone="amber" size="sm" />
        <span className="text-[12px] text-gray-700 dark:text-gray-300 truncate flex-1">
          {t('viz.routing.message')}
        </span>
        <Tag tone="amber">{t('viz.routing.new')}</Tag>
      </div>

      {/* bağlantı */}
      <div className="flex justify-center py-2" aria-hidden="true">
        <svg width="24" height="26" viewBox="0 0 24 26" fill="none">
          <path
            d="M12 0v18"
            className="stroke-gray-300 dark:stroke-white/20"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          <path d="M12 25l-4.5-7h9L12 25z" className="fill-gray-300 dark:fill-white/20" />
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {list.map((d, i) => {
          const a = accent(tones[i % 3]);
          const isTarget = i === 0;
          return (
            <div
              key={i}
              className={[
                'rounded-xl border p-2.5 text-center transition',
                isTarget
                  ? [a.border, a.soft, 'ring-2', a.ring].join(' ')
                  : 'border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02]'
              ].join(' ')}
            >
              <p
                className={[
                  'text-[11.5px] font-semibold truncate',
                  isTarget ? a.softText : 'text-gray-700 dark:text-gray-300'
                ].join(' ')}
              >
                {d.name}
              </p>
              <p className="mt-0.5 text-[9.5px] text-gray-500 dark:text-gray-400 tabular-nums">
                {d.load}
              </p>
            </div>
          );
        })}
      </div>

      <div
        className="mt-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl
        border border-emerald-200 dark:border-emerald-500/25 bg-emerald-50 dark:bg-emerald-500/[0.08]"
      >
        <Avatar name={t('viz.routing.agent')} tone="emerald" size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold text-gray-900 dark:text-white truncate">
            {t('viz.routing.agent')}
          </span>
          <span className="flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400">
            <Dot tone="emerald" pulse /> {t('viz.routing.assigned')}
          </span>
        </span>
        <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ 6. Otomasyon */

/** Eğer / ise kural kartı. */
export const AutomationVisual = () => {
  const { t } = useTranslation();
  const conditions = t('viz.automation.conditions', { returnObjects: true });
  const actions = t('viz.automation.actions', { returnObjects: true });

  return (
    <div className="p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[12.5px] font-semibold text-gray-900 dark:text-white">
          <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          {t('viz.automation.ruleName')}
        </span>
        <span
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-semibold
          bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        >
          <Dot tone="emerald" /> {t('viz.automation.active')}
        </span>
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
        <div className="px-3 py-1.5 bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/[0.07]">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {t('viz.automation.ifLabel')}
          </span>
        </div>
        <div className="p-2.5 space-y-1.5">
          {(Array.isArray(conditions) ? conditions : []).map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && (
                <span
                  className="px-1.5 py-[1px] rounded text-[9px] font-bold
                  bg-gray-100 dark:bg-white/[0.08] text-gray-500 dark:text-gray-400 shrink-0"
                >
                  {t('viz.automation.and')}
                </span>
              )}
              <span
                className="px-2.5 py-1.5 rounded-lg text-[11px] flex-1
                bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.07]
                text-gray-700 dark:text-gray-300 truncate"
              >
                {c}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center" aria-hidden="true">
        <ArrowRight className="w-4 h-4 text-gray-300 dark:text-white/20 rotate-90" />
      </div>

      <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/25 overflow-hidden">
        <div
          className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/[0.10]
          border-b border-emerald-200 dark:border-emerald-500/25"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            {t('viz.automation.thenLabel')}
          </span>
        </div>
        <div className="p-2.5 space-y-1.5">
          {(Array.isArray(actions) ? actions : []).map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg
              bg-emerald-50/60 dark:bg-emerald-500/[0.06] text-[11px] text-gray-700 dark:text-gray-300"
            >
              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">{a}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10.5px] text-gray-500 dark:text-gray-400 tabular-nums">
        {t('viz.automation.stat')}
      </p>
    </div>
  );
};

/* ------------------------------------------------------------- 7. Proaktif */

/** Ziyaretçiye kendiliğinden açılan mesaj — sayfanın üzerinde. */
export const ProactiveVisual = () => {
  const { t } = useTranslation();
  const triggers = t('viz.proactive.triggers', { returnObjects: true });

  return (
    <div className="p-5">
      <div className="flex flex-wrap gap-1.5">
        {(Array.isArray(triggers) ? triggers : []).map((tr, i) => (
          <span
            key={i}
            className={[
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10.5px] font-medium border',
              i === 0
                ? 'border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'border-gray-200 dark:border-white/[0.08] text-gray-600 dark:text-gray-400'
            ].join(' ')}
          >
            {i === 0 ? <Clock className="w-3 h-3" /> : <MousePointer2 className="w-3 h-3" />}
            {tr}
          </span>
        ))}
      </div>

      <div
        className="mt-4 rounded-xl border border-gray-200 dark:border-white/[0.08]
        bg-gray-50 dark:bg-white/[0.02] p-3.5 relative overflow-hidden"
      >
        <div className="space-y-1.5" aria-hidden="true">
          <div className="h-2 w-2/3 rounded bg-gray-200 dark:bg-white/[0.08]" />
          <div className="h-2 w-full rounded bg-gray-200 dark:bg-white/[0.08]" />
          <div className="h-2 w-4/5 rounded bg-gray-200 dark:bg-white/[0.08]" />
          <div className="h-16 mt-2 rounded-lg bg-gray-200/70 dark:bg-white/[0.05]" />
        </div>

        <div
          className="mt-3 ml-auto max-w-[86%] rounded-2xl rounded-br-md
          bg-white dark:bg-[#1b1e2e] border border-gray-200 dark:border-white/[0.09]
          shadow-panel p-3"
        >
          <div className="flex items-center gap-2">
            <Avatar name={t('viz.proactive.agent')} tone="indigo" size="sm" />
            <span className="text-[11px] font-semibold text-gray-900 dark:text-white truncate">
              {t('viz.proactive.agent')}
            </span>
          </div>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-gray-700 dark:text-gray-300">
            {t('viz.proactive.message')}
          </p>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------- 8. SSS */

/** Widget içindeki yardım araması. */
export const KnowledgeVisual = () => {
  const { t } = useTranslation();
  const results = t('viz.knowledge.results', { returnObjects: true });

  return (
    <div className="p-5">
      <div
        className="flex items-center gap-2 px-3 h-10 rounded-xl
        border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/[0.07]"
      >
        <Search className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-[12.5px] text-gray-800 dark:text-gray-200 truncate">
          {t('viz.knowledge.query')}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {(Array.isArray(results) ? results : []).map((r, i) => (
          <li
            key={i}
            className={[
              'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition',
              i === 0
                ? 'border-amber-200 dark:border-amber-500/25 bg-amber-50/50 dark:bg-amber-500/[0.06]'
                : 'border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02]'
            ].join(' ')}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-medium text-gray-900 dark:text-white truncate">
                {r.q}
              </span>
              <span className="block text-[10.5px] text-gray-500 dark:text-gray-400 truncate">
                {r.meta}
              </span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          </li>
        ))}
      </ul>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
        <Star className="w-3.5 h-3.5 text-amber-500" />
        {t('viz.knowledge.note')}
      </p>
    </div>
  );
};

/* --------------------------------------------------------------- 9. Ekip */

/** Temsilciler ve müsaitlik durumları. */
export const TeamVisual = () => {
  const { t } = useTranslation();
  const members = t('viz.team.members', { returnObjects: true });
  const toneFor = { online: 'emerald', away: 'amber', busy: 'rose', offline: 'indigo' };

  return (
    <div className="p-4 space-y-1.5">
      {(Array.isArray(members) ? members : []).map((m, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl
          border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02]"
        >
          <Avatar name={m.name} tone={['violet', 'sky', 'emerald', 'amber'][i % 4]} />
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-medium text-gray-900 dark:text-white truncate">
              {m.name}
            </span>
            <span className="block text-[10.5px] text-gray-500 dark:text-gray-400 truncate">
              {m.role}
            </span>
          </span>
          <span className="flex items-center gap-1.5 shrink-0">
            <Dot
              tone={toneFor[m.state as keyof typeof toneFor] || 'indigo'}
              pulse={m.state === 'online'}
            />
            <span className="text-[10.5px] text-gray-600 dark:text-gray-400">{m.stateLabel}</span>
          </span>
          <span className="w-12 text-right text-[10.5px] tabular-nums text-gray-500 dark:text-gray-400 shrink-0">
            {m.load}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ---------------------------------------------------------- 10. Ziyaretçiler */

/** O an sitede kim var. */
export const VisitorsVisual = () => {
  const { t } = useTranslation();
  const rows = t('viz.visitors.rows', { returnObjects: true });

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Dot tone="emerald" pulse />
        <span className="text-[12px] font-semibold text-gray-900 dark:text-white">
          {t('viz.visitors.title')}
        </span>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-white/[0.08] overflow-hidden">
        <div
          className="grid grid-cols-[1.2fr_1.4fr_.8fr] gap-2 px-3 py-2
          bg-gray-50 dark:bg-white/[0.04] border-b border-gray-200 dark:border-white/[0.07]"
        >
          {asList(t('viz.visitors.head', { returnObjects: true })).map((h, i) => (
            <span
              key={i}
              className={[
                'text-[9.5px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400',
                i === 2 ? 'text-right' : ''
              ].join(' ')}
            >
              {h}
            </span>
          ))}
        </div>
        {(Array.isArray(rows) ? rows : []).map((r, i) => (
          <div
            key={i}
            className="grid grid-cols-[1.2fr_1.4fr_.8fr] gap-2 items-center px-3 py-2.5
            border-b border-gray-100 dark:border-white/[0.05] last:border-0"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <Globe className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="text-[11px] text-gray-700 dark:text-gray-300 truncate">
                {r.city}
              </span>
            </span>
            <span className="text-[11px] text-gray-600 dark:text-gray-400 truncate font-mono">
              {r.page}
            </span>
            <span className="text-[10.5px] text-right tabular-nums text-gray-500 dark:text-gray-400">
              {r.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- 11. Yapay zekâ */

/** Temsilciye yanıt önerisi. */
export const AiVisual = () => {
  const { t } = useTranslation();
  return (
    <div className="p-5">
      <div
        className="rounded-xl border border-gray-200 dark:border-white/[0.08]
        bg-gray-50 dark:bg-white/[0.02] p-3"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          {t('viz.ai.incoming')}
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-gray-700 dark:text-gray-300">
          {t('viz.ai.question')}
        </p>
      </div>

      <div
        className="mt-3 rounded-xl border border-violet-200 dark:border-violet-500/25
        bg-violet-50/60 dark:bg-violet-500/[0.07] p-3"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">
            {t('viz.ai.suggestion')}
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-gray-700 dark:text-gray-300">
          {t('viz.ai.draft')}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {asList(t('viz.ai.actions', { returnObjects: true })).map((a, i) => (
            <span
              key={i}
              className={[
                'px-2 py-1 rounded-md text-[10px] font-medium',
                i === 0
                  ? 'bg-violet-600 text-white'
                  : 'border border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-300'
              ].join(' ')}
            >
              {a}
            </span>
          ))}
        </div>
      </div>

      <p className="mt-3 text-[10.5px] leading-relaxed text-gray-500 dark:text-gray-400">
        {t('viz.ai.note')}
      </p>
    </div>
  );
};

/* ---------------------------------------------------------------- 12. CRM */

/** Konuşmadan doğan fırsatların hattı. */
export const CrmVisual = () => {
  const { t } = useTranslation();
  const stages = t('viz.crm.stages', { returnObjects: true });
  const tones = ['sky', 'indigo', 'violet', 'emerald'];

  return (
    <div className="p-4 grid grid-cols-4 gap-2">
      {(Array.isArray(stages) ? stages : []).map((s, i) => {
        const a = accent(tones[i % 4]);
        return (
          <div
            key={i}
            className="rounded-xl border border-gray-200 dark:border-white/[0.08]
            bg-gray-50/60 dark:bg-white/[0.02] p-2"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 truncate">
                {s.name}
              </span>
              <span className={['text-[9.5px] font-bold tabular-nums', a.text].join(' ')}>
                {s.count}
              </span>
            </div>
            <div className="mt-1.5 space-y-1">
              {s.cards.map((c: any, j: number) => (
                <div
                  key={j}
                  className="rounded-lg bg-white dark:bg-white/[0.05]
                  border border-gray-200 dark:border-white/[0.07] px-2 py-1.5"
                >
                  <p className="text-[9.5px] font-medium text-gray-800 dark:text-gray-200 truncate">
                    {c.title}
                  </p>
                  <p className={['text-[9px] font-semibold tabular-nums', a.text].join(' ')}>
                    {c.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* --------------------------------------------------------------- eşleme */

/** Özellik kimliğinden görsele. Features/FeatureDetail aynı haritayı kullanır. */
export const FEATURE_VISUAL = {
  'live-chat': InboxVisual,
  'universal-widget': WidgetVisual,
  routing: RoutingVisual,
  automation: AutomationVisual,
  proactive: ProactiveVisual,
  'knowledge-base': KnowledgeVisual,
  analytics: AnalyticsVisual,
  team: TeamVisual,
  'ai-assist': AiVisual,
  visitors: VisitorsVisual,
  crm: CrmVisual
};
