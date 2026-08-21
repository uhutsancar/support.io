import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Palette, Sparkles, MousePointerClick, MessageSquare, Settings2,
  Monitor, Smartphone, Save, RotateCcw, Upload, Trash2, Wand2, Check, Copy,
  Eye, EyeOff, Code2, Loader2
} from 'lucide-react';

import { sitesAPI, widgetConfigAPI } from '../services/api';
import StudioPreview from '../components/widget-studio/StudioPreview';
import { PRESETS, matchPreset } from '../components/widget-studio/presets';
import {
  Section, Field, Segmented, Toggle, Slider, ColorField,
  PositionPicker, SizePicker, PresetCard, IconPicker, Collapse
} from '../components/widget-studio/controls';
import { derivePalette, normalizeHex } from '../lib/color';

/**
 * Widget Studio.
 *
 * Eski ekranın sorunları ve buradaki karşılıkları:
 *
 *  - Sekiz çıplak `<input type="color">` alt alta duruyordu; hangi rengin nereye
 *    gittiği belli değildi ve okunmayan kombinasyonlar serbestti.
 *    → Hazır tema galerisi (minyatür widget çizen kartlar), ana renkten palet
 *      türetme ve her renkte WCAG kontrast rozeti.
 *
 *  - Konum, boyut ve ikon `<select>` ile soruluyordu.
 *    → Konum bir tarayıcı diyagramı, boyut gerçek ölçekli daireler, ikon gerçek
 *      launcher içinde çizilir.
 *
 *  - Her tuş vuruşunda 500ms sonra sunucuya YAZILIYORDU. Yarım yazılmış bir hex
 *    ("#4F4") canlı widget'a gidiyordu ve geri alma yoktu.
 *    → Yerel taslak + belirgin kaydet/geri al + kaydedilmemiş değişiklik uyarısı.
 *
 *  - Önizleme kendi `bg-white rounded-2xl` sınıflarını uyguladığı için
 *    yapılandırılan arkaplan ve köşe yarıçapı görünmüyordu.
 *    → StudioPreview gerçek widget ölçülerini birebir kullanır.
 */

const TABS = [
  { id: 'theme', icon: Palette },
  { id: 'brand', icon: Sparkles },
  { id: 'launcher', icon: MousePointerClick },
  { id: 'messages', icon: MessageSquare },
  { id: 'advanced', icon: Settings2 }
];

/** Sunucudan gelen config'i, eksik alanları doldurarak taslağa çevirir. */
const toDraft = (config) => JSON.parse(JSON.stringify(config));

