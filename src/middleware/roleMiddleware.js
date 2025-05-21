/**
 * Middleware untuk membatasi akses berdasarkan role
 * @param {Array} roles - Array role yang diizinkan
 * @returns {Function} Middleware
 */
const authorize = (roles = []) => {
    // Konversi string role menjadi array
    if (typeof roles === 'string') {
      roles = [roles];
    }
  
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized'
        });
      }
  
      // Cek apakah role user ada dalam array roles yang diizinkan
      if (roles.length && !roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Anda tidak memiliki akses untuk resource ini'
        });
      }
  
      // Lanjutkan jika user memiliki role yang sesuai
      next();
    };
  };
  
  module.exports = { authorize };