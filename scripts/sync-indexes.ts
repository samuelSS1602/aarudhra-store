/**
 * Creates/updates all MongoDB indexes (including TTL indexes for sessions, OTPs and
 * rate limits). Production disables autoIndex, so run this after each deploy that
 * changes a schema:   npm run db:indexes
 */
import "./_env";
import { connectDB, disconnectDB } from "../src/lib/mongodb";
import * as models from "../src/models";
import type { Model } from "mongoose";

async function main() {
  await connectDB();
  for (const [name, value] of Object.entries(models)) {
    const m = value as unknown as Model<unknown>;
    if (typeof m?.syncIndexes !== "function" || typeof m?.modelName !== "string") continue;
    await m.syncIndexes();
    console.log(`✔ ${name} indexes synced`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
