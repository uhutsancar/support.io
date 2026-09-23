// Loads .env, and does it before anything else can read process.env.
//
// This has to be its own module because of how imports are evaluated. `server.ts`
// read like this:
//
//     import dotenv from 'dotenv';
//     import express from 'express';
//     ... 45 more imports ...
//     dotenv.config();            // <- line 51
//
// which looks right and is not. Imports are hoisted: every one of those modules
// is fully evaluated *before* the first statement of `server.ts` runs. So any
// module that read `process.env` at its top level saw an empty environment:
//
//     middleware/s3Upload.ts   warned "S3 not configured" on every boot, with
//                              the keys sitting in .env the whole time
//     config/origins.ts        never applied CORS_ORIGINS, and computed
//                              `isProduction` as false — which in a production
//                              deployment that sets NODE_ENV through .env would
//                              have left the development origin rules (any
//                              localhost, any private LAN address) switched on
//     config/session.ts        ignored SESSION_TTL_SECONDS
//     db/inboxQueries.ts       ignored both of its tuning variables
//
// Importing this module first fixes all of them at once, because a side-effect
// import is evaluated in source order along with the rest.
//
// Every entry point does this on its own line, first:
//
//     import './config/env';     (or '../src/config/env' from a script)
//
// Modules that read configuration inside a function — `db/pool.ts`,
// `config/jwt.ts` — were never affected and do not need to change.

import dotenv from 'dotenv';

dotenv.config();

/**
 * True when this process is running a production deployment.
 *
 * Exported so callers read it from one place rather than comparing the string
 * themselves; several did, and one of them ran before the environment existed.
 */
export const isProduction = process.env.NODE_ENV === 'production';

/** True in the local development setup, where relaxed rules are acceptable. */
export const isDevelopment = !isProduction;
