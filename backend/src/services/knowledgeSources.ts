// What the assistant may answer from besides the FAQ (plan v10 PRD-21,
// AI-08): pages of the site itself and PDF documents the business uploads.
//
// Pages are fetched only from the site's own domain — the product is not a
// crawler for anyone else's — and only where robots.txt allows our agent.
// Every address is cleared by services/outboundUrl.ts before the request and
// the connection is pinned to the address it cleared; redirects are cleared
// again; bodies are capped. A PDF is read in memory and not kept: only its
// text is. The text is cut into passages that PostgreSQL searches
// (db/migrations/0023_knowledge.sql).
//
// KNOWLEDGE_TRANSPORT=memory (development and CI, never in production)
// answers fetches from pages registered at /api/dev/knowledge-pages instead
// of the network; the address checks before it are the same.

import http from 'http';
import https from 'https';
import { extractText, getDocumentProxy } from 'unpdf';
import { getPool, query } from '../db/pool';
import { generateId } from '../db/objectId';
import { pinnedLookup, safeOutboundUrl, UnsafeUrlError } from './outboundUrl';
import { prefixQuery } from './helpCenter';
import type { SafeTarget } from './outboundUrl';

export const USER_AGENT = 'SupportioBot/1.0 (+support assistant; reads only pages its site added)';
const TIMEOUT_MS = 10_000;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const MAX_PDF_PAGES = 100;
const CHUNK_CHARS = 900;
/** More text than this from one source is not kept. */
const MAX_SOURCE_CHARS = 60_000;

export class KnowledgeError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

// ------------------------------------------------------------------ text

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  copy: '©',
  reg: '®',
  euro: '€'
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code =
        name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

const BLOCK =
  /<\/?(p|div|section|article|main|li|ul|ol|h[1-6]|br|tr|td|th|table|dd|dt|blockquote|pre|figcaption|summary|details)\b[^>]*>/gi;

/** A page's title and readable text: the main content when it says which it is. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = decodeEntities(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  let body = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(
      /<(script|style|noscript|svg|template|iframe|object|canvas|form)\b[\s\S]*?<\/\1>/gi,
      ' '
    );
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(body)?.[1];
  if (main && main.length > 200) body = main;
  else body = body.replace(/<(nav|footer|aside|header)\b[\s\S]*?<\/\1>/gi, ' ');
  const text = decodeEntities(body.replace(BLOCK, '\n').replace(/<[^>]+>/g, ' '))
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return { title, text };
}

/** Passages of about CHUNK_CHARS, cut at paragraphs, then at sentences. */
export function chunkText(text: string, size = CHUNK_CHARS): string[] {
  const pieces: string[] = [];
  for (const paragraph of text.slice(0, MAX_SOURCE_CHARS).split(/\n+/)) {
    if (paragraph.length <= size) pieces.push(paragraph);
    else {
      let rest = paragraph;
      while (rest.length > size) {
        const cut = Math.max(
          rest.lastIndexOf('. ', size),
          rest.lastIndexOf('? ', size),
          rest.lastIndexOf('! ', size)
        );
        const at = cut > size / 3 ? cut + 1 : size;
        pieces.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      if (rest) pieces.push(rest);
    }
  }
  const chunks: string[] = [];
  let current = '';
  for (const piece of pieces) {
    if (current && current.length + piece.length + 1 > size) {
      chunks.push(current);
      current = piece;
    } else current = current ? `${current}\n${piece}` : piece;
  }
  if (current) chunks.push(current);
  return chunks.filter((c) => c.trim().length >= 20);
}

// ---------------------------------------------------------------- robots

/**
 * Whether robots.txt lets our agent fetch `path`: the group for our agent if
 * there is one, else the one for "*"; the longest matching rule wins, Allow
 * on a tie (RFC 9309).
 */
export function robotsAllows(robots: string, path: string, agent = 'supportiobot'): boolean {
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; pattern: string }> }> = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const match = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === 'user-agent') {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((field === 'allow' || field === 'disallow') && current) {
      lastWasAgent = false;
      if (value) current.rules.push({ allow: field === 'allow', pattern: value });
    } else lastWasAgent = false;
  }
  const ours = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.includes(a)));
  const chosen = ours.length ? ours : groups.filter((g) => g.agents.includes('*'));
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of chosen.flatMap((g) => g.rules)) {
    const source = rule.pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\\\$$/, '$');
    if (!new RegExp(`^${source}`).test(path)) continue;
    const length = rule.pattern.length;
    if (!best || length > best.length || (length === best.length && rule.allow)) {
      best = { allow: rule.allow, length };
    }
  }
  return best ? best.allow : true;
}

