/** `db` can be the pool or a transaction client — both expose .query(). */
async function notify(db, { userId, title, message, type = 'INFO', donationId = null }) {
  await db.query(
    'INSERT INTO notifications (user_id, donation_id, title, message, type) VALUES ($1,$2,$3,$4,$5)',
    [userId, donationId, title, message, type]
  );
}
module.exports = notify;
