import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Reuse PrismaClient across HMR cycles to prevent "database is locked" errors
// In dev mode, HMR recreates modules — without the global cache, each reload
// would spawn a new PrismaClient, exhausting SQLite's single-writer model.
export const db = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
