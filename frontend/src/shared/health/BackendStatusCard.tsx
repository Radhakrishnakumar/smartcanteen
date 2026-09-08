import React, { useEffect, useState } from 'react';
import { Server, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { env } from '../../config/env';
import { checkBackendHealth } from '../../services/api';
import { BackendHealthResponse } from '../../types';

export const BackendStatusCard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [healthData, setHealthData] = useState<BackendHealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    const res = await checkBackendHealth();
    if (res.success && res.data) {
      setHealthData(res.data);
    } else {
      setError(res.error || 'Backend service offline');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 border border-sky-200 flex items-center justify-center">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Backend API</h3>
            <p className="text-xs text-slate-500">Express Node.js Server</p>
          </div>
        </div>
        <button
          onClick={fetchHealth}
          disabled={loading}
          className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
          title="Refresh Health"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-xs text-slate-600 font-semibold">GET /health</span>
          {loading ? (
            <span className="text-xs text-slate-500 animate-pulse">Pinging...</span>
          ) : healthData?.status === 'healthy' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Healthy (200 OK)</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
              <XCircle className="w-3.5 h-3.5" />
              <span>Unreachable</span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-mono">
            {error}
          </div>
        )}

        {healthData && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Service:</span>
              <span className="font-mono text-slate-900 font-semibold">{healthData.service}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Server Uptime:</span>
              <span className="font-mono text-emerald-700 font-semibold">{healthData.uptime}s</span>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Backend URL:</span>
          <span className="font-mono text-slate-700">{env.backendUrl}</span>
        </div>
      </div>
    </div>
  );
};
