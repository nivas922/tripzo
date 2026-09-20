const mongoose = require('mongoose');
const dns = require('dns');
const config = require('./index');

// Force reliable public DNS servers (Google + Cloudflare) for MongoDB SRV lookups on cloud hosts
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  // Ignore in environments where setting DNS servers is restricted
}

let mongod = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  let uri = (config.mongoUri || '').trim().replace(/^["']|["']$/g, '');

  try {
    const atIndex = uri.lastIndexOf('@');
    if (atIndex !== -1) {
      const hostPart = uri.substring(atIndex + 1).split('/')[0].split('?')[0];
      console.log(`[Database] Connecting to cluster host: "${hostPart}"`);
    }
  } catch (e) {}

  if (uri.includes('<') || uri.includes('>')) {
    console.error('[Database] WARNING: Your MONGO_URI contains "<" or ">" brackets! Please replace <password> with your actual password without the brackets.');
  }

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
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`[Database] Connected to MongoDB successfully at: ${uri.replace(/\/\/.*@/, '//***:***@')}`);
    return mongoose.connection;
  } catch (err) {
    console.error(`[Database] Error connecting to MongoDB:`, err.message);
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
