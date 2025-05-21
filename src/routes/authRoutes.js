const express = require('express');
const { body } = require('express-validator');
const { register, login, getProfile } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username harus antara 3-30 karakter')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username hanya boleh berisi huruf, angka, dan underscore'),
  body('email')
    .isEmail()
    .withMessage('Email tidak valid')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password minimal 6 karakter')
    .matches(/\d/)
    .withMessage('Password harus mengandung setidaknya 1 angka'),
  body('phone')
    .optional()
    .isMobilePhone('any')
    .withMessage('Nomor telepon tidak valid'),
  body('address')
    .optional()
    .isString()
    .isLength({ min: 5 })
    .withMessage('Alamat minimal 5 karakter')
];

const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Email tidak valid')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password tidak boleh kosong')
];

// Register route
router.post('/register', registerValidation, register);

// Login route
router.post('/login', loginValidation, login);

// Get user profile route (protected by authentication)
router.get('/profile', authenticate, getProfile);

module.exports = router;