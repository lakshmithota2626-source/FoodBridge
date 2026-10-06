const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const env = require('../config/env');
const db = require('../config/db');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const FOOD_TYPES = ['Vegetarian', 'Non-Vegetarian', 'Bread', 'Fruits', 'Vegetables', 'Packaged Food', 'Meals', 'Other'];
const ORG_TYPES = ['Restaurant', 'Hostel', 'Function Hall', 'College Canteen', 'Hotel', 'Other'];

const coord = (min, max) => z.coerce.number().min(min).max(max);
const common = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(20),
  address: z.string().trim().min(5, 'Address is required'),
  city: z.string().trim().min(2, 'City is required'),
  latitude: coord(-90, 90),
  longitude: coord(-180, 180),
  organization_name: z.string().trim().min(2, 'Organization name is required').max(150),
  description: z.string().trim().max(1000).optional().nullable(),
};

const registerSchema = z.object({
  role: z.enum(['DONOR', 'NGO']),
  ...common,
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Za-z]/, 'Password needs a letter').regex(/\d/, 'Password needs a number'),
  organization_type: z.enum(ORG_TYPES).optional(),
  contact_person: z.string().trim().max(100).optional(),
  preferred_food_types: z.array(z.enum(FOOD_TYPES)).optional(),
  capacity: z.coerce.number().int().positive().max(100000).optional(),
});

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

const profileSchema = z.object({
  name: common.name.optional(), phone: common.phone.optional(), address: common.address.optional(), city: common.city.optional(),
  latitude: common.latitude.optional(), longitude: common.longitude.optional(),
  organization_name: common.organization_name.optional(), description: common.description,
  organization_type: z.enum(ORG_TYPES).optional(), contact_person: z.string().trim().max(100).optional(),
  preferred_food_types: z.array(z.enum(FOOD_TYPES)).optional(), capacity: z.coerce.number().int().positive().max(100000).optional(),
});

const sign = (u) => jwt.sign({ id: u.id, role: u.role }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

async function loadUser(id) {
  const { rows } = await db.query(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.address, u.city, u.latitude, u.longitude, u.created_at, u.verification_status,
            COALESCE(dp.organization_name, np.organization_name) AS organization_name,
            dp.organization_type, np.contact_person,
            COALESCE(dp.description, np.description) AS description,
            np.preferred_food_types, np.capacity
     FROM users u
     LEFT JOIN donor_profiles dp ON dp.user_id=u.id
     LEFT JOIN ngo_profiles np ON np.user_id=u.id
     WHERE u.id=$1`, [id]);
  return rows[0];
}

const register = asyncHandler(async (req, res) => {
  const b = req.body;
  const exists = await db.query('SELECT 1 FROM users WHERE email=$1', [b.email]);
  if (exists.rowCount) throw new AppError(409, 'An account with this email already exists');
  const hash = await bcrypt.hash(b.password, 12);

  const id = await db.tx(async (c) => {
    const u = await c.query(
      `INSERT INTO users (name,email,password,phone,role,address,city,latitude,longitude,verification_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [b.name, b.email, hash, b.phone, b.role, b.address, b.city, b.latitude, b.longitude, b.role === 'NGO' ? 'PENDING' : 'UNVERIFIED']);
    const uid = u.rows[0].id;
    if (b.role === 'DONOR') {
      await c.query(
        `INSERT INTO donor_profiles (user_id,organization_name,organization_type,description,address,city,latitude,longitude)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [uid, b.organization_name, b.organization_type || 'Other', b.description || null, b.address, b.city, b.latitude, b.longitude]);
    } else {
      await c.query(
        `INSERT INTO ngo_profiles (user_id,organization_name,contact_person,description,address,city,latitude,longitude,preferred_food_types,capacity)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [uid, b.organization_name, b.contact_person || b.name, b.description || null, b.address, b.city, b.latitude, b.longitude,
          b.preferred_food_types || [], b.capacity || 100]);
    }
    return uid;
  });
  const user = await loadUser(id);
  res.status(201).json({ token: sign(user), user });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await db.query('SELECT id, role, password, is_active FROM users WHERE email=$1', [email]);
  const row = rows[0];
  // same message for unknown email / wrong password so accounts can't be enumerated
  const ok = row && (await bcrypt.compare(password, row.password));
  if (!ok) throw new AppError(401, 'Incorrect email or password');
  if (!row.is_active) throw new AppError(403, 'This account has been deactivated');
  const user = await loadUser(row.id);
  res.json({ token: sign(row), user });
});

const me = asyncHandler(async (req, res) => res.json({ user: await loadUser(req.user.id) }));

const updateProfile = asyncHandler(async (req, res) => {
  const b = req.body;
  const uid = req.user.id;
  await db.tx(async (c) => {
    await c.query(
      `UPDATE users SET name=COALESCE($1,name), phone=COALESCE($2,phone), address=COALESCE($3,address), city=COALESCE($4,city),
         latitude=COALESCE($5,latitude), longitude=COALESCE($6,longitude), updated_at=NOW() WHERE id=$7`,
      [b.name, b.phone, b.address, b.city, b.latitude, b.longitude, uid]);
    if (req.user.role === 'DONOR') {
      await c.query(
        `UPDATE donor_profiles SET organization_name=COALESCE($1,organization_name), organization_type=COALESCE($2,organization_type),
           description=COALESCE($3,description), address=COALESCE($4,address), city=COALESCE($5,city),
           latitude=COALESCE($6,latitude), longitude=COALESCE($7,longitude) WHERE user_id=$8`,
        [b.organization_name, b.organization_type, b.description, b.address, b.city, b.latitude, b.longitude, uid]);
    } else if (req.user.role === 'NGO') {
      await c.query(
        `UPDATE ngo_profiles SET organization_name=COALESCE($1,organization_name), contact_person=COALESCE($2,contact_person),
           description=COALESCE($3,description), address=COALESCE($4,address), city=COALESCE($5,city),
           latitude=COALESCE($6,latitude), longitude=COALESCE($7,longitude),
           preferred_food_types=COALESCE($8,preferred_food_types), capacity=COALESCE($9,capacity) WHERE user_id=$10`,
        [b.organization_name, b.contact_person, b.description, b.address, b.city, b.latitude, b.longitude, b.preferred_food_types, b.capacity, uid]);
    }
  });
  res.json({ user: await loadUser(uid) });
});

module.exports = { register, login, me, updateProfile, registerSchema, loginSchema, profileSchema, FOOD_TYPES, ORG_TYPES };
