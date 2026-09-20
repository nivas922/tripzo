const express = require('express');
const routeController = require('../controllers/routeController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Read route queries (accessible to authenticated users)
router.get('/', authenticate, routeController.getAllRoutes);
router.get('/:id', authenticate, routeController.getRouteById);

// Admin-only Route CRUD
router.post('/', authenticate, authorize('ADMIN'), routeController.createRoute);
router.put('/:id', authenticate, authorize('ADMIN'), routeController.updateRoute);
router.delete('/:id', authenticate, authorize('ADMIN'), routeController.deleteRoute);

// Admin-only Stop Sub-Resource CRUD
router.post('/:routeId/stops', authenticate, authorize('ADMIN'), routeController.addStop);
router.put('/:routeId/stops/:stopId', authenticate, authorize('ADMIN'), routeController.updateStop);
router.delete('/:routeId/stops/:stopId', authenticate, authorize('ADMIN'), routeController.deleteStop);

module.exports = router;
