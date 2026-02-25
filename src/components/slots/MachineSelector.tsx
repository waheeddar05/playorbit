'use client';

import { Check } from 'lucide-react';
import { MACHINE_CARDS, type MachineCard } from '@/lib/client-constants';
import type { MachineId } from '@/lib/schemas';

interface MachineSelectorProps {
  selectedMachineId: MachineId;
  onSelect: (id: MachineId) => void;
}

export function MachineSelector({ selectedMachineId, onSelect }: MachineSelectorProps) {
  const leatherMachines = MACHINE_CARDS.filter(c => c.category === 'LEATHER');
  const tennisMachines = MACHINE_CARDS.filter(c => c.category === 'TENNIS');

  return (
    <div className="mb-4">
      <label className="block text-[10px] font-medium text-accent mb-2 uppercase tracking-wider">
        Machine Type
      </label>

      {/* Leather Machines */}
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        {leatherMachines.map((card) => (
          <MachineCardButton
            key={card.id}
            card={card}
            isSelected={selectedMachineId === card.id}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Tennis Machines */}
      <div className="grid grid-cols-2 gap-2.5">
        {tennisMachines.map((card) => (
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
  const categoryBadge = card.category === 'LEATHER'
    ? { text: 'LEATHER', bg: 'bg-red-500/20 text-red-400 border-red-500/30' }
    : { text: 'TENNIS', bg: 'bg-green-500/20 text-green-400 border-green-500/30' };

  return (
    <button
      onClick={() => onSelect(card.id)}
      className={`relative rounded-xl overflow-hidden transition-all cursor-pointer text-left ${isSelected
        ? 'ring-2 ring-accent/60 shadow-lg shadow-accent/10'
        : 'border border-white/[0.08] hover:border-accent/30'
        }`}
    >
      {/* Machine Image */}
      <div className={`relative w-full aspect-[16/10] overflow-hidden ${isSelected ? 'bg-accent/5' : 'bg-white/[0.02]'
        }`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={card.image}
          alt={card.label}
          className={`w-full h-full object-cover transition-transform duration-300 ${isSelected ? 'scale-105' : 'group-hover:scale-105'
            }`}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a1628]/90 via-[#0a1628]/30 to-transparent" />

        {/* Selected checkmark */}
        {isSelected && (
          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
            <Check className="w-3 h-3 text-primary" />
          </div>
        )}

        {/* Category badge */}
        <span className={`absolute top-2 left-2 text-[8px] font-bold px-1.5 py-0.5 rounded border ${categoryBadge.bg}`}>
          {categoryBadge.text}
        </span>
      </div>

      {/* Machine Info */}
      <div className={`px-3 py-2.5 ${isSelected ? 'bg-accent/10' : 'bg-white/[0.03]'}`}>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isSelected ? 'bg-accent' : card.category === 'LEATHER' ? 'bg-red-400' : 'bg-green-400'
            }`} />
          <span className={`text-xs font-bold leading-tight ${isSelected ? 'text-accent' : 'text-slate-200'}`}>
            {card.label}
          </span>
        </div>
        <p className={`text-[9px] ml-3.5 mt-0.5 ${isSelected ? 'text-accent/70' : 'text-slate-500'}`}>
          {card.shortLabel}
        </p>
      </div>
    </button>
  );
}
