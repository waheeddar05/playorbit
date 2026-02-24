import { Prisma, PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const IST_TIMEZONE = 'Asia/Kolkata';
const POSTGRES_TZ_OPTION = '-c TimeZone=Asia/Kolkata';

function withPostgresTimezone(url?: string): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    const currentOptions = parsed.searchParams.get('options');

    if (!currentOptions) {
      parsed.searchParams.append('options', POSTGRES_TZ_OPTION);
    } else if (!/timezone\s*=/i.test(currentOptions)) {
      parsed.searchParams.set('options', `${currentOptions} ${POSTGRES_TZ_OPTION}`);
    }

    return parsed.toString();
  } catch {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}options=${encodeURIComponent(POSTGRES_TZ_OPTION)}`;
  }
}

// Ensure server process time is IST.
process.env.TZ = IST_TIMEZONE;

const prismaDatasourceUrl = withPostgresTimezone(
  process.env.PRISMA_DATABASE_URL ?? process.env.DATABASE_URL,
);

if (prismaDatasourceUrl && !process.env.PRISMA_DATABASE_URL) {
  process.env.PRISMA_DATABASE_URL = prismaDatasourceUrl;
}

const isDev = process.env.NODE_ENV !== 'production';

const prismaClientOptions: Prisma.PrismaClientOptions = {
  datasources: prismaDatasourceUrl ? { db: { url: prismaDatasourceUrl } } : undefined,
  log: isDev
    ? [
        { level: 'query', emit: 'event' },
        { level: 'info', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
        { level: 'error', emit: 'stdout' },
      ]
    : [
        { level: 'warn', emit: 'stdout' },
        { level: 'error', emit: 'stdout' },
      ],
};

export const prisma =
  globalForPrisma.prisma || new PrismaClient(prismaClientOptions);

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;


// Explicit connection and table check
async function checkDatabaseConnection() {
  try {
    await prisma.$connect();

    const tables = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'
    `;

    const existingTables = tables.map(t => t.tablename.toLowerCase());
    const requiredTables = ['user', 'policy', 'otp', 'booking'];
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));

    if (missingTables.length > 0) {
      console.error(`Missing tables: ${missingTables.join(', ')}. Run "npx prisma migrate deploy".`);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Database startup check failed:', error);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

// Execute check but don't block main thread in dev (Next.js hot reloading might trigger this often)
const IS_VERCEL_BUILD = process.env.VERCEL === '1' && process.env.NEXT_PHASE === 'phase-production-build';
if ((process.env.NODE_ENV === 'production' || (typeof window === 'undefined' && !globalForPrisma.prisma)) && !IS_VERCEL_BUILD) {
  checkDatabaseConnection();
}
