const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const bcrypt = require('bcryptjs');
const { dbRun, dbGet, dbAll } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const { handleValidationErrors, validatePagination } = require('../middleware/validation');

// Get all users
router.get('/', auth, authorize('admin'), validatePagination, async (req, res) => {
    try {
        const { search, role, status } = req.query;

        let sql = `SELECT id, username, email, full_name, role, is_active, last_login, created_at FROM users WHERE 1=1`;
        const params = [];

        if (search) {
            sql += ` AND (username LIKE ? OR email LIKE ? OR full_name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (role) {
            sql += ` AND role = ?`;
            params.push(role);
        }

        if (status) {
            sql += ` AND is_active = ?`;
            params.push(status === 'active' ? 1 : 0);
        }

        // Get total count
        const countSql = sql.replace('SELECT id, username, email, full_name, role, is_active, last_login, created_at', 'SELECT COUNT(*) as count');
        const countResult = await dbGet(countSql, params);
        const total = countResult.count;

        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(req.query.limit, req.query.offset);

        const users = await dbAll(sql, params);

        res.json({
            users,
            pagination: {
                page: req.query.page,
                limit: req.query.limit,
                total,
                totalPages: Math.ceil(total / req.query.limit)
            }
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single user
router.get('/:id', auth, authorize('admin'), async (req, res) => {
    try {
        const user = await dbGet(
            'SELECT id, username, email, full_name, role, is_active, last_login, created_at FROM users WHERE id = ?',
            [req.params.id]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get activity summary
        const activity = await dbGet(
            `SELECT COUNT(*) as total_actions 
             FROM activity_log WHERE user_id = ?`,
            [req.params.id]
        );

        const sales = await dbGet(
            `SELECT COUNT(*) as total_sales, COALESCE(SUM(total), 0) as total_value 
             FROM sales WHERE user_id = ?`,
            [req.params.id]
        );

        user.activity = activity;
        user.sales = sales;

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create user
router.post('/', auth, authorize('admin'), [
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('role').isIn(['admin', 'manager', 'cashier', 'staff']).withMessage('Invalid role')
], handleValidationErrors, async (req, res) => {
    try {
        const { username, password, email, fullName, role } = req.body;

        // Check if username exists
        const existing = await dbGet('SELECT id FROM users WHERE username = ?', [username.toLowerCase()]);
        if (existing) {
            return res.status(400).json({ error: 'Username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await dbRun(
            `INSERT INTO users (username, password, email, full_name, role)
             VALUES (?, ?, ?, ?, ?)`,
            [username.toLowerCase(), hashedPassword, email, fullName, role]
        );

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'create_user', 'user', result.id, JSON.stringify({ username, role }), req.ip]
        );

        const user = await dbGet(
            'SELECT id, username, email, full_name, role, is_active, created_at FROM users WHERE id = ?',
            [result.id]
        );

        res.status(201).json(user);
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user
router.put('/:id', auth, authorize('admin'), [
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('role').optional().isIn(['admin', 'manager', 'cashier', 'staff']).withMessage('Invalid role')
], handleValidationErrors, async (req, res) => {
    try {
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const { email, fullName, role, isActive } = req.body;

        await dbRun(
            `UPDATE users SET 
             email = COALESCE(?, email),
             full_name = COALESCE(?, full_name),
             role = COALESCE(?, role),
             is_active = COALESCE(?, is_active),
             updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [email, fullName, role, isActive ? 1 : (isActive === false ? 0 : undefined), req.params.id]
        );

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'update_user', 'user', req.params.id, JSON.stringify(req.body), req.ip]
        );

        const updated = await dbGet(
            'SELECT id, username, email, full_name, role, is_active, created_at FROM users WHERE id = ?',
            [req.params.id]
        );

        res.json(updated);
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reset password
router.post('/:id/reset-password', auth, authorize('admin'), [
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], handleValidationErrors, async (req, res) => {
    try {
        const { newPassword } = req.body;

        const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await dbRun(
            'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [hashedPassword, req.params.id]
        );

        // Invalidate all sessions for this user
        await dbRun('DELETE FROM sessions WHERE user_id = ?', [req.params.id]);

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (user_id, action, entity_type, entity_id, ip_address) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'reset_password', 'user', req.params.id, req.ip]
        );

        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Deactivate user
router.post('/:id/deactivate', auth, authorize('admin'), async (req, res) => {
    try {
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent deactivating self
        if (user.id === req.user.id) {
            return res.status(400).json({ error: 'Cannot deactivate your own account' });
        }

        await dbRun('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);

        // Invalidate all sessions
        await dbRun('DELETE FROM sessions WHERE user_id = ?', [req.params.id]);

        res.json({ message: 'User deactivated successfully' });
    } catch (error) {
        console.error('Deactivate user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Activate user
router.post('/:id/activate', auth, authorize('admin'), async (req, res) => {
    try {
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        await dbRun('UPDATE users SET is_active = 1 WHERE id = ?', [req.params.id]);

        res.json({ message: 'User activated successfully' });
    } catch (error) {
        console.error('Activate user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
    try {
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent deleting self
        if (user.id === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        // Check for related records
        const sales = await dbGet('SELECT COUNT(*) as count FROM sales WHERE user_id = ?', [req.params.id]);
        if (sales.count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete user with sales records. Deactivate instead.' 
            });
        }

        await dbRun('DELETE FROM users WHERE id = ?', [req.params.id]);

        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get activity log
router.get('/:id/activity', auth, authorize('admin'), async (req, res) => {
    try {
        const { limit = 50 } = req.query;

        const activities = await dbAll(
            `SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
            [req.params.id, parseInt(limit)]
        );

        res.json(activities);
    } catch (error) {
        console.error('Get user activity error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;