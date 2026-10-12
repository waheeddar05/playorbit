import { describe, it, expect } from 'vitest';
import {
  ballOptionsForMachineType,
  isBallTypeValidForMachineType,
  coerceBallTypeForMachineType,
  ballOptionsFromEffective,
  coerceBallTypeFromEffective,
  packageFormBallTypes,
  PACKAGE_BALL_OPTIONS,
  PACKAGE_BALL_TENNIS_OPTIONS,
} from '@/lib/package-admin-labels';

describe('ballOptionsForMachineType', () => {
  it('offers Machine / Leather for leather machines', () => {
    expect(ballOptionsForMachineType('LEATHER')).toEqual(PACKAGE_BALL_OPTIONS);
    expect(ballOptionsForMachineType('LEATHER').map(o => o.value)).toEqual(['LEATHER', 'MACHINE']);
  });

  it('offers Machine / Tennis for tennis machines', () => {
    expect(ballOptionsForMachineType('TENNIS')).toEqual(PACKAGE_BALL_TENNIS_OPTIONS);
    expect(ballOptionsForMachineType('TENNIS').map(o => o.value)).toEqual(['MACHINE', 'TENNIS']);
  });

  it('never offers Leather for tennis machines', () => {
    expect(ballOptionsForMachineType('TENNIS').some(o => o.value === 'LEATHER')).toBe(false);
  });

  it('never offers Tennis for leather machines', () => {
    expect(ballOptionsForMachineType('LEATHER').some(o => o.value === 'TENNIS')).toBe(false);
  });
});

describe('isBallTypeValidForMachineType', () => {
  it('accepts Machine / Leather / Both for leather machines', () => {
    expect(isBallTypeValidForMachineType('LEATHER', 'MACHINE')).toBe(true);
    expect(isBallTypeValidForMachineType('LEATHER', 'LEATHER')).toBe(true);
    expect(isBallTypeValidForMachineType('LEATHER', 'BOTH')).toBe(true);
  });

  it('rejects Tennis for leather machines', () => {
    expect(isBallTypeValidForMachineType('LEATHER', 'TENNIS')).toBe(false);
  });

  it('accepts Machine / Tennis for tennis machines', () => {
    expect(isBallTypeValidForMachineType('TENNIS', 'MACHINE')).toBe(true);
    expect(isBallTypeValidForMachineType('TENNIS', 'TENNIS')).toBe(true);
  });

  it('rejects Leather / Both for tennis machines', () => {
    expect(isBallTypeValidForMachineType('TENNIS', 'LEATHER')).toBe(false);
    expect(isBallTypeValidForMachineType('TENNIS', 'BOTH')).toBe(false);
  });

  it('treats a missing ball type as valid (optional column)', () => {
    expect(isBallTypeValidForMachineType('TENNIS', null)).toBe(true);
    expect(isBallTypeValidForMachineType('LEATHER', undefined)).toBe(true);
  });
});

describe('coerceBallTypeForMachineType', () => {
  it('keeps a valid current value', () => {
    expect(coerceBallTypeForMachineType('LEATHER', 'MACHINE')).toBe('MACHINE');
    expect(coerceBallTypeForMachineType('TENNIS', 'TENNIS')).toBe('TENNIS');
  });

  it('clears an incompatible value to the category default', () => {
    // Leather selected, switched to a tennis machine → drop to Tennis.
    expect(coerceBallTypeForMachineType('TENNIS', 'LEATHER')).toBe('TENNIS');
    // Tennis selected, switched to a leather machine → drop to Leather.
    expect(coerceBallTypeForMachineType('LEATHER', 'TENNIS')).toBe('LEATHER');
  });

  it('falls back to the category default when current is empty', () => {
    expect(coerceBallTypeForMachineType('LEATHER', null)).toBe('LEATHER');
    expect(coerceBallTypeForMachineType('TENNIS', '')).toBe('TENNIS');
  });
});

