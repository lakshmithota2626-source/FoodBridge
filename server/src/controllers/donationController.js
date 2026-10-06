const { z } = require('zod');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { computeMatch } = require('../utils/matching');
const { assertTransition } = require('../utils/status');
const notify = require('../utils/notify');
const { expireDonations } = require('../utils/jobs');
const { uploadToCloudinary } = require('../middleware/upload');
const { decryptPickupToken } = require('../utils/pickupToken');
const { FOOD_TYPES } = require('./authController');

const UNITS = ['meals', 'kg', 'packets', 'boxes', 'plates', 'liters'];

const donationSchema = z.object({
  food_name: z.string().trim().min(2, 'Food name is required').max(150),
  food_type: z.enum(FOOD_TYPES, { errorMap: () => ({ message: 'Choose a food type' }) }),
  description: z.string().trim().max(1000).optional().nullable(),
  quantity: z.coerce.number({ invalid_type_error: 'Quantity must be a number' }).positive('Quantity must be greater than 0').max(1000000),
  unit: z.enum(UNITS).default('meals'),
  pickup_address: z.string().trim().min(5, 'Pickup address is required'),
  city: z.string().trim().min(2, 'City is required'),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  pickup_start: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid pickup start time' }) }),
  pickup_end: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid pickup end time' }) }),
  consume_before: z.coerce.date({ errorMap: () => ({ message: 'Enter a valid consume-before time' }) }),
}).superRefine((v, ctx) => {
  if (v.pickup_end <= v.pickup_start) ctx.addIssue({ code: 'custom', path: ['pickup_end'], message: 'Pickup end must be after pickup start' });
  if (v.pickup_end <= new Date()) ctx.addIssue({ code: 'custom', path: ['pickup_end'], message: 'Pickup end must be in the future' });
  if (v.consume_before < v.pickup_start) ctx.addIssue({ code: 'custom', path: ['consume_before'], message: 'Consume-before cannot be earlier than pickup start' });
});

const SELECT = `
  SELECT d.*, COALESCE(dp.organization_name, u.name) AS donor_name, dp.organization_type AS donor_type, u.phone AS donor_phone,
         c.id AS claim_id, c.ngo_id, c.claimed_at, c.pickup_at AS picked_up_at, c.status AS claim_status,
         COALESCE(np.organization_name, nu.name) AS ngo_name, nu.phone AS ngo_phone
  FROM donations d
  JOIN users u ON u.id = d.donor_id
  LEFT JOIN donor_profiles dp ON dp.user_id = d.donor_id
  LEFT JOIN claims c ON c.donation_id = d.id AND c.status <> 'CANCELLED'
  LEFT JOIN users nu ON nu.id = c.ngo_id
  LEFT JOIN ngo_profiles np ON np.user_id = c.ngo_id`;

const getNgoProfile = async (user) => {
  const { rows } = await db.query(
    `SELECT u.latitude, u.longitude, np.preferred_food_types, np.capacity FROM users u
     LEFT JOIN ngo_profiles np ON np.user_id=u.id WHERE u.id=$1`, [user.id]);
  return rows[0];
};

/** Hide contact details the viewer isn't entitled to see. */
function sanitize(row, user) {
  const r = { ...row };
  if (user.role === 'NGO' && r.ngo_id !== user.id) { delete r.donor_phone; }
  if (user.role === 'NGO' && r.ngo_id !== user.id) { delete r.ngo_phone; }
  return r;
}

