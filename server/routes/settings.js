const express = require('express');
const router = express.Router();
const { dbRun, dbGet, dbAll } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');

// Get all settings
router.get('/', auth, async (req, res) => {
    try {
        const settings = await dbAll('SELECT key, value FROM settings');
        const result = {};
        settings.forEach(s => {
            result[s.key] = s.value;
        });
        res.json(result);
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update settings
router.put('/', auth, authorize('admin', 'manager'), async (req, res) => {
    try {
        const allowedSettings = ['store_name', 'store_address', 'store_phone', 'tax_rate', 'currency', 'receipt_footer'];
        
        for (const [key, value] of Object.entries(req.body)) {
            if (allowedSettings.includes(key)) {
                await dbRun(
                    'UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?',
                    [value, key]
                );
            }
        }

        // Log activity
        await dbRun(
            'INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
            [req.user.id, 'update_settings', JSON.stringify(req.body), req.ip]
        );

        const settings = await dbAll('SELECT key, value FROM settings');
        const result = {};
        settings.forEach(s => {
            result[s.key] = s.value;
        });
        res.json(result);
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;