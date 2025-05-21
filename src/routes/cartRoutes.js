const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/authMiddleware');
const {
  getCartItems,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getCartCount,
  getCartSummary,
  getCartCheckout
} = require('../controllers/cartController');

const router = express.Router();

// Validation rules
const addToCartValidation = [
  body('product_id')
    .isInt({ min: 1 })
    .withMessage('ID produk harus berupa ID yang valid'),
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Jumlah harus minimal 1'),
  body('size')
    .optional()
    .isString()
    .withMessage('Ukuran harus berupa string')
];

const updateCartValidation = [
  body('quantity')
    .isInt({ min: 1 })
    .withMessage('Jumlah harus minimal 1')
];

// All cart routes are protected and require authentication
router.use(authenticate);

// Cart endpoints
router.get('/', getCartItems);
router.post('/', addToCartValidation, addToCart);
router.put('/:id', updateCartValidation, updateCartItem);
router.delete('/:id', removeFromCart);
router.delete('/', clearCart);
router.get('/count', getCartCount);
router.get('/summary', getCartSummary);
router.get('/checkout', getCartCheckout);

module.exports = router;