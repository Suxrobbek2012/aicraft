import dotenv from 'dotenv'
import { PrismaClient } from './index'

// Ensure DATABASE_URL exists for Prisma Client at runtime.
// Prisma schema uses env("DATABASE_URL"), so we must set it before creating PrismaClient.
const fallback = 'postgresql://goai:goai_password@localhost:5432/goai_db'

dotenv.config()
process.env.DATABASE_URL = process.env.DATABASE_URL ?? fallback

async function main() {
  const prisma = new PrismaClient()
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const seed = require('./seed')
    if (typeof seed?.main === 'function') {
      await seed.main(prisma)
    } else {
      // If seed.ts is not structured as module, just require it and let it execute.
      require('./seed')
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('Seed runner failed:', e)
  process.exit(1)
})

