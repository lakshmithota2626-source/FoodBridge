const db = require('../config/db');
const notify = require('./notify');

/** Move unclaimed donations whose window has passed to EXPIRED. Safe to call often. */
async function expireDonations() {
  const { rows } = await db.query(
    `UPDATE donations SET status='EXPIRED', updated_at=NOW()
     WHERE status='AVAILABLE' AND (pickup_end < NOW() OR consume_before < NOW())
     RETURNING id, donor_id, food_name`
  );
  for (const d of rows) {
    await notify(db, {
      userId: d.donor_id, donationId: d.id, type: 'EXPIRED', title: 'Donation expired',
      message: `Your donation "${d.food_name}" expired before an NGO could claim it.`,
    });
  }
  return rows.length;
}

async function sendReminders() {
  // 1. Unclaimed food that will expire within the hour
  const warn = await db.query(
    `UPDATE donations SET expiry_warned=TRUE
     WHERE status='AVAILABLE' AND expiry_warned=FALSE AND LEAST(pickup_end, consume_before) <= NOW() + INTERVAL '60 minutes'
     RETURNING id, donor_id, food_name`
  );
  for (const d of warn.rows) {
    await notify(db, {
      userId: d.donor_id, donationId: d.id, type: 'EXPIRY_WARNING', title: 'Expiring soon',
      message: `Urgent: "${d.food_name}" expires within the hour and has not been claimed.`,
    });
  }

  // 2. Claimed donations whose pickup window opens within the hour (or is already open)
  const rem = await db.query(
    `SELECT d.id, d.donor_id, d.food_name, d.pickup_start, d.pickup_end, c.ngo_id
     FROM donations d JOIN claims c ON c.donation_id=d.id AND c.status='CLAIMED'
     WHERE d.status='CLAIMED' AND d.reminder_sent=FALSE
       AND d.pickup_start <= NOW() + INTERVAL '60 minutes' AND d.pickup_end > NOW()`
  );
  for (const d of rem.rows) {
    const toStart = Math.round((new Date(d.pickup_start) - Date.now()) / 60000);
    const toEnd = Math.round((new Date(d.pickup_end) - Date.now()) / 60000);
    const when = toStart > 0 ? `opens in ${toStart} min` : `is open now and closes in ${toEnd} min`;
    for (const userId of [d.donor_id, d.ngo_id]) {
      await notify(db, {
        userId, donationId: d.id, type: 'PICKUP_REMINDER', title: 'Pickup reminder',
        message: `Pickup reminder: the pickup window for "${d.food_name}" ${when}.`,
      });
    }
    await db.query('UPDATE donations SET reminder_sent=TRUE WHERE id=$1', [d.id]);
  }
}

function startJobs() {
  const run = () => expireDonations().then(sendReminders).catch((e) => console.error('[jobs]', e.message));
  run();
  return setInterval(run, 60 * 1000);
}

module.exports = { expireDonations, sendReminders, startJobs };
