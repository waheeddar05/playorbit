'use client';

import { format, parseISO } from 'date-fns';
import { Check, AlertTriangle, Calendar, Sun, CloudSun, Moon } from 'lucide-react';
import { SlotSkeleton } from '@/components/ui/LoadingState';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import type { AvailableSlot, PackageValidationResponse } from '@/lib/schemas';

interface SlotGridProps {
  slots: AvailableSlot[];
  selectedSlots: AvailableSlot[];
  loading: boolean;
  error: string;
  isLeatherMachine: boolean;
  bookingLoading: boolean;
  selectedPackageId: string;
  packageValidation: PackageValidationResponse | null;
  onToggleSlot: (slot: AvailableSlot) => void;
  onRetry: () => void;
  getSlotDisplayPrice: (slot: AvailableSlot) => number;
}

// ─── Time-of-day grouping ────────────────────────────────
interface TimeGroup {
  label: string;
  icon: typeof Sun;
  iconColor: string;
  slots: AvailableSlot[];
}

function groupSlotsByTimeOfDay(slots: AvailableSlot[]): TimeGroup[] {
  const morning: AvailableSlot[] = [];
  const afternoon: AvailableSlot[] = [];
  const evening: AvailableSlot[] = [];

  slots.forEach(slot => {
    const hour = parseISO(slot.startTime).getHours();
    if (hour < 12) morning.push(slot);
    else if (hour < 17) afternoon.push(slot);
    else evening.push(slot);
  });

  const groups: TimeGroup[] = [];
  if (morning.length > 0) groups.push({ label: 'Morning', icon: Sun, iconColor: 'text-amber-400', slots: morning });
  if (afternoon.length > 0) groups.push({ label: 'Afternoon', icon: CloudSun, iconColor: 'text-orange-400', slots: afternoon });
  if (evening.length > 0) groups.push({ label: 'Evening', icon: Moon, iconColor: 'text-indigo-400', slots: evening });

  return groups;
}

export function SlotGrid({
  slots,
  selectedSlots,
  loading,
  error,
  isLeatherMachine,
  bookingLoading,
  selectedPackageId,
  packageValidation,
  onToggleSlot,
  onRetry,
  getSlotDisplayPrice,
}: SlotGridProps) {
  const groups = groupSlotsByTimeOfDay(slots);

  return (
    <div className="mb-5">
      <label className="block text-[10px] font-medium text-accent mb-2 uppercase tracking-wider">
        Available Slots
      </label>

      {loading ? (
        <SlotSkeleton />
      ) : error ? (
        <ErrorState message={error} onRetry={onRetry} />
      ) : slots.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No slots available for this date"
          description="Try selecting a different date or machine"
        />
      ) : (
        <div className="space-y-5">
          {groups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <div key={group.label}>
                {/* Section Header */}
                <div className="flex items-center gap-2 mb-2.5">
                  <GroupIcon className={`w-4 h-4 ${group.iconColor}`} />
                  <span className="text-xs font-semibold text-slate-300">{group.label}</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-[10px] text-slate-500">{group.slots.length} slots</span>
                </div>

                {/* Slot Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {group.slots.map((slot) => (
                    <SlotCard
                      key={slot.startTime}
                      slot={slot}
                      isSelected={selectedSlots.some(s => s.startTime === slot.startTime)}
                      isLeatherMachine={isLeatherMachine}
                      isDisabled={slot.status === 'Booked' || slot.status === 'OperatorUnavailable' || slot.status === 'Blocked' || bookingLoading}
                      selectedPackageId={selectedPackageId}
                      packageValidation={packageValidation}
                      displayPrice={getSlotDisplayPrice(slot)}
                      onToggle={onToggleSlot}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selection Summary Strip */}
      {selectedSlots.length > 0 && (
        <div className="mt-3 px-3 py-2.5 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2 min-w-0">
            <Check className="w-4 h-4 text-accent flex-shrink-0" />
            <span className="text-xs text-slate-300 truncate">
              {selectedSlots.length} selected:{' '}
              <span className="text-accent font-medium">
                {selectedSlots
                  .sort((a, b) => a.startTime.localeCompare(b.startTime))
                  .map(s => format(parseISO(s.startTime), 'HH:mm'))
                  .join(', ')}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Individual Slot Card ────────────────────────────────
interface SlotCardProps {
  slot: AvailableSlot;
  isSelected: boolean;
  isLeatherMachine: boolean;
  isDisabled: boolean;
  selectedPackageId: string;
  packageValidation: PackageValidationResponse | null;
  displayPrice: number;
  onToggle: (slot: AvailableSlot) => void;
}

function SlotCard({
  slot,
  isSelected,
  isLeatherMachine,
  isDisabled,
  selectedPackageId,
  packageValidation,
  displayPrice,
  onToggle,
}: SlotCardProps) {
  const isBooked = slot.status === 'Booked';
  const isBlocked = slot.status === 'Blocked';
  const isOperatorUnavailable = slot.status === 'OperatorUnavailable';
  const isUnavailable = isBooked || isBlocked || isOperatorUnavailable;
  const noOperator = !slot.operatorAvailable && !isLeatherMachine && !isUnavailable;

  const bgClass = isUnavailable
    ? 'bg-white/[0.02] border border-white/[0.05] cursor-not-allowed'
    : isSelected
      ? 'bg-accent text-primary shadow-md shadow-accent/20 border border-accent'
      : noOperator
        ? 'bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/30 active:scale-[0.97]'
        : 'bg-white/[0.04] border border-white/[0.08] hover:border-accent/40 active:scale-[0.97]';

  const statusLabel = isBlocked
    ? 'Not Available'
    : isOperatorUnavailable
      ? 'Not Available'
      : isBooked
        ? 'Booked'
        : isSelected
          ? 'Selected'
          : noOperator
            ? 'Self Operate'
            : 'Open';

  const statusColor = isBlocked
    ? 'text-red-400'
    : isOperatorUnavailable
      ? 'text-red-400'
      : isBooked
        ? 'text-red-400'
        : isSelected
          ? 'text-primary/80'
          : noOperator
            ? 'text-amber-400'
            : 'text-green-400';

  return (
    <button
      disabled={isDisabled}
      onClick={() => onToggle(slot)}
      className={`relative p-3.5 rounded-xl transition-all text-left cursor-pointer ${bgClass}`}
    >
      {isSelected && (
        <div className="absolute top-2 right-2">
          <Check className="w-4 h-4" />
        </div>
      )}
      {noOperator && !isSelected && (
        <div className="absolute top-2 right-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
        </div>
      )}

      <div className={`text-sm font-bold ${isUnavailable ? 'text-slate-600' : isSelected ? '' : 'text-white'}`}>
        {format(parseISO(slot.startTime), 'HH:mm')}
      </div>
      <div className={`text-[10px] mt-0.5 ${isUnavailable ? 'text-slate-600' : isSelected ? 'text-primary/70' : 'text-slate-400'
        }`}>
        to {format(parseISO(slot.endTime), 'HH:mm')}
      </div>

      <div className="flex items-center justify-between mt-1.5">
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${statusColor}`}>
          {statusLabel}
        </span>
        {!isUnavailable && (
          <span className={`text-[10px] font-medium ${isSelected ? 'text-primary/70' : 'text-slate-400'}`}>
            {selectedPackageId && packageValidation?.valid ? 'Package' : `₹${displayPrice}`}
          </span>
        )}
      </div>
    </button>
  );
}
