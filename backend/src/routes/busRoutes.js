const express = require('express');
const busController = require('../controllers/busController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Live bus position with student isolation (must come before /:id)
router.get('/:id/live', authenticate, busController.getLiveBus);

// General bus fleet queries
router.get('/', authenticate, busController.getAllBuses);
router.get('/:id', authenticate, busController.getBusById);

// Admin-only bus management CRUD
router.post('/', authenticate, authorize('ADMIN'), busController.createBus);
router.put('/:id', authenticate, authorize('ADMIN'), busController.updateBus);
router.delete('/:id', authenticate, authorize('ADMIN'), busController.deleteBus);

module.exports = router;
