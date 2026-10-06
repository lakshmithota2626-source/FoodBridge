const { Pool } = require('pg');
const env = require('./env');

function getSslConfig() {
  if (!env.databaseUrl) return false;
  if (process.env.DB_SSL === 'false') return false;
  try {
    const parsed = new URL(env.databaseUrl);
    const host = parsed.hostname;
    // Internal Render database hostnames are like "dpg-xxxxxx-a" (no dots)
    if (host && host.startsWith('dpg-') && !host.includes('.')) {
      return false;
    }
    if (host === 'localhost' || host === '127.0.0.1') {
      return false;
    }
  } catch (e) {
    if (env.databaseUrl.includes('dpg-') && !env.databaseUrl.includes('.render.com')) {
      return false;
    }
  }
  return env.dbSsl ? { rejectUnauthorized: false } : false;
}

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: getSslConfig(),
});

/** Run fn inside a transaction; commits on success, rolls back on any error. */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query: (text, params) => pool.query(text, params), tx };
