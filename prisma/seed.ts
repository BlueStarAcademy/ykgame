import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getDatabaseUrl } from "../src/lib/db-url";
import bcrypt from "bcryptjs";

const pool = new pg.Pool({ connectionString: getDatabaseUrl({ required: true }) });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);

  await prisma.user.upsert({
    where: { loginId: "ykgameadmin" },
    update: {
      passwordHash,
      isActive: true,
      role: "ADMIN",
    },
    create: {
      loginId: "ykgameadmin",
      email: "admin@ykgame.local",
      passwordHash,
      nickname: "관리자",
      role: "ADMIN",
      currency: 0,
    },
  });

  console.log("Seeded admin user: ykgameadmin / 123456 [deploy-rev: 4d3012c-railway-git-debug]");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
