// A stand-in for the AI model's API, for the browser tests (plan v10 TST-01
// #2). The API under test is started with
//
//   GEMINI_API_KEY=test-key-not-a-real-one
//   GEMINI_BASE_URL=http://127.0.0.1:<port>/v1beta
//
// so no request ever leaves the machine and no real key is involved.
//
//   GET  /v1beta/models/<model>                  200 (the availability check)
//   POST /v1beta/models/<model>:generateContent  answers with the first FAQ
//        entry it was given, citing it; with no entry, hands over
//
//   node fake-gemini.mjs [port]          (default 5199)

import http from 'node:http';

const port = Number(process.argv[2] || process.env.FAKE_GEMINI_PORT || 5199);
let calls = 0;

function reply(obj) {
  return {
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(obj) }] } }],
    usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 20 }
  };
}

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => (raw += chunk));
  req.on('end', () => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.url === '/calls') return send(200, { calls });
    if (req.method === 'GET' && /^\/v1beta\/models\/[^/:]+$/.test(req.url || '')) {
      return send(200, { name: req.url.slice('/v1beta/'.length) });
    }
    if (req.method === 'POST' && /:generateContent$/.test(req.url || '')) {
      calls += 1;
      let prompt = '';
      try {
        const body = JSON.parse(raw || '{}');
        prompt = (body.contents || [])
          .flatMap((c) => c.parts || [])
          .map((p) => p.text || '')
          .join('\n');
      } catch {
        return send(400, { error: { status: 'INVALID_ARGUMENT' } });
      }
      const entry = /\[(s\d+)\] Soru: [^\n]*\nCevap: ([^\n]+)/.exec(prompt);
      return send(
        200,
        entry
          ? reply({ answer: entry[2], handoff: false, sources: [entry[1]] })
          : reply({ answer: '', handoff: true, sources: [] })
      );
    }
    send(404, { error: { status: 'NOT_FOUND' } });
  });
});

server.listen(port, '127.0.0.1', () => {
  process.stdout.write(`fake Gemini on http://127.0.0.1:${port}/v1beta\n`);
});
