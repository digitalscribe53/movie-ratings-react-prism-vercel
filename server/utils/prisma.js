const { PrismaClient } = require('@prisma/client');

// Add prisma to the NodeJS global type
const globalForPrisma = global;

// Prevent multiple instances of Prisma Client in development
const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV === 'development') {
  globalForPrisma.prisma = prisma;
}

module.exports = prisma;