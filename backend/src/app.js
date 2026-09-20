const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const locationRoutes = require('./routes/locationRoutes');
const tripRoutes = require('./routes/tripRoutes');
const busRoutes = require('./routes/busRoutes');
const studentRoutes = require('./routes/studentRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'tripzo-live-tracking-backend',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/students', studentRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
