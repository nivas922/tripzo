const express = require('express');
const busController = require('../controllers/busController');
const routeController = require('../controllers/routeController');
const studentAdminController = require('../controllers/studentAdminController');
const Route = require('../models/Route');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Enforce authentication & ADMIN role for all /api/admin routes
router.use(authenticate, authorize('ADMIN'));

// ==========================================
// 1. Buses (/api/admin/buses)
// ==========================================
router.get('/buses', busController.getAllBuses);
router.post('/buses', busController.createBus);
router.get('/buses/:id', busController.getBusById);
router.put('/buses/:id', busController.updateBus);
router.delete('/buses/:id', busController.deleteBus);

// ==========================================
// 2. Drivers (/api/admin/drivers)
// ==========================================
router.get('/drivers', studentAdminController.getAllDrivers);
router.post('/drivers', studentAdminController.createDriver);
router.put('/drivers/:id', studentAdminController.updateDriver);

// ==========================================
// 3. Students (/api/admin/students)
// ==========================================
router.get('/students', studentAdminController.getAllStudents);
router.post('/students', studentAdminController.createStudent);
router.put('/students/:id', studentAdminController.updateStudent);
router.put('/students/:id/assignment', studentAdminController.assignStudent);

// ==========================================
// 4. Routes (/api/admin/routes)
// ==========================================
router.get('/routes', routeController.getAllRoutes);
router.post('/routes', routeController.createRoute);
router.get('/routes/:id', routeController.getRouteById);
router.put('/routes/:id', routeController.updateRoute);
router.delete('/routes/:id', routeController.deleteRoute);

// ==========================================
// 5. Stops Sub-Resources (/api/admin/routes/:routeId/stops & /api/admin/stops/:id)
// ==========================================
router.post('/routes/:routeId/stops', routeController.addStop);
router.put('/routes/:routeId/stops/:stopId', routeController.updateStop);
router.delete('/routes/:routeId/stops/:stopId', routeController.deleteStop);

// Helper for standalone stop modification by stop ID across routes
router.put('/stops/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const route = await Route.findOne({ 'stops._id': id });
    if (!route) {
      return res.status(404).json({ success: false, message: 'Stop not found on any route' });
    }
    req.params.routeId = route._id.toString();
    req.params.stopId = id;
    return routeController.updateStop(req, res, next);
  } catch (err) {
    next(err);
  }
});

router.delete('/stops/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const route = await Route.findOne({ 'stops._id': id });
    if (!route) {
      return res.status(404).json({ success: false, message: 'Stop not found on any route' });
    }
    req.params.routeId = route._id.toString();
    req.params.stopId = id;
    return routeController.deleteStop(req, res, next);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
