import "server-only";
import mongoose, { type ClientSession } from "mongoose";
import { getEnv } from "@/lib/env";

/**
 * Reusable MongoDB Atlas connection.
 *
 * In serverless environments (Vercel) each lambda instance keeps one pooled
 * connection on `globalThis`, so hot invocations reuse it instead of reconnecting.
 */

type Cache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  transactionsSupported: boolean | null;
};

const globalForMongoose = globalThis as unknown as { __mongoose?: Cache };
const cache: Cache = globalForMongoose.__mongoose ?? { conn: null, promise: null, transactionsSupported: null };
globalForMongoose.__mongoose = cache;

// NoSQL-injection defence: every request payload is parsed by a strict Zod schema
// that coerces values to primitives before they reach a query, so user input can
// never inject `$` operators. strictQuery drops unknown paths from filters.
mongoose.set("strictQuery", true);

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn && mongoose.connection.readyState === 1) return cache.conn;
  if (!cache.promise) {
    const env = getEnv();
    cache.promise = mongoose
      .connect(env.MONGODB_URI, {
        dbName: env.MONGODB_DB_NAME,
        // Dashboard pages run ~10 queries in parallel. Keeping warm connections and
        // allowing more simultaneous connects avoids queueing behind TLS handshakes.
        maxPoolSize: 15,
        minPoolSize: 6,
        maxConnecting: 6,
        maxIdleTimeMS: 5 * 60 * 1000,
        serverSelectionTimeoutMS: 10_000,
        socketTimeoutMS: 45_000,
        bufferCommands: false,
        // Indexes are created by `npm run db:indexes`; building them on every cold start slows requests.
        autoIndex: false,
      })
      .catch((err) => {
        cache.promise = null;
        throw err;
      });
  }
  cache.conn = await cache.promise;
  return cache.conn;
}

function isTransactionUnsupported(err: unknown): boolean {
  const e = err as { code?: number; codeName?: string; message?: string };
  return (
    e?.code === 20 ||
    e?.codeName === "IllegalOperation" ||
    /Transaction numbers are only allowed|replica set|does not support transactions/i.test(e?.message ?? "")
  );
}

/**
 * Runs `fn` inside a MongoDB transaction when supported (Atlas clusters are replica
 * sets, so this is the normal path). When transactions are disabled or unsupported,
 * `fn` is called with `null` and must apply its own compensation logic.
 */
export async function withTransaction<T>(fn: (session: ClientSession | null) => Promise<T>): Promise<T> {
  await connectDB();
  const mode = getEnv().MONGODB_TRANSACTIONS;
  if (mode === "off" || cache.transactionsSupported === false) return fn(null);

  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    cache.transactionsSupported = true;
    return result as T;
  } catch (err) {
    if (mode === "auto" && cache.transactionsSupported !== true && isTransactionUnsupported(err)) {
      cache.transactionsSupported = false;
      console.warn("[mongodb] Transactions unsupported by this deployment; falling back to compensation logic.");
      return fn(null);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

export async function disconnectDB() {
  await mongoose.disconnect();
  cache.conn = null;
  cache.promise = null;
}
