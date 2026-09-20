const axios = require('axios');
const config = require('../../../config');

// In-memory cache for ETA calculations: key -> { data, expiresAt }
const etaCache = new Map();

function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

class EtaService {
  async computeEtaForStudent(bus, route, homeStopId, activeTrip) {
    if (!activeTrip) {
      return {
        status: 'Not started',
        message: 'Bus has not started its trip yet',
        etaMinutes: null,
        distanceKm: null,
        stopName: null,
      };
    }

    if (!bus.lastLocation || !bus.lastLocation.lat || !bus.lastLocation.lng) {
      return {
        status: 'Not started',
        message: 'Awaiting first location ping from bus',
        etaMinutes: null,
        distanceKm: null,
        stopName: null,
      };
    }

    const stops = route.stops || [];
    const studentStop = stops.find((s) => s._id.toString() === homeStopId.toString());

    if (!studentStop) {
      return {
        status: 'Unknown',
        message: 'Student stop not found on this bus route',
        etaMinutes: null,
        distanceKm: null,
        stopName: null,
      };
    }

    const busLat = bus.lastLocation.lat;
    const busLng = bus.lastLocation.lng;

    // 1. Distance check
    const distToStudentStopKm = calculateHaversineDistanceKm(
      busLat,
      busLng,
      studentStop.lat,
      studentStop.lng
    );

    // Arrived state (within 250 meters)
    if (distToStudentStopKm <= 0.25) {
      return {
        status: 'Arrived',
        message: 'Bus is at your stop now',
        etaMinutes: 0,
        distanceKm: parseFloat(distToStudentStopKm.toFixed(2)),
        stopName: studentStop.name,
        lastUpdated: bus.lastLocation.timestamp,
      };
    }

    // 2. Find nearest stop along route sequence
    let nearestStop = stops[0];
    let minDistance = Infinity;

    for (const stop of stops) {
      const d = calculateHaversineDistanceKm(busLat, busLng, stop.lat, stop.lng);
      if (d < minDistance) {
        minDistance = d;
        nearestStop = stop;
      }
    }

    // If bus clearly passed the student's stop
    if (nearestStop.order > studentStop.order && distToStudentStopKm > 0.4) {
      return {
        status: 'Departed your stop',
        message: 'The bus has already passed your stop',
        etaMinutes: 0,
        distanceKm: parseFloat(distToStudentStopKm.toFixed(2)),
        stopName: studentStop.name,
        lastUpdated: bus.lastLocation.timestamp,
      };
    }

    // 3. Cache check (30-second TTL)
    const cacheKey = `${bus._id}:${studentStop._id}:${busLat.toFixed(3)}:${busLng.toFixed(3)}`;
    const cached = etaCache.get(cacheKey);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return {
        ...cached.data,
        status: 'Approaching',
        stopName: studentStop.name,
        lastUpdated: bus.lastLocation.timestamp,
      };
    }

    // 4. Compute ETA via OSRM or fallback
    let etaMinutes = 0;
    let distanceKm = parseFloat(distToStudentStopKm.toFixed(1));

    try {
      const osrmUrl = `${config.osrmBaseUrl}/route/v1/driving/${busLng},${busLat};${studentStop.lng},${studentStop.lat}?overview=false`;
      const response = await axios.get(osrmUrl, { timeout: 3000 });

      if (response.data && response.data.routes && response.data.routes.length > 0) {
        const routeData = response.data.routes[0];
        etaMinutes = Math.max(1, Math.ceil(routeData.duration / 60));
        distanceKm = parseFloat((routeData.distance / 1000).toFixed(1));
      } else {
        throw new Error('OSRM empty route');
      }
    } catch (err) {
      const estimatedHours = distToStudentStopKm / 25;
      const intermediateStops = Math.max(0, studentStop.order - nearestStop.order);
      etaMinutes = Math.max(1, Math.ceil(estimatedHours * 60 + intermediateStops * 2));
      distanceKm = parseFloat(distToStudentStopKm.toFixed(1));
    }

    const result = {
      status: 'Approaching',
      message: `Bus is approaching ${studentStop.name}`,
      etaMinutes,
      distanceKm,
      stopName: studentStop.name,
      lastUpdated: bus.lastLocation.timestamp,
    };

    etaCache.set(cacheKey, {
      data: result,
      expiresAt: now + (config.etaCacheTtlSeconds || 30) * 1000,
    });

    return result;
  }
}

module.exports = new EtaService();
