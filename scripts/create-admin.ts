/**
 * Secure first-admin provisioning.
 *
 *   npm run admin:create -- --email owner@example.com --name "Store Owner"
 *   npm run admin:create -- --email staff@example.com --name "Staff" --role staff --allow-additional
 *   npm run admin:create -- --email owner@example.com --reset-password
 *
 * The password is typed at a hidden prompt (never a CLI argument, so it doesn't land in
 * shell history). For non-interactive environments set ADMIN_PASSWORD for one run only.
 * No default credentials exist anywhere in the codebase.
 */
import "./_env";
import readline from "node:readline";
import { Writable } from "node:stream";
import { parseArgs } from "node:util";
import { connectDB, disconnectDB } from "../src/lib/mongodb";
import { hashPassword } from "../src/lib/security/crypto";
import { passwordSchema } from "../src/lib/validation/schemas";
import { AdminUser, ADMIN_ROLES, type AdminRole } from "../src/models/AdminUser";
import { AdminSession } from "../src/models/AdminSession";
import { AuditLog } from "../src/models/misc";

// PowerShell's npm shim strips "--flag" names, leaving bare values, so plain
// positionals are also accepted:  npm run admin:create you@example.com "Your Name"
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "owner" },
    "allow-additional": { type: "boolean", default: false },
    "reset-password": { type: "boolean", default: false },
  },
});
values.email ??= positionals.find((p) => p.includes("@"));
values.name ??= positionals.filter((p) => !p.includes("@")).join(" ") || undefined;
if (positionals.includes("reset-password")) values["reset-password"] = true;

function hiddenPrompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    let muted = false;
    const out = new Writable({
      write(chunk, _enc, cb) {
        if (!muted) process.stdout.write(chunk);
        cb();
      },
    });
    const rl = readline.createInterface({ input: process.stdin, output: out, terminal: true });
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muted = true;
  });
}

async function getPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!process.stdin.isTTY) throw new Error("No TTY available. Set ADMIN_PASSWORD for this one command.");
  const p1 = await hiddenPrompt("Password: ");
  const p2 = await hiddenPrompt("Confirm password: ");
  if (p1 !== p2) throw new Error("Passwords do not match.");
  return p1;
}

async function main() {
  const email = values.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Provide a valid --email.");
  const role = values.role as AdminRole;
  if (!ADMIN_ROLES.includes(role)) throw new Error(`--role must be one of: ${ADMIN_ROLES.join(", ")}`);

  await connectDB();

  if (values["reset-password"]) {
    const admin = await AdminUser.findOne({ email });
    if (!admin) throw new Error("No staff account with that email.");
    const pw = passwordSchema.safeParse(await getPassword());
    if (!pw.success) throw new Error(pw.error.issues[0]!.message);
    admin.passwordHash = await hashPassword(pw.data);
    admin.passwordChangedAt = new Date();
    admin.failedLoginCount = 0;
    admin.lockedUntil = undefined;
    await admin.save();
    await AdminSession.deleteMany({ adminId: admin._id });
    await AuditLog.create({ action: "admin.password_reset_cli", resourceType: "admin", resourceId: String(admin._id), adminName: "CLI" });
    console.log(`✔ Password reset for ${email}. All sessions were signed out.`);
    return;
  }

  const name = values.name?.trim();
  if (!name) throw new Error("Provide --name.");
  const existingCount = await AdminUser.countDocuments();
  if (existingCount > 0 && !values["allow-additional"]) {
    throw new Error("Staff accounts already exist. Add staff from /admin/admins, or pass --allow-additional.");
  }
  if (await AdminUser.exists({ email })) throw new Error("A staff account with this email already exists.");

  const pw = passwordSchema.safeParse(await getPassword());
  if (!pw.success) throw new Error(pw.error.issues[0]!.message);

  const admin = await AdminUser.create({ name, email, role, passwordHash: await hashPassword(pw.data), passwordChangedAt: new Date() });
  await AuditLog.create({ action: "admin.create_cli", resourceType: "admin", resourceId: String(admin._id), adminName: "CLI", sanitizedMetadata: { email, role } });
  console.log(`✔ Created ${role} account for ${email}. Sign in at /admin/login.`);
}

main()
  .catch((err) => {
    console.error(`✖ ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
