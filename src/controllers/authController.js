const bcrypt = require('bcrypt');
const supabase = require('../config/supabase');
const { generateToken } = require('../utils/jwtUtils');
const { validationResult } = require('express-validator');

/**
 * Register a new user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const register = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { username, email, password, phone, address } = req.body;

    // Check if user already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('email')
      .or(`email.eq.${email},username.eq.${username}`)
      .limit(1);

    if (checkError) {
      console.error('Error checking existing user:', checkError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat memeriksa user'
      });
    }

    if (existingUser && existingUser.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Email atau username sudah terdaftar'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        username,
        email,
        password: hashedPassword,
        phone,
        address,
        role: 'customer', // Default role
        created_at: new Date()
      })
      .select('user_id, email, username, role')
      .single();

    if (insertError) {
      console.error('Error creating user:', insertError);
      return res.status(500).json({
        success: false,
        message: 'Server error saat membuat user'
      });
    }

    // Generate JWT
    const token = generateToken(newUser);

    return res.status(201).json({
      success: true,
      message: 'User berhasil didaftarkan',
      token,
      user: {
        id: newUser.user_id,
        email: newUser.email,
        username: newUser.username,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Login user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const login = async (req, res) => {
  try {
    // Validate input
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, email, username, password, role')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email atau password salah'
      });
    }

    // Generate JWT
    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: 'Login berhasil',
      token,
      user: {
        id: user.user_id,
        email: user.email,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

/**
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProfile = async (req, res) => {
  try {
    // User already attached to req by authMiddleware
    const { user } = req;

    // Get complete user data (excluding password)
    const { data: userData, error } = await supabase
      .from('users')
      .select('user_id, username, email, phone, address, role, created_at')
      .eq('user_id', user.user_id)
      .single();

    if (error) {
      console.error('Error getting user profile:', error);
      return res.status(500).json({
        success: false,
        message: 'Server error saat mengambil profil'
      });
    }

    return res.status(200).json({
      success: true,
      user: userData
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  register,
  login,
  getProfile
};