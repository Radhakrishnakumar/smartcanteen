import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, Loader2, RefreshCw, ShoppingBag } from 'lucide-react';
import { Input } from '../shared/components/Input';
import { fetchMenuItems, MenuItem, DEFAULT_FOOD_IMAGE } from '../services/menuService';
import { useCart } from '../contexts/CartContext';

interface StudentDashboardProps {
  onNavigateToCart?: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onNavigateToCart }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [foodItems, setFoodItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const { addToCart, updateQuantity, removeFromCart, getItemQuantity, totalCount } = useCart();

  const categories = ['All', 'Popular', 'Breakfast', 'Meals', 'Snacks', 'Beverages'];

  const loadMenu = async () => {
    setLoading(true);
    try {
      const items = await fetchMenuItems();
      setFoodItems(items);
    } catch (err) {
      console.error('Failed to load menu items:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  const filteredItems = foodItems.filter((item) => {
    const matchesActive = item.isActive !== false;
    const matchesCat = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesActive && matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-24 sm:pb-12 max-w-2xl mx-auto">
      {/* Location / Greeting Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Main Campus Canteen</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Order fresh food & beverages for quick pickup</p>
        </div>

        {/* Floating Cart Indicator */}
        {totalCount > 0 && (
          <button
            onClick={onNavigateToCart}
            className="bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-1.5 rounded-full text-xs font-bold shadow-xs animate-scaleUp flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{totalCount} {totalCount === 1 ? 'item' : 'items'}</span>
          </button>
        )}
      </div>

      {/* Clean Search Bar & Refresh */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search for dishes, snacks or drinks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4 text-slate-400" />}
            className="bg-white border-slate-200 shadow-xs text-sm py-2.5 rounded-xl"
          />
        </div>
        <button
          onClick={loadMenu}
          title="Refresh Menu"
          className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-900 transition-colors shrink-0 shadow-xs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Horizontal Scrollable Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Feed Title */}
      <div className="flex items-center justify-between pt-1">
        <h2 className="text-base font-bold text-slate-900">Available Menu Items</h2>
        <span className="text-xs text-slate-400 font-medium">{filteredItems.length} items</span>
      </div>

      {/* Loading Spinner */}
      {loading ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 flex flex-col items-center justify-center space-y-2 shadow-xs">
          <Loader2 className="w-6 h-6 text-rose-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Fetching canteen menu...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 text-center space-y-2 shadow-xs">
          <p className="text-sm font-semibold text-slate-600">No menu items match your search.</p>
        </div>
      ) : (
        /* Food Items List */
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const qty = getItemQuantity(item.id);
            const isAvailable = item.isAvailable;

            return (
              <div
                key={item.id}
                className={`bg-white border rounded-2xl p-4 flex items-center justify-between gap-4 shadow-xs transition-all ${
                  isAvailable ? 'border-slate-200/90 hover:border-slate-300' : 'border-slate-200 bg-slate-50/60 opacity-80'
                }`}
              >
                {/* Item Details */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-emerald-500' : 'bg-slate-400'}`}
                    ></span>
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {item.category}
                    </span>
                    {!isAvailable && (
                      <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200/60">
                        Out of Stock
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 leading-tight">{item.name}</h3>
                  <p className="text-sm font-extrabold text-slate-900">₹{item.price}</p>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 pt-0.5">
                    {item.description}
                  </p>
                </div>

                {/* Food Image + Add Button */}
                <div className="relative flex flex-col items-center shrink-0 w-28">
                  <img
                    src={item.imageUrl || DEFAULT_FOOD_IMAGE}
                    alt={item.name}
                    className="w-24 h-24 object-cover rounded-xl shadow-xs border border-slate-100 bg-slate-100"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_FOOD_IMAGE;
                    }}
                  />

                  {/* Add / Quantity Control */}
                  <div className="-mt-3 z-10">
                    {!isAvailable ? (
                      <button
                        disabled
                        className="bg-slate-100 border border-slate-200 text-slate-400 font-bold text-[11px] px-3 py-1 rounded-lg cursor-not-allowed shadow-xs"
                      >
                        UNAVAILABLE
                      </button>
                    ) : qty === 0 ? (
                      <button
                        onClick={() => addToCart(item)}
                        className="bg-white border border-rose-500 text-rose-600 font-bold text-xs px-4 py-1.5 rounded-lg shadow-sm hover:bg-rose-50 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>ADD</span>
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <div className="bg-rose-600 text-white font-bold text-xs px-2 py-1 rounded-lg shadow-sm flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (qty === 1) {
                              removeFromCart(item.id);
                            } else {
                              updateQuantity(item.id, qty - 1);
                            }
                          }}
                          className="w-5 h-5 flex items-center justify-center hover:bg-rose-700 rounded transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-4 text-center">{qty}</span>
                        <button
                          onClick={() => addToCart(item)}
                          className="w-5 h-5 flex items-center justify-center hover:bg-rose-700 rounded transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