// ----------------------------------------------------------------- fetch

interface Fetched {
  status: number;
  contentType: string;
  body: Buffer;
  url: string;
}

type Transport = (target: SafeTarget) => Promise<Fetched>;

/** GETs a cleared address, pinned to it; the body is cut off at the cap. */
const network: Transport = (target) =>
  new Promise((resolve, reject) => {
    const client = target.url.protocol === 'https:' ? https : http;
    const request = client.request(
      target.url,
      {
        method: 'GET',
        lookup: pinnedLookup(target) as never,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: 'text/html, application/xml, text/plain;q=0.8'
        },
        timeout: TIMEOUT_MS
      },
      (response) => {
        const parts: Buffer[] = [];
        let size = 0;
        response.on('data', (part: Buffer) => {
          size += part.length;
          if (size > MAX_PAGE_BYTES) {
            request.destroy(new KnowledgeError('too_large'));
            return;
          }
          parts.push(part);
        });
        response.on('end', () =>
          resolve({
            status: response.statusCode ?? 0,
            contentType: String(response.headers['content-type'] || ''),
            body: Buffer.concat(parts),
            url: response.headers.location
              ? new URL(String(response.headers.location), target.url).toString()
              : target.url.toString()
          })
        );
        response.on('error', reject);
      }
    );
    request.on('timeout', () => request.destroy(new KnowledgeError('timeout')));
    request.on('error', reject);
    request.end();
  });

// The development stand-in for the web (KNOWLEDGE_TRANSPORT=memory).
const standInPages = new Map<string, { status: number; contentType: string; body: string }>();
const standIn = () =>
  process.env.KNOWLEDGE_TRANSPORT === 'memory' && process.env.NODE_ENV !== 'production';

/** Development only: what the stand-in answers for an address. */
export function standInPage(
  url: string,
  page: { status?: number; contentType?: string; body: string }
) {
  standInPages.set(new URL(url).toString(), {
    status: page.status ?? 200,
    contentType: page.contentType ?? 'text/html; charset=utf-8',
    body: page.body
  });
}

const memory: Transport = async (target) => {
  const page = standInPages.get(target.url.toString());
  if (!page)
    return {
      status: 404,
      contentType: 'text/plain',
      body: Buffer.alloc(0),
      url: target.url.toString()
    };
  return {
    status: page.status,
    contentType: page.contentType,
    body: Buffer.from(page.body, 'utf8'),
    url: target.url.toString()
  };
};

// The stand-in does not ask DNS; any public-looking answer will do, and the
// name and literal-address checks still apply.
// Use an actually routable public address here. TEST-NET ranges are correctly
// rejected by the production SSRF guard, even though this transport never
// opens a real socket.
const standInLookup = async () => [{ address: '93.184.216.34', family: 4 as const }];

/** Whether `host` is the site's own domain or under it. */
export function onSite(host: string, domains: string[]): boolean {
  const h = host.toLowerCase().replace(/^www\./, '');
  return domains.some((raw) => {
    const d = raw
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/[/:].*$/, '')
      .replace(/^www\./, '');
    return Boolean(d) && (h === d || h.endsWith(`.${d}`));
  });
}

