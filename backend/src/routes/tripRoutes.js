const express = require('express');
const tripController = require('../controllers/tripController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/trips/start
 * @desc    Driver/Admin starts a trip
 */
router.post('/start', authenticate, authorize('DRIVER', 'ADMIN'), tripController.startTrip);

/**
 * @route   POST /api/trips/end
 * @desc    Driver/Admin ends active trip
 */
router.post('/end', authenticate, authorize('DRIVER', 'ADMIN'), tripController.endTrip);

/**
 * @route   POST /api/trips/:id/pause
 * @desc    Driver/Admin pauses active trip
 */
router.post('/:id/pause', authenticate, authorize('DRIVER', 'ADMIN'), tripController.pauseTrip);

/**
 * @route   POST /api/trips/:id/resume
 * @desc    Driver/Admin resumes paused trip
 */
router.post('/:id/resume', authenticate, authorize('DRIVER', 'ADMIN'), tripController.resumeTrip);

/**
 * @route   GET /api/trips/active
 * @desc    Get current active trip (student scoped to assigned bus)
 */
router.get('/active', authenticate, tripController.getActiveTrip);

/**
 * @route   GET /api/trips/:id
 * @desc    Get trip details by ID
 */
router.get('/:id', authenticate, tripController.getTripById);

/**
 * @route   GET /api/trips
 * @desc    List trips history with filters & pagination
 */
router.get('/', authenticate, authorize('DRIVER', 'ADMIN'), tripController.getAllTrips);

module.exports = router;
