'use strict';

// Gelen kutusu sorgusu.
//
// Panel, arama ve filtreleri tarayicida `conversations.filter(...)` ile
// yapiyordu. Liste ucu ise en yeni 50 kaydi donduruyordu, yani arama kutusu
// yalnizca o 50 kaydin icinde ariyordu: bir musterinin adini arayan temsilci,
// konusma 51. sirada oldugu icin "sonuc yok" goruyor ve kaydin var oldugunu
// anlamasinin hicbir yolu olmuyordu. Ayni sey durum ve departman filtreleri
// icin de gecerliydi.
//
// Burada filtreleme, arama ve sayfalama veritabaninda yapilir; panel ne
// istedigini soyler ve ne varsa onu alir.
//
// Sayfalama offset yerine keyset ile yapilir: OFFSET 10000 demek, PostgreSQL'in
// atacagi 10000 satiri once uretmesi demektir ve gelen kutusu derinlestikce
// dogrusal yavaslar. (last_message_at, id) ciftinden devam etmek her sayfada
// ayni maliyeti verir.

import { query } from './pool';
import { cached } from './cache';
import { createHash } from 'crypto';

const STATUSES = new Set(['open', 'assigned', 'pending', 'resolved', 'closed', 'unassigned']);
const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 30;

// Ertelenmis (snooze) bir konusma, zamani gelene kadar gelen kutusunda
// gorunmez; "Ertelenenler" gorunumu yalnizca onlari gosterir (PRD-07).
// Zamani gecmis bir erteleme, tarayici sifirlamadan once de uyanik sayilir.
const AWAKE = '(c.snoozed_until IS NULL OR c.snoozed_until <= now())';
const SNOOZED = 'c.snoozed_until > now()';
const MAX_TAG_LENGTH = 32;

// Arama metni SQL'e hicbir zaman metin olarak girmez; yalnizca parametre
// olarak gecer. Yine de ILIKE kaliplarindaki joker karakterler kacisilir,
// aksi halde "%" yazan bir kullanici butun tabloyu tarar.
//
// Bu kacis daha once hicbir sey yapmiyordu: degistirme deseni `'\$1'` yaziyordu
// ve normal bir dizgede `\$` yalnizca `$` demek, yani `%` karakteri yine `%`
// ile degistiriliyordu. Tek karakterlik bir arama ("%") butun tabloyu tariyor,
// "_" ise her karakterle eslesiyordu. Ters egik cizgi PostgreSQL'in LIKE/ILIKE
// icin varsayilan kacis karakteridir; ters egik cizginin kendisi de kacisilmak
// zorunda, aksi halde sondaki kacis bir sonraki karakteri yutar.
function likePattern(term: string): string {
  return `%${term.replace(/([%_\\])/g, '\\$1')}%`;
}

/** Everything the inbox list and its counters can be narrowed by. */
export interface InboxScope {
  organizationId: string;
  siteId: string;
  /** One of STATUSES; anything else is ignored. */
  status?: string | null;
  /** 'none' selects the conversations with no department. */
  departmentId?: string | null;
  assignedAgentId?: string | null;
  unassigned?: boolean;
  /** One of PRIORITIES; anything else is ignored. */
  priority?: string | null;
  search?: string | null;
  /** Conversation ids whose messages matched the search text. */
  searchMessageMatches?: string[] | null;
  /** Only conversations carrying this tag. */
  tag?: string | null;
  /**
   * Snoozed conversations: hidden by default, 'only' for the snoozed view,
   * 'all' for the counters, which count both.
   */
  snoozed?: 'hide' | 'only' | 'all' | null;
}

/** A page request: a scope plus where to continue from. */
export interface InboxListOptions extends InboxScope {
  limit?: number | string;
  cursor?: string | null;
}

