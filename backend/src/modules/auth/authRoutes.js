const express = require('express');
const authController = require('../../controllers/authController');
const { validateRegistration, validateLogin } = require('../../middleware/validate');
const JwtAuthProvider = require('./JwtAuthProvider');
const createAuthMiddleware = require('./authMiddleware');

function createAuthRoutes(jwtProvider = new JwtAuthProvider()) {
  const router = express.Router();
  const { requireAuth } = createAuthMiddleware(jwtProvider);

  // POST /api/auth/register
  router.post('/register', validateRegistration, authController.register);

  // POST /api/auth/login
  router.post('/login', validateLogin, authController.login);

  // GET /api/auth/me
  router.get('/me', requireAuth, authController.getMe);

  return router;
}

module.exports = createAuthRoutes;
