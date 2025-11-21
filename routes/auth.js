const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { generateToken, generateRefreshToken, verifyRefreshToken } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');
const crypto = require('crypto');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', [
    body('firstName').trim().isLength({ min: 2 }).withMessage('First name must be at least 2 characters'),
    body('lastName').trim().isLength({ min: 2 }).withMessage('Last name must be at least 2 characters'),
    body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email'),
    body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('phone').optional().isMobilePhone().withMessage('Please enter a valid phone number'),
    body('accountType').isIn(['bidder', 'seller', 'both']).withMessage('Invalid account type'),
    body('dateOfBirth').isDate().withMessage('Please enter a valid date of birth'),
    body('nationality').trim().isLength({ min: 2 }).withMessage('Please enter your nationality')
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

        const {
            firstName,
            lastName,
            email,
            username,
            password,
            phone,
            accountType,
            dateOfBirth,
            nationality,
            preferredLocations,
            preferredPropertyTypes,
            budgetRange,
            referralCode
        } = req.body;

        // Check if user already exists
        const existingUser = await db.query(
            'SELECT id FROM users WHERE email = ? OR username = ?',
            [email, username]
        );

        if (existingUser.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'User with this email or username already exists'
            });
        }

        // Hash password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Generate email verification token
        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        // Insert user
        const insertQuery = `
            INSERT INTO users (
                first_name, last_name, email, username, password_hash,
                phone, account_type, date_of_birth, nationality,
                preferred_locations, preferred_property_types,
                budget_range_min, budget_range_max, referral_code,
                email_verification_token, email_verification_expires
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const budgetMin = budgetRange?.min || 0;
        const budgetMax = budgetRange?.max || 0;

        const result = await db.query(insertQuery, [
            firstName,
            lastName,
            email,
            username,
            passwordHash,
            phone,
            accountType,
            dateOfBirth,
            nationality,
            JSON.stringify(preferredLocations || []),
            JSON.stringify(preferredPropertyTypes || []),
            budgetMin,
            budgetMax,
            referralCode,
            emailVerificationToken,
            emailVerificationExpires
        ]);

        const userId = result.insertId;

        // Generate JWT token
        const token = generateToken({ id: userId, email, username });
        const refreshToken = generateRefreshToken({ id: userId, email, username });

        // Send verification email
        try {
            const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${emailVerificationToken}`;
            await sendEmail({
                to: email,
                subject: 'Welcome to Tanzania Real Estate Auctions - Verify Your Email',
                template: 'email-verification',
                data: {
                    firstName,
                    verificationUrl
                }
            });
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
            // Don't fail registration if email fails
        }

        // Create audit log
        await db.query(
            'INSERT INTO audit_logs (user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)',
            [userId, 'user_registered', 'user', userId]
        );

        res.status(201).json({
            success: true,
            message: 'Registration successful. Please check your email to verify your account.',
            data: {
                user: {
                    id: userId,
                    firstName,
                    lastName,
                    email,
                    username,
                    accountType
                },
                token,
                refreshToken
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            error: 'Registration failed. Please try again.'
        });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
    body('username').trim().isLength({ min: 1 }).withMessage('Username is required'),
    body('password').isLength({ min: 1 }).withMessage('Password is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { username, password } = req.body;

        // Find user by email or username
        const userQuery = `
            SELECT id, first_name, last_name, email, username, password_hash, 
                   account_type, status, email_verified, avatar_url
            FROM users 
            WHERE (email = ? OR username = ?) AND status = ?
        `;

        const users = await db.query(userQuery, [username, username, 'active']);

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        const user = users[0];

        // Check password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            // Log failed login attempt
            await db.query(
                'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES (?, ?, ?, ?, ?)',
                [user.id, 'login_failed', 'user', user.id, req.ip]
            );

            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Update last login
        await db.query(
            'UPDATE users SET last_login = NOW() WHERE id = ?',
            [user.id]
        );

        // Generate tokens
        const token = generateToken({ 
            id: user.id, 
            email: user.email, 
            username: user.username,
            accountType: user.account_type 
        });

        const refreshToken = generateRefreshToken({ 
            id: user.id, 
            email: user.email, 
            username: user.username 
        });

        // Log successful login
        await db.query(
            'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES (?, ?, ?, ?, ?)',
            [user.id, 'login_success', 'user', user.id, req.ip]
        );

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    email: user.email,
                    username: user.username,
                    accountType: user.account_type,
                    emailVerified: user.email_verified,
                    avatarUrl: user.avatar_url
                },
                token,
                refreshToken
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed. Please try again.'
        });
    }
});