/** Fetches `url`, following up to three redirects, every hop cleared and on the site. */
async function fetchOnSite(url: string, domains: string[]): Promise<Fetched> {
  let next = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    let host: string;
    try {
      host = new URL(next).hostname;
    } catch {
      throw new KnowledgeError('unsafe');
    }
    // Off the site is refused before anything, DNS included, is asked.
    if (!onSite(host, domains)) throw new KnowledgeError('not_on_site');
    let target: SafeTarget;
    try {
      // eslint-disable-next-line no-await-in-loop
      target = standIn() ? await safeOutboundUrl(next, standInLookup) : await safeOutboundUrl(next);
    } catch (error) {
      if (error instanceof UnsafeUrlError) throw new KnowledgeError('unsafe');
      throw error;
    }
    if (!onSite(target.url.hostname, domains)) throw new KnowledgeError('not_on_site');
    let fetched: Fetched;
    try {
      // eslint-disable-next-line no-await-in-loop
      fetched = await (standIn() ? memory : network)(target);
    } catch (error) {
      if (error instanceof KnowledgeError) throw error;
      throw new KnowledgeError('unreachable');
    }
    if (fetched.status >= 300 && fetched.status < 400 && fetched.url !== target.url.toString()) {
      next = fetched.url;
      continue;
    }
    return fetched;
  }
  throw new KnowledgeError('too_many_redirects');
}

const robotsCache = new Map<string, { text: string | null; at: number }>();

/** robots.txt of an origin: its text, '' when there is none, null when it cannot be read. */
async function robotsFor(origin: string, domains: string[]): Promise<string | null> {
  const cached = robotsCache.get(origin);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cached.text;
  let text: string | null;
  try {
    const res = await fetchOnSite(`${origin}/robots.txt`, domains);
    // No robots.txt is permission; a server error is not (RFC 9309 §2.3.1.4).
    text =
      res.status >= 200 && res.status < 300
        ? res.body.toString('utf8')
        : res.status < 500
          ? ''
          : null;
  } catch (error) {
    // An address we may not call is that, not an unreadable robots.txt.
    if (error instanceof KnowledgeError && ['unsafe', 'not_on_site'].includes(error.code)) {
      throw error;
    }
    text = null;
  }
  robotsCache.set(origin, { text, at: Date.now() });
  return text;
}

/** A page of the site as text, if robots.txt allows and it is HTML. */
export async function readPage(
  url: string,
  domains: string[]
): Promise<{ title: string; text: string }> {
  const parsed = new URL(url);
  const robots = await robotsFor(parsed.origin, domains);
  if (robots === null) throw new KnowledgeError('robots_unreadable');
  if (!robotsAllows(robots, parsed.pathname + parsed.search)) throw new KnowledgeError('robots');
  const res = await fetchOnSite(url, domains);
  if (res.status !== 200) throw new KnowledgeError(`http_${res.status}`);
  if (!/text\/html|application\/xhtml\+xml/i.test(res.contentType))
    throw new KnowledgeError('not_html');
  const page = htmlToText(res.body.toString('utf8'));
  if (page.text.length < 40) throw new KnowledgeError('empty');
  return page;
}

/** The addresses a sitemap (or a sitemap index, one level down) lists on the site. */
export async function sitemapUrls(
  url: string,
  domains: string[],
  limit: number
): Promise<string[]> {
  const found: string[] = [];
  const read = async (address: string, depth: number) => {
    const res = await fetchOnSite(address, domains);
    if (res.status !== 200) throw new KnowledgeError(`http_${res.status}`);
    const xml = res.body.toString('utf8');
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) =>
      decodeEntities(m[1])
    );
    if (/<sitemapindex\b/i.test(xml) && depth === 0) {
      for (const child of locs.slice(0, 5)) {
        if (found.length >= limit) break;
        // eslint-disable-next-line no-await-in-loop
        await read(child, 1).catch(() => undefined);
      }
      return;
    }
    for (const loc of locs) {
      if (found.length >= limit) break;
      try {
        const u = new URL(loc);
        if (
          (u.protocol === 'https:' || u.protocol === 'http:') &&
          onSite(u.hostname, domains) &&
          !found.includes(u.toString())
        ) {
          found.push(u.toString());
        }
      } catch {
        // not an address
      }
    }
  };
  await read(url, 0);
  return found;
}

/** The text of a PDF, page by page; it is not kept. */
export async function readPdf(buffer: Buffer): Promise<string> {
  let pages: string[];
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    if (pdf.numPages > MAX_PDF_PAGES) throw new KnowledgeError('too_many_pages');
    pages = (await extractText(pdf, { mergePages: false })).text as string[];
  } catch (error) {
    if (error instanceof KnowledgeError) throw error;
    throw new KnowledgeError('unreadable_pdf');
  }
  const text = pages
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  if (text.length < 40) throw new KnowledgeError('empty');
  return text;
}

