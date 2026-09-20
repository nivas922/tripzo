const express = require('express');
const cors = require('cors');
const path = require('path');
const YAML = require('yamljs');
const swaggerUi = require('swagger-ui-express');

const JwtAuthProvider = require('./modules/auth/JwtAuthProvider');
const createAuthRoutes = require('./modules/auth/authRoutes');
const createTrackingRoutes = require('./modules/tracking/routes/trackingRoutes');
const defaultSocketManager = require('./sockets/socketManager');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

function createApp({ authProvider, socketManager } = {}) {
  const app = express();
  const activeAuthProvider = authProvider || new JwtAuthProvider();
  const activeSocketManager = socketManager || defaultSocketManager;

  // Basic middleware
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'tripzo-live-tracking-modular',
      timestamp: new Date().toISOString(),
    });
  });

  // OpenAPI 3.0 Documentation & Swagger UI
  try {
    const openapiDocPath = path.join(__dirname, '../docs/openapi.yaml');
    const swaggerDocument = YAML.load(openapiDocPath);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    app.get('/api/docs.json', (req, res) => res.json(swaggerDocument));
  } catch (err) {
    console.warn('[App] Could not load OpenAPI docs:', err.message);
  }

  // Pluggable Auth Module (Standalone Mode)
  const authRoutes = createAuthRoutes(activeAuthProvider);
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/auth', authRoutes); // Backwards compatibility alias

  // Phase 2 & 3: Fleet, Route, Student Management CRUD & Trip Lifecycle
  const busRoutes = require('./routes/busRoutes');
  const routeRoutes = require('./routes/routeRoutes');
  const studentRoutes = require('./routes/studentRoutes');
  const driverRoutes = require('./routes/driverRoutes');
  const tripRoutes = require('./routes/tripRoutes');

  app.use('/api/buses', busRoutes);
  app.use('/api/routes', routeRoutes);
  app.use('/api/students', studentRoutes);
  app.use('/api/drivers', driverRoutes);
  app.use('/api/trips', tripRoutes);

  // Self-Contained Tracking Module
  const trackingRoutes = createTrackingRoutes({
    authProvider: activeAuthProvider,
    socketManager: activeSocketManager,
  });
  // Modular Tracking endpoints
  app.use('/api/v1/tracking', trackingRoutes);
  app.use('/api/tracking', trackingRoutes);
  // Direct /api mount for root endpoints (/api/location/ping, /api/trips/start, etc.)
  app.use('/api', trackingRoutes);

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const defaultApp = createApp();

module.exports = defaultApp;
module.exports.createApp = createApp;
