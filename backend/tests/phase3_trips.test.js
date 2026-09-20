const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const request = require('supertest');
const mongoose = require('mongoose');

const defaultApp = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const StudentProfile = require('../src/models/StudentProfile');
const DriverProfile = require('../src/models/DriverProfile');
const Bus = require('../src/models/Bus');
const Route = require('../src/models/Route');
const Trip = require('../src/models/Trip');
const tripService = require('../src/services/tripService');

let server;
let app;
let adminToken;
let driver1Token;
let driver2Token;
let student1Token;
let student2Token;
let bus1;
let bus2;
let bus1Id;
let bus2Id;
let route1;
let route1Id;
let activeTripId;

describe('College Bus Live GPS Tracking System - Phase 3: Trip Management Lifecycle', () => {
  before(async () => {
    await connectDB();

    await Promise.all([
      User.deleteMany({}),
      StudentProfile.deleteMany({}),
      DriverProfile.deleteMany({}),
      Bus.deleteMany({}),
      Route.deleteMany({}),
      Trip.deleteMany({}),
    ]);

    app = defaultApp;
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    // Register Admin
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Fleet Admin',
        email: 'admin.trips@tripzo.edu',
        password: 'AdminPassword123!',
        role: 'ADMIN',
      });
    assert.strictEqual(adminRes.status, 201);
    adminToken = adminRes.body.token;

    // Register Driver 1
    const d1Res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Ramesh Patel',
        email: 'ramesh.driver@tripzo.edu',
        password: 'DriverPassword123!',
        role: 'DRIVER',
        employeeId: 'EMP-DRV-101',
      });
    assert.strictEqual(d1Res.status, 201);
    driver1Token = d1Res.body.token;
    const driver1UserId = (d1Res.body.user._id || d1Res.body.user.id).toString();

    // Register Driver 2
    const d2Res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Suresh Kumar',
        email: 'suresh.driver@tripzo.edu',
        password: 'DriverPassword123!',
        role: 'DRIVER',
        employeeId: 'EMP-DRV-102',
      });
    assert.strictEqual(d2Res.status, 201);
    driver2Token = d2Res.body.token;
    const driver2UserId = (d2Res.body.user._id || d2Res.body.user.id).toString();

    // Register Student 1
    const s1Res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Ananya Roy',
        email: 'ananya.student@tripzo.edu',
        password: 'StudentPassword123!',
        role: 'STUDENT',
        studentId: 'STU-TRIP-001',
      });
    assert.strictEqual(s1Res.status, 201);
    student1Token = s1Res.body.token;
    const student1UserId = (s1Res.body.user._id || s1Res.body.user.id).toString();

    // Register Student 2
    const s2Res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Kavya Sharma',
        email: 'kavya.student@tripzo.edu',
        password: 'StudentPassword123!',
        role: 'STUDENT',
        studentId: 'STU-TRIP-002',
      });
    assert.strictEqual(s2Res.status, 201);
    student2Token = s2Res.body.token;
    const student2UserId = (s2Res.body.user._id || s2Res.body.user.id).toString();

    // Admin creates Route with Stops
    const routeRes = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Express Route 42',
        routeNumber: 'R-42',
        description: 'Hostel to Main Campus Express',
        stops: [
          { name: 'Hostel Block A', latitude: 12.91, longitude: 77.61, sequence: 1, pickupTime: '07:30' },
          { name: 'Silk Board Junction', latitude: 12.917, longitude: 77.623, sequence: 2, pickupTime: '07:50' },
          { name: 'Tech Park Gate 2', latitude: 12.925, longitude: 77.635, sequence: 3, pickupTime: '08:15' },
        ],
      });
    assert.strictEqual(routeRes.status, 201);
    route1 = routeRes.body.route;
    route1Id = (route1._id || route1.id).toString();

    // Admin creates Bus 1 (KA-05-AA-1111) assigned to Driver 1 and Route 1
    const b1Res = await request(app)
      .post('/api/buses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        busNumber: 'Bus 101',
        registrationNumber: 'KA-05-AA-1111',
        capacity: 45,
        deviceToken: 'DEV-BUS-101',
        routeId: route1Id,
        driverId: driver1UserId,
      });
    assert.strictEqual(b1Res.status, 201);
    bus1 = b1Res.body.bus;
    bus1Id = (bus1._id || bus1.id).toString();

    // Admin creates Bus 2 (KA-05-BB-2222) assigned to Driver 2 and Route 1
    const b2Res = await request(app)
      .post('/api/buses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        busNumber: 'Bus 202',
        registrationNumber: 'KA-05-BB-2222',
        capacity: 50,
        deviceToken: 'DEV-BUS-202',
        routeId: route1Id,
        driverId: driver2UserId,
      });
    assert.strictEqual(b2Res.status, 201);
    bus2 = b2Res.body.bus;
    bus2Id = (bus2._id || bus2.id).toString();

    // Assign Student 1 to Bus 1
    await request(app)
      .put(`/api/students/${student1UserId}/assignment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        assignedBusId: bus1Id,
        busId: bus1Id,
        assignedRouteId: route1Id,
        routeId: route1Id,
        homeStopId: (route1.stops[1]._id || route1.stops[1].id).toString(),
      });

    // Refresh Student 1 token so assignedBusId is updated in JWT
    const s1Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ananya.student@tripzo.edu', password: 'StudentPassword123!' });
    student1Token = s1Login.body.token;

    // Assign Student 2 to Bus 2
    await request(app)
      .put(`/api/students/${student2UserId}/assignment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        assignedBusId: bus2Id,
        busId: bus2Id,
        assignedRouteId: route1Id,
        routeId: route1Id,
        homeStopId: (route1.stops[2]._id || route1.stops[2].id).toString(),
      });

    // Refresh Student 2 token
    const s2Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'kavya.student@tripzo.edu', password: 'StudentPassword123!' });
    student2Token = s2Login.body.token;

    // Refresh Driver 1 token so assignedBusId is updated in JWT
    const d1Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ramesh.driver@tripzo.edu', password: 'DriverPassword123!' });
    driver1Token = d1Login.body.token;

    // Refresh Driver 2 token
    const d2Login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'suresh.driver@tripzo.edu', password: 'DriverPassword123!' });
    driver2Token = d2Login.body.token;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  test('1. Driver 1 Starts Trip for Assigned Bus 1 (POST /api/trips/start)', async () => {
    const res = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({
        busId: bus1Id,
        direction: 'morning',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.trip);
    assert.strictEqual(res.body.trip.busId.toString(), bus1Id);
    assert.ok(['in_progress', 'RUNNING'].includes(res.body.trip.status));
    activeTripId = (res.body.trip._id || res.body.trip.id).toString();
  });

  test('2. Unassigned Driver 2 Blocked from Starting Trip for Bus 1 (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${driver2Token}`)
      .send({
        busId: bus1Id,
        direction: 'morning',
      });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /not assigned to this bus/i);
  });

  test('3. Duplicate Trip Start Prevention: Idempotent Trip Handling', async () => {
    const res = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({
        busId: bus1Id,
        direction: 'morning',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.match(res.body.message, /already in progress/i);
    assert.strictEqual((res.body.trip._id || res.body.trip.id).toString(), activeTripId);
  });

  test('4. RBAC: Student Blocked from Starting a Trip (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${student1Token}`)
      .send({
        busId: bus1Id,
      });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('5. Student 1 Queries Active Trip for Assigned Bus 1 (GET /api/trips/active)', async () => {
    const res = await request(app)
      .get(`/api/trips/active?busId=${bus1Id}`)
      .set('Authorization', `Bearer ${student1Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.activeTrip);
    assert.strictEqual((res.body.activeTrip._id || res.body.activeTrip.id).toString(), activeTripId);
  });

  test('6. Student 1 Forbidden from Querying Active Trip for Unassigned Bus 2', async () => {
    const res = await request(app)
      .get(`/api/trips/active?busId=${bus2Id}`)
      .set('Authorization', `Bearer ${student1Token}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /only view your assigned bus/i);
  });

  test('7. Driver 1 Pauses Active Trip (POST /api/trips/:id/pause)', async () => {
    const res = await request(app)
      .post(`/api/trips/${activeTripId}/pause`)
      .set('Authorization', `Bearer ${driver1Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.trip.status, 'PAUSED');
  });

  test('8. Driver 2 Forbidden from Pausing Driver 1 Trip (403 Forbidden)', async () => {
    const res = await request(app)
      .post(`/api/trips/${activeTripId}/pause`)
      .set('Authorization', `Bearer ${driver2Token}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /not assigned to this bus/i);
  });

  test('9. Driver 1 Resumes Paused Trip (POST /api/trips/:id/resume)', async () => {
    const res = await request(app)
      .post(`/api/trips/${activeTripId}/resume`)
      .set('Authorization', `Bearer ${driver1Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.trip.status, 'RUNNING');
  });

  test('10. Retrieve Trip by ID with Populated Associations (GET /api/trips/:id)', async () => {
    const res = await request(app)
      .get(`/api/trips/${activeTripId}`)
      .set('Authorization', `Bearer ${driver1Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual((res.body.trip._id || res.body.trip.id).toString(), activeTripId);
    assert.strictEqual(res.body.trip.busId.registrationNumber, 'KA-05-AA-1111');
    assert.strictEqual(res.body.trip.routeId.name, 'Express Route 42');
  });

  test('11. Student 2 Forbidden from Viewing Student 1 Bus Trip Details by ID (403)', async () => {
    const res = await request(app)
      .get(`/api/trips/${activeTripId}`)
      .set('Authorization', `Bearer ${student2Token}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /only view trips for your assigned bus/i);
  });

  test('12. Driver 1 Ends Active Trip (POST /api/trips/end)', async () => {
    const res = await request(app)
      .post('/api/trips/end')
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({
        busId: bus1Id,
        reason: 'morning_route_completed',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.trip.status, 'completed');
    assert.strictEqual(res.body.trip.autoEndedReason, 'morning_route_completed');
    assert.ok(res.body.trip.endedAt);
  });

  test('13. Rejection of Ending Trip When None Active (404 Not Found)', async () => {
    const res = await request(app)
      .post('/api/trips/end')
      .set('Authorization', `Bearer ${driver1Token}`)
      .send({
        busId: bus1Id,
      });

    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.message, /no active trip found/i);
  });

  test('14. Admin Lists Trip History with Filtering & Pagination (GET /api/trips)', async () => {
    const res = await request(app)
      .get(`/api/trips?busId=${bus1Id}&limit=10&skip=0`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.trips));
    assert.strictEqual(res.body.total, 1);
    assert.strictEqual(res.body.count, 1);
    assert.strictEqual((res.body.trips[0]._id || res.body.trips[0].id).toString(), activeTripId);
  });

  test('15. RBAC: Student Blocked from Listing Full Trips History (403 Forbidden)', async () => {
    const res = await request(app)
      .get('/api/trips')
      .set('Authorization', `Bearer ${student1Token}`);

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('16. Safeguard: Automatic Trip Termination after Exceeding 3 Hours', async () => {
    const startRes = await request(app)
      .post('/api/trips/start')
      .set('Authorization', `Bearer ${driver2Token}`)
      .send({
        busId: bus2Id,
        direction: 'morning',
      });
    assert.strictEqual(startRes.status, 201);
    const bus2TripId = (startRes.body.trip._id || startRes.body.trip.id).toString();

    const tripToAge = await Trip.findById(bus2TripId);
    assert.ok(tripToAge);
    tripToAge.startedAt = new Date(Date.now() - 3.5 * 60 * 60 * 1000);
    await tripToAge.save();

    const active = await tripService.getActiveTripForBus(bus2Id);
    assert.strictEqual(active, null, 'Trip older than 3 hours must not be active');

    const terminatedTrip = await Trip.findById(bus2TripId);
    assert.strictEqual(terminatedTrip.status, 'completed');
    assert.strictEqual(terminatedTrip.autoEndedReason, 'max_duration_exceeded');
    assert.ok(terminatedTrip.endedAt);
  });
});
