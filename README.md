# TripZo Live 🚌

TripZo Live is an autonomous, merge-ready live GPS fleet tracking and telemetry platform for college buses. It is designed to work completely standalone, but engineered specifically to be cleanly folded into an existing transit application (such as TripZo with OTP-based attendance) with **zero shared database writes** and a **pluggable authentication interface**.

---

## Integrating into an existing transport app

When merging the tracking module (`/src/modules/tracking`) into an existing transport platform (e.g. TripZo with OTP attendance), the host application only needs to provide **three things**:

### 1. A Student Identity
- **How it works**: The host application's student and user tables remain completely untouched. The tracking domain defines a lightweight `StudentProfile` model with an `externalStudentId` field that maps directly to the host app's student identifier (e.g. `TRIPZO-STU-1001` or student MongoDB `_id`).
- **Pluggable Authentication**: The host app implements the `AuthProvider` interface (`src/modules/auth/AuthProvider.js`). When a student makes a request, `authProvider.authenticate(req)` returns a standardized context:
  ```json
  {
    "id": "host-student-id",
    "role": "student",
    "externalId": "TRIPZO-STU-1001",
    "assignedBusId": "66ab4e...",
    "homeStopId": "66ab4f...",
    "name": "Aarav Sharma"
  }
  ```
- **Database Isolation**: The tracking module never queries, modifies, or writes to the host application's user database.

### 2. A Stop Assignment
- **How it works**: Each route in the tracking module defines an ordered sequence of physical stops (`name`, `lat`, `lng`, `order`, `scheduledTime`).
- **Student linkage**: The host application links each student to their boarding stop by referencing `homeStopId` in their profile or returning it dynamically through the `AuthProvider`.
- **ETA Engine**: The tracking engine automatically computes live travel times specifically from the bus's real-time coordinates to this assigned stop, returning discrete status states:
  - `"Not started"`: Bus has not departed.
  - `"Approaching"`: Bus is en route with estimated minutes and distance in km.
  - `"Arrived"`: Bus is within 250m of the student's stop.
  - `"Departed your stop"`: Bus has passed the stop in sequence.

### 3. A Driver Identity
- **How it works**: The tracking domain defines a `DriverProfile` with an `externalDriverId` referencing the host app's driver/staff record. Personal driver telephone numbers are deliberately excluded from tracking tables to safeguard privacy.
- **Vehicle Assignment**: The host app links the driver to their assigned `Bus` (`assignedDriverId`).
- **Trip Authorization**: When a driver taps "Start Trip" or broadcasts GPS pings from their phone, the active `AuthProvider` verifies that the driver is assigned to the bus.
- **Hardware Tracker Alternative**: If the college bus is equipped with an AIS-140 or 4G GPS tracker, the hardware device token (`x-device-token`) automatically authenticates telemetry without requiring the driver to use a smartphone.

---

### Host Integration Code Example

```javascript
const express = require('express');
const http = require('http');
const AuthProvider = require('./src/modules/auth/AuthProvider');
const createTrackingRoutes = require('./src/modules/tracking/routes/trackingRoutes');
const TrackingSocketManager = require('./src/modules/tracking/sockets/trackingSocket');

// 1. Implement host-specific AuthProvider (e.g. wrapping TripZo OTP session)
class TripZoHostAuthProvider extends AuthProvider {
  async authenticate(req) {
    const sessionUser = await myHostAuthService.verifySession(req);
    return {
      id: sessionUser._id.toString(),
      role: sessionUser.role, // 'student' | 'driver' | 'admin'
      externalId: sessionUser.registrationNumber || sessionUser._id.toString(),
      assignedBusId: sessionUser.assignedBusId,
      homeStopId: sessionUser.homeStopId,
      name: sessionUser.fullName,
    };
  }

  async authenticateSocket(socket) {
    const sessionUser = await myHostAuthService.verifyToken(socket.handshake.auth.token);
    return {
      id: sessionUser._id.toString(),
      role: sessionUser.role,
      assignedBusId: sessionUser.assignedBusId,
      name: sessionUser.fullName,
    };
  }
}

// 2. Mount into your existing host app
const app = express();
const server = http.createServer(app);
const hostAuth = new TripZoHostAuthProvider();
const trackingSockets = new TrackingSocketManager();

// Mount tracking routes cleanly under your desired route prefix
app.use('/api/v1/tracking', createTrackingRoutes({
  authProvider: hostAuth,
  socketManager: trackingSockets,
}));

// Initialize real-time WebSocket hub with host authentication
trackingSockets.init(server, hostAuth);

server.listen(5000);
```

