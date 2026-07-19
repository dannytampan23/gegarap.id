import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function databasePoolSize(): number {
  const configured = Number.parseInt(process.env.DATABASE_POOL_MAX ?? '', 10);
  if (!Number.isSafeInteger(configured) || configured < 1) return 3;
  return Math.min(configured, 10);
}

const prismaClientSingleton = () => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // Vercel can create many isolated function instances. Keep each local pool
    // deliberately small and let Supabase's transaction pooler multiplex them.
    max: databasePoolSize(),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
  return new PrismaClient({ adapter });
};

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma;
