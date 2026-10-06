const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { assertTransition } = require('../utils/status');
const notify = require('../utils/notify');
const { createPickupToken, matches } = require('../utils/pickupToken');
const { z } = require('zod');

/** NGO claims a donation. Row lock + partial unique index = no double claims, even under races. */
const claim = asyncHandler(async (req, res) => {
  const donationId = Number(req.params.id);
  const result = await db.tx(async (c) => {
    const { rows } = await c.query('SELECT * FROM donations WHERE id=$1 FOR UPDATE', [donationId]);
    const d = rows[0];
    if (!d) throw new AppError(404, 'Donation not found');
    if (d.status !== 'AVAILABLE') throw new AppError(409, d.status === 'CLAIMED' ? 'Another NGO has already claimed this donation' : `This donation is ${d.status.toLowerCase().replace('_', ' ')} and cannot be claimed`);
    if (new Date(d.pickup_end) < new Date() || new Date(d.consume_before) < new Date()) throw new AppError(409, 'This donation has expired');
    assertTransition(d.status, 'CLAIMED');

    const cl = await c.query('INSERT INTO claims (donation_id, ngo_id) VALUES ($1,$2) RETURNING *', [donationId, req.user.id]);
    const pickup = createPickupToken();
    await c.query(
      `INSERT INTO pickup_verifications (claim_id,token_hash,token_ciphertext,expires_at)
       VALUES ($1,$2,$3,$4)`, [cl.rows[0].id, pickup.tokenHash, pickup.ciphertext, d.pickup_end]
    );
    await c.query(`UPDATE donations SET status='CLAIMED', updated_at=NOW() WHERE id=$1`, [donationId]);

    const { rows: n } = await c.query('SELECT organization_name FROM ngo_profiles WHERE user_id=$1', [req.user.id]);
    const ngoName = n[0]?.organization_name || req.user.name;
    await notify(c, { userId: d.donor_id, donationId, type: 'CLAIMED', title: 'Donation claimed',
      message: `${ngoName} has claimed your ${d.quantity} ${d.unit} donation "${d.food_name}".` });
    await notify(c, { userId: req.user.id, donationId, type: 'CLAIM_CONFIRMED', title: 'Claim confirmed',
      message: `You claimed "${d.food_name}". Collect it between the pickup times shown on the donation.` });
    return cl.rows[0];
  });
  res.status(201).json({ claim: result });
});

const CLAIM_SELECT = `
  SELECT c.*, d.food_name, d.food_type, d.quantity, d.unit, d.image_url, d.pickup_address, d.city, d.latitude, d.longitude,
         d.pickup_start, d.pickup_end, d.consume_before, d.donor_id, d.status AS donation_status,
         COALESCE(dp.organization_name, du.name) AS donor_name, du.phone AS donor_phone,
         COALESCE(np.organization_name, nu.name) AS ngo_name, nu.phone AS ngo_phone
  FROM claims c
  JOIN donations d ON d.id=c.donation_id
  JOIN users du ON du.id=d.donor_id LEFT JOIN donor_profiles dp ON dp.user_id=d.donor_id
  JOIN users nu ON nu.id=c.ngo_id LEFT JOIN ngo_profiles np ON np.user_id=c.ngo_id`;

const list = asyncHandler(async (req, res) => {
  const p = [];
  const where = [];
  if (req.user.role === 'NGO') { p.push(req.user.id); where.push(`c.ngo_id=$${p.length}`); }
  if (req.user.role === 'DONOR') { p.push(req.user.id); where.push(`d.donor_id=$${p.length}`); }
  if (['CLAIMED', 'PICKED_UP'].includes(req.query.status)) { p.push(req.query.status); where.push(`c.status=$${p.length}`); }
  const { rows } = await db.query(`${CLAIM_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY c.claimed_at DESC LIMIT 300`, p);
  res.json({ claims: rows });
});

const getOne = asyncHandler(async (req, res) => {
  const { rows } = await db.query(`${CLAIM_SELECT} WHERE c.id=$1`, [Number(req.params.id)]);
  const c = rows[0];
  if (!c) throw new AppError(404, 'Claim not found');
  const { role, id } = req.user;
  if ((role === 'NGO' && c.ngo_id !== id) || (role === 'DONOR' && c.donor_id !== id)) throw new AppError(404, 'Claim not found');
  res.json({ claim: c });
});

const verifyPickupSchema = z.object({ code: z.string().trim().min(20).max(200) });

const verifyPickup = asyncHandler(async (req, res) => {
  const claimId = Number(req.params.id);
  const result = await db.tx(async (c) => {
    const { rows } = await c.query(
      `SELECT c.*, d.status AS donation_status, d.donor_id, d.food_name, d.quantity, d.unit,
              pv.token_hash, pv.expires_at, pv.used_at
       FROM claims c JOIN donations d ON d.id=c.donation_id
       JOIN pickup_verifications pv ON pv.claim_id=c.id
       WHERE c.id=$1 FOR UPDATE OF c, d, pv`, [claimId]);
    const cl = rows[0];
    if (!cl || cl.ngo_id !== req.user.id) throw new AppError(404, 'Claim not found');
    if (cl.status !== 'CLAIMED' || cl.used_at) throw new AppError(409, 'This pickup has already been verified');
    if (new Date(cl.expires_at) < new Date()) throw new AppError(409, 'This pickup code has expired');
    if (!matches(req.body.code, cl.token_hash)) throw new AppError(400, 'That pickup code is invalid');
    assertTransition(cl.donation_status, 'PICKED_UP');

    const upd = await c.query(`UPDATE claims SET status='PICKED_UP', pickup_at=NOW(), updated_at=NOW() WHERE id=$1 RETURNING *`, [claimId]);
    await c.query(`UPDATE donations SET status='PICKED_UP', updated_at=NOW() WHERE id=$1`, [cl.donation_id]);
    await c.query('UPDATE pickup_verifications SET used_at=NOW(), verified_by=$1 WHERE claim_id=$2', [req.user.id, claimId]);
    const { rows: n } = await c.query('SELECT organization_name FROM ngo_profiles WHERE user_id=$1', [req.user.id]);
    await notify(c, { userId: cl.donor_id, donationId: cl.donation_id, type: 'PICKED_UP', title: 'Food picked up',
      message: `${n[0]?.organization_name || req.user.name} collected your ${cl.quantity} ${cl.unit} of "${cl.food_name}". Thank you for helping!` });
    return upd.rows[0];
  });
  res.json({ claim: result });
});

// Legacy endpoint intentionally no longer completes a pickup without proof.
const pickup = (_req, _res, next) => next(new AppError(410, 'Use QR pickup verification to complete this claim'));

module.exports = { claim, list, getOne, pickup, verifyPickup, verifyPickupSchema };
