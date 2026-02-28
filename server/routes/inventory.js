const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { dbRun, dbGet, dbAll } = require('../config/database');
const { auth, canManageInventory } = require('../middleware/auth');
const { handleValidationErrors, validatePagination } = require('../middleware/validation');

// Get inventory list
router.get('/', auth, validatePagination, async (req, res) => {
    try {
        const { search, category, lowStock, outOfStock } = req.query;

        let sql = `
            SELECT p.id, p.sku, p.name, p.quantity, p.min_stock_level, p.max_stock_level,
            p.cost_price, p.selling_price, c.name as category_name,
            CASE 
                WHEN p.quantity = 0 THEN 'out_of_stock'
                WHEN p.quantity <= p.min_stock_level THEN 'low_stock'
                ELSE 'in_stock'
            END as stock_status
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1
        `;
        const params = [];

        if (search) {
            sql += ` AND (p.name LIKE ? OR p.sku LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            sql += ` AND p.category_id = ?`;
            params.push(category);
        }

        if (lowStock === 'true') {
            sql += ` AND p.quantity <= p.min_stock_level AND p.quantity > 0`;
        }

        if (outOfStock === 'true') {
            sql += ` AND p.quantity = 0`;
        }

        // Get total count
        const countSql = sql.replace(
            'SELECT p.id, p.sku, p.name, p.quantity, p.min_stock_level, p.max_stock_level, p.cost_price, p.selling_price, c.name as category_name, CASE WHEN p.quantity = 0 THEN \'out_of_stock\' WHEN p.quantity <= p.min_stock_level THEN \'low_stock\' ELSE \'in_stock\' END as stock_status',
            'SELECT COUNT(*) as count'
        );
        const countResult = await dbGet(countSql, params);
        const total = countResult.count;

        sql += ` ORDER BY p.name LIMIT ? OFFSET ?`;
        params.push(req.query.limit, req.query.offset);

        const inventory = await dbAll(sql, params);

        res.json({
            inventory,
            pagination: {
                page: req.query.page,
                limit: req.query.limit,
                total,
                totalPages: Math.ceil(total / req.query.limit)
            }
        });
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get inventory transactions
router.get('/transactions', auth, validatePagination, async (req, res) => {
    try {
        const { productId, type, startDate, endDate } = req.query;

        let sql = `
            SELECT it.*, p.name as product_name, p.sku, u.full_name as user_name
            FROM inventory_transactions it
            JOIN products p ON it.product_id = p.id
            LEFT JOIN users u ON it.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (productId) {
            sql += ` AND it.product_id = ?`;
            params.push(productId);
        }

        if (type) {
            sql += ` AND it.transaction_type = ?`;
            params.push(type);
        }

        if (startDate) {
            sql += ` AND date(it.created_at) >= date(?)`;
            params.push(startDate);
        }

        if (endDate) {
            sql += ` AND date(it.created_at) <= date(?)`;
            params.push(endDate);
        }

        // Get total count
        const countSql = sql.replace(
            'SELECT it.*, p.name as product_name, p.sku, u.full_name as user_name',
            'SELECT COUNT(*) as count'
        );
        const countResult = await dbGet(countSql, params);
        const total = countResult.count;

        sql += ` ORDER BY it.created_at DESC LIMIT ? OFFSET ?`;
        params.push(req.query.limit, req.query.offset);

        const transactions = await dbAll(sql, params);

        res.json({
            transactions,
            pagination: {
                page: req.query.page,
                limit: req.query.limit,
                total,
                totalPages: Math.ceil(total / req.query.limit)
            }
        });
    } catch (error) {
        console.error('Get transactions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Stock adjustment
router.post('/adjust', auth, canManageInventory, [
    body('productId').isInt().withMessage('Product ID is required'),
    body('quantity').isInt().withMessage('Quantity is required'),
    body('type').isIn(['add', 'subtract', 'set']).withMessage('Invalid adjustment type'),
    body('reason').notEmpty().withMessage('Reason is required')
], handleValidationErrors, async (req, res) => {
    try {
        const { productId, quantity, type, reason } = req.body;

        const product = await dbGet('SELECT * FROM products WHERE id = ?', [productId]);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const previousQty = product.quantity;
        let newQty;

        switch (type) {
            case 'add':
                newQty = previousQty + quantity;
                break;
            case 'subtract':
                newQty = Math.max(0, previousQty - quantity);
                break;
            case 'set':
                newQty = quantity;
                break;
        }

        // Update product quantity
        await dbRun(
            'UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [newQty, productId]
        );

        // Create inventory transaction
        await dbRun(
            `INSERT INTO inventory_transactions 
             (product_id, transaction_type, quantity, previous_quantity, new_quantity, reference_type, notes, user_id)
             VALUES (?, 'adjustment', ?, ?, ?, 'manual', ?, ?)`,
            [productId, type === 'subtract' ? -quantity : quantity, previousQty, newQty, reason, req.user.id]
        );

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'stock_adjustment', 'product', productId, 
             JSON.stringify({ previousQty, newQty, type, reason }), req.ip]
        );

        res.json({
            message: 'Stock adjusted successfully',
            previousQuantity: previousQty,
            newQuantity: newQty
        });
    } catch (error) {
        console.error('Stock adjustment error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get low stock products
router.get('/low-stock', auth, async (req, res) => {
    try {
        const products = await dbAll(
            `SELECT p.*, c.name as category_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.is_active = 1 AND p.quantity <= p.min_stock_level
             ORDER BY p.quantity ASC`
        );

        res.json(products);
    } catch (error) {
        console.error('Get low stock error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get inventory summary
router.get('/summary', auth, async (req, res) => {
    try {
        const summary = await dbGet(
            `SELECT 
             COUNT(*) as total_products,
             SUM(quantity) as total_units,
             SUM(quantity * cost_price) as total_inventory_value,
             COUNT(CASE WHEN quantity = 0 THEN 1 END) as out_of_stock_count,
             COUNT(CASE WHEN quantity <= min_stock_level AND quantity > 0 THEN 1 END) as low_stock_count
             FROM products WHERE is_active = 1`
        );

        res.json(summary);
    } catch (error) {
        console.error('Get inventory summary error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Receive stock from purchase order
router.post('/receive/:poId', auth, canManageInventory, async (req, res) => {
    try {
        const { items } = req.body; // [{ productId, quantity }]

        const po = await dbGet(
            "SELECT * FROM purchase_orders WHERE id = ? AND status = 'approved'",
            [req.params.poId]
        );

        if (!po) {
            return res.status(404).json({ error: 'Purchase order not found or not approved' });
        }

        for (const item of items) {
            const product = await dbGet('SELECT quantity FROM products WHERE id = ?', [item.productId]);
            const previousQty = product.quantity;
            const newQty = previousQty + item.quantity;

            await dbRun(
                'UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newQty, item.productId]
            );

            await dbRun(
                `INSERT INTO inventory_transactions 
                 (product_id, transaction_type, quantity, previous_quantity, new_quantity, reference_type, reference_id, notes, user_id)
                 VALUES (?, 'receive', ?, ?, ?, 'purchase_order', ?, 'Received from PO', ?)`,
                [item.productId, item.quantity, previousQty, newQty, req.params.poId, req.user.id]
            );

            // Update PO item received quantity
            await dbRun(
                `UPDATE purchase_order_items SET received_quantity = received_quantity + ? 
                 WHERE po_id = ? AND product_id = ?`,
                [item.quantity, req.params.poId, item.productId]
            );
        }

        // Check if PO is complete
        const pendingItems = await dbGet(
            `SELECT COUNT(*) as count FROM purchase_order_items 
             WHERE po_id = ? AND quantity > received_quantity`,
            [req.params.poId]
        );

        if (pendingItems.count === 0) {
            await dbRun(
                "UPDATE purchase_orders SET status = 'received', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                [req.params.poId]
            );
        }

        res.json({ message: 'Stock received successfully' });
    } catch (error) {
        console.error('Receive stock error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Inventory count / audit
router.post('/count', auth, canManageInventory, [
    body('items').isArray({ min: 1 }).withMessage('Items array is required')
], handleValidationErrors, async (req, res) => {
    try {
        const { items } = req.body; // [{ productId, countedQuantity }]
        const results = [];

        for (const item of items) {
            const product = await dbGet('SELECT * FROM products WHERE id = ?', [item.productId]);
            if (!product) continue;

            const previousQty = product.quantity;
            const newQty = item.countedQuantity;
            const variance = newQty - previousQty;

            // Update product quantity
            await dbRun(
                'UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newQty, item.productId]
            );

            // Create inventory transaction
            await dbRun(
                `INSERT INTO inventory_transactions 
                 (product_id, transaction_type, quantity, previous_quantity, new_quantity, reference_type, notes, user_id)
                 VALUES (?, 'count', ?, ?, ?, 'inventory_count', ?, ?)`,
                [item.productId, variance, previousQty, newQty, 
                 `Inventory count. Variance: ${variance}`, req.user.id]
            );

            results.push({
                productId: item.productId,
                productName: product.name,
                previousQty,
                newQty,
                variance
            });
        }

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
            [req.user.id, 'inventory_count', JSON.stringify({ itemCount: items.length }), req.ip]
        );

        res.json({ message: 'Inventory count completed', results });
    } catch (error) {
        console.error('Inventory count error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;