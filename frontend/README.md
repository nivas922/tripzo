# TripZo Live - Frontend (React + Vite)

Standalone, real-time College Bus Live GPS Tracking System web client built with **React 18**, **Vite**, **Tailwind CSS**, **Leaflet**, and **Socket.IO Client**.

---

## Features

- **Student Live Tracking Dashboard**:
  - Live animated bus tracking with rotating compass heading.
  - Route polyline with numbered stops and student's designated stop highlighted.
  - Dynamic ETA card computing real-time remaining distance (km) and estimated arrival time (minutes).
  - Status badges for all trip events: `Bus not started`, `Bus is running`, `Bus approaching your stop`, `Bus reached your stop`, `Bus is off route`, `Bus temporarily offline`, `Bus trip completed`.
  - Auto-center map toggle and manual refresh button.

- **Driver Telemetry Console**:
  - Trip journey lifecycle controls: **Start Trip** (Morning/Evening direction), **Pause Trip**, **Resume Trip**, **End Trip**.
  - Live GPS Telemetry Broadcaster: transmits coordinates via `navigator.geolocation.watchPosition` every 3–5 seconds to `/api/location/update` and Socket.IO.
  - Development Demo Simulation mode for testing route movement on desktop browsers.
  - Live digital speedometer (km/h) and off-route detection warning banner.

- **Admin Fleet Console**:
  - Real-time fleet KPI statistics (Total buses, active routes, students, live trips).
  - Bus Management (CRUD buses, assign routes, drivers).
  - Route Management (Create routes, add stops with sequence order and geo-coordinates).
  - Student Assignment Manager (Assign students to bus, route, and designated pickup stop).
  - Historical trips log with status and timestamps.

- **Authentication & Security**:
  - JWT-based authentication stored in `localStorage`.
  - Role-based routing (`STUDENT`, `DRIVER`, `ADMIN`).
  - One-click quick demo login buttons for instant testing.

---

## Local Development Setup

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Default `VITE_API_URL` points to `http://localhost:5000`.

3. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Runs locally at `http://localhost:5173`.

---

## Deploying to Vercel

1. Push your changes to your GitHub repository:
   ```bash
   git push origin main
   ```
2. In your [Vercel Dashboard](https://vercel.com/):
   - Click **Add New Project** &rarr; Select your `tripzo` repository.
   - Set **Root Directory** to `frontend`.
   - In **Environment Variables**, add:
     - `VITE_API_URL` = `https://your-backend-app.onrender.com` (replace with your Render backend URL)
   - Click **Deploy**.
3. Vercel will automatically build the application and provide a global production URL (e.g. `https://tripzo-live.vercel.app`).
