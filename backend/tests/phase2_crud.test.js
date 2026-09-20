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

let server;
let app;
let adminToken;
let studentToken;
let driverToken;
let testDriverUser;
let testStudentUser;

describe('College Bus Live GPS Tracking System - Phase 2: Bus & Route Management CRUD', () => {
  before(async () => {
    await connectDB();

    await Promise.all([
      User.deleteMany({}),
      StudentProfile.deleteMany({}),
      DriverProfile.deleteMany({}),
      Bus.deleteMany({}),
      Route.deleteMany({}),
    ]);

    app = defaultApp;
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));

    // Register Admin
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Super Admin',
        email: 'admin.fleet@tripzo.edu',
        password: 'AdminPassword123!',
        role: 'ADMIN',
      });
    assert.strictEqual(adminRes.status, 201);
    adminToken = adminRes.body.token;

    // Register Driver
    const driverRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Suresh Raina (Driver)',
        email: 'suresh.driver@tripzo.edu',
        password: 'DriverPassword123!',
        role: 'DRIVER',
        employeeId: 'EMP-DRV-901',
      });
    assert.strictEqual(driverRes.status, 201);
    driverToken = driverRes.body.token;
    testDriverUser = driverRes.body.user;

    // Register Student
    const studentRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Ananya Roy',
        email: 'ananya.roy@tripzo.edu',
        password: 'StudentPassword123!',
        role: 'STUDENT',
        studentId: 'STU-2026-901',
      });
    assert.strictEqual(studentRes.status, 201);
    studentToken = studentRes.body.token;
    testStudentUser = studentRes.body.user;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  let createdBusId;
  let createdRouteId;
  let addedStopId;

  // --- 1. Bus CRUD Tests ---

  test('1. Admin Creates a New Bus (POST /api/buses)', async () => {
    const res = await request(app)
      .post('/api/buses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        busNumber: 'Bus 42',
        registrationNumber: 'KA-05-TR-2026',
        capacity: 45,
        deviceToken: 'IOT-DEV-TEST-42',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.bus.busNumber, 'Bus 42');
    assert.strictEqual(res.body.bus.registrationNumber, 'KA-05-TR-2026');
    assert.strictEqual(res.body.bus.capacity, 45);
    createdBusId = res.body.bus._id;
  });

  test('2. Duplicate Bus Registration Number Rejection', async () => {
    const res = await request(app)
      .post('/api/buses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        busNumber: 'Bus 42-Duplicate',
        registrationNumber: 'KA-05-TR-2026',
      });

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.success, false);
  });

  test('3. Missing Required Bus Fields Rejection', async () => {
    const res = await request(app)
      .post('/api/buses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        busNumber: 'Bus Only',
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  test('4. Admin Retrieves All Buses (GET /api/buses)', async () => {
    const res = await request(app)
      .get('/api/buses')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.buses.length >= 1);
    const found = res.body.buses.find((b) => b._id.toString() === createdBusId);
    assert.ok(found, 'Created bus must exist in all buses list');
  });

  test('5. Retrieve Bus by ID (GET /api/buses/:id)', async () => {
    const res = await request(app)
      .get(`/api/buses/${createdBusId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.bus.registrationNumber, 'KA-05-TR-2026');
  });

  // --- 2. Route CRUD Tests ---

  test('6. Admin Creates a New Route with Sequenced Stops (POST /api/routes)', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Route 8 - Central Express',
        routeNumber: 'R8',
        startingPoint: 'Majestic Station',
        endingPoint: 'Engineering College Gate',
        stops: [
          { name: 'Majestic Station', latitude: 12.9767, longitude: 77.5713, sequence: 1, expectedTime: '07:30 AM' },
          { name: 'Corporation Circle', latitude: 12.9698, longitude: 77.5898, sequence: 2, expectedTime: '07:45 AM' },
          { name: 'Engineering College Gate', latitude: 12.9100, longitude: 77.6400, sequence: 3, expectedTime: '08:20 AM' },
        ],
        routePolyline: [
          [77.5713, 12.9767],
          [77.5898, 12.9698],
          [77.6400, 12.9100],
        ],
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.route.routeNumber, 'R8');
    assert.strictEqual(res.body.route.stops.length, 3);
    assert.strictEqual(res.body.route.stops[0].sequence, 1);
    createdRouteId = res.body.route._id;
  });

  test('7. Duplicate Route Number Rejection', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Different Route Name',
        routeNumber: 'R8',
      });

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.success, false);
  });

  test('8. Retrieve All Routes & Route by ID (GET /api/routes)', async () => {
    const allRes = await request(app)
      .get('/api/routes')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(allRes.status, 200);
    assert.ok(allRes.body.routes.length >= 1);

    const singleRes = await request(app)
      .get(`/api/routes/${createdRouteId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(singleRes.status, 200);
    assert.strictEqual(singleRes.body.route.name, 'Route 8 - Central Express');
  });

  test('9. Admin Updates Route Details (PUT /api/routes/:id)', async () => {
    const res = await request(app)
      .put(`/api/routes/${createdRouteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Route 8 - Central Metro Express (Updated)',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.route.name, 'Route 8 - Central Metro Express (Updated)');
  });

  // --- 3. Stop Sub-Resource CRUD Tests ---

  test('10. Admin Adds a Stop to Route (POST /api/routes/:routeId/stops)', async () => {
    const res = await request(app)
      .post(`/api/routes/${createdRouteId}/stops`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Lalbagh Main Gate',
        latitude: 12.9507,
        longitude: 77.5848,
        sequence: 2, // Insert at sequence 2
        expectedTime: '07:55 AM',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.stops.length, 4);

    const added = res.body.stops.find((s) => s.name === 'Lalbagh Main Gate');
    assert.ok(added, 'Added stop must exist');
    addedStopId = added._id;
  });

  test('11. Admin Updates a Stop on Route (PUT /api/routes/:routeId/stops/:stopId)', async () => {
    const res = await request(app)
      .put(`/api/routes/${createdRouteId}/stops/${addedStopId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Lalbagh West Gate (Updated)',
        expectedTime: '08:00 AM',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.stop.name, 'Lalbagh West Gate (Updated)');
    assert.strictEqual(res.body.stop.expectedTime, '08:00 AM');
  });

  test('12. Admin Deletes a Stop from Route (DELETE /api/routes/:routeId/stops/:stopId)', async () => {
    const res = await request(app)
      .delete(`/api/routes/${createdRouteId}/stops/${addedStopId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.stops.length, 3);
    const stillExists = res.body.stops.some((s) => s._id.toString() === addedStopId);
    assert.strictEqual(stillExists, false, 'Deleted stop must not be in stops list');
  });

  // --- 4. Bus Driver & Route Assignment (PUT /api/buses/:id) ---

  test('13. Admin Assigns Driver and Route to Bus (PUT /api/buses/:id)', async () => {
    const res = await request(app)
      .put(`/api/buses/${createdBusId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        driverId: testDriverUser.id,
        routeId: createdRouteId,
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.bus.driverId._id.toString(), testDriverUser.id);
    assert.strictEqual(res.body.bus.routeId._id.toString(), createdRouteId);

    // Verify driver profile reflection
    const driverProfile = await DriverProfile.findOne({ userId: testDriverUser.id });
    assert.strictEqual(driverProfile.assignedBusId.toString(), createdBusId);
  });

  // --- 5. Student Assignment & Profiles ---

  test('14. Admin Assigns Student to Bus, Route, and Home Stop (PUT /api/students/:id/assignment)', async () => {
    // Get Route to pick Stop 1
    const route = await Route.findById(createdRouteId);
    const chosenStop = route.stops[0];

    const res = await request(app)
      .put(`/api/students/${testStudentUser.id}/assignment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        assignedBusId: createdBusId,
        assignedRouteId: createdRouteId,
        homeStopId: chosenStop._id.toString(),
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.assignment.assignedBusId, createdBusId);
    assert.strictEqual(res.body.assignment.homeStopId, chosenStop._id.toString());
  });

  test('15. Student Assignment Rejection when Home Stop Does Not Belong to Route', async () => {
    const fakeStopId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .put(`/api/students/${testStudentUser.id}/assignment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        assignedBusId: createdBusId,
        assignedRouteId: createdRouteId,
        homeStopId: fakeStopId,
      });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  test('16. Student Checks Own Assignment Profile (GET /api/students/me)', async () => {
    const res = await request(app)
      .get('/api/students/me')
      .set('Authorization', `Bearer ${studentToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.student.assignedBus.registrationNumber, 'KA-05-TR-2026');
    assert.strictEqual(res.body.student.assignedRoute.routeNumber, 'R8');
    assert.strictEqual(res.body.student.homeStop.name, 'Majestic Station');
  });

  test('17. Admin Lists All Students (GET /api/students)', async () => {
    const res = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.students.length >= 1);
    const found = res.body.students.find((s) => s.id.toString() === testStudentUser.id);
    assert.ok(found);
    assert.strictEqual(found.assignedBus.registrationNumber, 'KA-05-TR-2026');
  });

  test('18. Admin Lists All Drivers with Vehicle Fleet Assignment (GET /api/drivers)', async () => {
    const res = await request(app)
      .get('/api/drivers')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.drivers.length >= 1);
    const found = res.body.drivers.find((d) => d.id.toString() === testDriverUser.id);
    assert.ok(found);
    assert.strictEqual(found.assignedBus.registrationNumber, 'KA-05-TR-2026');
  });

  // --- 6. Role-Based Access Control Guards ---

  test('19. RBAC: Student Blocked from Creating Bus (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/buses')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        busNumber: 'Hacker Bus',
        registrationNumber: 'KA-99-HK-9999',
      });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('20. RBAC: Driver Blocked from Creating Route (403 Forbidden)', async () => {
    const res = await request(app)
      .post('/api/routes')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({
        name: 'Unauthorized Route',
        routeNumber: 'R999',
      });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('21. RBAC: Student Blocked from Modifying Student Assignment (403 Forbidden)', async () => {
    const res = await request(app)
      .put(`/api/students/${testStudentUser.id}/assignment`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        assignedBusId: createdBusId,
      });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
  });

  test('22. Admin Deletes Bus (DELETE /api/buses/:id)', async () => {
    const res = await request(app)
      .delete(`/api/buses/${createdBusId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    // Verify bus is no longer retrievable
    const checkRes = await request(app)
      .get(`/api/buses/${createdBusId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(checkRes.status, 404);
  });
});
