'use strict';

// Reports (plan v10 PRD-22): the conversations, agents and SLA breaches of a
// window as CSV or Excel on a plan with exports, safe to open in a
// spreadsheet, audited; the week-by-hour heatmap in the viewer's time zone;
// the SLA breach list; and Monday's summary mail, once per week, to whoever
// has not turned it off.
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { sweepWeeklyReports } from '../src/services/weeklyReport';
import { outboxFor } from '../src/services/mail/console';
import { setPlan } from './helpers/accounts';
import { conversationOf, tenant } from './helpers/idor';
import { BASE } from './helpers/widget';
import type { Tenant } from './helpers/idor';

test.after(async () => {
  await closeRedisClient();
  await getPool().end();
});

async function get(t: Tenant, path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${t.token}` } });
  return { status: res.status, headers: res.headers, body: Buffer.from(await res.arrayBuffer()) };
}

/** The files in a zip, read back with nothing but zlib. */
function unzip(archive: Buffer): Map<string, string> {
  const files = new Map<string, string>();
  let at = 0;
  while (archive.readUInt32LE(at) === 0x04034b50) {
    const method = archive.readUInt16LE(at + 8);
    const crc = archive.readUInt32LE(at + 14);
    const packed = archive.readUInt32LE(at + 18);
    const size = archive.readUInt32LE(at + 22);
    const nameLength = archive.readUInt16LE(at + 26);
    const extra = archive.readUInt16LE(at + 28);
    const name = archive.toString('utf8', at + 30, at + 30 + nameLength);
    const start = at + 30 + nameLength + extra;
    const raw = archive.subarray(start, start + packed);
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw;
    assert.equal(data.length, size, `${name} size`);
    assert.equal(zlib.crc32(data), crc, `${name} checksum`);
    files.set(name, data.toString('utf8'));
    at = start + packed;
  }
  assert.equal(archive.readUInt32LE(at), 0x02014b50, 'central directory follows the files');
  return files;
}

/** A conversation with a visitor whose name a spreadsheet would run. */
async function trapConversation(t: Tenant) {
  const id = await conversationOf(t, 'Merhaba');
  await query(
    `UPDATE conversations SET visitor_name = $2, visitor_email = 'ziyaretci@example.com',
            tags = ARRAY['kargo'], rating = '{"score": 4, "feedback": "çok iyi, teşekkürler"}'::jsonb
      WHERE id = $1`,
    [id, '=HYPERLINK("http://evil.example","Tıkla")']
  );
  return id;
}

test('conversations as CSV: Turkish letters, nothing a spreadsheet would run', async () => {
  const t = await tenant('reportcsv');
  await trapConversation(t);
  const res = await get(t, `/api/analytics/export?report=conversations&format=csv&range=7days`);
  assert.equal(res.status, 200, res.body.toString());
  assert.match(String(res.headers.get('content-type')), /^text\/csv/);
  assert.match(
    String(res.headers.get('content-disposition')),
    /attachment; filename="support-io-conversations-7days-\d{4}-\d{2}-\d{2}\.csv"/
  );
  assert.deepEqual([...res.body.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'byte-order mark');
  const text = res.body.toString('utf8').slice(1);
  const [header, row] = text.split('\r\n');
  assert.ok(header.startsWith('Talep no,Başlangıç,Site,Durum'), header);
  assert.ok(row.includes(`"'=HYPERLINK(""http://evil.example"",""Tıkla"")"`), row);
  assert.ok(row.includes('ziyaretci@example.com'));
  assert.ok(row.includes('"çok iyi, teşekkürler"'));

  const english = await get(t, `/api/analytics/export?report=conversations&format=csv&lang=en`);
  assert.ok(english.body.toString('utf8').includes('Ticket,Started,Site,Status'));

  // Every download is audited.
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM audit_logs WHERE organization_id = $1 AND action = 'REPORT_EXPORTED'`,
    [t.organizationId]
  );
  assert.ok(rows[0].n >= 1);
});

