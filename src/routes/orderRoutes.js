const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const {
  getAllOrders,
  getUserOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  cancelOrder
} = require('../controllers/orderController');

const router = express.Router();

// Validation rules
const orderValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Order harus memiliki minimal 1 item'),
  body('items.*.product_id')
    .isInt({ min: 1 })
    .withMessage('ID produk harus berupa ID yang valid'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Jumlah item harus minimal 1'),
  body('items.*.size')
    .optional()
    .isString()
    .withMessage('Ukuran harus berupa string')
];

const statusValidation = [
  body('status')
    .isIn(['pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled', 'returned', 'refunded'])
    .withMessage('Status tidak valid')
];


const receiptNumberValidation = [
  body('receipt_number')
    .notEmpty()
    .withMessage('Nomor resi tidak boleh kosong')
    .isString()
    .withMessage('Nomor resi harus berupa string')
    .isLength({ min: 3, max: 50 })
    .withMessage('Nomor resi harus antara 3-50 karakter')
];

const paymentProofValidation = [
  body('payment_proof_url')
    .notEmpty()
    .withMessage('URL bukti pembayaran tidak boleh kosong')
    .isURL()
    .withMessage('URL bukti pembayaran tidak valid')
];

const verifyPaymentValidation = [
  body('verification_status')
    .isIn(['verified', 'rejected'])
    .withMessage('Status verifikasi harus verified atau rejected')
];


// Protected routes (all users)
router.get('/me', authenticate, getUserOrders);
router.get('/:id', authenticate, getOrderById);
router.post('/', authenticate, orderValidation, createOrder);
router.post('/:id/cancel', authenticate, cancelOrder);

// Admin routes
router.get('/', authenticate, authorize(['admin']), getAllOrders);
router.put('/:id/status', authenticate, authorize(['admin']), statusValidation, updateOrderStatus);

module.exports = router;