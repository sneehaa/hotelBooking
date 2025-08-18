const jwt = require('jsonwebtoken');

const authGuard = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: "Authorization header missing or malformed!"
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.userId,
      isAdmin: decoded.role === 'admin' || decoded.isAdmin === true
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const adminGuard = (req, res, next) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({
      success: false,
      message: "Administrator privileges required",
      user: {
        id: req.user?.id,
        isAdmin: req.user?.isAdmin
      }
    });
  }
  next();
};