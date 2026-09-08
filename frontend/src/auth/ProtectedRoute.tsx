import React from 'react';
import { useAuth } from './AuthContext';
import { AuthScreen } from './AuthScreen';
import { UserRole } from '../types';
import { Utensils } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  fallbackView?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  fallbackView,
}) => {
  const { user, profile, loading } = useAuth();

  // Show clean loading spinner while restoring session or fetching user profile
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center animate-pulse mb-3">
          <Utensils className="w-6 h-6" />
        </div>
        <p className="text-xs font-semibold text-slate-500 animate-pulse">Restoring canteen session...</p>
      </div>
    );
  }

  // Unauthenticated users -> Redirect to Login/Signup AuthScreen
  if (!user) {
    return <AuthScreen />;
  }

  // Check role authorization if specified
  const currentRole: UserRole = profile?.role || 'student';

  if (allowedRoles && !allowedRoles.includes(currentRole)) {
    // If student attempts to access worker view, render fallbackView or redirect notice
    if (fallbackView) {
      return <>{fallbackView}</>;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-sm w-full text-center space-y-3 shadow-xs">
          <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-500">
            Your account ({currentRole}) does not have permission to view this section.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
