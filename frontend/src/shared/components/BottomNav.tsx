import React from 'react';
import { Home, ShoppingCart, Clock, User } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';

export interface BottomNavProps {
  activeTab: 'home' | 'cart' | 'checkout' | 'confirmation' | 'orders' | 'order-details' | 'profile';
  onTabChange: (tab: 'home' | 'cart' | 'orders' | 'profile') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onTabChange }) => {
  const { totalCount } = useCart();

  const normalizedActive =
    activeTab === 'checkout' || activeTab === 'confirmation'
      ? 'cart'
      : activeTab === 'order-details'
      ? 'orders'
      : activeTab;

  const tabs = [
    { id: 'home', label: 'Menu', icon: Home },
    { id: 'cart', label: 'Cart', icon: ShoppingCart },
    { id: 'orders', label: 'Orders', icon: Clock },
    { id: 'profile', label: 'Profile', icon: User },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 px-4 py-1.5 sm:hidden shadow-lg">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = normalizedActive === tab.id;
          const isCart = tab.id === 'cart';

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors ${
                isActive ? 'text-rose-600 font-bold' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5px]' : 'stroke-[1.8px]'}`} />
                {isCart && totalCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-rose-600 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-2xs animate-scaleUp">
                    {totalCount > 99 ? '99+' : totalCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};


