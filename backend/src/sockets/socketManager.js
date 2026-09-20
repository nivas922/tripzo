const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Bus = require('../models/Bus');
const tripService = require('../services/tripService');

class SocketManager {
  constructor() {
    this.io = null;
  }

  init(httpServer) {
    this.io = socketIO(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    // Handshake Authentication Middleware
    this.io.use((socket, next) => {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers.authorization &&
          socket.handshake.headers.authorization.split(' ')[1]);

      if (!token) {
        return next(new Error('Authentication error: missing token'));
      }

      try {
        const decoded = jwt.verify(token, config.jwtSecret);
        socket.user = decoded;
        next();
      } catch (err) {
        return next(new Error('Authentication error: invalid or expired token'));
      }
    });

    this.io.on('connection', (socket) => {
      const user = socket.user;
      console.log(`[Socket] Client connected: ${user.name} (${user.role}), socketId: ${socket.id}`);

      // Handle bus subscription
      socket.on('subscribe:bus', async (data) => {
        const busId = data?.busId;
        if (!busId) {
          return socket.emit('error:bus', { message: 'busId is required to subscribe' });
        }

        // Student Privacy & Access Constraint:
        // A student can ONLY listen to their assigned bus
        if (user.role === 'student') {
          if (!user.assignedBusId || user.assignedBusId.toString() !== busId.toString()) {
            return socket.emit('error:unauthorized', {
              message: 'Forbidden: You can only track your assigned bus',
            });
          }
        }

        const room = `bus:${busId}`;
        socket.join(room);
        console.log(`[Socket] User ${user.name} joined room ${room}`);

        // Send current initial state upon subscription
        try {
          const bus = await Bus.findById(busId).select('-assignedDriverId');
          const activeTrip = await tripService.getActiveTripForBus(busId);

          socket.emit('bus:initial_state', {
            busId,
            isActiveTrip: !!activeTrip,
            trip: activeTrip ? { id: activeTrip._id, direction: activeTrip.direction, startedAt: activeTrip.startedAt } : null,
            lastLocation: activeTrip ? bus?.lastLocation : null,
          });
        } catch (err) {
          console.error('[Socket] Error sending initial state:', err.message);
        }
      });

      socket.on('unsubscribe:bus', (data) => {
        const busId = data?.busId;
        if (busId) {
          socket.leave(`bus:${busId}`);
          console.log(`[Socket] User ${user.name} left room bus:${busId}`);
        }
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] Client disconnected: ${user.name} (${socket.id})`);
      });
    });

    return this.io;
  }

  /**
   * Broadcasts real-time location update to clients listening to this bus.
   */
  broadcastLocationUpdate(busId, pingData) {
    if (!this.io) return;
    this.io.to(`bus:${busId}`).emit('bus:location_update', {
      busId,
      tripId: pingData.tripId,
      lat: pingData.lat,
      lng: pingData.lng,
      speed: pingData.speed,
      heading: pingData.heading,
      timestamp: pingData.timestamp,
    });
  }

  /**
   * Broadcasts trip start event.
   */
  broadcastTripStarted(busId, tripData) {
    if (!this.io) return;
    this.io.to(`bus:${busId}`).emit('bus:trip_started', {
      busId,
      tripId: tripData._id,
      direction: tripData.direction,
      startedAt: tripData.startedAt,
    });
  }

  /**
   * Broadcasts trip end event.
   */
  broadcastTripEnded(busId, tripData) {
    if (!this.io) return;
    this.io.to(`bus:${busId}`).emit('bus:trip_ended', {
      busId,
      tripId: tripData._id,
      endedAt: tripData.endedAt,
      reason: tripData.autoEndedReason,
    });
  }
}

module.exports = new SocketManager();
