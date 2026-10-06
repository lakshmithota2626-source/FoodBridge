const router = require('express').Router();
const { authenticateUser, requireDonor, requireNGO, requireAdmin, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { upload } = require('../middleware/upload');
const auth = require('../controllers/authController');
const donation = require('../controllers/donationController');
const claim = require('../controllers/claimController');
const role = require('../controllers/roleController');
const misc = require('../controllers/miscController');
const admin = require('../controllers/adminController');

router.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Public
router.get('/public/stats', donation.publicStats);
router.get('/public/featured', donation.featured);

// Auth
router.post('/auth/register', validate(auth.registerSchema), auth.register);
router.post('/auth/login', validate(auth.loginSchema), auth.login);
router.get('/auth/me', authenticateUser, auth.me);
router.put('/auth/profile', authenticateUser, validate(auth.profileSchema), auth.updateProfile);

// Everything below requires a valid token
router.use(authenticateUser);

// Donations
router.post('/donations', requireDonor, upload.single('image'), validate(donation.donationSchema), donation.create);
router.get('/donations', donation.list);
router.get('/donations/:id', donation.getOne);
router.get('/donations/:id/pickup-code', requireDonor, donation.pickupCode);
router.put('/donations/:id', requireDonor, upload.single('image'), validate(donation.donationSchema), donation.update);
router.delete('/donations/:id', requireRole('DONOR', 'ADMIN'), donation.remove);

// Claims
router.post('/donations/:id/claim', requireNGO, claim.claim);
router.get('/claims', claim.list);
router.get('/claims/:id', claim.getOne);
router.put('/claims/:id/pickup', requireNGO, claim.pickup);
router.post('/claims/:id/verify-pickup', requireNGO, validate(claim.verifyPickupSchema), claim.verifyPickup);

// Role dashboards
router.get('/donor/stats', requireDonor, role.donorStats);
router.get('/ngo/stats', requireNGO, role.ngoStats);
router.get('/ngo/donations/nearby', requireNGO, role.nearby);
router.get('/ngo/recommendations', requireNGO, role.recommendations);

// Notifications
router.get('/notifications', misc.listNotifications);
router.put('/notifications/read-all', misc.markAllRead);
router.put('/notifications/:id/read', misc.markRead);

// Reviews & reports
router.post('/reviews', requireDonor, validate(misc.reviewSchema), misc.createReview);
router.get('/reviews/:donationId', misc.getReview);
router.post('/reports', requireRole('DONOR', 'NGO'), validate(misc.reportSchema), misc.createReport);

// Admin
router.get('/admin/users', requireAdmin, admin.users);
router.put('/admin/users/:id/status', requireAdmin, validate(admin.statusSchema), admin.setUserStatus);
router.put('/admin/users/:id/verification', requireAdmin, validate(admin.verificationSchema), admin.setVerification);
router.get('/admin/donations', requireAdmin, admin.donations);
router.get('/admin/reports', requireAdmin, admin.reports);
router.put('/admin/reports/:id', requireAdmin, validate(admin.reportStatusSchema), admin.setReportStatus);
router.get('/admin/analytics', requireAdmin, admin.analytics);

module.exports = router;
