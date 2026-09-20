const express = require('express');
const Bus = require('../models/Bus');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const tripService = require('../services/tripService');
const etaService = require('../services/etaService');
const studentAdminController = require('../controllers/studentAdminController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/students/me/eta
 * @desc    Get live ETA and trip status specifically to the student's own assigned stop
 */
router.get('/me/eta', authenticate, authorize('STUDENT'), async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const student = await User.findById(userId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    let assignedBusId = student.assignedBusId || req.user.assignedBusId;
    let homeStopId = student.homeStopId || req.user.homeStopId;

    if (!assignedBusId || !homeStopId) {
      const profile = await StudentProfile.findOne({
        $or: [{ userId: student._id }, { _id: student._id }],
      });
      if (profile) {
        if (!assignedBusId && profile.assignedBusId) assignedBusId = profile.assignedBusId;
        if (!homeStopId && profile.homeStopId) homeStopId = profile.homeStopId;
      }
    }

    if (!assignedBusId) {
      return res.status(400).json({
        success: false,
        message: 'No bus assigned to your account. Please contact campus admin.',
      });
    }

    if (!homeStopId) {
      return res.status(400).json({
        success: false,
        message: 'No home stop selected for your account. Please select a stop.',
      });
    }

    const bus = await Bus.findById(assignedBusId).populate('routeId');
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
      homeStopId,
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

/**
 * @route   GET /api/students/me
 * @desc    Get currently logged in student's assignment & profile
 */
router.get('/me', authenticate, studentAdminController.getMyProfile);

/**
 * @route   GET /api/students/me/bus
 * @desc    Get currently logged in student's assigned bus and active trip
 */
router.get('/me/bus', authenticate, authorize('STUDENT'), studentAdminController.getMyBus);

/**
 * @route   GET /api/students/me/route
 * @desc    Get currently logged in student's assigned route with ordered stops
 */
router.get('/me/route', authenticate, authorize('STUDENT'), studentAdminController.getMyRoute);

/**
 * @route   GET /api/students
 * @desc    List all students with profile details (Admin only)
 */
router.get('/', authenticate, authorize('ADMIN'), studentAdminController.getAllStudents);

/**
 * @route   PUT /api/students/:id/assignment
 * @desc    Assign or update a student's bus, route, and stop (Admin only)
 */
router.put('/:id/assignment', authenticate, authorize('ADMIN'), studentAdminController.assignStudent);

module.exports = router;
