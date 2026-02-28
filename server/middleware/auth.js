const jwt = require('jsonwebtoken');
const { dbGet } = require('../config/database');

// Authentication middleware
const auth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access denied. No token provided.' });
        }

        const token = authHeader.split(' ')[1];
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const user = await dbGet(
            'SELECT id, username, email, full_name, role, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (!user) {
            return res.status(401).json({ error: 'Invalid token. User not found.' });
        }

        if (!user.is_active) {
            return res.status(403).json({ error: 'Account is deactivated.' });
        }

        req.user = user;
        req.token = token;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token.' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired.' });
        }
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Role-based authorization middleware
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Access denied. Insufficient permissions.' 
            });
        }
        next();
    };
};

// Optional auth - doesn't require login but sets user if token exists
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await dbGet(
                'SELECT id, username, email, full_name, role, is_active FROM users WHERE id = ?',
                [decoded.userId]
            );
            if (user && user.is_active) {
                req.user = user;
            }
        }
        next();
    } catch (error) {
        // Continue without user
        next();
    }
};

// Check if user can perform POS operations
const canPOS = (req, res, next) => {
    const allowedRoles = ['admin', 'manager', 'cashier'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ 
            error: 'Access denied. POS access required.' 
        });
    }
    next();
};

// Check if user can manage inventory
const canManageInventory = (req, res, next) => {
    const allowedRoles = ['admin', 'manager'];
    if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ 
            error: 'Access denied. Inventory management permission required.' 
        });
    }
    next();
};

// Log activity middleware
const logActivity = (action) => {
    return async (req, res, next) => {
        // Store original end function
        const originalEnd = res.end;
        
        res.end = function(...args) {
            // Log after response
            if (res.statusCode < 400 && req.user) {
                const { dbRun } = require('../config/database');
                dbRun(
                    `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        req.user.id,
                        action,
                        req.params?.entityType || null,
                        req.params?.id || null,
                        JSON.stringify({ method: req.method, path: req.path, body: req.body }),
                        req.ip
                    ]
                ).catch(err => console.error('Failed to log activity:', err));
            }
            originalEnd.apply(res, args);
        };
        next();
    };
};

module.exports = {
    auth,
    authorize,
    optionalAuth,
    canPOS,
    canManageInventory,
    logActivity
};