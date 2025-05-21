
const bcrypt = require('bcrypt');
const supabase = require('../config/supabase');
const { validationResult } = require('express-validator');

/**
 * Get all users (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role } = req.query;
    const offset = (page - 1) * limit;
    
    // Start with base query
    let query = supabase
      .from('users')
      .select('user_id, username, email, phone, role, created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Add filter by role if provided
    if (role) {
      query = query.eq('role', role);
    }
    
    const { data: users, error } = await query;
    
    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengambil data user'
      });
    }
    
    // Get count for pagination
    const countQuery = supabase
      .from('users')
      .select('*', { count: 'exact' });
    
    if (role) {
      countQuery.eq('role', role);
    }
    
    const { count: totalCount, error: countError } = await countQuery;
    
    if (countError) {
      console.error('Error counting users:', countError);
    }
    
    return res.status(200).json({
      success: true,
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount || 0,
        pages: Math.ceil((totalCount || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get user by ID (admin only or self)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user.user_id;
    
    // Check access (admin can access any user, users can only access their own)
    if (req.user.role !== 'admin' && parseInt(id) !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Anda tidak memiliki akses untuk melihat user ini'
      });
    }
    
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, username, email, phone, address, role, created_at')
      .eq('user_id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          success: false,
          message: 'User tidak ditemukan'
        });
      }
      
      console.error('Error fetching user:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengambil data user'
      });
    }
    
    return res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Update user profile (user can update their own profile)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateUserProfile = async (req, res) => {
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
    const currentUserId = req.user.user_id;
    
    // Check access (admin can update any user, users can only update their own)
    if (req.user.role !== 'admin' && parseInt(id) !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Anda tidak memiliki akses untuk mengupdate user ini'
      });
    }
    
    const { username, phone, address } = req.body;
    
    // Check if user exists
    const { data: userExists, error: checkError } = await supabase
      .from('users')
      .select('user_id')
      .eq('user_id', id)
      .single();
    
    if (checkError || !userExists) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }
    
    // Check if username already exists (if changing username)
    if (username) {
      const { data: existingUser, error: usernameCheckError } = await supabase
        .from('users')
        .select('user_id')
        .eq('username', username)
        .neq('user_id', id)
        .limit(1);
      
      if (usernameCheckError) {
        console.error('Error checking existing username:', usernameCheckError);
        return res.status(500).json({
          success: false,
          message: 'Server error saat memeriksa username'
        });
      }
      
      if (existingUser && existingUser.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Username sudah digunakan'
        });
      }
    }
    
    // Update user profile
    const updateData = {};
    if (username) updateData.username = username;
    if (phone) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update(updateData)
      .eq('user_id', id)
      .select('user_id, username, email, phone, address, role, created_at')
      .single();
    
    if (updateError) {
      console.error('Error updating user profile:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengupdate profil'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Profil berhasil diupdate',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Change password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const changePassword = async (req, res) => {
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
    const { current_password, new_password } = req.body;
    const currentUserId = req.user.user_id;
    
    // Check access (admin can change any user's password, users can only change their own)
    if (req.user.role !== 'admin' && parseInt(id) !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Anda tidak memiliki akses untuk mengubah password user ini'
      });
    }
    
    // Get user with password
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('user_id, password')
      .eq('user_id', id)
      .single();
    
    if (userError || !user) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }
    
    // Verify current password (except for admin)
    if (req.user.role !== 'admin') {
      const isPasswordValid = await bcrypt.compare(current_password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Password saat ini tidak valid'
        });
      }
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(new_password, salt);
    
    // Update password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('user_id', id);
    
    if (updateError) {
      console.error('Error updating password:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengubah password'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Password berhasil diubah'
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Update user role (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateUserRole = async (req, res) => {
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
    const { role } = req.body;
    
    // Check if user exists
    const { data: userExists, error: checkError } = await supabase
      .from('users')
      .select('user_id, role')
      .eq('user_id', id)
      .single();
    
    if (checkError || !userExists) {
      return res.status(404).json({
        success: false,
        message: 'User tidak ditemukan'
      });
    }
    
    // Don't allow changing own role
    if (parseInt(id) === req.user.user_id) {
      return res.status(400).json({
        success: false,
        message: 'Anda tidak dapat mengubah role Anda sendiri'
      });
    }
    
    // Update role
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ role })
      .eq('user_id', id)
      .select('user_id, username, email, role')
      .single();
    
    if (updateError) {
      console.error('Error updating user role:', updateError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengupdate role'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Role berhasil diupdate',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user role error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserProfile,
  changePassword,
  updateUserRole
};