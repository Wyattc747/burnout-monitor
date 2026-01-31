const express = require('express');
const cors = require('cors');
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

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
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
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/demo', demoRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/personalization', personalizationRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/wellness', wellnessRoutes);

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
  console.log(`Herd Shepherd API running on http://localhost:${PORT}`);
});

module.exports = app;
