'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface Plan {
  id: string;
  name: string;
  sessionsPerMonth: number;
  price: number;
  isActive: boolean;
}

interface Subscription {
  id: string;
  planId: string;
  sessionsRemaining: number;
  monthYear: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
  createdAt: string;
  expiresAt: string;
  plan: Plan;
  _count: {
    bookings: number;
  };
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [activeSubscription, setActiveSubscription] = useState<Subscription | null>(null);
  const [currentMonthYear, setCurrentMonthYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subscribingPlanId, setSubscribingPlanId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [plansRes, subscriptionsRes] = await Promise.all([
        fetch('/api/plans'),
        fetch('/api/subscriptions'),
      ]);

      if (!plansRes.ok) throw new Error('Failed to fetch plans');
      if (!subscriptionsRes.ok) throw new Error('Failed to fetch subscriptions');

      const plansData = await plansRes.json();
      const subscriptionsData = await subscriptionsRes.json();

      setPlans(plansData);
      setSubscriptions(subscriptionsData.subscriptions);
      setActiveSubscription(subscriptionsData.activeSubscription);
      setCurrentMonthYear(subscriptionsData.currentMonthYear);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    if (!confirm('Are you sure you want to subscribe to this plan?')) return;

    setSubscribingPlanId(planId);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Subscription failed');
      }

      alert('Subscription successful!');
      fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubscribingPlanId(null);
    }
  };

  const formatMonthYear = (monthYear: string) => {
    const [year, month] = monthYear.split('-');
    return format(new Date(parseInt(year), parseInt(month) - 1), 'MMMM yyyy');
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Monthly Plans</h1>
        <div className="text-center py-12">Loading plans...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Monthly Plans</h1>
        <div className="text-red-600 text-center py-12">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8">Monthly Plans</h1>

      {/* Current Subscription Status */}
      {activeSubscription ? (
        <div className="mb-8 p-6 bg-green-50 border border-green-200 rounded-lg">
          <h2 className="text-lg font-semibold text-green-800 mb-2">Active Subscription</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Plan</p>
              <p className="font-semibold">{activeSubscription.plan.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Sessions Remaining</p>
              <p className="font-semibold text-2xl text-green-700">
                {activeSubscription.sessionsRemaining} / {activeSubscription.plan.sessionsPerMonth}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Valid For</p>
              <p className="font-semibold">{formatMonthYear(activeSubscription.monthYear)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Expires</p>
              <p className="font-semibold">
                {format(new Date(activeSubscription.expiresAt), 'MMM d, yyyy')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">No Active Subscription</h2>
          <p className="text-gray-600">
            Subscribe to a monthly plan to get discounted sessions. Plans reset at the end of each month.
          </p>
        </div>
      )}

      {/* Available Plans */}
      <h2 className="text-xl font-semibold mb-4">Available Plans</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
        {plans.map((plan) => {
          const hasActiveForPlan = subscriptions.some(
            s => s.planId === plan.id && s.monthYear === currentMonthYear && s.status === 'ACTIVE'
          );

          return (
            <div
              key={plan.id}
              className="p-6 bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <h3 className="text-lg font-bold mb-2">{plan.name}</h3>
              <div className="text-3xl font-bold text-blue-600 mb-4">
                {plan.sessionsPerMonth} <span className="text-base font-normal text-gray-500">sessions/month</span>
              </div>
              {plan.price > 0 && (
                <p className="text-gray-600 mb-4">Rs. {plan.price.toFixed(0)}</p>
              )}
              <button
                onClick={() => handleSubscribe(plan.id)}
                disabled={hasActiveForPlan || subscribingPlanId === plan.id}
                className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                  hasActiveForPlan
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {subscribingPlanId === plan.id
                  ? 'Subscribing...'
                  : hasActiveForPlan
                  ? 'Already Subscribed'
                  : 'Subscribe'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Subscription History */}
      {subscriptions.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-4">Subscription History</h2>
          <div className="space-y-4">
            {subscriptions.map((subscription) => (
              <div
                key={subscription.id}
                className="p-4 bg-white border rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
              >
                <div>
                  <div className="font-semibold">{subscription.plan.name}</div>
                  <div className="text-sm text-gray-500">
                    {formatMonthYear(subscription.monthYear)}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Sessions used: {subscription.plan.sessionsPerMonth - subscription.sessionsRemaining} / {subscription.plan.sessionsPerMonth}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      subscription.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : subscription.status === 'EXPIRED'
                        ? 'bg-gray-100 text-gray-600'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {subscription.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
