const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const env = require('../config/env');
const AppError = require('../utils/AppError');

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp']; // .jpg .jpeg .png .webp
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    ALLOWED.includes(file.mimetype) ? cb(null, true) : cb(new AppError(400, 'Only JPG, PNG or WEBP images are allowed')),
});

const configured = Boolean(env.cloudinary.cloud_name && env.cloudinary.api_key && env.cloudinary.api_secret);
if (configured) cloudinary.config({ ...env.cloudinary, secure: true });

/** Uploads a buffer to Cloudinary and returns the URL. Returns null when Cloudinary isn't configured (local dev). */
function uploadToCloudinary(buffer) {
  if (!configured) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder: 'foodbridge', resource_type: 'image' }, (err, result) => (err ? reject(err) : resolve(result.secure_url)))
      .end(buffer);
  });
}

module.exports = { upload, uploadToCloudinary, cloudinaryConfigured: configured };
