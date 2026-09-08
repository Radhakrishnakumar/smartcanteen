import { useState } from 'react';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { Header } from './shared/components/Header';
import { StudentLayout } from './student/StudentLayout';
import { WorkerLayout } from './worker/WorkerLayout';
import { SupabaseStatusCard } from './shared/health/SupabaseStatusCard';
import { BackendStatusCard } from './shared/health/BackendStatusCard';
import { Activity } from 'lucide-react';

function AppContent() {
  const [currentView, setCurrentView] = useState<'app' | 'health'>('app');
  const { profile } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Header */}
      <Header currentView={currentView} onSwitchView={setCurrentView} />

      {/* Main Content */}
      <main className="flex-1">
        {currentView === 'health' ? (
          <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-rose-600" />
                <h1 className="text-xl font-bold text-slate-900">System Integration & Service Diagnostics</h1>
              </div>
              <p className="text-xs text-slate-500">
                Service health status monitoring for database layer and API endpoints.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <SupabaseStatusCard />
              <BackendStatusCard />
            </div>
          </div>
        ) : (
          <ProtectedRoute>
            {profile?.role === 'worker' ? <WorkerLayout /> : <StudentLayout />}
          </ProtectedRoute>
        )}
      </main>

      {/* Global Footer */}
      <footer className="hidden sm:block border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500 font-medium">
        <p>Smart Canteen • Fast Canteen Pre-Ordering & Queue Management</p>
      </footer>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </AuthProvider>
  );
}

export default App;

