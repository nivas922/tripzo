const Trip = require('../models/Trip');
const Bus = require('../models/Bus');
const config = require('../config');

class TripService {
  /**
   * Retrieves the currently active trip for a bus, automatically enforcing the 3-hour duration limit.
   */
  async getActiveTripForBus(busId) {
    const trip = await Trip.findOne({
      busId,
      status: { $in: ['in_progress', 'RUNNING'] },
    }).sort({ startedAt: -1 });

    if (!trip) {
      return null;
    }

    // Enforce 3-hour max duration safeguard
    const maxDurationMs = config.maxTripDurationHours * 60 * 60 * 1000;
    const elapsedMs = Date.now() - new Date(trip.startedAt).getTime();

    if (elapsedMs > maxDurationMs) {
      trip.status = 'completed';
      trip.endedAt = new Date(new Date(trip.startedAt).getTime() + maxDurationMs);
      trip.autoEndedReason = 'max_duration_exceeded';
      await trip.save();

      console.warn(
        `[TripService] Trip ${trip._id} for bus ${busId} automatically terminated after exceeding ${config.maxTripDurationHours} hours.`
      );
      return null;
    }

    return trip;
  }

  /**
   * Starts a new trip for a bus.
   */
  async startTrip({ busId, routeId, driverId, direction = 'morning' }) {
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
      status: 'in_progress',
      startedAt: new Date(),
    });

    return { trip, isNew: true };
  }

  /**
   * Ends an active trip.
   */
  async endTrip(busId, reason = 'driver_manual_end') {
    const trip = await Trip.findOne({
      busId,
      status: { $in: ['in_progress', 'RUNNING'] },
    }).sort({ startedAt: -1 });

    if (!trip) {
      return null;
    }

    trip.status = 'completed';
    trip.endedAt = new Date();
    trip.autoEndedReason = reason;
    await trip.save();

    return trip;
  }
}

module.exports = new TripService();
