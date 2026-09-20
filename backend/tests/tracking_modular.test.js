const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const request = require('supertest');
const ioClient = require('socket.io-client');
const mongoose = require('mongoose');

const { createApp } = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const JwtAuthProvider = require('../src/modules/auth/JwtAuthProvider');
const AuthProvider = require('../src/modules/auth/AuthProvider');
const TrackingSocketManager = require('../src/modules/tracking/sockets/trackingSocket');
const Bus = require('../src/modules/tracking/models/Bus');
const Trip = require('../src/modules/tracking/models/Trip');
const LocationPing = require('../src/modules/tracking/models/LocationPing');
const StudentProfile = require('../src/modules/tracking/models/StudentProfile');
const tripService = require('../src/modules/tracking/services/tripService');
const seed = require('../scripts/seed');

let server;
let testPort;
let seedData;
let jwtProvider;
let trackingSocketManager;
let tokens = {};

function withTimeout(promise, ms = 4000, msg = 'Socket event timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

describe('TripZo Live - Modular & Merge-Ready Tracking Architecture Tests', () => {
  before(async () => {
    await connectDB();
    seedData = await seed();

    jwtProvider = new JwtAuthProvider();
    trackingSocketManager = new TrackingSocketManager();

    app = createApp({
      authProvider: jwtProvider,
      socketManager: trackingSocketManager,
    });

    server = http.createServer(app);
    trackingSocketManager.init(server, jwtProvider);

    await new Promise((resolve) => {
      server.listen(0, () => {
        testPort = server.address().port;
        resolve();
      });
    });

    // Obtain test JWT tokens
    const users = [
      { key: 'driver', email: 'driver@tripzo.edu', password: 'DriverPass123!' },
      { key: 'student1', email: 'student1@tripzo.edu', password: 'StudentPass123!' },
      { key: 'student2', email: 'student2@tripzo.edu', password: 'StudentPass123!' },
      { key: 'studentOther', email: 'otherstudent@tripzo.edu', password: 'StudentPass123!' },
      { key: 'admin', email: 'admin@tripzo.edu', password: 'AdminPass123!' },
    ];

    for (const u of users) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: u.email, password: u.password });
      assert.strictEqual(res.status, 200);
      tokens[u.key] = res.body.token;
    }
  });

  after(async () => {
    if (trackingSocketManager) {
      trackingSocketManager.close();
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  test('1. OpenAPI Specification & Swagger UI Availability', async () => {
    const docsRes = await request(app).get('/api/docs.json');
    assert.strictEqual(docsRes.status, 200);
    assert.strictEqual(docsRes.body.openapi, '3.0.3');
    assert.strictEqual(docsRes.body.info.title, 'TripZo Live - Bus Telemetry & Fleet Tracking API');
    assert.ok(docsRes.body.paths['/tracking/location/ping']);
  });

  test('2. Pluggable AuthProvider: Custom Host Provider Verification', async () => {
    // Custom AuthProvider simulating host TripZo attendance app
    class MockHostAuthProvider extends AuthProvider {
      async authenticate(req) {
        if (req.headers['x-host-token'] === 'valid-host-driver') {
          return {
            id: 'host-driver-101',
            role: 'driver',
            externalId: 'TRIPZO-DRV-501',
            assignedBusId: seedData.bus1._id.toString(),
            name: 'Host Driver Ramesh',
          };
        }
        const err = new Error('Host app authentication failed');
        err.statusCode = 401;
        throw err;
      }

      async authenticateSocket(socket) {
        return {
          id: 'host-driver-101',
          role: 'driver',
          assignedBusId: seedData.bus1._id.toString(),
          name: 'Host Driver Ramesh',
        };
      }
    }

    const hostApp = createApp({
      authProvider: new MockHostAuthProvider(),
    });

    // Request with host token succeeds
    const successRes = await request(hostApp)
      .get('/api/v1/tracking/trips/active')
      .set('x-host-token', 'valid-host-driver');
    assert.strictEqual(successRes.status, 200);

    // Request with invalid token fails with 401
    const failRes = await request(hostApp)
      .get('/api/v1/tracking/trips/active')
      .set('x-host-token', 'invalid-token');
    assert.strictEqual(failRes.status, 401);
  });

  test('3. Decoupled StudentProfile with externalStudentId Mapping', async () => {
    const profile = await StudentProfile.findOne({ externalStudentId: 'TRIPZO-STU-1001' });
    assert.ok(profile, 'StudentProfile must be queryable by externalStudentId');
    assert.strictEqual(profile.assignedBusId.toString(), seedData.bus1._id.toString());
    assert.strictEqual(profile.homeStopId.toString(), seedData.route.stops[1]._id.toString());
  });

  test('4. Telemetry Safeguard: Pings REJECTED outside active trip', async () => {
    const res = await request(app)
      .post('/api/v1/tracking/location/ping')
      .set('Authorization', `Bearer ${tokens.driver}`)
      .send({
        busId: seedData.bus1._id.toString(),
        lat: 12.8452,
        lng: 77.6602,
        speed: 25,
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'NO_ACTIVE_TRIP');
  });

  test('5. Driver Starts Trip Successfully', async () => {
    const res = await request(app)
      .post('/api/v1/tracking/trips/start')
      .set('Authorization', `Bearer ${tokens.driver}`)
      .send({ direction: 'morning' });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.trip.status, 'in_progress');
  });

  test('6. Source-Agnostic Telemetry: Ingest via Smartphone JWT & Hardware IoT Token', async () => {
    // 6a. Smartphone ingest via Bearer JWT
    const phoneRes = await request(app)
      .post('/api/v1/tracking/location/ping')
      .set('Authorization', `Bearer ${tokens.driver}`)
      .send({
        busId: seedData.bus1._id.toString(),
        lat: 12.85,
        lng: 77.658,
        speed: 30,
        heading: 40,
      });

    assert.strictEqual(phoneRes.status, 201);
    assert.strictEqual(phoneRes.body.authSource, 'driver_phone');

    // 6b. Hardware tracker ingest via x-device-token
    const deviceRes = await request(app)
      .post('/api/v1/tracking/location/ping')
      .set('x-device-token', 'IOT-DEV-BUS-01')
      .send({
        lat: 12.86,
        lng: 77.655,
        speed: 38,
        heading: 45,
      });

    assert.strictEqual(deviceRes.status, 201);
    assert.strictEqual(deviceRes.body.authSource, 'hardware_tracker');
  });

  test('7. Offline Reconnect Buffer Flush (/tracking/location/batch)', async () => {
    const res = await request(app)
      .post('/api/v1/tracking/location/batch')
      .set('x-device-token', 'IOT-DEV-BUS-01')
      .send({
        pings: [
          { lat: 12.862, lng: 77.654, speed: 40, heading: 50 },
          { lat: 12.865, lng: 77.652, speed: 42, heading: 55 },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.count, 2);
  });

  test('8. Student Isolation & Driver Privacy Protection', async () => {
    // Allowed: Student 1 queries Bus 1
    const allowed = await request(app)
      .get(`/api/v1/tracking/buses/${seedData.bus1._id}/live`)
      .set('Authorization', `Bearer ${tokens.student1}`);

    assert.strictEqual(allowed.status, 200);
    assert.strictEqual(allowed.body.bus.registrationNumber, 'KA-01-EA-2024');
    assert.strictEqual(allowed.body.bus.driver.phone, undefined, 'Driver phone must never be exposed');

    // Forbidden: Student 1 queries Bus 2
    const forbidden = await request(app)
      .get(`/api/v1/tracking/buses/${seedData.bus2._id}/live`)
      .set('Authorization', `Bearer ${tokens.student1}`);

    assert.strictEqual(forbidden.status, 403);
  });

  test('9. Discrete Stop ETA Calculations', async () => {
    // 9a. Approaching Silk Board
    await request(app)
      .post('/api/v1/tracking/location/ping')
      .set('x-device-token', 'IOT-DEV-BUS-01')
      .send({ lat: 12.86, lng: 77.655, speed: 35 });

    const etaRes1 = await request(app)
      .get('/api/v1/tracking/students/me/eta')
      .set('Authorization', `Bearer ${tokens.student1}`);

    assert.strictEqual(etaRes1.status, 200);
    assert.strictEqual(etaRes1.body.eta.status, 'Approaching');

    // 9b. Arrived at Silk Board (within 250m)
    await request(app)
      .post('/api/v1/tracking/location/ping')
      .set('x-device-token', 'IOT-DEV-BUS-01')
      .send({ lat: 12.9172, lng: 77.6228, speed: 0 });

    const etaRes2 = await request(app)
      .get('/api/v1/tracking/students/me/eta')
      .set('Authorization', `Bearer ${tokens.student1}`);

    assert.strictEqual(etaRes2.status, 200);
    assert.strictEqual(etaRes2.body.eta.status, 'Arrived');

    // 9c. Departed Silk Board & approaching Bellandur
    await request(app)
      .post('/api/v1/tracking/location/ping')
      .set('x-device-token', 'IOT-DEV-BUS-01')
      .send({ lat: 12.926, lng: 77.6762, speed: 30 });

    const etaRes3 = await request(app)
      .get('/api/v1/tracking/students/me/eta')
      .set('Authorization', `Bearer ${tokens.student1}`);

    assert.strictEqual(etaRes3.status, 200);
    assert.strictEqual(etaRes3.body.eta.status, 'Departed your stop');
  });

  test('10. Real-time WebSocket: Handshake, Isolation & Live Fan-out', async () => {
    const socketUrl = `http://localhost:${testPort}`;

    const studentSocket = ioClient(socketUrl, {
      auth: { token: tokens.student1 },
      transports: ['websocket'],
    });

    await withTimeout(new Promise((resolve) => studentSocket.on('connect', resolve)));
    assert.ok(studentSocket.connected);

    // Verify isolation on unassigned bus
    let unauthorized = false;
    await withTimeout(new Promise((resolve) => {
      studentSocket.emit('subscribe:bus', { busId: seedData.bus2._id.toString() });
      studentSocket.on('error:unauthorized', () => {
        unauthorized = true;
        resolve();
      });
    }));
    assert.strictEqual(unauthorized, true);

    // Subscribe to assigned bus
    let gotInitial = false;
    await withTimeout(new Promise((resolve) => {
      studentSocket.emit('subscribe:bus', { busId: seedData.bus1._id.toString() });
      studentSocket.on('bus:initial_state', (data) => {
        assert.strictEqual(data.busId, seedData.bus1._id.toString());
        gotInitial = true;
        resolve();
      });
    }));
    assert.strictEqual(gotInitial, true);

    // Broadcast test
    const pingPromise = withTimeout(new Promise((resolve) => {
      studentSocket.on('bus:location_update', (data) => {
        assert.strictEqual(data.busId, seedData.bus1._id.toString());
        assert.strictEqual(data.lat, 12.93);
        resolve();
      });
    }));

    await request(app)
      .post('/api/v1/tracking/location/ping')
      .set('x-device-token', 'IOT-DEV-BUS-01')
      .send({ lat: 12.93, lng: 77.68, speed: 35 });

    await pingPromise;
    studentSocket.disconnect();
  });

  test('11. 3-Hour Maximum Trip Duration Auto-Cutoff', async () => {
    const activeTrip = await Trip.findOne({ busId: seedData.bus1._id, status: 'in_progress' });
    assert.ok(activeTrip);

    activeTrip.startedAt = new Date(Date.now() - 3.5 * 60 * 60 * 1000);
    await activeTrip.save();

    const resolvedTrip = await tripService.getActiveTripForBus(seedData.bus1._id);
    assert.strictEqual(resolvedTrip, null);

    const updated = await Trip.findById(activeTrip._id);
    assert.strictEqual(updated.status, 'completed');
    assert.strictEqual(updated.autoEndedReason, 'max_duration_exceeded');
  });

  test('12. MongoDB TTL Index on LocationPing (7 Days)', async () => {
    const indexes = LocationPing.schema.indexes();
    const ttlIndex = indexes.find(
      (idx) => idx[0].timestamp === 1 && idx[1] && idx[1].expireAfterSeconds === 7 * 24 * 60 * 60
    );
    assert.ok(ttlIndex, 'Must possess 7-day TTL index on timestamp');
  });
});
