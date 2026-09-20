const jwt = require('jsonwebtoken');
const AuthProvider = require('./AuthProvider');
const config = require('../../config');

class JwtAuthProvider extends AuthProvider {
  constructor(options = {}) {
    super();
    this.secret = options.secret || config.jwtSecret;
    this.expiresIn = options.expiresIn || config.jwtExpiresIn;
  }

  /**
   * Generates a signed JWT token for standalone mode
   */
  generateToken(payload) {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
  }

  /**
   * Authenticates an Express HTTP request via Authorization: Bearer <token>
   */
  async authenticate(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const err = new Error('Authentication required: Missing Bearer token');
      err.statusCode = 401;
      throw err;
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, this.secret);
      return {
        id: decoded.id,
        role: decoded.role,
        externalId: decoded.externalId || decoded.id,
        assignedBusId: decoded.assignedBusId || null,
        homeStopId: decoded.homeStopId || null,
        name: decoded.name,
        email: decoded.email,
      };
    } catch (err) {
      const authErr = new Error('Invalid or expired authentication token');
      authErr.statusCode = 401;
      throw authErr;
    }
  }

  /**
   * Authenticates a Socket.IO connection during handshake
   */
  async authenticateSocket(socket) {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization &&
        socket.handshake.headers.authorization.split(' ')[1]);

    if (!token) {
      throw new Error('Socket authentication error: missing token');
    }

    try {
      const decoded = jwt.verify(token, this.secret);
      return {
        id: decoded.id,
        role: decoded.role,
        externalId: decoded.externalId || decoded.id,
        assignedBusId: decoded.assignedBusId || null,
        homeStopId: decoded.homeStopId || null,
        name: decoded.name,
      };
    } catch (err) {
      throw new Error('Socket authentication error: invalid or expired token');
    }
  }
}

module.exports = JwtAuthProvider;
