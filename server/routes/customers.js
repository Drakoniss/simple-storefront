const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { dbRun, dbGet, dbAll } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const { handleValidationErrors, validatePagination } = require('../middleware/validation');

// Get all customers
router.get('/', auth, validatePagination, async (req, res) => {
    try {
        const { search } = req.query;

        let sql = `SELECT * FROM customers WHERE 1=1`;
        const params = [];

        if (search) {
            sql += ` AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Get total count
        const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
        const countResult = await dbGet(countSql, params);
        const total = countResult.count;

        sql += ` ORDER BY name LIMIT ? OFFSET ?`;
        params.push(req.query.limit, req.query.offset);

        const customers = await dbAll(sql, params);

        res.json({
            customers,
            pagination: {
                page: req.query.page,
                limit: req.query.limit,
                total,
                totalPages: Math.ceil(total / req.query.limit)
            }
        });
    } catch (error) {
        console.error('Get customers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single customer
router.get('/:id', auth, async (req, res) => {
    try {
        const customer = await dbGet('SELECT * FROM customers WHERE id = ?', [req.params.id]);

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Get purchase history
        const purchases = await dbAll(
            `SELECT id, receipt_number, total, created_at 
             FROM sales WHERE customer_id = ? 
             ORDER BY created_at DESC LIMIT 10`,
            [req.params.id]
        );

        customer.recentPurchases = purchases;
        res.json(customer);
    } catch (error) {
        console.error('Get customer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create customer
router.post('/', auth, [
    body('name').trim().notEmpty().withMessage('Customer name is required')
], handleValidationErrors, async (req, res) => {
    try {
        const { name, email, phone, address } = req.body;

        const result = await dbRun(
            'INSERT INTO customers (name, email, phone, address) VALUES (?, ?, ?, ?)',
            [name, email, phone, address]
        );

        const customer = await dbGet('SELECT * FROM customers WHERE id = ?', [result.id]);
        res.status(201).json(customer);
    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update customer
router.put('/:id', auth, [
    body('name').optional().trim().notEmpty().withMessage('Customer name cannot be empty')
], handleValidationErrors, async (req, res) => {
    try {
        const customer = await dbGet('SELECT * FROM customers WHERE id = ?', [req.params.id]);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const { name, email, phone, address } = req.body;

        await dbRun(
            `UPDATE customers SET 
             name = COALESCE(?, name),
             email = COALESCE(?, email),
             phone = COALESCE(?, phone),
             address = COALESCE(?, address)
             WHERE id = ?`,
            [name, email, phone, address, req.params.id]
        );

        const updated = await dbGet('SELECT * FROM customers WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        console.error('Update customer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete customer
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
    try {
        const customer = await dbGet('SELECT * FROM customers WHERE id = ?', [req.params.id]);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Check for sales history
        const sales = await dbGet(
            'SELECT COUNT(*) as count FROM sales WHERE customer_id = ?',
            [req.params.id]
        );

        if (sales.count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete customer with purchase history' 
            });
        }

        await dbRun('DELETE FROM customers WHERE id = ?', [req.params.id]);
        res.json({ message: 'Customer deleted successfully' });
    } catch (error) {
        console.error('Delete customer error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get customer purchase history
router.get('/:id/history', auth, async (req, res) => {
    try {
        const sales = await dbAll(
            `SELECT s.*, 
             (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as item_count
             FROM sales s 
             WHERE s.customer_id = ? 
             ORDER BY s.created_at DESC`,
            [req.params.id]
        );

        res.json(sales);
    } catch (error) {
        console.error('Get customer history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Adjust loyalty points
router.post('/:id/points', auth, authorize('admin', 'manager'), [
    body('points').isInt().withMessage('Points adjustment is required'),
    body('reason').notEmpty().withMessage('Reason is required')
], handleValidationErrors, async (req, res) => {
    try {
        const { points, reason } = req.body;
        const customer = await dbGet('SELECT * FROM customers WHERE id = ?', [req.params.id]);

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const newPoints = Math.max(0, customer.loyalty_points + points);

        await dbRun(
            'UPDATE customers SET loyalty_points = ? WHERE id = ?',
            [newPoints, req.params.id]
        );

        const updated = await dbGet('SELECT * FROM customers WHERE id = ?', [req.params.id]);
        res.json({ 
            message: 'Points adjusted successfully', 
            previousPoints: customer.loyalty_points,
            newPoints,
            adjustment: points
        });
    } catch (error) {
        console.error('Adjust points error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;