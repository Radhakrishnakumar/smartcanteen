import React, { useState } from 'react';
import { WorkerOrders } from './WorkerOrders';
import { WorkerOrderHistory } from './WorkerOrderHistory';
import { WorkerInventory } from './WorkerInventory';
import { ChefHat, FileText, Package, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

export const WorkerLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'queue' | 'history' | 'inventory'>('queue');
  const { user, profile, signOut } = useAuth();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Worker Banner Header */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-rose-400 flex items-center justify-center shrink-0">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">Kitchen Operations Portal</h2>
            <p className="text-xs text-slate-400">
              Logged in as <span className="text-white font-medium">{profile?.fullName || user?.email}</span> (Kitchen Staff)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>Worker Authorized</span>
          </span>
          <button
            onClick={() => signOut()}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Secondary Worker Sub-navigation Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'queue'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <ChefHat className="w-4 h-4" />
          <span>Active Kitchen Queue</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <FileText className="w-4 h-4 text-amber-400" />
          <span>Order History</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Food Stock & Availability</span>
        </button>
      </div>

      {activeTab === 'queue' && <WorkerOrders />}
      {activeTab === 'history' && <WorkerOrderHistory />}
      {activeTab === 'inventory' && <WorkerInventory />}
    </div>
  );
};

