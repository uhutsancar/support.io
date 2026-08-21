import React from 'react';
import { readableOn } from '../../lib/color';
import { LAUNCHER_ICONS } from './controls';

/**
 * Widget stüdyosunun canlı önizlemesi.
 *
 * Bu bileşen, `backend/public/widget.js` içindeki gerçek widget'ın ölçülerini
 * ve yerleşimini birebir taklit eder: aynı balon yarıçapları, aynı başlık
 * yüksekliği, aynı composer düzeni, aynı launcher boyutları. Eski önizleme
 * kendi `bg-white rounded-2xl` sınıflarını uyguluyordu — yani yapılandırdığınız
 * arkaplan ve köşe yarıçapı önizlemede GÖRÜNMÜYORDU ve canlı sitede sürpriz
 * oluyordu.
 *
 * Ölçek: kutuya sığması için `transform: scale()` kullanılır, boyut
 * değerleri değiştirilmez — 400x640'lık bir widget küçültülmüş haliyle de
 * doğru orana sahip olur.
 */

const SIZE_PX = { small: 52, medium: 60, large: 68 };

const Dots = ({ color }) => (
  <span className="inline-flex gap-1 items-center">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="w-1.5 h-1.5 rounded-full animate-bounce"
        style={{ backgroundColor: color, animationDelay: `${i * 140}ms` }}
      />
    ))}
  </span>
);

