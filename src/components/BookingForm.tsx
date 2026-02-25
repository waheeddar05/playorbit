'use client';

import { useState, useEffect } from 'react';
import { bookingApi, SlotStatus, BallType } from '@/lib/api';
import { parseISO } from 'date-fns';

export default function BookingForm() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState<SlotStatus[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [machine, setMachine] = useState<'A' | 'B'>('B');
  const [ballType, setBallType] = useState<BallType>('TENNIS');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    // Reset ball type when machine changes
    if (machine === 'A') {
      setBallType('LEATHER');
    } else {
      setBallType('TENNIS');
    }
  }, [machine]);

  useEffect(() => {
    fetchSlots();
    setSelectedSlots([]);
  }, [date, ballType]);

  const fetchSlots = async () => {
    try {
      setLoading(true);
      const data = await bookingApi.getSlots(date, ballType);
      setSlots(data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load slots' });
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSlots.length === 0 || !playerName) return;

    try {
      setLoading(true);

      // Book all selected slots
      await Promise.all(selectedSlots.map(slotStartTime =>
        bookingApi.createBooking({
          startTime: slotStartTime,
          durationMinutes: 30, // Default duration per slot
          ballType,
          playerName,
        })
      ));

      setMessage({ type: 'success', text: `Successfully booked ${selectedSlots.length} slot(s)!` });
      setSelectedSlots([]);
      setPlayerName('');
      fetchSlots();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Booking failed' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSlot = (startTime: string) => {
    setSelectedSlots(prev =>
      prev.includes(startTime)
        ? prev.filter(s => s !== startTime)
        : [...prev, startTime]
    );
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white/[0.04] backdrop-blur-sm rounded-2xl border border-white/[0.08] text-foreground">
      <h2 className="text-2xl font-bold mb-6 text-white">Book a Net Session</h2>

      <div className="mb-4">
        <label className="block text-xs font-medium text-accent mb-1 uppercase tracking-wider">Select Date</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full p-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white outline-none focus:border-accent transition-all"
          min={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div className="mb-6">
        <label className="block text-xs font-medium text-accent mb-2 uppercase tracking-wider">Available Slots (30 min)</label>
        {loading ? (
          <p className="text-slate-400 text-sm">Loading slots...</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((slot) => (
              <button
                key={slot.startTime}
                type="button"
                disabled={slot.status !== 'Available'}
                onClick={() => toggleSlot(slot.startTime)}
                className={`p-2 text-sm rounded-xl transition-all cursor-pointer ${selectedSlots.includes(slot.startTime)
                    ? 'bg-accent text-primary font-semibold border border-accent'
                    : slot.status === 'Available'
                      ? 'bg-white/[0.04] border border-white/[0.08] text-white hover:border-accent/30'
                      : 'bg-white/[0.02] text-slate-600 cursor-not-allowed border border-white/[0.04]'
                  }`}
              >
                {new Date(slot.startTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
              </button>
            ))}
          </div>
        )}
      </div>

      <form onSubmit={handleBooking}>
        <div className="mb-4">
          <label className="block text-xs font-medium text-accent mb-1 uppercase tracking-wider">Player Name</label>
          <input
            type="text"
            required
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full p-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white placeholder-slate-500 outline-none focus:border-accent transition-all"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-accent mb-1 uppercase tracking-wider">Select Machine</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMachine('B')}
              className={`p-2.5 text-sm rounded-xl transition-all cursor-pointer ${machine === 'B' ? 'bg-accent text-primary font-semibold border border-accent' : 'bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:border-accent/30'
                }`}
            >
              Machine B (Tennis)
            </button>
            <button
              type="button"
              onClick={() => setMachine('A')}
              className={`p-2.5 text-sm rounded-xl transition-all cursor-pointer ${machine === 'A' ? 'bg-accent text-primary font-semibold border border-accent' : 'bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:border-accent/30'
                }`}
            >
              Machine A (Leather)
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-medium text-accent mb-1 uppercase tracking-wider">Ball Type</label>
          <select
            value={ballType}
            onChange={(e) => setBallType(e.target.value as BallType)}
            className="w-full p-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-white outline-none focus:border-accent appearance-none transition-all"
          >
            {machine === 'B' ? (
              <option value="TENNIS" className="bg-[#0f1d2f]">Tennis Ball</option>
            ) : (
              <>
                <option value="LEATHER" className="bg-[#0f1d2f]">Leather Ball</option>
                <option value="MACHINE" className="bg-[#0f1d2f]">Bowling Machine Ball</option>
              </>
            )}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading || selectedSlots.length === 0}
          className={`w-full p-3 font-bold rounded-xl transition-all cursor-pointer ${loading || selectedSlots.length === 0
              ? 'bg-white/[0.06] text-slate-500 cursor-not-allowed'
              : 'bg-accent hover:bg-accent-light text-primary active:scale-[0.98]'
            }`}
        >
          {loading ? 'Processing...' : `Confirm Booking (${selectedSlots.length} slots)`}
        </button>
      </form>

      {message && (
        <div className={`mt-4 p-3 rounded-xl text-sm ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}
