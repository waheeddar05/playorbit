'use client';

/**
 * Package browse filters — Booking Category, Machine Type and Timing.
 *
 * Shared by the user Packages → Browse tab and Admin → Packages →
 * Packages so both lists filter with the same chips, the same values and
 * the same matching rules. Change the filtering here and both move
 * together.
 */

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { X, RotateCcw, Sun, Moon, Settings2, LayoutGrid, Users, UserCog } from 'lucide-react';
import {
  PACKAGE_TIMING_DAY_LABEL,
  PACKAGE_TIMING_EVENING_LABEL,
} from '@/lib/package-admin-labels';

/**
 * BookingCategory ids supported by the packages filters. Mirrors the
 * canonical list used in `pitch-config.ts` and the admin
 * `EnabledCategoriesEditor`. Legacy ABCA packages without an explicit
 * category are treated as `MACHINE` for filtering / display.
 */
export type BookingCategory = 'MACHINE' | 'NET' | 'SIDEARM' | 'COACHING' | 'FULL_COURT';

export type TimingFilter = 'DAY' | 'EVENING';

/** Compact center-machine row used to power the Bowling Machine
 *  sub-filter. Fetched from the public `/api/centers/[id]/machines`
 *  endpoint — same source the user-facing slot picker uses, so the chips
 *  here are guaranteed to match what the user sees at booking time. */
export interface FilterMachine {
  id: string;
  name: string;
  shortName?: string | null;
  /** Bridge to the legacy MachineId enum for ABCA-style packages where
   *  `Package.machineId` is the enum string (e.g. `YANTRA`). Null on
   *  newly-added machines at resource-based centers. */
  legacyMachineId?: string | null;
  isActive: boolean;
  /** Catalog metadata — drives the image + ball-type subtitle so the
   *  machine chips here render exactly like the Book Your Slot machine
   *  picker (image badge + name + ball/surface line). */
  machineType?: { code?: string; name?: string; ballType?: string; imageUrl?: string | null } | null;
  resource?: { id: string; name: string; type: string } | null;
}

/** The package fields the filters read. */
export interface FilterablePackage {
  category?: string | null;
  timingType: string;
  machineId?: string | null;
  machineRowId?: string | null;
}

/** Canonical category cards. Rendered as the top-level browse filter.
 *  The actual list shown is the intersection with the center's
 *  `ENABLED_BOOKING_CATEGORIES` policy, so a center that only offers
 *  Bowling Machine + Cricket Nets shows just those two cards. */
export const CATEGORY_CARDS: Array<{
  id: BookingCategory;
  label: string;
  icon: typeof Settings2;
  dot: string;
}> = [
  { id: 'MACHINE',    label: 'Bowling Machine',  icon: Settings2,  dot: 'bg-red-500' },
  { id: 'NET',        label: 'Cricket Net',      icon: LayoutGrid, dot: 'bg-cyan-500' },
  { id: 'SIDEARM',    label: 'Sidearm',          icon: Users,      dot: 'bg-emerald-500' },
  { id: 'FULL_COURT', label: 'Full Indoor Court',icon: LayoutGrid, dot: 'bg-purple-500' },
  { id: 'COACHING',   label: 'Personal Coaching',icon: UserCog,    dot: 'bg-amber-500' },
];

/**
 * Normalise a package row to a BookingCategory. Legacy ABCA packages
 * predate the `category` column on Package — every such row is a
 * bowling-machine package, so we treat null as `MACHINE`.
 */
export function packageCategory(pkg: { category?: string | null }): BookingCategory {
  const c = pkg.category;
  if (c === 'NET' || c === 'SIDEARM' || c === 'COACHING' || c === 'FULL_COURT') return c;
  return 'MACHINE';
}

/**
 * Filter state + the derived list. `enabledCategories` is the center's
 * `ENABLED_BOOKING_CATEGORIES` (from `/api/packages`); null means
 * unknown, which shows every category card. `machines` should already be
 * limited to active machines.
 */
