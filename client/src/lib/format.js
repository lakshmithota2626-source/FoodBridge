export const FOOD_TYPES = ['Vegetarian', 'Non-Vegetarian', 'Bread', 'Fruits', 'Vegetables', 'Packaged Food', 'Meals', 'Other'];
export const UNITS = ['meals', 'kg', 'packets', 'boxes', 'plates', 'liters'];
export const ORG_TYPES = ['Restaurant', 'Hostel', 'Function Hall', 'College Canteen', 'Hotel', 'Other'];
export const STATUSES = ['AVAILABLE', 'CLAIMED', 'PICKED_UP', 'EXPIRED', 'CANCELLED'];

export const homePath = (role) => ({ DONOR: '/donor/dashboard', NGO: '/ngo/dashboard', ADMIN: '/admin/dashboard' }[role] || '/login');

export const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '—';
export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : '—');
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtNum = (n) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 1 });
export const qty = (d) => `${fmtNum(d.quantity)} ${d.unit}`;

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

/** "ends in 2h 10m" / "closed" */
export function timeLeft(d) {
  const ms = new Date(d) - Date.now();
  if (ms <= 0) return 'closed';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ${m % 60}m left` : `${Math.floor(h / 24)}d left`;
}

export const ago = (d) => {
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
};

/** <input type="datetime-local"> helpers */
export const toLocalInput = (d) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
export const inHours = (h) => toLocalInput(new Date(Date.now() + h * 3600e3));
export const toISO = (local) => (local ? new Date(local).toISOString() : '');
