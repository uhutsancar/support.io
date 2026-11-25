// Loads .env before anything else can read process.env.
//
// Imports are hoisted, so a module that reads process.env at its top level
// sees an empty environment unless .env was loaded by an earlier import.
// Every entry point therefore imports this module first, on its own line:
//
//     import './config/env';     (or '../src/config/env' from a script)

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
