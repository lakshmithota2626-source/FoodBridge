const jwt = require('jsonwebtoken');
const env = require('../config/env');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const authenticateUser = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new AppError(401, 'Authentication required');
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw new AppError(401, 'Your session has expired. Please log in again.');
  }
  const { rows } = await db.query(
    'SELECT id, name, email, role, is_active, latitude, longitude, city FROM users WHERE id=$1', [payload.id]
  );
  const user = rows[0];
  if (!user) throw new AppError(401, 'Account no longer exists');
  if (!user.is_active) throw new AppError(403, 'This account has been deactivated');
  req.user = user;
  next();
});

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(new AppError(401, 'Authentication required'));
  if (!roles.includes(req.user.role)) return next(new AppError(403, 'You do not have permission to do that'));
  next();
};

module.exports = {
  authenticateUser,
  requireRole,
  requireDonor: requireRole('DONOR'),
  requireNGO: requireRole('NGO'),
  requireAdmin: requireRole('ADMIN'),
};
