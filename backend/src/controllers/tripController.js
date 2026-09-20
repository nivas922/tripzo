const mongoose = require('mongoose');
const Bus = require('../models/Bus');
const tripService = require('../services/tripService');
const socketManager = require('../sockets/socketManager');

const tripController = {
  /**
   * @route   POST /api/trips/start
   * @desc    Driver starts a trip
   */
  async startTrip(req, res, next) {
    try {
      const { busId: bodyBusId, routeId, direction = 'morning', status } = req.body;
      const busId = bodyBusId || req.user.assignedBusId;

      if (!busId) {
        return res.status(400).json({ success: false, message: 'No bus specified or assigned' });
      }

      if (!mongoose.Types.ObjectId.isValid(busId)) {
        return res.status(400).json({ success: false, message: 'Invalid bus ID format' });
      }

      const bus = await Bus.findById(busId);
      if (!bus) {
        return res.status(404).json({ success: false, message: 'Bus not found' });
      }

      const userId = (req.user.id || req.user.userId || req.user._id)?.toString();
      const assignedDriverId = (bus.driverId || bus.assignedDriverId)?.toString();
      const userRole = (req.user.role || '').toUpperCase();

      const isAssigned =
        (req.user.assignedBusId && req.user.assignedBusId.toString() === bus._id.toString()) ||
        (assignedDriverId && assignedDriverId === userId);

      if (userRole === 'DRIVER' && !isAssigned) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this bus' });
      }

      const targetRouteId = routeId || bus.routeId;
      if (!targetRouteId) {
        return res.status(400).json({ success: false, message: 'No route assigned to this bus' });
      }

      const { trip, isNew } = await tripService.startTrip({
        busId,
        routeId: targetRouteId,
        driverId: userId,
        direction,
        status,
      });

      if (isNew && socketManager) {
        socketManager.broadcastTripStarted(busId, trip);
      }

      res.status(isNew ? 201 : 200).json({
        success: true,
        message: isNew ? 'Trip started successfully' : 'Trip already in progress',
        trip,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   POST /api/trips/end
   * @desc    Driver ends an active trip
   */
  async endTrip(req, res, next) {
    try {
      const { busId: bodyBusId, reason } = req.body;
      const busId = bodyBusId || req.user.assignedBusId;

      if (!busId) {
        return res.status(400).json({ success: false, message: 'No bus specified or assigned' });
      }

      if (!mongoose.Types.ObjectId.isValid(busId)) {
        return res.status(400).json({ success: false, message: 'Invalid bus ID format' });
      }

      const bus = await Bus.findById(busId);
      if (!bus) {
        return res.status(404).json({ success: false, message: 'Bus not found' });
      }

      const userId = (req.user.id || req.user.userId || req.user._id)?.toString();
      const assignedDriverId = (bus.driverId || bus.assignedDriverId)?.toString();
      const userRole = (req.user.role || '').toUpperCase();

      const isAssigned =
        (req.user.assignedBusId && req.user.assignedBusId.toString() === bus._id.toString()) ||
        (assignedDriverId && assignedDriverId === userId);

      if (userRole === 'DRIVER' && !isAssigned) {
        return res.status(403).json({ success: false, message: 'You are not assigned to this bus' });
      }

      const trip = await tripService.endTrip(busId, reason || 'driver_manual_end');
      if (!trip) {
        return res.status(404).json({ success: false, message: 'No active trip found for this bus' });
      }

      if (socketManager) {
        socketManager.broadcastTripEnded(busId, trip);
      }

      res.status(200).json({
        success: true,
        message: 'Trip ended successfully',
        trip,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   POST /api/trips/:id/pause
   * @desc    Driver pauses an active trip
   */
  async pauseTrip(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid trip ID format' });
      }

      const userId = (req.user.id || req.user.userId || req.user._id)?.toString();
      const userRole = (req.user.role || '').toUpperCase();

      if (userRole === 'DRIVER') {
        const Trip = require('../models/Trip');
        const existingTrip = await Trip.findById(id);
        if (existingTrip) {
          const bus = await Bus.findById(existingTrip.busId);
          const assignedDriverId = (bus?.driverId || bus?.assignedDriverId)?.toString();
          const isAssigned =
            (req.user.assignedBusId && req.user.assignedBusId.toString() === existingTrip.busId.toString()) ||
            (assignedDriverId && assignedDriverId === userId);
          if (!isAssigned) {
            return res.status(403).json({ success: false, message: 'You are not assigned to this bus' });
          }
        }
      }

      const trip = await tripService.pauseTrip(id);
      if (!trip) {
        return res.status(404).json({ success: false, message: 'Active trip not found to pause' });
      }

      res.status(200).json({
        success: true,
        message: 'Trip paused successfully',
        trip,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   POST /api/trips/:id/resume
   * @desc    Driver resumes a paused trip
   */
  async resumeTrip(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid trip ID format' });
      }

      const userId = (req.user.id || req.user.userId || req.user._id)?.toString();
      const userRole = (req.user.role || '').toUpperCase();

      if (userRole === 'DRIVER') {
        const Trip = require('../models/Trip');
        const existingTrip = await Trip.findById(id);
        if (existingTrip) {
          const bus = await Bus.findById(existingTrip.busId);
          const assignedDriverId = (bus?.driverId || bus?.assignedDriverId)?.toString();
          const isAssigned =
            (req.user.assignedBusId && req.user.assignedBusId.toString() === existingTrip.busId.toString()) ||
            (assignedDriverId && assignedDriverId === userId);
          if (!isAssigned) {
            return res.status(403).json({ success: false, message: 'You are not assigned to this bus' });
          }
        }
      }

      const trip = await tripService.resumeTrip(id);
      if (!trip) {
        return res.status(404).json({ success: false, message: 'Paused trip not found to resume' });
      }

      res.status(200).json({
        success: true,
        message: 'Trip resumed successfully',
        trip,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   GET /api/trips/active
   * @desc    Get currently active trip for bus or driver
   */
  async getActiveTrip(req, res, next) {
    try {
      const busId = req.query.busId || req.user.assignedBusId;
      if (!busId) {
        return res.status(400).json({ success: false, message: 'busId is required or driver must have assigned bus' });
      }

      const userRole = (req.user?.role || '').toUpperCase();
      if (userRole === 'STUDENT') {
        const studentBus = req.user.assignedBusId?.toString();
        if (!studentBus || studentBus !== busId.toString()) {
          return res.status(403).json({ success: false, message: 'Forbidden: You can only view your assigned bus' });
        }
      }

      const trip = await tripService.getActiveTripForBus(busId);
      if (!trip) {
        return res.status(200).json({
          success: true,
          activeTrip: null,
          message: 'No active trip in progress',
        });
      }

      const populatedTrip = await tripService.getTripById(trip._id);

      res.status(200).json({
        success: true,
        activeTrip: populatedTrip || trip,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   GET /api/trips/current
   * @desc    Get currently active trip for logged-in driver or student
   */
  async getCurrentTrip(req, res, next) {
    try {
      let busId = req.query.busId || req.user.assignedBusId;

      const userId = req.user.id || req.user.userId || req.user._id;
      if (!busId && (req.user.role === 'DRIVER')) {
        const bus = await Bus.findOne({
          $or: [
            { driverId: userId },
            { assignedDriverId: userId },
          ],
        });
        if (bus) busId = bus._id;
      }

      if (!busId) {
        return res.status(200).json({
          success: true,
          data: { trip: null },
          trip: null,
          message: 'No assigned bus or active trip found',
        });
      }

      const trip = await tripService.getActiveTripForBus(busId);
      if (!trip) {
        return res.status(200).json({
          success: true,
          data: { trip: null },
          trip: null,
          message: 'No active trip in progress',
        });
      }

      const populatedTrip = await tripService.getTripById(trip._id);

      res.status(200).json({
        success: true,
        data: {
          trip: populatedTrip || trip,
        },
        trip: populatedTrip || trip,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   GET /api/trips/:id
   * @desc    Get trip by ID
   */
  async getTripById(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid trip ID format' });
      }

      const trip = await tripService.getTripById(id);
      if (!trip) {
        return res.status(404).json({ success: false, message: 'Trip not found' });
      }

      const userRole = (req.user?.role || '').toUpperCase();
      if (userRole === 'STUDENT') {
        const studentBus = req.user.assignedBusId?.toString();
        const tripBusId = (trip.busId?._id || trip.busId)?.toString();
        if (!studentBus || tripBusId !== studentBus) {
          return res.status(403).json({ success: false, message: 'Forbidden: You can only view trips for your assigned bus' });
        }
      }

      res.status(200).json({
        success: true,
        trip,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   GET /api/trips
   * @desc    List all trips with filtering & pagination
   */
  async getAllTrips(req, res, next) {
    try {
      const { busId, driverId, status, date, limit, skip } = req.query;
      const { trips, total } = await tripService.getTripsHistory({
        busId,
        driverId,
        status,
        date,
        limit,
        skip,
      });

      res.status(200).json({
        success: true,
        total,
        count: trips.length,
        trips,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = tripController;
