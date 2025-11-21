const express = require('express');
const router = express.Router();
const UserService = require('../services/userService');
const PropertyService = require('../services/propertyService');
const { body, validationResult } = require('express-validator');

const userService = new UserService();
const propertyService = new PropertyService();

// Middleware to check if user is admin
const adminMiddleware = async (req, res, next) => {
    try {
        if (req.user.account_type !== 'admin' && req.user.account_type !== 'super_admin') {
            return res.status(403).json({
                success: false,
                error: 'Access denied. Admin privileges required.'
            });
        }
        next();
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to verify admin privileges'
        });
    }
};

// Apply admin middleware to all routes
router.use(adminMiddleware);

// Get admin dashboard statistics
router.get('/dashboard', async (req, res) => {
    try {
        const [stats] = await db.execute(
            `SELECT 
                (SELECT COUNT(*) FROM users WHERE status = 'active') as total_users,
                (SELECT COUNT(*) FROM properties WHERE status = 'approved') as total_properties,
                (SELECT COUNT(*) FROM auctions WHERE status = 'live') as live_auctions,
                (SELECT COUNT(*) FROM auctions WHERE status = 'ended' AND current_price > 0) as completed_auctions,
                (SELECT COUNT(*) FROM bids WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)) as bids_24h,
                (SELECT COUNT(*) FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)) as new_users_7d
            FROM dual`
        );

        const [recentActivity] = await db.execute(
            `SELECT 
                'user' as type, u.first_name, u.last_name, u.created_at, 'New user registered' as description
             FROM users u
             ORDER BY u.created_at DESC
             LIMIT 5
             
             UNION ALL
             
             SELECT 
                'property' as type, p.title as first_name, '' as last_name, p.created_at, 'New property listed' as description
             FROM properties p
             ORDER BY p.created_at DESC
             LIMIT 5
             
             UNION ALL
             
             SELECT 
                'bid' as type, CAST(b.amount AS CHAR) as first_name, '' as last_name, b.created_at, 'New bid placed' as description
             FROM bids b
             JOIN auctions a ON b.auction_id = a.id
             JOIN properties p ON a.property_id = p.id
             ORDER BY b.created_at DESC
             LIMIT 5
             
             ORDER BY created_at DESC
             LIMIT 10`
        );

        const [pendingVerifications] = await db.execute(
            `SELECT 
                u.id, u.first_name, u.last_name, u.email, u.created_at,
                'identity' as verification_type
             FROM users u
             WHERE u.identity_verified = FALSE AND u.status = 'pending'
             ORDER BY u.created_at DESC
             LIMIT 10`
        );

        const dashboard = {
            stats: stats[0],
            recentActivity,
            pendingVerifications
        };

        res.json({
            success: true,
            data: dashboard
        });

    } catch (error) {
        console.error('Get admin dashboard error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch admin dashboard'
        });
    }
});

