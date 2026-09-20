const LocationPing = require('../models/LocationPing');
const tripService = require('../services/tripService');

function createLocationController(socketManager) {
  return {
    async ping(req, res, next) {
      try {
        const bus = req.bus;
        const lat = req.body.latitude !== undefined ? req.body.latitude : req.body.lat;
        const lng = req.body.longitude !== undefined ? req.body.longitude : req.body.lng;
        const speed = req.body.speed !== undefined ? req.body.speed : 0;
        const heading = req.body.heading !== undefined ? req.body.heading : 0;
        const timestamp = req.body.timestamp;

        if (lat === undefined || lng === undefined) {
          return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
        }

        const numLat = Number(lat);
        const numLng = Number(lng);
        if (isNaN(numLat) || numLat < -90 || numLat > 90 || isNaN(numLng) || numLng < -180 || numLng > 180) {
          return res.status(400).json({
            success: false,
            message: 'Invalid GPS coordinates: latitude must be between -90 and 90, longitude between -180 and 180',
          });
        }

        // Privacy safeguard: location is NEVER broadcast outside an active trip
        const activeTrip = await tripService.getActiveTripForBus(bus._id);
        if (!activeTrip) {
          return res.status(400).json({
            success: false,
            code: 'NO_ACTIVE_TRIP',
            message: 'No active trip in progress. Location tracking disabled to preserve driver privacy.',
          });
        }

        const pingTimestamp = timestamp ? new Date(timestamp) : new Date();

        // 1. Save ping with 7-day TTL index
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

        // 3. Broadcast real-time WebSocket update
        if (socketManager) {
          socketManager.broadcastLocationUpdate(bus._id.toString(), {
            busId: bus._id,
            tripId: activeTrip._id,
            lat: Number(lat),
            lng: Number(lng),
            speed: Number(speed),
            heading: Number(heading),
            timestamp: pingTimestamp,
          });
        }

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
    },

    async batch(req, res, next) {
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

        if (socketManager) {
          socketManager.broadcastLocationUpdate(bus._id.toString(), {
            busId: bus._id,
            tripId: activeTrip._id,
            lat: latestPing.lat,
            lng: latestPing.lng,
            speed: latestPing.speed,
            heading: latestPing.heading,
            timestamp: latestPing.timestamp,
          });
        }

        res.status(201).json({
          success: true,
          authSource: req.authSource,
          count: pingDocs.length,
          message: `Successfully flushed ${pingDocs.length} buffered pings`,
        });
      } catch (err) {
        next(err);
      }
    },
  };
}

module.exports = createLocationController;
