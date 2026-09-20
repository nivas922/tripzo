const Bus = require('../models/Bus');
const tripService = require('../services/tripService');

const busController = {
  async getLiveBus(req, res, next) {
    try {
      const busId = req.params.id;

      // Student Isolation Enforcement:
      // A student can NEVER query a bus other than their assigned bus
      if (req.user?.role === 'student') {
        if (!req.user.assignedBusId || req.user.assignedBusId.toString() !== busId.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You can only query your assigned bus',
          });
        }
      }

      const bus = await Bus.findById(busId)
        .populate('routeId', 'name stops polyline')
        .populate('assignedDriverId', 'name'); // Safe fields only, phone excluded

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
          lastLocation: activeTrip ? bus.lastLocation : null,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = busController;
