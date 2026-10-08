import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePackageFilters, type FilterMachine } from '../PackageFilters';

const PACKAGES = [
  { id: 'gravity-day', category: 'MACHINE', timingType: 'DAY', machineRowId: 'm-gravity', machineId: null },
  { id: 'yantra-legacy-eve', category: null, timingType: 'EVENING', machineRowId: null, machineId: 'YANTRA' },
  { id: 'net-both', category: 'NET', timingType: 'BOTH', machineRowId: null, machineId: null },
  { id: 'sidearm-day', category: 'SIDEARM', timingType: 'DAY', machineRowId: null, machineId: null },
];

const MACHINES: FilterMachine[] = [
  { id: 'm-gravity', name: 'Gravity', isActive: true, legacyMachineId: 'GRAVITY' },
  { id: 'm-yantra', name: 'Yantra', isActive: true, legacyMachineId: 'YANTRA' },
];

const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id);

describe('usePackageFilters', () => {
  it('shows everything until a filter is picked', () => {
    const { result } = renderHook(() => usePackageFilters(PACKAGES, null, MACHINES));
    expect(result.current.hasActiveFilter).toBe(false);
    expect(ids(result.current.filteredPackages)).toEqual(ids(PACKAGES));
  });

  it('treats a package with no category as Bowling Machine', () => {
    const { result } = renderHook(() => usePackageFilters(PACKAGES, null, MACHINES));
    act(() => result.current.setCategoryFilter('MACHINE'));
    expect(ids(result.current.filteredPackages)).toEqual(['gravity-day', 'yantra-legacy-eve']);
  });

  it('lets an Any-time package through either timing chip', () => {
    const { result } = renderHook(() => usePackageFilters(PACKAGES, null, MACHINES));
    act(() => result.current.setTimingFilter('EVENING'));
    expect(ids(result.current.filteredPackages)).toEqual(['yantra-legacy-eve', 'net-both']);
  });

  it('matches a machine by row id or by its legacy enum', () => {
    const { result } = renderHook(() => usePackageFilters(PACKAGES, null, MACHINES));
    act(() => result.current.setCategoryFilter('MACHINE'));
    act(() => result.current.setMachineFilter('m-yantra'));
    expect(ids(result.current.filteredPackages)).toEqual(['yantra-legacy-eve']);
    act(() => result.current.setMachineFilter('m-gravity'));
    expect(ids(result.current.filteredPackages)).toEqual(['gravity-day']);
  });

  it('drops the machine filter when the category leaves Bowling Machine', () => {
    const { result } = renderHook(() => usePackageFilters(PACKAGES, null, MACHINES));
    act(() => result.current.setCategoryFilter('MACHINE'));
    act(() => result.current.setMachineFilter('m-gravity'));
    act(() => result.current.setCategoryFilter('NET'));
    expect(result.current.machineFilter).toBeNull();
    expect(ids(result.current.filteredPackages)).toEqual(['net-both']);
  });

  it("offers only the center's enabled categories", () => {
    const { result } = renderHook(() => usePackageFilters(PACKAGES, ['NET', 'MACHINE'], MACHINES));
    expect(result.current.visibleCategoryCards.map((c) => c.id)).toEqual(['MACHINE', 'NET']);
  });

  it('clears every filter at once', () => {
    const { result } = renderHook(() => usePackageFilters(PACKAGES, null, MACHINES));
    act(() => result.current.setCategoryFilter('MACHINE'));
    act(() => result.current.setTimingFilter('DAY'));
    act(() => result.current.clearFilters());
    expect(result.current.hasActiveFilter).toBe(false);
    expect(result.current.filteredPackages).toHaveLength(PACKAGES.length);
  });
});
