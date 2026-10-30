import { describe, it, expect, vi } from 'vitest';

// Mock Prisma so importing the query builder doesn't try to connect to a
// database — `buildLedgerWhere` is pure, but the module also exports the
// collector lookups that talk to the DB.
vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

import { buildLedgerWhere } from '../ledger-query';

const CENTER = 'ctr_test';

function build(query: string) {
  return buildLedgerWhere(CENTER, new URLSearchParams(query));
}

function whereOf(query: string) {
  const built = build(query);
  if ('error' in built) throw new Error(`unexpected error: ${built.error}`);
  return built.where;
}

describe('buildLedgerWhere — collectedById', () => {
  it('filters Manual Revenue by who collected the money', () => {
    expect(whereOf('kind=REVENUE&collectedById=usr_raj')).toMatchObject({
      centerId: CENTER,
      kind: 'REVENUE',
      collectedById: 'usr_raj',
    });
  });

  it('filters Expenses by who made the expense — same column, both kinds', () => {
    expect(whereOf('kind=EXPENSE&collectedById=usr_raj')).toMatchObject({
      centerId: CENTER,
      kind: 'EXPENSE',
      collectedById: 'usr_raj',
    });
  });

  it('is absent when unset, so the default view is unfiltered', () => {
    expect(whereOf('kind=REVENUE').collectedById).toBeUndefined();
  });

  it('treats an empty value as "no filter" rather than a match on ""', () => {
    expect(whereOf('kind=REVENUE&collectedById=').collectedById).toBeUndefined();
  });

  it('combines with the other filters instead of replacing them', () => {
    expect(
      whereOf(
        'kind=REVENUE&collectedById=usr_raj&recordedById=usr_ana&paymentMethod=CASH&category=SIDEARM',
      ),
    ).toMatchObject({
      centerId: CENTER,
      kind: 'REVENUE',
      collectedById: 'usr_raj',
      recordedById: 'usr_ana',
      paymentMethod: 'CASH',
      revenueCategory: 'SIDEARM',
    });
  });

  it('stays center-scoped — a collector id never widens the query', () => {
    expect(whereOf('kind=EXPENSE&collectedById=usr_raj').centerId).toBe(CENTER);
  });
});

describe('buildLedgerWhere — expense subcategory', () => {
  it('filters Expenses by category and subcategory together', () => {
    expect(
      whereOf('kind=EXPENSE&category=REPAIRS_MAINTENANCE&subcategory=NET_REPAIR'),
    ).toMatchObject({
      centerId: CENTER,
      kind: 'EXPENSE',
      expenseCategory: 'REPAIRS_MAINTENANCE',
      expenseSubcategory: 'NET_REPAIR',
    });
  });

  it('scopes a shared code like OTHER to the selected category', () => {
    expect(whereOf('kind=EXPENSE&category=BALLS&subcategory=OTHER')).toMatchObject({
      expenseCategory: 'BALLS',
      expenseSubcategory: 'OTHER',
    });
  });

  it('is absent when unset or empty', () => {
    expect(whereOf('kind=EXPENSE&category=BALLS').expenseSubcategory).toBeUndefined();
    expect(whereOf('kind=EXPENSE&category=BALLS&subcategory=').expenseSubcategory).toBeUndefined();
  });

  it('rejects a subcategory from a different category', () => {
    expect(build('kind=EXPENSE&category=BALLS&subcategory=NET_REPAIR')).toHaveProperty('error');
  });

  it('rejects a subcategory under Miscellaneous, which has none', () => {
    expect(build('kind=EXPENSE&category=MISCELLANEOUS&subcategory=OTHER')).toHaveProperty('error');
  });

  it('rejects a subcategory without a category', () => {
    expect(build('kind=EXPENSE&subcategory=NET_REPAIR')).toHaveProperty('error');
  });

  it('rejects a subcategory on Manual Revenue', () => {
    expect(build('kind=REVENUE&category=SIDEARM&subcategory=OTHER')).toHaveProperty('error');
  });
});
