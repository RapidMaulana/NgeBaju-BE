const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getProductsByCategory
} = require('../controllers/categoryController');

const router = express.Router();

// Validation rules
const categoryValidation = [
  body('name')
    .isLength({ min: 2, max: 50 })
    .withMessage('Nama kategori harus antara 2-50 karakter'),
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Deskripsi kategori maksimal 500 karakter')
];

// Public routes
router.get('/', getAllCategories);
router.get('/:id', getCategoryById);
router.get('/:id/products', getProductsByCategory);

// Protected routes (admin only)
router.post('/', authenticate, authorize(['admin']), categoryValidation, createCategory);
router.put('/:id', authenticate, authorize(['admin']), categoryValidation, updateCategory);
router.delete('/:id', authenticate, authorize(['admin']), deleteCategory);

module.exports = router;