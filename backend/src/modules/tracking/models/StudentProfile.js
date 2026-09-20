const mongoose = require('mongoose');

/**
 * StudentProfile in Tracking Domain
 * 
 * Notice: This schema does NOT assume anything about the host app's user table.
 * It provides an optional `externalStudentId` which can map 1-to-1 to TripZo's
 * existing student IDs or auth identifiers without coupling to their columns/fields.
 */
const studentProfileSchema = new mongoose.Schema(
  {
    externalStudentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
      // References host app's student identity (e.g. TripZo user ID / registration ID)
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
    homeStopId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      // The specific stop ID on the assigned bus's route
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

const StudentProfile = mongoose.model('StudentProfile', studentProfileSchema);

module.exports = StudentProfile;
