/** Demo data. Run:  npm run migrate && npm run seed     (wipes existing data!) */
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const DEMO_PASSWORD = 'Demo@1234'; // local/demo only
const H = 3600 * 1000;
const at = (hoursFromNow) => new Date(Date.now() + hoursFromNow * H);

async function seed(pool = db.pool) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('TRUNCATE reports, reviews, notifications, claims, donations, ngo_profiles, donor_profiles, users RESTART IDENTITY CASCADE');
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

    const mkUser = async (name, email, role, phone, address, city, lat, lng, daysAgo = 20) => {
      const r = await c.query(
        `INSERT INTO users (name,email,password,phone,role,address,city,latitude,longitude,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [name, email, hash, phone, role, address, city, lat, lng, at(-24 * daysAgo)]);
      return r.rows[0].id;
    };
    const mkDonor = async (u, org, type, desc) => c.query(
      `INSERT INTO donor_profiles (user_id,organization_name,organization_type,description,address,city,latitude,longitude)
       SELECT id,$2,$3,$4,address,city,latitude,longitude FROM users WHERE id=$1`, [u, org, type, desc]);
    const mkNgo = async (u, org, person, desc, prefs, cap) => c.query(
      `INSERT INTO ngo_profiles (user_id,organization_name,contact_person,description,address,city,latitude,longitude,preferred_food_types,capacity)
       SELECT id,$2,$3,$4,address,city,latitude,longitude,$5,$6 FROM users WHERE id=$1`, [u, org, person, desc, prefs, cap]);

    const admin = await mkUser('Platform Admin', 'admin@foodbridge.demo', 'ADMIN', '+91 90000 00001', 'FoodBridge HQ', 'Bengaluru', 12.9716, 77.5946, 30);

    // Donors
    const d1 = await mkUser('Ravi Kumar', 'donor@foodbridge.demo', 'DONOR', '+91 98450 11111', '12, 5th Block, Koramangala', 'Bengaluru', 12.9526, 77.6061, 25);
    const d2 = await mkUser('Anita Rao', 'hostel@foodbridge.demo', 'DONOR', '+91 98450 22222', '44, HSR Layout Sector 2', 'Bengaluru', 12.9121, 77.6446, 22);
    const d3 = await mkUser('Imran Sheikh', 'hall@foodbridge.demo', 'DONOR', '+91 98450 33333', 'Palace Road, Vasanth Nagar', 'Bengaluru', 12.9892, 77.5870, 18);
    const d4 = await mkUser('Dr. Meera Nair', 'canteen@foodbridge.demo', 'DONOR', '+91 98450 44444', 'Tech University Campus, Indiranagar', 'Bengaluru', 12.9784, 77.6408, 15);
    await mkDonor(d1, 'Green Leaf Restaurant', 'Restaurant', 'South Indian restaurant with daily surplus meals.');
    await mkDonor(d2, 'Sunrise Boys Hostel', 'Hostel', 'Hostel mess serving 300 students.');
    await mkDonor(d3, 'Royal Palace Function Hall', 'Function Hall', 'Wedding and event venue.');
    await mkDonor(d4, 'Tech University Canteen', 'College Canteen', 'Campus canteen.');

    // NGOs
    const n1 = await mkUser('Sunita Verma', 'ngo@foodbridge.demo', 'NGO', '+91 98860 11111', 'MG Road', 'Bengaluru', 12.9716, 77.5946, 24);
    const n2 = await mkUser('Arjun Menon', 'hope@foodbridge.demo', 'NGO', '+91 98860 22222', '3rd Cross, BTM Layout', 'Bengaluru', 12.9166, 77.6101, 16);
    const n3 = await mkUser('Farah Khan', 'care@foodbridge.demo', 'NGO', '+91 98860 33333', 'Hebbal Main Road', 'Bengaluru', 13.0358, 77.5970, 10);
    await mkNgo(n1, 'Helping Hands NGO', 'Sunita Verma', 'Runs community kitchens for daily-wage workers.', ['Vegetarian', 'Meals', 'Bread'], 100);
    await mkNgo(n2, 'Hope Shelter Trust', 'Arjun Menon', 'Shelter for homeless families.', ['Meals', 'Fruits', 'Vegetables'], 150);
    await mkNgo(n3, 'Care & Share Foundation', 'Farah Khan', 'Feeds children at government schools.', [], 60);

    const mkDonation = async (donor, name, type, qty, unit, addr, hStart, hEnd, hConsume, status = 'AVAILABLE', createdH = -1, desc = null) => {
      const u = (await c.query('SELECT city, latitude, longitude FROM users WHERE id=$1', [donor])).rows[0];
      const r = await c.query(
        `INSERT INTO donations (donor_id,food_name,food_type,description,quantity,unit,pickup_address,city,latitude,longitude,pickup_start,pickup_end,consume_before,status,created_at,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15) RETURNING id`,
        [donor, name, type, desc, qty, unit, addr, u.city, u.latitude, u.longitude, at(hStart), at(hEnd), at(hConsume), status, at(createdH)]);
      return r.rows[0].id;
    };
    const mkClaim = (donation, ngo, claimedH, pickedH = null) => c.query(
      `INSERT INTO claims (donation_id,ngo_id,claimed_at,pickup_at,status,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$3,$3)`,
      [donation, ngo, at(claimedH), pickedH === null ? null : at(pickedH), pickedH === null ? 'CLAIMED' : 'PICKED_UP']);

    // ---- Live, available donations (the five from the brief) ----
    await mkDonation(d2, 'Vegetarian Meals', 'Vegetarian', 50, 'meals', '44, HSR Layout Sector 2', 0.5, 4, 5, 'AVAILABLE', -0.5, 'Rice, dal, sabzi and curd — packed in individual boxes.');
    await mkDonation(d4, 'Bread Packets', 'Bread', 30, 'packets', 'Tech University Canteen, Indiranagar', 1, 5, 8, 'AVAILABLE', -1, 'Fresh sliced bread, baked today.');
    await mkDonation(d3, 'Fruit Boxes', 'Fruits', 25, 'boxes', 'Palace Road, Vasanth Nagar', 1.5, 6, 10, 'AVAILABLE', -2, 'Seasonal fruit left over from a corporate event.');
    await mkDonation(d3, 'Meal Packets', 'Meals', 100, 'packets', 'Palace Road, Vasanth Nagar', 2, 6, 7, 'AVAILABLE', -3, 'Wedding reception surplus: pulao, paneer curry, roti.');
    await mkDonation(d1, 'Vegetable Boxes', 'Vegetables', 20, 'boxes', '12, 5th Block, Koramangala', 1, 7, 24, 'AVAILABLE', -0.2, 'Fresh vegetables from the morning delivery.');

    // ---- Donor demo account: one claimed donation awaiting pickup ----
    const claimed = await mkDonation(d1, 'Chapati & Dal Meals', 'Meals', 40, 'meals', '12, 5th Block, Koramangala', -0.5, 3, 4, 'CLAIMED', -2);
    await mkClaim(claimed, n1, -1.5);
    await c.query(`INSERT INTO notifications (user_id,donation_id,title,message,type,created_at) VALUES ($1,$2,'Donation claimed','Helping Hands NGO has claimed your 40 meals donation "Chapati & Dal Meals".','CLAIMED',$3)`, [d1, claimed, at(-1.5)]);
    await c.query(`INSERT INTO notifications (user_id,donation_id,title,message,type,created_at) VALUES ($1,$2,'Claim confirmed','You claimed "Chapati & Dal Meals". Collect it between the pickup times shown on the donation.','CLAIM_CONFIRMED',$3)`, [n1, claimed, at(-1.5)]);

    // ---- History: ~14 days of past donations so charts and impact stats are real ----
    const donors = [d1, d2, d3, d4];
    const ngos = [n1, n2, n3];
    const kinds = [['Vegetarian Meals', 'Vegetarian', 'meals'], ['Bread Packets', 'Bread', 'packets'], ['Fruit Boxes', 'Fruits', 'boxes'],
      ['Meal Packets', 'Meals', 'packets'], ['Vegetable Boxes', 'Vegetables', 'boxes'], ['Rice & Curry', 'Non-Vegetarian', 'meals']];
    let firstPicked = null;
    for (let i = 1; i <= 16; i++) {
      const donor = donors[i % 4];
      const [name, type, unit] = kinds[i % 6];
      const qty = 15 + ((i * 11) % 60);
      const createdH = -24 * i;
      const status = i % 7 === 0 ? 'CANCELLED' : i % 5 === 0 ? 'EXPIRED' : 'PICKED_UP';
      const id = await mkDonation(donor, name, type, qty, unit, 'Pickup point', createdH + 1, createdH + 5, createdH + 8, status, createdH);
      if (status === 'PICKED_UP') {
        await mkClaim(id, ngos[i % 3], createdH + 2, createdH + 4);
        firstPicked = firstPicked || { id, donor, ngo: ngos[i % 3] };
      }
    }
    // a review + a report for the demo
    await c.query(`INSERT INTO reviews (donor_id,ngo_id,donation_id,rating,comment) VALUES ($1,$2,$3,5,'Very punctual and polite team. Thank you!')`, [firstPicked.donor, firstPicked.ngo, firstPicked.id]);
    const sample = (await c.query(`SELECT id FROM donations WHERE status='AVAILABLE' ORDER BY id LIMIT 1`)).rows[0].id;
    await c.query(`INSERT INTO reports (reported_by,donation_id,reason) VALUES ($1,$2,'Quantity seems unusually high for this venue — please verify.')`, [n2, sample]);

    await c.query('COMMIT');
    console.log('✔ Seed complete. Demo logins (password: ' + DEMO_PASSWORD + '):');
    console.log('   donor@foodbridge.demo | ngo@foodbridge.demo | admin@foodbridge.demo');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
  }
}

if (require.main === module) {
  seed()
    .then(() => db.pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { seed, DEMO_PASSWORD };
