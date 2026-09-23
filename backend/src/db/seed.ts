'use strict';

// Demo data for the support platform.
//
// Everything created here hangs off a single demo organization, so the seed can
// be re-run or removed without touching real tenants:
//
//   npm run db:seed           create (refuses if the demo org already exists)
//   npm run db:seed -- --reset   delete the demo org first, then create
//
// The data is deliberately *not* independent noise. Conversations belong to
// visitors that exist, are assigned to agents that exist, carry messages whose
// timestamps sit between the conversation opening and its resolution, and their
// SLA fields agree with those timestamps. That is what makes the dashboards,
// the SLA colouring and the performance figures show believable numbers rather
// than a wall of zeros.

// Loads .env before any module below reads it; see src/config/env.ts.
import '../config/env';
import { pool, query } from './pool';
import type { Doc } from './model';
import type { TeamDoc, TeamRole, TeamStatus } from '../models/Team';
import type { ConversationStatus } from '../models/Conversation';
import type { AutomationTrigger } from '../models/AutomationRule';
import type { DealStage } from '../models/Deal';
import type { AuditAction } from '../models/AuditLog';
import type { Priority } from '../domain';
import { applySchema } from './migrate';
import Organization from '../models/Organization';
import User from '../models/User';
import Team from '../models/Team';
import Site from '../models/Site';
import Department from '../models/Department';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import FAQ from '../models/FAQ';
import Visitor from '../models/Visitor';
import WidgetConfig from '../models/WidgetConfig';
import Deal from '../models/Deal';
import AutomationRule from '../models/AutomationRule';
import ProactiveRule from '../models/ProactiveRule';
import AuditLog from '../models/AuditLog';


const DEMO_ORG_NAME = 'Acme Yazılım (Demo)';
const DEMO_DOMAIN = 'demo.support.io';
const DEMO_PASSWORD = 'Demo1234!';

