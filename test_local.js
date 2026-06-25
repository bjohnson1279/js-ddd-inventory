const { prisma } = require('./src/infrastructure/database/prisma');
async function main() {
  const cnt = await prisma.outboxEventModel.count();
  console.log("Connected to local DB, count:", cnt);
}
main().catch(console.error);
