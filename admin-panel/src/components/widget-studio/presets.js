import { derivePalette } from '../../lib/color';

/**
 * Hazır temalar.
 *
 * Her tema `derivePalette` ile tek bir ana renkten türetilir, sonra elle
 * ayarlanan birkaç alanla tamamlanır. Böylece hepsi aynı kontrast kurallarını
 * geçer ve palet içinde tutarlı kalır — "rastgele sekiz renk" değil.
 */

const light = (name, id, primary, extra = {}) => ({
  id,
  name,
  mode: 'light',
  colors: { ...derivePalette(primary), ...extra }
});

const dark = (name, id, primary, extra = {}) => ({
  id,
  name,
  mode: 'dark',
  colors: { ...derivePalette(primary, { dark: true }), ...extra }
});

export const PRESETS = [
  light('Indigo', 'indigo', '#4F46E5'),
  light('Ocean', 'ocean', '#0284C7'),
  light('Emerald', 'emerald', '#059669'),
  light('Amber', 'amber', '#D97706'),
  light('Rose', 'rose', '#E11D48'),
  light('Graphite', 'graphite', '#374151'),
  dark('Midnight', 'midnight', '#6366F1'),
  dark('Carbon', 'carbon', '#22D3EE')
];

/** Kaydedilmiş renkler bir hazır temayla birebir eşleşiyor mu? */
export function matchPreset(colors) {
  if (!colors) return null;
  const keys = ['primary', 'header', 'background', 'text', 'textSecondary', 'border', 'visitorMessageBg', 'agentMessageBg'];
  const found = PRESETS.find((preset) =>
    keys.every((key) => String(preset.colors[key] || '').toUpperCase() === String(colors[key] || '').toUpperCase())
  );
  return found ? found.id : null;
}
