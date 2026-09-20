const Bus = require('../models/Bus');
const StudentProfile = require('../models/StudentProfile');
const tripService = require('../services/tripService');
const etaService = require('../services/etaService');

const studentController = {
  async getStudentEta(req, res, next) {
    try {
      let assignedBusId = req.user?.assignedBusId;
      let homeStopId = req.user?.homeStopId;

      // If not populated in token/userContext, resolve via StudentProfile using externalStudentId or user id
      if (!assignedBusId || !homeStopId) {
        const profile = await StudentProfile.findOne({
          $or: [
            { externalStudentId: req.user?.externalId || req.user?.id },
            { _id: req.user?.id },
          ],
        });

        if (profile) {
          assignedBusId = profile.assignedBusId;
          homeStopId = profile.homeStopId;
        }
      }

      if (!assignedBusId) {
        return res.status(400).json({
          success: false,
          message: 'No bus assigned to your student account. Please contact campus transport.',
        });
      }

      if (!homeStopId) {
        return res.status(400).json({
          success: false,
          message: 'No home stop selected for your student account.',
        });
      }

      const bus = await Bus.findById(assignedBusId).populate('routeId');
      if (!bus) {
        return res.status(404).json({ success: false, message: 'Assigned bus not found' });
      }

      if (!bus.routeId) {
        return res.status(404).json({ success: false, message: 'No route assigned to your bus' });
      }

      const activeTrip = await tripService.getActiveTripForBus(bus._id);

      const etaResult = await etaService.computeEtaForStudent(
        bus,
        bus.routeId,
        homeStopId,
        activeTrip
      );

      res.json({
        success: true,
        busRegistration: bus.registrationNumber,
        tripStatus: activeTrip ? activeTrip.status : 'not_started',
        eta: etaResult,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = studentController;
