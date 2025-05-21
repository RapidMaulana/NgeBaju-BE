
const supabase = require('../config/supabase');
const { validationResult } = require('express-validator');

/**
 * Get all products
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllProducts = async (req, res) => {
  try {
    const { page = 1, limit = 10, category, search } = req.query;
    const offset = (page - 1) * limit;
    
    // Start with a base query
    let query = supabase
      .from('products')
      .select(`
        *,
        categories(name, description)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Add filters if provided
    if (category) {
      query = query.eq('category_id', category);
    }
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }
    
    // Execute query
    const { data: products, error, count } = await query;
    
    if (error) {
      console.error('Error fetching products:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengambil produk'
      });
    }
    
    // Get count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact' });
    
    if (countError) {
      console.error('Error counting products:', countError);
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
      products: productsWithImages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Get all products error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get product by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get product details
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        categories(name, description)
      `)
      .eq('product_id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'Produk tidak ditemukan'
        });
      }
      
      console.error('Error fetching product:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengambil produk'
      });
    }
    
    // Get images for this product
    const { data: images, error: imagesError } = await supabase
      .from('product_images')
      .select('image_id, image_url')
      .eq('product_id', id);
    
    if (imagesError) {
      console.error(`Error fetching images for product ${id}:`, imagesError);
    }
    
    // Get sizes for this product
    const { data: sizes, error: sizesError } = await supabase
      .from('product_sizes')
      .select('size_id, size, stock')
      .eq('product_id', id);
    
    if (sizesError) {
      console.error(`Error fetching sizes for product ${id}:`, sizesError);
    }
    
    const productWithDetails = {
      ...product,
      images: images || [],
      sizes: sizes || []
    };
    
    return res.status(200).json({
      success: true,
      product: productWithDetails
    });
  } catch (error) {
    console.error('Get product by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Create a new product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createProduct = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const { name, description, price, stock, category_id, sizes, images } = req.body;
    
    // Verify that category exists
    const { data: categoryExists, error: categoryError } = await supabase
      .from('categories')
      .select('category_id')
      .eq('category_id', category_id)
      .single();
    
    if (categoryError || !categoryExists) {
      return res.status(400).json({
        success: false,
        message: 'Kategori tidak ditemukan'
      });
    }
    
    // Start a transaction
    const { data: newProduct, error: productError } = await supabase
      .from('products')
      .insert({
        name,
        description,
        price,
        stock,
        category_id,
        created_at: new Date()
      })
      .select('product_id')
      .single();
    
    if (productError) {
      console.error('Error creating product:', productError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat membuat produk'
      });
    }
    
    // Add product sizes if provided
    if (sizes && sizes.length > 0) {
      const sizesData = sizes.map(size => ({
        product_id: newProduct.product_id,
        size: size.size,
        stock: size.stock
      }));
      
      const { error: sizesError } = await supabase
        .from('product_sizes')
        .insert(sizesData);
      
      if (sizesError) {
        console.error('Error adding product sizes:', sizesError);
        // Continue despite the error, but log it
      }
    }
    
    // Add product images if provided
    if (images && images.length > 0) {
      const imagesData = images.map(image => ({
        product_id: newProduct.product_id,
        image_url: image
      }));
      
      const { error: imagesError } = await supabase
        .from('product_images')
        .insert(imagesData);
      
      if (imagesError) {
        console.error('Error adding product images:', imagesError);
        // Continue despite the error, but log it
      }
    }
    
    // Get the complete product data
    const { data: completeProduct, error: fetchError } = await supabase
      .from('products')
      .select(`
        *,
        categories(name, description)
      `)
      .eq('product_id', newProduct.product_id)
      .single();
    
    if (fetchError) {
      console.error('Error fetching complete product:', fetchError);
      // Return the product ID even if we couldn't fetch the complete product
      return res.status(201).json({
        success: true,
        message: 'Produk berhasil dibuat',
        product_id: newProduct.product_id
      });
    }
    
    return res.status(201).json({
      success: true,
      message: 'Produk berhasil dibuat',
      product: completeProduct
    });
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Update a product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateProduct = async (req, res) => {
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
    const { name, description, price, stock, category_id, sizes, images } = req.body;
    
    // Verify that product exists
    const { data: productExists, error: checkError } = await supabase
      .from('products')
      .select('product_id')
      .eq('product_id', id)
      .single();
    
    if (checkError || !productExists) {
      return res.status(404).json({
        success: false,
        message: 'Produk tidak ditemukan'
      });
    }
    
    // Update product
    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (price) updateData.price = price;
    if (stock !== undefined) updateData.stock = stock;
    if (category_id) updateData.category_id = category_id;
    
    const { data: updatedProduct, error: updateError } = await supabase
      .from('products')
      .update(updateData)
      .eq('product_id', id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating product:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengupdate produk'
      });
    }
    
    // Update product sizes if provided
    if (sizes && sizes.length > 0) {
      // First delete existing sizes
      await supabase
        .from('product_sizes')
        .delete()
        .eq('product_id', id);
      
      // Then insert new sizes
      const sizesData = sizes.map(size => ({
        product_id: id,
        size: size.size,
        stock: size.stock
      }));
      
      const { error: sizesError } = await supabase
        .from('product_sizes')
        .insert(sizesData);
      
      if (sizesError) {
        console.error('Error updating product sizes:', sizesError);
        // Continue despite the error, but log it
      }
    }
    
    // Update product images if provided
    if (images && images.length > 0) {
      // First delete existing images
      await supabase
        .from('product_images')
        .delete()
        .eq('product_id', id);
      
      // Then insert new images
      const imagesData = images.map(image => ({
        product_id: id,
        image_url: image
      }));
      
      const { error: imagesError } = await supabase
        .from('product_images')
        .insert(imagesData);
      
      if (imagesError) {
        console.error('Error updating product images:', imagesError);
        // Continue despite the error, but log it
      }
    }
    
    return res.status(200).json({
      success: true,
      message: 'Produk berhasil diupdate',
      product: updatedProduct
    });
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Delete a product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify that product exists
    const { data: productExists, error: checkError } = await supabase
      .from('products')
      .select('product_id')
      .eq('product_id', id)
      .single();
    
    if (checkError || !productExists) {
      return res.status(404).json({
        success: false,
        message: 'Produk tidak ditemukan'
      });
    }
    
    // Delete related data first (sizes and images)
    await supabase
      .from('product_sizes')
      .delete()
      .eq('product_id', id);
    
    await supabase
      .from('product_images')
      .delete()
      .eq('product_id', id);
    
    // Delete the product
    const { error: deleteError } = await supabase
      .from('products')
      .delete()
      .eq('product_id', id);
    
    if (deleteError) {
      console.error('Error deleting product:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat menghapus produk'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Produk berhasil dihapus'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
};