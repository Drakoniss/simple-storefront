const express = require('express');
const router = express.Router();
const { dbGet, dbAll } = require('../config/database');

// Public catalog - no authentication required

// Get all active products for catalog
router.get('/products', async (req, res) => {
    try {
        const { search, category, limit = 50, offset = 0 } = req.query;

        let sql = `
            SELECT p.id, p.sku, p.name, p.description, p.category_id,
                   p.cost_price, p.selling_price, p.quantity, p.barcode, p.image_url,
                   c.name as category_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.is_active = 1
        `;
        const params = [];

        if (search) {
            sql += ` AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (category) {
            sql += ` AND p.category_id = ?`;
            params.push(category);
        }

        // Only show products with stock for public catalog
        sql += ` AND p.quantity > 0`;

        sql += ` ORDER BY p.name LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const products = await dbAll(sql, params);

        // Get total count for pagination
        let countSql = `
            SELECT COUNT(*) as count
            FROM products p
            WHERE p.is_active = 1 AND p.quantity > 0
        `;
        const countParams = [];

        if (search) {
            countSql += ` AND (p.name LIKE ? OR p.description LIKE ? OR p.sku LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (category) {
            countSql += ` AND p.category_id = ?`;
            countParams.push(category);
        }

        const countResult = await dbGet(countSql, countParams);

        res.json({
            products,
            pagination: {
                total: countResult.count,
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: (parseInt(offset) + parseInt(limit)) < countResult.count
            }
        });
    } catch (error) {
        console.error('Get catalog products error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single product for catalog
router.get('/products/:id', async (req, res) => {
    try {
        const product = await dbGet(
            `SELECT p.id, p.sku, p.name, p.description, p.category_id,
                    p.cost_price, p.selling_price, p.quantity, p.barcode, p.image_url,
                    c.name as category_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.id = ? AND p.is_active = 1`,
            [req.params.id]
        );

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json(product);
    } catch (error) {
        console.error('Get catalog product error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all active categories for catalog
router.get('/categories', async (req, res) => {
    try {
        const categories = await dbAll(
            `SELECT c.id, c.name, c.description,
                    COUNT(p.id) as product_count
             FROM categories c
             LEFT JOIN products p ON c.id = p.category_id AND p.is_active = 1 AND p.quantity > 0
             WHERE c.is_active = 1
             GROUP BY c.id
             ORDER BY c.name`
        );

        res.json(categories);
    } catch (error) {
        console.error('Get catalog categories error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Search products by barcode (public)
router.get('/barcode/:barcode', async (req, res) => {
    try {
        const product = await dbGet(
            `SELECT p.id, p.sku, p.name, p.description, p.selling_price,
                    p.quantity, p.image_url, c.name as category_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.barcode = ? AND p.is_active = 1 AND p.quantity > 0`,
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