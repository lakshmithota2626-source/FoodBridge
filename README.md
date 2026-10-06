# FoodBridge

> **Rescue Food. Connect Communities. Reduce Waste.**

FoodBridge is a full-stack surplus-food donation platform. Restaurants, hostels, function halls and canteens post food they can't use; nearby NGOs discover it, claim it and collect it — with every step tracked.

## Problem

Surplus cooked food is thrown away every day while shelters and community kitchens nearby struggle to feed people. There is no simple, shared place to say *"we have 50 meals ready at 7 PM"* and have the right NGO say *"we'll take them."*

## Solution

```
DONOR → Create donation → AVAILABLE → NGO discovers → NGO CLAIMS → CLAIMED → NGO collects → PICKED_UP → History
                                 └── unclaimed past its window → EXPIRED          └── donor cancels (only while AVAILABLE) → CANCELLED
```

## Features

| Area | What works |
|---|---|
| **Auth** | Register (Donor / NGO), login, JWT, bcrypt-hashed passwords, role-based route + API protection, profile management |
| **Donor** | Create/edit/cancel donations, image upload (Cloudinary), map pin, dashboard stats, history, see which NGO claimed, review the NGO after pickup |
| **NGO** | Search, filter (type, city, distance, quantity, pickup time, status), sort, list + map view, Smart Matching, claim with confirmation, mark picked up, history, impact stats |
| **Smart Matching** | Explainable rule-based score: Distance 40% + Food type 20% + Quantity 20% + Pickup time 20%. *Not machine learning.* The breakdown is shown on every donation |
| **Claims** | DB transaction + `SELECT … FOR UPDATE` + partial unique index → two NGOs can never claim the same donation |
| **Status engine** | `AVAILABLE→CLAIMED→PICKED_UP`; invalid transitions are rejected (409). Unclaimed donations auto-expire |
| **Notifications** | Stored in Postgres: claimed, picked up, pickup reminder, expiring soon, expired, review, removal. Unread badge, mark read / mark all |
| **Admin** | Live KPIs, 5 Recharts charts, activity feed, user management (deactivate), all donations, remove fake posts, handle reports |
| **UX** | Responsive (hamburger/sidebar, tables → cards on mobile), skeleton loaders, toasts, empty/error states, confirmation modals |

## Tech stack

React 18 · Vite · Tailwind CSS 3 · React Router 6 · Axios · Lucide · Recharts · Leaflet / React-Leaflet (OpenStreetMap) — Node.js · Express · PostgreSQL (`pg`) · JWT · bcryptjs · zod · multer · Cloudinary · helmet · express-rate-limit.

## Architecture

```
foodbridge/
├── client/            React SPA  (Vercel)
│   └── src/ api/ context/ components/ lib/ pages/{donor,ngo,admin}
├── server/            Express REST API  (Render / Railway)
│   └── src/ config/ middleware/ controllers/ routes/ utils/ db/
│       tests/         end-to-end API tests (node:test)
├── database/schema.sql
├── .env.example
└── README.md
```

`Browser ──axios + JWT──▶ Express (routes → middleware → controllers) ──pg──▶ PostgreSQL`, images go to Cloudinary (only the URL is stored). A background worker in the API process runs every minute: expires old donations and sends reminders.

## Database design

`users` · `donor_profiles` · `ngo_profiles` · `donations` · `claims` · `notifications` · `reviews` · `reports` (see [`database/schema.sql`](database/schema.sql)).

- One user → one donor **or** NGO profile (`UNIQUE user_id`)
- One donor → many donations; one NGO → many claims
- One donation → one *active* claim: `CREATE UNIQUE INDEX … ON claims(donation_id) WHERE status <> 'CANCELLED'`
- `CHECK` constraints on status, quantity > 0, `pickup_end > pickup_start`
- Indexes on status, donor, city, food type, `(status, pickup_end)`, notifications by user
- Extras beyond the brief: `ngo_profiles.preferred_food_types` + `capacity` (for matching), `notifications.donation_id`, reminder flags on donations

## API

All routes are under `/api`. Everything except `public/*`, `auth/register`, `auth/login` needs `Authorization: Bearer <token>`.

| Method | Path | Role | Purpose |
|---|---|---|---|
| POST | `/auth/register` · `/auth/login` | public | Create account / log in → `{token,user}` |
| GET / PUT | `/auth/me` · `/auth/profile` | any | Current user / update profile |
| GET | `/public/stats` · `/public/featured` | public | Landing-page stats and fresh donations |
| POST | `/donations` | donor | Create (multipart, field `image`) |
| GET | `/donations` | any | Donor: own · NGO: browse + match scores · Admin: all. Query: `q, food_type, city, status, min_qty, max_distance, pickup_by, sort(match\|distance\|expiry\|quantity\|newest)` |
| GET | `/donations/:id` | any | Details (+ `match` for NGOs, reports for admin) |
| PUT | `/donations/:id` | donor | Edit (AVAILABLE only) |
| DELETE | `/donations/:id` | donor / admin | Donor cancels; admin removes |
| POST | `/donations/:id/claim` | NGO | Claim (transactional) |
| GET | `/claims` · `/claims/:id` | any | List (`?status=CLAIMED\|PICKED_UP`) / one |
| PUT | `/claims/:id/pickup` | NGO | Mark picked up |
| GET | `/ngo/donations/nearby?radius=` · `/ngo/recommendations` · `/ngo/stats` | NGO | Nearby, top matches, dashboard stats |
| GET | `/donor/stats` | donor | Dashboard stats |
| GET / PUT | `/notifications` · `/notifications/:id/read` · `/notifications/read-all` | any | Inbox, unread count |
| POST / GET | `/reviews` · `/reviews/:donationId` | donor / any | Review the NGO after pickup |
| POST | `/reports` | donor, NGO | Report a donation |
| GET | `/admin/users` · `/admin/donations` · `/admin/reports` · `/admin/analytics` | admin | Management + analytics |
| PUT | `/admin/users/:id/status` · `/admin/reports/:id` | admin | Deactivate user / resolve report |

