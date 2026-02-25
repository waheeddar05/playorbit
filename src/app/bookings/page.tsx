'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ClipboardList, Loader2, X, Calendar, Clock, IndianRupee, Phone, Instagram } from 'lucide-react';
import { BookingSkeleton } from '@/components/ui/LoadingState';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import Link from 'next/link';

interface Booking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'BOOKED' | 'CANCELLED' | 'DONE';
  playerName: string;
  ballType: string;
  pitchType: string | null;
  price: number | null;
  originalPrice: number | null;
  discountAmount: number | null;
  extraCharge: number | null;
  operationMode: 'WITH_OPERATOR' | 'SELF_OPERATE';
  cancelledBy: string | null;
  machineId: string | null;
  createdAt: string | null;
  isPackageBooking: boolean;
}

type TabFilter = 'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED';

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const toast = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/bookings');
      if (!res.ok) throw new Error('Failed to fetch bookings');
      const data = await res.json();
      setBookings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (bookingId: string) => {
    const confirmed = await confirm({
      title: 'Cancel Booking',
      message: 'Are you sure you want to cancel this booking? This action cannot be undone.',
      confirmLabel: 'Yes, Cancel',
      cancelLabel: 'Keep Booking',
      variant: 'danger',
    });
    if (!confirmed) return;

    setCancellingId(bookingId);
    try {
      const res = await fetch('/api/slots/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Cancellation failed');
      }

      toast.success('Booking Cancelled', 'Your booking has been cancelled successfully.');
      fetchBookings();
    } catch (err) {
      toast.error('Cancellation Failed', err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setCancellingId(null);
    }
  };

  const statusConfig = {
    BOOKED: { label: 'Upcoming', bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-500', border: 'border-l-green-500' },
    DONE: { label: 'Completed', bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500', border: 'border-l-blue-500' },
    CANCELLED: { label: 'Cancelled', bg: 'bg-white/[0.04]', text: 'text-slate-400', dot: 'bg-slate-500', border: 'border-l-slate-500' },
  };

  const ballTypeConfig: Record<string, { color: string; label: string }> = {
    TENNIS: { color: 'bg-green-500', label: 'Tennis' },
    LEATHER: { color: 'bg-red-500', label: 'Leather' },
    MACHINE: { color: 'bg-blue-500', label: 'Machine' },
  };

  const machineLabels: Record<string, string> = {
    GRAVITY: 'Gravity',
    YANTRA: 'Yantra',
    LEVERAGE_INDOOR: 'Leverage Indoor',
    LEVERAGE_OUTDOOR: 'Leverage Outdoor',
  };

  const pitchLabels: Record<string, string> = {
    ASTRO: 'Astro Turf',
    CEMENT: 'Cement',
    NATURAL: 'Natural Turf',
  };

  const getDisplayStatus = (booking: Booking): Booking['status'] => {
    if (booking.status !== 'BOOKED') return booking.status;
    return new Date(booking.endTime).getTime() <= Date.now() ? 'DONE' : 'BOOKED';
  };

  // ─── Filter bookings by tab ────────────────────────────
  const filteredBookings = bookings.filter(booking => {
    const displayStatus = getDisplayStatus(booking);
    switch (activeTab) {
      case 'UPCOMING': return displayStatus === 'BOOKED';
      case 'COMPLETED': return displayStatus === 'DONE';
      case 'CANCELLED': return displayStatus === 'CANCELLED';
      default: return true;
    }
  });

  const tabs: { key: TabFilter; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: bookings.length },
    { key: 'UPCOMING', label: 'Upcoming', count: bookings.filter(b => getDisplayStatus(b) === 'BOOKED').length },
    { key: 'COMPLETED', label: 'Completed', count: bookings.filter(b => getDisplayStatus(b) === 'DONE').length },
    { key: 'CANCELLED', label: 'Cancelled', count: bookings.filter(b => getDisplayStatus(b) === 'CANCELLED').length },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      {/* Background gradient */}
      <div className="fixed inset-0 -z-10 bg-gradient-to-br from-[#0a1628] via-[#132240] to-[#0d1f3c]"></div>
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(212,168,67,0.05),transparent_60%)]"></div>

      {/* Page Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
          <ClipboardList className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">My Bookings</h1>
          <p className="text-xs text-slate-400">{bookings.length} total session{bookings.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Tab Filters */}
      {!loading && bookings.length > 0 && (
        <div className="flex gap-1 mb-5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === tab.key
                  ? 'bg-accent text-primary shadow-sm shadow-accent/20'
                  : 'bg-white/[0.04] text-slate-400 border border-white/[0.08] hover:border-accent/20'
                }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 text-[10px] ${activeTab === tab.key ? 'text-primary/70' : 'text-slate-500'
                  }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <BookingSkeleton />
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={fetchBookings} className="mt-3 text-sm text-accent font-medium cursor-pointer">Try again</button>
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="w-6 h-6 text-slate-500" />
          </div>
          {activeTab === 'ALL' && bookings.length === 0 ? (
            <>
              <p className="text-sm font-medium text-slate-300 mb-1">No bookings yet</p>
              <p className="text-xs text-slate-500 mb-4">Book your first practice session to get started</p>
              <Link
                href="/slots"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-primary rounded-xl font-semibold text-sm hover:bg-accent-light transition-all"
              >
                Book Your First Session →
              </Link>
            </>
          ) : (
            <p className="text-sm font-medium text-slate-300">No {activeTab.toLowerCase()} bookings</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Motivational quote banner */}
          <div className="py-3 px-4 rounded-xl bg-gradient-to-r from-accent/5 via-accent/10 to-accent/5 border border-accent/10 mb-1">
            <p className="text-center text-xs md:text-sm font-semibold text-accent italic">
              &ldquo;Sweat in Practice. Shine in Matches.&rdquo;
            </p>
          </div>

          {filteredBookings.map((booking) => {
            const displayStatus = getDisplayStatus(booking);
            const status = statusConfig[displayStatus];
            const ballInfo = ballTypeConfig[booking.ballType] || { color: 'bg-gray-400', label: booking.ballType };
            const canCancel = booking.status === 'BOOKED' && new Date(booking.startTime) > new Date();
            const hasDiscount = booking.discountAmount && booking.discountAmount > 0;

            return (
              <div
                key={booking.id}
                className={`bg-white/[0.04] backdrop-blur-sm rounded-xl border border-white/[0.08] border-l-[3px] ${status.border} p-4 transition-all hover:bg-white/[0.06]`}
              >
                {/* Top Row: Status + Cancel */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${status.bg} ${status.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`}></span>
                      {status.label}
                    </div>
                    {booking.status === 'CANCELLED' && booking.cancelledBy && (
                      <span className="text-[10px] text-red-400/70 italic">by {booking.cancelledBy}</span>
                    )}
                  </div>
                  {canCancel && (
                    <button
                      disabled={!!cancellingId}
                      onClick={() => handleCancel(booking.id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      {cancellingId === booking.id ? 'Cancelling...' : 'Cancel'}
                    </button>
                  )}
                </div>

                {/* Time */}
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <span className="text-base font-bold text-white">
                    {new Date(booking.startTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                    {' - '}
                    {new Date(booking.endTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {/* Date */}
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="text-sm text-slate-300">
                    {format(new Date(booking.date), 'EEEE, MMM d, yyyy')}
                  </span>
                </div>

                {/* Booking Details */}
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-white/[0.06] mb-2">
                  {booking.machineId && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300 font-medium">
                      {machineLabels[booking.machineId] || booking.machineId}
                    </span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${booking.ballType === 'LEATHER' ? 'bg-red-500/10 text-red-400' :
                      booking.ballType === 'TENNIS' ? 'bg-green-500/10 text-green-400' :
                        'bg-blue-500/10 text-blue-400'
                    }`}>
                    {ballInfo.label}
                  </span>
                  {booking.pitchType && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-300 font-medium">
                      {pitchLabels[booking.pitchType] || booking.pitchType}
                    </span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${booking.operationMode === 'SELF_OPERATE' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>
                    {booking.operationMode === 'SELF_OPERATE' ? 'Self Operate' : 'With Operator'}
                  </span>
                  {booking.isPackageBooking && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-medium">
                      Package
                    </span>
                  )}
                </div>

                {/* Player + Price Row */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400 truncate">{booking.playerName}</span>
                  {booking.price != null && (
                    <div className="flex items-center gap-1 shrink-0">
                      <IndianRupee className="w-3 h-3 text-slate-500" />
                      <span className="text-sm font-semibold text-white">{booking.price}</span>
                      {hasDiscount && (
                        <span className="text-[10px] text-green-400 line-through ml-1">₹{booking.originalPrice}</span>
                      )}
                      {booking.extraCharge != null && booking.extraCharge > 0 && (
                        <span className="text-[10px] text-amber-400 ml-1">+₹{booking.extraCharge}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Booked on */}
                {booking.createdAt && (
                  <div className="mt-2 pt-2 border-t border-white/[0.04]">
                    <span className="text-[10px] text-slate-500">
                      Booked on {format(new Date(booking.createdAt), 'MMM d, yyyy')} at {new Date(booking.createdAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Contact Section */}
      <div className="mt-8 pt-6 border-t border-white/[0.06]">
        <p className="text-center text-xs text-slate-500 mb-4 italic">&ldquo;Champions Train When Others Rest.&rdquo;</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-slate-400">
          <a href="tel:7058683664" className="flex items-center gap-1.5 hover:text-accent transition-colors">
            <Phone className="w-3.5 h-3.5" />
            Pratyush: 7058683664
          </a>
          <a href="tel:7774077995" className="flex items-center gap-1.5 hover:text-accent transition-colors">
            <Phone className="w-3.5 h-3.5" />
            Rahul: 7774077995
          </a>
          <a
            href="https://www.instagram.com/ankeetbawanecricketacademy?igsh=MWFvd2p0MzlrOWQ1Mg%3D%3D"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-accent transition-colors"
          >
            <Instagram className="w-3.5 h-3.5" />
            @ankeetbawanecricketacademy
          </a>
        </div>
      </div>
    </div>
  );
}
