const supabase = require('../config/supabase');
const { validationResult } = require('express-validator');
  
  /**
   * Get all orders (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const getAllOrders = async (req, res) => {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const offset = (page - 1) * limit;
      
      // Start with base query
      let query = supabase
        .from('orders')
        .select(`
          *,
          users(user_id, username, email)
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      // Add filter by status if provided
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data: orders, error } = await query;
      
      if (error) {
        console.error('Error fetching orders:', error);
        return res.status(500).json({
          success: false,
          message: 'Server error saat mengambil order'
        });
      }
      
      // Get count for pagination
      const countQuery = supabase
        .from('orders')
        .select('*', { count: 'exact' });
      
      if (status) {
        countQuery.eq('status', status);
      }
      
      const { count: totalCount, error: countError } = await countQuery;
      
      if (countError) {
        console.error('Error counting orders:', countError);
      }
      
      // Get order items for each order
      const ordersWithItems = await Promise.all(orders.map(async (order) => {
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select(`
            *,
            products(name, price)
          `)
          .eq('order_id', order.order_id);
        
        if (itemsError) {
          console.error(`Error fetching items for order ${order.order_id}:`, itemsError);
          return { ...order, items: [] };
        }
        
        return { ...order, items: orderItems || [] };
      }));
      
      return res.status(200).json({
        success: true,
        orders: ordersWithItems,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount || 0,
          pages: Math.ceil((totalCount || 0) / limit)
        }
      });
    } catch (error) {
      console.error('Get all orders error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  };
  
  /**
   * Get user's orders
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const getUserOrders = async (req, res) => {
    try {
      const { page = 1, limit = 10, status } = req.query;
      const offset = (page - 1) * limit;
      const userId = req.user.user_id;
      
      // Start with base query
      let query = supabase
        .from('orders')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      // Add filter by status if provided
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data: orders, error } = await query;
      
      if (error) {
        console.error('Error fetching user orders:', error);
        return res.status(500).json({
          success: false,
          message: 'Server error saat mengambil order'
        });
      }
      
      // Get count for pagination
      const countQuery = supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);
      
      if (status) {
        countQuery.eq('status', status);
      }
      
      const { count: totalCount, error: countError } = await countQuery;
      
      if (countError) {
        console.error('Error counting user orders:', countError);
      }
      
      // Get order items for each order
      const ordersWithItems = await Promise.all(orders.map(async (order) => {
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select(`
            *,
            products(name, price, 
              product_images(image_url)
            )
          `)
          .eq('order_id', order.order_id);
        
        if (itemsError) {
          console.error(`Error fetching items for order ${order.order_id}:`, itemsError);
          return { ...order, items: [] };
        }
        
        // Process items to include image
        const itemsWithImage = orderItems.map(item => ({
          ...item,
          product_image: item.products.product_images && item.products.product_images[0] ? 
            item.products.product_images[0].image_url : null
        }));
        
        return { ...order, items: itemsWithImage || [] };
      }));
      
      return res.status(200).json({
        success: true,
        orders: ordersWithItems,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount || 0,
          pages: Math.ceil((totalCount || 0) / limit)
        }
      });
    } catch (error) {
      console.error('Get user orders error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  };
  
  /**
   * Get order by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const getOrderById = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;
      
      // Get order
      let query = supabase
        .from('orders')
        .select(`
          *,
          users(user_id, username, email)
        `)
        .eq('order_id', id)
        .single();
      
      // If not admin, restrict to user's own orders
      if (req.user.role !== 'admin') {
        query = query.eq('user_id', userId);
      }
      
      const { data: order, error } = await query;
      
      if (error) {
        if (error.code === 'PGRST116') {
          return res.status(404).json({
            success: false,
            message: 'Order tidak ditemukan'
          });
        }
        
        console.error('Error fetching order:', error);
        return res.status(500).json({
          success: false,
          message: 'Server error saat mengambil order'
        });
      }
      
      // Get order items
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select(`
          *,
          products(product_id, name, price, description, 
            product_images(image_url)
          )
        `)
        .eq('order_id', id);
      
      if (itemsError) {
        console.error(`Error fetching items for order ${id}:`, itemsError);
        return res.status(500).json({
          success: false,
          message: 'Server error saat mengambil item order'
        });
      }
      
      // Process items to include image
      const itemsWithImage = orderItems.map(item => ({
        ...item,
        product_image: item.products.product_images && item.products.product_images[0] ? 
          item.products.product_images[0].image_url : null
      }));
      
      const orderWithItems = {
        ...order,
        items: itemsWithImage || []
      };
      
      return res.status(200).json({
        success: true,
        order: orderWithItems
      });
    } catch (error) {
      console.error('Get order by ID error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  };
  
  /**
   * Create a new order
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const createOrder = async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }
      
      const { items } = req.body;
      const userId = req.user.user_id;
      
      // Verify items and calculate total
      let totalPrice = 0;
      const verifiedItems = [];
      
      for (const item of items) {
        // Get product details
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('product_id, name, price, stock')
          .eq('product_id', item.product_id)
          .single();
        
        if (productError || !product) {
          return res.status(400).json({
            success: false,
            message: `Produk dengan ID ${item.product_id} tidak ditemukan`
          });
        }
        
        // Check if size exists and has stock (if size is provided)
        if (item.size) {
          const { data: sizeData, error: sizeError } = await supabase
            .from('product_sizes')
            .select('size_id, size, stock')
            .eq('product_id', item.product_id)
            .eq('size', item.size)
            .single();
          
          if (sizeError || !sizeData) {
            return res.status(400).json({
              success: false,
              message: `Ukuran ${item.size} untuk produk ${product.name} tidak ditemukan`
            });
          }
          
          if (sizeData.stock < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `Stok tidak cukup untuk produk ${product.name} ukuran ${item.size}`
            });
          }
        } else {
          // Check general stock
          if (product.stock < item.quantity) {
            return res.status(400).json({
              success: false,
              message: `Stok tidak cukup untuk produk ${product.name}`
            });
          }
        }
        
        // Calculate item price
        const itemPrice = product.price * item.quantity;
        totalPrice += itemPrice;
        
        verifiedItems.push({
          product_id: item.product_id,
          size: item.size || null,
          quantity: item.quantity,
          price: product.price
        });
      }
      
      // Create order
      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          total_price: totalPrice,
          status: 'pending', // Default status
          created_at: new Date()
        })
        .select('order_id')
        .single();
      
      if (orderError) {
        console.error('Error creating order:', orderError);
        return res.status(500).json({
          success: false,
          message: 'Server error saat membuat order'
        });
      }
      
      // Create order items
      const orderItems = verifiedItems.map(item => ({
        order_id: newOrder.order_id,
        product_id: item.product_id,
        size: item.size,
        quantity: item.quantity,
        price: item.price
      }));
      
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);
      
      if (itemsError) {
        console.error('Error adding order items:', itemsError);
        // Try to delete the order if we couldn't add items
        await supabase
          .from('orders')
          .delete()
          .eq('order_id', newOrder.order_id);
        
        return res.status(500).json({
          success: false,
          message: 'Server error saat menambahkan item order'
        });
      }
      
      // Update product stocks
      for (const item of verifiedItems) {
        if (item.size) {
          // Update size stock
          await supabase
            .from('product_sizes')
            .update({ stock: supabase.rpc('decrement', { x: item.quantity }) })
            .eq('product_id', item.product_id)
            .eq('size', item.size);
        } else {
          // Update general product stock
          await supabase
            .from('products')
            .update({ stock: supabase.rpc('decrement', { x: item.quantity }) })
            .eq('product_id', item.product_id);
        }
      }
      
      return res.status(201).json({
        success: true,
        message: 'Order berhasil dibuat',
        order_id: newOrder.order_id,
        total_price: totalPrice
      });
    } catch (error) {
      console.error('Create order error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  };
  
  /**
   * Update order status (admin only)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const updateOrderStatus = async (req, res) => {
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
      const { status } = req.body;
      
      // Check if order exists
      const { data: orderExists, error: checkError } = await supabase
        .from('orders')
        .select('order_id, status')
        .eq('order_id', id)
        .single();
      
      if (checkError || !orderExists) {
        return res.status(404).json({
          success: false,
          message: 'Order tidak ditemukan'
        });
      }
      
      // Validate status transition
      const validStatusTransitions = {
        'pending': ['processing', 'cancelled'],
        'processing': ['shipped', 'cancelled'],
        'shipped': ['delivered', 'returned'],
        'delivered': ['completed', 'returned'],
        'returned': ['refunded'],
        'cancelled': [],
        'completed': [],
        'refunded': []
      };
      
      if (!validStatusTransitions[orderExists.status].includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Tidak dapat mengubah status dari ${orderExists.status} ke ${status}`
        });
      }
      
      // Update order status
      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({ status })
        .eq('order_id', id)
        .select('*')
        .single();
      
      if (updateError) {
        console.error('Error updating order status:', updateError);
        return res.status(500).json({
          success: false,
          message: 'Server error saat mengupdate status order'
        });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Status order berhasil diupdate',
        order: updatedOrder
      });
    } catch (error) {
      console.error('Update order status error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  };
  
  /**
   * Cancel order (user can cancel their own pending orders)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  const cancelOrder = async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.user_id;
      
      // Get order and check ownership
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('order_id, user_id, status')
        .eq('order_id', id)
        .single();
      
      if (orderError || !order) {
        return res.status(404).json({
          success: false,
          message: 'Order tidak ditemukan'
        });
      }
      
      // Check if user owns this order (unless admin)
      if (req.user.role !== 'admin' && order.user_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Anda tidak memiliki akses untuk order ini'
        });
      }
      
      // Check if order can be cancelled
      if (order.status !== 'pending' && order.status !== 'processing') {
        return res.status(400).json({
          success: false,
          message: `Order dengan status ${order.status} tidak dapat dibatalkan`
        });
      }
      
      // Update order status to cancelled
      const { data: updatedOrder, error: updateError } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('order_id', id)
        .select('*')
        .single();
      
      if (updateError) {
        console.error('Error cancelling order:', updateError);
        return res.status(500).json({
          success: false,
          message: 'Server error saat membatalkan order'
        });
      }
      
      // Get order items to restore stock
      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('product_id, size, quantity')
        .eq('order_id', id);
      
      if (!itemsError && orderItems) {
        // Restore product stocks
        for (const item of orderItems) {
          if (item.size) {
            // Restore size stock
            await supabase
              .from('product_sizes')
              .update({ stock: supabase.rpc('increment', { x: item.quantity }) })
              .eq('product_id', item.product_id)
              .eq('size', item.size);
          } else {
            // Restore general product stock
            await supabase
              .from('products')
              .update({ stock: supabase.rpc('increment', { x: item.quantity }) })
              .eq('product_id', item.product_id);
          }
        }
      }
      
      return res.status(200).json({
        success: true,
        message: 'Order berhasil dibatalkan',
        order: updatedOrder
      });
    } catch (error) {
      console.error('Cancel order error:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  };

  module.exports = {
    getAllOrders,
    getUserOrders,
    getOrderById,
    createOrder,
    updateOrderStatus,
    cancelOrder
  };