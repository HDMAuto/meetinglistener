// Promote a user to admin (and reactivate them): npm run make-admin -- <email>
import { prisma } from "../src/db/client.js";

export async function makeAdmin(email: string): Promise<"OK" | "NOT_FOUND"> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return "NOT_FOUND";
  await prisma.user.update({
    where: { id: user.id },
    data: { role: "admin", isActive: true },
  });
  return "OK";
}

// Only run as a CLI when executed directly, not when imported by tests.
const invokedDirectly = process.argv[1]?.includes("make-admin");
if (invokedDirectly && !process.env.VITEST) {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run make-admin -- <email>");
    process.exit(1);
  }
  makeAdmin(email)
    .then((result) => {
      if (result === "NOT_FOUND") {
        console.error(`No user found with email ${email}`);
        process.exit(1);
      }
      console.log(`${email} is now an active admin.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
