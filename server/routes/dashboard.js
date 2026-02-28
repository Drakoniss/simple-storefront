const express = require('express');
const router = express.Router();
const { dbGet, dbAll } = require('../config/database');
const { auth } = require('../middleware/auth');

// Dashboard summary
router.get('/summary', auth, async (req, res) => {
    try {
        // Today's sales
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

        // Recent transactions count
        const pendingOrders = await dbGet(
            `SELECT COUNT(*) as count FROM purchase_orders WHERE status = 'pending'`
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
            orders: {
                pending: pendingOrders.count
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

module.exports = router;