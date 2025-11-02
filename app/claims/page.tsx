'use client';

import { useState, useEffect } from 'react';

interface ClaimRecord {
  claim_id: string;
  note_filename: string;
  pdf_url: string;
  decision: 'approved' | 'denied' | 'pending';
  amount_approved?: number;
  reason?: string;
  created_at: string;
  patient_name?: string;
  provider_name?: string;
}

export default function ClaimsPage() {
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'approved' | 'denied' | 'pending'>('all');

  useEffect(() => {
    loadClaims();
    const interval = setInterval(loadClaims, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadClaims = async () => {
    try {
      const response = await fetch('/api/claims/list');
      const result = await response.json();
      if (result.success) {
        setClaims(result.data);
      }
    } catch (err) {
      console.error('Failed to load claims:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClaims = claims.filter((claim) => {
    if (filter === 'all') return true;
    return claim.decision === filter;
  });

  const getDecisionBadge = (decision: ClaimRecord['decision']) => {
    const styles = {
      approved: 'bg-green-100 text-green-800 border-green-300',
      denied: 'bg-red-100 text-red-800 border-red-300',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    };

    const icons = {
      approved: '✅',
      denied: '❌',
      pending: '⏳',
    };

    return (
      <span className={`px-4 py-2 rounded-full text-sm font-bold border-2 ${styles[decision]}`}>
        {icons[decision]} {decision.toUpperCase()}
      </span>
    );
  };

  const stats = {
    total: claims.length,
    approved: claims.filter((c) => c.decision === 'approved').length,
    denied: claims.filter((c) => c.decision === 'denied').length,
    pending: claims.filter((c) => c.decision === 'pending').length,
    totalApproved: claims
      .filter((c) => c.decision === 'approved')
      .reduce((sum, c) => sum + (c.amount_approved || 0), 0),
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                📑 Generated Claims
              </h1>
              <p className="text-xl text-gray-600">
                View and download all processed claim PDFs
              </p>
            </div>
            <div className="flex gap-3">
              <a
                href="/notes"
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors"
              >
                ← Back to Notes
              </a>
              <a
                href="/"
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg shadow-lg transition-colors"
              >
                Home
              </a>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600 font-medium">Total Claims</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-600 font-medium">Approved</p>
            <p className="text-3xl font-bold text-green-600">{stats.approved}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-red-500">
            <p className="text-sm text-gray-600 font-medium">Denied</p>
            <p className="text-3xl font-bold text-red-600">{stats.denied}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-yellow-500">
            <p className="text-sm text-gray-600 font-medium">Pending</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600 font-medium">Total Approved $</p>
            <p className="text-2xl font-bold text-purple-600">
              ${stats.totalApproved.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'approved'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Approved ({stats.approved})
            </button>
            <button
              onClick={() => setFilter('denied')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'denied'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Denied ({stats.denied})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'pending'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending ({stats.pending})
            </button>
            <button
              onClick={loadClaims}
              className="ml-auto px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Claims List */}
        <div className="bg-white rounded-lg shadow-md p-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Loading claims...</p>
            </div>
          ) : filteredClaims.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No claims found</p>
              <p className="text-sm mt-2">
                {filter === 'all'
                  ? 'Upload notes to generate claims'
                  : `No ${filter} claims yet`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredClaims.map((claim) => (
                <div
                  key={claim.claim_id}
                  className="border-2 border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <h3 className="text-xl font-bold text-gray-900">
                          {claim.claim_id}
                        </h3>
                        {getDecisionBadge(claim.decision)}
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <p className="text-sm text-gray-600">Source Note:</p>
                          <p className="font-medium text-gray-900">{claim.note_filename}</p>
                        </div>
                        {claim.patient_name && (
                          <div>
                            <p className="text-sm text-gray-600">Patient:</p>
                            <p className="font-medium text-gray-900">{claim.patient_name}</p>
                          </div>
                        )}
                        {claim.provider_name && (
                          <div>
                            <p className="text-sm text-gray-600">Provider:</p>
                            <p className="font-medium text-gray-900">{claim.provider_name}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-gray-600">Created:</p>
                          <p className="font-medium text-gray-900">
                            {new Date(claim.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {claim.amount_approved && (
                        <div className="bg-green-50 rounded-lg p-3 mb-3 border border-green-200">
                          <p className="text-sm text-green-700 font-medium">Amount Approved:</p>
                          <p className="text-2xl font-bold text-green-700">
                            ${claim.amount_approved.toFixed(2)}
                          </p>
                        </div>
                      )}

                      {claim.reason && (
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <p className="text-sm text-gray-600">Reason:</p>
                          <p className="text-sm text-gray-800">{claim.reason}</p>
                        </div>
                      )}
                    </div>

                    <div className="ml-6 flex flex-col gap-3">
                      <a
                        href={claim.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-center"
                      >
                        📄 View PDF
                      </a>
                      <a
                        href={claim.pdf_url}
                        download
                        className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-center"
                      >
                        ⬇️ Download
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

