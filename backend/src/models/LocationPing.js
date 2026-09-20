const mongoose = require('mongoose');
const config = require('../config');

const locationPingSchema = new mongoose.Schema(
  {
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      required: true,
      index: true,
    },
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
    speed: {
      type: Number,
      default: 0,
    },
    heading: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: false,
  }
);

// Compound index for querying recent pings for a bus
locationPingSchema.index({ busId: 1, timestamp: -1 });

// TTL Index: Automatically purge location pings after 7 days (604,800 seconds)
const ttlSeconds = config.locationPingTtlDays * 24 * 60 * 60;
locationPingSchema.index({ timestamp: 1 }, { expireAfterSeconds: ttlSeconds });

const LocationPing = mongoose.model('LocationPing', locationPingSchema);

module.exports = LocationPing;
