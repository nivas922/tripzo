const socketIO = require('socket.io');
const Bus = require('../models/Bus');
const tripService = require('../services/tripService');

class TrackingSocketManager {
  constructor() {
    this.io = null;
    this.authProvider = null;
  }

  /**
   * Initializes Socket.IO with pluggable AuthProvider authentication.
   *
   * @param {import('http').Server} httpServer
   * @param {import('../../auth/AuthProvider')} authProvider
   */
  init(httpServer, authProvider) {
    this.authProvider = authProvider;
    this.io = socketIO(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    // Handshake Authentication via injected AuthProvider
    this.io.use(async (socket, next) => {
      if (!this.authProvider) {
        return next(new Error('No AuthProvider configured for tracking sockets'));
      }

      try {
        const user = await this.authProvider.authenticateSocket(socket);
        socket.user = user;
        next();
      } catch (err) {
        return next(new Error(err.message || 'Socket authentication failed'));
      }
    });

    this.io.on('connection', (socket) => {
      const user = socket.user;
      console.log(`[TrackingSocket] Client connected: ${user.name} (${user.role}), socketId: ${socket.id}`);

      socket.on('subscribe:bus', async (data) => {
        const busId = data?.busId;
        if (!busId) {
          return socket.emit('error:bus', { message: 'busId is required to subscribe' });
        }

        // Student Privacy Guard:
        // A student can ONLY listen to their assigned bus
        if ((user.role || '').toLowerCase() === 'student') {
          if (!user.assignedBusId || user.assignedBusId.toString() !== busId.toString()) {
            return socket.emit('error:unauthorized', {
              message: 'Forbidden: You can only track your assigned bus',
            });
          }
        }

        const room = `bus:${busId}`;
        socket.join(room);
        console.log(`[TrackingSocket] User ${user.name} joined room ${room}`);

        // Send current initial state upon subscription
        try {
          const bus = await Bus.findById(busId).select('-assignedDriverId');
          const activeTrip = await tripService.getActiveTripForBus(busId);

          socket.emit('bus:initial_state', {
            busId,
            isActiveTrip: !!activeTrip,
            trip: activeTrip
              ? { id: activeTrip._id, direction: activeTrip.direction, startedAt: activeTrip.startedAt }
              : null,
            lastLocation: activeTrip ? bus?.lastLocation : null,
          });
        } catch (err) {
          console.error('[TrackingSocket] Error sending initial state:', err.message);
        }
      });

      socket.on('unsubscribe:bus', (data) => {
        const busId = data?.busId;
        if (busId) {
          socket.leave(`bus:${busId}`);
          console.log(`[TrackingSocket] User ${user.name} left room bus:${busId}`);
        }
      });

      socket.on('disconnect', () => {
        console.log(`[TrackingSocket] Client disconnected: ${user.name} (${socket.id})`);
      });
    });

    return this.io;
  }

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

  broadcastTripStarted(busId, tripData) {
    if (!this.io) return;
    this.io.to(`bus:${busId}`).emit('bus:trip_started', {
      busId,
      tripId: tripData._id,
      direction: tripData.direction,
      startedAt: tripData.startedAt,
    });
  }

  broadcastTripEnded(busId, tripData) {
    if (!this.io) return;
    this.io.to(`bus:${busId}`).emit('bus:trip_ended', {
      busId,
      tripId: tripData._id,
      endedAt: tripData.endedAt,
      reason: tripData.autoEndedReason,
    });
  }

  close() {
    if (this.io) {
      this.io.close();
      this.io = null;
    }
  }
}

module.exports = TrackingSocketManager;
