const fs = require('fs');
const path = require('path');
const db = require('../config/db');

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, '../../../database/schema.sql'), 'utf8');
  await db.pool.query(sql);
  console.log('✔ Schema applied');
  await db.pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
