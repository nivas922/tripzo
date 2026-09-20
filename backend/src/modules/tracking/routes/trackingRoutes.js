const express = require('express');
const createAuthMiddleware = require('../../auth/authMiddleware');
const createDeviceOrDriverAuth = require('../middleware/deviceOrDriverAuth');
const createLocationController = require('../controllers/locationController');
const createTripController = require('../controllers/tripController');
const busController = require('../controllers/busController');
const studentController = require('../controllers/studentController');

/**
 * Creates the complete Tracking Module router.
 * 
 * @param {Object} options
 * @param {import('../../auth/AuthProvider')} options.authProvider - Pluggable AuthProvider
 * @param {Object} options.socketManager - Tracking WebSocket manager for fan-out
 * @returns {express.Router}
 */
function createTrackingRoutes({ authProvider, socketManager } = {}) {
  const router = express.Router();
  const { requireAuth, requireRoles } = createAuthMiddleware(authProvider);
  const authenticateDeviceOrDriver = createDeviceOrDriverAuth(authProvider);

  const locationController = createLocationController(socketManager);
  const tripController = createTripController(socketManager);

  // --- Location Telemetry Endpoints (Source-Agnostic) ---
  router.post('/location/update', authenticateDeviceOrDriver, locationController.ping);
  router.post('/location/ping', authenticateDeviceOrDriver, locationController.ping);
  router.post('/location/batch', authenticateDeviceOrDriver, locationController.batch);

  // --- Trip Lifecycle Endpoints ---
  router.post('/trips/start', requireAuth, requireRoles('driver', 'admin'), tripController.startTrip);
  router.post('/trips/end', requireAuth, requireRoles('driver', 'admin'), tripController.endTrip);
  router.get('/trips/active', requireAuth, tripController.getActiveTrip);
  router.get('/trips/current', requireAuth, tripController.getActiveTrip);

  // --- Bus Live Query (Student Isolation & Driver Phone Sanitization) ---
  router.get('/buses/:id/live', requireAuth, busController.getLiveBus);

  // --- Student ETA & Progress ---
  router.get('/students/me/eta', requireAuth, requireRoles('student'), studentController.getStudentEta);

  return router;
}

module.exports = createTrackingRoutes;
