const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { dbRun, dbGet, dbAll } = require('../config/database');
const { auth, authorize, canPOS } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

// Generate receipt number
const generateReceiptNumber = async () => {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await dbGet(
        "SELECT COUNT(*) as count FROM sales WHERE date(created_at) = date('now')"
    );
    const seq = String(count.count + 1).padStart(4, '0');
    return `RCP-${today}-${seq}`;
};

// Get all sales
router.get('/', auth, async (req, res) => {
    try {
        const { startDate, endDate, paymentMethod, status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let sql = `
            SELECT s.*, c.name as customer_name, u.full_name as user_name
            FROM sales s
            LEFT JOIN customers c ON s.customer_id = c.id
            LEFT JOIN users u ON s.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (startDate) {
            sql += ` AND date(s.created_at) >= date(?)`;
            params.push(startDate);
        }

        if (endDate) {
            sql += ` AND date(s.created_at) <= date(?)`;
            params.push(endDate);
        }

        if (paymentMethod) {
            sql += ` AND s.payment_method = ?`;
            params.push(paymentMethod);
        }

        if (status) {
            sql += ` AND s.payment_status = ?`;
            params.push(status);
        }

        // Get total count
        const countSql = sql.replace(
            'SELECT s.*, c.name as customer_name, u.full_name as user_name',
            'SELECT COUNT(*) as count'
        );
        const countResult = await dbGet(countSql, params);
        const total = countResult.count;

        sql += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), offset);

        const sales = await dbAll(sql, params);

        res.json({
            sales,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Get sales error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single sale with items
router.get('/:id', auth, async (req, res) => {
    try {
        const sale = await dbGet(
            `SELECT s.*, c.name as customer_name, c.phone as customer_phone, u.full_name as user_name
             FROM sales s
             LEFT JOIN customers c ON s.customer_id = c.id
             LEFT JOIN users u ON s.user_id = u.id
             WHERE s.id = ?`,
            [req.params.id]
        );

        if (!sale) {
            return res.status(404).json({ error: 'Sale not found' });
        }

        const items = await dbAll(
            `SELECT si.*, p.name as product_name, p.sku
             FROM sale_items si
             JOIN products p ON si.product_id = p.id
             WHERE si.sale_id = ?`,
            [req.params.id]
        );

        sale.items = items;
        res.json(sale);
    } catch (error) {
        console.error('Get sale error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create sale (POS transaction)
router.post('/', auth, canPOS, [
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('paymentMethod').isIn(['cash', 'card', 'mobile', 'credit']).withMessage('Invalid payment method')
], handleValidationErrors, async (req, res) => {
    try {
        const { customerId, items, paymentMethod, discount, tax, notes } = req.body;

        // Validate products and calculate totals
        let subtotal = 0;
        const saleItems = [];

        for (const item of items) {
            const product = await dbGet(
                'SELECT * FROM products WHERE id = ? AND is_active = 1',
                [item.productId]
            );

            if (!product) {
                return res.status(400).json({ 
                    error: `Product with ID ${item.productId} not found` 
                });
            }

            if (product.quantity < item.quantity) {
                return res.status(400).json({ 
                    error: `Insufficient stock for ${product.name}. Available: ${product.quantity}` 
                });
            }

            const unitPrice = item.unitPrice || product.selling_price;
            const totalPrice = unitPrice * item.quantity;
            subtotal += totalPrice;

            saleItems.push({
                productId: product.id,
                quantity: item.quantity,
                unitPrice,
                totalPrice
            });
        }

        const taxAmount = tax || 0;
        const discountAmount = discount || 0;
        const total = subtotal + taxAmount - discountAmount;

        // Generate receipt number
        const receiptNumber = await generateReceiptNumber();

        // Begin transaction (using serialized operations)
        // Create sale
        const saleResult = await dbRun(
            `INSERT INTO sales (receipt_number, customer_id, user_id, subtotal, tax, discount, total, payment_method, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [receiptNumber, customerId, req.user.id, subtotal, taxAmount, discountAmount, total, paymentMethod, notes]
        );

        // Create sale items and update inventory
        for (const item of saleItems) {
            // Get current product quantity
            const product = await dbGet('SELECT quantity FROM products WHERE id = ?', [item.productId]);
            const previousQty = product.quantity;
            const newQty = previousQty - item.quantity;

            // Insert sale item
            await dbRun(
                `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, total_price)
                 VALUES (?, ?, ?, ?, ?)`,
                [saleResult.id, item.productId, item.quantity, item.unitPrice, item.totalPrice]
            );

            // Update product quantity
            await dbRun(
                'UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newQty, item.productId]
            );

            // Create inventory transaction
            await dbRun(
                `INSERT INTO inventory_transactions 
                 (product_id, transaction_type, quantity, previous_quantity, new_quantity, reference_type, reference_id, user_id)
                 VALUES (?, 'sale', ?, ?, ?, 'sale', ?, ?)`,
                [item.productId, -item.quantity, previousQty, newQty, saleResult.id, req.user.id]
            );
        }

        // Update customer loyalty points if applicable
        if (customerId) {
            const pointsEarned = Math.floor(total / 10); // 1 point per $10
            await dbRun(
                `UPDATE customers SET 
                 loyalty_points = loyalty_points + ?,
                 total_purchases = total_purchases + ?
                 WHERE id = ?`,
                [pointsEarned, total, customerId]
            );
        }

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'create_sale', 'sale', saleResult.id, JSON.stringify({ receiptNumber, total }), req.ip]
        );

        const sale = await dbGet(
            `SELECT s.*, c.name as customer_name FROM sales s 
             LEFT JOIN customers c ON s.customer_id = c.id 
             WHERE s.id = ?`,
            [saleResult.id]
        );

        const itemsResult = await dbAll(
            `SELECT si.*, p.name as product_name FROM sale_items si 
             JOIN products p ON si.product_id = p.id 
             WHERE si.sale_id = ?`,
            [saleResult.id]
        );

        sale.items = itemsResult;

        res.status(201).json(sale);
    } catch (error) {
        console.error('Create sale error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Void a sale
router.post('/:id/void', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        const sale = await dbGet('SELECT * FROM sales WHERE id = ?', [req.params.id]);
        if (!sale) {
            return res.status(404).json({ error: 'Sale not found' });
        }

        if (sale.payment_status === 'voided') {
            return res.status(400).json({ error: 'Sale already voided' });
        }

        // Get sale items to restore inventory
        const items = await dbAll('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);

        // Restore inventory
        for (const item of items) {
            const product = await dbGet('SELECT quantity FROM products WHERE id = ?', [item.product_id]);
            const previousQty = product.quantity;
            const newQty = previousQty + item.quantity;

            await dbRun(
                'UPDATE products SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [newQty, item.product_id]
            );

            await dbRun(
                `INSERT INTO inventory_transactions 
                 (product_id, transaction_type, quantity, previous_quantity, new_quantity, reference_type, reference_id, notes, user_id)
                 VALUES (?, 'void_sale', ?, ?, ?, 'sale', ?, 'Voided sale', ?)`,
                [item.product_id, item.quantity, previousQty, newQty, req.params.id, req.user.id]
            );
        }

        // Update sale status
        await dbRun(
            "UPDATE sales SET payment_status = 'voided', notes = COALESCE(notes || ' - VOIDED', 'VOIDED') WHERE id = ?",
            [req.params.id]
        );

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'void_sale', 'sale', req.params.id, JSON.stringify({ receiptNumber: sale.receipt_number }), req.ip]
        );

        res.json({ message: 'Sale voided successfully' });
    } catch (error) {
        console.error('Void sale error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get today's sales summary
router.get('/summary/today', auth, async (req, res) => {
    try {
        const summary = await dbGet(
            `SELECT 
             COUNT(*) as total_transactions,
             COALESCE(SUM(total), 0) as total_sales,
             COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END), 0) as cash_sales,
             COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END), 0) as card_sales,
             COALESCE(SUM(CASE WHEN payment_method = 'mobile' THEN total ELSE 0 END), 0) as mobile_sales
             FROM sales 
             WHERE date(created_at) = date('now') AND payment_status != 'voided'`
        );

        res.json(summary);
    } catch (error) {
        console.error('Get sales summary error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;