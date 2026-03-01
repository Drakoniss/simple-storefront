const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const { dbRun, dbGet, dbAll } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const { handleValidationErrors, validatePagination } = require('../middleware/validation');
const XLSX = require('xlsx');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for Excel file uploads (batch import)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.xlsx', '.xls'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls) are allowed'));
        }
    }
});

// Configure multer for image uploads
const imageUpload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname).toLowerCase();
            cb(null, 'product-' + uniqueSuffix + ext);
        }
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        if (allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (.jpg, .jpeg, .png, .webp, .gif) are allowed'));
        }
    }
});

// Upload product image (admin/manager only)
router.post('/upload-image', auth, authorize('admin', 'manager'), imageUpload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        const imageUrl = `/uploads/${req.file.filename}`;

        res.json({
            message: 'Image uploaded successfully',
            imageUrl: imageUrl,
            filename: req.file.filename
        });
    } catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

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

// Download Excel template for batch product import
router.get('/template/download', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        // Get categories and suppliers for reference
        const categories = await dbAll('SELECT id, name FROM categories WHERE is_active = 1 ORDER BY name');
        const suppliers = await dbAll('SELECT id, name FROM suppliers WHERE is_active = 1 ORDER BY name');

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Create template worksheet with headers and sample data
        const templateData = [
            ['SKU*', 'Name*', 'Description', 'Category', 'Supplier', 'Cost Price*', 'Selling Price*', 'Quantity', 'Min Stock Level', 'Max Stock Level', 'Barcode', 'Image URL'],
            ['SKU001', 'Sample Product', 'Product description', 'Electronics', 'Supplier Name', '10.00', '15.99', '100', '10', '500', '1234567890123', '']
        ];
        const ws = XLSX.utils.aoa_to_sheet(templateData);

        // Set column widths
        ws['!cols'] = [
            { wch: 12 },  // SKU
            { wch: 30 },  // Name
            { wch: 40 },  // Description
            { wch: 15 },  // Category
            { wch: 20 },  // Supplier
            { wch: 12 },  // Cost Price
            { wch: 12 },  // Selling Price
            { wch: 10 },  // Quantity
            { wch: 15 },  // Min Stock Level
            { wch: 15 },  // Max Stock Level
            { wch: 15 },  // Barcode
            { wch: 30 }   // Image URL
        ];

        XLSX.utils.book_append_sheet(wb, ws, 'Products Template');

        // Create reference worksheet with categories and suppliers
        const refData = [
            ['Categories'],
            ['ID', 'Name'],
            ...categories.map(c => [c.id, c.name]),
            [],
            ['Suppliers'],
            ['ID', 'Name'],
            ...suppliers.map(s => [s.id, s.name])
        ];
        const refWs = XLSX.utils.aoa_to_sheet(refData);
        XLSX.utils.book_append_sheet(wb, refWs, 'Reference Data');

        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename="products_template.xlsx"');
        res.send(buffer);
    } catch (error) {
        console.error('Template download error:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

// Batch import products from Excel file
router.post('/batch', auth, authorize('admin', 'manager'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Parse Excel file
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { raw: false });

        if (data.length === 0) {
            return res.status(400).json({ error: 'Excel file is empty or has no valid data rows' });
        }

        // Get categories and suppliers for name-to-id mapping
        const categories = await dbAll('SELECT id, name FROM categories WHERE is_active = 1');
        const suppliers = await dbAll('SELECT id, name FROM suppliers WHERE is_active = 1');

        const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));
        const supplierMap = new Map(suppliers.map(s => [s.name.toLowerCase(), s.id]));

        const results = {
            success: 0,
            failed: 0,
            errors: [],
            created: []
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2; // Excel row number (1-based, +1 for header)

            try {
                // Validate required fields
                const sku = row['SKU*'] || row['SKU']?.toString().trim();
                const name = row['Name*'] || row['Name']?.toString().trim();
                const costPrice = parseFloat(row['Cost Price*'] || row['Cost Price'] || row['CostPrice']);
                const sellingPrice = parseFloat(row['Selling Price*'] || row['Selling Price'] || row['SellingPrice']);

                if (!sku) {
                    results.failed++;
                    results.errors.push({ row: rowNum, error: 'SKU is required' });
                    continue;
                }
                if (!name) {
                    results.failed++;
                    results.errors.push({ row: rowNum, error: 'Name is required' });
                    continue;
                }
                if (isNaN(costPrice) || costPrice < 0) {
                    results.failed++;
                    results.errors.push({ row: rowNum, error: 'Valid cost price is required' });
                    continue;
                }
                if (isNaN(sellingPrice) || sellingPrice < 0) {
                    results.failed++;
                    results.errors.push({ row: rowNum, error: 'Valid selling price is required' });
                    continue;
                }

                // Check if SKU already exists
                const existing = await dbGet('SELECT id FROM products WHERE sku = ?', [sku]);
                if (existing) {
                    results.failed++;
                    results.errors.push({ row: rowNum, sku, error: 'SKU already exists' });
                    continue;
                }

                // Resolve category and supplier by name
                let categoryId = null;
                const categoryName = (row['Category'] || row['category'])?.toString().trim();
                if (categoryName) {
                    categoryId = categoryMap.get(categoryName.toLowerCase()) || null;
                }

                let supplierId = null;
                const supplierName = (row['Supplier'] || row['supplier'])?.toString().trim();
                if (supplierName) {
                    supplierId = supplierMap.get(supplierName.toLowerCase()) || null;
                }

                // Parse optional fields
                const description = (row['Description'] || row['description'])?.toString().trim() || null;
                const quantity = parseInt(row['Quantity'] || row['quantity']) || 0;
                const minStockLevel = parseInt(row['Min Stock Level'] || row['MinStockLevel'] || row['min_stock_level']) || 10;
                const maxStockLevel = parseInt(row['Max Stock Level'] || row['MaxStockLevel'] || row['max_stock_level']) || 100;
                const barcode = (row['Barcode'] || row['barcode'])?.toString().trim() || null;
                const imageUrl = (row['Image URL'] || row['ImageUrl'] || row['image_url'])?.toString().trim() || null;

                // Insert product
                const result = await dbRun(
                    `INSERT INTO products (sku, name, description, category_id, supplier_id,
                     cost_price, selling_price, quantity, min_stock_level, max_stock_level, barcode, image_url)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [sku, name, description, categoryId, supplierId, costPrice, sellingPrice,
                     quantity, minStockLevel, maxStockLevel, barcode, imageUrl]
                );

                // Log inventory transaction if quantity > 0
                if (quantity > 0) {
                    await dbRun(
                        `INSERT INTO inventory_transactions
                         (product_id, transaction_type, quantity, previous_quantity, new_quantity,
                          reference_type, notes, user_id)
                         VALUES (?, 'initial', ?, 0, ?, 'batch_import', 'Batch import', ?)`,
                        [result.id, quantity, quantity, req.user.id]
                    );
                }

                results.success++;
                results.created.push({ id: result.id, sku, name });

            } catch (error) {
                results.failed++;
                results.errors.push({ row: rowNum, error: error.message });
            }
        }

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (user_id, action, entity_type, details, ip_address) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, 'batch_import_products', 'product', JSON.stringify({
                total: data.length,
                success: results.success,
                failed: results.failed
            }), req.ip]
        );

        res.json({
            message: `Import completed: ${results.success} products created, ${results.failed} failed`,
            ...results
        });

    } catch (error) {
        console.error('Batch import error:', error);
        if (error.message.includes('Only Excel files')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to process import file' });
    }
});

// Download Excel template for batch import
router.get('/template', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        // Get categories and suppliers for reference
        const categories = await dbAll('SELECT id, name FROM categories WHERE is_active = 1 ORDER BY name');
        const suppliers = await dbAll('SELECT id, name FROM suppliers WHERE is_active = 1 ORDER BY name');

        // Create workbook
        const workbook = XLSX.utils.book_new();

        // Main template sheet
        const templateData = [
            ['SKU*', 'Name*', 'Description', 'Category', 'Supplier', 'Cost Price*', 'Selling Price*', 'Quantity', 'Min Stock Level', 'Max Stock Level', 'Barcode', 'Image URL'],
            ['SKU001', 'Product Name', 'Product description', 'Electronics', 'Supplier Name', '10.00', '15.00', '50', '10', '100', '1234567890123', ''],
            ['SKU002', 'Another Product', 'Another description', 'Food & Beverages', 'Another Supplier', '5.00', '8.00', '100', '20', '200', '', '']
        ];
        const templateSheet = XLSX.utils.aoa_to_sheet(templateData);

        // Set column widths
        templateSheet['!cols'] = [
            { wch: 12 }, // SKU
            { wch: 20 }, // Name
            { wch: 30 }, // Description
            { wch: 18 }, // Category
            { wch: 18 }, // Supplier
            { wch: 12 }, // Cost Price
            { wch: 12 }, // Selling Price
            { wch: 10 }, // Quantity
            { wch: 14 }, // Min Stock Level
            { wch: 14 }, // Max Stock Level
            { wch: 15 }, // Barcode
            { wch: 30 }  // Image URL
        ];

        XLSX.utils.book_append_sheet(workbook, templateSheet, 'Products');

        // Categories reference sheet
        const categoriesData = [['ID', 'Category Name']];
        categories.forEach(cat => categoriesData.push([cat.id, cat.name]));
        const categoriesSheet = XLSX.utils.aoa_to_sheet(categoriesData);
        XLSX.utils.book_append_sheet(workbook, categoriesSheet, 'Categories');

        // Suppliers reference sheet
        const suppliersData = [['ID', 'Supplier Name']];
        suppliers.forEach(sup => suppliersData.push([sup.id, sup.name]));
        const suppliersSheet = XLSX.utils.aoa_to_sheet(suppliersData);
        XLSX.utils.book_append_sheet(workbook, suppliersSheet, 'Suppliers');

        // Generate buffer
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=products_template.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Template download error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Batch import products from Excel
router.post('/batch', auth, authorize('admin', 'manager'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Parse Excel file
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];

        if (!sheetName) {
            return res.status(400).json({ error: 'Invalid Excel file: no sheets found' });
        }

        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { raw: false });

        if (data.length === 0) {
            return res.status(400).json({ error: 'Excel file is empty or has no data rows' });
        }

        // Get categories and suppliers for lookup
        const categories = await dbAll('SELECT id, name FROM categories WHERE is_active = 1');
        const suppliers = await dbAll('SELECT id, name FROM suppliers WHERE is_active = 1');

        const categoryMap = {};
        categories.forEach(cat => categoryMap[cat.name.toLowerCase()] = cat.id);

        const supplierMap = {};
        suppliers.forEach(sup => supplierMap[sup.name.toLowerCase()] = sup.id);

        const results = {
            success: 0,
            failed: 0,
            errors: [],
            created: []
        };

        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const rowNum = i + 2; // Excel row number (header is row 1)

            try {
                // Validate required fields
                const sku = row['SKU*'] || row['SKU']?.toString().trim();
                const name = row['Name*'] || row['Name']?.toString().trim();
                const costPrice = parseFloat(row['Cost Price*'] || row['Cost Price'] || 0);
                const sellingPrice = parseFloat(row['Selling Price*'] || row['Selling Price'] || 0);

                if (!sku) {
                    results.failed++;
                    results.errors.push(`Row ${rowNum}: SKU is required`);
                    continue;
                }

                if (!name) {
                    results.failed++;
                    results.errors.push(`Row ${rowNum}: Name is required`);
                    continue;
                }

                if (isNaN(costPrice) || costPrice < 0) {
                    results.failed++;
                    results.errors.push(`Row ${rowNum}: Valid cost price is required`);
                    continue;
                }

                if (isNaN(sellingPrice) || sellingPrice < 0) {
                    results.failed++;
                    results.errors.push(`Row ${rowNum}: Valid selling price is required`);
                    continue;
                }

                // Check if SKU already exists
                const existing = await dbGet('SELECT id FROM products WHERE sku = ?', [sku]);
                if (existing) {
                    results.failed++;
                    results.errors.push(`Row ${rowNum}: SKU "${sku}" already exists`);
                    continue;
                }

                // Resolve category
                const categoryName = (row['Category'] || '').toString().trim().toLowerCase();
                const categoryId = categoryMap[categoryName] || null;

                // Resolve supplier
                const supplierName = (row['Supplier'] || '').toString().trim().toLowerCase();
                const supplierId = supplierMap[supplierName] || null;

                // Parse optional fields
                const description = row['Description']?.toString().trim() || null;
                const quantity = parseInt(row['Quantity'] || 0) || 0;
                const minStockLevel = parseInt(row['Min Stock Level'] || 10) || 10;
                const maxStockLevel = parseInt(row['Max Stock Level'] || 100) || 100;
                const barcode = row['Barcode']?.toString().trim() || null;
                const imageUrl = row['Image URL']?.toString().trim() || null;

                // Insert product
                const result = await dbRun(
                    `INSERT INTO products (sku, name, description, category_id, supplier_id,
                     cost_price, selling_price, quantity, min_stock_level, max_stock_level, barcode, image_url)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [sku, name, description, categoryId, supplierId, costPrice, sellingPrice,
                     quantity, minStockLevel, maxStockLevel, barcode, imageUrl]
                );

                // Log inventory transaction if quantity > 0
                if (quantity > 0) {
                    await dbRun(
                        `INSERT INTO inventory_transactions
                         (product_id, transaction_type, quantity, previous_quantity, new_quantity,
                          reference_type, notes, user_id)
                         VALUES (?, 'initial', ?, 0, ?, 'batch_import', 'Batch import initial stock', ?)`,
                        [result.id, quantity, quantity, req.user.id]
                    );
                }

                results.success++;
                results.created.push({ sku, name, id: result.id });

            } catch (error) {
                results.failed++;
                results.errors.push(`Row ${rowNum}: ${error.message}`);
            }
        }

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [req.user.id, 'batch_import_products', 'product', 0, JSON.stringify({
                total: data.length,
                success: results.success,
                failed: results.failed
            }), req.ip]
        );

        res.json({
            message: `Batch import completed`,
            total: data.length,
            success: results.success,
            failed: results.failed,
            errors: results.errors.slice(0, 50), // Limit errors returned
            created: results.created.slice(0, 100) // Limit created items returned
        });

    } catch (error) {
        console.error('Batch import error:', error);
        if (error.message.includes('Only Excel files')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;