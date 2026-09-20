const mongoose = require('mongoose');
const DriverProfile = require('../models/DriverProfile');

class DriverAdapter {
  async getDriverProfile(identifier) {
    if (!identifier) return null;
    const isObjectId = mongoose.Types.ObjectId.isValid(identifier) && String(new mongoose.Types.ObjectId(identifier)) === String(identifier);
    const query = isObjectId
      ? { $or: [{ userId: identifier }, { employeeId: identifier }] }
      : { employeeId: identifier };

    return DriverProfile.findOne(query).populate('assignedBusId');
  }

  async assignDriverToBus(employeeId, busId) {
    return DriverProfile.findOneAndUpdate(
      { employeeId },
      { assignedBusId: busId },
      { new: true, upsert: true }
    );
  }
}

module.exports = new DriverAdapter();
