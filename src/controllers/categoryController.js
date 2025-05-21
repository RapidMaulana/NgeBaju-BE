
const supabase = require('../config/supabase');
const { validationResult } = require('express-validator');

/**
 * Get all categories
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllCategories = async (req, res) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching categories:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengambil kategori'
      });
    }
    
    return res.status(200).json({
      success: true,
      categories
    });
  } catch (error) {
    console.error('Get all categories error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get category by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: category, error } = await supabase
      .from('categories')
      .select('*')
      .eq('category_id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Kategori tidak ditemukan'
        });
      }
      
      console.error('Error fetching category:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengambil kategori'
      });
    }
    
    return res.status(200).json({
      success: true,
      category
    });
  } catch (error) {
    console.error('Get category by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Create a new category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createCategory = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { name, description } = req.body;
    
    // Check if category with the same name already exists
    const { data: existingCategory, error: checkError } = await supabase
      .from('categories')
      .select('category_id')
      .ilike('name', name)
      .limit(1);
    
    if (checkError) {
      console.error('Error checking existing category:', checkError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat memeriksa kategori'
      });
    }
    
    if (existingCategory && existingCategory.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Kategori dengan nama yang sama sudah ada'
      });
    }
    
    // Create new category
    const { data: newCategory, error: insertError } = await supabase
      .from('categories')
      .insert({
        name,
        description
      })
      .select('*')
      .single();
    
    if (insertError) {
      console.error('Error creating category:', insertError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat membuat kategori'
      });
    }
    
    return res.status(201).json({
      success: true,
      message: 'Kategori berhasil dibuat',
      category: newCategory
    });
  } catch (error) {
    console.error('Create category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Update a category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateCategory = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { id } = req.params;
    const { name, description } = req.body;
    
    // Check if category exists
    const { data: categoryExists, error: checkError } = await supabase
      .from('categories')
      .select('category_id')
      .eq('category_id', id)
      .single();
    
    if (checkError || !categoryExists) {
      return res.status(404).json({
        success: false,
        message: 'Kategori tidak ditemukan'
      });
    }
    
    // Check if new name already exists (for another category)
    if (name) {
      const { data: existingCategory, error: nameCheckError } = await supabase
        .from('categories')
        .select('category_id')
        .ilike('name', name)
        .neq('category_id', id)
        .limit(1);
      
      if (nameCheckError) {
        console.error('Error checking existing category name:', nameCheckError);
        return res.status(500).json({
          success: false,
          message: 'Server error saat memeriksa nama kategori'
        });
      }
      
      if (existingCategory && existingCategory.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Kategori dengan nama yang sama sudah ada'
        });
      }
    }
    
    // Update category
    const updateData = {};
    if (name) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    
    const { data: updatedCategory, error: updateError } = await supabase
      .from('categories')
      .update(updateData)
      .eq('category_id', id)
      .select('*')
      .single();
    
    if (updateError) {
      console.error('Error updating category:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengupdate kategori'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Kategori berhasil diupdate',
      category: updatedCategory
    });
  } catch (error) {
    console.error('Update category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Delete a category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if category exists
    const { data: categoryExists, error: checkError } = await supabase
      .from('categories')
      .select('category_id')
      .eq('category_id', id)
      .single();
    
    if (checkError || !categoryExists) {
      return res.status(404).json({
        success: false,
        message: 'Kategori tidak ditemukan'
      });
    }
    
    // Check if there are products using this category
    const { data: productsUsingCategory, error: productsCheckError } = await supabase
      .from('products')
      .select('product_id')
      .eq('category_id', id)
      .limit(1);
    
    if (productsCheckError) {
      console.error('Error checking products using category:', productsCheckError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat memeriksa produk yang menggunakan kategori'
      });
    }
    
    if (productsUsingCategory && productsUsingCategory.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Tidak dapat menghapus kategori yang masih digunakan oleh produk'
      });
    }
    
    // Delete category
    const { error: deleteError } = await supabase
      .from('categories')
      .delete()
      .eq('category_id', id);
    
    if (deleteError) {
      console.error('Error deleting category:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat menghapus kategori'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Kategori berhasil dihapus'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get products by category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProductsByCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    // Check if category exists
    const { data: categoryExists, error: checkError } = await supabase
      .from('categories')
      .select('*')
      .eq('category_id', id)
      .single();
    
    if (checkError || !categoryExists) {
      return res.status(404).json({
        success: false,
        message: 'Kategori tidak ditemukan'
      });
    }
    
    // Get products by category
    const { data: products, error, count } = await supabase
      .from('products')
      .select(`
        *,
        categories(name, description)
      `)
      .eq('category_id', id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('Error fetching products by category:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengambil produk berdasarkan kategori'
      });
    }
    
    // Get count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('category_id', id);
    
    if (countError) {
      console.error('Error counting products by category:', countError);
    }
    
    // For each product, get its images
    const productsWithImages = await Promise.all(products.map(async (product) => {
      const { data: images, error: imagesError } = await supabase
        .from('product_images')
        .select('image_id, image_url')
        .eq('product_id', product.product_id);
      
      if (imagesError) {
        console.error(`Error fetching images for product ${product.product_id}:`, imagesError);
        return { ...product, images: [] };
      }
      
      // Get sizes for this product
      const { data: sizes, error: sizesError } = await supabase
        .from('product_sizes')
        .select('size_id, size, stock')
        .eq('product_id', product.product_id);
      
      if (sizesError) {
        console.error(`Error fetching sizes for product ${product.product_id}:`, sizesError);
        return { ...product, images, sizes: [] };
      }
      
      return { ...product, images, sizes };
    }));
    
    return res.status(200).json({
      success: true,
      category: categoryExists,
      products: productsWithImages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Get products by category error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getProductsByCategory
};