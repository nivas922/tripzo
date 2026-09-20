const mongoose = require('mongoose');

const lastLocationSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    speed: { type: Number, default: 0 },
    heading: { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
    tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
  },
  { _id: false }
);

const busSchema = new mongoose.Schema(
  {
    registrationNumber: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
    },
    assignedDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deviceToken: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      // Used for source-agnostic hardware GPS trackers (AIS-140 / 4G tracker)
    },
    capacity: {
      type: Number,
      default: 50,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLocation: {
      type: lastLocationSchema,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Bus = mongoose.model('Bus', busSchema);

module.exports = Bus;
