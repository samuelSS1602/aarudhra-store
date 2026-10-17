/** Loads .env.local / .env for CLI scripts (Next.js does this automatically for the app). */
import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) {
    try {
      process.loadEnvFile(file);
    } catch {
      /* ignore malformed file; env validation will report missing values */
    }
  }
}
