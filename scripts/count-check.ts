import { prisma } from "../src/lib/prisma";
async function main() {
  console.log("achievements:", await prisma.achievement.count());
  console.log("axisLinks:", await prisma.achievementAxisLink.count());
  console.log("snapshots:", await prisma.marketValueScoreSnapshot.count());
  console.log("roadmapItems:", await prisma.roadmapItem.count());
  console.log("individualGoals:", await prisma.individualGoal.count());
}
main().finally(() => prisma.$disconnect());
