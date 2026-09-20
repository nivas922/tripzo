const express = require('express');
const tripService = require('../services/tripService');
const socketManager = require('../sockets/socketManager');
const Bus = require('../models/Bus');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/trips/start
 * @desc    Driver starts a trip
 */
router.post('/start', authenticateJWT, authorizeRoles('driver', 'admin'), async (req, res, next) => {
  try {
    const { busId: bodyBusId, routeId, direction = 'morning' } = req.body;
    const busId = bodyBusId || req.user.assignedBusId;

    if (!busId) {
      return res.status(400).json({ success: false, message: 'No bus specified or assigned' });
    }

    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }

    // Driver can only start a trip for their assigned bus (unless admin)
    if (req.user.role === 'driver' && bus.assignedDriverId && bus.assignedDriverId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'You are not assigned to this bus' });
    }

    const { trip, isNew } = await tripService.startTrip({
      busId,
      routeId: routeId || bus.routeId,
      driverId: req.user.id,
      direction,
    });

    if (isNew) {
      socketManager.broadcastTripStarted(busId, trip);
    }

    res.status(isNew ? 201 : 200).json({
      success: true,
      message: isNew ? 'Trip started successfully' : 'Trip already in progress',
      trip,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/trips/end
 * @desc    Driver ends active trip
 */
router.post('/end', authenticateJWT, authorizeRoles('driver', 'admin'), async (req, res, next) => {
  try {
    const { busId: bodyBusId, reason } = req.body;
    const busId = bodyBusId || req.user.assignedBusId;

    if (!busId) {
      return res.status(400).json({ success: false, message: 'No bus specified or assigned' });
    }

    const trip = await tripService.endTrip(busId, reason || 'driver_manual_end');
    if (!trip) {
      return res.status(404).json({ success: false, message: 'No active trip found for this bus' });
    }

    socketManager.broadcastTripEnded(busId, trip);

    res.json({
      success: true,
      message: 'Trip ended successfully',
      trip,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/trips/active
 * @desc    Get current active trip
 */
router.get('/active', authenticateJWT, async (req, res, next) => {
  try {
    const busId = req.query.busId || req.user.assignedBusId;
    if (!busId) {
      return res.status(400).json({ success: false, message: 'busId is required' });
    }

    // Student privacy guard: can only check active trip for their assigned bus
    if (req.user.role === 'student' && (!req.user.assignedBusId || req.user.assignedBusId.toString() !== busId.toString())) {
      return res.status(403).json({ success: false, message: 'Forbidden: You can only view your assigned bus' });
    }

    const trip = await tripService.getActiveTripForBus(busId);
    res.json({
      success: true,
      activeTrip: trip,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
