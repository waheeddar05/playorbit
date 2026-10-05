import { Prisma, PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const IST_TIMEZONE = 'Asia/Kolkata';

/** Connections each function instance may hold. Prisma's default is
 *  2×CPU+1; an explicit cap keeps the instance count × pool comfortably
 *  inside the plan's pooled-connection limit (50 on the lowest tier). */
const POOL_CONNECTION_LIMIT = '5';

/**
 * Runtime connection, in order of preference:
 *
 * 1. `POOLED_DATABASE_URL` — Prisma Postgres's PgBouncer pooler
 *    (`pooled.db.prisma.io`). Accelerate failed the first query after
 *    idle with "This request must be retried", adding ~3s to app open,
 *    and the hosted Accelerate URL is retired on 1 Dec 2026.
 * 2. `PRISMA_DATABASE_URL` — the Accelerate URL, kept as the fallback so
 *    removing the env var above is a complete rollback.
 * 3. `DATABASE_URL` — direct, for local scripts and dev.
 *
 * Do not add `pgbouncer=true`: Prisma Postgres's pooler handles prepared
 * statements in transaction mode, and the flag makes Prisma re-prepare
 * every statement — ~300ms per query instead of ~70ms.
 *
 * The session TimeZone is left at the server default (UTC). Accelerate
 * always ignored the old `-c TimeZone=Asia/Kolkata` startup option, so
 * production has only ever run UTC sessions; the pooler would honour it
 * and silently change behaviour. Nothing reads the session TimeZone — all
 * columns are `timestamp without time zone` holding UTC.
 */
function resolveDatasourceUrl(): string | undefined {
  const pooled = process.env.POOLED_DATABASE_URL;
  if (pooled) {
    try {
      const url = new URL(pooled);
      if (!url.searchParams.has('connection_limit')) {
        url.searchParams.set('connection_limit', POOL_CONNECTION_LIMIT);
      }
      return url.toString();
    } catch {
      return pooled;
    }
  }
  return process.env.PRISMA_DATABASE_URL ?? process.env.DATABASE_URL;
}

// Ensure server process time is IST.
process.env.TZ = IST_TIMEZONE;

const prismaDatasourceUrl = resolveDatasourceUrl();

const prismaClientOptions: Prisma.PrismaClientOptions = {
  datasources: prismaDatasourceUrl ? { db: { url: prismaDatasourceUrl } } : undefined,
  log: [
    { level: 'warn', emit: 'stdout' },
    { level: 'error', emit: 'stdout' },
  ],
};

export const prisma =
  globalForPrisma.prisma || new PrismaClient(prismaClientOptions);

// Cache on globalThis in ALL environments to avoid creating new connections on every
// Vercel serverless cold start. This is the #1 cause of slow API responses.
if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;
