'use client';

import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { api, ApiError } from '@/lib/api-client';
import type { AvailableSlot, MachineId } from '@/lib/schemas';

interface UseSlotsReturn {
  slots: AvailableSlot[];
  loading: boolean;
  error: string;
  fetchSlots: (date: Date, machineId: MachineId, ballType: string, pitchType: string) => Promise<void>;
}

export function useSlots(): UseSlotsReturn {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchSlots = useCallback(async (
    date: Date,
    machineId: MachineId,
    ballType: string,
    pitchType: string
  ) => {
    setLoading(true);
    setError('');
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      let url = `/api/slots/available?date=${dateStr}&machineId=${machineId}&ballType=${ballType}`;
      if (pitchType) url += `&pitchType=${pitchType}`;

      const data = await api.get<AvailableSlot[]>(url);
      setSlots(data);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Failed to fetch slots';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { slots, loading, error, fetchSlots };
}
