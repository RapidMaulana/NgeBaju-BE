const { verifyToken } = require('../utils/jwtUtils');
const supabase = require('../config/supabase');

/**
 * Middleware untuk mengautentikasi user dengan JWT
 */
const authenticate = async (req, res, next) => {
  try {
    // Dapatkan token dari header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Akses ditolak. Token tidak ditemukan'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verifikasi token
    const decoded = verifyToken(token);
    
    // Cek apakah user masih ada di database
    const { data: user, error } = await supabase
      .from('users')
      .select('user_id, email, username, role')
      .eq('user_id', decoded.id)
      .single();
    
    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'User tidak ditemukan atau tidak valid'
      });
    }
    
    // Tambahkan user ke dalam request
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Token tidak valid atau kadaluarsa'
    });
  }
};

module.exports = { authenticate };