export function usePackageFilters<P extends FilterablePackage>(
  packages: P[],
  enabledCategories: BookingCategory[] | null,
  machines: FilterMachine[],
) {
  /** Top-level category filter. `null` (no selection) shows all packages. */
  const [categoryFilter, setCategoryState] = useState<BookingCategory | null>(null);
  /** Secondary timing chip. `null` means "no timing filter" so packages
   *  of any timing (Day, Evening, Both) are shown. */
  const [timingFilter, setTimingFilter] = useState<TimingFilter | null>(null);
  /** Machine sub-filter — only relevant when `categoryFilter === MACHINE`.
   *  Stores the Machine row id; matches packages by either `machineRowId`
   *  (resource centers) or by the corresponding `legacyMachineId` (ABCA
   *  packages where `Package.machineId` is the enum string). `null` =
   *  "All machines". */
  const [machineFilter, setMachineFilter] = useState<string | null>(null);

  // Clear the machine sub-filter whenever the category moves away from
  // Bowling Machine — otherwise selecting Nets/Sidearm would silently
  // keep a stale machine constraint that the user can't see.
  const setCategoryFilter = (category: BookingCategory | null) => {
    setCategoryState(category);
    if (category !== 'MACHINE') setMachineFilter(null);
  };

  const hasActiveFilter =
    categoryFilter !== null || timingFilter !== null || machineFilter !== null;

  const clearFilters = () => {
    setCategoryFilter(null);
    setTimingFilter(null);
    setMachineFilter(null);
  };

  /** Visible category cards = canonical list ∩ center's enabled
   *  categories — identical to the "Book Your Slot" picker, so every
   *  category bookable at this center is also browsable here regardless
   *  of whether a package already exists for it. */
  const visibleCategoryCards = useMemo(() => {
    if (!enabledCategories || enabledCategories.length === 0) {
      // Enabled list unknown (pre-policy load or a legacy bare-array
      // API response). Mirror the slot picker, which shows every
      // canonical category when the enabled list isn't available, so
      // categories like Bowling Machine / Full Indoor Court never
      // vanish just because no package has been created for them yet.
      return CATEGORY_CARDS;
    }
    const enabledSet = new Set(enabledCategories);
    return CATEGORY_CARDS.filter((c) => enabledSet.has(c.id));
  }, [enabledCategories]);

  // Filter the package list by the active category + timing + machine
  // chips. Machine filter is only meaningful when the active category is
  // MACHINE (the UI hides the chip row otherwise and clears the value).
  const filteredPackages = useMemo(() => {
    let filtered = packages;
    if (categoryFilter) {
      filtered = filtered.filter((p) => packageCategory(p) === categoryFilter);
    }
    if (timingFilter) {
      filtered = filtered.filter((p) => p.timingType === timingFilter || p.timingType === 'BOTH');
    }
    if (categoryFilter === 'MACHINE' && machineFilter) {
      const m = machines.find((cm) => cm.id === machineFilter);
      const legacy = m?.legacyMachineId ?? null;
      filtered = filtered.filter((p) => {
        // Resource-based packages pin a specific Machine row.
        if (p.machineRowId && p.machineRowId === machineFilter) return true;
        // Legacy ABCA packages reference the MachineId enum on
        // `Package.machineId`. Bridge through the selected machine's
        // `legacyMachineId` to keep both shapes filterable from the same
        // chip row.
        if (legacy && p.machineId === legacy) return true;
        return false;
      });
    }
    return filtered;
  }, [packages, categoryFilter, timingFilter, machineFilter, machines]);

  return {
    categoryFilter,
    setCategoryFilter,
    timingFilter,
    setTimingFilter,
    machineFilter,
    setMachineFilter,
    hasActiveFilter,
    clearFilters,
    visibleCategoryCards,
    filteredPackages,
  };
}

export type PackageFiltersState = ReturnType<typeof usePackageFilters>;

