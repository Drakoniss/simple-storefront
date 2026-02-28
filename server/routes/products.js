const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { dbRun, dbGet, dbAll } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const { handleValidationErrors, validatePagination } = require('../middleware/validation');

// Get all products
router.get('/', auth, validatePagination, async (req, res) => {
    try {
        const { search, category, supplier, lowStock, active } = req.query;
        
        let sql = `
            SELECT p.*, c.name as category_name, s.name as supplier_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            sql += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (category) {
            sql += ` AND p.category_id = ?`;
            params.push(category);
        }

        if (supplier) {
            sql += ` AND p.supplier_id = ?`;
            params.push(supplier);
        }

        if (lowStock === 'true') {
            sql += ` AND p.quantity <= p.min_stock_level`;
        }

        if (active !== undefined) {
            sql += ` AND p.is_active = ?`;
            params.push(active === 'true' ? 1 : 0);
        }

        // Get total count
        const countSql = sql.replace('SELECT p.*, c.name as category_name, s.name as supplier_name', 'SELECT COUNT(*) as count');
        const countResult = await dbGet(countSql, params);
        const total = countResult.count;

        // Add pagination
        sql += ` ORDER BY p.name LIMIT ? OFFSET ?`;
        params.push(req.query.limit, req.query.offset);

        const products = await dbAll(sql, params);

        res.json({
            products,
            pagination: {
                page: req.query.page,
                limit: req.query.limit,
                total,
                totalPages: Math.ceil(total / req.query.limit)
            }
        });
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single product
router.get('/:id', auth, async (req, res) => {
    try {
        const product = await dbGet(
            `SELECT p.*, c.name as category_name, s.name as supplier_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             LEFT JOIN suppliers s ON p.supplier_id = s.id
             WHERE p.id = ?`,
            [req.params.id]
        );

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create product
router.post('/', auth, authorize('admin', 'manager'), [
    body('sku').trim().notEmpty().withMessage('SKU is required'),
    body('name').trim().notEmpty().withMessage('Product name is required'),
    body('costPrice').isFloat({ min: 0 }).withMessage('Cost price must be a positive number'),
    body('sellingPrice').isFloat({ min: 0 }).withMessage('Selling price must be a positive number'),
    body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a positive integer')
], handleValidationErrors, async (req, res) => {
    try {
        const {
            sku, name, description, categoryId, supplierId,
            costPrice, sellingPrice, quantity, minStockLevel,
            maxStockLevel, barcode, imageUrl
        } = req.body;

        // Check if SKU exists
        const existing = await dbGet('SELECT id FROM products WHERE sku = ?', [sku]);
        if (existing) {
            return res.status(400).json({ error: 'SKU already exists' });
        }

        const result = await dbRun(
            `INSERT INTO products (sku, name, description, category_id, supplier_id, 
             cost_price, selling_price, quantity, min_stock_level, max_stock_level, barcode, image_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sku, name, description, categoryId, supplierId, costPrice, sellingPrice, 
             quantity || 0, minStockLevel || 10, maxStockLevel || 100, barcode, imageUrl]
        );

        // Log inventory transaction
        if (quantity && quantity > 0) {
            await dbRun(
                `INSERT INTO inventory_transactions 
                 (product_id, transaction_type, quantity, previous_quantity, new_quantity, 
                  reference_type, notes, user_id)
                 VALUES (?, 'initial', ?, 0, ?, 'stock_adjustment', 'Initial stock', ?)`,
                [result.id, quantity, quantity, req.user.id]
            );
        }

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'create_product', 'product', result.id, JSON.stringify({ name, sku }), req.ip]
        );

        const product = await dbGet('SELECT * FROM products WHERE id = ?', [result.id]);
        res.status(201).json(product);
    } catch (error) {
        console.error('Create product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update product
router.put('/:id', auth, authorize('admin', 'manager'), [
    body('name').optional().trim().notEmpty().withMessage('Product name cannot be empty'),
    body('costPrice').optional().isFloat({ min: 0 }).withMessage('Cost price must be a positive number'),
    body('sellingPrice').optional().isFloat({ min: 0 }).withMessage('Selling price must be a positive number')
], handleValidationErrors, async (req, res) => {
    try {
        const product = await dbGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const {
            name, description, categoryId, supplierId,
            costPrice, sellingPrice, minStockLevel, maxStockLevel,
            barcode, imageUrl, isActive
        } = req.body;

        await dbRun(
            `UPDATE products SET 
             name = COALESCE(?, name),
             description = COALESCE(?, description),
             category_id = COALESCE(?, category_id),
             supplier_id = COALESCE(?, supplier_id),
             cost_price = COALESCE(?, cost_price),
             selling_price = COALESCE(?, selling_price),
             min_stock_level = COALESCE(?, min_stock_level),
             max_stock_level = COALESCE(?, max_stock_level),
             barcode = COALESCE(?, barcode),
             image_url = COALESCE(?, image_url),
             is_active = COALESCE(?, is_active),
             updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [name, description, categoryId, supplierId, costPrice, sellingPrice,
             minStockLevel, maxStockLevel, barcode, imageUrl, isActive, req.params.id]
        );

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'update_product', 'product', req.params.id, JSON.stringify({ changes: req.body }), req.ip]
        );

        const updated = await dbGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        console.error('Update product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete product (soft delete)
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
    try {
        const product = await dbGet('SELECT * FROM products WHERE id = ?', [req.params.id]);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        await dbRun('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'delete_product', 'product', req.params.id, JSON.stringify({ name: product.name }), req.ip]
        );

        res.json({ message: 'Product deactivated successfully' });
    } catch (error) {
        console.error('Delete product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search products by barcode
router.get('/barcode/:barcode', auth, async (req, res) => {
    try {
        const product = await dbGet(
            'SELECT * FROM products WHERE barcode = ? AND is_active = 1',
            [req.params.barcode]
        );

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        console.error('Barcode search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;