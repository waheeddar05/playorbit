'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Menu, X, Calendar, ClipboardList, Shield, LogOut, LogIn, Package, Bell } from 'lucide-react';

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch unread notification count
  useEffect(() => {
    if (!session) return;
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/notifications');
        if (res.ok) {
          const data = await res.json();
          const count = Array.isArray(data) ? data.filter((n: { isRead: boolean }) => !n.isRead).length : 0;
          setUnreadCount(count);
        }
      } catch { /* silently fail */ }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, [session]);

  // Close menu on route change
  useEffect(() => {
    setIsMenuOpen(false);
    setIsClosing(false);
  }, [pathname]);

  // Prevent scrolling when drawer is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  const closeMenu = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsMenuOpen(false);
      setIsClosing(false);
    }, 250);
  };

  const toggleMenu = () => {
    if (isMenuOpen) {
      closeMenu();
    } else {
      setIsMenuOpen(true);
    }
  };

  const navLinks = [
    { href: '/slots', label: 'Book Slots', icon: Calendar, show: !!session },
    { href: '/bookings', label: 'My Bookings', icon: ClipboardList, show: !!session },
    { href: '/packages', label: 'Packages', icon: Package, show: !!session },
    { href: '/notifications', label: 'Notifications', icon: Bell, show: !!session, badge: unreadCount },
    { href: '/admin', label: 'Admin', icon: Shield, show: session?.user?.role === 'ADMIN' },
  ].filter(link => link.show);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const userImage = session?.user?.image;
  const userName = session?.user?.name;
  const userInitial = userName ? userName.charAt(0).toUpperCase() : (session?.user?.email?.charAt(0).toUpperCase() || '?');

  return (
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#0f1d2f]/95 backdrop-blur-md shadow-lg shadow-black/20' : 'bg-transparent'
      }`}>
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex justify-between h-14 md:h-16 items-center">
          {/* Logo */}
          <Link href={session ? '/slots' : '/'} className="flex items-center group">
            <Image
              src="/images/playorbit-logo.jpeg"
              alt="PlayOrbit"
              width={320}
              height={96}
              priority
              className="h-20 md:h-24 w-auto object-contain flex-shrink-0 drop-shadow-[0_0_8px_rgba(100,140,255,0.3)] mix-blend-screen"
            />
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon, badge }) => (
              <Link
                key={href}
                href={href}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${isActive(href)
                    ? 'bg-white/15 text-accent'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                {/* Active indicator dot */}
                {isActive(href) && (
                  <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-accent" />
                )}
                {/* Notification badge */}
                {badge != null && badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </Link>
            ))}

            {session ? (
              <div className="flex items-center ml-2 pl-2 border-l border-white/10">
                <div className="flex items-center gap-2 mr-3">
                  {userImage ? (
                    <Image
                      src={userImage}
                      alt={userName || 'Profile'}
                      width={28}
                      height={28}
                      className="rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-accent text-primary">
                      {userInitial}
                    </div>
                  )}
                  <span className="text-xs font-medium max-w-[120px] truncate text-white/60">
                    {session.user?.name || session.user?.email}
                  </span>
                </div>
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer text-white/70 hover:text-red-400 hover:bg-white/10"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            ) : pathname !== '/' && (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all bg-accent text-primary hover:bg-accent-light"
              >
                <LogIn className="w-4 h-4" />
                Login
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={toggleMenu}
            className="md:hidden p-2 rounded-lg transition-colors cursor-pointer text-white/80 hover:bg-white/10 relative"
          >
            {isMenuOpen && !isClosing ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            {/* Mobile notification badge on hamburger */}
            {!isMenuOpen && unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Drawer - Slide from Right */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 top-0">
          {/* Backdrop overlay */}
          <div
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-250 ${isClosing ? 'opacity-0' : 'opacity-100'
              }`}
            onClick={closeMenu}
          />

          {/* Drawer panel */}
          <div
            className={`absolute top-0 right-0 bottom-0 w-72 bg-[#0f1d2f]/98 backdrop-blur-xl border-l border-white/[0.08] shadow-2xl shadow-black/40 ${isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'
              }`}
          >
            {/* Close button */}
            <div className="flex justify-end px-4 pt-4">
              <button
                onClick={closeMenu}
                className="p-2 rounded-lg text-white/60 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 pb-6 pt-2 flex flex-col h-[calc(100%-56px)]">
              {/* User Profile Section */}
              {session && (
                <div className="flex items-center gap-3 px-3 py-3 mb-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                  {userImage ? (
                    <Image
                      src={userImage}
                      alt={userName || 'Profile'}
                      width={40}
                      height={40}
                      className="rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-accent text-primary ring-2 ring-accent/30">
                      {userInitial}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{session.user?.name || 'User'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{session.user?.email}</p>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <div className="space-y-1 flex-1">
                {navLinks.map(({ href, label, icon: Icon, badge }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={closeMenu}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${isActive(href)
                        ? 'bg-accent/15 text-accent border-l-2 border-accent'
                        : 'text-white/70 hover:bg-white/[0.05]'
                      }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="flex-1">{label}</span>
                    {/* Notification badge */}
                    {badge != null && badge > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>

              {/* Bottom Section */}
              <div className="pt-4 border-t border-white/[0.06]">
                {session ? (
                  <button
                    onClick={() => { closeMenu(); signOut({ callbackUrl: '/login' }); }}
                    className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer text-red-400 hover:bg-red-500/10"
                  >
                    <LogOut className="w-5 h-5" />
                    Logout
                  </button>
                ) : pathname !== '/' && (
                  <Link
                    href="/login"
                    onClick={closeMenu}
                    className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all bg-accent text-primary"
                  >
                    <LogIn className="w-5 h-5" />
                    Login
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
