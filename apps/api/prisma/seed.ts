import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { githubId: 1 },
    create: {
      githubId: 1,
      githubLogin: "dev",
      githubTokenEnc: "placeholder",
      githubTokenIv: "placeholder",
      githubTokenTag: "placeholder",
      plan: "PRO",
    },
    update: {},
  });
  console.log("Seeded dev user:", user.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
