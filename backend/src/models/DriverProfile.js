const mongoose = require('mongoose');

const driverProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    employeeId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    externalDriverId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
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

driverProfileSchema.pre('validate', function (next) {
  if (!this.userId && this._id) {
    this.userId = this._id;
  }
  if (!this.employeeId && this.externalDriverId) {
    this.employeeId = this.externalDriverId;
  }
  if (!this.externalDriverId && this.employeeId) {
    this.externalDriverId = this.employeeId;
  }
  if (!this.employeeId) {
    return next(new Error('Driver employee ID is required'));
  }
  next();
});

const DriverProfile =
  mongoose.models.DriverProfile || mongoose.model('DriverProfile', driverProfileSchema);

module.exports = DriverProfile;
