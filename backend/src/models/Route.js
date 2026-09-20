const mongoose = require('mongoose');

const stopSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  lat: {
    type: Number,
    required: true,
  },
  lng: {
    type: Number,
    required: true,
  },
  order: {
    type: Number,
    required: true,
  },
  scheduledTime: {
    type: String,
    default: '',
  },
});

const routeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    stops: [stopSchema],
    polyline: {
      type: [[Number]], // [[lng, lat], [lng, lat], ...]
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Route = mongoose.model('Route', routeSchema);

module.exports = Route;
