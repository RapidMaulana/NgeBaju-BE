const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct
} = require('../controllers/productController');

const router = express.Router();

// Validation rules
const productValidation = [
  body('name')
    .isLength({ min: 3, max: 100 })
    .withMessage('Nama produk harus antara 3-100 karakter'),
  body('description')
    .isLength({ min: 10 })
    .withMessage('Deskripsi produk minimal 10 karakter'),
  body('price')
    .isNumeric()
    .withMessage('Harga harus berupa angka')
    .isFloat({ min: 0 })
    .withMessage('Harga tidak boleh negatif'),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stok tidak boleh negatif'),
  body('category_id')
    .isInt()
    .withMessage('Kategori harus berupa ID yang valid'),
  body('sizes')
    .optional()
    .isArray()
    .withMessage('Ukuran harus berupa array'),
  body('sizes.*.size')
    .optional()
    .isString()
    .withMessage('Ukuran harus berupa string'),
  body('sizes.*.stock')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Stok ukuran tidak boleh negatif'),
  body('images')
    .optional()
    .isArray()
    .withMessage('Gambar harus berupa array URL')
];

// Public routes
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Protected routes (admin only)
router.post('/', authenticate, authorize(['admin']), productValidation, createProduct);
router.put('/:id', authenticate, authorize(['admin']), productValidation, updateProduct);
router.delete('/:id', authenticate, authorize(['admin']), deleteProduct);

module.exports = router;