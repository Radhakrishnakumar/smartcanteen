import React from 'react';
import { Utensils, LogOut, User, ChefHat, Activity } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

export interface HeaderProps {
  currentView?: 'app' | 'health';
  onSwitchView?: (view: 'app' | 'health') => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView = 'app', onSwitchView }) => {
  const { user, profile, signOut } = useAuth();

  const isWorker = profile?.role === 'worker';
  const roleLabel = isWorker ? 'Kitchen Worker' : 'Student';
  const displayName = profile?.fullName || user?.email?.split('@')[0] || 'User';

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 shadow-xs">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div 
          className="flex items-center gap-2.5 cursor-pointer select-none" 
          onClick={() => onSwitchView && onSwitchView('app')}
        >
          <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-xs">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-base tracking-tight block leading-none">Smart Canteen</span>
            <span className="text-[11px] text-slate-500 block mt-0.5 font-medium">Campus Food Ordering</span>
          </div>
        </div>

        {/* Authenticated User Header & Logout */}
        {user && (
          <div className="flex items-center gap-3">
            {/* Role Badge & User Info */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
              {isWorker ? (
                <ChefHat className="w-3.5 h-3.5 text-slate-800" />
              ) : (
                <User className="w-3.5 h-3.5 text-rose-600" />
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-1.5 text-left">
                <span className="font-bold text-slate-900 max-w-[120px] sm:max-w-[160px] truncate">{displayName}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                  isWorker ? 'bg-slate-900 text-white' : 'bg-rose-100 text-rose-700'
                }`}>
                  {roleLabel}
                </span>
              </div>
            </div>

            {/* Dev Mode Status Toggle (Development Diagnostic Access) */}
            {onSwitchView && (
              <button
                onClick={() => onSwitchView(currentView === 'health' ? 'app' : 'health')}
                className={`p-2 rounded-xl text-xs font-semibold transition-colors ${
                  currentView === 'health'
                    ? 'bg-rose-50 text-rose-600 border border-rose-200'
                    : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
                title="System Status Diagnostics (Dev Tool)"
              >
                <Activity className="w-4 h-4" />
              </button>
            )}

            {/* Logout Button */}
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
