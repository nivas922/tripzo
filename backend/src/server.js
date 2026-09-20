const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore
}

const http = require('http');
const config = require('./config');
const { connectDB, disconnectDB } = require('./config/db');
const JwtAuthProvider = require('./modules/auth/JwtAuthProvider');
const TrackingSocketManager = require('./modules/tracking/sockets/trackingSocket');
const { createApp } = require('./app');

const authProvider = new JwtAuthProvider();
const trackingSocketManager = new TrackingSocketManager();

// Create Express app with injected dependencies
const app = createApp({
  authProvider,
  socketManager: trackingSocketManager,
});

const server = http.createServer(app);

// Attach Socket.IO to server with pluggable auth
trackingSocketManager.init(server, authProvider);

async function start() {
  try {
    await connectDB();

    // Auto-seed initial demo accounts and route fleet if database is freshly created
    try {
      const User = require('./models/User');
      const userCount = await User.countDocuments();
      if (userCount === 0) {
        console.log('[Server] Database is empty. Auto-seeding initial fleet and demo accounts...');
        const seed = require('../scripts/seed');
        await seed();
        console.log('[Server] Auto-seed completed successfully!');
      }
    } catch (seedErr) {
      console.warn('[Server] Auto-seed check warning (non-fatal):', seedErr.message);
    }

    server.listen(config.port, () => {
      console.log(`====================================================`);
      console.log(` TripZo Live - Modular Bus Tracking Service Active`);
      console.log(` Port: ${config.port} | Mode: ${config.nodeEnv}`);
      console.log(` HTTP API: http://localhost:${config.port}/api/v1`);
      console.log(` OpenAPI / Swagger UI: http://localhost:${config.port}/api-docs`);
      console.log(` WebSocket: ws://localhost:${config.port}`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Closing server gracefully...`);
  server.close(async () => {
    console.log('HTTP server closed.');
    await disconnectDB();
    console.log('Database disconnected.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  start();
}

module.exports = { server, app, start, trackingSocketManager, authProvider };
