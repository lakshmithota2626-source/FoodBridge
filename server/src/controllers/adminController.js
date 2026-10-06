const { z } = require('zod');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { expireDonations } = require('../utils/jobs');
const { SELECT } = require('./donationController');

const users = asyncHandler(async (req, res) => {
  const p = [];
  const where = [];
  if (['DONOR', 'NGO', 'ADMIN'].includes(req.query.role)) { p.push(req.query.role); where.push(`u.role=$${p.length}`); }
  if (req.query.q) { p.push(`%${req.query.q}%`); where.push(`(u.name ILIKE $${p.length} OR u.email ILIKE $${p.length} OR COALESCE(dp.organization_name,np.organization_name,'') ILIKE $${p.length})`); }
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.city, u.is_active, u.verification_status, u.created_at,
            COALESCE(dp.organization_name, np.organization_name) AS organization_name
     FROM users u LEFT JOIN donor_profiles dp ON dp.user_id=u.id LEFT JOIN ngo_profiles np ON np.user_id=u.id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY u.created_at DESC LIMIT 500`, p);
  res.json({ users: rows });
});

const setUserStatus = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) throw new AppError(400, 'You cannot deactivate your own account');
  const r = await db.query(`UPDATE users SET is_active=$1, updated_at=NOW() WHERE id=$2 AND role<>'ADMIN' RETURNING id, is_active`, [req.body.is_active, id]);
  if (!r.rowCount) throw new AppError(404, 'User not found (admin accounts cannot be changed here)');
  res.json({ user: r.rows[0] });
});
const statusSchema = z.object({ is_active: z.boolean() });

const verificationSchema = z.object({ verification_status: z.enum(['UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED']) });
const setVerification = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const r = await db.query(
    `UPDATE users SET verification_status=$1, updated_at=NOW()
     WHERE id=$2 AND role IN ('DONOR','NGO') RETURNING id, role, verification_status`,
    [req.body.verification_status, id]
  );
  if (!r.rowCount) throw new AppError(404, 'User not found');
  res.json({ user: r.rows[0] });
});

const donations = asyncHandler(async (req, res) => {
  await expireDonations();
  const p = [];
  const where = [];
  if (req.query.status) { p.push(req.query.status); where.push(`d.status=$${p.length}`); }
  if (req.query.q) { p.push(`%${req.query.q}%`); where.push(`(d.food_name ILIKE $${p.length} OR dp.organization_name ILIKE $${p.length})`); }
  const { rows } = await db.query(`${SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY d.created_at DESC LIMIT 500`, p);
  res.json({ donations: rows });
});

const reports = asyncHandler(async (req, res) => {
  const p = [];
  let where = '';
  if (['OPEN', 'RESOLVED', 'DISMISSED'].includes(req.query.status)) { p.push(req.query.status); where = 'WHERE r.status=$1'; }
  const { rows } = await db.query(
    `SELECT r.*, u.name AS reporter_name, d.food_name, d.status AS donation_status, COALESCE(dp.organization_name, du.name) AS donor_name
     FROM reports r JOIN users u ON u.id=r.reported_by JOIN donations d ON d.id=r.donation_id
     JOIN users du ON du.id=d.donor_id LEFT JOIN donor_profiles dp ON dp.user_id=d.donor_id
     ${where} ORDER BY (r.status='OPEN') DESC, r.created_at DESC LIMIT 300`, p);
  res.json({ reports: rows });
});
const reportStatusSchema = z.object({ status: z.enum(['RESOLVED', 'DISMISSED']) });
const setReportStatus = asyncHandler(async (req, res) => {
  const r = await db.query('UPDATE reports SET status=$1 WHERE id=$2 RETURNING *', [req.body.status, Number(req.params.id)]);
  if (!r.rowCount) throw new AppError(404, 'Report not found');
  res.json({ report: r.rows[0] });
});

const analytics = asyncHandler(async (_req, res) => {
  await expireDonations();
  const totals = (await db.query(`
    SELECT
      (SELECT COUNT(*) FROM users)::int AS total_users,
      (SELECT COUNT(*) FROM users WHERE role='DONOR')::int AS total_donors,
      (SELECT COUNT(*) FROM users WHERE role='NGO')::int AS total_ngos,
      COUNT(*)::int AS total_donations,
      COUNT(*) FILTER (WHERE status='AVAILABLE')::int AS available,
      COUNT(*) FILTER (WHERE status='CLAIMED')::int AS claimed,
      COUNT(*) FILTER (WHERE status='PICKED_UP')::int AS picked_up,
      COUNT(*) FILTER (WHERE status='EXPIRED')::int AS expired,
      COUNT(*) FILTER (WHERE status='CANCELLED')::int AS cancelled,
      COUNT(*) FILTER (WHERE status IN ('AVAILABLE','CLAIMED'))::int AS active_donations,
      COALESCE(SUM(quantity) FILTER (WHERE status='PICKED_UP'),0) AS meals_rescued,
      (SELECT COUNT(*) FROM reports WHERE status='OPEN')::int AS open_reports
    FROM donations`)).rows[0];

  const days = `generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day')`;
  const [overTime, statusDist, typeDist, growth, mealsTime, recentD, recentU, activity] = await Promise.all([
    db.query(`SELECT to_char(g::date,'DD Mon') AS day, COUNT(d.id)::int AS donations FROM ${days} g
              LEFT JOIN donations d ON d.created_at::date = g::date GROUP BY g ORDER BY g`),
    db.query(`SELECT status AS name, COUNT(*)::int AS value FROM donations GROUP BY status ORDER BY value DESC`),
    db.query(`SELECT food_type AS name, COUNT(*)::int AS value FROM donations GROUP BY food_type ORDER BY value DESC`),
    db.query(`SELECT to_char(g::date,'DD Mon') AS day,
                COUNT(u.id) FILTER (WHERE u.role='DONOR')::int AS donors, COUNT(u.id) FILTER (WHERE u.role='NGO')::int AS ngos
              FROM ${days} g LEFT JOIN users u ON u.created_at::date = g::date GROUP BY g ORDER BY g`),
    db.query(`SELECT to_char(g::date,'DD Mon') AS day, COALESCE(SUM(c.quantity),0) AS meals FROM ${days} g
              LEFT JOIN (SELECT cl.pickup_at, d.quantity FROM claims cl JOIN donations d ON d.id=cl.donation_id WHERE cl.status='PICKED_UP') c
                ON c.pickup_at::date = g::date GROUP BY g ORDER BY g`),
    db.query(`${SELECT} ORDER BY d.created_at DESC LIMIT 6`),
    db.query(`SELECT u.id, u.name, u.email, u.role, u.created_at, COALESCE(dp.organization_name, np.organization_name) AS organization_name
              FROM users u LEFT JOIN donor_profiles dp ON dp.user_id=u.id LEFT JOIN ngo_profiles np ON np.user_id=u.id
              ORDER BY u.created_at DESC LIMIT 6`),
    db.query(`
      SELECT * FROM (
        SELECT 'DONATED' AS kind, d.created_at AS at, COALESCE(dp.organization_name,u.name) || ' posted ' || d.food_name AS text
          FROM donations d JOIN users u ON u.id=d.donor_id LEFT JOIN donor_profiles dp ON dp.user_id=d.donor_id
        UNION ALL
        SELECT 'CLAIMED', c.claimed_at, COALESCE(np.organization_name,u.name) || ' claimed ' || d.food_name
          FROM claims c JOIN donations d ON d.id=c.donation_id JOIN users u ON u.id=c.ngo_id LEFT JOIN ngo_profiles np ON np.user_id=c.ngo_id
        UNION ALL
        SELECT 'PICKED_UP', c.pickup_at, COALESCE(np.organization_name,u.name) || ' picked up ' || d.food_name
          FROM claims c JOIN donations d ON d.id=c.donation_id JOIN users u ON u.id=c.ngo_id LEFT JOIN ngo_profiles np ON np.user_id=c.ngo_id
          WHERE c.pickup_at IS NOT NULL
      ) a ORDER BY at DESC LIMIT 12`),
  ]);
  res.json({
    totals,
    charts: { donations_over_time: overTime.rows, status_distribution: statusDist.rows, food_type_distribution: typeDist.rows, user_growth: growth.rows, meals_over_time: mealsTime.rows },
    recent_donations: recentD.rows, recent_users: recentU.rows, activity: activity.rows,
  });
});

module.exports = { users, setUserStatus, statusSchema, verificationSchema, setVerification, donations, reports, reportStatusSchema, setReportStatus, analytics };
