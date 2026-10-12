'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Calendar, ClipboardList, Package, Wallet, Bell, Zap, UserCog, ShoppingBag, UserRound, MapPin, LayoutGrid, X, ChevronRight } from 'lucide-react';
import { useCurrentUser } from '@/lib/current-user';
import { useCenter } from '@/lib/center-context';
import { useMarketplaceStatus } from '@/lib/marketplace-status';
import { PROFILE_PATH, SHOP_PATH, STORE_NAV_LABEL } from '@/lib/marketplace';

interface Tab {
  href: string;
  label: string;
  icon: typeof Calendar;
  /** Pre-launch marker — an amber dot on the icon, the phone's "Pre-book" pill. */
  soon?: boolean;
}

interface MoreItem extends Tab {
  description: string;
}

/**
 * The bottom bar holds at most five tabs: Book Slot, Bookings, Packages,
 * Store and More. Everything else lives behind More.
 *
 * Add a new user-mode destination to `moreItems` below, never as a tab:
 * the bar had grown to eight tabs at 9px labels before this split.
 */
const primaryTabs: Tab[] = [
  { href: '/slots', label: 'Book Slot', icon: Calendar },
  { href: '/bookings', label: 'Bookings', icon: ClipboardList },
  { href: '/packages', label: 'Packages', icon: Package },
];

// The store sits after Packages. It is per center, so a center that has it
// switched off shows no tab at all.
const shopTab: Tab = { href: SHOP_PATH, label: STORE_NAV_LABEL, icon: ShoppingBag };

const accountItems: MoreItem[] = [
  { href: PROFILE_PATH, label: 'My Profile', icon: UserRound, description: 'Name, email and delivery addresses' },
  { href: '/wallet', label: 'Wallet', icon: Wallet, description: 'Balance and transactions' },
  { href: '/notifications', label: 'Alerts', icon: Bell, description: 'Booking and payment notifications' },
  { href: '/centers', label: 'All Centers', icon: MapPin, description: 'Locations, addresses and directions' },
];

// Sidearm specialists and coaches manage their own availability from here.
const sidearmItem: MoreItem = { href: '/sidearm', label: 'Sidearm', icon: Zap, description: 'Your sidearm availability' };
const coachItem: MoreItem = { href: '/coach', label: 'Coach', icon: UserCog, description: 'Your coaching availability' };

export default function BottomNav() {
  // One shared profile read instead of this component's own
  // /api/user/profile fetch — see @/lib/current-user.
  const { user } = useCurrentUser();
  const { isSidearmSpecialistAtCurrentCenter, isCoachAtCurrentCenter } = useCenter();
  const { enabled: shopEnabled, comingSoon: shopComingSoon, loading: shopLoading } = useMarketplaceStatus();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the sheet on navigation (including the browser back button).
  const [sheetPath, setSheetPath] = useState(pathname);
  if (sheetPath !== pathname) {
    setSheetPath(pathname);
    setMoreOpen(false);
  }

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const isLoggedIn = !!user;

  // Only show for logged-in users, hide on landing/login/admin pages
  if (!isLoggedIn) return null;
  if (pathname === '/' || pathname === '/login' || pathname === '/otp') return null;
  if (pathname.startsWith('/admin')) return null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  // The dot only once the status is known — the optimistic default would
  // flash it on a live store for a beat and then pull it.
  const tabs: Tab[] = [
    ...primaryTabs,
    ...(shopEnabled ? [{ ...shopTab, soon: !shopLoading && shopComingSoon }] : []),
  ];

  // Role-specific items only for staff who hold that role at the current
  // center. A user who is both gets both.
  const moreItems: MoreItem[] = [
    ...accountItems,
    ...(isSidearmSpecialistAtCurrentCenter ? [sidearmItem] : []),
    ...(isCoachAtCurrentCenter ? [coachItem] : []),
  ];
  const moreActive = moreOpen || moreItems.some(({ href }) => isActive(href));

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <div className="bg-[#0a1628]/90 backdrop-blur-xl border-t border-white/[0.08]">
          <div className="flex items-center justify-around h-[60px]">
            {tabs.map(({ href, label, icon: Icon, soon }) => {
              const active = !moreOpen && isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 h-full relative overflow-hidden transition-colors ${
                    active ? 'text-accent' : 'text-slate-400'
                  }`}
                >
                  {active && (
                    <span className="absolute top-1 w-1 h-1 rounded-full bg-accent" />
                  )}
                  <span className="relative">
                    <Icon className={`w-5 h-5 ${active ? 'text-accent' : 'text-slate-400'}`} />
                    {soon && (
                      <span
                        className="absolute -top-0.5 -right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#0a1628]"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span className={`text-[10px] mt-0.5 font-medium whitespace-nowrap ${active ? 'text-accent' : 'text-slate-400'}`}>
                    {label}
                    {soon && <span className="sr-only"> (pre-booking open)</span>}
                  </span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              aria-controls="bottom-nav-more"
              className={`flex flex-col items-center justify-center flex-1 min-w-0 px-0.5 h-full relative overflow-hidden transition-colors cursor-pointer ${
                moreActive ? 'text-accent' : 'text-slate-400'
              }`}
            >
              {moreActive && (
                <span className="absolute top-1 w-1 h-1 rounded-full bg-accent" />
              )}
              <LayoutGrid className={`w-5 h-5 ${moreActive ? 'text-accent' : 'text-slate-400'}`} />
              <span className={`text-[10px] mt-0.5 font-medium whitespace-nowrap ${moreActive ? 'text-accent' : 'text-slate-400'}`}>
                More
              </span>
            </button>
          </div>
          {/* Safe area padding for iOS */}
          <div className="safe-bottom" />
        </div>
      </nav>

      {/* Outside <nav>: its backdrop-filter would trap a fixed-position overlay. */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-labelledby="bottom-nav-more-title">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-default animate-in fade-in duration-200"
          />
          <div
            id="bottom-nav-more"
            className="absolute left-0 right-0 bottom-[60px] mb-[env(safe-area-inset-bottom)] rounded-t-2xl bg-[#0b1726] border-t border-x border-white/[0.10] shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200"
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 id="bottom-nav-more-title" className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                More
              </h2>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close"
                className="p-1.5 -mr-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="px-2 pb-3 max-h-[60vh] overflow-y-auto">
              {moreItems.map(({ href, label, icon: Icon, description }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                        active ? 'bg-accent/10' : 'hover:bg-white/[0.04] active:bg-white/[0.06]'
                      }`}
                    >
                      <span className={`flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 ${
                        active ? 'bg-accent/20 text-accent' : 'bg-white/[0.05] text-slate-300'
                      }`}>
                        <Icon className="w-[18px] h-[18px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm font-semibold ${active ? 'text-accent' : 'text-white'}`}>{label}</span>
                        <span className="block text-[11px] text-slate-500 truncate">{description}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