export function PackageFilters({
  filters,
  machines,
  centerName,
}: {
  filters: PackageFiltersState;
  machines: FilterMachine[];
  centerName?: string | null;
}) {
  const {
    categoryFilter,
    setCategoryFilter,
    timingFilter,
    setTimingFilter,
    machineFilter,
    setMachineFilter,
    hasActiveFilter,
    clearFilters,
    visibleCategoryCards,
  } = filters;

  return (
    <div className="bg-white/[0.03] rounded-xl border border-white/[0.06] p-4 mb-5">
      {/* Booking Category Filter */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Booking Category
          </label>
          {hasActiveFilter && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-accent transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Clear filters
            </button>
          )}
        </div>
        {visibleCategoryCards.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">
            No booking categories enabled for {centerName || 'this center'}.
          </p>
        ) : (
          // Category tiles reuse the exact layout/styling from the
          // "Book Your Slot" page (ResourceSlotsPage) — icon-left,
          // accent-solid active state — so both flows share one UI
          // standard.
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {visibleCategoryCards.map((card) => {
              const isSelected = categoryFilter === card.id;
              const Icon = card.icon;
              return (
                <button
                  key={card.id}
                  onClick={() => {
                    // Toggle: clicking the active card clears
                    // the category lens. Timing is preserved so
                    // a user can flip between categories while
                    // keeping their Day/Evening preference.
                    setCategoryFilter(isSelected ? null : card.id);
                  }}
                  className={`flex items-center justify-start gap-1.5 px-2 py-1.5 min-h-[2.75rem] rounded-lg text-xs font-semibold transition-all cursor-pointer min-w-0 text-left ${
                    isSelected
                      ? 'bg-accent text-primary shadow-sm'
                      : 'bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:border-accent/20'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                    isSelected ? 'bg-primary/15' : 'bg-white/[0.04]'
                  }`}>
                    <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-primary' : 'text-accent'}`} />
                  </div>
                  {/* Wrap to a second line instead of truncating so
                      long names ("Bowling Machine", "Full Indoor
                      Court") stay fully readable on narrow phones.
                      `min-h` on the button keeps every tile the same
                      height whether the label is one line or two. */}
                  <span className="leading-tight break-words">{card.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Machine sub-filter — only meaningful when the Bowling Machine
          category is picked. Single-select with an "All machines" reset.
          Chips match the resource-based slot picker (same data source) so
          they show the exact machine names seen at booking time. Hidden
          when the center has no machines configured. */}
      {categoryFilter === 'MACHINE' && machines.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Machine Type
            </label>
            {machineFilter && (
              <button
                onClick={() => setMachineFilter(null)}
                className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-accent transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
          {/* Machine boxes mirror the "Book Your Slot" machine
              picker exactly — equal-width grid cells (dynamic column
              count by machine total) with an image badge and a
              two-line name + ball/surface label, accent-solid when
              selected — so both flows share one UI standard. */}
          {/* Equal-width cells. Capped at 2 columns on phones (the
              two-line image cards need width) and expanded on `sm+`
              so the layout reads cleanly on mobile while keeping the
              Book Your Slot machine-card look. */}
          <div
            className={`grid gap-1.5 ${
              machines.length === 1
                ? 'grid-cols-1'
                : machines.length === 3
                  ? 'grid-cols-2 sm:grid-cols-3'
                  : machines.length >= 4
                    ? 'grid-cols-2 sm:grid-cols-4'
                    : 'grid-cols-2'
            }`}
          >
            {machines.map((m) => {
              const isActive = machineFilter === m.id;
              const imageUrl = m.machineType?.imageUrl;
              const ballType = m.machineType?.ballType;
              const ballLabel = ballType
                ? ballType.charAt(0) + ballType.slice(1).toLowerCase()
                : '';
              const displayName = m.name || m.machineType?.name || (m.shortName ?? '');
              return (
                <button
                  key={m.id}
                  onClick={() => setMachineFilter(isActive ? null : m.id)}
                  className={`flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg text-xs font-semibold border cursor-pointer transition-all min-w-0 text-left ${
                    isActive
                      ? 'bg-accent text-primary border-accent shadow-sm'
                      : 'bg-white/[0.04] text-slate-300 border-white/[0.08] hover:border-accent/30'
                  }`}
                >
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={displayName}
                      width={28}
                      height={28}
                      className="w-7 h-7 rounded-md object-cover bg-white/5 flex-shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-md bg-white/5 flex items-center justify-center flex-shrink-0">
                      <Settings2 className={`w-3.5 h-3.5 ${isActive ? 'text-primary/70' : 'text-slate-500'}`} />
                    </div>
                  )}
                  <span className="leading-tight text-left min-w-0 flex-1">
                    <span className="block truncate text-[11px]">
                      {displayName}
                    </span>
                    {(ballLabel || m.resource) && (
                      <span className={`block text-[10px] font-medium truncate ${isActive ? 'text-primary/70' : 'text-slate-500'}`}>
                        {ballLabel}{m.resource ? `${ballLabel ? ' • ' : ''}${m.resource.name}` : ''}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Timing Filter — secondary chip, single-select with
          clear. Defaults to no selection so packages of any
          timing (Day, Evening, Both) show through. */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Timing
          </label>
          {timingFilter && (
            <button
              onClick={() => setTimingFilter(null)}
              className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-accent transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
        {/* Timing boxes share the machine-box pattern (icon-left,
            accent-solid active) so machine and timing selectors are
            visually identical, matching the Book Your Slot flow. */}
        <div className="grid grid-cols-2 gap-1.5">
          {([
            { key: 'DAY' as const,     label: 'Day',     range: PACKAGE_TIMING_DAY_LABEL,     Icon: Sun },
            { key: 'EVENING' as const, label: 'Evening', range: PACKAGE_TIMING_EVENING_LABEL, Icon: Moon },
          ]).map(t => {
            const isActive = timingFilter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTimingFilter(isActive ? null : t.key)}
                className={`flex items-center justify-start gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer min-w-0 text-left ${
                  isActive
                    ? 'bg-accent text-primary shadow-sm'
                    : 'bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:border-accent/20'
                }`}
              >
                <div className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                  isActive ? 'bg-primary/15' : 'bg-white/[0.04]'
                }`}>
                  <t.Icon className={`w-3.5 h-3.5 ${isActive ? 'text-primary' : 'text-accent'}`} />
                </div>
                <span className="leading-tight text-left min-w-0 flex-1">
                  <span className="block truncate">{t.label}</span>
                  <span className={`block text-[10px] font-medium truncate ${isActive ? 'text-primary/70' : 'text-slate-500'}`}>
                    {t.range}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
