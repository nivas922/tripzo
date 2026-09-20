const mongoose = require('mongoose');
const Bus = require('../models/Bus');
const Route = require('../models/Route');
const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');
const StudentProfile = require('../models/StudentProfile');
const tripService = require('../services/tripService');

const busController = {
  /**
   * @route   GET /api/buses
   * @desc    Get all buses (Admin, Driver, Student)
   */
  async getAllBuses(req, res, next) {
    try {
      const { active, routeId } = req.query;
      const filter = {};

      if (active !== undefined) {
        filter.active = active === 'true' || active === true;
      }
      if (routeId) {
        filter.routeId = routeId;
      }

      const buses = await Bus.find(filter)
        .populate('routeId', 'name routeNumber stops')
        .populate('driverId', 'name email role')
        .populate('assignedDriverId', 'name email role')
        .sort({ busNumber: 1, createdAt: -1 });

      res.status(200).json({
        success: true,
        count: buses.length,
        buses,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   GET /api/buses/:id
   * @desc    Get bus by ID
   */
  async getBusById(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid bus ID format' });
      }

      const bus = await Bus.findById(id)
        .populate('routeId', 'name routeNumber stops routePolyline')
        .populate('driverId', 'name email role')
        .populate('assignedDriverId', 'name email role');

      if (!bus) {
        return res.status(404).json({ success: false, message: 'Bus not found' });
      }

      res.status(200).json({
        success: true,
        bus,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   POST /api/buses
   * @desc    Create a new bus (Admin only)
   */
  async createBus(req, res, next) {
    try {
      const {
        busNumber,
        registrationNumber,
        routeId,
        driverId,
        assignedDriverId,
        deviceToken,
        capacity,
        active,
      } = req.body;

      if (!busNumber || !registrationNumber) {
        return res.status(400).json({
          success: false,
          message: 'Both busNumber and registrationNumber are required',
        });
      }

      const normalizedReg = registrationNumber.trim().toUpperCase();

      const existing = await Bus.findOne({ registrationNumber: normalizedReg });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: `Bus with registration number ${normalizedReg} already exists`,
        });
      }

      if (deviceToken) {
        const tokenExists = await Bus.findOne({ deviceToken: deviceToken.trim() });
        if (tokenExists) {
          return res.status(409).json({
            success: false,
            message: `Device token ${deviceToken} is already assigned to another bus`,
          });
        }
      }

      if (routeId) {
        const route = await Route.findById(routeId);
        if (!route) {
          return res.status(404).json({ success: false, message: 'Route not found' });
        }
      }

      const resolvedDriverId = driverId || assignedDriverId;
      if (resolvedDriverId) {
        const driverUser = await User.findById(resolvedDriverId);
        if (!driverUser) {
          return res.status(404).json({ success: false, message: 'Driver user not found' });
        }
        if ((driverUser.role || '').toUpperCase() !== 'DRIVER') {
          return res.status(400).json({ success: false, message: 'Assigned user does not have DRIVER role' });
        }
      }

      const bus = await Bus.create({
        busNumber: busNumber.trim(),
        registrationNumber: normalizedReg,
        routeId: routeId || null,
        driverId: resolvedDriverId || null,
        assignedDriverId: resolvedDriverId || null,
        deviceToken: deviceToken ? deviceToken.trim() : undefined,
        capacity: capacity !== undefined ? Number(capacity) : 50,
        active: active !== undefined ? Boolean(active) : true,
        isActive: active !== undefined ? Boolean(active) : true,
      });

      if (resolvedDriverId) {
        await DriverProfile.findOneAndUpdate(
          { $or: [{ userId: resolvedDriverId }, { _id: resolvedDriverId }] },
          { assignedBusId: bus._id }
        );
        await User.findByIdAndUpdate(resolvedDriverId, { assignedBusId: bus._id });
      }

      const populatedBus = await Bus.findById(bus._id)
        .populate('routeId', 'name routeNumber')
        .populate('driverId', 'name email');

      res.status(201).json({
        success: true,
        message: 'Bus created successfully',
        bus: populatedBus,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   PUT /api/buses/:id
   * @desc    Update bus details (Admin only)
   */
  async updateBus(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid bus ID format' });
      }

      const bus = await Bus.findById(id);
      if (!bus) {
        return res.status(404).json({ success: false, message: 'Bus not found' });
      }

      const {
        busNumber,
        registrationNumber,
        routeId,
        driverId,
        assignedDriverId,
        deviceToken,
        capacity,
        active,
      } = req.body;

      if (busNumber !== undefined) bus.busNumber = busNumber.trim();
      if (registrationNumber !== undefined) {
        const normalizedReg = registrationNumber.trim().toUpperCase();
        if (normalizedReg !== bus.registrationNumber) {
          const duplicate = await Bus.findOne({
            registrationNumber: normalizedReg,
            _id: { $ne: bus._id },
          });
          if (duplicate) {
            return res.status(409).json({
              success: false,
              message: `Registration number ${normalizedReg} is already in use`,
            });
          }
          bus.registrationNumber = normalizedReg;
        }
      }

      if (routeId !== undefined) {
        if (routeId) {
          const route = await Route.findById(routeId);
          if (!route) {
            return res.status(404).json({ success: false, message: 'Route not found' });
          }
          bus.routeId = route._id;
        } else {
          bus.routeId = null;
        }
      }

      if (driverId !== undefined || assignedDriverId !== undefined) {
        const newDriverId = driverId || assignedDriverId;
        const oldDriverId = bus.driverId || bus.assignedDriverId;

        if (newDriverId) {
          const driverUser = await User.findById(newDriverId);
          if (!driverUser) {
            return res.status(404).json({ success: false, message: 'Driver user not found' });
          }
          if ((driverUser.role || '').toUpperCase() !== 'DRIVER') {
            return res.status(400).json({ success: false, message: 'Assigned user does not have DRIVER role' });
          }

          await Bus.updateMany(
            { _id: { $ne: bus._id }, $or: [{ driverId: newDriverId }, { assignedDriverId: newDriverId }] },
            { driverId: null, assignedDriverId: null }
          );

          bus.driverId = newDriverId;
          bus.assignedDriverId = newDriverId;

          await DriverProfile.findOneAndUpdate(
            { $or: [{ userId: newDriverId }, { _id: newDriverId }] },
            { assignedBusId: bus._id }
          );
          await User.findByIdAndUpdate(newDriverId, { assignedBusId: bus._id });
        } else {
          if (oldDriverId) {
            await DriverProfile.findOneAndUpdate(
              { $or: [{ userId: oldDriverId }, { _id: oldDriverId }] },
              { assignedBusId: null }
            );
            await User.findByIdAndUpdate(oldDriverId, { assignedBusId: null });
          }
          bus.driverId = null;
          bus.assignedDriverId = null;
        }
      }

      if (deviceToken !== undefined) {
        if (deviceToken) {
          const trimmed = deviceToken.trim();
          const tokenExists = await Bus.findOne({ deviceToken: trimmed, _id: { $ne: bus._id } });
          if (tokenExists) {
            return res.status(409).json({
              success: false,
              message: `Device token ${trimmed} is already assigned to another bus`,
            });
          }
          bus.deviceToken = trimmed;
        } else {
          bus.deviceToken = undefined;
        }
      }

      if (capacity !== undefined) bus.capacity = Number(capacity);
      if (active !== undefined) {
        bus.active = Boolean(active);
        bus.isActive = Boolean(active);
      }

      await bus.save();

      const populatedBus = await Bus.findById(bus._id)
        .populate('routeId', 'name routeNumber stops')
        .populate('driverId', 'name email role');

      res.status(200).json({
        success: true,
        message: 'Bus updated successfully',
        bus: populatedBus,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   DELETE /api/buses/:id
   * @desc    Delete a bus (Admin only)
   */
  async deleteBus(req, res, next) {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: 'Invalid bus ID format' });
      }

      const bus = await Bus.findById(id);
      if (!bus) {
        return res.status(404).json({ success: false, message: 'Bus not found' });
      }

      await Promise.all([
        StudentProfile.updateMany({ assignedBusId: bus._id }, { assignedBusId: null }),
        DriverProfile.updateMany({ assignedBusId: bus._id }, { assignedBusId: null }),
        User.updateMany({ assignedBusId: bus._id }, { assignedBusId: null }),
        Bus.findByIdAndDelete(bus._id),
      ]);

      res.status(200).json({
        success: true,
        message: 'Bus deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   GET /api/buses/:id/live
   * @desc    Get live position, current trip status, and route geometry for a bus
   */
  async getLiveBus(req, res, next) {
    try {
      const busId = req.params.id;

      if ((req.user?.role || '').toLowerCase() === 'student') {
        if (!req.user.assignedBusId || req.user.assignedBusId.toString() !== busId.toString()) {
          return res.status(403).json({
            success: false,
            message: 'Forbidden: You can only query your assigned bus',
          });
        }
      }

      const bus = await Bus.findById(busId)
        .populate('routeId', 'name stops polyline')
        .populate('assignedDriverId', 'name')
        .populate('driverId', 'name');

      if (!bus) {
        return res.status(404).json({ success: false, message: 'Bus not found' });
      }

      const activeTrip = await tripService.getActiveTripForBus(busId);
      const driverObj = bus.assignedDriverId || bus.driverId;

      res.json({
        success: true,
        bus: {
          id: bus._id,
          registrationNumber: bus.registrationNumber,
          route: bus.routeId,
          driver: driverObj ? { name: driverObj.name } : null,
          activeTrip: activeTrip
            ? {
                id: activeTrip._id,
                direction: activeTrip.direction,
                startedAt: activeTrip.startedAt,
                status: activeTrip.status,
              }
            : null,
          lastLocation: activeTrip ? bus.lastLocation : null,
        },
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = busController;
