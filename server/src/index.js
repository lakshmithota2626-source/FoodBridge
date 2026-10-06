const fs = require('fs');
const path = require('path');
const env = require('./config/env');
const db = require('./config/db');
const app = require('./app');
const { startJobs } = require('./utils/jobs');

async function start() {
  // Apply idempotent schema migration on every startup (safe to re-run)
  try {
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await db.pool.query(sql);
    console.log('✔ Schema applied');
  } catch (err) {
    // Log but do not exit — lets the server start even if DB is momentarily unreachable
    console.error('⚠ Migration warning (server will still start):', err.message);
  }

  app.listen(env.port, () => {
    console.log(`FoodBridge API listening on :${env.port}`);
    startJobs(); // expiry + reminder worker (runs every minute)
  });
}

start().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
