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
    },
    driverId: {
      type: String, // String to support both Mongo IDs and external host driver IDs
      default: null,
    },
    date: {
      type: String,
      default: () => new Date().toISOString().split('T')[0],
      index: true,
    },
    direction: {
      type: String,
      enum: ['morning', 'evening'],
      default: 'morning',
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    autoEndedReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

tripSchema.index({ busId: 1, status: 1 });

const Trip = mongoose.models.Trip || mongoose.model('Trip', tripSchema);

module.exports = Trip;