describe('ballOptionsFromEffective', () => {
  it('returns Tennis only for a tennis machine (effective = [TENNIS])', () => {
    expect(ballOptionsFromEffective(['TENNIS'])).toEqual([{ value: 'TENNIS', label: 'Tennis' }]);
  });

  it('returns Leather / Machine for a leather machine', () => {
    expect(ballOptionsFromEffective(['LEATHER', 'MACHINE'])).toEqual([
      { value: 'LEATHER', label: 'Leather' },
      { value: 'MACHINE', label: 'Machine' },
    ]);
  });

  it('honours an admin restriction to a single type', () => {
    expect(ballOptionsFromEffective(['MACHINE'])).toEqual([{ value: 'MACHINE', label: 'Machine' }]);
  });

  it('falls back to Leather / Machine when the list is empty or missing', () => {
    expect(ballOptionsFromEffective([]).map(o => o.value)).toEqual(['LEATHER', 'MACHINE']);
    expect(ballOptionsFromEffective(null).map(o => o.value)).toEqual(['LEATHER', 'MACHINE']);
    expect(ballOptionsFromEffective(undefined).map(o => o.value)).toEqual(['LEATHER', 'MACHINE']);
  });
});

describe('coerceBallTypeFromEffective', () => {
  it('keeps a value the machine still supports', () => {
    expect(coerceBallTypeFromEffective(['LEATHER', 'MACHINE'], 'MACHINE')).toBe('MACHINE');
    expect(coerceBallTypeFromEffective(['TENNIS'], 'TENNIS')).toBe('TENNIS');
  });

  it('snaps to the first supported type when the current is unsupported', () => {
    // Was on a leather machine (Machine), pinned a tennis machine → Tennis.
    expect(coerceBallTypeFromEffective(['TENNIS'], 'MACHINE')).toBe('TENNIS');
    // Was on a tennis machine (Tennis), pinned a leather machine → Leather.
    expect(coerceBallTypeFromEffective(['LEATHER', 'MACHINE'], 'TENNIS')).toBe('LEATHER');
  });

  it('defaults sensibly when nothing is pinned', () => {
    expect(coerceBallTypeFromEffective(null, null)).toBe('LEATHER');
  });
});

describe('packageFormBallTypes', () => {
  const iWinner = { effectiveBallTypes: ['TENNIS'] };
  const yantra = { effectiveBallTypes: ['LEATHER', 'MACHINE'] };

  it('offers a loaded pinned machine its own ball types', () => {
    expect(packageFormBallTypes(iWinner, 'LEATHER')).toEqual(['TENNIS']);
    expect(packageFormBallTypes(yantra, 'LEATHER')).toEqual(['LEATHER', 'MACHINE']);
  });

  it('keeps Tennis for a tennis package whose machine is not loaded', () => {
    // Pinned to a deactivated iWinner: the form only loads active machines.
    expect(packageFormBallTypes(undefined, 'TENNIS')).toEqual(['TENNIS']);
  });

  it('offers Leather/Machine for a leather package with no loaded machine', () => {
    expect(packageFormBallTypes(undefined, 'LEATHER')).toEqual(['LEATHER', 'MACHINE']);
    expect(packageFormBallTypes(null, null)).toEqual(['LEATHER', 'MACHINE']);
  });

  it('opens a tennis package saved without a ball type on Tennis', () => {
    expect(coerceBallTypeFromEffective(packageFormBallTypes(iWinner, 'TENNIS'), null)).toBe('TENNIS');
    expect(coerceBallTypeFromEffective(packageFormBallTypes(iWinner, 'TENNIS'), 'MACHINE')).toBe('TENNIS');
  });

  it('never changes a stored ball type the machine still offers', () => {
    expect(coerceBallTypeFromEffective(packageFormBallTypes(yantra, 'LEATHER'), 'MACHINE')).toBe('MACHINE');
    expect(coerceBallTypeFromEffective(packageFormBallTypes(undefined, 'TENNIS'), 'TENNIS')).toBe('TENNIS');
  });
});
