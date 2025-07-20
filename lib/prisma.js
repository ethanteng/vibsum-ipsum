import { PrismaClient } from '@prisma/client'

const globalForPrisma = global

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Configure for serverless environment
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Handle serverless environment connection issues
if (process.env.NODE_ENV === 'production') {
  // Force disconnect on serverless function completion
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })
} 