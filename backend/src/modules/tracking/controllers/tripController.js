const tripService = require('../services/tripService');
const Bus = require('../models/Bus');

function createTripController(socketManager) {
  return {
    async startTrip(req, res, next) {
      try {
        const { busId: bodyBusId, routeId, direction = 'morning' } = req.body;
        const busId = bodyBusId || req.user?.assignedBusId;

        if (!busId) {
          return res.status(400).json({ success: false, message: 'No bus specified or assigned' });
        }

        const bus = await Bus.findById(busId);
        if (!bus) {
          return res.status(404).json({ success: false, message: 'Bus not found' });
        }

        const userId = (req.user?.id || req.user?.userId || req.user?._id)?.toString();
        const assignedDriverId = (bus.driverId || bus.assignedDriverId)?.toString();
        const isAssigned =
          (req.user?.assignedBusId && req.user.assignedBusId.toString() === bus._id.toString()) ||
          (assignedDriverId && assignedDriverId === userId);

        if ((req.user?.role || '').toLowerCase() === 'driver' && !isAssigned) {
          return res.status(403).json({ success: false, message: 'You are not assigned to this bus' });
        }

        const { trip, isNew } = await tripService.startTrip({
          busId,
          routeId: routeId || bus.routeId,
          driverId: userId,
          direction,
        });

        if (isNew && socketManager) {
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
    },

    async endTrip(req, res, next) {
      try {
        const { busId: bodyBusId, reason } = req.body;
        const busId = bodyBusId || req.user?.assignedBusId;

        if (!busId) {
          return res.status(400).json({ success: false, message: 'No bus specified or assigned' });
        }

        const trip = await tripService.endTrip(busId, reason || 'driver_manual_end');
        if (!trip) {
          return res.status(404).json({ success: false, message: 'No active trip found for this bus' });
        }

        if (socketManager) {
          socketManager.broadcastTripEnded(busId, trip);
        }

        res.json({
          success: true,
          message: 'Trip ended successfully',
          trip,
        });
      } catch (err) {
        next(err);
      }
    },

    async getActiveTrip(req, res, next) {
      try {
        const busId = req.query.busId || req.user?.assignedBusId;
        if (!busId) {
          return res.status(400).json({ success: false, message: 'busId is required' });
        }

        // Student isolation check
        if (req.user?.role === 'student' && (!req.user.assignedBusId || req.user.assignedBusId.toString() !== busId.toString())) {
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
    },
  };
}

module.exports = createTripController;
