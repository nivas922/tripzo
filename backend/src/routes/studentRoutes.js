const express = require('express');
const Bus = require('../models/Bus');
const Route = require('../models/Route');
const User = require('../models/User');
const tripService = require('../services/tripService');
const etaService = require('../services/etaService');
const { authenticateJWT, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/students/me/eta
 * @desc    Get live ETA and trip status specifically to the student's own assigned stop
 */
router.get('/me/eta', authenticateJWT, authorizeRoles('student'), async (req, res, next) => {
  try {
    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    if (!student.assignedBusId) {
      return res.status(400).json({
        success: false,
        message: 'No bus assigned to your account. Please contact campus admin.',
      });
    }

    if (!student.homeStopId) {
      return res.status(400).json({
        success: false,
        message: 'No home stop selected for your account. Please select a stop.',
      });
    }

    const bus = await Bus.findById(student.assignedBusId).populate('routeId');
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Assigned bus not found' });
    }

    if (!bus.routeId) {
      return res.status(404).json({ success: false, message: 'No route assigned to your bus' });
    }

    const activeTrip = await tripService.getActiveTripForBus(bus._id);

    const etaResult = await etaService.computeEtaForStudent(
      bus,
      bus.routeId,
      student.homeStopId,
      activeTrip
    );

    res.json({
      success: true,
      busRegistration: bus.registrationNumber,
      tripStatus: activeTrip ? activeTrip.status : 'not_started',
      eta: etaResult,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
