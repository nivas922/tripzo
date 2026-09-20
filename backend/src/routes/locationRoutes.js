const express = require('express');
const LocationPing = require('../models/LocationPing');
const Bus = require('../models/Bus');
const tripService = require('../services/tripService');
const socketManager = require('../sockets/socketManager');
const { authenticateDeviceOrDriver } = require('../middleware/auth');

const router = express.Router();

/**
 * Common handler for GPS updates from driver smartphone or IoT tracker
 */
async function handleLocationUpdate(req, res, next) {
  try {
    const bus = req.bus;
    const lat = req.body.latitude !== undefined ? req.body.latitude : req.body.lat;
    const lng = req.body.longitude !== undefined ? req.body.longitude : req.body.lng;
    const speed = req.body.speed !== undefined ? req.body.speed : 0;
    const heading = req.body.heading !== undefined ? req.body.heading : 0;
    const timestamp = req.body.timestamp;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Both latitude and longitude are required',
      });
    }

    const numLat = Number(lat);
    const numLng = Number(lng);
    const numSpeed = Number(speed) || 0;
    const numHeading = Number(heading) || 0;

    // Strict GPS Coordinate Validation
    if (isNaN(numLat) || numLat < -90 || numLat > 90 || isNaN(numLng) || numLng < -180 || numLng > 180) {
      return res.status(400).json({
        success: false,
        message: 'Invalid GPS coordinates: latitude must be between -90 and 90, longitude between -180 and 180',
      });
    }

    // Constraint: Check for active trip
    const activeTrip = await tripService.getActiveTripForBus(bus._id);
    if (!activeTrip) {
      return res.status(400).json({
        success: false,
        code: 'NO_ACTIVE_TRIP',
        message: 'No active trip in progress. Location tracking is disabled outside active trips to preserve privacy.',
      });
    }

    const pingTimestamp = timestamp ? new Date(timestamp) : new Date();

    // Off-Route Detection: compare location with route stops
    let isOffRoute = false;
    if (bus.routeId) {
      const Route = require('../models/Route');
      const route = await Route.findById(bus.routeId);
      if (route && route.stops && route.stops.length > 0) {
        let minDistanceKm = Infinity;
        for (const stop of route.stops) {
          const stopLat = stop.latitude !== undefined ? stop.latitude : stop.lat;
          const stopLng = stop.longitude !== undefined ? stop.longitude : stop.lng;
          if (stopLat !== undefined && stopLng !== undefined) {
            const dLat = ((stopLat - numLat) * Math.PI) / 180;
            const dLng = ((stopLng - numLng) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((numLat * Math.PI) / 180) *
                Math.cos((stopLat * Math.PI) / 180) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);
            const distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            if (distKm < minDistanceKm) minDistanceKm = distKm;
          }
        }

        // If bus is more than 2.5 km from the closest stop
        if (minDistanceKm > 2.5) {
          isOffRoute = true;
          if (activeTrip.status !== 'OFF_ROUTE') {
            activeTrip.status = 'OFF_ROUTE';
            await activeTrip.save();
            if (socketManager.io) {
              socketManager.io.to(`bus:${bus._id}`).emit('bus:off_route', {
                busId: bus._id.toString(),
                status: 'OFF_ROUTE',
                message: 'Bus may be temporarily away from its normal route.',
              });
            }
          }
        } else if (activeTrip.status === 'OFF_ROUTE') {
          activeTrip.status = 'RUNNING';
          await activeTrip.save();
        }
      }
    }

    // 1. Persist LocationPing (auto-purged after 7 days via TTL index)
    const ping = await LocationPing.create({
      busId: bus._id,
      tripId: activeTrip._id,
      lat: numLat,
      lng: numLng,
      speed: numSpeed,
      heading: numHeading,
      timestamp: pingTimestamp,
    });

    // 2. Update Bus cached lastLocation
    bus.lastLocation = {
      latitude: numLat,
      longitude: numLng,
      lat: numLat,
      lng: numLng,
      speed: numSpeed,
      heading: numHeading,
      timestamp: pingTimestamp,
      tripId: activeTrip._id,
    };
    await bus.save();

    // 3. Fan out real-time WebSocket update (both bus:location and bus:location_update)
    socketManager.broadcastLocationUpdate(bus._id.toString(), {
      busId: bus._id,
      tripId: activeTrip._id,
      latitude: numLat,
      longitude: numLng,
      lat: numLat,
      lng: numLng,
      speed: numSpeed,
      heading: numHeading,
      timestamp: pingTimestamp,
    });

    res.status(201).json({
      success: true,
      message: 'Location updated successfully',
      data: {
        busId: bus._id,
        tripId: activeTrip._id,
        latitude: numLat,
        longitude: numLng,
        speed: numSpeed,
        heading: numHeading,
        status: activeTrip.status,
        timestamp: pingTimestamp,
      },
      authSource: req.authSource,
      ping: {
        id: ping._id,
        busId: bus._id,
        tripId: activeTrip._id,
        lat: ping.lat,
        lng: ping.lng,
        speed: ping.speed,
        heading: ping.heading,
        timestamp: ping.timestamp,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * @route   POST /api/location/update
 * @desc    Driver phone updates live GPS coordinates
 */
router.post('/update', authenticateDeviceOrDriver, handleLocationUpdate);

/**
 * @route   POST /api/location/ping
 * @desc    Ingest live GPS ping from driver smartphone OR IoT device
 */
router.post('/ping', authenticateDeviceOrDriver, handleLocationUpdate);

/**
 * @route   POST /api/location/batch
 * @desc    Ingest buffered location pings when driver reconnects from poor connectivity
 */
router.post('/batch', authenticateDeviceOrDriver, async (req, res, next) => {
  try {
    const bus = req.bus;
    const { pings } = req.body;

    if (!Array.isArray(pings) || pings.length === 0) {
      return res.status(400).json({ success: false, message: 'pings must be a non-empty array' });
    }

    const activeTrip = await tripService.getActiveTripForBus(bus._id);
    if (!activeTrip) {
      return res.status(400).json({
        success: false,
        code: 'NO_ACTIVE_TRIP',
        message: 'No active trip in progress. Buffered pings ignored.',
      });
    }

    // Format pings for insertion
    const pingDocs = pings.map((p) => ({
      busId: bus._id,
      tripId: activeTrip._id,
      lat: Number(p.lat),
      lng: Number(p.lng),
      speed: Number(p.speed || 0),
      heading: Number(p.heading || 0),
      timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
    }));

    await LocationPing.insertMany(pingDocs);

    // Update lastLocation to latest ping
    const latestPing = pingDocs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
    bus.lastLocation = {
      lat: latestPing.lat,
      lng: latestPing.lng,
      speed: latestPing.speed,
      heading: latestPing.heading,
      timestamp: latestPing.timestamp,
      tripId: activeTrip._id,
    };
    await bus.save();

    // Broadcast latest position
    socketManager.broadcastLocationUpdate(bus._id.toString(), {
      busId: bus._id,
      tripId: activeTrip._id,
      lat: latestPing.lat,
      lng: latestPing.lng,
      speed: latestPing.speed,
      heading: latestPing.heading,
      timestamp: latestPing.timestamp,
    });

    res.status(201).json({
      success: true,
      authSource: req.authSource,
      count: pingDocs.length,
      message: `Successfully flushed ${pingDocs.length} buffered pings`,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
