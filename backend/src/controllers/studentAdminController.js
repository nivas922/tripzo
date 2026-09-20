const mongoose = require('mongoose');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const DriverProfile = require('../models/DriverProfile');
const Bus = require('../models/Bus');
const Route = require('../models/Route');

const studentAdminController = {
  /**
   * @route   GET /api/students
   * @desc    List all students with profile & assignment details (Admin only)
   */
  async getAllStudents(req, res, next) {
    try {
      const students = await User.find({ role: 'STUDENT' })
        .select('-password -passwordHash')
        .sort({ name: 1 });

      const studentIds = students.map((s) => s._id);
      const profiles = await StudentProfile.find({ userId: { $in: studentIds } })
        .populate('assignedBusId', 'busNumber registrationNumber')
        .populate('assignedRouteId', 'name routeNumber stops');

      const profileMap = new Map();
      profiles.forEach((p) => {
        profileMap.set(p.userId.toString(), p);
      });

      const enrichedStudents = students.map((s) => {
        const p = profileMap.get(s._id.toString());
        let stopDetails = null;
        if (p?.homeStopId && p?.assignedRouteId?.stops) {
          stopDetails = p.assignedRouteId.stops.find(
            (stop) => stop._id.toString() === p.homeStopId.toString()
          );
        }

        return {
          id: s._id,
          name: s.name,
          email: s.email,
          studentId: p?.studentId || null,
          assignedBus: p?.assignedBusId || null,
          assignedRoute: p?.assignedRouteId
            ? { id: p.assignedRouteId._id, name: p.assignedRouteId.name, routeNumber: p.assignedRouteId.routeNumber }
            : null,
          homeStop: stopDetails ? { id: stopDetails._id, name: stopDetails.name, sequence: stopDetails.sequence } : null,
        };
      });

      res.status(200).json({
        success: true,
        count: enrichedStudents.length,
        students: enrichedStudents,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   GET /api/students/me
   * @desc    Get currently logged in student's own assignment details
   */
  async getMyProfile(req, res, next) {
    try {
      const user = await User.findById(req.user.id || req.user.userId).select('-password -passwordHash');
      if (!user) {
        return res.status(404).json({ success: false, message: 'Student not found' });
      }

      let profile = await StudentProfile.findOne({
        $or: [{ userId: user._id }, { _id: user._id }],
      })
        .populate('assignedBusId', 'busNumber registrationNumber lastLocation active')
        .populate('assignedRouteId', 'name routeNumber stops routePolyline');

      // Fallback to user attributes if profile was not created yet
      let assignedBus = profile?.assignedBusId;
      if (!assignedBus && user.assignedBusId) {
        assignedBus = await Bus.findById(user.assignedBusId).select('busNumber registrationNumber lastLocation active');
      }

      let assignedRoute = profile?.assignedRouteId;
      if (!assignedRoute && assignedBus?.routeId) {
        assignedRoute = await Route.findById(assignedBus.routeId);
      }

      const homeStopId = profile?.homeStopId || user.homeStopId;
      let homeStop = null;
      if (homeStopId && assignedRoute?.stops) {
        homeStop = assignedRoute.stops.find((s) => s._id.toString() === homeStopId.toString());
      }

      res.status(200).json({
        success: true,
        student: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          studentId: profile?.studentId || null,
          assignedBus,
          assignedRoute,
          homeStop,
        },
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   PUT /api/students/:id/assignment
   * @desc    Assign or update a student's bus, route, and designated stop (Admin only)
   */
  async assignStudent(req, res, next) {
    try {
      const { id } = req.params;
      let user;

      if (mongoose.Types.ObjectId.isValid(id)) {
        user = await User.findById(id);
      }
      if (!user) {
        const profile = await StudentProfile.findOne({ studentId: id });
        if (profile) {
          user = await User.findById(profile.userId);
        }
      }

      if (!user) {
        return res.status(404).json({ success: false, message: 'Student user not found' });
      }

      const { assignedBusId, assignedRouteId, homeStopId } = req.body;

      let resolvedRouteId = assignedRouteId;
      let busDoc = null;

      // Validate bus if provided
      if (assignedBusId) {
        if (!mongoose.Types.ObjectId.isValid(assignedBusId)) {
          return res.status(400).json({ success: false, message: 'Invalid bus ID format' });
        }
        busDoc = await Bus.findById(assignedBusId);
        if (!busDoc) {
          return res.status(404).json({ success: false, message: 'Assigned bus not found' });
        }
        // If routeId not explicitly passed, infer from bus
        if (!resolvedRouteId && busDoc.routeId) {
          resolvedRouteId = busDoc.routeId.toString();
        }
      }

      // Validate route if provided
      let routeDoc = null;
      if (resolvedRouteId) {
        if (!mongoose.Types.ObjectId.isValid(resolvedRouteId)) {
          return res.status(400).json({ success: false, message: 'Invalid route ID format' });
        }
        routeDoc = await Route.findById(resolvedRouteId);
        if (!routeDoc) {
          return res.status(404).json({ success: false, message: 'Assigned route not found' });
        }
      }

      // Validate that homeStopId exists within the chosen route
      if (homeStopId) {
        if (!routeDoc) {
          return res.status(400).json({
            success: false,
            message: 'Cannot assign home stop without an associated route',
          });
        }
        const stopExists = routeDoc.stops.some(
          (s) => s._id.toString() === homeStopId.toString()
        );
        if (!stopExists) {
          return res.status(400).json({
            success: false,
            message: 'Designated home stop does not belong to the assigned route',
          });
        }
      }

      // Update or create StudentProfile
      const updatedProfile = await StudentProfile.findOneAndUpdate(
        { $or: [{ userId: user._id }, { _id: user._id }] },
        {
          userId: user._id,
          assignedBusId: assignedBusId || null,
          assignedRouteId: resolvedRouteId || null,
          homeStopId: homeStopId || null,
        },
        { new: true, upsert: true }
      );

      // Synchronize to User document for backwards compatibility
      user.assignedBusId = assignedBusId || null;
      user.homeStopId = homeStopId || null;
      await user.save();

      res.status(200).json({
        success: true,
        message: 'Student assignment updated successfully',
        assignment: {
          studentId: user._id,
          name: user.name,
          assignedBusId: assignedBusId || null,
          assignedRouteId: resolvedRouteId || null,
          homeStopId: homeStopId || null,
        },
        profile: updatedProfile,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   GET /api/drivers
   * @desc    List all drivers and their assigned buses (Admin only)
   */
  async getAllDrivers(req, res, next) {
    try {
      const drivers = await User.find({ role: 'DRIVER' })
        .select('-password -passwordHash')
        .sort({ name: 1 });

      const driverIds = drivers.map((d) => d._id);
      const profiles = await DriverProfile.find({ userId: { $in: driverIds } })
        .populate('assignedBusId', 'busNumber registrationNumber routeId active');

      const profileMap = new Map();
      profiles.forEach((p) => {
        profileMap.set(p.userId.toString(), p);
      });

      // Also query buses directly in case bus.driverId is set
      const assignedBuses = await Bus.find({
        $or: [{ driverId: { $in: driverIds } }, { assignedDriverId: { $in: driverIds } }],
      });
      const busByDriver = new Map();
      assignedBuses.forEach((b) => {
        if (b.driverId) busByDriver.set(b.driverId.toString(), b);
        if (b.assignedDriverId) busByDriver.set(b.assignedDriverId.toString(), b);
      });

      const enrichedDrivers = drivers.map((d) => {
        const p = profileMap.get(d._id.toString());
        const bus = p?.assignedBusId || busByDriver.get(d._id.toString()) || null;

        return {
          id: d._id,
          name: d.name,
          email: d.email,
          phone: d.phone || null,
          employeeId: p?.employeeId || null,
          assignedBus: bus
            ? {
                id: bus._id,
                busNumber: bus.busNumber,
                registrationNumber: bus.registrationNumber,
                active: bus.active,
              }
            : null,
        };
      });

      res.status(200).json({
        success: true,
        count: enrichedDrivers.length,
        drivers: enrichedDrivers,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = studentAdminController;
