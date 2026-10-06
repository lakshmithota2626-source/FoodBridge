/**
 * Smart Donation Matching — an explainable, rule-based scoring system (NOT machine learning).
 *
 *   Match = Distance 40% + Food-type 20% + Quantity 20% + Pickup-time 20%
 *
 * Every component returns 0..1 and is shown to the user with a plain-language reason.
 */
const { haversineKm } = require('./geo');

const WEIGHTS = { distance: 40, foodType: 20, quantity: 20, time: 20 };
const clamp = (n) => Math.max(0, Math.min(1, n));

function distanceScore(km) {
  if (km === null) return { s: 0.5, why: 'Location unknown' };
  // full marks within 2 km, falling linearly to 0 at 30 km
  return { s: clamp(1 - (km - 2) / 28), why: `${km.toFixed(1)} km away` };
}

function foodTypeScore(type, prefs = []) {
  if (!prefs.length) return { s: 0.7, why: 'No food preference set' };
  return prefs.includes(type) ? { s: 1, why: `${type} is in your preferred types` } : { s: 0.3, why: `${type} is outside your preferred types` };
}

function quantityScore(qty, capacity = 100) {
  if (qty <= capacity) return { s: 1, why: `Fits your capacity (${capacity})` };
  return { s: clamp(capacity / qty), why: `Larger than your usual capacity (${capacity})` };
}

function timeScore(d, now) {
  const minsToEnd = (new Date(d.pickup_end) - now) / 60000;
  const minsToStart = (new Date(d.pickup_start) - now) / 60000;
  if (minsToEnd <= 0) return { s: 0, why: 'Pickup window has closed' };
  let s = minsToEnd < 45 ? 0.3 : minsToEnd < 90 ? 0.7 : 1;
  let why = minsToEnd < 90 ? `Only ${Math.round(minsToEnd)} min of pickup window left` : 'Comfortable pickup window';
  if (minsToStart > 360) { s *= 0.8; why = 'Pickup opens several hours from now'; }
  return { s, why };
}

function computeMatch(donation, ngo, now = new Date()) {
  const km = haversineKm(ngo?.latitude, ngo?.longitude, donation.latitude, donation.longitude);
  const parts = {
    distance: distanceScore(km),
    foodType: foodTypeScore(donation.food_type, ngo?.preferred_food_types || []),
    quantity: quantityScore(donation.quantity, ngo?.capacity || 100),
    time: timeScore(donation, now),
  };
  const total = Object.entries(parts).reduce((sum, [k, v]) => sum + v.s * WEIGHTS[k], 0);
  const score = Math.round(total);
  return {
    distance_km: km === null ? null : Math.round(km * 10) / 10,
    match: {
      score,
      recommended: score >= 80,
      breakdown: Object.fromEntries(
        Object.entries(parts).map(([k, v]) => [k, { weight: WEIGHTS[k], score: Math.round(v.s * 100), reason: v.why }])
      ),
    },
  };
}

module.exports = { computeMatch, WEIGHTS };
