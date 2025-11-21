const express = require('express');
const router = express.Router();
const UserService = require('../services/userService');
const { body, validationResult } = require('express-validator');

const userService = new UserService();

// Get current user profile
router.get('/profile', async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await userService.getUserById(userId);

        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(error.message === 'User not found' ? 404 : 500).json({
            success: false,
            error: error.message || 'Failed to fetch profile'
        });
    }
});

// Update user profile
router.put('/profile', [
    body('firstName').optional().trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
    body('lastName').optional().trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
    body('phone').optional().isMobilePhone().withMessage('Please enter a valid phone number'),
    body('dateOfBirth').optional().isDate().withMessage('Please enter a valid date of birth'),
    body('nationality').optional().trim().isLength({ min: 2 }).withMessage('Please enter your nationality'),
    body('accountType').optional().isIn(['bidder', 'seller', 'both']).withMessage('Invalid account type'),
    body('budgetRangeMin').optional().isInt({ min: 0 }).withMessage('Budget range minimum must be a positive number'),
    body('budgetRangeMax').optional().isInt({ min: 0 }).withMessage('Budget range maximum must be a positive number')
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const userId = req.user.id;
        const result = await userService.updateUser(userId, req.body);

        res.json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to update profile'
        });
    }
});

// Update password
router.put('/password', [
    body('currentPassword').isLength({ min: 8 }).withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters'),
    body('confirmPassword').custom((value, { req }) => {
        if (value !== req.body.newPassword) {
            throw new Error('Password confirmation does not match');
        }
        return true;
    })
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const userId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        const result = await userService.updatePassword(userId, currentPassword, newPassword);

        res.json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error('Update password error:', error);
        res.status(error.message === 'Current password is incorrect' ? 400 : 500).json({
            success: false,
            error: error.message || 'Failed to update password'
        });
    }
});

// Get user dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const userId = req.user.id;
        const dashboard = await userService.getUserDashboard(userId);

        res.json({
            success: true,
            data: dashboard
        });

    } catch (error) {
        console.error('Get dashboard error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch dashboard'
        });
    }
});

// Get user notifications
router.get('/notifications', async (req, res) => {
    try {
        const userId = req.user.id;
        const { type, isRead, page, limit } = req.query;

        const filters = {
            type,
            isRead: isRead !== undefined ? isRead === 'true' : undefined
        };

        const pagination = {
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20
        };

        const result = await userService.getUserNotifications(userId, filters, pagination);

        res.json({
            success: true,
            data: result.notifications,
            pagination: result.pagination
        });

    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch notifications'
        });
    }
});

// Mark notification as read
router.put('/notifications/:id/read', async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);
        const userId = req.user.id;

        if (isNaN(notificationId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid notification ID'
            });
        }

        const result = await userService.markNotificationAsRead(notificationId, userId);

        res.json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error('Mark notification as read error:', error);
        res.status(error.message.includes('not found') ? 404 : 500).json({
            success: false,
            error: error.message || 'Failed to mark notification as read'
        });
    }
});

// Mark all notifications as read
router.put('/notifications/read-all', async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await userService.markAllNotificationsAsRead(userId);

        res.json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error('Mark all notifications as read error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to mark all notifications as read'
        });
    }
});

// Get unread notification count
router.get('/notifications/unread-count', async (req, res) => {
    try {
        const userId = req.user.id;
        const count = await userService.getUnreadNotificationCount(userId);

        res.json({
            success: true,
            data: { count }
        });

    } catch (error) {
        console.error('Get unread notification count error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to get unread notification count'
        });
    }
});

// Upload avatar
router.post('/avatar/upload', async (req, res) => {
    try {
        if (!req.files || !req.files.avatar) {
            return res.status(400).json({
                success: false,
                error: 'No avatar file provided'
            });
        }

        const avatarFile = req.files.avatar;
        const userId = req.user.id;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(avatarFile.mimetype)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid file type. Only JPEG, PNG, and WebP images are allowed'
            });
        }

        // Validate file size (5MB limit)
        if (avatarFile.size > 5 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                error: 'File size too large. Maximum size is 5MB'
            });
        }

        // Process upload here (save to storage, get URL)
        // For now, we'll simulate the upload
        const avatarUrl = `/uploads/avatars/${userId}_${Date.now()}_${avatarFile.name}`;

        // Update user avatar URL
        await userService.updateUser(userId, { avatarUrl });

        res.json({
            success: true,
            message: 'Avatar uploaded successfully',
            data: { avatarUrl }
        });

    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to upload avatar'
        });
    }
});

// Get user by ID (for other users to view profiles)
router.get('/:id', async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        if (isNaN(userId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID'
            });
        }

        const user = await userService.getUserById(userId);

        // Remove sensitive information for public view
        delete user.email;
        delete user.phone;
        delete user.date_of_birth;
        delete user.preferred_locations;
        delete user.preferred_property_types;
        delete user.budget_range_min;
        delete user.budget_range_max;

        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(error.message === 'User not found' ? 404 : 500).json({
            success: false,
            error: error.message || 'Failed to fetch user'
        });
    }
});

module.exports = router;