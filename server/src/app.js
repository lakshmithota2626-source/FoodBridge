const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
// Production uses one origin: Express serves both the SPA and its /api routes.
// CORS is therefore only needed for the separate Vite dev server.
if (env.nodeEnv !== 'production') {
  app.use(cors({
    origin: (origin, cb) => (!origin || env.clientUrls.includes(origin) ? cb(null, true) : cb(new Error('Origin not allowed by CORS'))),
    credentials: true,
  }));
}
app.use(express.json({ limit: '100kb' }));

app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false }));
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: env.nodeEnv === 'production' ? 25 : 500, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many attempts. Please wait a few minutes and try again.' },
});
app.use(['/api/auth/login', '/api/auth/register'], authLimiter);

app.use('/api', routes);
// Keep invalid API paths as JSON errors; never let the SPA fallback handle them.
app.use('/api', notFound);

// API routes must remain above this point. Serve the compiled Vite SPA only
// after APIs, so unknown /api requests still receive the JSON 404 below.
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
app.use(notFound);
app.use(errorHandler);

module.exports = app;
