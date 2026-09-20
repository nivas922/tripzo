# Tripzo 🚌

Tripzo is an intelligent college bus fleet and transit platform that combines OTP attendance tracking with live GPS fleet tracking, real-time stop ETAs, driver privacy protection, and telemetry streaming.

## Repository Structure

```text
tripzo/
├── backend/          # Node.js + Express + Socket.IO + MongoDB telemetry backend
│   ├── src/
│   │   ├── config/   # DB and runtime configuration (in-memory Mongo fallback included)
│   │   ├── middleware/# RBAC & source-agnostic driver/IoT device token auth
│   │   ├── models/   # Mongoose models (User, Bus, Route, Trip, LocationPing)
│   │   ├── routes/   # REST endpoints (auth, location ingest, trips, buses, student ETA)
│   │   ├── services/ # ETA engine (OSRM + Haversine fallback) & trip lifecycle safeguards
│   │   └── sockets/  # Real-time WebSocket (Socket.IO) student-isolated room fanout
│   ├── scripts/      # Demo environment seeder (seed.js)
│   └── tests/        # 12-point automated integration test suite
└── README.md
```

## Features (Phase 1)
- **Source-Agnostic Ingestion**: Ingests GPS pings from driver smartphone or AIS-140/4G IoT devices with zero backend changes.
- **Student Privacy & Isolation**: Students can strictly track and query only their assigned bus.
- **Driver Safeguards**: Driver personal numbers are masked; tracking is halted outside active trips; trips running >3 hours auto-terminate.
- **Live Stop ETAs**: Discrete statuses (`Not started`, `Approaching`, `Arrived`, `Departed your stop`).
- **Real-Time WebSocket**: Subscriptions via Socket.IO for live map updates.

## Quick Start

```bash
cd backend
npm install
npm run seed
npm test
npm start
```
