const express = require('express');
const LocationPing = require('../models/LocationPing');
const Bus = require('../models/Bus');
const tripService = require('../services/tripService');
const socketManager = require('../sockets/socketManager');
const { authenticateDeviceOrDriver } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   POST /api/location/ping
 * @desc    Ingest live GPS ping from driver smartphone OR IoT device
 */
router.post('/ping', authenticateDeviceOrDriver, async (req, res, next) => {
  try {
    const bus = req.bus;
    const { lat, lng, speed = 0, heading = 0, timestamp } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ success: false, message: 'Latitude (lat) and Longitude (lng) are required' });
    }

    // Constraint: Check for active trip. Location is NEVER broadcast outside an active trip!
    const activeTrip = await tripService.getActiveTripForBus(bus._id);
    if (!activeTrip) {
      return res.status(400).json({
        success: false,
        code: 'NO_ACTIVE_TRIP',
        message: 'No active trip in progress. Location tracking is disabled outside active trips to preserve privacy.',
      });
    }

    const pingTimestamp = timestamp ? new Date(timestamp) : new Date();

    // 1. Persist LocationPing (auto-deleted after 7 days via TTL index)
    const ping = await LocationPing.create({
      busId: bus._id,
      tripId: activeTrip._id,
      lat: Number(lat),
      lng: Number(lng),
      speed: Number(speed),
      heading: Number(heading),
      timestamp: pingTimestamp,
    });

    // 2. Update Bus cached lastLocation
    bus.lastLocation = {
      lat: Number(lat),
      lng: Number(lng),
      speed: Number(speed),
      heading: Number(heading),
      timestamp: pingTimestamp,
      tripId: activeTrip._id,
    };
    await bus.save();

    // 3. Fan out real-time WebSocket update to subscribers
    socketManager.broadcastLocationUpdate(bus._id.toString(), {
      busId: bus._id,
      tripId: activeTrip._id,
      lat: Number(lat),
      lng: Number(lng),
      speed: Number(speed),
      heading: Number(heading),
      timestamp: pingTimestamp,
    });

    res.status(201).json({
      success: true,
      authSource: req.authSource,
      message: 'Location ping received and broadcasted',
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
});

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
