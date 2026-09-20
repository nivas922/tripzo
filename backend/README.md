# TripZo Live - Backend Service

This directory contains the complete backend service for **TripZo Live**, structured for standalone execution and friction-free integration into existing transport applications (such as TripZo with OTP-based attendance).

See [top-level README](../README.md) for the complete integration guide and architecture overview.

## Key Highlights

- **Encapsulated Tracking Domain**: All tracking logic, models, controllers, and socket handlers live exclusively in `src/modules/tracking/`.
- **Pluggable AuthProvider**: Standardized authentication interface (`src/modules/auth/AuthProvider.js`) allowing custom host app integration.
- **OpenAPI 3.0 Documentation**: Interactive Swagger UI hosted at `/api-docs` and JSON spec at `/api/docs.json` (source: `docs/openapi.yaml`).
- **Source-Agnostic Ingestion**: Ingests GPS telemetry from driver smartphones (Bearer JWT) or AIS-140/4G IoT devices (`x-device-token`).
- **Student Privacy & Isolation**: Strict bus boundary; students can only view their assigned vehicle.
- **Safeguards**: 3-hour trip maximum duration auto-cutoff, 7-day MongoDB TTL purge on location pings, and masked driver phone numbers.

## Testing & Running

```bash
# Run test suite
npm test

# Run seed script
npm run seed

# Run server
npm start
```
