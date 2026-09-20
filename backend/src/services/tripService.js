const mongoose = require('mongoose');
const Trip = require('../models/Trip');
const Bus = require('../models/Bus');
const config = require('../config');

class TripService {
  /**
   * Retrieves the currently active trip for a bus, automatically enforcing the 3-hour duration limit.
   */
  async getActiveTripForBus(busId) {
    if (!mongoose.Types.ObjectId.isValid(busId)) {
      return null;
    }

    const trip = await Trip.findOne({
      busId,
      status: { $in: ['in_progress', 'RUNNING', 'PAUSED'] },
    }).sort({ startedAt: -1 });

    if (!trip) {
      return null;
    }

    // Enforce 3-hour max duration safeguard
    const maxDurationMs = (config.maxTripDurationHours || 3) * 60 * 60 * 1000;
    const elapsedMs = Date.now() - new Date(trip.startedAt).getTime();

    if (elapsedMs > maxDurationMs) {
      trip.status = 'completed';
      trip.endedAt = new Date(new Date(trip.startedAt).getTime() + maxDurationMs);
      trip.autoEndedReason = 'max_duration_exceeded';
      await trip.save();

      console.warn(
        `[TripService] Trip ${trip._id} for bus ${busId} automatically terminated after exceeding ${config.maxTripDurationHours || 3} hours.`
      );
      return null;
    }

    return trip;
  }

  /**
   * Starts a new trip for a bus.
   */
  async startTrip({ busId, routeId, driverId, direction = 'morning', status = 'in_progress' }) {
    // Check if there is already an active trip
    const existing = await this.getActiveTripForBus(busId);
    if (existing) {
      return { trip: existing, isNew: false };
    }

    const bus = await Bus.findById(busId);
    if (!bus) {
      throw new Error('Bus not found');
    }

    const targetRouteId = routeId || bus.routeId;
    if (!targetRouteId) {
      throw new Error('No route assigned to this bus');
    }

    const trip = await Trip.create({
      busId,
      routeId: targetRouteId,
      driverId: driverId || bus.driverId || bus.assignedDriverId,
      direction,
      status: status || 'in_progress',
      startedAt: new Date(),
    });

    return { trip, isNew: true };
  }

  /**
   * Pauses an active trip.
   */
  async pauseTrip(tripIdOrBusId) {
    let trip = null;
    if (mongoose.Types.ObjectId.isValid(tripIdOrBusId)) {
      trip = await Trip.findById(tripIdOrBusId);
      if (!trip) {
        trip = await this.getActiveTripForBus(tripIdOrBusId);
      }
    }

    if (!trip) {
      return null;
    }

    trip.status = 'PAUSED';
    await trip.save();
    return trip;
  }

  /**
   * Resumes a paused trip.
   */
  async resumeTrip(tripIdOrBusId) {
    let trip = null;
    if (mongoose.Types.ObjectId.isValid(tripIdOrBusId)) {
      trip = await Trip.findById(tripIdOrBusId);
      if (!trip) {
        trip = await Trip.findOne({
          busId: tripIdOrBusId,
          status: 'PAUSED',
        }).sort({ startedAt: -1 });
      }
    }

    if (!trip) {
      return null;
    }

    trip.status = 'RUNNING';
    await trip.save();
    return trip;
  }

  /**
   * Ends an active trip.
   */
  async endTrip(busIdOrTripId, reason = 'driver_manual_end') {
    let trip = null;
    if (mongoose.Types.ObjectId.isValid(busIdOrTripId)) {
      trip = await Trip.findOne({
        _id: busIdOrTripId,
        status: { $in: ['in_progress', 'RUNNING', 'PAUSED'] },
      });
      if (!trip) {
        trip = await Trip.findOne({
          busId: busIdOrTripId,
          status: { $in: ['in_progress', 'RUNNING', 'PAUSED'] },
        }).sort({ startedAt: -1 });
      }
    }

    if (!trip) {
      return null;
    }

    trip.status = 'completed';
    trip.endedAt = new Date();
    trip.autoEndedReason = reason;
    await trip.save();

    return trip;
  }

  /**
   * Get trip by ID with populated associations.
   */
  async getTripById(tripId) {
    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      return null;
    }
    return Trip.findById(tripId)
      .populate('busId', 'busNumber registrationNumber deviceToken active')
      .populate('routeId', 'name routeNumber stops routePolyline')
      .populate('driverId', 'name email role');
  }

  /**
   * Query trips history with filters and pagination.
   */
  async getTripsHistory({ busId, driverId, status, date, limit = 50, skip = 0 } = {}) {
    const query = {};
    if (busId && mongoose.Types.ObjectId.isValid(busId)) query.busId = busId;
    if (driverId && mongoose.Types.ObjectId.isValid(driverId)) query.driverId = driverId;
    if (status) query.status = status;
    if (date) query.date = date;

    const parsedSkip = Math.max(0, Number(skip) || 0);
    const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 50));

    const trips = await Trip.find(query)
      .populate('busId', 'busNumber registrationNumber')
      .populate('routeId', 'name routeNumber')
      .populate('driverId', 'name email')
      .sort({ startedAt: -1 })
      .skip(parsedSkip)
      .limit(parsedLimit);

    const total = await Trip.countDocuments(query);

    return { trips, total };
  }
}

module.exports = new TripService();