// A fixed seed keeps the generated mix stable between runs, so a screenshot or
// a test that counts rows does not shift underneath you.
let seedState = 20260819;
function rnd() {
  seedState = (seedState * 1103515245 + 12345) & 0x7fffffff;
  return seedState / 0x7fffffff;
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
const intBetween = (min: number, max: number): number => min + Math.floor(rnd() * (max - min + 1));
const hoursAgo = (h: number): Date => new Date(Date.now() - h * 3600 * 1000);
const plusMinutes = (date: Date, m: number): Date => new Date(date.getTime() + m * 60 * 1000);

async function findDemoOrg() {
  return Organization.findOne({ name: DEMO_ORG_NAME });
}

// Removes the demo tenant. Most tables cascade from organizations or sites, but
// conversations reference agents without a foreign key, so the few tables that
// are only reachable through the site are cleared explicitly first.
async function resetDemo() {
  const org = await findDemoOrg();
  if (!org) return false;

  const { rows: sites } = await query('SELECT id FROM sites WHERE organization_id = $1', [org._id]);
  const siteIds = sites.map((s) => s.id);

  if (siteIds.length) {
    await query('DELETE FROM automation_logs WHERE site_id = ANY($1)', [siteIds]);
    await query('DELETE FROM proactive_trigger_logs WHERE site_id = ANY($1)', [siteIds]);
    await query('DELETE FROM event_logs WHERE site_id = ANY($1)', [siteIds]);
  }
  await query('DELETE FROM audit_logs WHERE organization_id = $1', [org._id]);
  await query('DELETE FROM teams WHERE organization_id = $1', [org._id]);
  await query('DELETE FROM users WHERE organization_id = $1', [org._id]);
  // Cascades to sites -> departments, conversations, messages, faqs, visitors,
  // widget configs and both rule tables.
  await query('DELETE FROM organizations WHERE id = $1', [org._id]);
  return true;
}

async function seed() {
  const org = new Organization({ name: DEMO_ORG_NAME, planType: 'ENTERPRISE' });
  await org.save();

  // --- people ---------------------------------------------------------------
  const owner = new User({
    email: `owner@${DEMO_DOMAIN}`,
    password: DEMO_PASSWORD,
    name: 'Elif Demir',
    role: 'owner',
    organizationId: org._id,
    isOnboarded: true,
    status: 'online'
  });
  await owner.save();

  org.ownerUserId = owner._id;
  await org.save();

  const admin = new User({
    email: `admin@${DEMO_DOMAIN}`,
    password: DEMO_PASSWORD,
    name: 'Kerem Aslan',
    role: 'admin',
    organizationId: org._id,
    isOnboarded: true,
    status: 'online'
  });
  await admin.save();

  /** One demo agent, written straight into the teams table. */
  interface AgentSpec {
    name: string;
    email: string;
    role: TeamRole;
    skills: string[];
    status: TeamStatus;
    capacity: number;
  }

  const agentSpecs: AgentSpec[] = [
    {
      name: 'Zeynep Kaya',
      email: `zeynep@${DEMO_DOMAIN}`,
      role: 'manager',
      skills: ['satış', 'faturalama'],
      status: 'online',
      capacity: 12
    },
    {
      name: 'Mert Yıldız',
      email: `mert@${DEMO_DOMAIN}`,
      role: 'agent',
      skills: ['teknik', 'destek'],
      status: 'online',
      capacity: 10
    },
    {
      name: 'Ayşe Şahin',
      email: `ayse@${DEMO_DOMAIN}`,
      role: 'agent',
      skills: ['destek', 'faturalama'],
      status: 'busy',
      capacity: 8
    },
    {
      name: 'Burak Çelik',
      email: `burak@${DEMO_DOMAIN}`,
      role: 'agent',
      skills: ['teknik'],
      status: 'away',
      capacity: 10
    }
  ];

  const site = new Site({
    name: 'Acme Mağaza',
    domain: DEMO_DOMAIN,
    siteKey: 'demo-site-key-0000-1111-2222',
    userId: owner._id,
    organizationId: org._id,
    widgetSettings: {
      position: 'bottom-right',
      primaryColor: '#4F46E5',
      welcomeMessage: 'Merhaba! Size nasıl yardımcı olabiliriz?',
      placeholderText: 'Mesajınızı yazın...',
      showOnPages: [],
      autoOpen: false,
      autoOpenDelay: 5000
    }
  });
  await site.save();

  const agents: Doc<TeamDoc>[] = [];
  for (const spec of agentSpecs) {
    const agent = new Team({
      email: spec.email,
      password: DEMO_PASSWORD,
      name: spec.name,
      role: spec.role,
      organizationId: org._id,
      status: spec.status,
      skills: spec.skills,
      maxCapacity: spec.capacity,
      assignedSites: [site._id]
    });
    await agent.save();
    agents.push(agent);
  }

  await new WidgetConfig({ siteId: site._id, organizationId: org._id }).save();

  // --- departments ----------------------------------------------------------
  const departmentSpecs = [
    {
      name: 'Destek',
      icon: '🛠️',
      color: '#3B82F6',
      skills: ['destek', 'teknik'],
      desc: 'Ürün ve teknik sorunlar'
    },
    {
      name: 'Satış',
      icon: '💼',
      color: '#10B981',
      skills: ['satış'],
      desc: 'Fiyatlandırma ve yeni müşteriler'
    },
    {
      name: 'Faturalama',
      icon: '🧾',
      color: '#F59E0B',
      skills: ['faturalama'],
      desc: 'Ödeme ve fatura talepleri'
    }
  ];

  const departments = [];
  for (const spec of departmentSpecs) {
    const department = new Department({
      name: spec.name,
      description: spec.desc,
      siteId: site._id,
      color: spec.color,
      icon: spec.icon,
      requiredSkills: spec.skills,
      autoAssignRules: { enabled: true, strategy: 'least-busy' },
      businessHours: {
        enabled: true,
        timezone: 'Europe/Istanbul',
        schedule: {
          monday: { start: '09:00', end: '18:00', enabled: true },
          tuesday: { start: '09:00', end: '18:00', enabled: true },
          wednesday: { start: '09:00', end: '18:00', enabled: true },
          thursday: { start: '09:00', end: '18:00', enabled: true },
          friday: { start: '09:00', end: '18:00', enabled: true },
          saturday: { start: '10:00', end: '14:00', enabled: false },
          sunday: { start: '10:00', end: '14:00', enabled: false }
        }
      },
      members: agents
        .filter((a) => a.skills.some((s) => spec.skills.includes(s)))
        .map((a) => ({ userId: a._id, role: 'agent' }))
    });
    await department.save();
    departments.push(department);
  }

  // --- knowledge (FAQ auto-answers) ----------------------------------------
  const faqSpecs = [
    {
      q: 'Kargo ne kadar sürede gelir?',
      a: 'Siparişleriniz 1-3 iş günü içinde kargoya verilir ve genellikle 2-4 iş gününde teslim edilir.',
      cat: 'Kargo',
      kw: ['kargo', 'teslimat', 'gönderi', 'süre']
    },
    {
      q: 'İade koşulları nelerdir?',
      a: 'Ürünü teslim aldıktan sonra 14 gün içinde, kullanılmamış olmak şartıyla iade edebilirsiniz.',
      cat: 'İade',
      kw: ['iade', 'geri', 'ürün iadesi']
    },
    {
      q: 'Faturamı nereden indirebilirim?',
      a: 'Hesabım > Siparişlerim bölümünden ilgili siparişin yanındaki "Fatura" bağlantısına tıklayarak PDF olarak indirebilirsiniz.',
      cat: 'Faturalama',
      kw: ['fatura', 'pdf', 'belge']
    },
    {
      q: 'Şifremi unuttum, ne yapmalıyım?',
      a: 'Giriş ekranındaki "Şifremi unuttum" bağlantısını kullanarak e-posta adresinize sıfırlama bağlantısı gönderebilirsiniz.',
      cat: 'Hesap',
      kw: ['şifre', 'parola', 'giriş', 'unuttum']
    },
    {
      q: 'Hangi ödeme yöntemlerini kabul ediyorsunuz?',
      a: 'Kredi kartı, banka kartı, havale/EFT ve kapıda ödeme seçeneklerini kabul ediyoruz.',
      cat: 'Ödeme',
      kw: ['ödeme', 'kart', 'havale', 'eft']
    },
    {
      q: 'Siparişimi nasıl iptal ederim?',
      a: 'Kargoya verilmemiş siparişleri Hesabım > Siparişlerim üzerinden tek tıkla iptal edebilirsiniz.',
      cat: 'Sipariş',
      kw: ['iptal', 'sipariş']
    },
    {
      q: 'Kurumsal fatura kesiyor musunuz?',
      a: 'Evet. Sipariş sırasında "Kurumsal fatura" seçeneğini işaretleyip vergi bilgilerinizi girmeniz yeterli.',
      cat: 'Faturalama',
      kw: ['kurumsal', 'vergi', 'fatura']
    },
    {
      q: 'Ürün garantisi ne kadar?',
      a: 'Tüm ürünlerimiz üretici garantisi kapsamında 24 ay garantilidir.',
      cat: 'Garanti',
      kw: ['garanti', 'arıza', 'servis']
    }
  ];

  for (const [i, spec] of faqSpecs.entries()) {
    await new FAQ({
      siteId: site._id,
      question: spec.q,
      answer: spec.a,
      category: spec.cat,
      keywords: spec.kw,
      order: i,
      viewCount: intBetween(5, 120),
      helpfulCount: intBetween(0, 40)
    }).save();
  }

  // --- visitors -------------------------------------------------------------
  const customerSpecs = [
    {
      name: 'Ahmet Yılmaz',
      email: 'ahmet.yilmaz@ornek.com',
      country: 'TR',
      city: '/urunler/dizustu'
    },
    { name: 'Fatma Öztürk', email: 'fatma.ozturk@ornek.com', country: 'TR', city: '/sepet' },
    { name: 'Can Arslan', email: 'can.arslan@ornek.com', country: 'TR', city: '/fiyatlandirma' },
    { name: 'Selin Doğan', email: 'selin.dogan@ornek.com', country: 'TR', city: '/iade-kosullari' },
    { name: 'Emre Koç', email: 'emre.koc@ornek.com', country: 'DE', city: '/urunler/telefon' },
    { name: 'Deniz Aydın', email: 'deniz.aydin@ornek.com', country: 'TR', city: '/hesabim' },
    { name: 'Buse Polat', email: 'buse.polat@ornek.com', country: 'NL', city: '/kampanyalar' },
    { name: 'Onur Şimşek', email: 'onur.simsek@ornek.com', country: 'TR', city: '/destek' },
    {
      name: 'Gizem Erdoğan',
      email: 'gizem.erdogan@ornek.com',
      country: 'TR',
      city: '/urunler/tablet'
    },
    { name: 'Kaan Bulut', email: 'kaan.bulut@ornek.com', country: 'UK', city: '/fiyatlandirma' },
    { name: 'Merve Taş', email: 'merve.tas@ornek.com', country: 'TR', city: '/sepet' },
    { name: 'Serkan Güneş', email: 'serkan.gunes@ornek.com', country: 'TR', city: '/siparislerim' }
  ];

  const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
  const systems = ['Windows', 'macOS', 'iOS', 'Android'];

  const customers = [];
  for (const [i, spec] of customerSpecs.entries()) {
    const visitorId = `demo-visitor-${String(i + 1).padStart(2, '0')}`;
    const lastActive = hoursAgo(intBetween(0, 72));
    await new Visitor({
      siteId: site._id,
      organizationId: org._id,
      visitorId,
      ip: `88.230.${intBetween(1, 254)}.${intBetween(1, 254)}`,
      country: spec.country,
      browser: pick(browsers),
      os: pick(systems),
      currentPage: spec.city,
      referrer: pick(['https://google.com', 'https://instagram.com', 'direct', 'https://x.com']),
      // Only the few most recent visitors are still on the site.
      isActive: i < 3,
      lastActiveAt: lastActive
    }).save();
    customers.push({ ...spec, visitorId });
  }

  // --- conversations --------------------------------------------------------
  // Each entry is a small script: what the visitor wants, which department it
  // belongs to, and how the exchange went. Statuses, ratings and SLA fields are
  // derived from it rather than sprinkled at random.
  const scripts = [
    {
      dept: 'Kargo',
      department: 'Destek',
      tags: ['kargo'],
      priority: 'normal',
      subject: 'Kargom nerede?',
      visitor: 'Siparişim 3 gündür kargoda görünüyor, nerede acaba?',
      agent:
        'Merhaba! Takip numaranıza baktım, kargo bugün dağıtıma çıkmış. Akşama kadar elinizde olur.',
      outcome: 'resolved',
      rating: 5
    },
    {
      department: 'Faturalama',
      tags: ['fatura'],
      priority: 'normal',
      subject: 'Fatura indiremiyorum',
      visitor: 'Faturamı indirmeye çalışıyorum ama sayfa hata veriyor.',
      agent: 'Kontrol ettim, faturanız oluşturulmuş. Bağlantıyı e-posta ile de gönderdim.',
      outcome: 'resolved',
      rating: 4
    },
    {
      department: 'Satış',
      tags: ['fiyat', 'kurumsal'],
      priority: 'high',
      subject: 'Toplu alım fiyatı',
      visitor: '50 adet almak istiyorum, kurumsal indirim var mı?',
      agent: 'Tabii, 50 adet üzeri %15 indirim uyguluyoruz. Teklif hazırlayıp ileteyim mi?',
      outcome: 'assigned',
      rating: null
    },
    {
      department: 'Destek',
      tags: ['teknik', 'acil'],
      priority: 'urgent',
      subject: 'Ürün açılmıyor',
      visitor: 'Dün aldığım cihaz hiç açılmıyor, acil yardım lazım.',
      agent: 'Çok üzgünüm. Hemen değişim kaydı oluşturuyorum, kargo ücreti bize ait.',
      outcome: 'resolved',
      rating: 5
    },
    {
      department: 'Destek',
      tags: ['iade'],
      priority: 'normal',
      subject: 'İade etmek istiyorum',
      visitor: 'Ürünü iade etmek istiyorum, nasıl yapabilirim?',
      agent: 'İade talebinizi oluşturdum. Kargo kodunu e-postanıza gönderdim.',
      outcome: 'resolved',
      rating: 4
    },
    {
      department: 'Faturalama',
      tags: ['ödeme'],
      priority: 'high',
      subject: 'Çift çekim',
      visitor: 'Kartımdan iki kez çekim yapılmış!',
      agent: 'Kontrol ettim, bir işlem provizyonda kalmış. 3 iş günü içinde iade edilecek.',
      outcome: 'resolved',
      rating: 3
    },
    {
      department: 'Satış',
      tags: ['fiyat'],
      priority: 'normal',
      subject: 'Kampanya sorusu',
      visitor: 'Kampanya ne zamana kadar geçerli?',
      agent: 'Kampanyamız ay sonuna kadar sürüyor.',
      outcome: 'closed',
      rating: 5
    },
    {
      department: 'Destek',
      tags: ['teknik'],
      priority: 'normal',
      subject: 'Kurulum yardımı',
      visitor: 'Kurulumu nasıl yapacağımı bilmiyorum.',
      agent: 'Adım adım anlatan videoyu paylaşıyorum, birlikte ilerleyelim.',
      outcome: 'resolved',
      rating: 5
    },
    {
      department: 'Destek',
      tags: ['garanti'],
      priority: 'high',
      subject: 'Garanti kapsamı',
      visitor: 'Ekranda çizik var, garanti kapsamında mı?',
      agent: 'Fiziksel hasar garanti dışı ancak servis indirimi sunabiliyoruz.',
      outcome: 'pending',
      rating: null
    },
    {
      department: 'Faturalama',
      tags: ['kurumsal', 'fatura'],
      priority: 'normal',
      subject: 'Kurumsal fatura',
      visitor: 'Vergi numaramı sonradan ekleyebilir miyim?',
      agent: 'Maalesef fatura kesildikten sonra değişmiyor, iptal edip yeniden oluşturalım.',
      outcome: 'resolved',
      rating: 4
    },
    {
      department: 'Satış',
      tags: ['fiyat'],
      priority: 'low',
      subject: 'Stok durumu',
      visitor: 'Bu ürün ne zaman stoğa girer?',
      agent: 'Önümüzdeki hafta stoklarımıza giriyor, haber vereyim mi?',
      outcome: 'assigned',
      rating: null
    },
    {
      department: 'Destek',
      tags: ['teknik', 'acil'],
      priority: 'urgent',
      subject: 'Sipariş kayboldu',
      visitor: 'Siparişim iptal göründü ama param çekildi!',
      agent: 'Hemen inceliyorum, ödeme iadesi başlatıldı.',
      outcome: 'resolved',
      rating: 2
    },
    {
      department: 'Destek',
      tags: ['kargo'],
      priority: 'normal',
      subject: 'Adres değişikliği',
      visitor: 'Teslimat adresimi değiştirebilir miyim?',
      agent: 'Kargoya verilmeden önce değiştirdim, yeni adrese gidecek.',
      outcome: 'resolved',
      rating: 5
    },
    {
      department: 'Satış',
      tags: ['kurumsal'],
      priority: 'high',
      subject: 'Bayilik başvurusu',
      visitor: 'Bayiniz olmak istiyorum, süreç nasıl işliyor?',
      agent: 'Bayilik formunu ilettim, ekibimiz 2 gün içinde dönecek.',
      outcome: 'assigned',
      rating: null
    },
    {
      department: 'Faturalama',
      tags: ['ödeme'],
      priority: 'normal',
      subject: 'Havale bildirimi',
      visitor: 'Havale yaptım ama siparişim onaylanmadı.',
      agent: 'Ödemeniz görüldü, siparişiniz onaylandı.',
      outcome: 'resolved',
      rating: 5
    },
    {
      department: 'Destek',
      tags: ['teknik'],
      priority: 'low',
      subject: 'Uygulama hatası',
      visitor: 'Mobil uygulama sürekli kapanıyor.',
      agent: 'Son sürüme güncellemenizi rica ederim, sorun giderildi.',
      outcome: 'closed',
      rating: 4
    },
    {
      department: 'Destek',
      tags: ['iade'],
      priority: 'normal',
      subject: 'İade ne zaman yatar?',
      visitor: 'İade ettim, param ne zaman yatar?',
      agent: 'Bankaya bağlı olarak 3-7 iş günü sürüyor.',
      outcome: 'resolved',
      rating: 4
    },
    {
      department: 'Satış',
      tags: ['fiyat'],
      priority: 'normal',
      subject: 'Fiyat farkı',
      visitor: 'Dün daha ucuzdu, fark iadesi yapar mısınız?',
      agent: 'Fiyat farkını hediye çeki olarak tanımladım.',
      outcome: 'resolved',
      rating: 5
    },
    // Still waiting for a first reply, so these show live SLA pressure.
    {
      department: 'Destek',
      tags: ['teknik'],
      priority: 'urgent',
      subject: 'Sistem çöktü',
      visitor: 'Panelinize hiç giriş yapamıyorum, işlerim durdu!',
      agent: null,
      outcome: 'open',
      rating: null
    },
    {
      department: 'Faturalama',
      tags: ['fatura'],
      priority: 'high',
      subject: 'Yanlış tutar',
      visitor: 'Faturada tutar yanlış görünüyor.',
      agent: null,
      outcome: 'open',
      rating: null
    },
    {
      department: 'Satış',
      tags: [],
      priority: 'normal',
      subject: 'Ürün karşılaştırma',
      visitor: 'İki model arasında hangisini önerirsiniz?',
      agent: null,
      outcome: 'open',
      rating: null
    },
    {
      department: 'Destek',
      tags: ['kargo'],
      priority: 'normal',
      subject: 'Eksik ürün',
      visitor: 'Paketten bir ürün eksik çıktı.',
      agent: null,
      outcome: 'open',
      rating: null
    },
    {
      department: 'Destek',
      tags: ['destek'],
      priority: 'low',
      subject: 'Genel bilgi',
      visitor: 'Mağazanız hafta sonu açık mı?',
      agent: 'Cumartesi 10-14 arası hizmet veriyoruz.',
      outcome: 'closed',
      rating: 5
    },
    {
      department: 'Faturalama',
      tags: ['ödeme'],
      priority: 'normal',
      subject: 'Taksit seçenekleri',
      visitor: 'Kaç taksit yapabiliyorsunuz?',
      agent: 'Anlaşmalı kartlara 9 taksit imkânı sunuyoruz.',
      outcome: 'resolved',
      rating: 4
    }
  ];

  const departmentByName = new Map(departments.map((d) => [d.name, d]));
  const agentsBySkill = (skill: string) => agents.filter((a) => a.skills.includes(skill));

  const created = [];
  for (const [i, script] of scripts.entries()) {
    const customer = customers[i % customers.length];
    const department = departmentByName.get(script.department);

    // Spread the set across the last 30 days, newest first.
    const ageHours = Math.round((i / scripts.length) * 24 * 28) + intBetween(1, 6);
    const openedAt = hoursAgo(ageHours);

    const answered = script.agent !== null;
    const candidates = agentsBySkill(department!.requiredSkills[0]);
    const agent =
      answered || script.outcome === 'assigned' || script.outcome === 'pending'
        ? candidates.length
          ? candidates[i % candidates.length]
          : agents[i % agents.length]
        : null;

    const firstResponseMinutes = answered ? intBetween(2, 26) : null;
    const firstResponseAt = answered ? plusMinutes(openedAt, firstResponseMinutes!) : null;

    const terminal = ['resolved', 'closed'].includes(script.outcome);
    const resolutionMinutes = terminal ? firstResponseMinutes! + intBetween(10, 180) : null;
    const resolvedAt = terminal ? plusMinutes(openedAt, resolutionMinutes!) : null;

    const targets = {
      urgent: { first: 5, resolution: 60 },
      high: { first: 10, resolution: 120 },
      normal: { first: 15, resolution: 240 },
      low: { first: 30, resolution: 480 }
    }[script.priority as Priority];

    // SLA status is computed from the timings above so the badges in the UI
    // agree with the timestamps a reader can check.
    const firstResponseStatus = answered
      ? firstResponseMinutes! <= targets.first
        ? 'met'
        : 'breached'
      : ageHours * 60 > targets.first
        ? 'breached'
        : 'pending';
    const resolutionStatus = terminal
      ? resolutionMinutes! <= targets.resolution
        ? 'met'
        : 'breached'
      : ageHours * 60 > targets.resolution
        ? 'breached'
        : 'pending';

    const conversation = new Conversation({
      siteId: site._id,
      organizationId: org._id,
      visitorId: customer.visitorId,
      visitorName: customer.name,
      visitorEmail: customer.email,
      department: department!._id,
      assignedAgent: agent ? agent._id : null,
      assignedAt: agent ? plusMinutes(openedAt, 1) : null,
      assignedBy: agent ? admin._id : null,
      status: script.outcome as ConversationStatus,
      priority: script.priority as Priority,
      requiredSkills: department!.requiredSkills,
      channel: 'web-chat',
      currentPage: customer.city,
      metadata: { country: customer.country, subject: script.subject },
      tags: script.tags,
      unreadCount: answered ? 0 : 1,
      sla: {
        firstResponseTarget: targets.first,
        resolutionTarget: targets.resolution,
        firstResponseStatus,
        resolutionStatus,
        firstResponseTimeRemaining: null,
        resolutionTimeRemaining: null,
        firstResponseBreachedAt:
          firstResponseStatus === 'breached' ? plusMinutes(openedAt, targets.first) : null,
        resolutionBreachedAt:
          resolutionStatus === 'breached' ? plusMinutes(openedAt, targets.resolution) : null
      },
      rating: script.rating
        ? {
            score: script.rating,
            feedback:
              script.rating >= 4
                ? 'Hızlı ve ilgili destek, teşekkürler.'
                : 'Sorun çözüldü ama biraz uzun sürdü.',
            ratedAt: resolvedAt
          }
        : { score: null, feedback: null, ratedAt: null },
      lastMessageAt: resolvedAt || firstResponseAt || openedAt,
      firstResponseAt,
      resolvedAt,
      closedAt: script.outcome === 'closed' ? resolvedAt : null,
      createdAt: openedAt
    });
    await conversation.save();

    await new Message({
      conversationId: conversation._id,
      senderType: 'visitor',
      senderId: customer.visitorId,
      senderName: customer.name,
      content: script.visitor,
      isRead: answered,
      readAt: firstResponseAt,
      createdAt: openedAt
    }).save();

    if (answered) {
      await new Message({
        conversationId: conversation._id,
        senderType: 'agent',
        senderId: agent!._id,
        senderName: agent!.name,
        content: script.agent,
        isRead: true,
        readAt: firstResponseAt,
        createdAt: firstResponseAt
      }).save();

      // A short closing exchange on the ones that ended well.
      if (terminal && script.rating && script.rating >= 4) {
        await new Message({
          conversationId: conversation._id,
          senderType: 'visitor',
          senderId: customer.visitorId,
          senderName: customer.name,
          content: 'Teşekkür ederim, çok yardımcı oldunuz.',
          isRead: true,
          readAt: resolvedAt,
          createdAt: plusMinutes(resolvedAt!, -2)
        }).save();
      }
    }

    // Internal notes on the trickier tickets.
    if (script.priority === 'urgent' || script.rating === 2) {
      conversation.internalNotes.push({
        userId: admin._id,
        note: 'Müşteri memnuniyetsizliği riski var, yakından takip edelim.',
        createdAt: plusMinutes(openedAt, 5)
      });
      await conversation.save();
    }

    created.push(conversation);
  }

  // Agent workload counters should agree with the conversations just created.
  for (const agent of agents) {
    const active = created.filter(
      (c) => c.assignedAgent === agent._id && ['open', 'assigned', 'pending'].includes(c.status)
    ).length;
    const resolved = created.filter(
      (c) => c.assignedAgent === agent._id && ['resolved', 'closed'].includes(c.status)
    ).length;
    agent.currentLoad = active;
    agent.stats = {
      ...agent.stats,
      totalConversations: active + resolved,
      activeConversations: active,
      resolvedConversations: resolved
    };
    await agent.save();
  }

  // Department counters likewise.
  for (const department of departments) {
    const mine = created.filter((c) => c.department === department._id);
    department.stats = {
      ...department.stats,
      totalConversations: mine.length,
      activeConversations: mine.filter((c) => ['open', 'assigned', 'pending'].includes(c.status))
        .length,
      resolvedConversations: mine.filter((c) => ['resolved', 'closed'].includes(c.status)).length
    };
    await department.save();
  }

  // --- rules ----------------------------------------------------------------
  const ruleSpecs = [
    {
      name: 'Acil talepleri işaretle',
      triggerType: 'message_received',
      priority: 30,
      conditions: [{ field: 'message.content', operator: 'contains', value: 'acil' }],
      actions: [
        { type: 'add_tag', payload: { tag: 'acil' } },
        {
          type: 'send_message',
          payload: { text: 'Talebinizi acil olarak işaretledik, ekibimiz en kısa sürede dönecek.' }
        }
      ]
    },
    {
      name: 'İade taleplerini etiketle',
      triggerType: 'message_received',
      priority: 20,
      conditions: [{ field: 'message.content', operator: 'contains', value: 'iade' }],
      actions: [{ type: 'add_tag', payload: { tag: 'iade' } }]
    },
    {
      name: 'Yeni sohbetlere karşılama notu',
      triggerType: 'conversation_created',
      priority: 10,
      conditions: [],
      actions: [
        {
          type: 'internal_note',
          payload: { note: 'Yeni sohbet açıldı, ilk yanıt SLA süresi işliyor.' }
        }
      ]
    }
  ];

  for (const spec of ruleSpecs) {
    await new AutomationRule({
      siteId: site._id,
      name: spec.name,
      triggerType: spec.triggerType as AutomationTrigger,
      priority: spec.priority,
      conditionOperator: 'AND',
      conditions: spec.conditions,
      actions: spec.actions,
      isActive: true,
      metrics: {
        executionsCount: intBetween(3, 40),
        successCount: intBetween(3, 40),
        failureCount: 0
      }
    }).save();
  }

  await new ProactiveRule({
    siteId: site._id,
    name: 'Fiyat sayfasında 30 saniye',
    triggerCondition: {
      eventType: 'time_on_page',
      urlMatch: 'contains',
      urlValue: '/fiyatlandirma',
      timeThresholdSeconds: 30,
      scrollPercentage: 0
    },
    audienceContext: { deviceType: 'all' },
    action: {
      type: 'send_message',
      messageContent: 'Fiyatlarla ilgili bir sorunuz mu var? Yardımcı olmaktan memnuniyet duyarız.'
    },
    frequencyControl: { triggerOncePerVisitor: true, cooldownMinutes: 1440 },
    isActive: true
  }).save();

  await new ProactiveRule({
    siteId: site._id,
    name: 'Sepette çıkış niyeti',
    triggerCondition: {
      eventType: 'exit_intent',
      urlMatch: 'contains',
      urlValue: '/sepet',
      timeThresholdSeconds: 0,
      scrollPercentage: 0
    },
    audienceContext: { deviceType: 'desktop' },
    action: { type: 'open_popup' },
    frequencyControl: { triggerOncePerVisitor: true, cooldownMinutes: 720 },
    isActive: true
  }).save();

  // --- CRM pipeline ---------------------------------------------------------
  const dealSpecs = [
    {
      title: 'Acme Holding - 50 lisans',
      value: 145000,
      stage: 'negotiation',
      contact: 'Can Arslan'
    },
    { title: 'Beta Ltd - yıllık paket', value: 68000, stage: 'quoted', contact: 'Kaan Bulut' },
    { title: 'Gamma A.Ş. - bayilik', value: 220000, stage: 'potential', contact: 'Merve Taş' },
    { title: 'Delta - pilot proje', value: 32000, stage: 'new', contact: 'Buse Polat' },
    { title: 'Epsilon - yenileme', value: 91000, stage: 'won', contact: 'Emre Koç' },
    { title: 'Zeta - değerlendirme', value: 47000, stage: 'lost', contact: 'Onur Şimşek' }
  ];

  for (const [i, spec] of dealSpecs.entries()) {
    const contact = customers.find((c) => c.name === spec.contact) || customers[i];
    await new Deal({
      title: spec.title,
      value: spec.value,
      currency: 'TRY',
      contactName: contact.name,
      contactEmail: contact.email,
      stage: spec.stage as DealStage,
      organizationId: org._id,
      assignedTo: agents[i % agents.length]._id,
      createdBy: admin._id,
      order: i,
      notes: 'Demo veri kapsamında oluşturuldu.'
    }).save();
  }

  // --- audit trail ----------------------------------------------------------
  // Written directly because these describe events that happened before the
  // seed ran; the live listeners only fire for real requests.
  const auditSpecs = [
    {
      action: 'LOGIN_SUCCESS',
      entityType: 'user',
      entityId: owner._id,
      userId: owner._id,
      meta: { email: owner.email }
    },
    {
      action: 'LOGIN_SUCCESS',
      entityType: 'user',
      entityId: admin._id,
      userId: admin._id,
      meta: { email: admin.email }
    },
    {
      action: 'CREATE_AGENT',
      entityType: 'agent',
      entityId: agents[0]._id,
      userId: owner._id,
      meta: { name: agents[0].name }
    },
    {
      action: 'CREATE_AGENT',
      entityType: 'agent',
      entityId: agents[1]._id,
      userId: owner._id,
      meta: { name: agents[1].name }
    },
    {
      action: 'UPDATE_AGENT_ROLE',
      entityType: 'agent',
      entityId: agents[0]._id,
      userId: owner._id,
      meta: { from: 'agent', to: 'manager' }
    },
    {
      action: 'UPDATE_SLA',
      entityType: 'department',
      entityId: departments[0]._id,
      userId: admin._id,
      meta: { department: departments[0].name }
    },
    {
      action: 'TICKET_CLOSED',
      entityType: 'ticket',
      entityId: created[6]._id,
      userId: agents[0]._id,
      meta: { ticketId: created[6].ticketId }
    },
    {
      action: 'SLA_BREACH',
      entityType: 'ticket',
      entityId: created[18]._id,
      userId: null,
      meta: { ticketId: created[18].ticketId }
    },
    {
      action: 'AUTOMATION_EXECUTED',
      entityType: 'ticket',
      entityId: created[3]._id,
      userId: null,
      meta: { ruleName: 'Acil talepleri işaretle', status: 'success' }
    },
    {
      action: 'PLAN_CHANGED',
      entityType: 'organization',
      entityId: org._id,
      userId: owner._id,
      meta: { from: 'PRO', to: 'ENTERPRISE' }
    }
  ];

  for (const [i, spec] of auditSpecs.entries()) {
    await new AuditLog({
      organizationId: org._id,
      userId: spec.userId,
      action: spec.action as AuditAction,
      entityType: spec.entityType,
      entityId: spec.entityId,
      metadata: spec.meta,
      ipAddress: '88.230.14.201',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      createdAt: hoursAgo(intBetween(1, 240) + i)
    }).save();
  }

  return {
    organization: org,
    site,
    owner,
    admin,
    agents,
    departments,
    conversations: created,
    customers
  };
}

async function main() {
  const reset = process.argv.includes('--reset');

  await query('SELECT 1');
  await applySchema();

  if (reset) {
    const removed = await resetDemo();
    if (removed) console.log('Mevcut demo organizasyonu silindi.');
  } else if (await findDemoOrg()) {
    console.error(
      `Demo organizasyonu ("${DEMO_ORG_NAME}") zaten var.\n` +
        'Yeniden oluşturmak için:  npm run db:seed -- --reset'
    );
    process.exit(1);
  }

  const result = await seed();

  const counts = await query(
    `SELECT
       (SELECT count(*) FROM conversations WHERE organization_id = $1)::int AS conversations,
       (SELECT count(*) FROM messages m JOIN conversations c ON c.id = m.conversation_id
         WHERE c.organization_id = $1)::int AS messages,
       (SELECT count(*) FROM visitors WHERE organization_id = $1)::int AS visitors,
       (SELECT count(*) FROM teams WHERE organization_id = $1)::int AS agents,
       (SELECT count(*) FROM deals WHERE organization_id = $1)::int AS deals,
       (SELECT count(*) FROM audit_logs WHERE organization_id = $1)::int AS audit_logs`,
    [result.organization._id]
  );
  const c = counts.rows[0];

  console.log(`
Demo verisi hazır.

  Organizasyon : ${DEMO_ORG_NAME} (ENTERPRISE)
  Site anahtarı: ${result.site.siteKey}

  Giriş:
    Sahip   ${result.owner.email} / ${DEMO_PASSWORD}
    Yönetici ${result.admin.email} / ${DEMO_PASSWORD}
    Temsilci ${result.agents[1].email} / ${DEMO_PASSWORD}

  Oluşturulan kayıtlar:
    ${c.conversations} konuşma, ${c.messages} mesaj
    ${c.visitors} ziyaretçi, ${c.agents} temsilci
    ${result.departments.length} departman, 8 SSS
    3 otomasyon kuralı, 2 proaktif kural
    ${c.deals} CRM fırsatı, ${c.audit_logs} denetim kaydı
`);
}

export { seed, resetDemo, findDemoOrg, DEMO_ORG_NAME, DEMO_PASSWORD };
if (require.main === module) {
  main()
    .then(() => pool.end())
    .catch((error) => {
      console.error('Seed başarısız:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}
