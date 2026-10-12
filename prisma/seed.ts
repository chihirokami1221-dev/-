import { PrismaClient } from "@prisma/client";
import { CATEGORY_SEED } from "../src/lib/categories";

const prisma = new PrismaClient();

async function main() {
  for (const category of CATEGORY_SEED) {
    await prisma.category.upsert({
      where: { key: category.key },
      update: {},
      create: category,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