// ---------------------------------------------------------------- store

/** Replaces a source's passages and marks it ready. */
export async function storeText(sourceId: string, siteId: string, title: string, text: string) {
  const chunks = chunkText(text);
  if (!chunks.length) throw new KnowledgeError('empty');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM knowledge_chunks WHERE source_id = $1', [sourceId]);
    for (let i = 0; i < chunks.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await client.query(
        `INSERT INTO knowledge_chunks (id, source_id, site_id, position, content) VALUES ($1, $2, $3, $4, $5)`,
        [generateId(), sourceId, siteId, i, chunks[i]]
      );
    }
    await client.query(
      `UPDATE knowledge_sources
          SET status = 'ready', error = NULL, title = $2, chars = $3, refreshed_at = now()
        WHERE id = $1`,
      [sourceId, title.slice(0, 200), chunks.reduce((n, c) => n + c.length, 0)]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function fail(sourceId: string, code: string) {
  await query(`UPDATE knowledge_sources SET status = 'failed', error = $2 WHERE id = $1`, [
    sourceId,
    code.slice(0, 40)
  ]);
}

/** The site's own domains: where its pages may be fetched from. */
export async function siteDomains(siteId: string): Promise<string[]> {
  const { rows } = await query<{ domain: string; allowed_origins: string[] }>(
    'SELECT domain, allowed_origins FROM sites WHERE id = $1',
    [siteId]
  );
  if (!rows[0]) return [];
  return [rows[0].domain, ...(rows[0].allowed_origins || [])].filter(Boolean);
}

/** Fetches one page source and stores its text, or records why not. */
export async function refreshPage(sourceId: string): Promise<void> {
  const { rows } = await query<{ site_id: string; url: string }>(
    `SELECT site_id, url FROM knowledge_sources WHERE id = $1 AND kind = 'page'`,
    [sourceId]
  );
  const source = rows[0];
  if (!source) return;
  try {
    const page = await readPage(source.url, await siteDomains(source.site_id));
    await storeText(
      sourceId,
      source.site_id,
      page.title || new URL(source.url).pathname,
      page.text
    );
  } catch (error) {
    await fail(sourceId, error instanceof KnowledgeError ? error.code : 'unreachable');
    if (!(error instanceof KnowledgeError))
      console.error('[knowledge] page failed:', (error as Error).message);
  }
}

// One page at a time per process: polite to the customer's server.
let queue: Promise<void> = Promise.resolve();
export function enqueuePage(sourceId: string): Promise<void> {
  queue = queue.then(() => refreshPage(sourceId)).catch(() => undefined);
  return queue;
}

/** Pages left pending by a restart are fetched again (hourly sweep). */
export async function resumePendingPages(): Promise<number> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM knowledge_sources
      WHERE kind = 'page' AND status = 'pending' AND created_at < now() - interval '10 minutes'
      LIMIT 100`
  );
  for (const { id } of rows) void enqueuePage(id);
  return rows.length;
}

// --------------------------------------------------------------- search

export interface KnowledgePassage {
  id: string;
  kind: 'page' | 'pdf';
  title: string;
  url: string | null;
  content: string;
}

/** The passages of a site's ready sources that best match `question`. */
export async function knowledgePassages(
  siteId: string,
  question: string,
  limit: number
): Promise<KnowledgePassage[]> {
  const tsquery = prefixQuery(question);
  if (!tsquery || limit <= 0) return [];
  const { rows } = await query<KnowledgePassage>(
    `SELECT ch.id, s.kind, s.title, s.url, ch.content
       FROM knowledge_chunks ch
       JOIN knowledge_sources s ON s.id = ch.source_id
        AND s.status = 'ready' AND s.approved_for_external_model = true
      WHERE ch.site_id = $1 AND ch.search @@ to_tsquery('simple'::regconfig, $2)
      ORDER BY ts_rank(ch.search, to_tsquery('simple'::regconfig, $2)) DESC, ch.position
      LIMIT $3`,
    [siteId, tsquery, limit]
  );
  return rows;
}