Errors are JSON: `{ "message": "…", "details": [...] }` with proper 400/401/403/404/409 codes. Server errors never leak internals.

## Installation

**Prerequisites:** Node 18+, PostgreSQL 14+.

```bash
git clone <your-repo-url> foodbridge && cd foodbridge

# 1. database
createdb foodbridge

# 2. server
cd server
cp ../.env.example .env        # then edit DATABASE_URL and JWT_SECRET
npm install
npm run migrate                # creates tables
npm run seed                   # demo data (WIPES existing data)
npm run dev                    # http://localhost:5000

# 3. client (new terminal)
cd client
npm install
npm run dev                    # http://localhost:5173  (proxies /api to :5000)
```

### Environment variables

| Var | Where | Notes |
|---|---|---|
| `DATABASE_URL` | server | `postgresql://user:pass@host:5432/foodbridge` |
| `DB_SSL` | server | `true` for most hosted Postgres |
| `JWT_SECRET` | server | long random string (`openssl rand -hex 32`) |
| `JWT_EXPIRES_IN` | server | default `7d` |
| `CLIENT_URL` | server | allowed CORS origin(s), comma-separated |
| `PORT` | server | default `5000` |
| `CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET` | server | optional locally — without them donations save without a photo and the UI shows a food illustration |
| `VITE_API_URL` | client | production only, e.g. `https://foodbridge-api.onrender.com/api` |

Never commit `.env`.

## Demo accounts (local/demo only)

Password for all: `Demo@1234`

| Role | Email |
|---|---|
| Donor | `donor@foodbridge.demo` (Green Leaf Restaurant) |
| NGO | `ngo@foodbridge.demo` (Helping Hands NGO) |
| Admin | `admin@foodbridge.demo` |

Seed also adds 3 more donors, 2 more NGOs, the five sample donations (50 Vegetarian Meals, 30 Bread Packets, 25 Fruit Boxes, 100 Meal Packets, 20 Vegetable Boxes), 16 days of history for the charts, a review and a report. **Do not seed or use these passwords in production.**

## 3–5 minute demo script

1. Log in as **donor** → *Create Donation* → "Vegetarian Meals", 50 meals, pickup ending ~7 PM → *Publish*.
2. Log out → log in as **NGO** → *Find food* → show the card: **50 meals · distance · match %**, open it to show the map and the match breakdown.
3. *Claim* → confirm. (Optionally show a second NGO getting "already claimed".)
4. Log in as **donor** → status **CLAIMED**, NGO name, notification bell.
5. Log in as **NGO** → *Claimed* → *Mark as picked up* → confirm.
6. Log in as **admin** → dashboard: donations, meals rescued and completed pickups have increased; show charts, activity feed, reports.

## Testing

Start the API against a seeded DB, then in another terminal:

```bash
cd server && npm test
```

Covers registration validation + duplicates, login, JWT protection, role authorization, create/edit/cancel, search & match scoring, **concurrent double-claim (one 201, one 409)**, invalid transitions, pickup + notifications, reviews, admin analytics.

## Deployment

1. **Database** — create a Postgres instance (Neon, Supabase, Railway, Render). Run `schema.sql` (or `npm run migrate` with `DATABASE_URL` pointing at it). Seed only for a demo.
2. **API (Render/Railway)** — root directory `server`, build `npm install`, start `npm start`. Set the env vars above (`DB_SSL=true`, `CLIENT_URL=<your Vercel URL>`, `NODE_ENV=production`). Health check: `/api/health`.
3. **Client (Vercel)** — root directory `client`, framework Vite, set `VITE_API_URL=https://<api-host>/api`. `vercel.json` already rewrites all routes to `index.html`.
4. Free-tier APIs sleep when idle — open the API URL once before a live demo.

## Screenshots

_Add screenshots to `docs/` and link them here:_ landing page · donor dashboard · create donation · NGO match cards · donation detail with map · admin analytics.

## Future improvements

Email/SMS/WhatsApp notifications and web push · real-time updates (WebSockets) · NGO volunteer routing and pickup ETAs · route optimisation for multi-pickup trips · recurring donations for regular donors · NGO verification workflow · multi-language UI · mobile app (React Native) · matching tuned from real claim history.