const StudioPreview = ({ config, open, device = 'desktop', availability = 'online', strings }) => {
  const colors = config.colors;
  const branding = config.branding;
  const button = config.button;
  const win = config.window;
  const messages = config.messages;

  const onHeader = readableOn(colors.header);
  const onPrimary = readableOn(colors.primary);
  const onVisitor = readableOn(colors.visitorMessageBg);
  const onAgent = readableOn(colors.agentMessageBg);

  const launcherSize = SIZE_PX[button.size] || 60;
  const launcherRadius = button.borderRadius >= 50 ? '50%' : `${button.borderRadius}%`;
  const iconPath = LAUNCHER_ICONS[button.icon] || LAUNCHER_ICONS['message-circle'];

  const isMobile = device === 'mobile';
  const frameW = isMobile ? 320 : 440;
  const frameH = isMobile ? 620 : 560;

  // Widget'ın yapılandırılmış ölçüsü kutuya sığmıyorsa orantılı küçültülür.
  const panelW = isMobile ? frameW : win.width;
  const panelH = isMobile ? frameH : win.height;
  const scale = isMobile
    ? 1
    : Math.min(1, (frameW - 40) / panelW, (frameH - 40) / (panelH + launcherSize + 12));

  const statusText =
    availability === 'online' ? strings.online : availability === 'away' ? strings.away : strings.offline;
  const statusDot = availability === 'online' ? '#22C55E' : availability === 'away' ? '#F59E0B' : '#9CA3AF';

  const alignRight = button.position.includes('right');
  const alignBottom = button.position.includes('bottom');

  const panel = (
    <div
      className="flex flex-col overflow-hidden shadow-2xl"
      style={{
        width: isMobile ? '100%' : win.width,
        height: isMobile ? '100%' : win.height,
        backgroundColor: colors.background,
        color: colors.text,
        borderRadius: isMobile ? 0 : win.borderRadius,
        border: isMobile ? 'none' : `1px solid ${colors.border}`
      }}
    >
      {/* başlık */}
      {win.showHeader !== false && (
        <div
          className="flex items-center gap-3 px-4 shrink-0"
          style={{ backgroundColor: colors.header, color: onHeader, minHeight: win.headerHeight, paddingTop: 12, paddingBottom: 12 }}
        >
          {branding.logo ? (
            <img
              src={branding.logo}
              alt=""
              className="object-contain rounded-lg shrink-0"
              style={{ width: branding.logoWidth, height: branding.logoHeight, background: 'rgba(255,255,255,.14)' }}
            />
          ) : (
            <span
              className="shrink-0 rounded-lg flex items-center justify-center text-sm font-bold"
              style={{ width: 34, height: 34, background: 'rgba(255,255,255,.16)' }}
            >
              {(branding.brandName || 'S').charAt(0).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            {branding.showBrandName !== false && (
              <div className="text-[15px] font-semibold leading-tight truncate">{branding.brandName}</div>
            )}
            <div className="flex items-center gap-1.5 text-[12px] opacity-85 mt-0.5">
              <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ backgroundColor: statusDot }} />
              <span className="truncate">{statusText}</span>
            </div>
          </div>
          {win.showCloseButton !== false && (
            <span className="shrink-0 opacity-80" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M5 12h14" />
              </svg>
            </span>
          )}
        </div>
      )}

      {/* mesajlar */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-2.5">
        {messages.welcomeMessage ? (
          <div className="flex flex-col gap-1 self-start max-w-[82%]">
            {messages.showAvatars !== false && (
              <span className="text-[11px] font-semibold px-1" style={{ color: colors.textSecondary }}>
                {branding.brandName}
              </span>
            )}
            <span
              className="px-3 py-2.5 text-[14px] leading-relaxed"
              style={{
                backgroundColor: colors.agentMessageBg,
                color: onAgent,
                borderRadius: messages.messageBubbleRadius,
                borderBottomLeftRadius: 5
              }}
            >
              {messages.welcomeMessage}
            </span>
            {messages.showTimestamps !== false && (
              <span className="text-[10.5px] px-1" style={{ color: colors.textSecondary }}>09:24</span>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-1 self-end items-end max-w-[82%]">
          <span
            className="px-3 py-2.5 text-[14px] leading-relaxed"
            style={{
              backgroundColor: colors.visitorMessageBg,
              color: onVisitor,
              borderRadius: messages.messageBubbleRadius,
              borderBottomRightRadius: 5
            }}
          >
            {strings.sampleVisitor}
          </span>
          {messages.showTimestamps !== false && (
            <span className="text-[10.5px] px-1" style={{ color: colors.textSecondary }}>09:25</span>
          )}
        </div>

        <span
          className="self-start px-3.5 py-3"
          style={{ backgroundColor: colors.agentMessageBg, borderRadius: messages.messageBubbleRadius }}
        >
          <Dots color={colors.textSecondary} />
        </span>
      </div>

      {/* composer */}
      <div
        className="shrink-0 flex items-end gap-2 p-2.5"
        style={{ borderTop: `1px solid ${colors.border}`, backgroundColor: colors.background }}
      >
        <span className="shrink-0 w-8 h-8 flex items-center justify-center" style={{ color: colors.textSecondary }}>
          <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </span>
        <span
          className="flex-1 min-w-0 px-3 py-2.5 text-[14px] truncate"
          style={{ border: `1px solid ${colors.border}`, borderRadius: 12, color: colors.textSecondary }}
        >
          {messages.placeholderText || strings.placeholder}
        </span>
        <span
          className="shrink-0 w-[38px] h-[38px] rounded-[11px] flex items-center justify-center"
          style={{ backgroundColor: colors.primary, color: onPrimary }}
        >
          <svg viewBox="0 0 24 24" className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4 20-7z" />
          </svg>
        </span>
      </div>
    </div>
  );

  const launcher = (
    <span
      className="flex items-center gap-2.5 shrink-0"
      style={{ flexDirection: alignRight ? 'row' : 'row-reverse' }}
    >
      {button.showLabel && button.labelText && (
        <span
          className="px-3.5 py-2 text-[13px] font-medium shadow-lg whitespace-nowrap"
          style={{ backgroundColor: colors.background, color: colors.text, borderRadius: 999, border: `1px solid ${colors.border}` }}
        >
          {button.labelText}
        </span>
      )}
      <span
        className="flex items-center justify-center"
        style={{
          width: launcherSize,
          height: launcherSize,
          borderRadius: launcherRadius,
          backgroundColor: colors.primary,
          color: onPrimary,
          boxShadow: button.shadow === false ? 'none' : `0 8px 24px ${colors.primary}52, 0 2px 6px rgba(0,0,0,.12)`
        }}
      >
        <svg viewBox="0 0 24 24" className="w-[26px] h-[26px]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d={iconPath} />
        </svg>
      </span>
    </span>
  );

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700
        bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%,transparent_75%,#f8fafc_75%),linear-gradient(45deg,#f8fafc_25%,transparent_25%,transparent_75%,#f8fafc_75%)]
        dark:bg-[linear-gradient(45deg,#1f2937_25%,transparent_25%,transparent_75%,#1f2937_75%),linear-gradient(45deg,#1f2937_25%,transparent_25%,transparent_75%,#1f2937_75%)]
        bg-white dark:bg-gray-900"
      style={{ width: frameW, height: frameH, backgroundSize: '16px 16px', backgroundPosition: '0 0, 8px 8px' }}
    >
      {/* sahte tarayıcı çubuğu — widget'ın sayfaya göre yerini gösterir */}
      <div className="absolute inset-x-0 top-0 h-7 flex items-center gap-1.5 px-3 bg-gray-100/90 dark:bg-gray-800/90 border-b border-gray-200 dark:border-gray-700 z-10">
        <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
        <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
        <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
        <span className="ml-2 text-[10px] text-gray-400 dark:text-gray-500 truncate">
          {isMobile ? '375 × 667' : `${win.width} × ${win.height}`}
        </span>
      </div>

      {isMobile && open ? (
        <div className="absolute inset-0 top-7">{panel}</div>
      ) : (
        <div
          className="absolute flex flex-col gap-3"
          style={{
            [alignRight ? 'right' : 'left']: 16,
            [alignBottom ? 'bottom' : 'top']: alignBottom ? 16 : 40,
            alignItems: alignRight ? 'flex-end' : 'flex-start',
            transform: `scale(${scale})`,
            transformOrigin: `${alignBottom ? 'bottom' : 'top'} ${alignRight ? 'right' : 'left'}`
          }}
        >
          {alignBottom ? (
            <>
              {open && panel}
              {launcher}
            </>
          ) : (
            <>
              {launcher}
              {open && panel}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default StudioPreview;
