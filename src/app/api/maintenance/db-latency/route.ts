import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthenticatedUser } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import { lookup } from 'node:dns/promises';
import net from 'node:net';

// Temporary latency probe. In production it answers super admins only. Reports
// hosts, parameter names and timings only — never URLs, values or credentials.
export const dynamic = 'force-dynamic';

const CANDIDATES = ['POOLED_DATABASE_URL', 'PRISMA_DATABASE_URL', 'DATABASE_URL', 'POSTGRES_URL'] as const;

function tcpConnect(host: string, port: number): Promise<number> {
  return new Promise((resolve) => {
    const start = performance.now();
    const sock = net.connect({ host, port });
    const done = (ms: number) => { sock.destroy(); resolve(ms); };
    sock.setTimeout(5000, () => done(-1));
    sock.once('connect', () => done(Math.round(performance.now() - start)));
    sock.once('error', () => done(-1));
  });
}

async function probe(name: string, raw: string) {
  const u = new URL(raw);
  const isAccelerate = u.protocol.startsWith('prisma');
  const host = u.hostname;
  const port = isAccelerate ? 443 : Number(u.port || 5432);
  const t0 = performance.now();
  const addrs = await lookup(host, { all: true }).catch(() => []);
  const dnsMs = Math.round(performance.now() - t0);
  const tcp = [] as number[];
  for (let i = 0; i < 3; i++) tcp.push(await tcpConnect(host, port));

  const variants: Record<string, string> = { asIs: raw };
  if (!isAccelerate) {
    const v = new URL(raw);
    v.searchParams.set('connection_limit', '1');
    variants.limit1 = v.toString();
    const b = new URL(raw);
    b.searchParams.set('pgbouncer', 'true');
    variants.pgbouncerTrue = b.toString();
  }
  const queries: Record<string, unknown> = {};
  for (const [label, url] of Object.entries(variants)) {
    const client = new PrismaClient({ datasources: { db: { url } } });
    try {
      const c0 = performance.now();
      await client.$queryRawUnsafe('SELECT 1');
      const first = Math.round(performance.now() - c0);
      const warm: number[] = [];
      for (let i = 0; i < 5; i++) {
        const s = performance.now();
        await client.$queryRawUnsafe('SELECT 1');
        warm.push(Math.round(performance.now() - s));
      }
      const s2 = performance.now();
      await client.user.findFirst({ select: { id: true } });
      const modelQ = Math.round(performance.now() - s2);
      const [{ db }] = await client.$queryRawUnsafe<{ db: string }[]>('SELECT current_database() AS db');
      queries[label] = { first, warm, modelQ, db };
    } catch (e) {
      queries[label] = { error: (e as Error).message.split('\n').slice(-1)[0].slice(0, 200) };
    } finally {
      await client.$disconnect().catch(() => {});
    }
  }
  return { name, paramNames: [...u.searchParams.keys()], host, port, addrs: addrs.map((a) => a.address), dnsMs, tcpConnectMs: tcp, queries };
}

async function timeSingleton() {
  const warm: number[] = [];
  for (let i = 0; i < 6; i++) {
    const s = performance.now();
    await prisma.$queryRawUnsafe('SELECT 1');
    warm.push(Math.round(performance.now() - s));
  }
  const s2 = performance.now();
  await prisma.user.findFirst({ select: { id: true } });
  return { warm, modelQ: Math.round(performance.now() - s2) };
}

export async function GET(req: NextRequest) {
  if (process.env.VERCEL_ENV === 'production') {
    const user = await getAuthenticatedUser(req).catch(() => null);
    if (!user?.isSuperAdmin) return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  const singleton = await timeSingleton().catch((e) => ({ error: (e as Error).message.slice(0, 200) }));
  const results = [];
  for (const name of CANDIDATES) {
    const raw = process.env[name];
    if (!raw) { results.push({ name, present: false }); continue; }
    try { results.push(await probe(name, raw)); }
    catch (e) { results.push({ name, error: (e as Error).message.slice(0, 200) }); }
  }
  return NextResponse.json({ region: process.env.VERCEL_REGION, env: process.env.VERCEL_ENV, singleton, results });
}
