const express = require('express');
const Bus = require('../models/Bus');
const tripService = require('../services/tripService');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/buses/:id/live
 * @desc    Get live position, current trip status, and route geometry for a bus
 */
router.get('/:id/live', authenticateJWT, async (req, res, next) => {
  try {
    const busId = req.params.id;

    // Student Privacy Constraint:
    // Students can NEVER query a bus they are not assigned to
    if (req.user.role === 'student') {
      if (!req.user.assignedBusId || req.user.assignedBusId.toString() !== busId.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You can only query your assigned bus',
        });
      }
    }

    const bus = await Bus.findById(busId)
      .populate('routeId', 'name stops polyline')
      .populate('assignedDriverId', 'name'); // Excludes phone number and personal info!

    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }

    const activeTrip = await tripService.getActiveTripForBus(busId);

    res.json({
      success: true,
      bus: {
        id: bus._id,
        registrationNumber: bus.registrationNumber,
        route: bus.routeId,
        driver: bus.assignedDriverId ? { name: bus.assignedDriverId.name } : null,
        activeTrip: activeTrip
          ? {
              id: activeTrip._id,
              direction: activeTrip.direction,
              startedAt: activeTrip.startedAt,
              status: activeTrip.status,
            }
          : null,
        // Only return last location if an active trip is in progress
        lastLocation: activeTrip ? bus.lastLocation : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
