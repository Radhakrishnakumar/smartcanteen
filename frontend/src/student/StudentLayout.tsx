import React, { useState } from 'react';
import { StudentDashboard } from './StudentDashboard';
import { StudentCart } from './StudentCart';
import { StudentCheckout, OrderPlacedDetails } from './StudentCheckout';
import { OrderConfirmation } from './OrderConfirmation';
import { StudentOrders } from './StudentOrders';
import { StudentOrderDetails } from './StudentOrderDetails';
import { BottomNav } from '../shared/components/BottomNav';
import { Card } from '../shared/components/Card';
import { User, Shield, Utensils, ShoppingCart, Clock, LogOut, Mail } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../contexts/CartContext';

export type StudentTabState =
  | 'home'
  | 'cart'
  | 'checkout'
  | 'confirmation'
  | 'orders'
  | 'order-details'
  | 'profile';

export const StudentLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState<StudentTabState>('home');
  const [confirmedOrderDetails, setConfirmedOrderDetails] = useState<OrderPlacedDetails | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { user, profile, signOut } = useAuth();
  const { totalCount } = useCart();

  const handleTabChange = (tab: 'home' | 'cart' | 'orders' | 'profile') => {
    setActiveTab(tab);
  };

  return (
    <div className="max-w-md sm:max-w-2xl mx-auto px-4 py-4 pb-20 sm:pb-8">
      {/* Tab Switcher for Tablet & Desktop */}
      <div className="hidden sm:flex items-center gap-2 border-b border-slate-200 pb-3 mb-4">
        <button
          onClick={() => setActiveTab('home')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'home'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Food Menu</span>
        </button>

        <button
          onClick={() => setActiveTab('cart')}
          className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'cart' || activeTab === 'checkout' || activeTab === 'confirmation'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>My Cart</span>
          {totalCount > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                activeTab === 'cart' || activeTab === 'checkout'
                  ? 'bg-white text-rose-600'
                  : 'bg-rose-600 text-white'
              }`}
            >
              {totalCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'orders' || activeTab === 'order-details'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>My Orders</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
            activeTab === 'profile'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Account Profile</span>
        </button>
      </div>

      {/* Main View Area */}
      {activeTab === 'home' && <StudentDashboard onNavigateToCart={() => setActiveTab('cart')} />}

      {activeTab === 'cart' && (
        <StudentCart
          onNavigateToMenu={() => setActiveTab('home')}
          onProceedToCheckout={() => setActiveTab('checkout')}
        />
      )}

      {activeTab === 'checkout' && (
        <StudentCheckout
          onBackToCart={() => setActiveTab('cart')}
          onOrderPlaced={(details) => {
            setConfirmedOrderDetails(details);
            setActiveTab('confirmation');
          }}
        />
      )}

      {activeTab === 'confirmation' && confirmedOrderDetails && (
        <OrderConfirmation
          orderDetails={confirmedOrderDetails}
          onViewOrders={() => setActiveTab('orders')}
          onBackToMenu={() => setActiveTab('home')}
        />
      )}

      {activeTab === 'orders' && (
        <StudentOrders
          onSelectOrder={(id) => {
            setSelectedOrderId(id);
            setActiveTab('order-details');
          }}
          onNavigateToMenu={() => setActiveTab('home')}
        />
      )}

      {activeTab === 'order-details' && selectedOrderId && (
        <StudentOrderDetails
          orderId={selectedOrderId}
          onBack={() => setActiveTab('orders')}
        />
      )}

      {activeTab === 'profile' && (
        <div className="space-y-4 pt-2">
          {/* Profile Header */}
          <div className="flex items-center gap-3 bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-700 font-bold text-lg flex items-center justify-center shrink-0">
              <User className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-bold text-slate-900 truncate">
                {profile?.fullName || 'Student User'}
              </h2>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>

          {/* Account Details Card */}
          <Card className="space-y-3 text-xs text-slate-600 p-4 bg-white border-slate-200">
            <div className="flex items-center gap-2 text-slate-900 font-bold pb-2 border-b border-slate-100">
              <Shield className="w-4 h-4 text-slate-600" />
              <span>Account Credentials & Role</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" /> Email:
                </span>
                <span className="font-semibold text-slate-800 truncate max-w-[200px]">
                  {user?.email}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-400" /> System Role:
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-bold text-[10px] uppercase">
                  {profile?.role || 'Student'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Auth Status:
                </span>
                <span className="text-emerald-700 font-bold text-xs flex items-center gap-1">
                  ● Authenticated
                </span>
              </div>
            </div>
          </Card>

          {/* Logout Button */}
          <button
            onClick={() => signOut()}
            className="w-full py-3 px-4 rounded-xl text-xs font-bold text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 transition-all flex items-center justify-center gap-2 shadow-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out of Canteen Account</span>
          </button>
        </div>
      )}

      {/* Mobile Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={handleTabChange} />
    </div>
  );
};


