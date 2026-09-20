const Bus = require('../models/Bus');

/**
 * Creates the source-agnostic telemetry authentication middleware.
 * Accepts:
 *  1. Driver credential via the active AuthProvider (driver smartphone mode)
 *  2. Hardware device token via x-device-token header or body deviceToken (AIS-140 / 4G tracker)
 */
function createDeviceOrDriverAuth(authProvider) {
  return async function authenticateDeviceOrDriver(req, res, next) {
    const deviceToken = req.headers['x-device-token'] || req.body?.deviceToken;

    // 1. Check Hardware Device Token (IoT Telemetry Mode)
    if (deviceToken) {
      try {
        const bus = await Bus.findOne({ deviceToken: deviceToken.trim() });
        if (!bus) {
          return res.status(401).json({ success: false, message: 'Invalid device token' });
        }

        req.bus = bus;
        req.authSource = 'hardware_tracker';
        return next();
      } catch (err) {
        return res.status(500).json({ success: false, message: 'Device token authentication error' });
      }
    }

    // 2. Check Driver Auth via active AuthProvider (Driver Smartphone Mode)
    if (authProvider) {
      try {
        const user = await authProvider.authenticate(req);
        req.user = user;

        const busId = req.body?.busId || user.assignedBusId;
        if (!busId) {
          return res.status(400).json({ success: false, message: 'Driver has no assigned bus' });
        }

        const bus = await Bus.findById(busId);
        if (!bus) {
          return res.status(404).json({ success: false, message: 'Bus not found' });
        }

        const isAssigned =
          (user.assignedBusId && user.assignedBusId.toString() === bus._id.toString()) ||
          (bus.assignedDriverId && bus.assignedDriverId.toString() === user.id);

        if (user.role === 'driver' && !isAssigned) {
          return res.status(403).json({ success: false, message: 'Driver not assigned to this bus' });
        }

        req.bus = bus;
        req.authSource = 'driver_phone';
        return next();
      } catch (err) {
        // Fall through to unauthorized
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Provide driver credentials or x-device-token header',
    });
  };
}

module.exports = createDeviceOrDriverAuth;
