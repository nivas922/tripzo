const http = require('http');
const app = require('./app');
const config = require('./config');
const { connectDB, disconnectDB } = require('./config/db');
const socketManager = require('./sockets/socketManager');

const server = http.createServer(app);

// Attach Socket.IO
socketManager.init(server);

async function start() {
  try {
    await connectDB();

    server.listen(config.port, () => {
      console.log(`=============================================`);
      console.log(` Tripzo Live Bus Tracking Backend Active`);
      console.log(` Port: ${config.port} | Mode: ${config.nodeEnv}`);
      console.log(` HTTP API: http://localhost:${config.port}/api`);
      console.log(` WebSocket: ws://localhost:${config.port}`);
      console.log(`=============================================`);
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

module.exports = { server, app, start };
