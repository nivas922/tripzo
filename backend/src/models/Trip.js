const mongoose = require('mongoose');

const tripSchema = new mongoose.Schema(
  {
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      required: true,
      index: true,
    },
    routeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: true,
      index: true,
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    date: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
      index: true,
    },
    status: {
      type: String,
      enum: [
        'NOT_STARTED',
        'RUNNING',
        'PAUSED',
        'COMPLETED',
        'OFF_ROUTE',
        'scheduled',
        'in_progress',
        'completed',
        'cancelled',
      ],
      default: 'NOT_STARTED',
      index: true,
    },
    direction: {
      type: String,
      enum: ['MORNING', 'EVENING', 'morning', 'evening'],
      default: 'MORNING',
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    lastLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
      speed: { type: Number, default: 0 },
      heading: { type: Number, default: 0 },
      timestamp: { type: Date },
    },
    autoEndedReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

tripSchema.index({ busId: 1, status: 1 });

const Trip = mongoose.models.Trip || mongoose.model('Trip', tripSchema);

module.exports = Trip;
