const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { dbRun, dbGet, dbAll } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const { handleValidationErrors, validatePagination } = require('../middleware/validation');

// Get all suppliers
router.get('/', auth, async (req, res) => {
    try {
        const suppliers = await dbAll(
            `SELECT s.*, 
             (SELECT COUNT(*) FROM products WHERE supplier_id = s.id) as product_count
             FROM suppliers s
             ORDER BY s.name`
        );
        res.json(suppliers);
    } catch (error) {
        console.error('Get suppliers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single supplier
router.get('/:id', auth, async (req, res) => {
    try {
        const supplier = await dbGet(
            `SELECT s.*, 
             (SELECT COUNT(*) FROM products WHERE supplier_id = s.id) as product_count
             FROM suppliers s WHERE s.id = ?`,
            [req.params.id]
        );

        if (!supplier) {
            return res.status(404).json({ error: 'Supplier not found' });
        }

        // Get products from this supplier
        const products = await dbAll(
            'SELECT id, sku, name, quantity, cost_price FROM products WHERE supplier_id = ?',
            [req.params.id]
        );

        supplier.products = products;
        res.json(supplier);
    } catch (error) {
        console.error('Get supplier error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create supplier
router.post('/', auth, authorize('admin', 'manager'), [
    body('name').trim().notEmpty().withMessage('Supplier name is required')
], handleValidationErrors, async (req, res) => {
    try {
        const { name, contactPerson, email, phone, address } = req.body;

        const result = await dbRun(
            `INSERT INTO suppliers (name, contact_person, email, phone, address)
             VALUES (?, ?, ?, ?, ?)`,
            [name, contactPerson, email, phone, address]
        );

        const supplier = await dbGet('SELECT * FROM suppliers WHERE id = ?', [result.id]);
        res.status(201).json(supplier);
    } catch (error) {
        console.error('Create supplier error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update supplier
router.put('/:id', auth, authorize('admin', 'manager'), [
    body('name').optional().trim().notEmpty().withMessage('Supplier name cannot be empty')
], handleValidationErrors, async (req, res) => {
    try {
        const supplier = await dbGet('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
        if (!supplier) {
            return res.status(404).json({ error: 'Supplier not found' });
        }

        const { name, contactPerson, email, phone, address, isActive } = req.body;

        await dbRun(
            `UPDATE suppliers SET 
             name = COALESCE(?, name),
             contact_person = COALESCE(?, contact_person),
             email = COALESCE(?, email),
             phone = COALESCE(?, phone),
             address = COALESCE(?, address),
             is_active = COALESCE(?, is_active)
             WHERE id = ?`,
            [name, contactPerson, email, phone, address, isActive, req.params.id]
        );

        const updated = await dbGet('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        console.error('Update supplier error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete supplier
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
    try {
        const supplier = await dbGet('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
        if (!supplier) {
            return res.status(404).json({ error: 'Supplier not found' });
        }

        // Check for associated products
        const products = await dbGet(
            'SELECT COUNT(*) as count FROM products WHERE supplier_id = ?',
            [req.params.id]
        );

        if (products.count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete supplier with associated products. Deactivate instead.' 
            });
        }

        await dbRun('DELETE FROM suppliers WHERE id = ?', [req.params.id]);
        res.json({ message: 'Supplier deleted successfully' });
    } catch (error) {
        console.error('Delete supplier error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Purchase orders for supplier
router.get('/:id/orders', auth, async (req, res) => {
    try {
        const orders = await dbAll(
            `SELECT * FROM purchase_orders WHERE supplier_id = ? ORDER BY created_at DESC`,
            [req.params.id]
        );
        res.json(orders);
    } catch (error) {
        console.error('Get supplier orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;