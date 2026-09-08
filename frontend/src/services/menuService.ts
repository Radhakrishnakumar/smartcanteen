import { supabase } from './supabase';

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  categoryId?: string;
  price: number;
  description: string;
  isAvailable: boolean;
  isActive: boolean; // Soft delete status (true = active menu item, false = removed item)
  imageUrl?: string;
  createdAt?: string;
}

export interface CreateMenuItemInput {
  name: string;
  categoryName: string;
  price: number;
  description?: string;
  isAvailable?: boolean;
  imageUrl?: string | null;
}

export interface UpdateMenuItemInput {
  name?: string;
  categoryName?: string;
  price?: number;
  description?: string;
  isAvailable?: boolean;
  isActive?: boolean;
  imageUrl?: string | null;
}

export const DEFAULT_FOOD_IMAGE = '/images/default_food.png';

export const PRESET_FOOD_IMAGES = [
  { id: 'samosa_chaat', name: 'Samosa Chaat', url: '/images/samosa_chaat.png' },
  { id: 'masala_dosa', name: 'Masala Dosa', url: '/images/masala_dosa.png' },
  { id: 'paneer_masala', name: 'Paneer Butter Masala', url: '/images/paneer_butter_masala.png' },
  { id: 'cold_coffee', name: 'Cold Coffee', url: '/images/cold_coffee.png' },
  { id: 'veg_sandwich', name: 'Veg Cheese Sandwich', url: '/images/veg_cheese_sandwich.png' },
];

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Validate image file type and size before upload
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const fileType = file.type.toLowerCase();
  const fileExt = (file.name.split('.').pop() || '').toLowerCase();
  const isValidType = ALLOWED_IMAGE_TYPES.includes(fileType) || ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt);

  if (!isValidType) {
    return {
      valid: false,
      error: 'Invalid file format. Only JPG, JPEG, PNG, and WEBP images are supported.',
    };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds maximum limit of 5 MB. Please select a smaller image.`,
    };
  }

  return { valid: true };
};

/**
 * Upload an image file to Supabase Storage bucket ('menu-items').
 */
export const uploadMenuItemImage = async (
  file: File,
  itemNameHint?: string
): Promise<{ success: boolean; url?: string; error?: string }> => {
  try {
    const validation = validateImageFile(file);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'png';
    const slug = (itemNameHint || 'food')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);
    const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const filePath = `items/${slug}-${uniqueSuffix}.${fileExt}`;

    const { error: uploadErr } = await supabase.storage
      .from('menu-items')
      .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (uploadErr) {
      console.error('[menuService] Supabase Storage upload failed:', uploadErr.message);
      return {
        success: false,
        error: `Storage Upload Error: ${uploadErr.message}. Ensure 'menu-items' bucket exists and worker permissions are configured.`,
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from('menu-items')
      .getPublicUrl(filePath);

    if (!publicUrlData || !publicUrlData.publicUrl) {
      return { success: false, error: 'Failed to retrieve public URL from Storage.' };
    }

    return { success: true, url: publicUrlData.publicUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to upload image file.';
    return { success: false, error: msg };
  }
};

// Fallback hardcoded data in case Supabase table is not seeded yet or connection issue
const DEFAULT_MENU_ITEMS: MenuItem[] = [
  {
    id: 'fallback-1',
    name: 'Masala Dosa',
    category: 'Breakfast',
    price: 60,
    description: 'Crispy rice crepes served with potato masala, sambar & fresh coconut chutney.',
    isAvailable: true,
    isActive: true,
    imageUrl: '/images/masala_dosa.png',
  },
  {
    id: 'fallback-2',
    name: 'Paneer Butter Masala Combo',
    category: 'Meals',
    price: 130,
    description: 'Rich creamy paneer curry served with 2 butter naans and fragrant basmati rice.',
    isAvailable: true,
    isActive: true,
    imageUrl: '/images/paneer_butter_masala.png',
  },
  {
    id: 'fallback-3',
    name: 'Cold Coffee with Ice Cream',
    category: 'Beverages',
    price: 50,
    description: 'Chilled espresso blended with thick milk, topped with a scoop of vanilla ice cream.',
    isAvailable: false,
    isActive: true,
    imageUrl: '/images/cold_coffee.png',
  },
  {
    id: 'fallback-4',
    name: 'Veg Cheese Grill Sandwich',
    category: 'Snacks',
    price: 75,
    description: 'Triple-layered toasted sandwich loaded with fresh veggies, green chutney and melted cheese.',
    isAvailable: true,
    isActive: true,
    imageUrl: '/images/veg_cheese_sandwich.png',
  },
  {
    id: 'fallback-5',
    name: 'Samosa Chaat',
    category: 'Snacks',
    price: 50,
    description: 'Crispy samosa crushed and topped with warm chickpea curry, sweet yogurt, tangy tamarind chutney, and fresh coriander.',
    isAvailable: true,
    isActive: true,
    imageUrl: '/images/samosa_chaat.png',
  },
];

/**
 * Fetch all menu items from Supabase with join on categories
 * @param includeInactive If false (default for students), only fetches active items (is_active = true)
 */
export const fetchMenuItems = async (includeInactive: boolean = false): Promise<MenuItem[]> => {
  try {
    let query = supabase
      .from('menu_items')
      .select(`
        id,
        name,
        description,
        price,
        is_available,
        is_active,
        image_url,
        created_at,
        category_id,
        categories (
          id,
          name
        )
      `)
      .order('created_at', { ascending: true });

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('[menuService] Error fetching menu_items from Supabase:', error.message);
      return DEFAULT_MENU_ITEMS.filter((i) => includeInactive || i.isActive);
    }

    if (!data || data.length === 0) {
      return DEFAULT_MENU_ITEMS.filter((i) => includeInactive || i.isActive);
    }

    return data.map((item: any) => {
      const catObj = Array.isArray(item.categories) ? item.categories[0] : item.categories;
      const rawImage = item.image_url;
      const isActiveVal = item.is_active !== undefined && item.is_active !== null ? Boolean(item.is_active) : true;

      return {
        id: item.id,
        name: item.name,
        category: catObj?.name || 'General',
        categoryId: item.category_id,
        price: Number(item.price),
        description: item.description || '',
        isAvailable: Boolean(item.is_available),
        isActive: isActiveVal,
        imageUrl: rawImage && rawImage.trim() ? rawImage.trim() : undefined,
        createdAt: item.created_at,
      };
    });
  } catch (err) {
    console.error('[menuService] Exception fetching menu_items:', err);
    return DEFAULT_MENU_ITEMS.filter((i) => includeInactive || i.isActive);
  }
};

/**
 * Fetch all categories from Supabase
 */
export const fetchCategories = async (): Promise<{ id: string; name: string }[]> => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name')
      .order('display_order', { ascending: true });

    if (error || !data || data.length === 0) {
      return [
        { id: 'cat-1', name: 'Breakfast' },
        { id: 'cat-2', name: 'Meals' },
        { id: 'cat-3', name: 'Snacks' },
        { id: 'cat-4', name: 'Beverages' },
      ];
    }

    return data;
  } catch (err) {
    return [
      { id: 'cat-1', name: 'Breakfast' },
      { id: 'cat-2', name: 'Meals' },
      { id: 'cat-3', name: 'Snacks' },
      { id: 'cat-4', name: 'Beverages' },
    ];
  }
};

/**
 * Toggle menu item availability in Supabase
 */
export const updateMenuItemAvailability = async (
  id: string,
  isAvailable: boolean
): Promise<{ success: boolean; error?: string }> => {
  try {
    if (id.startsWith('fallback-') || id.startsWith('item-')) {
      return { success: true };
    }

    const { data, error } = await supabase
      .from('menu_items')
      .update({
        is_available: isAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, is_available');

    if (error) {
      console.error('[menuService] Error updating availability in DB:', error.message);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Failed to update stock availability in database (Permission denied or row not found).',
      };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update availability.';
    return { success: false, error: msg };
  }
};

/**
 * Soft Delete a menu item (sets is_active = false in Supabase).
 * Historical orders and order_items remain 100% intact.
 */
export const removeMenuItem = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    if (id.startsWith('fallback-') || id.startsWith('item-')) {
      return { success: true };
    }

    const { data, error } = await supabase
      .from('menu_items')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, name, is_active');

    if (error) {
      console.error('[menuService] Error soft-deleting item in DB:', error.message);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Failed to remove menu item in Supabase database (Permission denied or is_active column missing).',
      };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Exception occurred removing menu item.';
    return { success: false, error: msg };
  }
};

/**
 * Restore a soft-deleted menu item (sets is_active = true in Supabase).
 * Preserves item name, category, price, description, image, and stock availability.
 */
export const restoreMenuItem = async (id: string): Promise<{ success: boolean; error?: string }> => {
  try {
    if (id.startsWith('fallback-') || id.startsWith('item-')) {
      return { success: true };
    }

    const { data, error } = await supabase
      .from('menu_items')
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, name, is_active');

    if (error) {
      console.error('[menuService] Error restoring item in DB:', error.message);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'Failed to restore menu item in Supabase database (Permission denied or is_active column missing).',
      };
    }

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Exception occurred restoring menu item.';
    return { success: false, error: msg };
  }
};

/**
 * Resolve or create Category ID by name
 */
const resolveCategoryId = async (categoryName: string): Promise<string | null> => {
  const categoryNameClean = categoryName.trim();
  const { data: existingCat } = await supabase
    .from('categories')
    .select('id')
    .ilike('name', categoryNameClean)
    .maybeSingle();

  if (existingCat) {
    return existingCat.id;
  }

  const slug = categoryNameClean.toLowerCase().replace(/\s+/g, '-');
  const { data: newCat, error: catErr } = await supabase
    .from('categories')
    .insert({
      name: categoryNameClean,
      slug: slug,
      description: `${categoryNameClean} items`,
    })
    .select('id')
    .maybeSingle();

  if (!catErr && newCat) {
    return newCat.id;
  }
  return null;
};

/**
 * Create a new menu item in Supabase (upserts by name to prevent duplicates)
 */
export const createMenuItem = async (
  input: CreateMenuItemInput
): Promise<{ success: boolean; data?: MenuItem; error?: string }> => {
  try {
    const nameClean = input.name.trim();
    const categoryId = await resolveCategoryId(input.categoryName);

    const finalImageUrl = input.imageUrl && input.imageUrl.trim() ? input.imageUrl.trim() : null;

    // Check if item already exists by name (case-insensitive) to prevent duplicates
    const { data: existingItems } = await supabase
      .from('menu_items')
      .select('id, name')
      .ilike('name', nameClean);

    let dbResult: any = null;
    let dbError: any = null;

    if (existingItems && existingItems.length > 0) {
      const existingId = existingItems[0].id;
      const { data, error } = await supabase
        .from('menu_items')
        .update({
          name: nameClean,
          category_id: categoryId,
          price: input.price,
          description: input.description?.trim() || '',
          is_available: input.isAvailable !== undefined ? input.isAvailable : true,
          is_active: true,
          image_url: finalImageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingId)
        .select(`
          id,
          name,
          description,
          price,
          is_available,
          is_active,
          image_url,
          created_at,
          category_id,
          categories (
            id,
            name
          )
        `)
        .single();
      dbResult = data;
      dbError = error;
    } else {
      const { data, error } = await supabase
        .from('menu_items')
        .insert({
          name: nameClean,
          category_id: categoryId,
          price: input.price,
          description: input.description?.trim() || '',
          is_available: input.isAvailable !== undefined ? input.isAvailable : true,
          is_active: true,
          image_url: finalImageUrl,
        })
        .select(`
          id,
          name,
          description,
          price,
          is_available,
          is_active,
          image_url,
          created_at,
          category_id,
          categories (
            id,
            name
          )
        `)
        .single();
      dbResult = data;
      dbError = error;
    }

    if (dbError) {
      console.error('[menuService] Error creating menu item in Supabase:', dbError.message);
      return { success: false, error: dbError.message };
    }

    const categoryObj = Array.isArray(dbResult.categories) ? dbResult.categories[0] : dbResult.categories;
    const newItem: MenuItem = {
      id: dbResult.id,
      name: dbResult.name,
      category: categoryObj?.name || input.categoryName.trim(),
      categoryId: dbResult.category_id,
      price: Number(dbResult.price),
      description: dbResult.description || '',
      isAvailable: Boolean(dbResult.is_available),
      isActive: Boolean(dbResult.is_active ?? true),
      imageUrl: dbResult.image_url || undefined,
      createdAt: dbResult.created_at,
    };

    return { success: true, data: newItem };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create menu item.';
    return { success: false, error: msg };
  }
};

/**
 * Update an existing menu item in Supabase by ID
 */
export const updateMenuItem = async (
  id: string,
  input: UpdateMenuItemInput
): Promise<{ success: boolean; data?: MenuItem; error?: string }> => {
  try {
    let categoryId: string | null = null;
    if (input.categoryName) {
      categoryId = await resolveCategoryId(input.categoryName);
    }

    const updatePayload: any = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (categoryId !== null) updatePayload.category_id = categoryId;
    if (input.price !== undefined) updatePayload.price = input.price;
    if (input.description !== undefined) updatePayload.description = input.description.trim();
    if (input.isAvailable !== undefined) updatePayload.is_available = input.isAvailable;
    if (input.isActive !== undefined) updatePayload.is_active = input.isActive;
    if (input.imageUrl !== undefined) {
      updatePayload.image_url = input.imageUrl && input.imageUrl.trim() ? input.imageUrl.trim() : null;
    }

    if (id.startsWith('fallback-') || id.startsWith('item-')) {
      return {
        success: true,
        data: {
          id: id,
          name: input.name || 'Food Item',
          category: input.categoryName || 'General',
          price: input.price || 0,
          description: input.description || '',
          isAvailable: input.isAvailable !== undefined ? input.isAvailable : true,
          isActive: input.isActive !== undefined ? input.isActive : true,
          imageUrl: updatePayload.image_url || undefined,
        },
      };
    }

    const { data, error } = await supabase
      .from('menu_items')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        id,
        name,
        description,
        price,
        is_available,
        is_active,
        image_url,
        created_at,
        category_id,
        categories (
          id,
          name
        )
      `)
      .single();

    if (error) {
      console.error('[menuService] Error updating menu item in Supabase:', error.message);
      return { success: false, error: error.message };
    }

    const categoryObj = Array.isArray(data.categories) ? data.categories[0] : data.categories;
    const updatedItem: MenuItem = {
      id: data.id,
      name: data.name,
      category: categoryObj?.name || input.categoryName || 'General',
      categoryId: data.category_id,
      price: Number(data.price),
      description: data.description || '',
      isAvailable: Boolean(data.is_available),
      isActive: Boolean(data.is_active ?? true),
      imageUrl: data.image_url || undefined,
      createdAt: data.created_at,
    };

    return { success: true, data: updatedItem };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update menu item.';
    return { success: false, error: msg };
  }
};
