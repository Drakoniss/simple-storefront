const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { dbRun, dbGet, dbAll } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

// Get all categories
router.get('/', auth, async (req, res) => {
    try {
        const categories = await dbAll(
            `SELECT c.*, 
             (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count
             FROM categories c
             ORDER BY c.name`
        );
        res.json(categories);
    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get single category
router.get('/:id', auth, async (req, res) => {
    try {
        const category = await dbGet(
            `SELECT c.*, 
             (SELECT COUNT(*) FROM products WHERE category_id = c.id) as product_count
             FROM categories c WHERE c.id = ?`,
            [req.params.id]
        );

        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json(category);
    } catch (error) {
        console.error('Get category error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create category
router.post('/', auth, authorize('admin', 'manager'), [
    body('name').trim().notEmpty().withMessage('Category name is required')
], handleValidationErrors, async (req, res) => {
    try {
        const { name, description } = req.body;

        const existing = await dbGet('SELECT id FROM categories WHERE name = ?', [name]);
        if (existing) {
            return res.status(400).json({ error: 'Category already exists' });
        }

        const result = await dbRun(
            'INSERT INTO categories (name, description) VALUES (?, ?)',
            [name, description]
        );

        const category = await dbGet('SELECT * FROM categories WHERE id = ?', [result.id]);
        res.status(201).json(category);
    } catch (error) {
        console.error('Create category error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update category
router.put('/:id', auth, authorize('admin', 'manager'), [
    body('name').optional().trim().notEmpty().withMessage('Category name cannot be empty')
], handleValidationErrors, async (req, res) => {
    try {
        const category = await dbGet('SELECT * FROM categories WHERE id = ?', [req.params.id]);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        const { name, description, isActive } = req.body;

        await dbRun(
            `UPDATE categories SET 
             name = COALESCE(?, name),
             description = COALESCE(?, description),
             is_active = COALESCE(?, is_active)
             WHERE id = ?`,
            [name, description, isActive, req.params.id]
        );

        const updated = await dbGet('SELECT * FROM categories WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        console.error('Update category error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete category
router.delete('/:id', auth, authorize('admin'), async (req, res) => {
    try {
        const category = await dbGet('SELECT * FROM categories WHERE id = ?', [req.params.id]);
        if (!category) {
            return res.status(404).json({ error: 'Category not found' });
        }

        // Check if category has products
        const products = await dbGet(
            'SELECT COUNT(*) as count FROM products WHERE category_id = ?',
            [req.params.id]
        );

        if (products.count > 0) {
            return res.status(400).json({ 
                error: 'Cannot delete category with associated products' 
            });
        }

        await dbRun('DELETE FROM categories WHERE id = ?', [req.params.id]);
        res.json({ message: 'Category deleted successfully' });
    } catch (error) {
        console.error('Delete category error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;