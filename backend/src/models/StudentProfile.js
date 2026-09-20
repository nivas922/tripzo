const mongoose = require('mongoose');

const studentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    studentId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      index: true,
    },
    externalStudentId: {
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
    assignedRouteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      default: null,
      index: true,
    },
    homeStopId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      // References the student's designated boarding/alighting stop on the route
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

studentProfileSchema.pre('validate', function (next) {
  if (!this.userId) {
    this.userId = this._id || new mongoose.Types.ObjectId();
  }
  if (!this.studentId && this.externalStudentId) {
    this.studentId = this.externalStudentId;
  }
  if (!this.externalStudentId && this.studentId) {
    this.externalStudentId = this.studentId;
  }
  if (!this.studentId) {
    return next(new Error('Student ID number is required'));
  }
  next();
});

const StudentProfile =
  mongoose.models.StudentProfile || mongoose.model('StudentProfile', studentProfileSchema);

module.exports = StudentProfile;
