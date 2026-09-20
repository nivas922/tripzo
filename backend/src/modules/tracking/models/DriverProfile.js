const mongoose = require('mongoose');

/**
 * DriverProfile in Tracking Domain
 * 
 * Maps to the host app's driver identity via `externalDriverId`.
 * Note: Personal phone numbers are deliberately excluded from tracking domain
 * to prevent privacy leaks.
 */
const driverProfileSchema = new mongoose.Schema(
  {
    externalDriverId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    assignedBusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Bus',
      default: null,
      index: true,
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

const DriverProfile = mongoose.model('DriverProfile', driverProfileSchema);

module.exports = DriverProfile;
