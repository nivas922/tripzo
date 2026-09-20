const mongoose = require('mongoose');
const config = require('../config');

const locationSchema = new mongoose.Schema(
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
    latitude: {
      type: Number,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
    },
    lat: {
      type: Number,
    },
    lng: {
      type: Number,
    },
    speed: {
      type: Number,
      default: 0,
      min: 0,
    },
    heading: {
      type: Number,
      default: 0,
      min: 0,
      max: 360,
    },
    source: {
      type: String,
      enum: ['DRIVER_PHONE', 'IOT_DEVICE'],
      default: 'DRIVER_PHONE',
      required: true,
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

locationSchema.pre('validate', function (next) {
  if (this.latitude === undefined && this.lat !== undefined) this.latitude = this.lat;
  if (this.lat === undefined && this.latitude !== undefined) this.lat = this.latitude;
  if (this.longitude === undefined && this.lng !== undefined) this.longitude = this.lng;
  if (this.lng === undefined && this.longitude !== undefined) this.lng = this.longitude;

  if (this.latitude === undefined) return next(new Error('Latitude is required'));
  if (this.longitude === undefined) return next(new Error('Longitude is required'));
  next();
});

locationSchema.index({ busId: 1, timestamp: -1 });

// TTL index for automatic 7-day data purging
const ttlSeconds = (config.locationPingTtlDays || 7) * 24 * 60 * 60;
locationSchema.index({ timestamp: 1 }, { expireAfterSeconds: ttlSeconds });

const Location = mongoose.models.Location || mongoose.model('Location', locationSchema);

module.exports = Location;
