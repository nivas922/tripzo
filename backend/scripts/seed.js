const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/User');
const Route = require('../src/modules/tracking/models/Route');
const Bus = require('../src/modules/tracking/models/Bus');
const Trip = require('../src/modules/tracking/models/Trip');
const LocationPing = require('../src/modules/tracking/models/LocationPing');
const StudentProfile = require('../src/modules/tracking/models/StudentProfile');
const DriverProfile = require('../src/modules/tracking/models/DriverProfile');

async function seed() {
  console.log('[Seed] Connecting to database...');
  await connectDB();

  console.log('[Seed] Cleaning collections...');
  await Promise.all([
    User.deleteMany({}),
    Route.deleteMany({}),
    Bus.deleteMany({}),
    Trip.deleteMany({}),
    LocationPing.deleteMany({}),
    StudentProfile.deleteMany({}),
    DriverProfile.deleteMany({}),
  ]);

  console.log('[Seed] Hashing passwords...');
  const adminHash = await bcrypt.hash('AdminPass123!', 10);
  const driverHash = await bcrypt.hash('DriverPass123!', 10);
  const studentHash = await bcrypt.hash('StudentPass123!', 10);

  console.log('[Seed] Creating Route 12...');
  const route = await Route.create({
    name: 'Route 12 - South Campus to City',
    stops: [
      {
        name: 'Electronic City Gate',
        lat: 12.8452,
        lng: 77.6602,
        order: 0,
        scheduledTime: '07:30 AM',
      },
      {
        name: 'Silk Board Junction',
        lat: 12.9172,
        lng: 77.6228,
        order: 1,
        scheduledTime: '07:50 AM',
      },
      {
        name: 'HSR Layout 5th Main',
        lat: 12.9116,
        lng: 77.6389,
        order: 2,
        scheduledTime: '08:05 AM',
      },
      {
        name: 'Bellandur EcoSpace',
        lat: 12.926,
        lng: 77.6762,
        order: 3,
        scheduledTime: '08:25 AM',
      },
      {
        name: 'College Campus Main Gate',
        lat: 12.9352,
        lng: 77.6946,
        order: 4,
        scheduledTime: '08:45 AM',
      },
    ],
    polyline: [
      [77.6602, 12.8452],
      [77.6228, 12.9172],
      [77.6389, 12.9116],
      [77.6762, 12.926],
      [77.6946, 12.9352],
    ],
  });

  console.log('[Seed] Creating Bus 1 (KA-01-EA-2024) & Bus 2 (KA-01-ZZ-9999)...');
  const bus1 = await Bus.create({
    registrationNumber: 'KA-01-EA-2024',
    routeId: route._id,
    deviceToken: 'IOT-DEV-BUS-01',
    capacity: 45,
    isActive: true,
  });

  const bus2 = await Bus.create({
    registrationNumber: 'KA-01-ZZ-9999',
    routeId: route._id,
    deviceToken: 'IOT-DEV-BUS-02',
    capacity: 50,
    isActive: true,
  });

  console.log('[Seed] Creating Standalone Users for standalone testing...');
  const driver = await User.create({
    name: 'Ramesh Kumar (Driver)',
    email: 'driver@tripzo.edu',
    phone: '+91 98765 43210',
    passwordHash: driverHash,
    role: 'driver',
    assignedBusId: bus1._id,
  });

  console.log('[Seed] Creating Tracking Profiles (Merge-Ready Decoupled Models)...');
  const driverProfile = await DriverProfile.create({
    _id: driver._id,
    externalDriverId: 'TRIPZO-DRV-501',
    name: 'Ramesh Kumar (Driver)',
    assignedBusId: bus1._id,
  });

  // Assign driver to Bus 1
  bus1.assignedDriverId = driver._id;
  await bus1.save();

  const admin = await User.create({
    name: 'Campus Fleet Admin',
    email: 'admin@tripzo.edu',
    phone: '+91 90000 11111',
    passwordHash: adminHash,
    role: 'admin',
  });

  const student1 = await User.create({
    name: 'Aarav Sharma',
    email: 'student1@tripzo.edu',
    phone: '+91 91111 22222',
    passwordHash: studentHash,
    role: 'student',
    assignedBusId: bus1._id,
    homeStopId: route.stops[1]._id,
  });

  const student2 = await User.create({
    name: 'Priya Patel',
    email: 'student2@tripzo.edu',
    phone: '+91 92222 33333',
    passwordHash: studentHash,
    role: 'student',
    assignedBusId: bus1._id,
    homeStopId: route.stops[3]._id,
  });

  const studentOther = await User.create({
    name: 'Kavya Nair (Different Bus)',
    email: 'otherstudent@tripzo.edu',
    phone: '+91 93333 44444',
    passwordHash: studentHash,
    role: 'student',
    assignedBusId: bus2._id,
    homeStopId: route.stops[0]._id,
  });

  const studentProfile1 = await StudentProfile.create({
    externalStudentId: 'TRIPZO-STU-1001',
    name: 'Aarav Sharma',
    assignedBusId: bus1._id,
    homeStopId: route.stops[1]._id,
  });

  const studentProfile2 = await StudentProfile.create({
    externalStudentId: 'TRIPZO-STU-1002',
    name: 'Priya Patel',
    assignedBusId: bus1._id,
    homeStopId: route.stops[3]._id,
  });

  const studentProfileOther = await StudentProfile.create({
    externalStudentId: 'TRIPZO-STU-9999',
    name: 'Kavya Nair (Different Bus)',
    assignedBusId: bus2._id,
    homeStopId: route.stops[0]._id,
  });

  console.log('\n======================================================');
  console.log(' TripZo Live Test Environment Seeded Successfully!');
  console.log('======================================================');
  console.log(' Standalone Accounts Created:');
  console.log(`   - Driver:    driver@tripzo.edu    | DriverPass123! (Bus: KA-01-EA-2024)`);
  console.log(`   - Admin:     admin@tripzo.edu     | AdminPass123!`);
  console.log(`   - Student 1: student1@tripzo.edu  | StudentPass123! (Stop: Silk Board)`);
  console.log(`   - Student 2: student2@tripzo.edu  | StudentPass123! (Stop: Bellandur)`);
  console.log(`   - Student 3: otherstudent@tripzo.edu | StudentPass123! (Bus: KA-01-ZZ-9999)`);
  console.log(' Decoupled Tracking Profiles (Host Mappable):');
  console.log(`   - Driver Profile:  ${driverProfile.externalDriverId} -> Bus ${bus1.registrationNumber}`);
  console.log(`   - Student 1 Prof:  ${studentProfile1.externalStudentId} -> Stop Silk Board`);
  console.log(`   - Student 2 Prof:  ${studentProfile2.externalStudentId} -> Stop Bellandur`);
  console.log(' Hardware IoT Tracker Device Tokens:');
  console.log(`   - Bus 1 Token: IOT-DEV-BUS-01`);
  console.log(`   - Bus 2 Token: IOT-DEV-BUS-02`);
  console.log(' Route:');
  console.log(`   - "${route.name}" with 5 stops`);
  console.log('======================================================\n');

  return {
    admin,
    driver,
    student1,
    student2,
    studentOther,
    bus1,
    bus2,
    route,
    driverProfile,
    studentProfile1,
    studentProfile2,
    studentProfileOther,
  };
}

if (require.main === module) {
  seed()
    .then(async () => {
      await disconnectDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('[Seed] Error seeding database:', err);
      await disconnectDB();
      process.exit(1);
    });
}

module.exports = seed;
