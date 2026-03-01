const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { dbRun, dbGet, dbAll } = require('../config/database');
const { auth, canPOS } = require('../middleware/auth');

// Generate unique order number
function generateOrderNumber() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
}

// Create new order (public endpoint - no auth required)
router.post('/', [
    body('customerName').optional().trim(),
    body('customerEmail').optional().isEmail().withMessage('Valid email required'),
    body('customerPhone').optional().trim(),
    body('items').isArray({ min: 1 }).withMessage('At least one item required'),
    body('items.*.productId').isInt({ min: 1 }).withMessage('Valid product ID required'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('paymentMethod').isIn(['cash', 'card', 'bank_transfer', 'cash_on_delivery']).withMessage('Valid payment method required'),
    body('shippingAddress').optional().trim(),
    body('notes').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            customerName,
            customerEmail,
            customerPhone,
            items,
            paymentMethod,
            shippingAddress,
            notes
        } = req.body;

        // Validate products and calculate totals
        let subtotal = 0;
        const orderItems = [];

        for (const item of items) {
            const product = await dbGet(
                'SELECT id, name, selling_price, quantity FROM products WHERE id = ? AND is_active = 1',
                [item.productId]
            );

            if (!product) {
                return res.status(400).json({ error: `Product with ID ${item.productId} not found` });
            }

            if (product.quantity < item.quantity) {
                return res.status(400).json({
                    error: `Insufficient stock for "${product.name}". Available: ${product.quantity}, Requested: ${item.quantity}`
                });
            }

            const itemTotal = product.selling_price * item.quantity;
            subtotal += itemTotal;

            orderItems.push({
                productId: product.id,
                productName: product.name,
                quantity: item.quantity,
                unitPrice: product.selling_price,
                totalPrice: itemTotal
            });
        }

        // Get tax rate from settings
        const taxSetting = await dbGet('SELECT value FROM settings WHERE key = ?', ['tax_rate']);
        const taxRate = parseFloat(taxSetting?.value) || 0;
        const taxAmount = subtotal * (taxRate / 100);
        const total = subtotal + taxAmount;

        // Generate order number
        const orderNumber = generateOrderNumber();

        // Create order
        const orderResult = await dbRun(
            `INSERT INTO orders (order_number, customer_name, customer_email, customer_phone,
             subtotal, tax, total, payment_method, payment_status, shipping_address, notes, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                orderNumber,
                customerName || 'Guest',
                customerEmail || null,
                customerPhone || null,
                subtotal,
                taxAmount,
                total,
                paymentMethod,
                paymentMethod === 'cash_on_delivery' ? 'pending' : 'pending',
                shippingAddress || null,
                notes || null,
                'pending'
            ]
        );

        // Create order items and update inventory
        for (const item of orderItems) {
            await dbRun(
                `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [orderResult.id, item.productId, item.productName, item.quantity, item.unitPrice, item.totalPrice]
            );

            // Update product stock
            await dbRun(
                'UPDATE products SET quantity = quantity - ? WHERE id = ?',
                [item.quantity, item.productId]
            );

            // Log inventory transaction
            await dbRun(
                `INSERT INTO inventory_transactions (product_id, transaction_type, quantity, notes, created_at)
                 VALUES (?, 'sale', ?, 'Order: ' || ?, datetime('now'))`,
                [item.productId, -item.quantity, orderNumber]
            );
        }

        // Return order confirmation
        const order = await dbGet(
            `SELECT o.*,
                    GROUP_CONCAT(oi.product_name || ' x' || oi.quantity) as items_summary
             FROM orders o
             LEFT JOIN order_items oi ON o.id = oi.order_id
             WHERE o.id = ?
             GROUP BY o.id`,
            [orderResult.id]
        );

        res.status(201).json({
            message: 'Order created successfully',
            order: {
                orderNumber: order.order_number,
                customerName: order.customer_name,
                customerEmail: order.customer_email,
                subtotal: order.subtotal,
                tax: order.tax,
                total: order.total,
                paymentMethod: order.payment_method,
                paymentStatus: order.payment_status,
                status: order.status,
                createdAt: order.created_at
            },
            items: orderItems
        });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// Get order by order number (public - for order tracking)
router.get('/:orderNumber', async (req, res) => {
    try {
        const order = await dbGet(
            'SELECT * FROM orders WHERE order_number = ?',
            [req.params.orderNumber]
        );

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const items = await dbAll(
            `SELECT oi.*, p.image_url
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?`,
            [order.id]
        );

        res.json({
            order: {
                orderNumber: order.order_number,
                customerName: order.customer_name,
                customerEmail: order.customer_email,
                customerPhone: order.customer_phone,
                subtotal: order.subtotal,
                tax: order.tax,
                shipping: order.shipping,
                discount: order.discount,
                total: order.total,
                paymentMethod: order.payment_method,
                paymentStatus: order.payment_status,
                status: order.status,
                shippingAddress: order.shipping_address,
                notes: order.notes,
                createdAt: order.created_at,
                updatedAt: order.updated_at
            },
            items
        });
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update order status (for payment confirmation, etc.)
router.patch('/:orderNumber/status', async (req, res) => {
    try {
        const { status, paymentStatus } = req.body;

        const order = await dbGet(
            'SELECT * FROM orders WHERE order_number = ?',
            [req.params.orderNumber]
        );

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
        const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];

        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
            return res.status(400).json({ error: 'Invalid payment status' });
        }

        const updates = [];
        const params = [];

        if (status) {
            updates.push('status = ?');
            params.push(status);
        }

        if (paymentStatus) {
            updates.push('payment_status = ?');
            params.push(paymentStatus);
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.orderNumber);

        await dbRun(
            `UPDATE orders SET ${updates.join(', ')} WHERE order_number = ?`,
            params
        );

        const updatedOrder = await dbGet(
            'SELECT * FROM orders WHERE order_number = ?',
            [req.params.orderNumber]
        );

        res.json({
            message: 'Order status updated',
            order: {
                orderNumber: updatedOrder.order_number,
                status: updatedOrder.status,
                paymentStatus: updatedOrder.payment_status
            }
        });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ ADMIN ENDPOINTS ============

// Get all orders (admin only)
router.get('/admin/list', auth, canPOS, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;
        const status = req.query.status || '';
        const dateFrom = req.query.dateFrom || '';
        const dateTo = req.query.dateTo || '';
        const search = req.query.search || '';

        let whereConditions = [];
        let params = [];

        if (status) {
            whereConditions.push('o.status = ?');
            params.push(status);
        }

        if (dateFrom) {
            whereConditions.push('date(o.created_at) >= date(?)');
            params.push(dateFrom);
        }

        if (dateTo) {
            whereConditions.push('date(o.created_at) <= date(?)');
            params.push(dateTo);
        }

        if (search) {
            whereConditions.push('(o.order_number LIKE ? OR o.customer_name LIKE ? OR o.customer_email LIKE ?)');
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // Get total count
        const countResult = await dbGet(
            `SELECT COUNT(*) as total FROM orders o ${whereClause}`,
            params
        );

        // Get orders with item count
        const orders = await dbAll(
            `SELECT o.*,
                    (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count,
                    (SELECT GROUP_CONCAT(product_name, ', ') FROM order_items WHERE order_id = o.id LIMIT 3) as items_preview
             FROM orders o
             ${whereClause}
             ORDER BY o.created_at DESC
             LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        res.json({
            orders: orders.map(order => ({
                id: order.id,
                orderNumber: order.order_number,
                customerName: order.customer_name,
                customerEmail: order.customer_email,
                customerPhone: order.customer_phone,
                subtotal: order.subtotal,
                tax: order.tax,
                shipping: order.shipping,
                discount: order.discount,
                total: order.total,
                paymentMethod: order.payment_method,
                paymentStatus: order.payment_status,
                status: order.status,
                itemCount: order.item_count,
                itemsPreview: order.items_preview,
                shippingAddress: order.shipping_address,
                notes: order.notes,
                createdAt: order.created_at,
                updatedAt: order.updated_at
            })),
            pagination: {
                page,
                limit,
                total: countResult.total,
                totalPages: Math.ceil(countResult.total / limit)
            }
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get order statistics (admin only)
router.get('/admin/stats', auth, canPOS, async (req, res) => {
    try {
        const stats = await dbGet(
            `SELECT
                COUNT(*) as total_orders,
                COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_orders,
                COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0) as processing_orders,
                COALESCE(SUM(CASE WHEN status = 'shipped' THEN 1 ELSE 0 END), 0) as shipped_orders,
                COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) as delivered_orders,
                COALESCE(SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END), 0) as cancelled_orders,
                COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN total ELSE 0 END), 0) as pending_payment_total,
                COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) as paid_total
             FROM orders`
        );

        res.json(stats || {});
    } catch (error) {
        console.error('Get order stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get order details by ID (admin only)
router.get('/admin/:id', auth, canPOS, async (req, res) => {
    try {
        const order = await dbGet(
            'SELECT * FROM orders WHERE id = ?',
            [req.params.id]
        );

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const items = await dbAll(
            `SELECT oi.*, p.image_url, p.sku as product_sku, p.quantity as current_stock
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = ?`,
            [order.id]
        );

        res.json({
            order: {
                id: order.id,
                orderNumber: order.order_number,
                customerName: order.customer_name,
                customerEmail: order.customer_email,
                customerPhone: order.customer_phone,
                subtotal: order.subtotal,
                tax: order.tax,
                shipping: order.shipping,
                discount: order.discount,
                total: order.total,
                paymentMethod: order.payment_method,
                paymentStatus: order.payment_status,
                status: order.status,
                shippingAddress: order.shipping_address,
                notes: order.notes,
                createdAt: order.created_at,
                updatedAt: order.updated_at
            },
            items: items.map(item => ({
                id: item.id,
                productId: item.product_id,
                productName: item.product_name,
                productSku: item.product_sku,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                totalPrice: item.total_price,
                imageUrl: item.image_url,
                currentStock: item.current_stock
            }))
        });
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update order status by ID (admin only)
router.patch('/admin/:id/status', auth, canPOS, async (req, res) => {
    try {
        const { status, paymentStatus, notes } = req.body;

        const order = await dbGet(
            'SELECT * FROM orders WHERE id = ?',
            [req.params.id]
        );

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
        const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];

        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        if (paymentStatus && !validPaymentStatuses.includes(paymentStatus)) {
            return res.status(400).json({ error: 'Invalid payment status' });
        }

        const updates = [];
        const params = [];

        if (status) {
            updates.push('status = ?');
            params.push(status);
        }

        if (paymentStatus) {
            updates.push('payment_status = ?');
            params.push(paymentStatus);
        }

        if (notes !== undefined) {
            updates.push('notes = ?');
            params.push(notes);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No updates provided' });
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        await dbRun(
            `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        const updatedOrder = await dbGet(
            'SELECT * FROM orders WHERE id = ?',
            [req.params.id]
        );

        res.json({
            message: 'Order updated successfully',
            order: {
                id: updatedOrder.id,
                orderNumber: updatedOrder.order_number,
                status: updatedOrder.status,
                paymentStatus: updatedOrder.payment_status,
                notes: updatedOrder.notes
            }
        });
    } catch (error) {
        console.error('Update order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Cancel order and restore inventory (admin only)
router.post('/admin/:id/cancel', auth, canPOS, async (req, res) => {
    try {
        const { reason } = req.body;

        const order = await dbGet(
            'SELECT * FROM orders WHERE id = ?',
            [req.params.id]
        );

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        if (order.status === 'cancelled') {
            return res.status(400).json({ error: 'Order is already cancelled' });
        }

        if (order.status === 'delivered') {
            return res.status(400).json({ error: 'Cannot cancel a delivered order' });
        }

        // Get order items
        const items = await dbAll(
            'SELECT * FROM order_items WHERE order_id = ?',
            [order.id]
        );

        // Restore inventory for each item
        for (const item of items) {
            await dbRun(
                'UPDATE products SET quantity = quantity + ? WHERE id = ?',
                [item.quantity, item.product_id]
            );

            // Log inventory transaction
            await dbRun(
                `INSERT INTO inventory_transactions (product_id, transaction_type, quantity, notes, created_at)
                 VALUES (?, 'adjustment', ?, 'Order cancelled: ' || ?, datetime('now'))`,
                [item.product_id, item.quantity, order.order_number]
            );
        }

        // Update order status
        await dbRun(
            `UPDATE orders SET status = 'cancelled', notes = COALESCE(notes || ' | ', '') || 'Cancelled: ' || ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [reason || 'No reason provided', order.id]
        );

        res.json({
            message: 'Order cancelled and inventory restored',
            order: {
                id: order.id,
                orderNumber: order.order_number,
                status: 'cancelled'
            },
            restoredItems: items.length
        });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;