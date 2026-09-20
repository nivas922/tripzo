const jwt = require('jsonwebtoken');
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const DriverProfile = require('../models/DriverProfile');
const Bus = require('../models/Bus');
const config = require('../config');

const authController = {
  /**
   * @route   POST /api/auth/register
   * @desc    Register a new user (STUDENT, DRIVER, ADMIN) and create associated profile
   */
  async register(req, res, next) {
    try {
      const { name, email, password, role = 'STUDENT', studentId, employeeId } = req.body;
      const normalizedEmail = email.toLowerCase().trim();
      const normalizedRole = role.toUpperCase();

      // Check for existing user
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'An account with this email address already exists',
        });
      }

      // 1. Create User
      const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password,
        role: normalizedRole,
      });

      // 2. Create role-specific profile
      let profile = null;
      if (normalizedRole === 'STUDENT') {
        const sid = studentId || `STU-${Date.now().toString().slice(-6)}`;
        profile = await StudentProfile.create({
          userId: user._id,
          studentId: sid,
        });
      } else if (normalizedRole === 'DRIVER') {
        const eid = employeeId || `DRV-${Date.now().toString().slice(-6)}`;
        profile = await DriverProfile.create({
          userId: user._id,
          employeeId: eid,
        });
      }

      // 3. Generate JWT
      const token = jwt.sign(
        {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      res.status(201).json({
        success: true,
        message: 'Account registered successfully',
        token,
        user: user.toSafeJSON(),
        profile,
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   POST /api/auth/login
   * @desc    Authenticate user and return JWT
   */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const normalizedEmail = email.toLowerCase().trim();

      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password',
        });
      }

      // Load profile to attach bus/route context
      let assignedBusId = null;
      let homeStopId = null;

      const normalizedRole = (user.role || '').toUpperCase();

      if (normalizedRole === 'STUDENT') {
        const profile = await StudentProfile.findOne({
          $or: [{ userId: user._id }, { _id: user._id }],
        });
        if (profile) {
          assignedBusId = profile.assignedBusId ? profile.assignedBusId.toString() : null;
          homeStopId = profile.homeStopId ? profile.homeStopId.toString() : null;
        }
        if (!assignedBusId && user.assignedBusId) {
          assignedBusId = user.assignedBusId.toString();
        }
        if (!homeStopId && user.homeStopId) {
          homeStopId = user.homeStopId.toString();
        }
      } else if (normalizedRole === 'DRIVER') {
        const profile = await DriverProfile.findOne({
          $or: [{ userId: user._id }, { _id: user._id }],
        });
        if (profile) {
          assignedBusId = profile.assignedBusId ? profile.assignedBusId.toString() : null;
        }
        if (!assignedBusId && user.assignedBusId) {
          assignedBusId = user.assignedBusId.toString();
        }
        if (!assignedBusId) {
          const b = await Bus.findOne({
            $or: [{ driverId: user._id }, { assignedDriverId: user._id }],
          });
          if (b) assignedBusId = b._id.toString();
        }
      }

      const token = jwt.sign(
        {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
          assignedBusId,
          homeStopId,
        },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: user.toSafeJSON(),
      });
    } catch (err) {
      next(err);
    }
  },

  /**
   * @route   GET /api/auth/me
   * @desc    Get profile of the currently authenticated user
   */
  async getMe(req, res, next) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      let profile = null;
      if (user.role === 'STUDENT') {
        profile = await StudentProfile.findOne({ userId: user._id })
          .populate('assignedBusId')
          .populate('assignedRouteId');
      } else if (user.role === 'DRIVER') {
        profile = await DriverProfile.findOne({ userId: user._id }).populate('assignedBusId');
      }

      res.status(200).json({
        success: true,
        user: user.toSafeJSON(),
        profile,
      });
    } catch (err) {
      next(err);
    }
  },
};

module.exports = authController;
