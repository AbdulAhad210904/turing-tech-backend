// utils/mongoose.js
import mongoose from 'mongoose';
import fs from 'node:fs';
import dns from 'node:dns';
import { logger } from '../config/winstonLogger.js';

// helps on some macOS/ISP setups with SRV:
dns.setDefaultResultOrder('ipv4first');

const bool = (v, d=false) => (v === undefined || v === '' ? d : String(v).toLowerCase() === 'true');
const num  = (v, d) => (v === undefined || v === '' ? d : Number(v));

export async function connectMongo() {
  const {
    MONGO_URI, MONGO_DB, MONGO_USER, MONGO_PASS, MONGO_REPLICA_SET,
    MONGO_MAX_POOL_SIZE, MONGO_MIN_POOL_SIZE, MONGO_MAX_IDLE_TIME_MS,
    MONGO_SERVER_SELECTION_TIMEOUT_MS, MONGO_SOCKET_TIMEOUT_MS, MONGO_WAIT_QUEUE_TIMEOUT_MS,
    MONGO_TLS, MONGO_CA_FILE, MONGO_RETRY_WRITES, MONGO_W, MONGO_W_TIMEOUT_MS,
    MONGO_READ_CONCERN, MONGO_COMPRESSOR, MONGO_APP_NAME, MONGO_AUTO_INDEX, MONGO_DEBUG, NODE_ENV,
  } = process.env;

  // Mongoose safety/perf
  mongoose.set('strictQuery', true);
  mongoose.set('autoIndex', bool(MONGO_AUTO_INDEX, NODE_ENV !== 'production'));
  mongoose.set('bufferCommands', false);
  if (bool(MONGO_DEBUG)) {
    mongoose.set('debug', (coll, method, query, doc, opts) => {
      console.log(`[mongo] ${coll}.${method}`, { query, doc, opts });
    });
  }

  /** @type {import('mongoose').ConnectOptions} */
  const opts = {
    dbName: MONGO_DB || 'turingtest',
    user: MONGO_USER || undefined,
    pass: MONGO_PASS || undefined,
    replicaSet: MONGO_REPLICA_SET || undefined,
    maxPoolSize: num(MONGO_MAX_POOL_SIZE, 20),
    minPoolSize: num(MONGO_MIN_POOL_SIZE, 2),
    maxIdleTimeMS: num(MONGO_MAX_IDLE_TIME_MS, 60_000),
    serverSelectionTimeoutMS: num(MONGO_SERVER_SELECTION_TIMEOUT_MS, 15_000),
    socketTimeoutMS: num(MONGO_SOCKET_TIMEOUT_MS, 20_000),
    waitQueueTimeoutMS: num(MONGO_WAIT_QUEUE_TIMEOUT_MS, 5_000),
    retryWrites: bool(MONGO_RETRY_WRITES, true),
    writeConcern: { w: MONGO_W || 'majority', wtimeoutMS: num(MONGO_W_TIMEOUT_MS, 10_000) },
    readConcern: { level: MONGO_READ_CONCERN || 'majority' },
    compressors: [MONGO_COMPRESSOR].filter(Boolean),
    appName: MONGO_APP_NAME || 'turingtest-api',
  };

  // Only set TLS if explicitly provided (Atlas SRV already uses TLS by default)
  if (MONGO_TLS !== undefined) opts.tls = bool(MONGO_TLS);
  if (opts.tls && MONGO_CA_FILE && fs.existsSync(MONGO_CA_FILE)) {
    opts.tlsCAFile = MONGO_CA_FILE;
  }

  // ---- Attach listeners BEFORE connect ----
  const conn = mongoose.connection;
  conn.on('connecting',   () => console.log('[Mongo] connecting...'));
  conn.on('connected',    () => console.log(`[Mongo] connected (event) pool=${opts.minPoolSize}-${opts.maxPoolSize}`));
  conn.once('open',       () => console.log('[Mongo] open (ready)'));
  conn.on('disconnected', () => console.warn('[Mongo] disconnected'));
  conn.on('error',        (e) => console.error('[Mongo] error:', e?.message || e));

  console.log('[Mongo] calling mongoose.connect()...');
  try {
    await mongoose.connect(MONGO_URI, opts);
    // This ALWAYS prints on success, even if events fired earlier.
    console.log('✅ Mongo connected (await returned). readyState =', conn.readyState);
  } catch (err) {
    console.error('❌ Mongo connect failed:', err?.message || err);
    logger?.error?.(err); 
    
    throw err;
  }

  // Graceful shutdown
  const close = async (signal) => {
    try {
      await mongoose.connection.close(true);
      console.log(`🔌 Mongo connection closed on ${signal}`);
      process.exit(0);
    } catch (e) {
      console.error('Error during Mongo close:', e);
      logger?.error?.(e); 
      process.exit(1);
    }
  };
  process.once('SIGINT', () => close('SIGINT'));
  process.once('SIGTERM', () => close('SIGTERM'));
}
