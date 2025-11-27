'use server';

import mongoose, { type ConnectOptions } from 'mongoose';

/**
 * Cache shape stored on the Node.js global object.
 * This allows us to reuse the same connection across
 * hot reloads during development instead of opening
 * a new socket on every change.
 */
type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

/**
 * Initialize the cache once per process.
 * In serverless / edge environments this may be recreated,
 * but in dev / long-lived processes it persists across reloads.
 */
const cached: MongooseCache = globalThis.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!globalThis.mongooseCache) {
  globalThis.mongooseCache = cached;
}

/**
 * Establish (or reuse) a single Mongoose connection.
 * Ensures:
 * - A single connection per process in development.
 * - Type-safe usage of Mongoose in TypeScript.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set.');
  }

  // Reuse existing connection if available.
  if (cached.conn) {
    return cached.conn;
  }

  // If a connection is already being established, await that.
  if (!cached.promise) {
    const options: ConnectOptions = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 15_000,
    };

    cached.promise = mongoose
      .connect(uri, options)
      .then((mongooseInstance) => {
        // Enforce predictable query behavior across the codebase.
        mongooseInstance.set('strictQuery', true);
        return mongooseInstance;
      })
      .catch((error) => {
        // Allow retries on subsequent calls after a failed attempt.
        cached.promise = null;
        throw error;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
