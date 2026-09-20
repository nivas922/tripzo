const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Bus = require('../models/Bus');

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required: missing Bearer token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted to [${allowedRoles.join(', ')}]`,
      });
    }
    next();
  };
}

/**
 * Source-agnostic authentication middleware for the location ingest endpoint:
 * Accepts:
 *  1. Driver/Admin JWT in `Authorization: Bearer <token>`
 *  2. Hardware tracker token in `x-device-token` header or `deviceToken` in body
 */
async function authenticateDeviceOrDriver(req, res, next) {
  const authHeader = req.headers.authorization;
  const deviceToken = req.headers['x-device-token'] || req.body?.deviceToken;

  // 1. Try JWT authentication (Driver / Phone mode)
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      req.user = decoded;

      // Find driver's assigned bus or body busId
      const busId = req.body?.busId || decoded.assignedBusId;
      if (!busId) {
        return res.status(400).json({ success: false, message: 'Driver has no assigned bus and no busId provided' });
      }

      const bus = await Bus.findById(busId);
      if (!bus) {
        return res.status(404).json({ success: false, message: 'Bus not found' });
      }

      // Security check: if user is driver, they can only send pings for their assigned bus
      if (req.user.role === 'driver' && bus.assignedDriverId && bus.assignedDriverId.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'Driver not assigned to this bus' });
      }

      req.bus = bus;
      req.authSource = 'driver_phone';
      return next();
    } catch (err) {
      // JWT invalid, proceed to check deviceToken
    }
  }

  // 2. Try Device Token authentication (AIS-140 / 4G IoT Tracker mode)
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
      return res.status(500).json({ success: false, message: 'Error authenticating device token' });
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized: Provide a valid driver JWT or x-device-token header',
  });
}

module.exports = {
  authenticateJWT,
  authorizeRoles,
  authenticateDeviceOrDriver,
};
