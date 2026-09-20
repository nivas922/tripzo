const Bus = require('../models/Bus');

class BusAdapter {
  async getBusById(busId) {
    return Bus.findById(busId).populate('routeId').populate('driverId', 'name email');
  }

  async getBusByDeviceToken(deviceToken) {
    return Bus.findOne({ deviceToken: deviceToken.trim() });
  }
}

module.exports = new BusAdapter();
