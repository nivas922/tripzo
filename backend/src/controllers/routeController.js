const mongoose = require('mongoose');
const Route = require('../models/Route');
const Bus = require('../models/Bus');
const StudentProfile = require('../models/StudentProfile');
const User = require('../models/User');

const routeController = {
  /**
   * @route   GET /api/routes
   * @desc    Get all routes with ordered stops
   */
  async getAllRoutes(req, res, next) {
    try {
      const routes = await Route.find().sort({ routeNumber: 1, name: 1 });
      res.status(200).json({
        success: true,
        count: routes.length,
        routes,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   GET /api/routes/:id
   * @desc    Get route by ID with stops and polyline
   */
  async getRouteById(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid route ID format' });
      }

      const route = await Route.findById(id);
      if (!route) {
        return res.status(404).json({ success: false, message: 'Route not found' });
      }

      res.status(200).json({
        success: true,
        route,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   POST /api/routes
   * @desc    Create a new route (Admin only)
   */
  async createRoute(req, res, next) {
    try {
      const { name, routeNumber, startingPoint, endingPoint, stops = [], routePolyline = [] } = req.body;

      if (!name || !routeNumber) {
        return res.status(400).json({
          success: false,
          message: 'Route name and routeNumber are required',
        });
      }

      // Check unique routeNumber
      const existing = await Route.findOne({ routeNumber: routeNumber.trim() });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `Route with number ${routeNumber} already exists`,
        });
      }

      // Normalize stops sequences if stops provided
      const normalizedStops = stops.map((stop, index) => {
        const lat = stop.latitude !== undefined ? stop.latitude : stop.lat;
        const lng = stop.longitude !== undefined ? stop.longitude : stop.lng;
        return {
          name: stop.name,
          latitude: Number(lat),
          longitude: Number(lng),
          sequence: stop.sequence !== undefined ? Number(stop.sequence) : index + 1,
          expectedTime: stop.expectedTime || stop.scheduledTime || '',
        };
      });

      // Sort stops by sequence
      normalizedStops.sort((a, b) => a.sequence - b.sequence);

      const route = await Route.create({
        name: name.trim(),
        routeNumber: routeNumber.trim(),
        startingPoint: startingPoint ? startingPoint.trim() : (normalizedStops[0]?.name || ''),
        endingPoint: endingPoint ? endingPoint.trim() : (normalizedStops[normalizedStops.length - 1]?.name || ''),
        stops: normalizedStops,
        routePolyline,
      });

      res.status(201).json({
        success: true,
        message: 'Route created successfully',
        route,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   PUT /api/routes/:id
   * @desc    Update a route (Admin only)
   */
  async updateRoute(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid route ID format' });
      }

      const route = await Route.findById(id);
      if (!route) {
        return res.status(404).json({ success: false, message: 'Route not found' });
      }

      const { name, routeNumber, startingPoint, endingPoint, stops, routePolyline } = req.body;

      if (name !== undefined) route.name = name.trim();
      if (routeNumber !== undefined) {
        const trimmedNumber = routeNumber.trim();
        if (trimmedNumber !== route.routeNumber) {
          const duplicate = await Route.findOne({ routeNumber: trimmedNumber, _id: { $ne: route._id } });
          if (duplicate) {
            return res.status(409).json({
              success: false,
              message: `Route number ${trimmedNumber} already in use`,
            });
          }
          route.routeNumber = trimmedNumber;
        }
      }

      if (startingPoint !== undefined) route.startingPoint = startingPoint.trim();
      if (endingPoint !== undefined) route.endingPoint = endingPoint.trim();
      if (routePolyline !== undefined) route.routePolyline = routePolyline;

      if (stops !== undefined && Array.isArray(stops)) {
        route.stops = stops.map((stop, index) => {
          const lat = stop.latitude !== undefined ? stop.latitude : stop.lat;
          const lng = stop.longitude !== undefined ? stop.longitude : stop.lng;
          return {
            _id: stop._id || undefined,
            name: stop.name,
            latitude: Number(lat),
            longitude: Number(lng),
            sequence: stop.sequence !== undefined ? Number(stop.sequence) : index + 1,
            expectedTime: stop.expectedTime || stop.scheduledTime || '',
          };
        });
        route.stops.sort((a, b) => a.sequence - b.sequence);
      }

      await route.save();

      res.status(200).json({
        success: true,
        message: 'Route updated successfully',
        route,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   DELETE /api/routes/:id
   * @desc    Delete a route (Admin only)
   */
  async deleteRoute(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid route ID format' });
      }

      const route = await Route.findById(id);
      if (!route) {
        return res.status(404).json({ success: false, message: 'Route not found' });
      }

      // Unassign buses and students linked to this route
      await Promise.all([
        Bus.updateMany({ routeId: route._id }, { routeId: null }),
        StudentProfile.updateMany({ assignedRouteId: route._id }, { assignedRouteId: null, homeStopId: null }),
        Route.findByIdAndDelete(route._id),
      ]);

      res.status(200).json({
        success: true,
        message: 'Route deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   POST /api/routes/:routeId/stops
   * @desc    Add a stop to an existing route (Admin only)
   */
  async addStop(req, res, next) {
    try {
      const { routeId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(routeId)) {
        return res.status(400).json({ success: false, message: 'Invalid route ID format' });
      }

      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({ success: false, message: 'Route not found' });
      }

      const { name, latitude, longitude, lat, lng, sequence, expectedTime, scheduledTime } = req.body;
      const targetLat = latitude !== undefined ? latitude : lat;
      const targetLng = longitude !== undefined ? longitude : lng;

      if (!name || targetLat === undefined || targetLng === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Stop name, latitude, and longitude are required',
        });
      }

      const newSequence = sequence !== undefined ? Number(sequence) : route.stops.length + 1;

      route.stops.push({
        name: name.trim(),
        latitude: Number(targetLat),
        longitude: Number(targetLng),
        sequence: newSequence,
        expectedTime: expectedTime || scheduledTime || '',
      });

      // Maintain ordered sequence
      route.stops.sort((a, b) => a.sequence - b.sequence);
      await route.save();

      const addedStop = route.stops.find((s) => s.name === name.trim() && s.sequence === newSequence);

      res.status(201).json({
        success: true,
        message: 'Stop added successfully',
        stop: addedStop,
        stops: route.stops,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   PUT /api/routes/:routeId/stops/:stopId
   * @desc    Update an existing stop on a route (Admin only)
   */
  async updateStop(req, res, next) {
    try {
      const { routeId, stopId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(routeId) || !mongoose.Types.ObjectId.isValid(stopId)) {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }

      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({ success: false, message: 'Route not found' });
      }

      const stop = route.stops.id(stopId);
      if (!stop) {
        return res.status(404).json({ success: false, message: 'Stop not found on this route' });
      }

      const { name, latitude, longitude, lat, lng, sequence, expectedTime, scheduledTime } = req.body;

      if (name !== undefined) stop.name = name.trim();
      const targetLat = latitude !== undefined ? latitude : lat;
      const targetLng = longitude !== undefined ? longitude : lng;
      if (targetLat !== undefined) stop.latitude = Number(targetLat);
      if (targetLng !== undefined) stop.longitude = Number(targetLng);
      if (sequence !== undefined) stop.sequence = Number(sequence);
      if (expectedTime !== undefined || scheduledTime !== undefined) {
        stop.expectedTime = expectedTime || scheduledTime || '';
      }

      route.stops.sort((a, b) => a.sequence - b.sequence);
      await route.save();

      res.status(200).json({
        success: true,
        message: 'Stop updated successfully',
        stop,
        stops: route.stops,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   DELETE /api/routes/:routeId/stops/:stopId
   * @desc    Delete a stop from a route (Admin only)
   */
  async deleteStop(req, res, next) {
    try {
      const { routeId, stopId } = req.params;
      if (!mongoose.Types.ObjectId.isValid(routeId) || !mongoose.Types.ObjectId.isValid(stopId)) {
        return res.status(400).json({ success: false, message: 'Invalid ID format' });
      }

      const route = await Route.findById(routeId);
      if (!route) {
        return res.status(404).json({ success: false, message: 'Route not found' });
      }

      const stopIndex = route.stops.findIndex((s) => s._id.toString() === stopId);
      if (stopIndex === -1) {
        return res.status(404).json({ success: false, message: 'Stop not found on this route' });
      }

      route.stops.splice(stopIndex, 1);

      // Re-index remaining stops sequence numbers (1, 2, 3...)
      route.stops.forEach((s, idx) => {
        s.sequence = idx + 1;
      });

      await Promise.all([
        StudentProfile.updateMany({ homeStopId: stopId }, { homeStopId: null }),
        User.updateMany({ homeStopId: stopId }, { homeStopId: null }),
        route.save(),
      ]);

      res.status(200).json({
        success: true,
        message: 'Stop deleted successfully',
        stops: route.stops,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = routeController;