const create = asyncHandler(async (req, res) => {
  const b = req.body;
  const image = req.file ? await uploadToCloudinary(req.file.buffer) : null;
  const { rows } = await db.query(
    `INSERT INTO donations (donor_id,food_name,food_type,description,quantity,unit,image_url,pickup_address,city,latitude,longitude,pickup_start,pickup_end,consume_before)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
    [req.user.id, b.food_name, b.food_type, b.description || null, b.quantity, b.unit, image, b.pickup_address, b.city, b.latitude, b.longitude, b.pickup_start, b.pickup_end, b.consume_before]);
  const { rows: full } = await db.query(`${SELECT} WHERE d.id=$1`, [rows[0].id]);
  res.status(201).json({ donation: full[0] });
});

const list = asyncHandler(async (req, res) => {
  await expireDonations();
  const q = req.query;
  const where = [];
  const p = [];
  const add = (sql, val) => { p.push(val); where.push(sql.replace('?', `$${p.length}`)); };
  const { role, id } = req.user;

  let ngo;
  if (role === 'DONOR') add('d.donor_id = ?', id);
  if (role === 'NGO') {
    ngo = await getNgoProfile(req.user);
    p.push(id);
    where.push(`(d.status = 'AVAILABLE' OR c.ngo_id = $${p.length})`);
  }
  if (q.status && ['AVAILABLE', 'CLAIMED', 'PICKED_UP', 'EXPIRED', 'CANCELLED'].includes(q.status)) add('d.status = ?', q.status);
  if (q.q) add(`(d.food_name ILIKE ? OR d.description ILIKE $${p.length + 1} OR dp.organization_name ILIKE $${p.length + 1})`, `%${q.q}%`);
  if (q.food_type) add('d.food_type = ?', q.food_type);
  if (q.city) add('LOWER(d.city) LIKE ?', `%${String(q.city).toLowerCase()}%`);
  if (q.min_qty && Number(q.min_qty) > 0) add('d.quantity >= ?', Number(q.min_qty));
  if (q.pickup_by && !Number.isNaN(Date.parse(q.pickup_by))) add('d.pickup_start <= ?', new Date(q.pickup_by));

  const { rows } = await db.query(`${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY d.created_at DESC LIMIT 300`, p);
  let items = rows.map((r) => sanitize(r, req.user));

  if (role === 'NGO') {
    items = items.map((r) => ({ ...r, ...computeMatch(r, ngo) }));
    if (q.max_distance) items = items.filter((r) => r.distance_km !== null && r.distance_km <= Number(q.max_distance));
    const sorters = {
      match: (a, b) => b.match.score - a.match.score,
      distance: (a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9),
      expiry: (a, b) => new Date(a.pickup_end) - new Date(b.pickup_end),
      quantity: (a, b) => b.quantity - a.quantity,
      newest: (a, b) => new Date(b.created_at) - new Date(a.created_at),
    };
    items.sort(sorters[q.sort] || sorters.match);
  } else if (q.sort === 'quantity') items.sort((a, b) => b.quantity - a.quantity);
  res.json({ donations: items });
});

const getOne = asyncHandler(async (req, res) => {
  await expireDonations();
  const { rows } = await db.query(`${SELECT} WHERE d.id=$1`, [Number(req.params.id)]);
  const d = rows[0];
  if (!d) throw new AppError(404, 'Donation not found');
  const { role, id } = req.user;
  if (role === 'DONOR' && d.donor_id !== id) throw new AppError(403, 'This is not your donation');
  if (role === 'NGO' && d.status !== 'AVAILABLE' && d.ngo_id !== id) throw new AppError(404, 'Donation not found');

  let extra = {};
  if (role === 'NGO') extra = computeMatch(d, await getNgoProfile(req.user));
  const { rows: rep } = role === 'ADMIN'
    ? await db.query('SELECT r.*, u.name AS reporter FROM reports r JOIN users u ON u.id=r.reported_by WHERE donation_id=$1 ORDER BY r.created_at DESC', [d.id])
    : { rows: [] };
  res.json({ donation: { ...sanitize(d, req.user), ...extra }, reports: rep });
});

/** The donor alone may retrieve the code used to prove handover at pickup. */
const pickupCode = asyncHandler(async (req, res) => {
  const donationId = Number(req.params.id);
  const { rows } = await db.query(
    `SELECT pv.token_ciphertext, pv.expires_at, pv.used_at
     FROM donations d JOIN claims c ON c.donation_id=d.id
     JOIN pickup_verifications pv ON pv.claim_id=c.id
     WHERE d.id=$1 AND d.donor_id=$2`, [donationId, req.user.id]
  );
  const code = rows[0];
  if (!code) throw new AppError(404, 'Pickup code not found');
  if (code.used_at) throw new AppError(409, 'This pickup code has already been used');
  if (new Date(code.expires_at) < new Date()) throw new AppError(409, 'This pickup code has expired');
  res.json({ code: decryptPickupToken(code.token_ciphertext), expires_at: code.expires_at });
});

const update = asyncHandler(async (req, res) => {
  const b = req.body;
  const id = Number(req.params.id);
  const { rows } = await db.query('SELECT donor_id, status, image_url FROM donations WHERE id=$1', [id]);
  const d = rows[0];
  if (!d || d.donor_id !== req.user.id) throw new AppError(404, 'Donation not found');
  if (d.status !== 'AVAILABLE') throw new AppError(409, `Only AVAILABLE donations can be edited (this one is ${d.status})`);
  const image = req.file ? await uploadToCloudinary(req.file.buffer) : d.image_url;
  await db.query(
    `UPDATE donations SET food_name=$1, food_type=$2, description=$3, quantity=$4, unit=$5, image_url=$6, pickup_address=$7, city=$8,
       latitude=$9, longitude=$10, pickup_start=$11, pickup_end=$12, consume_before=$13, expiry_warned=FALSE, updated_at=NOW()
     WHERE id=$14 AND status='AVAILABLE'`,
    [b.food_name, b.food_type, b.description || null, b.quantity, b.unit, image, b.pickup_address, b.city, b.latitude, b.longitude, b.pickup_start, b.pickup_end, b.consume_before, id]);
  const { rows: full } = await db.query(`${SELECT} WHERE d.id=$1`, [id]);
  res.json({ donation: full[0] });
});

/** Donor: cancel an AVAILABLE donation.  Admin: permanently remove a fake/invalid post. */
const remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const { rows } = await db.query('SELECT donor_id, status, food_name FROM donations WHERE id=$1', [id]);
  const d = rows[0];
  if (!d) throw new AppError(404, 'Donation not found');

  if (req.user.role === 'ADMIN') {
    await db.tx(async (c) => {
      await notify(c, { userId: d.donor_id, type: 'REMOVED', title: 'Donation removed',
        message: `Your donation "${d.food_name}" was removed by an administrator.` });
      await c.query('DELETE FROM donations WHERE id=$1', [id]);
    });
    return res.json({ message: 'Donation removed' });
  }
  if (d.donor_id !== req.user.id) throw new AppError(404, 'Donation not found');
  assertTransition(d.status, 'CANCELLED');
  const upd = await db.query(`UPDATE donations SET status='CANCELLED', updated_at=NOW() WHERE id=$1 AND status='AVAILABLE' RETURNING id`, [id]);
  if (!upd.rowCount) throw new AppError(409, 'This donation was just claimed and can no longer be cancelled');
  res.json({ message: 'Donation cancelled' });
});

// ---- Public (no auth): landing page ----
const publicStats = asyncHandler(async (_req, res) => {
  const { rows } = await db.query(`
    SELECT
      COALESCE((SELECT SUM(quantity) FROM donations WHERE status='PICKED_UP'),0) AS meals_rescued,
      COALESCE((SELECT SUM(quantity) FROM donations WHERE status='PICKED_UP' AND unit='kg'),0) AS food_saved_kg,
      (SELECT COUNT(*) FROM donations)::int AS donations,
      (SELECT COUNT(*) FROM donations WHERE status='PICKED_UP')::int AS pickups,
      (SELECT COUNT(*) FROM users WHERE role='NGO')::int AS ngos,
      (SELECT COUNT(*) FROM users WHERE role='DONOR')::int AS donors`);
  res.json(rows[0]);
});

const featured = asyncHandler(async (_req, res) => {
  await expireDonations();
  const { rows } = await db.query(
    `SELECT d.id, d.food_name, d.food_type, d.quantity, d.unit, d.city, d.image_url, d.pickup_end, COALESCE(dp.organization_name,u.name) AS donor_name
     FROM donations d JOIN users u ON u.id=d.donor_id LEFT JOIN donor_profiles dp ON dp.user_id=d.donor_id
     WHERE d.status='AVAILABLE' ORDER BY d.created_at DESC LIMIT 4`);
  res.json({ donations: rows });
});

module.exports = { donationSchema, create, list, getOne, pickupCode, update, remove, publicStats, featured, SELECT, getNgoProfile, sanitize };
