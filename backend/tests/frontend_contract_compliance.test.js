const test = require('node:test');
const assert = require('node:assert/strict');
const supertest = require('supertest');
const { io: ClientIO } = require('socket.io-client');
const http = require('http');

const { createApp } = require('../src/app');
const JwtAuthProvider = require('../src/modules/auth/JwtAuthProvider');
const socketManager = require('../src/sockets/socketManager');
const { connectDB, disconnectDB } = require('../src/config/db');

test('Frontend Contract & Requirements Compliance Test Suite', async (t) => {
  let server;
  let request;
  let authProvider;

  let adminToken;
  let driverToken;
  let studentToken;
  let otherStudentToken;

  let createdBus;
  let createdRoute;
  let studentUser;
  let driverUser;
  let activeTrip;

  await t.test('Setup: Connect DB and start server', async () => {
    await connectDB();

    authProvider = new JwtAuthProvider();
    const app = createApp({ authProvider, socketManager });
    server = http.createServer(app);
    socketManager.init(server);

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    request = supertest('http://localhost:' + port);
  });

  await t.test('1. Authentication: Register and Login for ADMIN, DRIVER, STUDENT', async () => {
    // Admin
    await request.post('/api/auth/register').send({
      name: 'System Admin',
      email: 'admin_contract@college.edu',
      password: 'AdminPassword123!',
      role: 'ADMIN',
    });
    const adminLoginRes = await request.post('/api/auth/login').send({
      email: 'admin_contract@college.edu',
      password: 'AdminPassword123!',
    });
    assert.equal(adminLoginRes.status, 200);
    assert.ok(adminLoginRes.body.token);
    adminToken = adminLoginRes.body.token;

    // Driver
    const driverReg = await request.post('/api/auth/register').send({
      name: 'Kavitha Driver',
      email: 'driver_contract@college.edu',
      password: 'DriverPassword123!',
      role: 'DRIVER',
    });
    driverUser = driverReg.body.user;
    const driverLoginRes = await request.post('/api/auth/login').send({
      email: 'driver_contract@college.edu',
      password: 'DriverPassword123!',
    });
    assert.equal(driverLoginRes.status, 200);
    driverToken = driverLoginRes.body.token;

    // Student 1
    const studentReg = await request.post('/api/auth/register').send({
      name: 'Rohan Sharma',
      email: 'student_contract@college.edu',
      password: 'StudentPassword123!',
      role: 'STUDENT',
    });
    studentUser = studentReg.body.user;
    const studentLoginRes = await request.post('/api/auth/login').send({
      email: 'student_contract@college.edu',
      password: 'StudentPassword123!',
    });
    assert.equal(studentLoginRes.status, 200);
    studentToken = studentLoginRes.body.token;

    // Student 2 (Unassigned / Other Bus)
    await request.post('/api/auth/register').send({
      name: 'Other Student',
      email: 'other_contract@college.edu',
      password: 'StudentPassword123!',
      role: 'STUDENT',
    });
    const otherLoginRes = await request.post('/api/auth/login').send({
      email: 'other_contract@college.edu',
      password: 'StudentPassword123!',
    });
    otherStudentToken = otherLoginRes.body.token;
  });

  await t.test('2. Admin APIs: Create Route, Stops, and Bus (/api/admin/*)', async () => {
    // Create Route
    const routeRes = await request
      .post('/api/admin/routes')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({
        name: 'Route R7 - College Central Express',
        routeNumber: 'R7',
        stops: [
          { name: 'Gandhipuram', latitude: 11.0168, longitude: 76.9558, sequence: 1, expectedTime: '07:30' },
          { name: 'Saibaba Colony', latitude: 11.0289, longitude: 76.9452, sequence: 2, expectedTime: '07:45' },
          { name: 'Thudiyalur', latitude: 11.0772, longitude: 76.9366, sequence: 3, expectedTime: '08:00' },
          { name: 'College Campus', latitude: 11.1085, longitude: 76.9658, sequence: 4, expectedTime: '08:20' },
        ],
      });
    assert.equal(routeRes.status, 201);
    createdRoute = routeRes.body.route;
    assert.equal(createdRoute.stops.length, 4);

    // Create Bus
    const busRes = await request
      .post('/api/admin/buses')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({
        busNumber: 'BUS-07',
        registrationNumber: 'TN-38-BZ-7007',
        routeId: createdRoute._id,
        driverId: driverUser.id || driverUser._id,
        capacity: 45,
      });
    assert.equal(busRes.status, 201);
    createdBus = busRes.body.bus;

    // Assign Student to Bus, Route, and Home Stop (Saibaba Colony)
    const homeStop = createdRoute.stops[1];
    const assignRes = await request
      .put('/api/admin/students/' + (studentUser.id || studentUser._id) + '/assignment')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({
        assignedBusId: createdBus._id,
        assignedRouteId: createdRoute._id,
        homeStopId: homeStop._id,
      });
    assert.equal(assignRes.status, 200);
  });

  await t.test('3. Student APIs: GET /api/students/me/bus & /me/route and Isolation', async () => {
    // Re-login student to refresh claims
    const sLogin = await request.post('/api/auth/login').send({
      email: 'student_contract@college.edu',
      password: 'StudentPassword123!',
    });
    studentToken = sLogin.body.token;

    // Query /api/students/me/bus
    const meBusRes = await request
      .get('/api/students/me/bus')
      .set('Authorization', 'Bearer ' + studentToken);
    assert.equal(meBusRes.status, 200);
    assert.equal(meBusRes.body.success, true);
    assert.ok(meBusRes.body.data.bus);
    assert.equal(meBusRes.body.data.bus.registrationNumber, 'TN-38-BZ-7007');

    // Query /api/students/me/route
    const meRouteRes = await request
      .get('/api/students/me/route')
      .set('Authorization', 'Bearer ' + studentToken);
    assert.equal(meRouteRes.status, 200);
    assert.equal(meRouteRes.body.data.route.name, 'Route R7 - College Central Express');
    assert.equal(meRouteRes.body.data.homeStop.name, 'Saibaba Colony');

    // Student isolation: student 1 can access own bus live endpoint
    const liveBusRes = await request
      .get('/api/buses/' + createdBus._id + '/live')
      .set('Authorization', 'Bearer ' + studentToken);
    assert.equal(liveBusRes.status, 200);

    // Other student (unassigned) blocked with 403 Forbidden
    const forbiddenRes = await request
      .get('/api/buses/' + createdBus._id + '/live')
      .set('Authorization', 'Bearer ' + otherStudentToken);
    assert.equal(forbiddenRes.status, 403);
    assert.equal(forbiddenRes.body.success, false);
  });

  await t.test('4. Driver APIs: Start Trip, Query Current Trip', async () => {
    // Driver starts trip
    const startRes = await request
      .post('/api/trips/start')
      .set('Authorization', 'Bearer ' + driverToken)
      .send({
        busId: createdBus._id,
        direction: 'morning',
      });
    assert.equal(startRes.status, 201);
    assert.equal(startRes.body.success, true);
    activeTrip = startRes.body.trip;

    // Driver queries current trip
    const currentRes = await request
      .get('/api/trips/current')
      .set('Authorization', 'Bearer ' + driverToken);
    assert.equal(currentRes.status, 200);
    assert.ok(currentRes.body.data.trip);
    assert.equal(currentRes.body.data.trip._id.toString(), activeTrip._id.toString());
  });

  await t.test('5. GPS Update API (POST /api/location/update), Validation, and Socket.IO Broadcast', async () => {
    const port = server.address().port;

    // Connect Socket.IO client as student
    const socketClient = ClientIO('http://localhost:' + port, {
      auth: { token: studentToken },
      transports: ['websocket'],
    });

    await new Promise((resolve) => socketClient.on('connect', resolve));
    socketClient.emit('subscribe:bus', { busId: createdBus._id.toString() });
    await new Promise((r) => setTimeout(r, 100));

    // Listen for bus:location event
    const receivedPromise = new Promise((resolve) => {
      socketClient.on('bus:location', (data) => {
        resolve(data);
      });
    });

    // Test rejection of invalid GPS coordinates
    const invalidRes = await request
      .post('/api/location/update')
      .set('Authorization', 'Bearer ' + driverToken)
      .send({
        busId: createdBus._id,
        tripId: activeTrip._id,
        latitude: 195.0, // Invalid lat!
        longitude: 76.9558,
        speed: 30,
      });
    assert.equal(invalidRes.status, 400);
    assert.equal(invalidRes.body.success, false);

    // Send valid GPS update
    const validRes = await request
      .post('/api/location/update')
      .set('Authorization', 'Bearer ' + driverToken)
      .send({
        busId: createdBus._id,
        tripId: activeTrip._id,
        latitude: 11.0168,
        longitude: 76.9558,
        speed: 35,
        heading: 120,
        timestamp: new Date().toISOString(),
      });
    assert.equal(validRes.status, 201);
    assert.equal(validRes.body.success, true);
    assert.equal(validRes.body.data.speed, 35);

    // Verify Socket.IO broadcast
    const broadcastedData = await receivedPromise;
    assert.equal(broadcastedData.busId, createdBus._id.toString());
    assert.equal(broadcastedData.latitude, 11.0168);
    assert.equal(broadcastedData.longitude, 76.9558);
    assert.equal(broadcastedData.speed, 35);

    socketClient.disconnect();
  });

  await t.test('6. Off-Route Detection: Coordinates far from route trigger OFF_ROUTE status', async () => {
    // Send coordinates far off route (> 10 km away)
    const offRouteRes = await request
      .post('/api/location/update')
      .set('Authorization', 'Bearer ' + driverToken)
      .send({
        busId: createdBus._id,
        tripId: activeTrip._id,
        latitude: 11.3500, // far from Coimbatore R7 stops
        longitude: 77.2000,
        speed: 40,
        heading: 90,
      });
    assert.equal(offRouteRes.status, 201);
    assert.equal(offRouteRes.body.data.status, 'OFF_ROUTE');

    // Verify student ETA endpoint returns friendly message
    const etaRes = await request
      .get('/api/students/me/eta')
      .set('Authorization', 'Bearer ' + studentToken);
    assert.equal(etaRes.status, 200);
    assert.equal(etaRes.body.eta.status, 'OFF_ROUTE');
    assert.equal(etaRes.body.eta.message, 'Bus may be temporarily away from its normal route.');
  });

  await t.test('7. Driver Ends Trip -> Status COMPLETED, Ping outside trip rejected', async () => {
    // End trip
    const endRes = await request
      .post('/api/trips/end')
      .set('Authorization', 'Bearer ' + driverToken)
      .send({
        busId: createdBus._id,
      });
    assert.equal(endRes.status, 200);
    assert.equal(endRes.body.success, true);
    assert.equal(endRes.body.trip.status, 'completed');

    // Attempting location update now rejected with NO_ACTIVE_TRIP
    const postEndRes = await request
      .post('/api/location/update')
      .set('Authorization', 'Bearer ' + driverToken)
      .send({
        busId: createdBus._id,
        latitude: 11.0168,
        longitude: 76.9558,
      });
    assert.equal(postEndRes.status, 400);
    assert.equal(postEndRes.body.code, 'NO_ACTIVE_TRIP');
  });

  await t.test('Teardown: Close server and disconnect DB', async () => {
    socketManager.close();
    await new Promise((resolve) => server.close(resolve));
    await disconnectDB();
  });
});
