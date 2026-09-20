const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const JwtAuthProvider = require('./JwtAuthProvider');
const createAuthMiddleware = require('./authMiddleware');

function createAuthRoutes(jwtProvider = new JwtAuthProvider()) {
  const router = express.Router();
  const { requireAuth } = createAuthMiddleware(jwtProvider);

  router.post('/login', async (req, res, next) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required' });
      }

      const user = await User.findOne({ email: email.toLowerCase().trim() });
      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const payload = {
        id: user._id.toString(),
        externalId: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        assignedBusId: user.assignedBusId ? user.assignedBusId.toString() : null,
        homeStopId: user.homeStopId ? user.homeStopId.toString() : null,
      };

      const token = jwtProvider.generateToken(payload);

      res.json({
        success: true,
        token,
        user: user.toSafeJSON(),
      });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', requireAuth, async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.json({ success: true, user: req.user });
      }
      res.json({ success: true, user: user.toSafeJSON() });
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = createAuthRoutes;
