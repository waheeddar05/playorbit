'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface Plan {
  id: string;
  name: string;
  sessionsPerMonth: number;
}

interface User {
  id: string;
  name: string | null;
  email: string | null;
  mobileNumber: string | null;
}

interface Subscription {
  id: string;
  userId: string;
  planId: string;
  sessionsRemaining: number;
  monthYear: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
  expiresAt: string;
  user: User;
  plan: Plan;
  _count: {
    bookings: number;
  };
}

export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Filter state
  const [statusFilter, setStatusFilter] = useState('');

  // Form state for assigning subscription
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    userEmail: '',
    planId: '',
    sessionsOverride: '',
  });
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);

      const res = await fetch(`/api/admin/subscriptions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSubscriptions(data);
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/admin/plans');
      if (res.ok) {
        const data = await res.json();
        setPlans(data);
      }
    } catch (error) {
      console.error('Failed to fetch plans', error);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
    fetchPlans();
  }, [statusFilter]);

  const searchUsers = async (email: string) => {
    if (!email || email.length < 2) {
      setUserSearchResults([]);
      return;
    }

    setSearchingUsers(true);
    try {
      // Search for users by email (using admin bookings endpoint which returns user info)
      const res = await fetch(`/api/admin/bookings?customerName=${encodeURIComponent(email)}`);
      if (res.ok) {
        const bookings = await res.json();
        // Extract unique users from bookings
        const usersMap = new Map<string, User>();
        bookings.forEach((booking: any) => {
          if (booking.user && !usersMap.has(booking.user.id)) {
            usersMap.set(booking.user.id, booking.user);
          }
        });
        setUserSearchResults(Array.from(usersMap.values()));
      }
    } catch (error) {
      console.error('Failed to search users', error);
    } finally {
      setSearchingUsers(false);
    }
  };

  const resetForm = () => {
    setFormData({ userEmail: '', planId: '', sessionsOverride: '' });
    setSelectedUser(null);
    setUserSearchResults([]);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (!selectedUser) {
      setMessage({ text: 'Please select a user', type: 'error' });
      return;
    }

    if (!formData.planId) {
      setMessage({ text: 'Please select a plan', type: 'error' });
      return;
    }

    try {
      const body: any = {
        userId: selectedUser.id,
        planId: formData.planId,
      };

      if (formData.sessionsOverride) {
        body.sessionsOverride = parseInt(formData.sessionsOverride);
      }

      const res = await fetch('/api/admin/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ text: 'Subscription assigned successfully', type: 'success' });
        resetForm();
        fetchSubscriptions();
      } else {
        setMessage({ text: data.error || 'Failed to assign subscription', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'Internal server error', type: 'error' });
    }
  };

  const handleUpdateSessions = async (subscription: Subscription, newSessions: number) => {
    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: subscription.id, sessionsRemaining: newSessions }),
      });

      if (res.ok) {
        fetchSubscriptions();
      }
    } catch (error) {
      console.error('Failed to update sessions', error);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this subscription?')) return;

    try {
      const res = await fetch('/api/admin/subscriptions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setMessage({ text: 'Subscription cancelled', type: 'success' });
        fetchSubscriptions();
      }
    } catch (error) {
      setMessage({ text: 'Failed to cancel subscription', type: 'error' });
    }
  };

  const formatMonthYear = (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    return format(new Date(parseInt(year), parseInt(month) - 1), 'MMM yyyy');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Manage Subscriptions</h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
        >
          + Assign Plan
        </button>
      </div>

      {message.text && (
        <div
          className={`mb-4 p-3 rounded ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Assign Plan to User</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search User (by name/email)
                </label>
                {selectedUser ? (
                  <div className="flex items-center gap-2 p-2 border rounded bg-blue-50">
                    <span className="flex-1">
                      {selectedUser.name || selectedUser.email || selectedUser.mobileNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedUser(null);
                        setFormData({ ...formData, userEmail: '' });
                      }}
                      className="text-red-500 hover:text-red-700"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={formData.userEmail}
                      onChange={(e) => {
                        setFormData({ ...formData, userEmail: e.target.value });
                        searchUsers(e.target.value);
                      }}
                      placeholder="Type to search..."
                      className="w-full border rounded px-3 py-2"
                    />
                    {searchingUsers && (
                      <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-white border rounded shadow text-sm text-gray-500">
                        Searching...
                      </div>
                    )}
                    {userSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow max-h-48 overflow-auto z-10">
                        {userSearchResults.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              setSelectedUser(user);
                              setUserSearchResults([]);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b last:border-b-0"
                          >
                            <div className="font-medium">{user.name || 'No name'}</div>
                            <div className="text-sm text-gray-500">
                              {user.email || user.mobileNumber}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select
                  value={formData.planId}
                  onChange={(e) => setFormData({ ...formData, planId: e.target.value })}
                  required
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">Select a plan</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.name} ({plan.sessionsPerMonth} sessions)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sessions Override (optional)
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.sessionsOverride}
                  onChange={(e) => setFormData({ ...formData, sessionsOverride: e.target.value })}
                  placeholder="Leave empty for plan default"
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded transition-colors"
              >
                Assign Plan
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-6 py-2 rounded transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="EXPIRED">Expired</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">User</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Plan</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Month</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Sessions</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Bookings</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  Loading subscriptions...
                </td>
              </tr>
            ) : subscriptions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                  No subscriptions found.
                </td>
              </tr>
            ) : (
              subscriptions.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm">
                    <div className="font-medium text-gray-900">
                      {sub.user.name || 'No name'}
                    </div>
                    <div className="text-gray-500 text-xs">
                      {sub.user.email || sub.user.mobileNumber}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{sub.plan.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {formatMonthYear(sub.monthYear)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateSessions(sub, Math.max(0, sub.sessionsRemaining - 1))}
                        disabled={sub.status !== 'ACTIVE'}
                        className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                      >
                        -
                      </button>
                      <span className="font-semibold">
                        {sub.sessionsRemaining} / {sub.plan.sessionsPerMonth}
                      </span>
                      <button
                        onClick={() => handleUpdateSessions(sub, sub.sessionsRemaining + 1)}
                        disabled={sub.status !== 'ACTIVE'}
                        className="w-6 h-6 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{sub._count.bookings}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        sub.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : sub.status === 'EXPIRED'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    {sub.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleCancel(sub.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
