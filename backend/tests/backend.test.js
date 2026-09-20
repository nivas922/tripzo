const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const request = require('supertest');
const ioClient = require('socket.io-client');
const mongoose = require('mongoose');

const app = require('../src/app');
const config = require('../src/config');
const { connectDB, disconnectDB } = require('../src/config/db');
const socketManager = require('../src/sockets/socketManager');
const seed = require('../scripts/seed');
const Bus = require('../src/models/Bus');
const Trip = require('../src/models/Trip');
const LocationPing = require('../src/models/LocationPing');
const tripService = require('../src/services/tripService');

let server;
let testPort;
let seedData;
let tokens = {};

function withTimeout(promise, ms = 4000, msg = 'Socket event timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}

describe('Tripzo Phase 1 Live Bus GPS Tracking Backend Tests', () => {
  before(async () => {
    // 1. Connect to Database & Seed
    await connectDB();
    seedData = await seed();

    // 2. Start HTTP & Socket.IO server on ephemeral port for tests
    server = http.createServer(app);
    socketManager.init(server);

    await new Promise((resolve) => {
      server.listen(0, () => {
        testPort = server.address().port;
        console.log(`[Test Server] Running on port ${testPort}`);
        resolve();
      });
    });

    // 3. Obtain tokens for Driver, Student 1, Student 2, Other Student, Admin
    const users = [
      { key: 'driver', email: 'driver@tripzo.edu', password: 'DriverPass123!' },
      { key: 'student1', email: 'student1@tripzo.edu', password: 'StudentPass123!' },
      { key: 'student2', email: 'student2@tripzo.edu', password: 'StudentPass123!' },
      { key: 'studentOther', email: 'otherstudent@tripzo.edu', password: 'StudentPass123!' },
      { key: 'admin', email: 'admin@tripzo.edu', password: 'AdminPass123!' },
    ];

    for (const u of users) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: u.email, password: u.password });
      assert.strictEqual(res.status, 200, `Login failed for ${u.email}`);
      tokens[u.key] = res.body.token;
    }
  });

  after(async () => {
    if (socketManager) {
      socketManager.close();
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  test('1. Health Check Endpoint', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  test('2. Authentication & Driver Privacy Sanitization', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokens.driver}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.email, 'driver@tripzo.edu');
    assert.strictEqual(res.body.user.passwordHash, undefined, 'passwordHash must never be exposed');
    assert.strictEqual(res.body.user.phone, undefined, 'driver phone number must be private');
  });

  test('3. Ingest Location Ping REJECTED if no active trip (Driver Privacy Protection)', async () => {
    // Attempting to send ping without starting trip
    const res = await request(app)
      .post('/api/location/ping')
      .set('Authorization', `Bearer ${tokens.driver}`)
      .send({
        busId: seedData.bus1._id.toString(),
        lat: 12.8452,
        lng: 77.6602,
        speed: 30,
        heading: 90,
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.code, 'NO_ACTIVE_TRIP');
  });

  test('4. Driver Starts Trip Successfully', async () => {
    const res = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${tokens.driver}`)
      .send({
        direction: 'morning',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.trip.status, 'in_progress');
    assert.strictEqual(res.body.trip.direction, 'morning');
  });

  test('5. Source-Agnostic Telemetry: Ingest via Driver Smartphone JWT', async () => {
    const res = await request(app)
      .post('/api/location/ping')
      .set('Authorization', `Bearer ${tokens.driver}`)
      .send({
        busId: seedData.bus1._id.toString(),
        lat: 12.846,
        lng: 77.661,
        speed: 35,
        heading: 45,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.authSource, 'driver_phone');
    assert.strictEqual(res.body.ping.lat, 12.846);
    assert.strictEqual(res.body.ping.lng, 77.661);
  });

  test('6. Source-Agnostic Telemetry: Ingest via Hardware Tracker (x-device-token)', async () => {
    const res = await request(app)
      .post('/api/location/ping')
      .set('x-device-token', 'IOT-DEV-BUS-01')
      .send({
        lat: 12.86,
        lng: 77.65,
        speed: 40,
        heading: 50,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.authSource, 'hardware_tracker');
    assert.strictEqual(res.body.ping.lat, 12.86);

    // Verify Bus lastLocation was updated in DB
    const bus = await Bus.findById(seedData.bus1._id);
    assert.strictEqual(bus.lastLocation.lat, 12.86);
    assert.strictEqual(bus.lastLocation.speed, 40);
  });

  test('7. Batch Ping Ingestion (Offline reconnect buffer flush)', async () => {
    const res = await request(app)
      .post('/api/location/batch')
      .set('x-device-token', 'IOT-DEV-BUS-01')
      .send({
        pings: [
          { lat: 12.87, lng: 77.64, speed: 42, heading: 55, timestamp: new Date(Date.now() - 20000) },
          { lat: 12.88, lng: 77.63, speed: 45, heading: 60, timestamp: new Date(Date.now() - 10000) },
          { lat: 12.89, lng: 77.63, speed: 48, heading: 65, timestamp: new Date() },
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.count, 3);
  });

  test('8. Student Access Isolation: Allowed to query assigned bus, Forbidden on other buses', async () => {
    // Student 1 querying their assigned bus (Bus 1)
    const allowedRes = await request(app)
      .get(`/api/buses/${seedData.bus1._id}/live`)
      .set('Authorization', `Bearer ${tokens.student1}`);

    assert.strictEqual(allowedRes.status, 200);
    assert.strictEqual(allowedRes.body.bus.registrationNumber, 'KA-01-EA-2024');
    assert.strictEqual(allowedRes.body.bus.driver.name, 'Ramesh Kumar (Driver)');
    assert.strictEqual(allowedRes.body.bus.driver.phone, undefined, 'Driver phone must never be exposed');

    // Student 1 querying Bus 2 (KA-01-ZZ-9999) which they are NOT assigned to
    const forbiddenRes = await request(app)
      .get(`/api/buses/${seedData.bus2._id}/live`)
      .set('Authorization', `Bearer ${tokens.student1}`);

    assert.strictEqual(forbiddenRes.status, 403, 'Student must be rejected when querying unassigned bus');
    assert.strictEqual(forbiddenRes.body.success, false);
  });

  test('9. Student Stop ETA Calculations & Discrete States', async () => {
    // 9a. Simulate bus approaching Silk Board (located between Stop 0 and Stop 1)
    await request(app)
      .post('/api/location/ping')
      .set('x-device-token', 'IOT-DEV-BUS-01')
      .send({
        lat: 12.86,
        lng: 77.655,
        speed: 35,
        heading: 45,
      });

    const etaRes1 = await request(app)
      .get('/api/students/me/eta')
      .set('Authorization', `Bearer ${tokens.student1}`);

    assert.strictEqual(etaRes1.status, 200);
    assert.strictEqual(etaRes1.body.eta.status, 'Approaching');
    assert.strictEqual(etaRes1.body.eta.stopName, 'Silk Board Junction');
    assert.ok(etaRes1.body.eta.etaMinutes > 0, 'ETA should be greater than 0');

    // Now simulate bus arriving at Silk Board Junction (within 200m)
    await request(app)
      .post('/api/location/ping')
      .set('x-device-token', 'IOT-DEV-BUS-01')
      .send({
        lat: 12.9172,
        lng: 77.6228,
        speed: 5,
        heading: 90,
      });

    const etaRes2 = await request(app)
      .get('/api/students/me/eta')
      .set('Authorization', `Bearer ${tokens.student1}`);

    assert.strictEqual(etaRes2.status, 200);
    assert.strictEqual(etaRes2.body.eta.status, 'Arrived');
    assert.strictEqual(etaRes2.body.eta.etaMinutes, 0);

    // Now simulate bus moving past Silk Board to Bellandur (Stop 4: 12.9260, 77.6762)
    await request(app)
      .post('/api/location/ping')
      .set('x-device-token', 'IOT-DEV-BUS-01')
      .send({
        lat: 12.926,
        lng: 77.6762,
        speed: 35,
        heading: 90,
      });

    // Student 1 (Silk Board) should now see "Departed your stop"
    const etaRes3 = await request(app)
      .get('/api/students/me/eta')
      .set('Authorization', `Bearer ${tokens.student1}`);

    assert.strictEqual(etaRes3.status, 200);
    assert.strictEqual(etaRes3.body.eta.status, 'Departed your stop');

    // But Student 2 (Bellandur) should see "Arrived"
    const etaRes4 = await request(app)
      .get('/api/students/me/eta')
      .set('Authorization', `Bearer ${tokens.student2}`);

    assert.strictEqual(etaRes4.status, 200);
    assert.strictEqual(etaRes4.body.eta.status, 'Arrived');
  });

  test('10. Real-time WebSocket: Handshake, Student Isolation, and Live Fan-out', async () => {
    const socketUrl = `http://localhost:${testPort}`;

    // Connect authorized student
    const studentSocket = ioClient(socketUrl, {
      auth: { token: tokens.student1 },
      transports: ['websocket'],
    });

    await withTimeout(new Promise((resolve) => studentSocket.on('connect', resolve)));
    assert.ok(studentSocket.connected, 'Socket connected successfully');

    // 10a. Verify student cannot subscribe to unassigned bus
    let unauthorizedTriggered = false;
    await withTimeout(new Promise((resolve) => {
      studentSocket.emit('subscribe:bus', { busId: seedData.bus2._id.toString() });
      studentSocket.on('error:unauthorized', (err) => {
        unauthorizedTriggered = true;
        resolve();
      });
    }));
    assert.strictEqual(unauthorizedTriggered, true, 'Student was correctly prevented from subscribing to unassigned bus');

    // 10b. Subscribe to assigned bus and receive initial state
    let receivedInitial = false;
    await withTimeout(new Promise((resolve) => {
      studentSocket.emit('subscribe:bus', { busId: seedData.bus1._id.toString() });
      studentSocket.on('bus:initial_state', (data) => {
        assert.strictEqual(data.busId, seedData.bus1._id.toString());
        assert.strictEqual(data.isActiveTrip, true);
        receivedInitial = true;
        resolve();
      });
    }));
    assert.strictEqual(receivedInitial, true);

    // 10c. Send a location ping and verify real-time WebSocket broadcast received
    const pingPromise = withTimeout(new Promise((resolve) => {
      studentSocket.on('bus:location_update', (data) => {
        assert.strictEqual(data.busId, seedData.bus1._id.toString());
        assert.strictEqual(data.lat, 12.93);
        assert.strictEqual(data.lng, 77.68);
        resolve();
      });
    }));

    await request(app)
      .post('/api/location/ping')
      .set('x-device-token', 'IOT-DEV-BUS-01')
      .send({
        lat: 12.93,
        lng: 77.68,
        speed: 38,
        heading: 80,
      });

    await pingPromise;
    studentSocket.disconnect();
  });

  test('11. Safeguard: Automatic Trip Termination after 3 Hours', async () => {
    // Find active trip for Bus 1 and backdate startedAt to 3.5 hours ago
    const activeTrip = await Trip.findOne({ busId: seedData.bus1._id, status: 'in_progress' });
    assert.ok(activeTrip, 'Active trip should exist');

    activeTrip.startedAt = new Date(Date.now() - 3.5 * 60 * 60 * 1000); // 3.5 hours ago
    await activeTrip.save();

    // Query active trip through tripService
    const resolvedTrip = await tripService.getActiveTripForBus(seedData.bus1._id);
    assert.strictEqual(resolvedTrip, null, 'Trip exceeding 3 hours should be returned as null');

    // Verify trip document was updated in database
    const updatedTrip = await Trip.findById(activeTrip._id);
    assert.strictEqual(updatedTrip.status, 'completed');
    assert.strictEqual(updatedTrip.autoEndedReason, 'max_duration_exceeded');
  });

  test('12. MongoDB TTL Index on LocationPing for 7-Day History Purge', async () => {
    const indexes = LocationPing.schema.indexes();
    const ttlIndex = indexes.find(
      (idx) => idx[0].timestamp === 1 && idx[1] && idx[1].expireAfterSeconds === 7 * 24 * 60 * 60
    );

    assert.ok(ttlIndex, 'LocationPing schema must have a 7-day TTL index on timestamp');
  });
});