test('agents and SLA breaches as an Excel workbook that unzips and reads back', async () => {
  const t = await tenant('reportxlsx');
  const id = await trapConversation(t);
  await query(
    `UPDATE conversations SET sla = sla || '{"firstResponseStatus": "breached"}'::jsonb WHERE id = $1`,
    [id]
  );
  for (const report of ['sla', 'agents', 'conversations']) {
    // eslint-disable-next-line no-await-in-loop
    const res = await get(t, `/api/analytics/export?report=${report}&format=xlsx&range=30days`);
    assert.equal(res.status, 200, report);
    assert.equal(
      res.headers.get('content-type'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    const files = unzip(res.body);
    for (const part of [
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/workbook.xml',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/worksheets/sheet1.xml'
    ]) {
      assert.ok(files.has(part), `${report}: ${part}`);
    }
    const sheet = files.get('xl/worksheets/sheet1.xml')!;
    if (report === 'sla') {
      assert.ok(files.get('xl/workbook.xml')!.includes('name="SLA ihlalleri"'));
      assert.ok(sheet.includes('Bekleme (dk)'));
    }
    if (report === 'conversations') {
      // An inline string is never a formula; the markup is escaped.
      assert.ok(sheet.includes('=HYPERLINK(&quot;http://evil.example&quot;,&quot;Tıkla&quot;)'));
      assert.ok(!sheet.includes('<f>'));
    }
  }
  const list = await get(t, '/api/analytics/sla-breaches?range=7days');
  const { breaches } = JSON.parse(list.body.toString());
  assert.equal(breaches.length, 1);
  assert.equal(breaches[0].id, id);
});

test('exports need a plan with them, the right input and the tenant’s own site', async () => {
  const t = await tenant('reportgate');
  const other = await tenant('reportother');
  assert.equal(
    (await get(t, `/api/analytics/export?siteId=${other.site._id}`)).status,
    404,
    'another tenant’s site'
  );
  assert.equal((await get(t, '/api/analytics/export?report=everything')).status, 400);
  assert.equal((await get(t, '/api/analytics/export?format=pdf')).status, 400);
  assert.equal((await get(t, '/api/analytics/export?range=1000days')).status, 400);
  assert.equal((await get(t, '/api/analytics/export?tz=Mars/Olympus')).status, 400);

  await setPlan(t.organizationId, 'FREE');
  const free = await get(t, '/api/analytics/export');
  assert.equal(free.status, 403);
  assert.equal(JSON.parse(free.body.toString()).code, 'PLAN_UPGRADE_REQUIRED');
  // The heatmap and the breach list are part of the analytics page on every plan.
  assert.equal((await get(t, '/api/analytics/heatmap')).status, 200);
});

test('the heatmap counts each conversation in the viewer’s weekday and hour', async () => {
  const t = await tenant('reportheat');
  const id = await conversationOf(t, 'Merhaba');
  // A Sunday 23:30 in Istanbul is a Sunday 20:30 in UTC and a Monday 05:30 in Tokyo.
  await query(`UPDATE conversations SET created_at = '2026-10-04T20:30:00Z' WHERE id = $1`, [id]);
  const tz = async (zone: string) =>
    JSON.parse((await get(t, `/api/analytics/heatmap?range=90days&tz=${zone}`)).body.toString())
      .grid as number[][];
  const istanbul = await tz('Europe/Istanbul');
  assert.equal(istanbul.length, 7);
  assert.equal(istanbul[6][23], 1, 'Sunday 23:00 in Istanbul');
  const tokyo = await tz('Asia/Tokyo');
  assert.equal(tokyo[0][5], 1, 'Monday 05:00 in Tokyo');
  assert.equal(
    tokyo.flat().reduce((a, b) => a + b, 0),
    1
  );
});

test('the weekly mail: Monday from eight, once, not to who turned it off, not for a quiet week', async () => {
  const busy = await tenant('weeklybusy');
  await conversationOf(busy, 'Kargo nerede?');
  const quiet = await tenant('weeklyquiet');
  const only = [busy.organizationId, quiet.organizationId];
  const mails = (email: string) =>
    outboxFor(email).filter((m) => /geçen haftanın özeti/.test(m.subject));

  // Next Monday, 07:30 and 09:00 in Istanbul (UTC+3).
  const monday = new Date();
  monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7 || 7));
  const at = (h: number, m = 0) =>
    new Date(
      Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), h - 3, m)
    );

  assert.deepEqual(await sweepWeeklyReports({ at: at(7, 30), only }), { sent: 0, quiet: 0 });
  const first = await sweepWeeklyReports({ at: at(9), only });
  assert.deepEqual(first, { sent: 1, quiet: 1 });
  assert.deepEqual(await sweepWeeklyReports({ at: at(10), only }), { sent: 0, quiet: 0 });
  assert.equal(mails(busy.email).length, 1);
  assert.equal(mails(quiet.email).length, 0);
  const mail = mails(busy.email)[0];
  assert.match(mail.text, /Konuşma: 1/);
  assert.match(mail.text, /Haftalık raporu kapat/);

  // Turned off: the next week brings nothing.
  const off = await fetch(`${BASE}/api/auth/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${busy.token}` },
    body: JSON.stringify({ weeklyReport: false })
  });
  assert.equal(off.status, 200);
  assert.equal(
    ((await off.json()) as { preferences: { weeklyReport: boolean } }).preferences.weeklyReport,
    false
  );
  const nextWeek = new Date(at(9).getTime() + 7 * 86_400_000);
  assert.deepEqual(await sweepWeeklyReports({ at: nextWeek, only: [busy.organizationId] }), {
    sent: 0,
    quiet: 0
  });
  assert.equal(mails(busy.email).length, 1);
});
