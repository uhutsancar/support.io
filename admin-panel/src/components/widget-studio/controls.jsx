import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, AlertTriangle, Pipette } from 'lucide-react';
import { contrastVerdict, normalizeHex, readableOn, SWATCHES } from '../../lib/color';

/**
 * Widget stüdyosunun kontrol primitifleri.
 *
 * Tasarım ilkesi: her kontrol, ayarladığı şeye BENZESİN. Konum seçimi bir
 * tarayıcı penceresi diyagramıdır, boyut seçimi gerçek ölçekte daireler
 * gösterir, ikon seçimi ikonu gerçek launcher içinde çizer. Eski ekran her şeyi
 * `<select>` ile soruyordu: "Bottom Right" yazısını okuyup zihninde
 * canlandırmanız gerekiyordu.
 */

/* ------------------------------------------------------------------ Field */

export const Field = ({ label, hint, children, htmlFor, className = '' }) => (
  <div className={`space-y-1.5 ${className}`}>
    {label && (
      <label
        htmlFor={htmlFor}
        className="block text-[13px] font-medium text-gray-700 dark:text-gray-300"
      >
        {label}
      </label>
    )}
    {children}
    {hint && <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{hint}</p>}
  </div>
);

export const Section = ({ title, description, children, action }) => (
  <section className="space-y-4">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
        {description && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed max-w-prose">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
    {children}
  </section>
);

/* --------------------------------------------------------------- Segmented */

export const Segmented = ({ value, onChange, options, size = 'md', ariaLabel }) => (
  <div
    role="radiogroup"
    aria-label={ariaLabel}
    className="inline-flex w-full rounded-lg bg-gray-100 dark:bg-gray-800 p-1 gap-1"
  >
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={active}
          onClick={() => onChange(option.value)}
          className={`flex-1 min-w-0 rounded-md font-medium transition-all duration-150
            ${size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-[13px]'}
            focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1
            dark:focus-visible:ring-offset-gray-900
            ${active
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
        >
          <span className="flex items-center justify-center gap-1.5 truncate">
            {option.icon}
            {option.label}
          </span>
        </button>
      );
    })}
  </div>
);

/* ------------------------------------------------------------------ Toggle */

export const Toggle = ({ checked, onChange, label, description, id }) => (
  <div className="flex items-start justify-between gap-4 py-1">
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
        {label}
      </label>
      {description && <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>}
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={Boolean(checked)}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-10 h-6 rounded-full transition-colors duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
        dark:focus-visible:ring-offset-gray-900
        ${checked ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm
          transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  </div>
);

/* ------------------------------------------------------------------ Slider */

export const Slider = ({ value, onChange, min, max, step = 1, unit = '', label, id }) => (
  <Field label={label} htmlFor={id}>
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 rounded-full appearance-none bg-gray-200 dark:bg-gray-700 cursor-pointer
          accent-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      />
      <span className="shrink-0 w-16 text-right text-xs font-mono tabular-nums text-gray-600 dark:text-gray-400">
        {value}
        {unit}
      </span>
    </div>
  </Field>
);

/* -------------------------------------------------------------- ColorField */

/**
 * Renk alanı: kova + hex girişi + hazır palet + kontrast rozeti.
 *
 * `contrastAgainst` verilirse WCAG oranı hesaplanır ve eşiği geçmiyorsa uyarı
 * gösterilir. Bu, "widget'ta yazı okunmuyor" destek talebini kaynağında keser.
 */
export const ColorField = ({ label, value, onChange, contrastAgainst, contrastLabel, large = false }) => {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const commit = (raw) => {
    const hex = normalizeHex(raw);
    if (hex) onChange(hex);
    else setDraft(value);
  };

  const verdict = contrastAgainst ? contrastVerdict(value, contrastAgainst, { large }) : null;

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <div className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-gray-700 dark:text-gray-300 truncate">{label}</span>
        {verdict && (
          <span
            className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium
              ${verdict.passes ? 'text-gray-500 dark:text-gray-400' : 'text-amber-600 dark:text-amber-500'}`}
          >
            {!verdict.passes && <AlertTriangle className="w-3 h-3" />}
            {contrastLabel} {verdict.ratio}:1 · {verdict.level === 'fail' ? 'AA ✗' : verdict.level}
          </span>
        )}
      </div>

      <div className="relative shrink-0 flex items-center gap-1.5" ref={popRef}>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={label}
          aria-expanded={open}
          className="w-8 h-8 rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm
            transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2
            focus-visible:ring-indigo-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-gray-900"
          style={{ backgroundColor: value }}
        />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget.value)}
          spellCheck={false}
          className="w-[86px] px-2 py-1.5 text-xs font-mono uppercase rounded-lg border
            border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800
            text-gray-900 dark:text-gray-100 focus:outline-none focus:border-indigo-500
            focus:ring-2 focus:ring-indigo-500/20"
        />

        {open && (
          <div
            className="absolute right-0 top-10 z-30 w-56 p-3 rounded-xl border border-gray-200
              dark:border-gray-700 bg-white dark:bg-gray-800 shadow-xl"
          >
            <div className="grid grid-cols-7 gap-1.5">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => { onChange(swatch); setOpen(false); }}
                  aria-label={swatch}
                  className="relative w-6 h-6 rounded-md border border-black/10 dark:border-white/10
                    transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2
                    focus-visible:ring-indigo-500"
                  style={{ backgroundColor: swatch }}
                >
                  {value.toUpperCase() === swatch && (
                    <Check className="absolute inset-0 m-auto w-3.5 h-3.5" style={{ color: readableOn(swatch) }} />
                  )}
                </button>
              ))}
            </div>
            <label
              className="mt-3 flex items-center gap-2 px-2 py-1.5 rounded-lg border border-dashed
                border-gray-300 dark:border-gray-600 text-xs text-gray-600 dark:text-gray-400
                cursor-pointer hover:border-indigo-400"
            >
              <Pipette className="w-3.5 h-3.5" />
              <span className="flex-1">{label}</span>
              <input
                type="color"
                value={value}
                onChange={(e) => onChange(e.target.value.toUpperCase())}
                className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

