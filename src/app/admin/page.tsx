'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { CalendarCheck, Users, Activity, UserPlus, CalendarDays, Settings } from 'lucide-react';

interface Stats {
  totalBookings: number;
  activeAdmins: number;
  systemStatus: string;
}

export default function AdminDashboard() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = session?.user?.email === 'waheeddar8@gmail.com';

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/admin/stats');
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const statCards = [
    {
      label: 'Total Bookings',
      value: stats?.totalBookings ?? 0,
      icon: CalendarCheck,
      color: 'text-primary',
      bg: 'bg-primary/5',
    },
    {
      label: 'Active Admins',
      value: stats?.activeAdmins ?? 0,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'System Status',
      value: stats?.systemStatus ?? 'Healthy',
      icon: Activity,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-5">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div>
                <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{card.label}</p>
                <p className={`text-xl font-bold ${card.label === 'System Status' ? card.color : 'text-gray-900'}`}>
                  {loading ? '...' : card.value}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          {isSuperAdmin && (
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-light transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Invite Admin
            </Link>
          )}
          <Link
            href="/admin/bookings"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <CalendarDays className="w-4 h-4" />
            View Bookings
          </Link>
          <Link
            href="/admin/policies"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Manage Policies
          </Link>
        </div>
      </div>
    </div>
  );
}
