const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  getAllUsers,
  getUserById,
  updateUserProfile,
  changePassword,
  updateUserRole
} = require('../controllers/userController');

const router = express.Router();

// Validation rules
const profileValidation = [
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username harus antara 3-30 karakter')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username hanya boleh berisi huruf, angka, dan underscore'),
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

const passwordValidation = [
  body('current_password')
    .notEmpty()
    .withMessage('Password saat ini harus diisi'),
  body('new_password')
    .isLength({ min: 6 })
    .withMessage('Password baru minimal 6 karakter')
    .matches(/\d/)
    .withMessage('Password baru harus mengandung setidaknya 1 angka')
];

const roleValidation = [
  body('role')
    .isIn(['admin', 'customer'])
    .withMessage('Role harus admin atau customer')
];

// Admin routes
router.get('/', authenticate, authorize(['admin']), getAllUsers);
router.put('/:id/role', authenticate, authorize(['admin']), roleValidation, updateUserRole);

// Protected routes (user can access their own data)
router.get('/:id', authenticate, getUserById);
router.put('/:id', authenticate, profileValidation, updateUserProfile);
router.put('/:id/password', authenticate, passwordValidation, changePassword);

module.exports = router;