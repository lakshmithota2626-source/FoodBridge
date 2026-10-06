/**
 * End-to-end API tests. Needs a running server + seeded DB:
 *   npm run migrate && npm run seed && npm run dev      (terminal 1)
 *   npm test                                              (terminal 2)
 * API_URL defaults to http://localhost:5000/api
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');

const API = process.env.API_URL || 'http://localhost:5000/api';
const PW = 'Demo@1234';

async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + path, { method, headers, body: form || (body ? JSON.stringify(body) : undefined) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
const login = async (email) => (await call('POST', '/auth/login', { body: { email, password: PW } })).data.token;
const donationForm = (over = {}) => {
  const f = new FormData();
  const v = {
    food_name: `Test Meals ${Date.now()}`, food_type: 'Vegetarian', quantity: 50, unit: 'meals', pickup_address: '12, 5th Block, Koramangala',
    city: 'Bengaluru', latitude: 12.9526, longitude: 77.6061,
    pickup_start: new Date(Date.now() + 30 * 60e3).toISOString(), pickup_end: new Date(Date.now() + 4 * 3600e3).toISOString(),
    consume_before: new Date(Date.now() + 5 * 3600e3).toISOString(), ...over,
  };
  Object.entries(v).forEach(([k, x]) => f.append(k, String(x)));
  return f;
};

let donor, ngo, admin, donationId, claimId;

test('registration validates input and rejects duplicates', async () => {
  const bad = await call('POST', '/auth/register', { body: { role: 'DONOR', email: 'nope' } });
  assert.equal(bad.status, 400);
  const dup = await call('POST', '/auth/register', { body: { role: 'DONOR', name: 'Dup', email: 'donor@foodbridge.demo', password: 'Passw0rd!', phone: '9999999999', address: 'Somewhere 1', city: 'Bengaluru', latitude: 12.9, longitude: 77.5, organization_name: 'Dup Org' } });
  assert.equal(dup.status, 409);
});

test('login works, wrong password fails, protected route needs token', async () => {
  assert.equal((await call('POST', '/auth/login', { body: { email: 'donor@foodbridge.demo', password: 'wrong-pass' } })).status, 401);
  donor = await login('donor@foodbridge.demo'); ngo = await login('ngo@foodbridge.demo'); admin = await login('admin@foodbridge.demo');
  assert.ok(donor && ngo && admin);
  assert.equal((await call('GET', '/auth/me')).status, 401);
  const me = await call('GET', '/auth/me', { token: donor });
  assert.equal(me.data.user.role, 'DONOR');
  assert.equal(me.data.user.password, undefined);
});

test('role authorization is enforced', async () => {
  assert.equal((await call('POST', '/donations', { token: ngo, form: donationForm() })).status, 403);
  assert.equal((await call('GET', '/admin/analytics', { token: donor })).status, 403);
  assert.equal((await call('POST', '/donations/1/claim', { token: donor })).status, 403);
});

test('donor creates, edits a donation; validation rejects bad times', async () => {
  const bad = await call('POST', '/donations', { token: donor, form: donationForm({ quantity: -5 }) });
  assert.equal(bad.status, 400);
  const badTime = await call('POST', '/donations', { token: donor, form: donationForm({ consume_before: new Date(Date.now()).toISOString() }) });
  assert.equal(badTime.status, 400);
  const ok = await call('POST', '/donations', { token: donor, form: donationForm() });
  assert.equal(ok.status, 201);
  donationId = ok.data.donation.id;
  assert.equal(ok.data.donation.status, 'AVAILABLE');
  const edit = await call('PUT', `/donations/${donationId}`, { token: donor, form: donationForm({ food_name: 'Edited Meals', quantity: 60 }) });
  assert.equal(edit.status, 200);
  assert.equal(edit.data.donation.quantity, 60);
});

test('NGO search, filters and match score', async () => {
  const r = await call('GET', '/donations?food_type=Vegetarian&q=Edited&sort=match', { token: ngo });
  assert.equal(r.status, 200);
  const d = r.data.donations.find((x) => x.id === donationId);
  assert.ok(d, 'donation found by search');
  assert.ok(d.match.score >= 0 && d.match.score <= 100);
  assert.ok(typeof d.distance_km === 'number');
  assert.equal((await call('GET', '/ngo/recommendations', { token: ngo })).status, 200);
  assert.equal((await call('GET', '/ngo/donations/nearby?radius=15', { token: ngo })).status, 200);
});

test('claiming: first wins, second NGO is blocked (no duplicate claims)', async () => {
  const hope = await login('hope@foodbridge.demo');
  const [a, b] = await Promise.all([
    call('POST', `/donations/${donationId}/claim`, { token: ngo }),
    call('POST', `/donations/${donationId}/claim`, { token: hope }),
  ]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  claimId = (a.status === 201 ? a : b).data.claim.id;
  const winnerToken = a.status === 201 ? ngo : hope;
  ngo = winnerToken; // the winner continues the flow
});

test('donor sees CLAIMED + NGO name; cancel now blocked; invalid transitions rejected', async () => {
  const d = await call('GET', `/donations/${donationId}`, { token: donor });
  assert.equal(d.data.donation.status, 'CLAIMED');
  assert.ok(d.data.donation.ngo_name);
  assert.equal((await call('DELETE', `/donations/${donationId}`, { token: donor })).status, 409);
  assert.equal((await call('PUT', `/donations/${donationId}`, { token: donor, form: donationForm() })).status, 409);
});

test('QR pickup verification completes once and notifies the donor', async () => {
  const qr = await call('GET', `/donations/${donationId}/pickup-code`, { token: donor });
  assert.equal(qr.status, 200);
  assert.ok(qr.data.code.length >= 20);
  const wrong = await call('POST', `/claims/${claimId}/verify-pickup`, { token: ngo, body: { code: 'not-a-valid-pickup-code' } });
  assert.equal(wrong.status, 400);
  const p = await call('POST', `/claims/${claimId}/verify-pickup`, { token: ngo, body: { code: qr.data.code } });
  assert.equal(p.status, 200);
  assert.equal((await call('POST', `/claims/${claimId}/verify-pickup`, { token: ngo, body: { code: qr.data.code } })).status, 409);
  const d = await call('GET', `/donations/${donationId}`, { token: donor });
  assert.equal(d.data.donation.status, 'PICKED_UP');
  const n = await call('GET', '/notifications', { token: donor });
  assert.ok(n.data.notifications.some((x) => x.donation_id === donationId && x.type === 'PICKED_UP'));
  const first = n.data.notifications.find((x) => !x.is_read);
  if (first) assert.equal((await call('PUT', `/notifications/${first.id}/read`, { token: donor })).status, 200);
});

test('donor can review a picked-up donation once', async () => {
  const r = await call('POST', '/reviews', { token: donor, body: { donation_id: donationId, rating: 5, comment: 'Great' } });
  assert.equal(r.status, 201);
  assert.equal((await call('POST', '/reviews', { token: donor, body: { donation_id: donationId, rating: 4 } })).status, 409);
});

test('donor can cancel an AVAILABLE donation', async () => {
  const c = await call('POST', '/donations', { token: donor, form: donationForm() });
  const del = await call('DELETE', `/donations/${c.data.donation.id}`, { token: donor });
  assert.equal(del.status, 200);
});

test('admin analytics reflect real data', async () => {
  const a = await call('GET', '/admin/analytics', { token: admin });
  assert.equal(a.status, 200);
  assert.ok(a.data.totals.total_donations >= 1);
  assert.ok(Number(a.data.totals.meals_rescued) >= 60);
  assert.ok(a.data.charts.donations_over_time.length === 30);
  assert.equal((await call('GET', '/admin/users', { token: admin })).status, 200);
  assert.equal((await call('GET', '/admin/reports', { token: admin })).status, 200);
});

test('only an admin can change a user verification status', async () => {
  const me = await call('GET', '/auth/me', { token: donor });
  assert.equal((await call('PUT', `/admin/users/${me.data.user.id}/verification`, { token: donor, body: { verification_status: 'VERIFIED' } })).status, 403);
  const verified = await call('PUT', `/admin/users/${me.data.user.id}/verification`, { token: admin, body: { verification_status: 'VERIFIED' } });
  assert.equal(verified.status, 200);
  assert.equal(verified.data.user.verification_status, 'VERIFIED');
});
