/**
 * @interface AuthProvider
 * Pluggable Authentication Interface for TripZo Live.
 * 
 * Host applications (such as TripZo attendance) can implement this interface
 * to reuse their existing session/token validation mechanisms without altering
 * any code inside the tracking module.
 */
class AuthProvider {
  /**
   * Authenticates an incoming HTTP request.
   * Must return a standardized UserContext object if valid, or throw an error.
   *
   * @param {import('express').Request} req
   * @returns {Promise<{
   *   id: string,
   *   role: 'student' | 'driver' | 'admin',
   *   externalId?: string,
   *   assignedBusId?: string,
   *   homeStopId?: string,
   *   name?: string,
   *   email?: string
   * }>}
   */
  async authenticate(req) {
    throw new Error('AuthProvider.authenticate(req) must be implemented by subclass');
  }

  /**
   * Authenticates an incoming Socket.IO handshake.
   *
   * @param {import('socket.io').Socket} socket
   * @returns {Promise<{
   *   id: string,
   *   role: 'student' | 'driver' | 'admin',
   *   externalId?: string,
   *   assignedBusId?: string,
   *   name?: string
   * }>}
   */
  async authenticateSocket(socket) {
    throw new Error('AuthProvider.authenticateSocket(socket) must be implemented by subclass');
  }
}

module.exports = AuthProvider;
