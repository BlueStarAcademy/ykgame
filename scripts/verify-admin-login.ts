import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { getDatabaseUrl } from "../src/lib/db-url";

const ADMIN_LOGIN_ID = "ykgameadmin";
const ADMIN_PASSWORD = "123456";

async function main() {
  const connectionString = getDatabaseUrl({ required: true });
  const pool = new pg.Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const user = await prisma.user.findUnique({ where: { loginId: ADMIN_LOGIN_ID } });
    if (!user) {
      throw new Error(`admin user "${ADMIN_LOGIN_ID}" not found after seed`);
    }
    if (!user.isActive) {
      throw new Error(`admin user "${ADMIN_LOGIN_ID}" is inactive`);
    }

    const valid = await bcrypt.compare(ADMIN_PASSWORD, user.passwordHash);
    if (!valid) {
      throw new Error(`admin password mismatch for "${ADMIN_LOGIN_ID}"`);
    }

    const host = new URL(connectionString).hostname;
    console.log(`Verified admin login: ${ADMIN_LOGIN_ID} (db host: ${host})`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Admin login verification failed:", error);
  process.exit(1);
});
