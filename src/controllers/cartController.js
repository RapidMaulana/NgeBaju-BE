const supabase = require('../config/supabase');
const { validationResult } = require('express-validator');

/**
 * @module CartController
 * @description Controller for managing user shopping cart operations
 */

/**
 * Get all items in user's cart
 * @function getCartItems
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with cart items and status
 */
const getCartItems = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Retrieve cart items with product details and images
    const { data: cartItems, error } = await supabase
      .from('cart_items')
      .select(`
        item_id,
        user_id,
        product_id,
        quantity,
        size,
        created_at,
        updated_at,
        products(
          product_id,
          name,
          price,
          stock,
          product_images(image_id, image_url)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching cart items:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengambil item keranjang'
      });
    }
    
    // Process data to have a more frontend-friendly structure
    const processedItems = cartItems.map(item => {
      const product = item.products;
      const mainImage = product.product_images && product.product_images.length > 0 
        ? product.product_images[0].image_url 
        : null;
        
      return {
        item_id: item.item_id,
        product_id: item.product_id,
        quantity: item.quantity,
        size: item.size,
        product: {
          id: product.product_id,
          name: product.name,
          price: product.price,
          stock: product.stock,
          image: mainImage
        },
        subtotal: product.price * item.quantity,
        created_at: item.created_at,
        updated_at: item.updated_at
      };
    });
    
    // Calculate cart totals
    const cartTotal = processedItems.reduce((total, item) => total + item.subtotal, 0);
    const itemCount = processedItems.reduce((count, item) => count + item.quantity, 0);
    
    return res.status(200).json({
      success: true,
      cart: {
        items: processedItems,
        item_count: itemCount,
        total: cartTotal
      }
    });
  } catch (error) {
    console.error('Get cart items error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Add item to cart
 * @function addToCart
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with updated cart item and status
 */
const addToCart = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    
    const userId = req.user.user_id;
    const { product_id, quantity, size } = req.body;
    
    // Verify product exists
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('product_id, name, price, stock')
      .eq('product_id', product_id)
      .single();
    
    if (productError || !product) {
      return res.status(404).json({
        success: false,
        message: 'Produk tidak ditemukan'
      });
    }
    
    // Check stock availability
    if (size) {
      // Check size-specific stock
      const { data: sizeData, error: sizeError } = await supabase
        .from('product_sizes')
        .select('size, stock')
        .eq('product_id', product_id)
        .eq('size', size)
        .single();
      
      if (sizeError || !sizeData) {
        return res.status(404).json({
          success: false,
          message: `Ukuran ${size} untuk produk ini tidak ditemukan`
        });
      }
      
      if (sizeData.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Stok tidak cukup. Tersedia: ${sizeData.stock}`
        });
      }
    } else {
      // Check general product stock
      if (product.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Stok tidak cukup. Tersedia: ${product.stock}`
        });
      }
    }
    
    // Check if item already exists in cart
    const { data: existingItem, error: checkError } = await supabase
      .from('cart_items')
      .select('item_id, quantity')
      .eq('user_id', userId)
      .eq('product_id', product_id)
      .eq('size', size || null)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking existing cart item:', checkError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat memeriksa item keranjang'
      });
    }
    
    let result;
    
    // If item exists, update quantity
    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      
      // Recheck stock with new total quantity
      if (size) {
        const { data: sizeData } = await supabase
          .from('product_sizes')
          .select('stock')
          .eq('product_id', product_id)
          .eq('size', size)
          .single();
          
        if (sizeData.stock < newQuantity) {
          return res.status(400).json({
            success: false,
            message: `Stok tidak cukup untuk total ${newQuantity}. Tersedia: ${sizeData.stock}`
          });
        }
      } else if (product.stock < newQuantity) {
        return res.status(400).json({
          success: false,
          message: `Stok tidak cukup untuk total ${newQuantity}. Tersedia: ${product.stock}`
        });
      }
      
      // Update quantity
      const { data: updatedItem, error: updateError } = await supabase
        .from('cart_items')
        .update({ 
          quantity: newQuantity,
          updated_at: new Date()
        })
        .eq('item_id', existingItem.item_id)
        .select('item_id, product_id, quantity, size')
        .single();
      
      if (updateError) {
        console.error('Error updating cart item:', updateError);
        return res.status(500).json({
          success: false,
          message: 'Server error saat mengupdate item keranjang'
        });
      }
      
      result = {
        ...updatedItem,
        updated: true,
        message: 'Item sudah ada di keranjang, jumlah diperbarui'
      };
    } else {
      // Insert new item
      const { data: newItem, error: insertError } = await supabase
        .from('cart_items')
        .insert({
          user_id: userId,
          product_id,
          quantity,
          size: size || null,
          created_at: new Date(),
          updated_at: new Date()
        })
        .select('item_id, product_id, quantity, size')
        .single();
      
      if (insertError) {
        console.error('Error adding item to cart:', insertError);
        return res.status(500).json({
          success: false,
          message: 'Server error saat menambah item ke keranjang'
        });
      }
      
      result = {
        ...newItem,
        updated: false,
        message: 'Item berhasil ditambahkan ke keranjang'
      };
    }
    
    // Get updated cart count for response
    const { count: cartCount, error: countError } = await supabase
      .from('cart_items')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);
    
    return res.status(200).json({
      success: true,
      message: result.message,
      item: {
        item_id: result.item_id,
        product_id: result.product_id,
        quantity: result.quantity,
        size: result.size,
        product: {
          id: product.product_id,
          name: product.name,
          price: product.price
        },
        subtotal: product.price * result.quantity
      },
      cart_count: cartCount || 0
    });
  } catch (error) {
    console.error('Add to cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Update cart item quantity
 * @function updateCartItem
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with updated cart item and status
 */
const updateCartItem = async (req, res) => {
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
    const { quantity } = req.body;
    const userId = req.user.user_id;
    
    // Check if item exists and belongs to user
    const { data: cartItem, error: checkError } = await supabase
      .from('cart_items')
      .select(`
        item_id, 
        user_id, 
        product_id, 
        quantity, 
        size,
        products(price, stock)
      `)
      .eq('item_id', id)
      .eq('user_id', userId)
      .single();
    
    if (checkError || !cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Item keranjang tidak ditemukan'
      });
    }
    
    // Check stock availability
    if (cartItem.size) {
      // Check size-specific stock
      const { data: sizeData, error: sizeError } = await supabase
        .from('product_sizes')
        .select('stock')
        .eq('product_id', cartItem.product_id)
        .eq('size', cartItem.size)
        .single();
      
      if (sizeError || !sizeData) {
        return res.status(404).json({
          success: false,
          message: 'Ukuran produk tidak ditemukan'
        });
      }
      
      if (sizeData.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: `Stok tidak cukup. Tersedia: ${sizeData.stock}`
        });
      }
    } else if (cartItem.products.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Stok tidak cukup. Tersedia: ${cartItem.products.stock}`
      });
    }
    
    // Update quantity
    const { data: updatedItem, error: updateError } = await supabase
      .from('cart_items')
      .update({ 
        quantity,
        updated_at: new Date()
      })
      .eq('item_id', id)
      .select('item_id, product_id, quantity, size')
      .single();
    
    if (updateError) {
      console.error('Error updating cart item:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengupdate item keranjang'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Jumlah item keranjang berhasil diupdate',
      item: {
        item_id: updatedItem.item_id,
        product_id: updatedItem.product_id,
        quantity: updatedItem.quantity,
        size: updatedItem.size,
        subtotal: cartItem.products.price * updatedItem.quantity
      }
    });
  } catch (error) {
    console.error('Update cart item error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Remove item from cart
 * @function removeFromCart
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with deletion status
 */
const removeFromCart = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.user_id;
    
    // Check if item exists and belongs to user
    const { data: cartItem, error: checkError } = await supabase
      .from('cart_items')
      .select('item_id, user_id')
      .eq('item_id', id)
      .eq('user_id', userId)
      .single();
    
    if (checkError || !cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Item keranjang tidak ditemukan'
      });
    }
    
    // Delete item
    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('item_id', id);
    
    if (deleteError) {
      console.error('Error removing item from cart:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat menghapus item dari keranjang'
      });
    }
    
    // Get updated cart count for response
    const { count: cartCount, error: countError } = await supabase
      .from('cart_items')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);
    
    return res.status(200).json({
      success: true,
      message: 'Item berhasil dihapus dari keranjang',
      cart_count: cartCount || 0
    });
  } catch (error) {
    console.error('Remove from cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Clear all items from user's cart
 * @function clearCart
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with clear status
 */
const clearCart = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Delete all items in user's cart
    const { error: deleteError } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', userId);
    
    if (deleteError) {
      console.error('Error clearing cart:', deleteError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengosongkan keranjang'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Keranjang berhasil dikosongkan'
    });
  } catch (error) {
    console.error('Clear cart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get cart item count for the user
 * @function getCartCount
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with cart count
 */
const getCartCount = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Get item count
    const { data: items, error } = await supabase
      .from('cart_items')
      .select('quantity')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error getting cart count:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengambil jumlah keranjang'
      });
    }
    
    // Calculate total number of items
    const itemCount = items.reduce((total, item) => total + item.quantity, 0);
    
    return res.status(200).json({
      success: true,
      count: {
        items: items.length,
        quantity: itemCount
      }
    });
  } catch (error) {
    console.error('Get cart count error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get cart summary (minimal data for header/widgets)
 * @function getCartSummary
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with cart summary data
 */
const getCartSummary = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Get cart items with minimal data
    const { data: cartItems, error } = await supabase
      .from('cart_items')
      .select(`
        quantity,
        products(price)
      `)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error fetching cart summary:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengambil ringkasan keranjang'
      });
    }
    
    // Calculate summary data
    const itemCount = cartItems.length;
    const totalQuantity = cartItems.reduce((total, item) => total + item.quantity, 0);
    const totalAmount = cartItems.reduce((total, item) => total + (item.products.price * item.quantity), 0);
    
    return res.status(200).json({
      success: true,
      summary: {
        item_count: itemCount,
        total_quantity: totalQuantity,
        total_amount: totalAmount
      }
    });
  } catch (error) {
    console.error('Get cart summary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get cart items and convert to order format for checkout
 * @function getCartCheckout
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with cart data in checkout format
 */
const getCartCheckout = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Get cart items with product details
    const { data: cartItems, error } = await supabase
      .from('cart_items')
      .select(`
        product_id,
        quantity,
        size,
        products(
          product_id, 
          name, 
          price, 
          stock,
          product_images(image_url)
        )
      `)
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error fetching cart for checkout:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error saat menyiapkan checkout'
      });
    }
    
    if (!cartItems.length) {
      return res.status(400).json({
        success: false,
        message: 'Keranjang kosong, tidak dapat melakukan checkout'
      });
    }
    
    // Validate stock for all items
    const stockIssues = [];
    for (const item of cartItems) {
      if (item.size) {
        // Check size-specific stock
        const { data: sizeData, error: sizeError } = await supabase
          .from('product_sizes')
          .select('stock')
          .eq('product_id', item.product_id)
          .eq('size', item.size)
          .single();
        
        if (!sizeError && sizeData && sizeData.stock < item.quantity) {
          stockIssues.push({
            product_id: item.product_id,
            product_name: item.products.name,
            size: item.size,
            requested: item.quantity,
            available: sizeData.stock
          });
        }
      } else if (item.products.stock < item.quantity) {
        stockIssues.push({
          product_id: item.product_id,
          product_name: item.products.name,
          requested: item.quantity,
          available: item.products.stock
        });
      }
    }
    
    if (stockIssues.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Beberapa item melebihi stok yang tersedia',
        stock_issues: stockIssues
      });
    }
    
    // Format cart items for checkout
    const checkoutItems = cartItems.map(item => {
      const mainImage = item.products.product_images && item.products.product_images.length > 0 
        ? item.products.product_images[0].image_url 
        : null;
      
      return {
        product_id: item.product_id,
        size: item.size,
        quantity: item.quantity,
        price: item.products.price,
        subtotal: item.products.price * item.quantity,
        product: {
          name: item.products.name,
          image: mainImage
        }
      };
    });
    
    // Calculate checkout totals
    const totalAmount = checkoutItems.reduce((total, item) => total + item.subtotal, 0);
    
    return res.status(200).json({
      success: true,
      checkout: {
        items: checkoutItems,
        item_count: checkoutItems.length,
        total_amount: totalAmount
      }
    });
  } catch (error) {
    console.error('Get cart checkout error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getCartItems,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartCount,
  getCartSummary,
  getCartCheckout
};