const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Authentication middleware
const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                error: 'Access denied. No token provided.' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const userQuery = 'SELECT id, username, email, first_name, last_name, account_type, status, avatar_url FROM users WHERE id = ? AND status = ?';
        const users = await db.query(userQuery, [decoded.id, 'active']);
        
        if (users.length === 0) {
            return res.status(401).json({ 
                error: 'Invalid token or user not found.' 
            });
        }

        req.user = users[0];
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                error: 'Invalid token.' 
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token expired.' 
            });
        }
        
        console.error('Auth middleware error:', error);
        res.status(500).json({ 
            error: 'Internal server error during authentication.' 
        });
    }
};

// Authorization middleware for specific roles
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Authentication required.' 
            });
        }

        if (!roles.includes(req.user.account_type) && req.user.account_type !== 'admin') {
            return res.status(403).json({ 
                error: 'Access denied. Insufficient permissions.' 
            });
        }

        next();
    };
};

// Admin authorization middleware
const adminAuth = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            error: 'Authentication required.' 
        });
    }

    if (req.user.account_type !== 'admin') {
        return res.status(403).json({ 
            error: 'Admin access required.' 
        });
    }

    next();
};

// Optional authentication middleware
const optionalAuth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const userQuery = 'SELECT id, username, email, first_name, last_name, account_type, status FROM users WHERE id = ? AND status = ?';
        const users = await db.query(userQuery, [decoded.id, 'active']);
        
        if (users.length > 0) {
            req.user = users[0];
        }
        
        next();
    } catch (error) {
        // Ignore token errors for optional auth
        next();
    }
};

// Generate JWT token
const generateToken = (payload, expiresIn = process.env.JWT_EXPIRE || '7d') => {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

// Generate refresh token
const generateRefreshToken = (payload) => {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { 
        expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' 
    });
};

// Verify refresh token
const verifyRefreshToken = (token) => {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

// Extract user from token without database lookup
const extractUserFromToken = (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded;
    } catch (error) {
        return null;
    }
};

module.exports = {
    auth,
    authorize,
    adminAuth,
    optionalAuth,
    generateToken,
    generateRefreshToken,
    verifyRefreshToken,
    extractUserFromToken
};