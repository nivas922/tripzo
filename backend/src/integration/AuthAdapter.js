/**
 * @interface AuthAdapter
 * Abstraction layer for authentication.
 * 
 * Allows this tracking system to run autonomously with local JWTs,
 * or be plugged into TripZo's attendance app to validate existing student/driver sessions.
 */
class AuthAdapter {
  /**
   * Validates a request and extracts identity context.
   * @param {import('express').Request} req
   * @returns {Promise<{ id: string, role: 'STUDENT' | 'DRIVER' | 'ADMIN', email: string, name: string }>}
   */
  async authenticateRequest(req) {
    throw new Error('AuthAdapter.authenticateRequest must be implemented');
  }

  /**
   * Issues token/session for a user in standalone mode.
   * @param {Object} user
   * @returns {string}
   */
  generateToken(user) {
    throw new Error('AuthAdapter.generateToken must be implemented');
  }
}

module.exports = AuthAdapter;
