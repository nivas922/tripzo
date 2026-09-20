# Tripzo Backend - Phase 1: Live Bus GPS Tracking

This is the backend service for **Tripzo**, extending attendance tracking with real-time GPS fleet tracking, live stop ETAs, driver privacy protection, and source-agnostic telemetry ingestion.

---

## Key Architecture & Features

### 1. Source-Agnostic Telemetry Ingestion
- **Phase 1 (Driver Phone)**: Driver logs in, starts a trip, and background location pings are sent to `POST /api/location/ping` with a standard `Authorization: Bearer <driverToken>`.
- **Phase 2 (Hardware IoT / AIS-140 / 4G GPS Tracker)**: Hardware trackers send pings with `x-device-token: <deviceToken>` header or `deviceToken` in payload. The backend automatically associates the device token with the bus and its active trip without changing any student or backend contracts.
- **Offline Buffering**: Supports `POST /api/location/batch` to flush queued pings after intermittent cellular connectivity loss.

### 2. Privacy & Access Security
- **Student Isolation**: Students can only query (`GET /api/buses/:id/live`) and subscribe to WebSocket updates (`bus:{assignedBusId}`) for their assigned bus. Queries or subscriptions to other buses return `403 Forbidden` / `error:unauthorized`.
- **Driver Phone & Off-Trip Privacy**: Driver personal phone numbers are stripped from all API outputs. Pings received outside an active trip are rejected, ensuring drivers are never tracked when off-duty.
- **3-Hour Trip Auto-Cutoff**: If a trip runs longer than 3 hours (e.g. driver forgot to tap "End Trip"), the backend automatically completes the trip with reason `max_duration_exceeded` and shuts down tracking.
- **7-Day Data Purge**: MongoDB TTL index automatically purges all `LocationPing` records after 7 days to preserve storage and privacy.

### 3. Stop ETA Engine
- Evaluates bus coordinates against ordered stops along the route.
- Yields discrete student-friendly states:
  - `"Not started"`: Bus has not departed yet.
  - `"Approaching"`: Bus is on its way with calculated ETA in minutes and distance in km.
  - `"Arrived"`: Bus is within 250m of the student's stop.
  - `"Departed your stop"`: Bus has already passed the student's stop.
- Uses OSRM public driving API with route-snapping, 30-second in-memory caching, and automatic Haversine fallback.

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login as student, driver, or admin.
- `GET /api/auth/me` - Get profile of authenticated user.

### Trips
- `POST /api/trips/start` - Driver starts morning/evening trip.
- `POST /api/trips/end` - Driver ends active trip.
- `GET /api/trips/active` - Retrieve active trip for a bus.

### Location Ingestion
- `POST /api/location/ping` - Ingest single GPS ping (supports Driver JWT or `x-device-token`).
- `POST /api/location/batch` - Ingest buffered pings after network reconnect.

### Bus & Student Tracking
- `GET /api/buses/:id/live` - Get live bus position, route, and sanitized driver info (student-isolated).
- `GET /api/students/me/eta` - Get student's personalized stop ETA and status.

### Real-Time WebSocket (Socket.IO)
- Connect with JWT handshake: `{ auth: { token: "<jwt>" } }`
- Events:
  - `subscribe:bus` - `{ busId }` (student isolation enforced)
  - `unsubscribe:bus` - `{ busId }`
  - `bus:initial_state` - Emitted on subscription
  - `bus:location_update` - Broadcasted in real-time when new ping arrives
  - `bus:trip_started` - Broadcasted when driver starts trip
  - `bus:trip_ended` - Broadcasted when driver ends trip

---

## Setup & Running

```bash
# 1. Install dependencies
npm install

# 2. Seed database with demo route, buses, driver, and students
npm run seed

# 3. Run server (uses embedded MongoDB memory server if MONGO_URI is omitted)
npm start

# 4. Run automated test suite
npm test
```
