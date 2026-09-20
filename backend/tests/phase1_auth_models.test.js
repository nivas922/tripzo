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
const Location = require('../src/models/Location');
const StudentAdapter = require('../src/integration/StudentAdapter');
const DriverAdapter = require('../src/integration/DriverAdapter');
const BusAdapter = require('../src/integration/BusAdapter');
const { authorize, authenticate } = require('../src/middleware/auth');

let server;
let app;

describe('College Bus Live GPS Tracking System - Phase 1 Test Suite', () => {
  before(async () => {
    await connectDB();
    await Promise.all([
      User.deleteMany({}),
      StudentProfile.deleteMany({}),
      DriverProfile.deleteMany({}),
      Bus.deleteMany({}),
      Route.deleteMany({}),
      Trip.deleteMany({}),
      Location.deleteMany({}),
    ]);

    app = defaultApp;
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  test('1. Database Schemas & Models Verification', () => {
    // 1a. User
    const userPaths = User.schema.paths;
    assert.ok(userPaths.name, 'User must have name');
    assert.ok(userPaths.email, 'User must have email');
    assert.ok(userPaths.password, 'User must have password');
    assert.ok(userPaths.role, 'User must have role');

    // 1b. StudentProfile
    const studentPaths = StudentProfile.schema.paths;
    assert.ok(studentPaths.userId, 'StudentProfile must have userId');
    assert.ok(studentPaths.studentId, 'StudentProfile must have studentId');
    assert.ok(studentPaths.assignedBusId, 'StudentProfile must have assignedBusId');
    assert.ok(studentPaths.assignedRouteId, 'StudentProfile must have assignedRouteId');
    assert.ok(studentPaths.homeStopId, 'StudentProfile must have homeStopId');

    // 1c. DriverProfile
    const driverPaths = DriverProfile.schema.paths;
    assert.ok(driverPaths.userId, 'DriverProfile must have userId');
    assert.ok(driverPaths.employeeId, 'DriverProfile must have employeeId');
    assert.ok(driverPaths.assignedBusId, 'DriverProfile must have assignedBusId');

    // 1d. Bus
    const busPaths = Bus.schema.paths;
    assert.ok(busPaths.busNumber, 'Bus must have busNumber');
    assert.ok(busPaths.registrationNumber, 'Bus must have registrationNumber');
    assert.ok(busPaths.routeId, 'Bus must have routeId');
    assert.ok(busPaths.driverId, 'Bus must have driverId');
    assert.ok(busPaths.deviceToken, 'Bus must have deviceToken');

    // 1e. Route
    const routePaths = Route.schema.paths;
    assert.ok(routePaths.name, 'Route must have name');
    assert.ok(routePaths.routeNumber, 'Route must have routeNumber');
    assert.ok(routePaths.stops, 'Route must have stops array');
    assert.ok(routePaths.routePolyline, 'Route must have routePolyline');

    // 1f. Trip
    const tripPaths = Trip.schema.paths;
    assert.ok(tripPaths.busId, 'Trip must have busId');
    assert.ok(tripPaths.routeId, 'Trip must have routeId');
    assert.ok(tripPaths.driverId, 'Trip must have driverId');
    assert.ok(tripPaths.status, 'Trip must have status');

    // 1g. Location TTL index
    const locationIndexes = Location.schema.indexes();
    const ttlIndex = locationIndexes.find(
      (idx) => idx[0].timestamp === 1 && idx[1] && idx[1].expireAfterSeconds === 7 * 24 * 60 * 60
    );
    assert.ok(ttlIndex, 'Location must have 7-day TTL index on timestamp');
  });

  test('2. User Registration: STUDENT Role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Arun Kumar',
        email: 'arun.student@college.edu',
        password: 'Password123!',
        role: 'STUDENT',
        studentId: 'CB-2024-STU-001',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token, 'Must return JWT token');
    assert.strictEqual(res.body.user.email, 'arun.student@college.edu');
    assert.strictEqual(res.body.user.role, 'STUDENT');
    assert.strictEqual(res.body.user.password, undefined, 'Password must not be returned');

    // Verify StudentProfile was created automatically
    const profile = await StudentProfile.findOne({ studentId: 'CB-2024-STU-001' });
    assert.ok(profile, 'StudentProfile must be automatically created on registration');
    assert.strictEqual(profile.userId.toString(), res.body.user._id);
  });

  test('3. User Registration: DRIVER Role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Muthu Selvan (Driver)',
        email: 'muthu.driver@college.edu',
        password: 'Password123!',
        role: 'DRIVER',
        employeeId: 'CB-EMP-DRV-101',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.user.role, 'DRIVER');

    // Verify DriverProfile was created automatically
    const profile = await DriverProfile.findOne({ employeeId: 'CB-EMP-DRV-101' });
    assert.ok(profile, 'DriverProfile must be created automatically');
    assert.strictEqual(profile.userId.toString(), res.body.user._id);
  });

  test('4. User Registration: ADMIN Role', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Fleet Administrator',
        email: 'admin@college.edu',
        password: 'AdminPassword123!',
        role: 'ADMIN',
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.user.role, 'ADMIN');
  });

  test('5. Registration Validation & Rejection of Duplicate Emails', async () => {
    // Duplicate email
    const duplicateRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Duplicate Arun',
        email: 'arun.student@college.edu',
        password: 'Password123!',
        role: 'STUDENT',
      });
    assert.strictEqual(duplicateRes.status, 400);

    // Invalid email
    const invalidEmailRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Invalid User',
        email: 'not-an-email',
        password: 'Password123!',
      });
    assert.strictEqual(invalidEmailRes.status, 400);

    // Short password
    const shortPassRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Short Pass',
        email: 'shortpass@college.edu',
        password: '123',
      });
    assert.strictEqual(shortPassRes.status, 400);

    // Invalid role
    const invalidRoleRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Hacker User',
        email: 'hacker@college.edu',
        password: 'Password123!',
        role: 'SUPER_USER',
      });
    assert.strictEqual(invalidRoleRes.status, 400);
  });

  test('6. User Login: Success & JWT Issuance', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'arun.student@college.edu',
        password: 'Password123!',
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.token);
    assert.strictEqual(res.body.user.email, 'arun.student@college.edu');
    assert.strictEqual(res.body.user.password, undefined);
  });

  test('7. User Login: Rejection of Invalid Credentials', async () => {
    // Wrong password
    const wrongPassRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'arun.student@college.edu',
        password: 'WrongPassword!',
      });
    assert.strictEqual(wrongPassRes.status, 401);

    // Non-existent email
    const unknownRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nobody@college.edu',
        password: 'Password123!',
      });
    assert.strictEqual(unknownRes.status, 401);
  });

  test('8. Authenticated Profile: GET /api/auth/me', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'arun.student@college.edu',
        password: 'Password123!',
      });

    const token = loginRes.body.token;

    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(meRes.status, 200);
    assert.strictEqual(meRes.body.user.email, 'arun.student@college.edu');
    assert.strictEqual(meRes.body.user.role, 'STUDENT');
    assert.ok(meRes.body.profile, 'Must return associated StudentProfile');
    assert.strictEqual(meRes.body.profile.studentId, 'CB-2024-STU-001');
  });

  test('9. Role-Based Access Control (RBAC) Middleware Logic', () => {
    // 9a. Student rejected from ADMIN-only route
    const reqStudent = { user: { role: 'STUDENT' } };
    const resMock1 = {
      statusCode: null,
      body: null,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.body = d; return this; },
    };
    let studentNextCalled = false;
    authorize('ADMIN')(reqStudent, resMock1, () => { studentNextCalled = true; });

    assert.strictEqual(resMock1.statusCode, 403, 'Student must receive 403 Forbidden');
    assert.strictEqual(studentNextCalled, false, 'Next must not be called for unauthorized role');

    // 9b. Admin allowed through ADMIN route
    const reqAdmin = { user: { role: 'ADMIN' } };
    const resMock2 = {
      statusCode: null,
      body: null,
      status(c) { this.statusCode = c; return this; },
      json(d) { this.body = d; return this; },
    };
    let adminNextCalled = false;
    authorize('ADMIN')(reqAdmin, resMock2, () => { adminNextCalled = true; });

    assert.strictEqual(adminNextCalled, true, 'Next must be called for authorized role');
  });

  test('10. Integration Adapters Verification', async () => {
    // StudentAdapter
    const studentProfile = await StudentAdapter.getStudentProfile('CB-2024-STU-001');
    assert.ok(studentProfile);
    assert.strictEqual(studentProfile.studentId, 'CB-2024-STU-001');

    // DriverAdapter
    const driverProfile = await DriverAdapter.getDriverProfile('CB-EMP-DRV-101');
    assert.ok(driverProfile);
    assert.strictEqual(driverProfile.employeeId, 'CB-EMP-DRV-101');
  });
});
