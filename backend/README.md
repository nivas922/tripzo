# TripZo Live - Backend Service

This directory contains the complete backend service for **TripZo Live**, structured for standalone execution and friction-free integration into existing transport applications (such as TripZo with OTP-based attendance).

See [top-level README](../README.md) for the complete integration guide and architecture overview.

---

## 1. Key Highlights

- **Encapsulated Tracking Domain**: All tracking logic, models, controllers, and socket handlers live in `src/modules/tracking/` with unified `/api` and `/api/admin` endpoints.
- **Pluggable AuthProvider**: Standardized authentication interface (`src/modules/auth/AuthProvider.js`) allowing custom host app integration.
- **OpenAPI 3.0 Documentation**: Interactive Swagger UI hosted at `/api-docs` and JSON spec at `/api/docs.json` (source: `docs/openapi.yaml`).
- **Source-Agnostic Ingestion**: Ingests GPS telemetry from driver smartphones (Bearer JWT) or AIS-140/4G IoT devices (`x-device-token`).
- **Student Privacy & Isolation**: Strict bus boundary; students can only view their assigned vehicle.
- **Safeguards**: 3-hour trip maximum duration auto-cutoff, 7-day MongoDB TTL purge on location pings, and masked driver phone numbers.
- **Real-Time WebSockets**: Socket.IO event fan-out (`bus:location`, `bus:off_route`, `bus:trip_started`, `bus:trip_ended`) scoped to `bus:<busId>` rooms.

---

## 2. API Endpoints Overview

| Method | Endpoint | Description | Role / Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register student, driver, or admin | Public |
| `POST` | `/api/auth/login` | Log in and receive JWT token | Public |
| `GET` | `/api/auth/me` | Current authenticated user profile | Authenticated |
| `GET` | `/api/students/me` | Student profile and assignment | STUDENT |
| `GET` | `/api/students/me/bus` | Student's assigned bus and active trip | STUDENT |
| `GET` | `/api/students/me/route` | Student's route with ordered stops | STUDENT |
| `GET` | `/api/students/me/eta` | Live distance and ETA to student stop | STUDENT |
| `GET` | `/api/buses/:id/live` | Live bus location (student isolated) | Authenticated |
| `POST` | `/api/trips/start` | Start trip for assigned bus | DRIVER, ADMIN |
| `POST` | `/api/trips/end` | End active trip | DRIVER, ADMIN |
| `GET` | `/api/trips/current` | Get active trip for driver or student | Authenticated |
| `POST` | `/api/location/update` | Live GPS coordinate update | Driver JWT / IoT Token |
| `POST` | `/api/location/batch` | Reconnect offline GPS buffer flush | Driver JWT / IoT Token |
| `GET` | `/api/admin/buses` | List all fleet buses | ADMIN |
| `POST` | `/api/admin/buses` | Create new bus | ADMIN |
| `PUT` | `/api/admin/buses/:id` | Update bus details / driver assignment | ADMIN |
| `DELETE` | `/api/admin/buses/:id` | Delete bus | ADMIN |
| `GET` | `/api/admin/routes` | List all routes and stops | ADMIN |
| `POST` | `/api/admin/routes` | Create new route | ADMIN |
| `PUT` | `/api/admin/routes/:id` | Update route details | ADMIN |
| `DELETE` | `/api/admin/routes/:id` | Delete route | ADMIN |
| `POST` | `/api/admin/routes/:routeId/stops` | Add stop to route | ADMIN |
| `PUT` | `/api/admin/stops/:id` | Update stop details | ADMIN |
| `DELETE` | `/api/admin/stops/:id` | Delete stop | ADMIN |
| `GET` | `/api/admin/drivers` | List all drivers & assignments | ADMIN |
| `POST` | `/api/admin/drivers` | Create new driver | ADMIN |
| `PUT` | `/api/admin/drivers/:id` | Update driver details | ADMIN |
| `GET` | `/api/admin/students` | List all students & assignments | ADMIN |
| `POST` | `/api/admin/students` | Create new student | ADMIN |
| `PUT` | `/api/admin/students/:id` | Update student profile | ADMIN |
| `PUT` | `/api/admin/students/:id/assignment` | Assign student to bus/route/stop | ADMIN |

---

## 3. Testing & Running

```bash
# Install dependencies
npm install

# Run complete automated test suite (82 tests across 6 suites)
npm test

# Seed demo dataset (Route 12, Bus 1, Driver, Student, Admin)
npm run seed

# Run server (defaults to port 5000)
npm start
```

