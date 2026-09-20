const mongoose = require('mongoose');
const config = require('./index');

let mongod = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  let uri = config.mongoUri;

  if (!uri) {
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
      console.log(`[Database] No MONGO_URI provided. Started embedded MongoMemoryServer at: ${uri}`);
    } catch (err) {
      console.error('[Database] Failed to start MongoMemoryServer:', err.message);
      throw err;
    }
  }

  try {
    await mongoose.connect(uri);
    console.log(`[Database] Connected to MongoDB at: ${uri.replace(/\/\/.*@/, '//***:***@')}`);
    return mongoose.connection;
  } catch (err) {
    console.error(`[Database] Error connecting to MongoDB at ${uri}:`, err.message);
    throw err;
  }
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

module.exports = {
  connectDB,
  disconnectDB,
};
