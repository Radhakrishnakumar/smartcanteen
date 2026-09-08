import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../shared/components/Card';
import { StatusBadge } from '../shared/components/StatusBadge';
import { Button } from '../shared/components/Button';
import { Input } from '../shared/components/Input';
import {
  Plus,
  ToggleLeft,
  ToggleRight,
  Loader2,
  X,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  Link as LinkIcon,
  Edit2,
  Trash2,
  RotateCcw,
  Archive,
  Layers,
} from 'lucide-react';
import {
  fetchMenuItems,
  updateMenuItemAvailability,
  removeMenuItem,
  restoreMenuItem,
  createMenuItem,
  updateMenuItem,
  uploadMenuItemImage,
  validateImageFile,
  MenuItem,
  fetchCategories,
  DEFAULT_FOOD_IMAGE,
  PRESET_FOOD_IMAGES,
} from '../services/menuService';

export const WorkerInventory: React.FC = () => {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter tab: 'active' | 'removed' | 'all'
  const [filterTab, setFilterTab] = useState<'active' | 'removed' | 'all'>('active');

  // Action loading state indicator per item
  const [actionId, setActionId] = useState<string | null>(null);

  // Add/Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const [itemName, setItemName] = useState<string>('');
  const [itemCategory, setItemCategory] = useState<string>('Breakfast');
  const [itemPrice, setItemPrice] = useState<string>('');
  const [itemDescription, setItemDescription] = useState<string>('');
  const [itemAvailable, setItemAvailable] = useState<boolean>(true);

  // Image state
  const [imageMode, setImageMode] = useState<'preset' | 'upload' | 'url'>('preset');
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [uploadingImage, setUploadingImage] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Remove Confirmation Modal state
  const [itemToRemove, setItemToRemove] = useState<MenuItem | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Pass true to include both active and soft-deleted items for workers
      const [fetchedItems, fetchedCats] = await Promise.all([
        fetchMenuItems(true),
        fetchCategories(),
      ]);
      setItems(fetchedItems);
      setCategories(fetchedCats);
    } catch (err) {
      setError('Failed to load menu inventory from Supabase database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeItemsCount = items.filter((i) => i.isActive).length;
  const removedItemsCount = items.filter((i) => !i.isActive).length;

  const filteredItems = items.filter((item) => {
    if (filterTab === 'active') return item.isActive;
    if (filterTab === 'removed') return !item.isActive;
    return true; // 'all'
  });

  const handleToggleStock = async (item: MenuItem) => {
    if (actionId === item.id) return;
    setActionId(item.id);
    setError(null);
    setSuccessMsg(null);

    const nextAvailableState = !item.isAvailable;
    const res = await updateMenuItemAvailability(item.id, nextAvailableState);

    if (!res.success) {
      setError(`Database Update Failed for ${item.name}: ${res.error || 'Permission denied.'}`);
    } else {
      setSuccessMsg(`Updated ${item.name} stock status to ${nextAvailableState ? 'In Stock' : 'Out of Stock'}.`);
      await loadData(); // Re-fetch from Supabase source of truth
      setTimeout(() => setSuccessMsg(null), 3000);
    }

    setActionId(null);
  };

  const handleOpenRemoveModal = (item: MenuItem) => {
    setItemToRemove(item);
  };

  const handleConfirmRemove = async () => {
    if (!itemToRemove) return;
    const targetItem = itemToRemove;
    setItemToRemove(null);
    setActionId(targetItem.id);
    setError(null);
    setSuccessMsg(null);

    const res = await removeMenuItem(targetItem.id);

    if (!res.success) {
      setError(`Database Update Failed for "${targetItem.name}": ${res.error || 'Permission denied.'}`);
    } else {
      setSuccessMsg(`Successfully removed "${targetItem.name}" from live student menu!`);
      await loadData(); // Re-fetch from Supabase source of truth
      setTimeout(() => setSuccessMsg(null), 3000);
    }

    setActionId(null);
  };

  const handleRestoreItem = async (item: MenuItem) => {
    if (actionId === item.id) return;
    setActionId(item.id);
    setError(null);
    setSuccessMsg(null);

    const res = await restoreMenuItem(item.id);

    if (!res.success) {
      setError(`Database Update Failed for "${item.name}": ${res.error || 'Permission denied.'}`);
    } else {
      setSuccessMsg(`Successfully restored "${item.name}" back to live student menu!`);
      await loadData(); // Re-fetch from Supabase source of truth
      setTimeout(() => setSuccessMsg(null), 3000);
    }

    setActionId(null);
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormError(null);
    setItemName('');
    setItemCategory(categories[0]?.name || 'Breakfast');
    setItemPrice('');
    setItemDescription('');
    setItemAvailable(true);
    setImageMode('preset');
    setSelectedImageUrl('/images/samosa_chaat.png');
    setCustomUrlInput('');
    setPreviewObjectUrl(null);
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormError(null);
    setItemName(item.name);
    setItemCategory(item.category);
    setItemPrice(item.price.toString());
    setItemDescription(item.description || '');
    setItemAvailable(item.isAvailable);

    if (item.imageUrl) {
      const isPreset = PRESET_FOOD_IMAGES.some((p) => p.url === item.imageUrl);
      if (isPreset) {
        setImageMode('preset');
      } else {
        setImageMode('url');
        setCustomUrlInput(item.imageUrl);
      }
      setSelectedImageUrl(item.imageUrl);
    } else {
      setImageMode('preset');
      setSelectedImageUrl(null);
    }

    setPreviewObjectUrl(null);
    setSelectedFile(null);
    setIsModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFormError(null);
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setFormError(validation.error || 'Invalid image file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    const objUrl = URL.createObjectURL(file);
    setPreviewObjectUrl(objUrl);
    setSelectedImageUrl(objUrl);
  };

  const handleClearImage = () => {
    setSelectedImageUrl(null);
    setPreviewObjectUrl(null);
    setSelectedFile(null);
    setCustomUrlInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!itemName.trim()) {
      setFormError('Item name is required.');
      return;
    }

    const priceNum = parseFloat(itemPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError('Please enter a valid price (greater than ₹0).');
      return;
    }

    let finalImageUrl: string | null = selectedImageUrl;

    // Upload to Supabase Storage if a local file was selected
    if (imageMode === 'upload' && selectedFile) {
      setUploadingImage(true);
      const uploadRes = await uploadMenuItemImage(selectedFile, itemName);
      setUploadingImage(false);

      if (!uploadRes.success || !uploadRes.url) {
        setFormError(uploadRes.error || 'Failed to upload image to Supabase Storage.');
        return;
      }
      finalImageUrl = uploadRes.url;
    } else if (imageMode === 'url' && customUrlInput.trim()) {
      finalImageUrl = customUrlInput.trim();
    }

    setSubmitting(true);

    if (editingItem) {
      const res = await updateMenuItem(editingItem.id, {
        name: itemName,
        categoryName: itemCategory,
        price: priceNum,
        description: itemDescription,
        isAvailable: itemAvailable,
        imageUrl: finalImageUrl,
      });

      if (!res.success || !res.data) {
        setFormError(res.error || 'Failed to update menu item in Supabase database.');
        setSubmitting(false);
        return;
      }

      setSuccessMsg(`Successfully updated "${res.data.name}"!`);
    } else {
      const res = await createMenuItem({
        name: itemName,
        categoryName: itemCategory,
        price: priceNum,
        description: itemDescription,
        isAvailable: itemAvailable,
        imageUrl: finalImageUrl,
      });

      if (!res.success || !res.data) {
        setFormError(res.error || 'Failed to create menu item in Supabase database.');
        setSubmitting(false);
        return;
      }

      setSuccessMsg(`Successfully added "${res.data.name}" to menu inventory!`);
    }

    await loadData(); // Re-fetch from Supabase source of truth
    setTimeout(() => setSuccessMsg(null), 3000);
    setSubmitting(false);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-5 pb-8 max-w-4xl mx-auto">
      {/* Top Controls Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 p-4 sm:p-5 rounded-2xl shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Food Item Availability</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage live canteen menu stock, edit items, remove discontinued items, or restore previously removed items
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadData}
            isLoading={loading}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={handleOpenAddModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Item
          </Button>
        </div>
      </div>

      {/* Filter Tabs Header */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setFilterTab('active')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            filterTab === 'active'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <span>Active Menu Items</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              filterTab === 'active' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}
          >
            {activeItemsCount}
          </span>
        </button>

        <button
          onClick={() => setFilterTab('removed')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            filterTab === 'removed'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Removed Items</span>
          {removedItemsCount > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                filterTab === 'removed' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-800'
              }`}
            >
              {removedItemsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setFilterTab('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            filterTab === 'all'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>All ({items.length})</span>
        </button>
      </div>

      {/* Notifications / Error Banners */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-3.5 rounded-xl flex items-center gap-2.5 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold p-3.5 rounded-xl flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center space-y-2">
          <Loader2 className="w-6 h-6 text-rose-600 animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading canteen inventory...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-600">
            {filterTab === 'active'
              ? 'No active menu items.'
              : filterTab === 'removed'
              ? 'No removed menu items.'
              : 'No menu items found.'}
          </p>
          {filterTab === 'active' && (
            <Button size="sm" variant="primary" onClick={handleOpenAddModal}>
              Add First Menu Item
            </Button>
          )}
        </div>
      ) : (
        /* Inventory Item Cards List */
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isProcessing = actionId === item.id;
            const isActive = item.isActive;

            return (
              <Card
                key={item.id}
                padding="sm"
                className={`flex items-center justify-between bg-white border-slate-200 transition-all ${
                  !isActive
                    ? 'bg-slate-100/70 border-slate-300 opacity-80'
                    : !item.isAvailable
                    ? 'opacity-85 bg-slate-50/60'
                    : ''
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Food Image Thumbnail */}
                  <img
                    src={item.imageUrl || DEFAULT_FOOD_IMAGE}
                    alt={item.name}
                    className={`w-14 h-14 object-cover rounded-xl border border-slate-200 shrink-0 ${
                      !isActive ? 'grayscale opacity-75 bg-slate-200' : 'bg-slate-100'
                    }`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = DEFAULT_FOOD_IMAGE;
                    }}
                  />

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`text-sm font-bold ${!isActive ? 'text-slate-500 line-through' : 'text-slate-900'} truncate`}>
                        {item.name}
                      </h3>
                      <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-xs font-extrabold text-slate-900">₹{item.price}</p>
                    {item.description && (
                      <p className="text-xs text-slate-500 line-clamp-1 max-w-md">{item.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {isActive ? (
                    <>
                      {/* Active Item Controls */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEditModal(item)}
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        className="text-xs py-1 px-2.5 h-8"
                      >
                        Edit
                      </Button>

                      <StatusBadge status={item.isAvailable ? 'success' : 'neutral'} size="sm">
                        {item.isAvailable ? 'In Stock' : 'Out of Stock'}
                      </StatusBadge>

                      <button
                        onClick={() => handleToggleStock(item)}
                        disabled={isProcessing}
                        title={item.isAvailable ? 'Click to mark Out of Stock' : 'Click to mark In Stock'}
                        className="text-slate-400 hover:text-slate-700 transition-transform active:scale-95 disabled:opacity-50"
                      >
                        {isProcessing ? (
                          <Loader2 className="w-6 h-6 text-rose-600 animate-spin" />
                        ) : item.isAvailable ? (
                          <ToggleRight className="w-8 h-8 text-emerald-600" />
                        ) : (
                          <ToggleLeft className="w-8 h-8 text-slate-400" />
                        )}
                      </button>

                      <button
                        onClick={() => handleOpenRemoveModal(item)}
                        disabled={isProcessing}
                        title="Remove dish from live student menu"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      {/* Inactive / Removed Item Controls */}
                      <span className="text-[10px] font-bold text-slate-600 bg-slate-200 px-2.5 py-1 rounded-md">
                        Removed
                      </span>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEditModal(item)}
                        leftIcon={<Edit2 className="w-3.5 h-3.5" />}
                        className="text-xs py-1 px-2.5 h-8"
                      >
                        Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleRestoreItem(item)}
                        isLoading={isProcessing}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                        className="text-xs py-1 px-3 h-8 bg-emerald-600 hover:bg-emerald-700"
                      >
                        Restore
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {itemToRemove && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center gap-3 text-red-600 pb-2 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Remove Menu Item</h3>
                <p className="text-xs text-slate-500">Confirm dish soft removal</p>
              </div>
            </div>

            <p className="text-sm font-bold text-slate-800">
              Are you sure you want to remove <span className="text-rose-600">"{itemToRemove.name}"</span> from the student menu?
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-700">What happens when removed:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                <li>This dish will be hidden from the Student Food Menu immediately.</li>
                <li>Historical orders and receipts will remain 100% unchanged.</li>
                <li>You can view and restore this item at any time under "Removed Items".</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setItemToRemove(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmRemove}
                className="bg-red-600 hover:bg-red-700"
              >
                Confirm Removal
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scaleUp max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {editingItem ? `Edit Item: ${editingItem.name}` : 'Add New Food Item'}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingItem
                    ? 'Update details, pricing or replace image'
                    : 'Create a new dish with image for live canteen orders'}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Error */}
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-semibold p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Modal Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Food Item Name"
                placeholder="e.g. Samosa Chaat, Masala Dosa, Cold Coffee"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                {/* Category Select */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Category</label>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full bg-slate-100/80 border border-slate-200 text-slate-900 text-sm rounded-xl py-2.5 px-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                    {!categories.some((c) => c.name === 'Snacks') && <option value="Snacks">Snacks</option>}
                  </select>
                </div>

                {/* Price Input */}
                <Input
                  label="Price (₹)"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 50"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Ingredients or details about the dish..."
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className="w-full bg-slate-100/80 border border-slate-200 text-slate-900 text-sm rounded-xl p-3 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              {/* Image Selection Section */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-900 block">Food Item Image</label>
                  {selectedImageUrl && (
                    <button
                      type="button"
                      onClick={handleClearImage}
                      className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove Image</span>
                    </button>
                  )}
                </div>

                {/* Source Mode Switcher */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setImageMode('preset')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      imageMode === 'preset'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>Presets</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImageMode('upload')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      imageMode === 'upload'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload File</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImageMode('url')}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      imageMode === 'url'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Custom URL</span>
                  </button>
                </div>

                {/* Mode 1: Presets Grid */}
                {imageMode === 'preset' && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {PRESET_FOOD_IMAGES.map((preset) => {
                      const isSelected = selectedImageUrl === preset.url;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setSelectedImageUrl(preset.url);
                            setPreviewObjectUrl(null);
                            setSelectedFile(null);
                          }}
                          className={`relative p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all ${
                            isSelected
                              ? 'border-rose-500 bg-rose-50/50 ring-2 ring-rose-500/20'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <img
                            src={preset.url}
                            alt={preset.name}
                            className="w-12 h-12 object-cover rounded-lg"
                          />
                          <span className="text-[10px] font-semibold text-slate-700 line-clamp-1 text-center">
                            {preset.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Mode 2: File Upload */}
                {imageMode === 'upload' && (
                  <div className="space-y-2 pt-1">
                    <label className="border-2 border-dashed border-slate-200 hover:border-rose-400 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-slate-50/50 hover:bg-rose-50/20 transition-all">
                      {uploadingImage ? (
                        <Loader2 className="w-6 h-6 text-rose-600 animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6 text-slate-400" />
                      )}
                      <span className="text-xs font-semibold text-slate-700">
                        {uploadingImage ? 'Uploading image to Supabase Storage...' : 'Click to select image file from computer'}
                      </span>
                      <span className="text-[10px] text-slate-400">JPG, PNG, WEBP up to 5MB</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileChange}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>

                    {selectedFile && (
                      <p className="text-[11px] text-slate-600 font-medium">
                        Selected: <span className="font-bold">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(0)} KB)
                      </p>
                    )}
                  </div>
                )}

                {/* Mode 3: Custom URL */}
                {imageMode === 'url' && (
                  <div className="space-y-1.5 pt-1">
                    <Input
                      placeholder="https://example.com/food-image.jpg"
                      value={customUrlInput}
                      onChange={(e) => {
                        setCustomUrlInput(e.target.value);
                        if (e.target.value.trim()) setSelectedImageUrl(e.target.value.trim());
                      }}
                    />
                  </div>
                )}

                {/* Active Image Preview Box */}
                {(() => {
                  const activeDisplayUrl = previewObjectUrl || selectedImageUrl || DEFAULT_FOOD_IMAGE;
                  return (
                    <div className="flex items-center gap-3 p-2.5 bg-slate-50 border border-slate-200 rounded-xl mt-2">
                      <img
                        src={activeDisplayUrl}
                        alt="Preview"
                        className="w-12 h-12 object-cover rounded-lg border border-slate-200 bg-white shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_FOOD_IMAGE;
                        }}
                      />
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-slate-700 block">
                          {selectedFile
                            ? `Local File Selected: ${selectedFile.name}`
                            : selectedImageUrl
                            ? 'Active Image Selected'
                            : 'No Image Selected (Neutral Placeholder Will Display)'}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate block">
                          {selectedFile ? 'Will upload to Supabase Storage on save' : selectedImageUrl || 'NULL (menu_items.image_url will store NULL)'}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Availability Toggle */}
              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <span className="text-xs font-bold text-slate-900 block">Stock Availability</span>
                  <span className="text-[11px] text-slate-500">Should item be listed as Available?</span>
                </div>
                <button
                  type="button"
                  onClick={() => setItemAvailable(!itemAvailable)}
                  className="text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {itemAvailable ? (
                    <ToggleRight className="w-8 h-8 text-emerald-600" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-slate-400" />
                  )}
                </button>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting || uploadingImage}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={submitting || uploadingImage}
                >
                  {editingItem ? 'Save Changes' : 'Create Menu Item'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
