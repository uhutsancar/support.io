/**
 * Özellik kataloğu.
 *
 * Features listesi, FeatureDetail sayfası, ana sayfadaki sekmeler ve üst
 * menüdeki ürün açılırı AYNI kaynaktan beslenir. Önceden detay sayfası çeviri
 * dosyasındaki bir diziyi başlıktan slug üreterek arıyordu; başlık her
 * değiştiğinde (veya dil değiştiğinde) bağlantılar kırılıyor ve "Özellik
 * bulunamadı" ekranı çıkıyordu. Artık slug sabit bir kimliktir, başlıktan
 * bağımsızdır.
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
  'visitors',
  'crm'
];

/**
 * Özellikler üç işe göre gruplanır. Düz bir on bir maddelik ızgara, okuyana
 * neyin neyle ilgili olduğunu söylemiyordu; kategori hem sayfayı taranabilir
 * yapar hem de üst menüdeki açılırın iskeletidir.
 */
export const FEATURE_GROUPS = [
  {
    id: 'talk',
    tone: 'indigo',
    items: ['live-chat', 'universal-widget', 'knowledge-base', 'proactive']
  },
  { id: 'organize', tone: 'emerald', items: ['routing', 'automation', 'team'] },
  { id: 'grow', tone: 'sky', items: ['analytics', 'visitors', 'crm', 'ai-assist'] }
];

/** Detay sayfasında hangi planların kapsadığını göstermek için. */
export const PLAN_LABEL = {
  all: { tr: 'Tüm planlar', en: 'All plans' },
  pro: { tr: 'Pro ve Kurumsal', en: 'Pro and Enterprise' },
  enterprise: { tr: 'Kurumsal', en: 'Enterprise' }
};

/**
 * id → hangi planda açık. rbac.js içindeki planFeatures ile aynı gerçek.
 * Yapay zekâ plana bağlı değildir: model müşterinin kendi sunucusunda çalışır,
 * backend onu plana göre kısıtlamaz.
 */
export const FEATURE_PLAN = {
  'live-chat': 'all',
  'universal-widget': 'all',
  routing: 'all',
  automation: 'all',
  proactive: 'all',
  'knowledge-base': 'all',
  analytics: 'pro',
  team: 'pro',
  'ai-assist': 'all',
  visitors: 'pro',
  crm: 'pro'
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
  visitors: 'Eye',
  crm: 'Briefcase'
};

/**
 * Her özelliğin rengi. Ait olduğu grubun tonuyla başlar, grup içinde ayrışması
 * gereken birkaç tanesi kendi tonunu alır — böylece sayfa tek renge boğulmaz
 * ama renk rastgele de dağılmaz.
 */
export const FEATURE_TONE = {
  'live-chat': 'indigo',
  'universal-widget': 'violet',
  routing: 'emerald',
  automation: 'emerald',
  proactive: 'amber',
  'knowledge-base': 'amber',
  analytics: 'sky',
  team: 'violet',
  'ai-assist': 'violet',
  visitors: 'sky',
  crm: 'sky'
};

/**
 * Ana sayfadaki sekmeli tur. On bir özelliğin hepsini sekmeye koymak, kimsenin
 * sonuna kadar tıklamadığı bir şerit üretiyordu; burası günlük işi en iyi
 * anlatan altısıdır, gerisi Özellikler sayfasında.
 */
export const HOME_TABS = [
  'live-chat',
  'ai-assist',
  'routing',
  'automation',
  'proactive',
  'analytics',
  'visitors'
];

/**
 * Sektör çözümleri. Ana sayfadaki karusel, üst menüdeki "Çözümler" açılırı ve
 * `/cozumler/:slug` sayfaları buradan beslenir. Slug her iki dilde aynıdır;
 * dil değişince yol yalnızca önekini değiştirir (bkz. `lib/marketingPaths`).
 *
 * `features` o sektörde işi en çok taşıyan özelliklerdir; çözüm sayfası
 * bunları sırasıyla anlatır ve özellik detaylarına bağlar.
 */
export const SOLUTIONS = [
  {
    id: 'ecommerce',
    photo: '/photos/ecommerce.webp',
    tone: 'indigo',
    icon: 'Store',
    features: ['ai-assist', 'live-chat', 'proactive', 'knowledge-base']
  },
  {
    id: 'saas',
    photo: '/photos/saas.webp',
    tone: 'violet',
    icon: 'Rocket',
    features: ['routing', 'visitors', 'automation', 'analytics']
  },
  {
    id: 'agency',
    photo: '/photos/agency.webp',
    tone: 'amber',
    icon: 'Briefcase',
    features: ['universal-widget', 'team', 'analytics', 'routing']
  },
  {
    id: 'health',
    photo: '/photos/clinic.webp',
    tone: 'emerald',
    icon: 'Stethoscope',
    features: ['live-chat', 'knowledge-base', 'automation', 'team']
  },
  {
    id: 'hospitality',
    photo: '/photos/hotel.webp',
    tone: 'rose',
    icon: 'BedDouble',
    features: ['proactive', 'ai-assist', 'live-chat', 'crm']
  },
  {
    id: 'education',
    photo: '/photos/education.webp',
    tone: 'sky',
    icon: 'GraduationCap',
    features: ['knowledge-base', 'ai-assist', 'routing', 'analytics']
  }
] as const;

export type SolutionId = (typeof SOLUTIONS)[number]['id'];

export const SOLUTION_IDS: readonly string[] = SOLUTIONS.map((s) => s.id);

/** Sektöre göre anlatım. Her biri aynı ürünü farklı bir dille anlatır. */
export const USE_CASES = ['ecommerce', 'saas', 'agency', 'service'];
