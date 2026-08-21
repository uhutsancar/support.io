/**
 * Özellik kataloğu.
 *
 * Features listesi ve FeatureDetail sayfası AYNI kaynaktan beslenir. Önceden
 * detay sayfası çeviri dosyasındaki bir diziyi başlıktan slug üreterek
 * arıyordu; başlık her değiştiğinde (veya dil değiştiğinde) bağlantılar
 * kırılıyor ve "Özellik bulunamadı" ekranı çıkıyordu. Artık slug sabit bir
 * kimliktir, başlıktan bağımsızdır.
 *
 * İçerik kuralı: buradaki her madde bu depoda GERÇEKTEN çalışan bir şeyi
 * anlatır. Eski sayfada "50+ dilde otomatik çeviri", "100+ CRM entegrasyonu"
 * ve "soruların %80'ini yapay zeka yanıtlıyor" yazıyordu; hiçbirinin karşılığı
 * yoktu.
 */

export const FEATURE_IDS = [
  'live-chat',
  'universal-widget',
  'routing',
  'automation',
  'proactive',
  'knowledge-base',
  'analytics',
  'team',
  'ai-assist',
  'visitors'
];

/** Detay sayfasında hangi planların kapsadığını göstermek için. */
export const PLAN_LABEL = {
  all: { tr: 'Tüm planlar', en: 'All plans' },
  pro: { tr: 'Pro ve Kurumsal', en: 'Pro and Enterprise' },
  enterprise: { tr: 'Kurumsal', en: 'Enterprise' }
};

/** id → hangi planda açık. rbac.js içindeki planFeatures ile aynı gerçek. */
export const FEATURE_PLAN = {
  'live-chat': 'all',
  'universal-widget': 'all',
  routing: 'all',
  automation: 'all',
  proactive: 'all',
  'knowledge-base': 'all',
  analytics: 'pro',
  team: 'pro',
  'ai-assist': 'pro',
  visitors: 'pro'
};

/** Lucide ikon adları — bileşende eşlenir. */
export const FEATURE_ICON = {
  'live-chat': 'MessageSquare',
  'universal-widget': 'Code2',
  routing: 'GitBranch',
  automation: 'Zap',
  proactive: 'Send',
  'knowledge-base': 'BookOpen',
  analytics: 'BarChart3',
  team: 'Users',
  'ai-assist': 'Sparkles',
  visitors: 'Eye'
};