---

## Architectural Principles

1. **Strict Encapsulation (`/modules/tracking`)**: All telemetry models (`LocationPing`, `Trip`, `Bus`, `Route`, `StudentProfile`, `DriverProfile`), controllers, and socket logic are fully enclosed within the tracking module.
2. **Pluggable Authentication**: Built-in `JwtAuthProvider` for standalone mode; easily swapped for custom host authentication without modifying tracking code.
3. **Source-Agnostic Telemetry**: The ingest endpoint (`POST /api/v1/tracking/location/ping`) seamlessly handles telemetry from either driver smartphones (via Bearer JWT) or AIS-140 / 4G GPS IoT hardware devices (via `x-device-token`).
4. **Student Isolation**: Students can strictly track and query only their assigned bus. Attempts to query or listen to unassigned buses return `403 Forbidden` / `error:unauthorized`.
5. **Driver Privacy**: Driver personal telephone numbers are never exposed. Pings received outside an active trip are rejected (`code: NO_ACTIVE_TRIP`).
6. **3-Hour Maximum Trip Duration Cutoff**: Trips running longer than 180 minutes auto-terminate to prevent accidental location leaks.
7. **7-Day Automatic Data Purge**: MongoDB TTL index automatically removes location pings older than 7 days.
8. **Interactive OpenAPI 3.0 Documentation**: Full interactive Swagger UI available at `/api-docs`.

---

## Repository Structure

```text
tripzo/
├── backend/
│   ├── docs/
│   │   └── openapi.yaml           # Complete OpenAPI 3.0 Specification
│   ├── src/
│   │   ├── config/                # DB & server config (embedded MongoDB memory fallback)
│   │   ├── middleware/            # Error handling
│   │   ├── modules/
│   │   │   ├── auth/              # Pluggable Auth Module
│   │   │   │   ├── AuthProvider.js     # Abstract base interface
│   │   │   │   ├── JwtAuthProvider.js  # Standalone JWT implementation
│   │   │   │   ├── authMiddleware.js   # Middleware factory
│   │   │   │   └── authRoutes.js       # Standalone login/me routes
│   │   │   └── tracking/          # Self-Contained Tracking Domain
│   │   │       ├── controllers/   # Location, Trip, Bus, Student controllers
│   │   │       ├── middleware/    # Source-agnostic device/driver auth
│   │   │       ├── models/        # StudentProfile, DriverProfile, Bus, Route, Trip, Ping
│   │   │       ├── routes/        # trackingRoutes.js exportable router
│   │   │       ├── services/      # ETA engine & Trip 3hr safeguard
│   │   │       └── sockets/       # Isolated Socket.IO room fan-out
│   │   ├── app.js                 # App factory mounting OpenAPI and modules
│   │   └── server.js              # Server bootstrap
│   ├── scripts/
│   │   └── seed.js                # Demo environment seeder
│   └── tests/
│       ├── tracking_modular.test.js # Modular & merge-readiness tests
│       └── backend.test.js          # Phase 1 integration tests
└── README.md
```

---

## Quick Start (Standalone Mode)

```bash
cd backend
npm install
npm run seed
npm test
npm start
```

Interactive API documentation will be available at `http://localhost:5000/api-docs`.