// Filtreleri paylasilan bir WHERE parcasina cevirir.
function buildScope({
  organizationId,
  siteId,
  status,
  departmentId,
  assignedAgentId,
  unassigned,
  priority,
  search,
  searchMessageMatches,
  tag,
  snoozed
}: InboxScope): { where: string; params: unknown[] } {
  const params: unknown[] = [organizationId, siteId];
  const clauses = ['c.organization_id = $1', 'c.site_id = $2'];

  if (snoozed === 'only') clauses.push(SNOOZED);
  else if (snoozed !== 'all') clauses.push(AWAKE);

  if (tag && tag.length <= MAX_TAG_LENGTH) {
    params.push([tag]);
    clauses.push(`c.tags @> $${params.length}::text[]`);
  }

  if (status && STATUSES.has(status)) {
    params.push(status);
    clauses.push(`c.status = $${params.length}`);
  }
  if (priority && PRIORITIES.has(priority)) {
    params.push(priority);
    clauses.push(`c.priority = $${params.length}`);
  }
  if (departmentId === 'none') {
    clauses.push('c.department_id IS NULL');
  } else if (departmentId) {
    params.push(departmentId);
    clauses.push(`c.department_id = $${params.length}`);
  }
  if (unassigned) {
    clauses.push('c.assigned_agent_id IS NULL');
  } else if (assignedAgentId) {
    params.push(assignedAgentId);
    clauses.push(`c.assigned_agent_id = $${params.length}`);
  }

  if (search) {
    params.push(likePattern(search));
    const like = `$${params.length}`;
    // Bilet numarasi "#0042" ya da "42" diye aranabilir; ikisi de ayni kayda
    // gitmeli.
    const digits = search.replace(/\D/g, '');
    let ticketClause = '';
    if (digits) {
      params.push(Number(digits));
      ticketClause = ` OR c.ticket_number = $${params.length}`;
    }
    // Mesaj icerigi eslesmeleri ONCEDEN, sinirli bir sorguyla cozulur ve
    // buraya kimlik listesi olarak girer. Ilk hali bagintili bir EXISTS idi:
    // PostgreSQL onu her satir icin ayri ayri calistirmak zorunda kaldigindan
    // trigram indeksleri devre disi kaliyor ve sorgu 250 bin konusmada 1,3
    // saniye suruyordu. Kimlik listesiyle ayni sorgu BitmapOr'a duser.
    const messageMatches = Array.isArray(searchMessageMatches) ? searchMessageMatches : [];
    let contentClause = '';
    if (messageMatches.length) {
      params.push(messageMatches);
      contentClause = ` OR c.id = ANY($${params.length})`;
    }
    clauses.push(`(
      c.visitor_name ILIKE ${like}
      OR c.visitor_email ILIKE ${like}
      OR c.ticket_id ILIKE ${like}${contentClause}${ticketClause}
    )`);
  }

  return { where: clauses.join(' AND '), params };
}

// Arama metniyle eslesen mesajlarin konusma kimlikleri.
//
// Ustten sinirlidir: cok yaygin bir kelime ("siparis" gibi) mesajlarin buyuk
// bolumuyle eslesebilir ve hepsini toplayip tarihe gore siralamak yuz binlerce
// satiri gereksizce uretir. LIMIT sayesinde tarama erken durur ve en kotu
// durum ongorulebilir kalir. Bunun bedeli, cok yaygin aramalarda mesaj
// icerigine gore eslesen konusmalarin tamaminin degil bir bolumunun
// getirilmesidir; isim, e-posta ve bilet numarasi eslesmeleri her zaman
// eksiksizdir.
const MESSAGE_MATCH_LIMIT = Number(process.env.INBOX_MESSAGE_MATCH_LIMIT) || 1000;

//
// Iki yoldan eslesir: kelime olarak, Turkce kok bulmayla ("siparisim" yazan,
// "siparisimi" diyen mesaji bulur; 0017'deki GIN indeksi) ve metin parcasi
// olarak (siparis numarasi, e-posta parcasi; trigram indeksi). Aranan metin
// websearch_to_tsquery'ye verilir: kullanicinin yazdigi tirnak, eksi ya da
// "or" sozdizimi hata uretmez.
async function messageMatchesForSearch(
  siteId: string,
  search: string | null | undefined
): Promise<string[]> {
  if (!search) return [];
  const { rows } = await query(
    `SELECT DISTINCT m.conversation_id AS id
       FROM messages m
       JOIN conversations c ON c.id = m.conversation_id AND c.site_id = $1
      WHERE m.content ILIKE $2
         OR to_tsvector('turkish'::regconfig, coalesce(m.content, ''))
            @@ websearch_to_tsquery('turkish'::regconfig, $4)
      LIMIT $3`,
    [siteId, likePattern(search), MESSAGE_MATCH_LIMIT, search]
  );
  return rows.map((row) => row.id);
}

