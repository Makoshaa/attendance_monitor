const { PrismaClient } = require('@prisma/client');

// Создаем глобальный экземпляр Prisma клиента для переиспользования
const globalForPrisma = globalThis;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: ['query'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;
