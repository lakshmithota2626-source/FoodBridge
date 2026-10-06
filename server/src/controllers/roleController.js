const db = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { computeMatch } = require('../utils/matching');
const { expireDonations } = require('../utils/jobs');
const { SELECT, getNgoProfile, sanitize } = require('./donationController');

const donorStats = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status='AVAILABLE')::int AS available,
       COUNT(*) FILTER (WHERE status='CLAIMED')::int AS claimed,
       COUNT(*) FILTER (WHERE status='PICKED_UP')::int AS picked_up,
       COUNT(*) FILTER (WHERE status='EXPIRED')::int AS expired,
       COUNT(*) FILTER (WHERE status='CANCELLED')::int AS cancelled,
       COALESCE(SUM(quantity) FILTER (WHERE status='PICKED_UP'),0) AS meals_donated
     FROM donations WHERE donor_id=$1`, [req.user.id]);
  res.json(rows[0]);
});

async function availableFor(user, maxKm) {
  await expireDonations();
  const ngo = await getNgoProfile(user);
  const { rows } = await db.query(`${SELECT} WHERE d.status='AVAILABLE' ORDER BY d.created_at DESC LIMIT 300`);
  let items = rows.map((r) => ({ ...sanitize(r, user), ...computeMatch(r, ngo) }));
  if (maxKm) items = items.filter((r) => r.distance_km !== null && r.distance_km <= maxKm);
  return items;
}

const nearby = asyncHandler(async (req, res) => {
  const radius = Number(req.query.radius) || 10;
  const items = (await availableFor(req.user, radius)).sort((a, b) => a.distance_km - b.distance_km);
  res.json({ donations: items, radius });
});

const recommendations = asyncHandler(async (req, res) => {
  const items = (await availableFor(req.user)).sort((a, b) => b.match.score - a.match.score).slice(0, 6);
  res.json({ donations: items });
});

const ngoStats = asyncHandler(async (req, res) => {
  await expireDonations();
  const ngo = await getNgoProfile(req.user);
  const { rows: avail } = await db.query(`SELECT latitude, longitude FROM donations WHERE status='AVAILABLE'`);
  const { haversineKm } = require('../utils/geo');
  const nearbyCount = avail.filter((d) => {
    const km = haversineKm(ngo.latitude, ngo.longitude, d.latitude, d.longitude);
    return km !== null && km <= 10;
  }).length;
  const { rows } = await db.query(
    `SELECT COUNT(*) FILTER (WHERE c.status='CLAIMED')::int AS claimed,
            COUNT(*) FILTER (WHERE c.status='PICKED_UP')::int AS picked_up,
            COALESCE(SUM(d.quantity) FILTER (WHERE c.status='PICKED_UP'),0) AS meals_rescued
     FROM claims c JOIN donations d ON d.id=c.donation_id WHERE c.ngo_id=$1`, [req.user.id]);
  res.json({ available_nearby: nearbyCount, ...rows[0] });
});

module.exports = { donorStats, nearby, recommendations, ngoStats };
