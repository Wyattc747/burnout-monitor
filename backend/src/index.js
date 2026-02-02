const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const alertRoutes = require('./routes/alerts');
const notificationRoutes = require('./routes/notifications');
const demoRoutes = require('./routes/demo');
const integrationsRoutes = require('./routes/integrations');
const profileRoutes = require('./routes/profile');
const personalizationRoutes = require('./routes/personalization');
const teamsRoutes = require('./routes/teams');
const wellnessRoutes = require('./routes/wellness');
const chatRoutes = require('./routes/chat');
const goalsRoutes = require('./routes/goals');
const challengesRoutes = require('./routes/challenges');

const app = express();
const PORT = process.env.PORT || 3001;

// SECURITY: Restrict CORS to allowed origins
const allowedOrigins = [
  'http://localhost:3000',
  'https://theshepherd.io',
  'https://www.theshepherd.io',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// SECURITY: Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  message: { error: 'Too Many Requests', message: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: General rate limiting
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too Many Requests', message: 'Rate limit exceeded' },
});

app.use(generalLimiter);
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/personalization', personalizationRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/wellness', wellnessRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/challenges', challengesRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: `Route ${req.path} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation Error', message: err.message });
  }

  res.status(err.status || 500).json({
    error: err.name || 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`ShepHerd API running on http://localhost:${PORT}`);
});

module.exports = app;
