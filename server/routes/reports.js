const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

// Sales report
router.get('/sales', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;

        let dateFormat;
        switch (groupBy) {
            case 'hour':
                dateFormat = "%Y-%m-%d %H:00";
                break;
            case 'day':
                dateFormat = "%Y-%m-%d";
                break;
            case 'week':
                dateFormat = "%Y-W%W";
                break;
            case 'month':
                dateFormat = "%Y-%m";
                break;
            default:
                dateFormat = "%Y-%m-%d";
        }

        const salesData = await dbAll(
            `SELECT 
             strftime('${dateFormat}', created_at) as period,
             COUNT(*) as transaction_count,
             SUM(total) as total_sales,
             SUM(subtotal) as subtotal,
             SUM(tax) as total_tax,
             SUM(discount) as total_discount,
             AVG(total) as average_sale
             FROM sales 
             WHERE date(created_at) >= date(?) 
             AND date(created_at) <= date(?)
             AND payment_status != 'voided'
             GROUP BY period
             ORDER BY period`,
            [startDate || '2000-01-01', endDate || '9999-12-31']
        );

        const summary = await dbGet(
            `SELECT 
             COUNT(*) as total_transactions,
             SUM(total) as total_sales,
             AVG(total) as average_sale,
             SUM(CASE WHEN payment_method = 'cash' THEN 1 ELSE 0 END) as cash_transactions,
             SUM(CASE WHEN payment_method = 'card' THEN 1 ELSE 0 END) as card_transactions,
             SUM(CASE WHEN payment_method = 'mobile' THEN 1 ELSE 0 END) as mobile_transactions
             FROM sales 
             WHERE date(created_at) >= date(?) 
             AND date(created_at) <= date(?)
             AND payment_status != 'voided'`,
            [startDate || '2000-01-01', endDate || '9999-12-31']
        );

        res.json({ summary, data: salesData });
    } catch (error) {
        console.error('Sales report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Products report (best sellers, slow movers)
router.get('/products', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { startDate, endDate, type = 'best-sellers', limit = 20 } = req.query;

        let orderBy = 'total_quantity DESC';
        if (type === 'slow-movers') {
            orderBy = 'total_quantity ASC';
        } else if (type === 'top-revenue') {
            orderBy = 'total_revenue DESC';
        }

        const products = await dbAll(
            `SELECT 
             p.id, p.sku, p.name, c.name as category_name,
             SUM(si.quantity) as total_quantity,
             SUM(si.total_price) as total_revenue,
             AVG(si.unit_price) as avg_unit_price
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             JOIN products p ON si.product_id = p.id
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE date(s.created_at) >= date(?) 
             AND date(s.created_at) <= date(?)
             AND s.payment_status != 'voided'
             GROUP BY p.id
             ORDER BY ${orderBy}
             LIMIT ?`,
            [startDate || '2000-01-01', endDate || '9999-12-31', parseInt(limit)]
        );

        res.json(products);
    } catch (error) {
        console.error('Products report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Inventory report
router.get('/inventory', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { category } = req.query;

        let sql = `
            SELECT 
            p.id, p.sku, p.name, c.name as category_name,
            p.quantity, p.min_stock_level, p.max_stock_level,
            p.cost_price, p.selling_price,
            (p.quantity * p.cost_price) as inventory_value,
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

        if (category) {
            sql += ` AND p.category_id = ?`;
            params.push(category);
        }

        sql += ` ORDER BY p.name`;

        const items = await dbAll(sql, params);

        const summary = {
            totalItems: items.length,
            totalUnits: items.reduce((sum, item) => sum + item.quantity, 0),
            totalValue: items.reduce((sum, item) => sum + item.inventory_value, 0),
            outOfStock: items.filter(item => item.stock_status === 'out_of_stock').length,
            lowStock: items.filter(item => item.stock_status === 'low_stock').length,
            inStock: items.filter(item => item.stock_status === 'in_stock').length
        };

        res.json({ summary, items });
    } catch (error) {
        console.error('Inventory report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Profit & Loss report
router.get('/profit-loss', auth, authorize('admin'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const salesData = await dbGet(
            `SELECT 
             COALESCE(SUM(total), 0) as total_revenue,
             COALESCE(SUM(subtotal), 0) as subtotal,
             COALESCE(SUM(tax), 0) as total_tax,
             COALESCE(SUM(discount), 0) as total_discount,
             COUNT(*) as total_transactions
             FROM sales 
             WHERE date(created_at) >= date(?) 
             AND date(created_at) <= date(?)
             AND payment_status != 'voided'`,
            [startDate || '2000-01-01', endDate || '9999-12-31']
        );

        const costData = await dbGet(
            `SELECT 
             COALESCE(SUM(si.quantity * p.cost_price), 0) as total_cost
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             JOIN products p ON si.product_id = p.id
             WHERE date(s.created_at) >= date(?) 
             AND date(s.created_at) <= date(?)
             AND s.payment_status != 'voided'`,
            [startDate || '2000-01-01', endDate || '9999-12-31']
        );

        const grossProfit = salesData.subtotal - costData.total_cost;
        const grossMargin = salesData.subtotal > 0 
            ? ((grossProfit / salesData.subtotal) * 100).toFixed(2) 
            : 0;

        res.json({
            period: { startDate, endDate },
            revenue: {
                grossSales: salesData.subtotal + salesData.total_discount,
                discounts: salesData.total_discount,
                netSales: salesData.subtotal,
                tax: salesData.total_tax,
                totalRevenue: salesData.total_revenue
            },
            costOfGoodsSold: costData.total_cost,
            grossProfit,
            grossMargin: `${grossMargin}%`,
            transactions: salesData.total_transactions
        });
    } catch (error) {
        console.error('Profit & Loss report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Staff performance report
router.get('/staff', auth, authorize('admin'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const staffData = await dbAll(
            `SELECT 
             u.id, u.username, u.full_name, u.role,
             COUNT(s.id) as total_transactions,
             COALESCE(SUM(s.total), 0) as total_sales,
             COALESCE(AVG(s.total), 0) as average_sale
             FROM users u
             LEFT JOIN sales s ON u.id = s.user_id 
             AND date(s.created_at) >= date(?) 
             AND date(s.created_at) <= date(?)
             AND s.payment_status != 'voided'
             GROUP BY u.id
             ORDER BY total_sales DESC`,
            [startDate || '2000-01-01', endDate || '9999-12-31']
        );

        res.json(staffData);
    } catch (error) {
        console.error('Staff report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Category performance
router.get('/categories', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const categoryData = await dbAll(
            `SELECT 
             c.id, c.name,
             COUNT(DISTINCT p.id) as product_count,
             COALESCE(SUM(si.quantity), 0) as units_sold,
             COALESCE(SUM(si.total_price), 0) as total_revenue
             FROM categories c
             LEFT JOIN products p ON c.id = p.category_id
             LEFT JOIN sale_items si ON p.id = si.product_id
             LEFT JOIN sales s ON si.sale_id = s.id
             AND date(s.created_at) >= date(?) 
             AND date(s.created_at) <= date(?)
             AND s.payment_status != 'voided'
             GROUP BY c.id
             ORDER BY total_revenue DESC`,
            [startDate || '2000-01-01', endDate || '9999-12-31']
        );

        res.json(categoryData);
    } catch (error) {
        console.error('Categories report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Hourly sales analysis
router.get('/hourly', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const hourlyData = await dbAll(
            `SELECT 
             strftime('%H', created_at) as hour,
             COUNT(*) as transaction_count,
             SUM(total) as total_sales,
             AVG(total) as average_sale
             FROM sales 
             WHERE date(created_at) >= date(?) 
             AND date(created_at) <= date(?)
             AND payment_status != 'voided'
             GROUP BY hour
             ORDER BY hour`,
            [startDate || '2000-01-01', endDate || '9999-12-31']
        );

        res.json(hourlyData);
    } catch (error) {
        console.error('Hourly report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Daily summary
router.get('/daily', auth, async (req, res) => {
    try {
        const { date = 'now' } = req.query;

        const sales = await dbGet(
            `SELECT 
             COUNT(*) as transactions,
             SUM(total) as total_sales,
             SUM(CASE WHEN payment_method = 'cash' THEN total ELSE 0 END) as cash,
             SUM(CASE WHEN payment_method = 'card' THEN total ELSE 0 END) as card,
             SUM(CASE WHEN payment_method = 'mobile' THEN total ELSE 0 END) as mobile
             FROM sales 
             WHERE date(created_at) = date(?)
             AND payment_status != 'voided'`,
            [date]
        );

        const items = await dbGet(
            `SELECT SUM(quantity) as total_items
             FROM sale_items si
             JOIN sales s ON si.sale_id = s.id
             WHERE date(s.created_at) = date(?)
             AND s.payment_status != 'voided'`,
            [date]
        );

        res.json({
            date,
            ...sales,
            items: items.total_items || 0
        });
    } catch (error) {
        console.error('Daily report error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;