// Bir sayfa konusma dondurur.
//
// `cursor`, onceki sayfanin son satirindan uretilir. Cursor gecersizse
// yok sayilir ve ilk sayfa donulur; panelin kirilmasindansa basa donmesi
// yeglenir.
async function listConversations(options: InboxListOptions) {
  const { where, params } = buildScope(options);
  const limit = Math.min(Math.max(Number(options.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

  const scoped = [...params];
  let keyset = '';
  if (options.cursor) {
    const parsed = decodeCursor(options.cursor);
    if (parsed) {
      scoped.push(parsed.lastMessageAt, parsed.id);
      // last_message_at esit oldugunda id ile kararli siralama: aksi halde
      // ayni milisaniyeye dusen kayitlar sayfalar arasinda tekrar eder ya da
      // tamamen atlanir.
      keyset = ` AND (c.last_message_at, c.id) < ($${scoped.length - 1}::timestamptz, $${scoped.length})`;
    }
  }

  scoped.push(limit + 1);

  const { rows } = await query(
    `SELECT c.*
       FROM conversations c
      WHERE ${where}${keyset}
      ORDER BY c.last_message_at DESC, c.id DESC
      LIMIT $${scoped.length}`,
    scoped
  );

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page[page.length - 1];

  return {
    rows: page,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor(last.last_message_at, last.id) : null
  };
}

// Filtre seritlerindeki sayilar. Panel bunlari her durum icin ayri istek
// atmadan gosterebilsin diye tek sorguda uretilir.
// Olculen maliyet: 250 bin konusmalik bir sitede indeks-yalniz taramayla 53 ms
// ve gelen kutusunun HER acilisinda calisiyor. 30 es zamanli temsilcide bu tek
// sorgu gelen kutusu gecikmesini ikiye katliyordu (821 ms -> 1548 ms), cunku
// hepsi ayni siteyi ayni anda sayiyor. Serit sayilarinin birkac saniye eski
// olmasi zararsiz oldugundan sonuc kisa sureligine paylasilir.
const COUNTS_TTL_SECONDS = Number(process.env.INBOX_COUNTS_TTL_SECONDS) || 10;

async function conversationCounts(options: InboxScope) {
  const key = countsCacheKey(options);
  return cached(key, COUNTS_TTL_SECONDS, () => computeConversationCounts(options));
}

function countsCacheKey(options: InboxScope): string {
  const shape = JSON.stringify([
    options.organizationId,
    options.siteId,
    options.priority ?? null,
    options.departmentId ?? null,
    options.assignedAgentId ?? null,
    Boolean(options.unassigned),
    options.search ?? '',
    options.searchMessageMatches?.length ?? 0,
    options.tag ?? ''
  ]);
  return `inbox:counts:${createHash('sha1').update(shape).digest('base64url')}`;
}

async function computeConversationCounts(options: InboxScope) {
  // Sayimlar durum seritleri icin uretildiginden durumun kendisi disarida
  // birakilir; aksi halde her serit yalnizca kendi sayisini gosterirdi.
  // Ertelenenler ayri sayilir: durum seritleri onlari gostermez.
  const { where, params } = buildScope({ ...options, status: null, snoozed: 'all' });
  const { rows } = await query(
    `SELECT
       count(*) FILTER (WHERE ${AWAKE})::int AS total,
       count(*) FILTER (WHERE ${AWAKE} AND c.status = 'open')::int AS open,
       count(*) FILTER (WHERE ${AWAKE} AND c.status = 'assigned')::int AS assigned,
       count(*) FILTER (WHERE ${AWAKE} AND c.status = 'pending')::int AS pending,
       count(*) FILTER (WHERE ${AWAKE} AND c.status = 'resolved')::int AS resolved,
       count(*) FILTER (WHERE ${AWAKE} AND c.status = 'closed')::int AS closed,
       count(*) FILTER (WHERE ${AWAKE} AND c.assigned_agent_id IS NULL
                          AND c.status IN ('open', 'unassigned'))::int AS unassigned,
       count(*) FILTER (WHERE ${SNOOZED})::int AS snoozed
     FROM conversations c
    WHERE ${where}`,
    params
  );
  return rows[0];
}

function encodeCursor(lastMessageAt: Date | string, id: string): string {
  const stamp = lastMessageAt instanceof Date ? lastMessageAt.toISOString() : String(lastMessageAt);
  return Buffer.from(`${stamp}|${id}`, 'utf8').toString('base64url');
}

function decodeCursor(cursor: string): { lastMessageAt: string; id: string } | null {
  try {
    const [stamp, id] = Buffer.from(String(cursor), 'base64url').toString('utf8').split('|');
    if (!stamp || !id || Number.isNaN(Date.parse(stamp))) return null;
    return { lastMessageAt: stamp, id };
  } catch {
    return null;
  }
}

export {
  listConversations,
  conversationCounts,
  messageMatchesForSearch,
  STATUSES,
  PRIORITIES,
  MAX_LIMIT,
  MESSAGE_MATCH_LIMIT
};
