'use client';

import { MACHINE_CARDS, type MachineCard } from '@/lib/client-constants';
import type { MachineId } from '@/lib/schemas';

interface MachineSelectorProps {
  selectedMachineId: MachineId;
  onSelect: (id: MachineId) => void;
}

export function MachineSelector({ selectedMachineId, onSelect }: MachineSelectorProps) {
  return (
    <div className="mb-4">
      <label className="block text-[10px] font-medium text-slate-500 mb-2 uppercase tracking-wider">
        Machine
      </label>
      <div className="grid grid-cols-2 gap-2">
        {MACHINE_CARDS.map((card) => (
          <MachineCardButton
            key={card.id}
            card={card}
            isSelected={selectedMachineId === card.id}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function MachineCardButton({
  card,
  isSelected,
  onSelect,
}: {
  card: MachineCard;
  isSelected: boolean;
  onSelect: (id: MachineId) => void;
}) {
  return (
    <button
      onClick={() => onSelect(card.id)}
      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all cursor-pointer text-left ${
        isSelected
          ? `${card.activeBg} ring-2 ${card.activeRing} shadow-sm`
          : 'bg-white/[0.04] border border-white/[0.08] hover:border-accent/30'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={card.image}
        alt={card.label}
        className="w-9 h-9 rounded-lg object-cover flex-shrink-0"
      />
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${card.dotColor}`} />
          <span className={`text-[11px] font-bold truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
            {card.label}
          </span>
        </div>
        <p className={`text-[9px] ml-3.5 ${isSelected ? 'text-slate-400' : 'text-slate-600'}`}>
          {card.shortLabel}
        </p>
      </div>
    </button>
  );
}
