import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
  });
  const entries = await prisma.diaryEntry.findMany({
    orderBy: { date: "asc" },
    select: { id: true, date: true, categoryId: true },
  });

  console.log(
    JSON.stringify(
      {
        categories: categories.map((c) => ({
          id: c.id,
          key: c.key,
          label: c.label,
          color: c.color,
        })),
        entries: entries.map((e) => ({
          date: e.date.toISOString().slice(0, 10),
          categoryId: e.categoryId,
        })),
      },
      null,
      2
    )
  );
}

main().finally(() => prisma.$disconnect());
