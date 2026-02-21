import { describe, it, expect } from 'vitest';
import {
  BookSlotRequestSchema,
  BookSlotsRequestSchema,
  PackageValidationRequestSchema,
  CancelBookingRequestSchema,
  MachineIdSchema,
  BallTypeSchema,
  OperationModeSchema,
} from '../schemas';

describe('MachineIdSchema', () => {
  it('accepts valid machine IDs', () => {
    expect(MachineIdSchema.parse('GRAVITY')).toBe('GRAVITY');
    expect(MachineIdSchema.parse('YANTRA')).toBe('YANTRA');
    expect(MachineIdSchema.parse('LEVERAGE_INDOOR')).toBe('LEVERAGE_INDOOR');
    expect(MachineIdSchema.parse('LEVERAGE_OUTDOOR')).toBe('LEVERAGE_OUTDOOR');
  });

  it('rejects invalid machine IDs', () => {
    expect(() => MachineIdSchema.parse('INVALID')).toThrow();
    expect(() => MachineIdSchema.parse('')).toThrow();
    expect(() => MachineIdSchema.parse(123)).toThrow();
  });
});

describe('BallTypeSchema', () => {
  it('accepts valid ball types', () => {
    expect(BallTypeSchema.parse('TENNIS')).toBe('TENNIS');
    expect(BallTypeSchema.parse('LEATHER')).toBe('LEATHER');
    expect(BallTypeSchema.parse('MACHINE')).toBe('MACHINE');
  });

  it('rejects invalid ball types', () => {
    expect(() => BallTypeSchema.parse('CRICKET')).toThrow();
  });
});

describe('BookSlotRequestSchema', () => {
  const validPayload = {
    date: '2026-01-15',
    startTime: '2026-01-15T01:30:00.000Z',
    endTime: '2026-01-15T02:00:00.000Z',
    ballType: 'LEATHER',
    machineId: 'GRAVITY',
    operationMode: 'WITH_OPERATOR',
  };

  it('validates a correct booking payload', () => {
    const result = BookSlotRequestSchema.parse(validPayload);
    expect(result.date).toBe('2026-01-15');
    expect(result.machineId).toBe('GRAVITY');
  });

  it('rejects invalid date format', () => {
    expect(() => BookSlotRequestSchema.parse({ ...validPayload, date: '15-01-2026' })).toThrow();
    expect(() => BookSlotRequestSchema.parse({ ...validPayload, date: '2026/01/15' })).toThrow();
  });

  it('rejects invalid machineId', () => {
    expect(() => BookSlotRequestSchema.parse({ ...validPayload, machineId: 'UNKNOWN' })).toThrow();
  });

  it('rejects invalid operationMode', () => {
    expect(() => BookSlotRequestSchema.parse({ ...validPayload, operationMode: 'AUTO' })).toThrow();
  });

  it('allows optional fields', () => {
    const result = BookSlotRequestSchema.parse(validPayload);
    expect(result.userPackageId).toBeUndefined();
    expect(result.userId).toBeUndefined();
    expect(result.pitchType).toBeUndefined();
  });

  it('validates optional pitchType when provided', () => {
    const result = BookSlotRequestSchema.parse({ ...validPayload, pitchType: 'ASTRO' });
    expect(result.pitchType).toBe('ASTRO');
  });
});

describe('BookSlotsRequestSchema', () => {
  const validSlot = {
    date: '2026-01-15',
    startTime: '2026-01-15T01:30:00.000Z',
    endTime: '2026-01-15T02:00:00.000Z',
    ballType: 'LEATHER',
    machineId: 'GRAVITY',
    operationMode: 'WITH_OPERATOR',
  };

  it('accepts array of 1-10 slots', () => {
    expect(BookSlotsRequestSchema.parse([validSlot])).toHaveLength(1);
    expect(BookSlotsRequestSchema.parse([validSlot, validSlot])).toHaveLength(2);
  });

  it('rejects empty array', () => {
    expect(() => BookSlotsRequestSchema.parse([])).toThrow();
  });

  it('rejects more than 10 slots', () => {
    const slots = Array(11).fill(validSlot);
    expect(() => BookSlotsRequestSchema.parse(slots)).toThrow();
  });
});

describe('PackageValidationRequestSchema', () => {
  it('validates correct payload', () => {
    const result = PackageValidationRequestSchema.parse({
      userPackageId: 'pkg_123',
      ballType: 'LEATHER',
      startTime: '2026-01-15T01:30:00.000Z',
      numberOfSlots: 2,
    });
    expect(result.numberOfSlots).toBe(2);
  });

  it('rejects zero or negative numberOfSlots', () => {
    expect(() => PackageValidationRequestSchema.parse({
      userPackageId: 'pkg_123',
      ballType: 'LEATHER',
      startTime: '2026-01-15T01:30:00.000Z',
      numberOfSlots: 0,
    })).toThrow();

    expect(() => PackageValidationRequestSchema.parse({
      userPackageId: 'pkg_123',
      ballType: 'LEATHER',
      startTime: '2026-01-15T01:30:00.000Z',
      numberOfSlots: -1,
    })).toThrow();
  });
});

describe('CancelBookingRequestSchema', () => {
  it('validates with bookingId only', () => {
    const result = CancelBookingRequestSchema.parse({ bookingId: 'bk_123' });
    expect(result.bookingId).toBe('bk_123');
    expect(result.reason).toBeUndefined();
  });

  it('validates with optional reason', () => {
    const result = CancelBookingRequestSchema.parse({
      bookingId: 'bk_123',
      reason: 'Schedule conflict',
    });
    expect(result.reason).toBe('Schedule conflict');
  });

  it('rejects missing bookingId', () => {
    expect(() => CancelBookingRequestSchema.parse({})).toThrow();
  });
});
