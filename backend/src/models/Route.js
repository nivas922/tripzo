const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Stop name is required'],
    trim: true,
  },
  latitude: {
    type: Number,
    min: -90,
    max: 90,
  },
  lat: {
    type: Number,
  },
  longitude: {
    type: Number,
    min: -180,
    max: 180,
  },
  lng: {
    type: Number,
  },
  sequence: {
    type: Number,
  },
  order: {
    type: Number,
  },
  expectedTime: {
    type: String,
    default: '',
    trim: true,
  },
  scheduledTime: {
    type: String,
    default: '',
  },
});

// Automatically synchronize aliases between lat/latitude, lng/longitude, order/sequence
stopSchema.pre('validate', function (next) {
  if (this.latitude === undefined && this.lat !== undefined) this.latitude = this.lat;
  if (this.lat === undefined && this.latitude !== undefined) this.lat = this.latitude;
  if (this.longitude === undefined && this.lng !== undefined) this.longitude = this.lng;
  if (this.lng === undefined && this.longitude !== undefined) this.lng = this.longitude;
  if (this.sequence === undefined && this.order !== undefined) this.sequence = this.order;
  if (this.order === undefined && this.sequence !== undefined) this.order = this.sequence;
  if (!this.expectedTime && this.scheduledTime) this.expectedTime = this.scheduledTime;
  if (!this.scheduledTime && this.expectedTime) this.scheduledTime = this.expectedTime;

  if (this.latitude === undefined) return next(new Error('Latitude is required'));
  if (this.longitude === undefined) return next(new Error('Longitude is required'));
  if (this.sequence === undefined) return next(new Error('Stop sequence number is required'));

  next();
});

const routeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Route name is required'],
      trim: true,
    },
    routeNumber: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    stops: [stopSchema],
    routePolyline: {
      type: [[Number]], // [[lng, lat], [lng, lat], ...]
      default: [],
    },
    polyline: {
      type: [[Number]],
      default: [],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

routeSchema.pre('validate', function (next) {
  if (!this.routeNumber && this.name) {
    const match = this.name.match(/\b([A-Z0-9]+)\b/);
    this.routeNumber = match ? match[1] : 'R1';
  }
  if (this.polyline.length > 0 && this.routePolyline.length === 0) {
    this.routePolyline = this.polyline;
  }
  if (this.routePolyline.length > 0 && this.polyline.length === 0) {
    this.polyline = this.routePolyline;
  }
  next();
});

const Route = mongoose.models.Route || mongoose.model('Route', routeSchema);

module.exports = Route;
