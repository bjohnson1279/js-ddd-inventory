const { prisma } = require('./src/infrastructure/database/prisma');
async function main() {
  try {
    const cnt = await prisma.outboxEventModel.count();
    console.log("Connected to local DB, count:", cnt);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(console.error);
