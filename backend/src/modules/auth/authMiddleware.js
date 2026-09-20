const JwtAuthProvider = require('./JwtAuthProvider');

const defaultAuthProvider = new JwtAuthProvider();

function createAuthMiddleware(authProvider = defaultAuthProvider) {
  return {
    requireAuth: async (req, res, next) => {
      try {
        const user = await authProvider.authenticate(req);
        req.user = user;
        next();
      } catch (err) {
        return res.status(err.statusCode || 401).json({
          success: false,
          message: err.message || 'Unauthorized',
        });
      }
    },

    requireRoles: (...allowedRoles) => {
      return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
          return res.status(403).json({
            success: false,
            message: `Forbidden: Access requires one of roles [${allowedRoles.join(', ')}]`,
          });
        }
        next();
      };
    },

    getAuthProvider: () => authProvider,
  };
}

module.exports = createAuthMiddleware;