/* --------------------------------------------------------- PositionPicker */

/** Mini tarayıcı diyagramı: köşeye tıklayarak widget konumu seçilir. */
export const PositionPicker = ({ value, onChange, color, labels }) => {
  const corners = [
    { value: 'top-left', style: 'top-2 left-2' },
    { value: 'top-right', style: 'top-2 right-2' },
    { value: 'bottom-left', style: 'bottom-2 left-2' },
    { value: 'bottom-right', style: 'bottom-2 right-2' }
  ];

  return (
    <div
      className="relative w-full aspect-[16/9] rounded-lg border border-gray-200 dark:border-gray-700
        bg-gray-50 dark:bg-gray-800/60 overflow-hidden"
      role="radiogroup"
      aria-label={labels.position}
    >
      {/* sahte sayfa iskeleti — konumun sayfaya göre nerede olduğunu gösterir */}
      <div className="absolute inset-x-0 top-0 h-5 bg-gray-200/70 dark:bg-gray-700/60 flex items-center gap-1 px-2">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400/70" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400/70" />
        <span className="w-1.5 h-1.5 rounded-full bg-gray-400/70" />
      </div>
      <div className="absolute left-3 right-3 top-8 space-y-1.5" aria-hidden="true">
        <div className="h-1.5 w-2/5 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="h-1.5 w-3/5 rounded-full bg-gray-200 dark:bg-gray-700" />
        <div className="h-1.5 w-1/3 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>

      {corners.map((corner) => {
        const active = corner.value === value;
        return (
          <button
            key={corner.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={labels[corner.value]}
            title={labels[corner.value]}
            onClick={() => onChange(corner.value)}
            className={`absolute ${corner.style} w-7 h-7 rounded-full transition-all duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-indigo-500
              dark:focus-visible:ring-offset-gray-800
              ${active ? 'scale-100 shadow-lg' : 'scale-75 opacity-25 hover:opacity-60 hover:scale-90'}`}
            style={{ backgroundColor: active ? color : '#9CA3AF' }}
          >
            {active && (
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 m-auto" fill="none"
                   stroke={readableOn(color)} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------- SizePicker */

/** Boyutu gerçek oranlarda gösterir — "Medium" yazısı bunu anlatmaz. */
export const SizePicker = ({ value, onChange, color, labels }) => {
  const sizes = [
    { value: 'small', px: 22 },
    { value: 'medium', px: 28 },
    { value: 'large', px: 34 }
  ];
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={labels.size}>
      {sizes.map((size) => {
        const active = size.value === value;
        return (
          <button
            key={size.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(size.value)}
            className={`flex flex-col items-center gap-2 py-3 rounded-xl border transition-all duration-150
              focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
              ${active
                ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-500/10 dark:border-indigo-500'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
          >
            <span
              className="rounded-full transition-all duration-200"
              style={{ width: size.px, height: size.px, backgroundColor: active ? color : '#D1D5DB' }}
            />
            <span
              className={`text-[11px] font-medium ${
                active ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {labels[size.value]}
            </span>
          </button>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------ PresetCard */

/**
 * Hazır tema kartı: renk noktaları değil, minyatür bir widget çizer.
 * Kullanıcı seçmeden önce sonucu görür.
 */
export const PresetCard = ({ preset, active, onSelect }) => {
  const c = preset.colors;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`group relative text-left rounded-xl border p-2.5 transition-all duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
        ${active
          ? 'border-indigo-500 ring-2 ring-indigo-500/20'
          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}`}
    >
      {/* minyatür widget */}
      <div
        className="rounded-lg overflow-hidden border shadow-sm"
        style={{ backgroundColor: c.background, borderColor: c.border }}
      >
        <div className="flex items-center gap-1.5 px-2 py-1.5" style={{ backgroundColor: c.header }}>
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: readableOn(c.header), opacity: 0.9 }} />
          <span className="h-1 w-8 rounded-full" style={{ backgroundColor: readableOn(c.header), opacity: 0.55 }} />
        </div>
        <div className="p-2 space-y-1.5">
          <span
            className="block h-3 w-3/5 rounded-md rounded-bl-sm"
            style={{ backgroundColor: c.agentMessageBg }}
          />
          <span
            className="block h-3 w-2/3 ml-auto rounded-md rounded-br-sm"
            style={{ backgroundColor: c.visitorMessageBg }}
          />
          <span
            className="block h-3 w-2/5 rounded-md rounded-bl-sm"
            style={{ backgroundColor: c.agentMessageBg }}
          />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 truncate">{preset.name}</span>
        {active && <Check className="w-3.5 h-3.5 shrink-0 text-indigo-600 dark:text-indigo-400" />}
      </div>
    </button>
  );
};

/* ------------------------------------------------------------- IconPicker */

export const LAUNCHER_ICONS = {
  'message-circle': 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  'message-square': 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  'help-circle': 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
  'life-buoy': 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M9.17 14.83l-4.24 4.24',
  headphones: 'M3 18v-6a9 9 0 0 1 18 0v6M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z',
  sparkles: 'm12 3-1.9 5.8L4 10.7l6.1 1.9L12 18.4l1.9-5.8 6.1-1.9-6.1-1.9zM19 3v4M21 5h-4'
};

export const IconPicker = ({ value, onChange, color, label }) => (
  <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label={label}>
    {Object.entries(LAUNCHER_ICONS).map(([key, path]) => {
      const active = key === value;
      return (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={active}
          aria-label={key}
          title={key}
          onClick={() => onChange(key)}
          className={`aspect-square rounded-xl flex items-center justify-center transition-all duration-150
            focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1
            dark:focus-visible:ring-offset-gray-900
            ${active ? 'shadow-md scale-105' : 'bg-gray-100 dark:bg-gray-800 hover:scale-105'}`}
          style={active ? { backgroundColor: color } : undefined}
        >
          <svg
            viewBox="0 0 24 24"
            className="w-5 h-5"
            fill="none"
            stroke={active ? readableOn(color) : 'currentColor'}
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={!active ? { color: '#6B7280' } : undefined}
          >
            <path d={path} />
          </svg>
        </button>
      );
    })}
  </div>
);

/* ---------------------------------------------------------------- Collapse */

export const Collapse = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-[13px] font-medium
          text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition"
      >
        {title}
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 pt-1 space-y-4 border-t border-gray-100 dark:border-gray-800">{children}</div>}
    </div>
  );
};
