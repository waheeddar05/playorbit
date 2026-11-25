import { describe, it, expect } from 'vitest';
import {
  readPitchAssignments,
  withPitchAssignments,
  isStaffPitchAssignment,
  STAFF_PITCH_LABELS,
} from '@/lib/staff-pitch';

describe('staff pitch assignment', () => {
  it('labels the two surfaces', () => {
    expect(STAFF_PITCH_LABELS.INDOOR_ASTRO).toBe('Indoor (Astro-turf nets)');
    expect(STAFF_PITCH_LABELS.NATURAL_TURF).toBe('Natural turf');
  });

  it('reads nothing from empty or malformed metadata', () => {
    expect(readPitchAssignments(null)).toEqual([]);
    expect(readPitchAssignments(undefined)).toEqual([]);
    expect(readPitchAssignments([])).toEqual([]);
    expect(readPitchAssignments({ pitchAssignments: 'NATURAL_TURF' })).toEqual([]);
    expect(readPitchAssignments({ pitchAssignments: ['CEMENT', 42] })).toEqual([]);
  });

  it('reads valid values in catalog order, deduped', () => {
    expect(
      readPitchAssignments({ pitchAssignments: ['NATURAL_TURF', 'bogus', 'INDOOR_ASTRO', 'NATURAL_TURF'] }),
    ).toEqual(['INDOOR_ASTRO', 'NATURAL_TURF']);
  });

  it('merges into metadata without touching other keys', () => {
    const before = { specialties: ['batting'], pitchAssignments: ['INDOOR_ASTRO'] };
    const after = withPitchAssignments(before, ['NATURAL_TURF']);
    expect(after).toEqual({ specialties: ['batting'], pitchAssignments: ['NATURAL_TURF'] });
    // Input is not mutated.
    expect(before.pitchAssignments).toEqual(['INDOOR_ASTRO']);
  });

  it('removes the key when cleared and tolerates null metadata', () => {
    expect(withPitchAssignments({ a: 1, pitchAssignments: ['NATURAL_TURF'] }, [])).toEqual({ a: 1 });
    expect(withPitchAssignments(null, ['NATURAL_TURF', 'INDOOR_ASTRO'])).toEqual({
      pitchAssignments: ['INDOOR_ASTRO', 'NATURAL_TURF'],
    });
  });

  it('guards values', () => {
    expect(isStaffPitchAssignment('INDOOR_ASTRO')).toBe(true);
    expect(isStaffPitchAssignment('ASTRO')).toBe(false);
  });
});