// @route   POST /api/auth/refresh
// @desc    Refresh JWT token
// @access  Public
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                error: 'Refresh token required'
            });
        }

        const decoded = verifyRefreshToken(refreshToken);

        // Get user from database
        const userQuery = 'SELECT id, email, username, account_type FROM users WHERE id = ? AND status = ?';
        const users = await db.query(userQuery, [decoded.id, 'active']);

        if (users.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Invalid refresh token'
            });
        }

        const user = users[0];

        // Generate new tokens
        const newToken = generateToken({ 
            id: user.id, 
            email: user.email, 
            username: user.username,
            accountType: user.account_type 
        });

        const newRefreshToken = generateRefreshToken({ 
            id: user.id, 
            email: user.email, 
            username: user.username 
        });

        res.json({
            success: true,
            data: {
                token: newToken,
                refreshToken: newRefreshToken
            }
        });

    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(401).json({
            success: false,
            error: 'Invalid refresh token'
        });
    }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', async (req, res) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (token && req.user) {
            // Log logout action
            await db.query(
                'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address) VALUES (?, ?, ?, ?, ?)',
                [req.user.id, 'logout', 'user', req.user.id, req.ip]
            );
        }

        res.json({
            success: true,
            message: 'Logged out successfully'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed'
        });
    }
});

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', [
    body('email').isEmail().normalizeEmail().withMessage('Please enter a valid email')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { email } = req.body;

        // Check if user exists
        const userQuery = 'SELECT id, first_name, email FROM users WHERE email = ? AND status = ?';
        const users = await db.query(userQuery, [email, 'active']);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = users[0];

        // Generate password reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Save reset token to database
        await db.query(
            'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
            [resetToken, resetTokenExpires, user.id]
        );

        // Send reset email
        try {
            const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
            await sendEmail({
                to: email,
                subject: 'Password Reset - Tanzania Real Estate Auctions',
                template: 'password-reset',
                data: {
                    firstName: user.first_name,
                    resetUrl
                }
            });
        } catch (emailError) {
            console.error('Password reset email failed:', emailError);
            // Don't fail the request if email fails
        }

        res.json({
            success: true,
            message: 'Password reset email sent'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process password reset request'
        });
    }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password with token
// @access  Public
router.post('/reset-password', [
    body('token').isLength({ min: 1 }).withMessage('Reset token is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { token, password } = req.body;

        // Find user with valid reset token
        const userQuery = `
            SELECT id, first_name, email 
            FROM users 
            WHERE password_reset_token = ? 
            AND password_reset_expires > NOW()
            AND status = ?
        `;

        const users = await db.query(userQuery, [token, 'active']);

        if (users.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired reset token'
            });
        }

        const user = users[0];

        // Hash new password
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        // Update password and clear reset token
        await db.query(
            'UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
            [passwordHash, user.id]
        );

        res.json({
            success: true,
            message: 'Password reset successful'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset password'
        });
    }
});

// @route   GET /api/auth/verify-email/:token
// @desc    Verify email address
// @access  Public
router.get('/verify-email/:token', async (req, res) => {
    try {
        const { token } = req.params;

        // Find user with valid verification token
        const userQuery = `
            SELECT id, first_name, email, email_verified
            FROM users 
            WHERE email_verification_token = ? 
            AND email_verification_expires > NOW()
        `;

        const users = await db.query(userQuery, [token]);

        if (users.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid or expired verification token'
            });
        }

        const user = users[0];

        if (user.email_verified) {
            return res.json({
                success: true,
                message: 'Email already verified'
            });
        }

        // Update email verification status
        await db.query(
            'UPDATE users SET email_verified = TRUE, email_verification_token = NULL, email_verification_expires = NULL, status = ? WHERE id = ?',
            ['active', user.id]
        );

        res.json({
            success: true,
            message: 'Email verified successfully'
        });

    } catch (error) {
        console.error('Email verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify email'
        });
    }
});

module.exports = router;