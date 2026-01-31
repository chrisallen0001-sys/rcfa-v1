import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

async function main() {
  if (!ADMIN_EMAIL) {
    console.log("ADMIN_EMAIL not set — skipping admin bootstrap.");
    return;
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const email = ADMIN_EMAIL.trim().toLowerCase();

  const user = await prisma.appUser.findUnique({ where: { email } });

  if (!user) {
    console.log(`User ${email} not found — register first, then re-run seed.`);
    return;
  }

  if (user.role === "admin") {
    console.log(`User ${email} is already an admin.`);
    return;
  }

  await prisma.appUser.update({
    where: { email },
    data: { role: "admin" },
  });

  console.log(`Promoted ${email} to admin.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
