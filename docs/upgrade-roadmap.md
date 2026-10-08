# Platform upgrade roadmap

Plan v10 SUP-07 — a note, not work for now. Each line is its own pull
request, with the full test suites green before it merges; none of them is
done before the paid launch unless a security advisory forces it.

| Component | Today (8 Oct 2026) | Next | When | Watch out for |
|---|---|---|---|---|
| Node.js | 22 (image `node:22.23.3-alpine`, pinned) | 24 LTS | before 2027 Q1 (22 leaves active LTS) | native module rebuilds (sharp, bcryptjs is pure JS); `fetch`/undici behaviour; run the browser suite on all projects |
| Express | 4.x | 5 | after launch | path syntax (`/:param?`, `*`), `req.query` getter, removed `res.send(status)`; every route has a test |
| TypeScript | 5.9 | 7 (native compiler) | when stable and typescript-eslint supports it | stricter checks may surface; `tsconfig.widget.json` emit stays ES2017 |
| React | 18.2 | 19 | after launch | `forwardRef`, `defaultProps` on function components, react-helmet-async compatibility, Radix/embla/motion versions |
| ESLint | 9.39 | 10 | with typescript-eslint support | flat config already in use |
| pino | 9.14 | 10 | any time | serializer and redaction options (`config/logger.ts` tests) |
| dotenv | 16 | 17/18 | any time | 17 logs a line on load by default (`quiet: true`) |
| Vite | 8 | 9 | after launch | plugin API; the public-pages and OG image scripts |
| Tailwind CSS | 3.3 | 4 | after launch, one sitting | config moves to CSS; every class name in the marketing pages to re-check visually |
| socket.io | 4.x | 4.x latest | with each minor | widget client and server stay on the same minor |
| PostgreSQL | 16.15 | 17 / 18 | with a planned maintenance window | dump/restore or `pg_upgrade`; WAL-G image rebuilt (docker/postgres) |
| Redis | 7.4.11 | 7.4.x patches; Valkey 8 later | KARAR-SUP-1: stay on 7.4 for now | licence change in Redis 8; Valkey is the drop-in |
| Caddy | 2.11.7 | 2.11.x patches | as released (Dependabot digests) | Caddyfile syntax (`caddy validate` in the PR) |

Dependabot (`.github/dependabot.yml`) proposes patch and minor updates every
week; this table is for the major steps it does not take on its own.
