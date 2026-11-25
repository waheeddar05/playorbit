'use client';

/**
 * Pitch assignment chips on a staff card (Admin → Operators / Ground
 * Staff / Sidearm / Personal Coach).
 *
 * With `endpoint` (the membership PATCH URL) the chips are toggles that
 * save immediately; without it they are a read-only summary, which is
 * what a specialist sees on their own availability page.
 */

import { useState } from 'react';
import { Check, Loader2, MapPin } from 'lucide-react';
import {
  STAFF_PITCH_ASSIGNMENTS,
  STAFF_PITCH_LABELS,
  readPitchAssignments,
  type StaffPitchAssignment,
} from '@/lib/staff-pitch';

export function StaffPitchAssignment({
  metadata,
  endpoint,
  onSaved,
}: {
  metadata: unknown;
  endpoint?: string;
  onSaved?: (assignments: StaffPitchAssignment[]) => void;
}) {
  const fromProps = readPitchAssignments(metadata);
  const propsKey = fromProps.join(',');
  const [value, setValue] = useState<StaffPitchAssignment[]>(fromProps);
  // Re-sync when the parent refetches the roster with a different
  // assignment (e.g. another admin changed it). Adjusting state during
  // render is React's recommended pattern for prop-derived state.
  const [syncedKey, setSyncedKey] = useState(propsKey);
  if (propsKey !== syncedKey) {
    setSyncedKey(propsKey);
    setValue(fromProps);
  }
  const [saving, setSaving] = useState<StaffPitchAssignment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editable = Boolean(endpoint);

  const toggle = async (pitch: StaffPitchAssignment) => {
    if (!endpoint || saving) return;
    const previous = value;
    const next = value.includes(pitch) ? value.filter((p) => p !== pitch) : [...value, pitch];
    setValue(next);
    setSaving(pitch);
    setError(null);
    try {
      const r = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pitchAssignments: next }),
      });
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${r.status}`);
      }
      const saved = await r.json().catch(() => null);
      const confirmed = saved ? readPitchAssignments(saved.metadata) : next;
      setValue(confirmed);
      onSaved?.(confirmed);
    } catch (e) {
      setValue(previous);
      setError(e instanceof Error ? e.message : 'Failed to save pitch assignment');
    } finally {
      setSaving(null);
    }
  };

  if (!editable && value.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
        <MapPin className="w-3 h-3" /> Pitch assignment
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(editable ? STAFF_PITCH_ASSIGNMENTS : value).map((pitch) => {
          const on = value.includes(pitch);
          return (
            <button
              key={pitch}
              type="button"
              onClick={() => toggle(pitch)}
              disabled={!editable || saving !== null}
              aria-pressed={on}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                on
                  ? 'bg-accent/15 text-accent border-accent/30'
                  : 'bg-white/[0.04] text-slate-400 border-white/[0.08] hover:bg-white/[0.08]'
              } ${editable ? 'cursor-pointer disabled:opacity-60 disabled:cursor-wait' : 'cursor-default'}`}
            >
              {saving === pitch ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : on ? (
                <Check className="w-3 h-3" />
              ) : null}
              {STAFF_PITCH_LABELS[pitch]}
            </button>
          );
        })}
      </div>
      {editable && value.length === 0 && !error && (
        <p className="mt-1 text-[11px] text-slate-600 italic">Not assigned to a pitch yet</p>
      )}
      {error && <p className="mt-1 text-[11px] text-red-300">{error}</p>}
    </div>
  );
}
