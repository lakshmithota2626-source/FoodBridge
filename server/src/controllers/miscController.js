const { z } = require('zod');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const notify = require('../utils/notify');

// ---------- Notifications ----------
const listNotifications = asyncHandler(async (req, res) => {
  const { rows } = await db.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [req.user.id]);
  const unread = await db.query('SELECT COUNT(*)::int AS n FROM notifications WHERE user_id=$1 AND is_read=FALSE', [req.user.id]);
  res.json({ notifications: rows, unread_count: unread.rows[0].n });
});
const markRead = asyncHandler(async (req, res) => {
  const r = await db.query('UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2 RETURNING id', [Number(req.params.id), req.user.id]);
  if (!r.rowCount) throw new AppError(404, 'Notification not found');
  res.json({ message: 'Marked as read' });
});
const markAllRead = asyncHandler(async (req, res) => {
  await db.query('UPDATE notifications SET is_read=TRUE WHERE user_id=$1', [req.user.id]);
  res.json({ message: 'All notifications marked as read' });
});

// ---------- Reviews (donor rates the NGO after pickup) ----------
const reviewSchema = z.object({ donation_id: z.coerce.number().int().positive(), rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(500).optional().nullable() });
const createReview = asyncHandler(async (req, res) => {
  const { donation_id, rating, comment } = req.body;
  const { rows } = await db.query(
    `SELECT d.donor_id, d.status, c.ngo_id FROM donations d JOIN claims c ON c.donation_id=d.id AND c.status='PICKED_UP' WHERE d.id=$1`, [donation_id]);
  const d = rows[0];
  if (!d || d.donor_id !== req.user.id) throw new AppError(404, 'Donation not found');
  if (d.status !== 'PICKED_UP') throw new AppError(409, 'You can review a donation only after it has been picked up');
  const r = await db.query(
    'INSERT INTO reviews (donor_id, ngo_id, donation_id, rating, comment) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [req.user.id, d.ngo_id, donation_id, rating, comment || null]).catch((e) => {
      if (e.code === '23505') throw new AppError(409, 'You have already reviewed this donation');
      throw e;
    });
  await notify(db, { userId: d.ngo_id, donationId: donation_id, type: 'REVIEW', title: 'New review', message: `A donor rated your pickup ${rating}/5.` });
  res.status(201).json({ review: r.rows[0] });
});
const getReview = asyncHandler(async (req, res) => {
  const { rows } = await db.query(
    `SELECT r.*, COALESCE(dp.organization_name,u.name) AS donor_name FROM reviews r JOIN users u ON u.id=r.donor_id
     LEFT JOIN donor_profiles dp ON dp.user_id=r.donor_id WHERE r.donation_id=$1`, [Number(req.params.donationId)]);
  res.json({ review: rows[0] || null });
});

// ---------- Reports ----------
const reportSchema = z.object({ donation_id: z.coerce.number().int().positive(), reason: z.string().trim().min(10, 'Please describe the problem (at least 10 characters)').max(500) });
const createReport = asyncHandler(async (req, res) => {
  const { donation_id, reason } = req.body;
  const d = await db.query('SELECT id FROM donations WHERE id=$1', [donation_id]);
  if (!d.rowCount) throw new AppError(404, 'Donation not found');
  await db.query('INSERT INTO reports (reported_by, donation_id, reason) VALUES ($1,$2,$3)', [req.user.id, donation_id, reason])
    .catch((e) => { if (e.code === '23505') throw new AppError(409, 'You have already reported this donation'); throw e; });
  res.status(201).json({ message: 'Thanks — an administrator will review this report.' });
});

module.exports = { listNotifications, markRead, markAllRead, reviewSchema, createReview, getReview, reportSchema, createReport };
