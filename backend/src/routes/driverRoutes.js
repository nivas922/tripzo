const express = require('express');
const studentAdminController = require('../controllers/studentAdminController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/drivers
 * @desc    List all drivers and their assigned buses (Admin only)
 */
router.get('/', authenticate, authorize('ADMIN'), studentAdminController.getAllDrivers);

module.exports = router;
