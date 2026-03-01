const express = require('express');
const router = express.Router();
const { dbGet, dbAll } = require('../config/database');
const { auth } = require('../middleware/auth');

// Dashboard summary
router.get('/summary', auth, async (req, res) => {
    try {
        // Today's sales (POS)
        const todaySales = await dbGet(
            `SELECT
             COUNT(*) as transactions,
             COALESCE(SUM(total), 0) as total,
             COALESCE(AVG(total), 0) as average
             FROM sales
             WHERE date(created_at) = date('now')
             AND payment_status != 'voided'`
        );

        // This week's sales
        const weekSales = await dbGet(
            `SELECT
             COUNT(*) as transactions,
             COALESCE(SUM(total), 0) as total
             FROM sales
             WHERE date(created_at) >= date('now', '-7 days')
             AND payment_status != 'voided'`
        );

        // This month's sales
        const monthSales = await dbGet(
            `SELECT
             COUNT(*) as transactions,
             COALESCE(SUM(total), 0) as total
             FROM sales
             WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')
             AND payment_status != 'voided'`
        );

        // Inventory alerts
        const lowStock = await dbGet(
            `SELECT COUNT(*) as count FROM products
             WHERE is_active = 1
             AND quantity <= min_stock_level
             AND quantity > 0`
        );

        const outOfStock = await dbGet(
            `SELECT COUNT(*) as count FROM products
             WHERE is_active = 1 AND quantity = 0`
        );

        // Inventory value
        const inventoryValue = await dbGet(
            `SELECT
             COUNT(*) as total_products,
             SUM(quantity) as total_units,
             SUM(quantity * cost_price) as total_value
             FROM products WHERE is_active = 1`
        );

        // Pending purchase orders
        const pendingPurchaseOrders = await dbGet(
            `SELECT COUNT(*) as count FROM purchase_orders WHERE status = 'pending'`
        );

        // Catalog orders stats
        const catalogOrders = await dbGet(
            `SELECT
             COUNT(*) as total_orders,
             COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_orders,
             COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0) as processing_orders,
             COALESCE(SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END), 0) as pending_payment_count,
             COALESCE(SUM(CASE WHEN date(created_at) = date('now') THEN total ELSE 0 END), 0) as today_total,
             COALESCE(SUM(CASE WHEN strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now') THEN total ELSE 0 END), 0) as month_total
             FROM orders
             WHERE status != 'cancelled'`
        );

        res.json({
            sales: {
                today: todaySales,
                week: weekSales,
                month: monthSales
            },
            inventory: {
                lowStock: lowStock.count,
                outOfStock: outOfStock.count,
                totalProducts: inventoryValue.total_products,
                totalUnits: inventoryValue.total_units,
                totalValue: inventoryValue.total_value
            },
            purchaseOrders: {
                pending: pendingPurchaseOrders.count
            },
            catalogOrders: {
                total: catalogOrders.total_orders || 0,
                pending: catalogOrders.pending_orders || 0,
                processing: catalogOrders.processing_orders || 0,
                pendingPayment: catalogOrders.pending_payment_count || 0,
                todayTotal: catalogOrders.today_total || 0,
                monthTotal: catalogOrders.month_total || 0
            }
        });
    } catch (error) {
        console.error('Dashboard summary error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Sales chart data
router.get('/sales-chart', auth, async (req, res) => {
    try {
        const { period = 'week' } = req.query;

        let dateFormat, dateFilter;
        switch (period) {
            case 'week':
                dateFormat = "%Y-%m-%d";
                dateFilter = "date('now', '-7 days')";
                break;
            case 'month':
                dateFormat = "%Y-%m-%d";
                dateFilter = "date('now', '-30 days')";
                break;
            case 'year':
                dateFormat = "%Y-%m";
                dateFilter = "date('now', '-365 days')";
                break;
            default:
                dateFormat = "%Y-%m-%d";
                dateFilter = "date('now', '-7 days')";
        }

        const data = await dbAll(
            `SELECT 
             strftime('${dateFormat}', created_at) as date,
             COUNT(*) as transactions,
             SUM(total) as total
             FROM sales 
             WHERE date(created_at) >= ${dateFilter}
             AND payment_status != 'voided'
             GROUP BY date
             ORDER BY date`
        );

        res.json(data);
    } catch (error) {
        console.error('Sales chart error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Top products
router.get('/top-products', auth, async (req, res) => {
    try {
        const { limit = 5, period = 'month' } = req.query;

        let dateFilter;
        switch (period) {
            case 'today':
                dateFilter = "date('now')";
                break;
            case 'week':
                dateFilter = "date('now', '-7 days')";
                break;
            case 'month':
                dateFilter = "date('now', '-30 days')";
                break;
            default:
                dateFilter = "date('now', '-30 days')";
        }

        const products = await dbAll(
            `SELECT 
             p.id, p.name, p.sku,
             SUM(si.quantity) as quantity_sold,
             SUM(si.total_price) as revenue
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             JOIN products p ON si.product_id = p.id
             WHERE date(s.created_at) >= ${dateFilter}
             AND s.payment_status != 'voided'
             GROUP BY p.id
             ORDER BY revenue DESC
             LIMIT ?`,
            [parseInt(limit)]
        );

        res.json(products);
    } catch (error) {
        console.error('Top products error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Recent sales
router.get('/recent-sales', auth, async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const sales = await dbAll(
            `SELECT s.id, s.receipt_number, s.total, s.payment_method, 
             s.created_at, c.name as customer_name
             FROM sales s
             LEFT JOIN customers c ON s.customer_id = c.id
             WHERE s.payment_status != 'voided'
             ORDER BY s.created_at DESC
             LIMIT ?`,
            [parseInt(limit)]
        );

        res.json(sales);
    } catch (error) {
        console.error('Recent sales error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Low stock alert
router.get('/low-stock', auth, async (req, res) => {
    try {
        const products = await dbAll(
            `SELECT id, sku, name, quantity, min_stock_level
             FROM products
             WHERE is_active = 1
             AND quantity <= min_stock_level
             ORDER BY quantity ASC
             LIMIT 20`
        );

        res.json(products);
    } catch (error) {
        console.error('Low stock error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Payment method breakdown
router.get('/payment-breakdown', auth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const breakdown = await dbAll(
            `SELECT 
             payment_method,
             COUNT(*) as count,
             SUM(total) as total
             FROM sales
             WHERE date(created_at) >= date(?)
             AND date(created_at) <= date(?)
             AND payment_status != 'voided'
             GROUP BY payment_method`,
            [startDate || '2000-01-01', endDate || '9999-12-31']
        );

        res.json(breakdown);
    } catch (error) {
        console.error('Payment breakdown error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Category distribution
router.get('/category-distribution', auth, async (req, res) => {
    try {
        const distribution = await dbAll(
            `SELECT 
             c.name as category,
             COUNT(p.id) as product_count,
             SUM(p.quantity) as total_quantity,
             SUM(p.quantity * p.cost_price) as value
             FROM categories c
             LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1
             GROUP BY c.id
             ORDER BY product_count DESC`
        );

        res.json(distribution);
    } catch (error) {
        console.error('Category distribution error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Staff performance (today)
router.get('/staff-performance', auth, async (req, res) => {
    try {
        const performance = await dbAll(
            `SELECT 
             u.id, u.full_name, u.role,
             COUNT(s.id) as transactions,
             COALESCE(SUM(s.total), 0) as total_sales
             FROM users u
             LEFT JOIN sales s ON u.id = s.user_id 
             AND date(s.created_at) = date('now')
             AND s.payment_status != 'voided'
             WHERE u.is_active = 1
             GROUP BY u.id
             ORDER BY total_sales DESC`
        );

        res.json(performance);
    } catch (error) {
        console.error('Staff performance error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Recent catalog orders
router.get('/recent-orders', auth, async (req, res) => {
    try {
        const { limit = 5 } = req.query;

        const orders = await dbAll(
            `SELECT o.id, o.order_number, o.customer_name, o.total, o.payment_method,
                    o.payment_status, o.status, o.created_at,
                    (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
             FROM orders o
             ORDER BY o.created_at DESC
             LIMIT ?`,
            [parseInt(limit)]
        );

        res.json(orders);
    } catch (error) {
        console.error('Recent orders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;