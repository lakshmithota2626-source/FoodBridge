const { ZodError } = require('zod');
const multer = require('multer');
const env = require('../config/env');

const notFound = (req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return res.status(400).json({ message: details[0]?.message || 'Validation failed', details });
  }
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : err.message;
    return res.status(400).json({ message });
  }
  if (err.isOperational) return res.status(err.status).json({ message: err.message, details: err.details });
  if (err.code === '23505') return res.status(409).json({ message: 'That record already exists' });
  if (err.code === '23503') return res.status(400).json({ message: 'Referenced record does not exist' });
  if (err.code === '23514') return res.status(400).json({ message: 'Some values are not allowed' });

  console.error('[error]', err);
  res.status(500).json({
    message: 'Something went wrong on our side. Please try again.',
    error: err.message,
    code: err.code,
    detail: err.detail,
  });
};
module.exports = { notFound, errorHandler };
