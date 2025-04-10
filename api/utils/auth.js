const jwt = require('jsonwebtoken');
require('dotenv').config();

// Middleware to verify JWT token
const verifyToken = (req) => {
  // Get token from Authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  // Format should be "Bearer [token]"
  const token = authHeader.split(' ')[1];
  if (!token) {
    return null;
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    return null;
  }
};

// Higher-order function to require authentication
const requireAuth = (handler) => {
  return async (req, res) => {
    const user = verifyToken(req);
    
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    
    // Add user to request object
    req.user = user;
    
    // Call the original handler
    return handler(req, res);
  };
};

// Higher-order function to require admin access
const requireAdmin = (handler) => {
  return async (req, res) => {
    const user = verifyToken(req);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    // Add user to request object
    req.user = user;
    
    // Call the original handler
    return handler(req, res);
  };
};

module.exports = {
  verifyToken,
  requireAuth,
  requireAdmin
};