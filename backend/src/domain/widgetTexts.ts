// The widget's first words that the product writes on the owner's behalf
// until they write their own: onboarding's (routes/onboarding.ts), the model
// defaults (models/Site.ts, models/WidgetConfig.ts) and the demo seed. A text
// still equal to one of them is not the owner's, so the widget says it in the
// visitor's own language instead (PRD-16) — a German visitor is not greeted
// with a Turkish line nobody chose.

export const STOCK_WIDGET_TEXTS = {
  tr: {
    welcome: 'Merhaba! Size nasıl yardımcı olabiliriz? 👋',
    placeholder: 'Mesajınızı buraya yazın...'
  },
  en: { welcome: 'Hi! How can we help you? 👋', placeholder: 'Type your message...' }
} as const;

const STOCK = new Set<string>([
  STOCK_WIDGET_TEXTS.tr.welcome,
  STOCK_WIDGET_TEXTS.tr.placeholder,
  STOCK_WIDGET_TEXTS.en.welcome,
  STOCK_WIDGET_TEXTS.en.placeholder,
  'Merhaba! Size nasıl yardımcı olabiliriz?',
  'Hi! How can we help you today?'
]);

/** The owner's own text, or '' when it is one of ours (or empty). */
export function ownWidgetText(text: unknown): string {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  return STOCK.has(trimmed) ? '' : trimmed;
}
