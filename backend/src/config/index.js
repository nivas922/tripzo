require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'tripzo_default_secret_key_change_in_prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  mongoUri: process.env.MONGO_URI || '',
  osrmBaseUrl: process.env.OSRM_BASE_URL || 'https://router.project-osrm.org',
  etaCacheTtlSeconds: parseInt(process.env.ETA_CACHE_TTL_SECONDS || '30', 10),
  maxTripDurationHours: parseFloat(process.env.MAX_TRIP_DURATION_HOURS || '3'),
  locationPingTtlDays: parseInt(process.env.LOCATION_PING_TTL_DAYS || '7', 10),
};
