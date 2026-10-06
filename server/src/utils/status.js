const AppError = require('./AppError');

const TRANSITIONS = {
  AVAILABLE: ['CLAIMED', 'EXPIRED', 'CANCELLED'],
  CLAIMED: ['PICKED_UP'],
  PICKED_UP: [],
  EXPIRED: [],
  CANCELLED: [],
};

function assertTransition(from, to) {
  if (!TRANSITIONS[from]?.includes(to)) {
    throw new AppError(409, `Invalid status change: ${from} → ${to} is not allowed`);
  }
}
module.exports = { TRANSITIONS, assertTransition };
