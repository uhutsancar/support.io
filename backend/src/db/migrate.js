'use strict';

const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

const SCHEMA_FILE = path.join(__dirname, 'schema.sql');

// Any positive constant works; it only has to be the same in every process.
const SCHEMA_LOCK_KEY = 815274301;

// Applies the relational schema. schema.sql only contains idempotent statements,
// so calling this on every boot is safe and keeps a fresh environment usable
// without a separate provisioning step. An advisory lock serialises concurrent
// boots, because two sessions running the same CREATE OR REPLACE at once would
// collide in the system catalogue.
async function applySchema() {
  const sql = fs.readFileSync(SCHEMA_FILE, 'utf8');
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [SCHEMA_LOCK_KEY]);
    try {
      await client.query(sql);
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [SCHEMA_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

module.exports = { applySchema };

if (require.main === module) {
  require('dotenv').config();
  applySchema()
    .then(() => {
      console.log('PostgreSQL schema applied.');
      return pool.end();
    })
    .catch((error) => {
      console.error('Schema migration failed:', error.message);
      process.exit(1);
    });
}
