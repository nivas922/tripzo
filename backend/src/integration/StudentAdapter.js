const mongoose = require('mongoose');
const StudentProfile = require('../models/StudentProfile');

/**
 * @interface StudentAdapter
 * Decouples student identity from host app tables.
 */
class StudentAdapter {
  /**
   * Retrieves student profile by user ID or student ID.
   */
  async getStudentProfile(identifier) {
    if (!identifier) return null;
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier) && String(new mongoose.Types.ObjectId(identifier)) === String(identifier);
    const query = isObjectId
      ? { $or: [{ userId: identifier }, { studentId: identifier }] }
      : { studentId: identifier };

    return StudentProfile.findOne(query)
      .populate('assignedBusId')
      .populate('assignedRouteId');
  }

  /**
   * Links student to a bus and home stop.
   */
  async assignStudentToBus(studentId, busId, routeId, homeStopId) {
    return StudentProfile.findOneAndUpdate(
      { studentId },
      { assignedBusId: busId, assignedRouteId: routeId, homeStopId },
      { new: true, upsert: true }
    );
  }
}

module.exports = new StudentAdapter();
