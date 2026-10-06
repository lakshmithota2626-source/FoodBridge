-- FoodBridge PostgreSQL schema (idempotent)
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  phone       VARCHAR(20),
  role        VARCHAR(10)  NOT NULL CHECK (role IN ('DONOR','NGO','ADMIN')),
  address     TEXT,
  city        VARCHAR(100),
  latitude    DOUBLE PRECISION,
  longitude   DOUBLE PRECISION,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  verification_status VARCHAR(12) NOT NULL DEFAULT 'UNVERIFIED'
              CHECK (verification_status IN ('UNVERIFIED','PENDING','VERIFIED','REJECTED')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Kept separately so existing installations can be upgraded by re-running schema.sql.
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status VARCHAR(12) NOT NULL DEFAULT 'UNVERIFIED';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_verification_status_check;
ALTER TABLE users ADD CONSTRAINT users_verification_status_check
  CHECK (verification_status IN ('UNVERIFIED','PENDING','VERIFIED','REJECTED'));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS donor_profiles (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  organization_name VARCHAR(150) NOT NULL,
  organization_type VARCHAR(50)  NOT NULL DEFAULT 'Other',
  description       TEXT,
  address           TEXT,
  city              VARCHAR(100),
  latitude          DOUBLE PRECISION,
  longitude         DOUBLE PRECISION,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ngo_profiles (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  organization_name    VARCHAR(150) NOT NULL,
  contact_person       VARCHAR(100),
  description          TEXT,
  address              TEXT,
  city                 VARCHAR(100),
  latitude             DOUBLE PRECISION,
  longitude            DOUBLE PRECISION,
  preferred_food_types TEXT[] NOT NULL DEFAULT '{}',   -- used by Smart Matching
  capacity             INTEGER NOT NULL DEFAULT 100,    -- typical servings the NGO can take per pickup
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS donations (
  id             SERIAL PRIMARY KEY,
  donor_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_name      VARCHAR(150) NOT NULL,
  food_type      VARCHAR(30)  NOT NULL CHECK (food_type IN
                 ('Vegetarian','Non-Vegetarian','Bread','Fruits','Vegetables','Packaged Food','Meals','Other')),
  description    TEXT,
  quantity       DOUBLE PRECISION NOT NULL CHECK (quantity > 0),
  unit           VARCHAR(20) NOT NULL DEFAULT 'meals',
  image_url      TEXT,
  pickup_address TEXT NOT NULL,
  city           VARCHAR(100) NOT NULL,
  latitude       DOUBLE PRECISION NOT NULL,
  longitude      DOUBLE PRECISION NOT NULL,
  pickup_start   TIMESTAMPTZ NOT NULL,
  pickup_end     TIMESTAMPTZ NOT NULL,
  consume_before TIMESTAMPTZ NOT NULL,
  status         VARCHAR(12) NOT NULL DEFAULT 'AVAILABLE'
                 CHECK (status IN ('AVAILABLE','CLAIMED','PICKED_UP','EXPIRED','CANCELLED')),
  reminder_sent  BOOLEAN NOT NULL DEFAULT FALSE,
  expiry_warned  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (pickup_end > pickup_start),
  CHECK (consume_before >= pickup_start)
);
CREATE INDEX IF NOT EXISTS idx_donations_status     ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_donor      ON donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_city       ON donations(LOWER(city));
CREATE INDEX IF NOT EXISTS idx_donations_type       ON donations(food_type);
CREATE INDEX IF NOT EXISTS idx_donations_status_end ON donations(status, pickup_end);

CREATE TABLE IF NOT EXISTS claims (
  id          SERIAL PRIMARY KEY,
  donation_id INTEGER NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  ngo_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pickup_at   TIMESTAMPTZ,                       -- set when the NGO marks the food as picked up
  status      VARCHAR(12) NOT NULL DEFAULT 'CLAIMED' CHECK (status IN ('CLAIMED','PICKED_UP','CANCELLED')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Database-level guarantee: a donation can never have two live claims.
CREATE UNIQUE INDEX IF NOT EXISTS uq_claims_one_active_per_donation
  ON claims(donation_id) WHERE status <> 'CANCELLED';
CREATE INDEX IF NOT EXISTS idx_claims_ngo ON claims(ngo_id);

-- The encrypted token is retained only until pickup so the donor can re-open the QR
-- code. Verification itself uses the hash; raw codes are never used as identifiers.
CREATE TABLE IF NOT EXISTS pickup_verifications (
  id               SERIAL PRIMARY KEY,
  claim_id         INTEGER NOT NULL UNIQUE REFERENCES claims(id) ON DELETE CASCADE,
  token_hash       VARCHAR(128) NOT NULL,
  token_ciphertext TEXT NOT NULL,
  expires_at       TIMESTAMPTZ NOT NULL,
  used_at          TIMESTAMPTZ,
  verified_by      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  donation_id INTEGER REFERENCES donations(id) ON DELETE CASCADE,
  title       VARCHAR(150) NOT NULL,
  message     TEXT NOT NULL,
  type        VARCHAR(30) NOT NULL DEFAULT 'INFO',
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS reviews (
  id          SERIAL PRIMARY KEY,
  donor_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ngo_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  donation_id INTEGER NOT NULL UNIQUE REFERENCES donations(id) ON DELETE CASCADE,
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id          SERIAL PRIMARY KEY,
  reported_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  donation_id INTEGER NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  status      VARCHAR(12) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','DISMISSED')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (reported_by, donation_id)
);
