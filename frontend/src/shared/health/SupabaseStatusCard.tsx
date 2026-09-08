import React, { useEffect, useState } from 'react';
import { Database, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { env } from '../../config/env';
import { testSupabaseConnection } from '../../services/supabase';

export const SupabaseStatusCard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; message: string } | null>(null);

  const checkConnection = async () => {
    setLoading(true);
    const res = await testSupabaseConnection();
    setStatus({ connected: res.success, message: res.message });
    setLoading(false);
  };

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Database Connection</h3>
            <p className="text-xs text-slate-500">PostgreSQL / Supabase Service</p>
          </div>
        </div>
        <button
          onClick={checkConnection}
          disabled={loading}
          className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
          title="Refresh Connection"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-xs text-slate-600 font-semibold">Status</span>
          {loading ? (
            <span className="text-xs text-slate-500 animate-pulse">Testing...</span>
          ) : status?.connected ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Connected ✓</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
              <XCircle className="w-3.5 h-3.5" />
              <span>Unavailable</span>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Project Endpoint:</span>
          <span className="font-mono text-slate-700 truncate max-w-[200px]">
            {env.supabaseUrl ? env.supabaseUrl : 'Not configured'}
          </span>
        </div>
      </div>
    </div>
  );
};