// Get all users with filtering and pagination
router.get('/users', async (req, res) => {
    try {
        const { search, accountType, status, page = 1, limit = 20 } = req.query;

        let query = `
            SELECT 
                u.id, u.username, u.email, u.first_name, u.last_name, u.phone,
                u.account_type, u.status, u.email_verified, u.phone_verified,
                u.identity_verified, u.created_at, u.last_login,
                COUNT(DISTINCT p.id) as properties_count,
                COUNT(DISTINCT b.id) as bids_count
            FROM users u
            LEFT JOIN properties p ON u.id = p.owner_id
            LEFT JOIN bids b ON u.id = b.user_id
            WHERE 1=1
        `;

        const params = [];

        if (search) {
            query += ' AND (u.username LIKE ? OR u.email LIKE ? OR u.first_name LIKE ? OR u.last_name LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        if (accountType) {
            query += ' AND u.account_type = ?';
            params.push(accountType);
        }

        if (status) {
            query += ' AND u.status = ?';
            params.push(status);
        }

        query += ' GROUP BY u.id ORDER BY u.created_at DESC';

        // Add pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [users] = await db.execute(query, params);

        // Get total count
        const [countRows] = await db.execute(
            `SELECT COUNT(*) as total FROM users WHERE 1=1 ${search ? 'AND (username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)' : ''}`,
            search ? [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`] : []
        );

        res.json({
            success: true,
            data: users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countRows[0].total,
                pages: Math.ceil(countRows[0].total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch users'
        });
    }
});

// Get single user details
router.get('/users/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID'
            });
        }

        const [userRows] = await db.execute(
            `SELECT 
                u.*,
                COUNT(DISTINCT p.id) as properties_count,
                COUNT(DISTINCT b.id) as bids_count,
                COUNT(DISTINCT a.id) as auctions_count
             FROM users u
             LEFT JOIN properties p ON u.id = p.owner_id
             LEFT JOIN bids b ON u.id = b.user_id
             LEFT JOIN auctions a ON p.id = a.property_id
             WHERE u.id = ?
             GROUP BY u.id`,
            [userId]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = userRows[0];
        user.preferred_locations = JSON.parse(user.preferred_locations || '[]');
        user.preferred_property_types = JSON.parse(user.preferred_property_types || '[]');

        // Remove sensitive information
        delete user.password_hash;

        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch user'
        });
    }
});

// Update user status
router.put('/users/:id/status', [
    body('status').isIn(['active', 'suspended', 'banned', 'pending']).withMessage('Invalid status')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const userId = parseInt(req.params.id);
        const { status } = req.body;
        const adminId = req.user.id;

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID'
            });
        }

        const result = await userService.updateUserStatus(userId, status, adminId);

        res.json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update user status'
        });
    }
});

// Verify user identity
router.put('/users/:id/verify', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID'
            });
        }

        const result = await userService.updateVerificationStatus(userId, 'identity', true);

        res.json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error('Verify user error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to verify user'
        });
    }
});

// Get all properties with admin view
router.get('/properties', async (req, res) => {
    try {
        const { status, search, page = 1, limit = 20 } = req.query;

        let query = `
            SELECT 
                p.*,
                l.name as location_name,
                c.name as category_name,
                owner.first_name as owner_first_name,
                owner.last_name as owner_last_name,
                owner.email as owner_email,
                agent.first_name as agent_first_name,
                agent.last_name as agent_last_name,
                COUNT(DISTINCT a.id) as auction_count,
                COUNT(DISTINCT b.id) as bid_count
            FROM properties p
            LEFT JOIN locations l ON p.location_id = l.id
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN users owner ON p.owner_id = owner.id
            LEFT JOIN users agent ON p.agent_id = agent.id
            LEFT JOIN auctions a ON p.id = a.property_id
            LEFT JOIN bids b ON a.id = b.auction_id
            WHERE 1=1
        `;

        const params = [];

        if (status) {
            query += ' AND p.status = ?';
            params.push(status);
        }

        if (search) {
            query += ' AND (p.title LIKE ? OR p.address LIKE ? OR owner.first_name LIKE ? OR owner.last_name LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        query += ' GROUP BY p.id ORDER BY p.created_at DESC';

        // Add pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [properties] = await db.execute(query, params);

        // Parse JSON fields
        const processedProperties = properties.map(property => ({
            ...property,
            features: JSON.parse(property.features || '[]'),
            amenities: JSON.parse(property.amenities || '[]'),
            images: JSON.parse(property.images || '[]'),
            documents: JSON.parse(property.documents || '[]')
        }));

        // Get total count
        const [countRows] = await db.execute(
            `SELECT COUNT(*) as total FROM properties p WHERE 1=1 ${status ? 'AND p.status = ?' : ''}`,
            status ? [status] : []
        );

        res.json({
            success: true,
            data: processedProperties,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countRows[0].total,
                pages: Math.ceil(countRows[0].total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Get admin properties error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch properties'
        });
    }
});

// Approve or reject property
router.put('/properties/:id/status', [
    body('status').isIn(['approved', 'rejected', 'pending']).withMessage('Invalid status'),
    body('reason').optional().trim().isLength({ min: 10 }).withMessage('Reason must be at least 10 characters for rejection')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const propertyId = parseInt(req.params.id);
        const { status, reason } = req.body;
        const adminId = req.user.id;

        if (isNaN(propertyId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid property ID'
            });
        }

        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            // Update property status
            await connection.execute(
                'UPDATE properties SET status = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?',
                [status, adminId, propertyId]
            );

            // Create property history entry
            await connection.execute(
                'INSERT INTO property_history (property_id, action, changed_by, changed_at, changes) VALUES (?, ?, ?, NOW(), ?)',
                [propertyId, status, adminId, JSON.stringify({ status, reason })]
            );

            // Get property owner for notification
            const [propertyRows] = await connection.execute(
                'SELECT owner_id, title FROM properties WHERE id = ?',
                [propertyId]
            );

            if (propertyRows.length > 0) {
                const property = propertyRows[0];
                
                // Create notification for property owner
                await connection.execute(
                    'INSERT INTO notifications (user_id, type, title, message, data, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                    [
                        property.owner_id,
                        'property_status_change',
                        `Property ${status}`,
                        `Your property "${property.title}" has been ${status}${reason ? ': ' + reason : ''}`,
                        JSON.stringify({ propertyId, status, reason })
                    ]
                );
            }

            await connection.commit();
            connection.release();

            res.json({
                success: true,
                message: `Property ${status} successfully`
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Update property status error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update property status'
        });
    }
});

// Get system settings
router.get('/settings', async (req, res) => {
    try {
        const [settings] = await db.execute(
            'SELECT * FROM system_settings ORDER BY category, key_name'
        );

        const settingsObject = {};
        settings.forEach(setting => {
            if (!settingsObject[setting.category]) {
                settingsObject[setting.category] = {};
            }
            settingsObject[setting.category][setting.key_name] = {
                value: setting.value,
                description: setting.description,
                type: setting.type
            };
        });

        res.json({
            success: true,
            data: settingsObject
        });

    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch settings'
        });
    }
});

// Update system settings
router.put('/settings', async (req, res) => {
    try {
        const { settings } = req.body;
        const adminId = req.user.id;

        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            for (const category in settings) {
                for (const key in settings[category]) {
                    const { value } = settings[category][key];
                    
                    await connection.execute(
                        'UPDATE system_settings SET value = ?, updated_at = NOW() WHERE category = ? AND key_name = ?',
                        [value, category, key]
                    );
                }
            }

            // Create admin action log
            await connection.execute(
                'INSERT INTO admin_action_logs (admin_id, action, details, created_at) VALUES (?, ?, ?, NOW())',
                [adminId, 'settings_updated', JSON.stringify(settings)]
            );

            await connection.commit();
            connection.release();

            res.json({
                success: true,
                message: 'Settings updated successfully'
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update settings'
        });
    }
});

// Get admin action logs
router.get('/logs', async (req, res) => {
    try {
        const { action, startDate, endDate, page = 1, limit = 50 } = req.query;

        let query = `
            SELECT 
                aal.*,
                u.first_name as admin_first_name,
                u.last_name as admin_last_name,
                tu.first_name as target_first_name,
                tu.last_name as target_last_name
            FROM admin_action_logs aal
            LEFT JOIN users u ON aal.admin_id = u.id
            LEFT JOIN users tu ON aal.target_user_id = tu.id
            WHERE 1=1
        `;

        const params = [];

        if (action) {
            query += ' AND aal.action = ?';
            params.push(action);
        }

        if (startDate) {
            query += ' AND aal.created_at >= ?';
            params.push(startDate);
        }

        if (endDate) {
            query += ' AND aal.created_at <= ?';
            params.push(endDate);
        }

        query += ' ORDER BY aal.created_at DESC';

        // Add pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [logs] = await db.execute(query, params);

        // Get total count
        const [countRows] = await db.execute(
            'SELECT COUNT(*) as total FROM admin_action_logs WHERE 1=1',
            []
        );

        res.json({
            success: true,
            data: logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countRows[0].total,
                pages: Math.ceil(countRows[0].total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Get admin logs error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch admin logs'
        });
    }
});

module.exports = router;