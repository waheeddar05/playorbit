'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Pencil, Trash2, Loader2, HelpCircle } from 'lucide-react';

export default function PolicyManagement() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPolicy, setNewPolicy] = useState({ key: '', value: '' });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [showHelp, setShowHelp] = useState(false);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/policies');
      if (res.ok) {
        const data = await res.json();
        setPolicies(data);
      }
    } catch (error) {
      console.error('Failed to fetch policies', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPolicies();
  }, []);

  const handleUpdatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage({ text: '', type: '' });
    try {
      const res = await fetch('/api/admin/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPolicy),
      });
      if (res.ok) {
        setMessage({ text: 'Policy saved successfully', type: 'success' });
        setNewPolicy({ key: '', value: '' });
        fetchPolicies();
      } else {
        const data = await res.json();
        setMessage({ text: data.error || 'Failed to update policy', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'Internal server error', type: 'error' });
    }
  };

  const handleDeletePolicy = async (key: string) => {
    if (!confirm(`Delete policy "${key}"?`)) return;
    setMessage({ text: '', type: '' });
    try {
      const res = await fetch(`/api/admin/policies?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setMessage({ text: 'Policy deleted', type: 'success' });
        fetchPolicies();
      } else {
        const data = await res.json();
        setMessage({ text: data.error || 'Failed to delete policy', type: 'error' });
      }
    } catch (error) {
      setMessage({ text: 'Internal server error', type: 'error' });
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900">Policies</h1>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          Help
        </button>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-5 text-sm">
          <h3 className="font-semibold text-blue-900 mb-2">Available Policy Keys</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-blue-800">
            <div>
              <p className="font-medium mb-1">Timing:</p>
              <ul className="space-y-1 text-xs">
                <li><code className="bg-blue-100 px-1.5 py-0.5 rounded">SLOT_WINDOW_START</code> - Start hour (e.g. 7)</li>
                <li><code className="bg-blue-100 px-1.5 py-0.5 rounded">SLOT_WINDOW_END</code> - End hour (e.g. 22)</li>
                <li><code className="bg-blue-100 px-1.5 py-0.5 rounded">SLOT_DURATION</code> - Minutes per slot (e.g. 30)</li>
              </ul>
            </div>
            <div>
              <p className="font-medium mb-1">Other:</p>
              <ul className="space-y-1 text-xs">
                <li><code className="bg-blue-100 px-1.5 py-0.5 rounded">DISABLED_DATES</code> - Comma-separated dates</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Create/Update Form */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3">
          {newPolicy.key ? 'Update Policy' : 'Create Policy'}
        </h2>
        <form onSubmit={handleUpdatePolicy} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-gray-400 mb-1">Key</label>
              <input
                type="text"
                placeholder="e.g. SLOT_DURATION"
                value={newPolicy.key}
                onChange={(e) => setNewPolicy({ ...newPolicy, key: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-medium text-gray-400 mb-1">Value</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter value"
                  value={newPolicy.value}
                  onChange={(e) => setNewPolicy({ ...newPolicy, value: e.target.value })}
                  required
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 bg-primary hover:bg-primary-light text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span className="hidden sm:inline">Save</span>
                </button>
              </div>
            </div>
          </div>
        </form>
        {message.text && (
          <p className={`mt-3 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
            {message.text}
          </p>
        )}
      </div>

      {/* Policy List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          <span className="text-sm">Loading policies...</span>
        </div>
      ) : policies.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <Settings className="w-5 h-5 text-gray-400" />
          </div>
          <p className="text-sm text-gray-500">No policies defined yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {policies.map((policy) => (
            <div key={policy.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <code className="text-sm font-semibold text-gray-900">{policy.key}</code>
                </div>
                <p className="text-sm text-gray-500 truncate">{policy.value}</p>
                <p className="text-[11px] text-gray-300 mt-0.5">
                  Updated {new Date(policy.updatedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-3">
                <button
                  onClick={() => setNewPolicy({ key: policy.key, value: policy.value })}
                  className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors cursor-pointer"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeletePolicy(policy.key)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