const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const WidgetCustomization = () => {
  const { t, i18n } = useTranslation();
  const { siteId } = useParams();
  const navigate = useNavigate();

  const [site, setSite] = useState(null);
  const [saved, setSaved] = useState(null);   // sunucudaki son hâl
  const [draft, setDraft] = useState(null);   // düzenlenen hâl
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState('theme');
  const [device, setDevice] = useState('desktop');
  const [previewOpen, setPreviewOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef(null);

  const langPrefix = i18n.language === 'en' ? '/en' : '';
  const dirty = useMemo(() => Boolean(draft && saved && !equal(draft, saved)), [draft, saved]);

  /* ------------------------------------------------------------- yükleme */

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [siteRes, configRes] = await Promise.all([
        sitesAPI.getOne(siteId),
        widgetConfigAPI.getConfig(siteId)
      ]);
      setSite(siteRes.data.site);
      const config = configRes.data.config;
      setSaved(toDraft(config));
      setDraft(toDraft(config));
    } catch (error) {
      setLoadError(error?.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  // Kaydedilmemiş değişiklikle sekmeyi kapatmak veri kaybıdır.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Cmd/Ctrl+S ile kaydet — bu ekranda beklenen kısayol.
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (dirty && !saving) save();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  /* ------------------------------------------------------------ değişim */

  const patch = useCallback((group, values) => {
    setDraft((current) => (current ? { ...current, [group]: { ...current[group], ...values } } : current));
  }, []);

  const applyPreset = (preset) => {
    setDraft((current) => (current ? { ...current, colors: { ...current.colors, ...preset.colors } } : current));
  };

  const deriveFromPrimary = () => {
    const primary = normalizeHex(draft.colors.primary) || '#4F46E5';
    const isDark = matchPreset(draft.colors)
      ? PRESETS.find((p) => p.id === matchPreset(draft.colors))?.mode === 'dark'
      : false;
    patch('colors', derivePalette(primary, { dark: isDark }));
    toast.success(t('studio.toast.derived'));
  };

  /* -------------------------------------------------------------- kayıt */

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const response = await widgetConfigAPI.updateConfig(siteId, {
        colors: draft.colors,
        branding: draft.branding,
        button: draft.button,
        window: draft.window,
        messages: draft.messages,
        behavior: draft.behavior,
        typography: draft.typography,
        advanced: draft.advanced
      });
      const next = toDraft(response.data.config);
      setSaved(next);
      setDraft(next);
      toast.success(t('studio.toast.saved'));
    } catch (error) {
      toast.error(error?.response?.data?.error || t('studio.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const revert = () => {
    setDraft(toDraft(saved));
    toast(t('studio.toast.reverted'), { icon: '↩︎' });
  };

  /* --------------------------------------------------------------- logo */

  const uploadLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error(t('studio.toast.logoTooLarge')); return; }
    if (!file.type.startsWith('image/')) { toast.error(t('studio.toast.logoNotImage')); return; }

    setUploading(true);
    try {
      const response = await widgetConfigAPI.uploadLogo(siteId, file);
      const next = toDraft(response.data.config);
      // Logo sunucu tarafında hemen kaydedilir; taslaktaki diğer düzenlemeler
      // korunmalı, yalnızca logo alanı güncellenmeli.
      setSaved((s) => ({ ...s, branding: { ...s.branding, logo: next.branding.logo } }));
      setDraft((d) => ({ ...d, branding: { ...d.branding, logo: next.branding.logo } }));
      toast.success(t('studio.toast.logoUploaded'));
    } catch (error) {
      toast.error(error?.response?.data?.error || t('studio.toast.logoFailed'));
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    setUploading(true);
    try {
      await widgetConfigAPI.deleteLogo(siteId);
      setSaved((s) => ({ ...s, branding: { ...s.branding, logo: null } }));
      setDraft((d) => ({ ...d, branding: { ...d.branding, logo: null } }));
      toast.success(t('studio.toast.logoRemoved'));
    } catch (error) {
      toast.error(error?.response?.data?.error || t('studio.toast.logoFailed'));
    } finally {
      setUploading(false);
    }
  };

  /* -------------------------------------------------------- embed kodu */

  const embedCode = useMemo(() => {
    const origin = import.meta.env.VITE_API_URL || window.location.origin;
    return `<script\n  src="${origin}/widget.js"\n  data-site-key="${site?.siteKey || 'YOUR_SITE_KEY'}"\n  async><\/script>`;
  }, [site]);

  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t('studio.toast.copied'));
    } catch (e) {
      toast.error(t('studio.toast.copyFailed'));
    }
  };

  /* ------------------------------------------------------------ durumlar */

  if (loading) {
    return (
      <div className="max-w-[1400px] mx-auto animate-pulse space-y-6">
        <div className="h-9 w-64 rounded-lg bg-gray-200 dark:bg-gray-800" />
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_480px] gap-6">
          <div className="space-y-3">
            <div className="h-11 rounded-xl bg-gray-200 dark:bg-gray-800" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-14 rounded-xl bg-gray-100 dark:bg-gray-800/60" />
            ))}
          </div>
          <div className="h-[560px] rounded-2xl bg-gray-100 dark:bg-gray-800/60" />
        </div>
      </div>
    );
  }

  if (loadError || !draft) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <p className="text-sm text-gray-900 dark:text-white font-medium">{t('studio.loadError')}</p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{loadError}</p>
        <button
          onClick={load}
          className="mt-4 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  const activePreset = matchPreset(draft.colors);
  const previewStrings = {
    online: t('studio.preview.online'),
    away: t('studio.preview.away'),
    offline: t('studio.preview.offline'),
    placeholder: t('studio.preview.placeholder'),
    sampleVisitor: t('studio.preview.sampleVisitor')
  };
  const positionLabels = {
    position: t('studio.launcher.position'),
    'top-left': t('studio.launcher.topLeft'),
    'top-right': t('studio.launcher.topRight'),
    'bottom-left': t('studio.launcher.bottomLeft'),
    'bottom-right': t('studio.launcher.bottomRight')
  };
  const sizeLabels = {
    size: t('studio.launcher.size'),
    small: t('studio.launcher.small'),
    medium: t('studio.launcher.medium'),
    large: t('studio.launcher.large')
  };

  return (
    <>
      <Helmet>
        <title>{`${t('studio.title')} — ${site?.name || ''} — Support.io`}</title>
      </Helmet>

      <div className="max-w-[1400px] mx-auto pb-24 xl:pb-0">
        {/* ---------------------------------------------------------- başlık */}
        <header className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={() => navigate(`${langPrefix}/dashboard/sites`)}
            aria-label={t('common.back')}
            className="shrink-0 p-2 -ml-2 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white
              hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white truncate">
              {t('studio.title')}
            </h1>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 truncate">{site?.name}</p>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {dirty && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {t('studio.unsaved')}
              </span>
            )}
            <button
              onClick={revert}
              disabled={!dirty || saving}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white
                hover:bg-gray-100 dark:hover:bg-gray-800 transition disabled:opacity-40
                disabled:hover:bg-transparent"
              title={t('studio.revert')}
              aria-label={t('studio.revert')}
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                bg-indigo-600 text-white hover:bg-indigo-700 transition
                disabled:opacity-40 disabled:hover:bg-indigo-600
                focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
                dark:focus-visible:ring-offset-gray-900"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="hidden sm:inline">{t('common.save')}</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_480px] gap-6 items-start">
          {/* ------------------------------------------------------ kontroller */}
          <div className="min-w-0 space-y-5">
            <nav
              className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800/70 overflow-x-auto"
              role="tablist"
              aria-label={t('studio.title')}
            >
              {TABS.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-[13px] font-medium
                    whitespace-nowrap transition-all duration-150
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500
                    ${tab === id
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {t(`studio.tabs.${id}`)}
                </button>
              ))}
            </nav>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 space-y-8">

              {/* ============================================== TEMA */}
              {tab === 'theme' && (
                <>
                  <Section title={t('studio.theme.presets')} description={t('studio.theme.presetsHint')}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {PRESETS.map((preset) => (
                        <PresetCard
                          key={preset.id}
                          preset={preset}
                          active={activePreset === preset.id}
                          onSelect={() => applyPreset(preset)}
                        />
                      ))}
                    </div>
                  </Section>

                  <Section
                    title={t('studio.theme.palette')}
                    description={t('studio.theme.paletteHint')}
                    action={
                      <button
                        onClick={deriveFromPrimary}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300
                          hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        {t('studio.theme.derive')}
                      </button>
                    }
                  >
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      <ColorField
                        label={t('studio.colors.primary')}
                        value={draft.colors.primary}
                        onChange={(v) => patch('colors', { primary: v })}
                        contrastAgainst={draft.colors.background}
                        contrastLabel={t('studio.contrast')}
                        large
                      />
                      <ColorField
                        label={t('studio.colors.header')}
                        value={draft.colors.header}
                        onChange={(v) => patch('colors', { header: v })}
                      />
                      <ColorField
                        label={t('studio.colors.background')}
                        value={draft.colors.background}
                        onChange={(v) => patch('colors', { background: v })}
                      />
                      <ColorField
                        label={t('studio.colors.text')}
                        value={draft.colors.text}
                        onChange={(v) => patch('colors', { text: v })}
                        contrastAgainst={draft.colors.background}
                        contrastLabel={t('studio.contrast')}
                      />
                      <ColorField
                        label={t('studio.colors.textSecondary')}
                        value={draft.colors.textSecondary}
                        onChange={(v) => patch('colors', { textSecondary: v })}
                        contrastAgainst={draft.colors.background}
                        contrastLabel={t('studio.contrast')}
                      />
                      <ColorField
                        label={t('studio.colors.border')}
                        value={draft.colors.border}
                        onChange={(v) => patch('colors', { border: v })}
                      />
                      <ColorField
                        label={t('studio.colors.visitorMessage')}
                        value={draft.colors.visitorMessageBg}
                        onChange={(v) => patch('colors', { visitorMessageBg: v })}
                      />
                      <ColorField
                        label={t('studio.colors.agentMessage')}
                        value={draft.colors.agentMessageBg}
                        onChange={(v) => patch('colors', { agentMessageBg: v })}
                        contrastAgainst={draft.colors.text}
                        contrastLabel={t('studio.contrast')}
                      />
                    </div>
                  </Section>
                </>
              )}

              {/* ============================================== MARKA */}
              {tab === 'brand' && (
                <>
                  <Section title={t('studio.brand.logo')} description={t('studio.brand.logoHint')}>
                    {draft.branding.logo ? (
                      <div className="flex items-center gap-4">
                        <img
                          src={draft.branding.logo}
                          alt=""
                          className="w-16 h-16 object-contain rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium
                              border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300
                              hover:bg-gray-50 dark:hover:bg-gray-800 transition disabled:opacity-50"
                          >
                            <Upload className="w-3.5 h-3.5" /> {t('studio.brand.replace')}
                          </button>
                          <button
                            onClick={removeLogo}
                            disabled={uploading}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium
                              text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10
                              transition disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> {t('common.delete')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="w-full flex flex-col items-center justify-center gap-2 py-8 rounded-xl
                          border-2 border-dashed border-gray-200 dark:border-gray-700
                          text-gray-500 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600
                          dark:hover:border-indigo-500 transition disabled:opacity-50"
                      >
                        {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Upload className="w-6 h-6" />}
                        <span className="text-[13px] font-medium">{t('studio.brand.upload')}</span>
                        <span className="text-xs">{t('studio.brand.uploadHint')}</span>
                      </button>
                    )}
                    <input ref={fileRef} type="file" accept="image/*" onChange={uploadLogo} className="hidden" />
                  </Section>

                  <Section title={t('studio.brand.identity')}>
                    <Field label={t('studio.brand.name')} htmlFor="brand-name">
                      <input
                        id="brand-name"
                        value={draft.branding.brandName || ''}
                        onChange={(e) => patch('branding', { brandName: e.target.value })}
                        maxLength={40}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                          bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                          focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </Field>
                    <Toggle
                      id="show-brand"
                      label={t('studio.brand.showName')}
                      checked={draft.branding.showBrandName !== false}
                      onChange={(v) => patch('branding', { showBrandName: v })}
                    />
                    {draft.branding.logo && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <Slider
                          id="logo-w"
                          label={t('studio.brand.logoWidth')}
                          value={draft.branding.logoWidth || 40}
                          onChange={(v) => patch('branding', { logoWidth: v })}
                          min={20} max={80} unit="px"
                        />
                        <Slider
                          id="logo-h"
                          label={t('studio.brand.logoHeight')}
                          value={draft.branding.logoHeight || 40}
                          onChange={(v) => patch('branding', { logoHeight: v })}
                          min={20} max={80} unit="px"
                        />
                      </div>
                    )}
                  </Section>
                </>
              )}

              {/* ============================================== LAUNCHER */}
              {tab === 'launcher' && (
                <>
                  <Section title={t('studio.launcher.position')} description={t('studio.launcher.positionHint')}>
                    <PositionPicker
                      value={draft.button.position}
                      onChange={(v) => patch('button', { position: v })}
                      color={draft.colors.primary}
                      labels={positionLabels}
                    />
                  </Section>

                  <Section title={t('studio.launcher.size')}>
                    <SizePicker
                      value={draft.button.size}
                      onChange={(v) => patch('button', { size: v })}
                      color={draft.colors.primary}
                      labels={sizeLabels}
                    />
                  </Section>

                  <Section title={t('studio.launcher.icon')}>
                    <IconPicker
                      value={draft.button.icon}
                      onChange={(v) => patch('button', { icon: v })}
                      color={draft.colors.primary}
                      label={t('studio.launcher.icon')}
                    />
                  </Section>

                  <Section title={t('studio.launcher.shape')}>
                    <Slider
                      id="btn-radius"
                      label={t('studio.launcher.radius')}
                      value={draft.button.borderRadius ?? 50}
                      onChange={(v) => patch('button', { borderRadius: v })}
                      min={12} max={50} unit="%"
                    />
                    <Toggle
                      id="btn-shadow"
                      label={t('studio.launcher.shadow')}
                      checked={draft.button.shadow !== false}
                      onChange={(v) => patch('button', { shadow: v })}
                    />
                    <Toggle
                      id="btn-label"
                      label={t('studio.launcher.showLabel')}
                      description={t('studio.launcher.showLabelHint')}
                      checked={Boolean(draft.button.showLabel)}
                      onChange={(v) => patch('button', { showLabel: v })}
                    />
                    {draft.button.showLabel && (
                      <Field label={t('studio.launcher.labelText')} htmlFor="btn-label-text">
                        <input
                          id="btn-label-text"
                          value={draft.button.labelText || ''}
                          onChange={(e) => patch('button', { labelText: e.target.value })}
                          maxLength={30}
                          placeholder={t('studio.launcher.labelPlaceholder')}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                            bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                            focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </Field>
                    )}
                  </Section>
                </>
              )}

              {/* ============================================== MESAJLAR */}
              {tab === 'messages' && (
                <>
                  <Section title={t('studio.messages.copy')} description={t('studio.messages.copyHint')}>
                    <Field label={t('studio.messages.welcome')} htmlFor="welcome">
                      <textarea
                        id="welcome"
                        rows={3}
                        maxLength={300}
                        value={draft.messages.welcomeMessage || ''}
                        onChange={(e) => patch('messages', { welcomeMessage: e.target.value })}
                        placeholder={t('studio.messages.welcomePlaceholder')}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                          bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-y
                          focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </Field>
                    <Field label={t('studio.messages.placeholder')} htmlFor="placeholder">
                      <input
                        id="placeholder"
                        value={draft.messages.placeholderText || ''}
                        onChange={(e) => patch('messages', { placeholderText: e.target.value })}
                        maxLength={60}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                          bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                          focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </Field>
                  </Section>

                  <Section title={t('studio.messages.bubbles')}>
                    <Slider
                      id="bubble-radius"
                      label={t('studio.messages.bubbleRadius')}
                      value={draft.messages.messageBubbleRadius ?? 14}
                      onChange={(v) => patch('messages', { messageBubbleRadius: v })}
                      min={2} max={22} unit="px"
                    />
                    <Toggle
                      id="timestamps"
                      label={t('studio.messages.timestamps')}
                      checked={draft.messages.showTimestamps !== false}
                      onChange={(v) => patch('messages', { showTimestamps: v })}
                    />
                    <Toggle
                      id="avatars"
                      label={t('studio.messages.senderNames')}
                      checked={draft.messages.showAvatars !== false}
                      onChange={(v) => patch('messages', { showAvatars: v })}
                    />
                  </Section>

                  <Section title={t('studio.behavior.title')} description={t('studio.behavior.hint')}>
                    <Toggle
                      id="auto-open"
                      label={t('studio.behavior.autoOpen')}
                      description={t('studio.behavior.autoOpenHint')}
                      checked={Boolean(draft.behavior.autoOpen)}
                      onChange={(v) => patch('behavior', { autoOpen: v })}
                    />
                    {draft.behavior.autoOpen && (
                      <Slider
                        id="auto-open-delay"
                        label={t('studio.behavior.delay')}
                        value={Math.round((draft.behavior.autoOpenDelay ?? 5000) / 1000)}
                        onChange={(v) => patch('behavior', { autoOpenDelay: v * 1000 })}
                        min={1} max={60} unit="s"
                      />
                    )}
                    <Toggle
                      id="unread-badge"
                      label={t('studio.behavior.unreadBadge')}
                      checked={draft.behavior.showUnreadBadge !== false}
                      onChange={(v) => patch('behavior', { showUnreadBadge: v })}
                    />
                    <Toggle
                      id="sound"
                      label={t('studio.behavior.sound')}
                      description={t('studio.behavior.soundHint')}
                      checked={draft.behavior.enableSound !== false}
                      onChange={(v) => patch('behavior', { enableSound: v })}
                    />
                  </Section>
                </>
              )}

              {/* ============================================== GELİŞMİŞ */}
              {tab === 'advanced' && (
                <>
                  <Section title={t('studio.advanced.window')} description={t('studio.advanced.windowHint')}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Slider
                        id="win-w"
                        label={t('studio.advanced.width')}
                        value={draft.window.width ?? 400}
                        onChange={(v) => patch('window', { width: v })}
                        min={320} max={520} step={10} unit="px"
                      />
                      <Slider
                        id="win-h"
                        label={t('studio.advanced.height')}
                        value={draft.window.height ?? 640}
                        onChange={(v) => patch('window', { height: v })}
                        min={420} max={760} step={10} unit="px"
                      />
                      <Slider
                        id="win-r"
                        label={t('studio.advanced.radius')}
                        value={draft.window.borderRadius ?? 16}
                        onChange={(v) => patch('window', { borderRadius: v })}
                        min={0} max={28} unit="px"
                      />
                      <Slider
                        id="win-hh"
                        label={t('studio.advanced.headerHeight')}
                        value={draft.window.headerHeight ?? 64}
                        onChange={(v) => patch('window', { headerHeight: v })}
                        min={48} max={96} unit="px"
                      />
                    </div>
                    <Toggle
                      id="show-header"
                      label={t('studio.advanced.showHeader')}
                      checked={draft.window.showHeader !== false}
                      onChange={(v) => patch('window', { showHeader: v })}
                    />
                    <Toggle
                      id="show-close"
                      label={t('studio.advanced.showClose')}
                      checked={draft.window.showCloseButton !== false}
                      onChange={(v) => patch('window', { showCloseButton: v })}
                    />
                  </Section>

                  <Section title={t('studio.advanced.motion')}>
                    <Segmented
                      ariaLabel={t('studio.advanced.motion')}
                      value={draft.advanced.animationSpeed || 'normal'}
                      onChange={(v) => patch('advanced', { animationSpeed: v })}
                      options={[
                        { value: 'fast', label: t('studio.advanced.fast') },
                        { value: 'normal', label: t('studio.advanced.normal') },
                        { value: 'slow', label: t('studio.advanced.slow') }
                      ]}
                    />
                  </Section>

                  <Collapse title={t('studio.advanced.customCss')}>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                      {t('studio.advanced.customCssHint')}
                    </p>
                    <textarea
                      rows={8}
                      spellCheck={false}
                      value={draft.advanced.customCSS || ''}
                      onChange={(e) => patch('advanced', { customCSS: e.target.value || null })}
                      placeholder={'.sc-launcher { /* ... */ }'}
                      className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-gray-300
                        dark:border-gray-600 bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100
                        resize-y focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <Slider
                      id="z-index"
                      label={t('studio.advanced.zIndex')}
                      value={draft.advanced.zIndex ?? 2147483000}
                      onChange={(v) => patch('advanced', { zIndex: v })}
                      min={1000} max={2147483000} step={1000}
                    />
                  </Collapse>
                </>
              )}
            </div>

            {/* ------------------------------------------------ embed kodu */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <Code2 className="w-4 h-4" /> {t('studio.embed.title')}
                  </h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t('studio.embed.hint')}</p>
                </div>
                <button
                  onClick={copyEmbed}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                    border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300
                    hover:bg-gray-50 dark:hover:bg-gray-800 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? t('common.copied') : t('common.copy')}
                </button>
              </div>
              <pre className="overflow-x-auto rounded-xl bg-gray-950 p-4 text-[12px] leading-relaxed text-gray-300">
                <code>{embedCode}</code>
              </pre>
              {site?.installation?.verifiedAt ? (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
                  <Check className="w-3.5 h-3.5" /> {t('studio.embed.verified')}
                </p>
              ) : (
                <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse" />
                  {t('studio.embed.waiting')}
                </p>
              )}
            </div>
          </div>

          {/* -------------------------------------------------------- önizleme */}
          <aside className="xl:sticky xl:top-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-gray-700 dark:text-gray-300">
                {t('studio.preview.title')}
              </span>
              <div className="flex items-center gap-1.5">
                <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5">
                  <button
                    onClick={() => setDevice('desktop')}
                    aria-label={t('studio.preview.desktop')}
                    aria-pressed={device === 'desktop'}
                    className={`p-1.5 rounded-md transition ${device === 'desktop'
                      ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDevice('mobile')}
                    aria-label={t('studio.preview.mobile')}
                    aria-pressed={device === 'mobile'}
                    className={`p-1.5 rounded-md transition ${device === 'mobile'
                      ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => setPreviewOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                    bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300
                    hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  {previewOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {previewOpen ? t('studio.preview.collapsed') : t('studio.preview.expanded')}
                </button>
              </div>
            </div>

            <StudioPreview
              config={draft}
              open={previewOpen}
              device={device}
              strings={previewStrings}
            />

            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed">
              {t('studio.preview.note')}
            </p>
          </aside>
        </div>

        {/* Mobil kaydet çubuğu — küçük ekranda başlıktaki buton kaydırma ile
            görünmez oluyordu. */}
        {dirty && (
          <div className="xl:hidden fixed inset-x-0 bottom-0 z-40 p-3 bg-white/95 dark:bg-gray-900/95
            backdrop-blur border-t border-gray-200 dark:border-gray-800 flex items-center gap-3">
            <span className="flex-1 text-xs text-amber-700 dark:text-amber-400 font-medium">
              {t('studio.unsaved')}
            </span>
            <button
              onClick={revert}
              className="px-3 py-2 rounded-lg text-[13px] font-medium text-gray-600 dark:text-gray-400"
            >
              {t('studio.revert')}
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 rounded-lg text-[13px] font-medium bg-indigo-600 text-white disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t('common.save')}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default WidgetCustomization;
