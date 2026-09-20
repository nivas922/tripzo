const mongoose = require('mongoose');

const lastLocationSchema = new mongoose.Schema(
  {
    latitude: { type: Number },
    longitude: { type: Number },
    lat: { type: Number },
    lng: { type: Number },
    speed: { type: Number, default: 0 },
    heading: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
  },
  { _id: false }
);

lastLocationSchema.pre('validate', function (next) {
  if (this.latitude === undefined && this.lat !== undefined) this.latitude = this.lat;
  if (this.lat === undefined && this.latitude !== undefined) this.lat = this.latitude;
  if (this.longitude === undefined && this.lng !== undefined) this.longitude = this.lng;
  if (this.lng === undefined && this.longitude !== undefined) this.lng = this.longitude;
  next();
});

const busSchema = new mongoose.Schema(
  {
    busNumber: {
      type: String,
      required: [true, 'Bus number is required'],
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    assignedDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    deviceToken: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
      // For future 4G IoT / AIS-140 GPS trackers
    },
    active: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    capacity: {
      type: Number,
      default: 50,
    },
    lastLocation: {
      type: lastLocationSchema,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

busSchema.pre('validate', function (next) {
  if (!this.busNumber && this.registrationNumber) {
    this.busNumber = this.registrationNumber;
  }
  if (this.isActive !== undefined && this.active === undefined) {
    this.active = this.isActive;
  }
  if (this.active !== undefined && this.isActive === undefined) {
    this.isActive = this.active;
  }
  if (this.assignedDriverId && !this.driverId) {
    this.driverId = this.assignedDriverId;
  }
  if (this.driverId && !this.assignedDriverId) {
    this.assignedDriverId = this.driverId;
  }
  next();
});

const Bus = mongoose.models.Bus || mongoose.model('Bus', busSchema);

module.exports = Bus;
