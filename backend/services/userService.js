const db = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

class UserService {
    constructor() {
        this.saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    }

    async getUserById(userId) {
        try {
            const [rows] = await db.execute(
                `SELECT 
                    id, username, email, first_name, last_name, phone,
                    date_of_birth, nationality, account_type, avatar_url,
                    email_verified, phone_verified, identity_verified,
                    status, preferred_locations, preferred_property_types,
                    budget_range_min, budget_range_max, referral_code,
                    created_at, updated_at, last_login
                 FROM users 
                 WHERE id = ?`,
                [userId]
            );

            if (rows.length === 0) {
                throw new Error('User not found');
            }

            const user = rows[0];
            
            // Parse JSON fields
            user.preferred_locations = JSON.parse(user.preferred_locations || '[]');
            user.preferred_property_types = JSON.parse(user.preferred_property_types || '[]');

            // Remove sensitive information
            delete user.password_hash;

            return user;

        } catch (error) {
            throw error;
        }
    }

    async getUserByEmail(email) {
        try {
            const [rows] = await db.execute(
                `SELECT 
                    id, username, email, first_name, last_name, phone,
                    date_of_birth, nationality, account_type, avatar_url,
                    email_verified, phone_verified, identity_verified,
                    status, password_hash, preferred_locations, 
                    preferred_property_types, budget_range_min, budget_range_max,
                    referral_code, created_at, updated_at, last_login
                 FROM users 
                 WHERE email = ?`,
                [email]
            );

            if (rows.length === 0) {
                throw new Error('User not found');
            }

            const user = rows[0];
            
            // Parse JSON fields
            user.preferred_locations = JSON.parse(user.preferred_locations || '[]');
            user.preferred_property_types = JSON.parse(user.preferred_property_types || '[]');

            return user;

        } catch (error) {
            throw error;
        }
    }

    async updateUser(userId, userData) {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            // Check if user exists
            const [existingUser] = await connection.execute(
                'SELECT id FROM users WHERE id = ?',
                [userId]
            );

            if (existingUser.length === 0) {
                throw new Error('User not found');
            }

            // Build update query dynamically
            const updateFields = [];
            const updateValues = [];

            const allowedFields = [
                'first_name', 'last_name', 'phone', 'date_of_birth', 'nationality',
                'account_type', 'preferred_locations', 'preferred_property_types',
                'budget_range_min', 'budget_range_max', 'avatar_url'
            ];

            const fieldMapping = {
                'firstName': 'first_name',
                'lastName': 'last_name',
                'dateOfBirth': 'date_of_birth',
                'accountType': 'account_type',
                'budgetRangeMin': 'budget_range_min',
                'budgetRangeMax': 'budget_range_max',
                'avatarUrl': 'avatar_url'
            };

            // Add fields from userData
            Object.keys(userData).forEach(key => {
                const dbField = fieldMapping[key] || key;
                if (allowedFields.includes(dbField) && userData[key] !== undefined) {
                    updateFields.push(`${dbField} = ?`);
                    updateValues.push(userData[key]);
                }
            });

            // Handle JSON fields
            if (userData.preferredLocations !== undefined) {
                updateFields.push('preferred_locations = ?');
                updateValues.push(JSON.stringify(userData.preferredLocations));
            }

            if (userData.preferredPropertyTypes !== undefined) {
                updateFields.push('preferred_property_types = ?');
                updateValues.push(JSON.stringify(userData.preferredPropertyTypes));
            }

            if (updateFields.length === 0) {
                throw new Error('No valid fields to update');
            }

            // Add updated_at
            updateFields.push('updated_at = NOW()');
            updateValues.push(userId); // For WHERE clause

            const updateQuery = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;

            await connection.execute(updateQuery, updateValues);

            // Create user activity log
            await connection.execute(
                'INSERT INTO user_activity_logs (user_id, action, details, created_at) VALUES (?, ?, ?, NOW())',
                [userId, 'profile_updated', JSON.stringify(userData)]
            );

            await connection.commit();
            connection.release();

            return {
                success: true,
                message: 'Profile updated successfully'
            };

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    }

    async updatePassword(userId, currentPassword, newPassword) {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            // Get current password hash
            const [userRows] = await connection.execute(
                'SELECT password_hash FROM users WHERE id = ?',
                [userId]
            );

            if (userRows.length === 0) {
                throw new Error('User not found');
            }

            const user = userRows[0];

            // Verify current password
            const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
            if (!isCurrentPasswordValid) {
                throw new Error('Current password is incorrect');
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

            // Update password
            await connection.execute(
                'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
                [hashedPassword, userId]
            );

            // Create password change log
            await connection.execute(
                'INSERT INTO user_activity_logs (user_id, action, details, created_at) VALUES (?, ?, ?, NOW())',
                [userId, 'password_changed', JSON.stringify({ changed_at: new Date() })]
            );

            await connection.commit();
            connection.release();

            return {
                success: true,
                message: 'Password updated successfully'
            };

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    }

    async resetPassword(email, newPassword) {
        try {
            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

            // Update password
            const [result] = await db.execute(
                'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE email = ?',
                [hashedPassword, email]
            );

            if (result.affectedRows === 0) {
                throw new Error('User not found');
            }

            return {
                success: true,
                message: 'Password reset successfully'
            };

        } catch (error) {
            throw error;
        }
    }

    async updateVerificationStatus(userId, verificationType, status) {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            const verificationFields = {
                'email': 'email_verified',
                'phone': 'phone_verified',
                'identity': 'identity_verified'
            };

            const field = verificationFields[verificationType];
            if (!field) {
                throw new Error('Invalid verification type');
            }

            await connection.execute(
                `UPDATE users SET ${field} = ?, updated_at = NOW() WHERE id = ?`,
                [status, userId]
            );

            // Create verification log
            await connection.execute(
                'INSERT INTO verification_logs (user_id, verification_type, status, verified_at) VALUES (?, ?, ?, NOW())',
                [userId, verificationType, status]
            );

            await connection.commit();
            connection.release();

            return {
                success: true,
                message: `${verificationType} verification status updated`
            };

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    }

    async getUserDashboard(userId) {
        try {
            const dashboard = {};

            // Get user stats
            const [userStats] = await db.execute(
                `SELECT 
                    COUNT(DISTINCT p.id) as properties_count,
                    COUNT(DISTINCT a.id) as auctions_count,
                    COUNT(DISTINCT b.id) as bids_count,
                    COUNT(DISTINCT f.id) as favorites_count
                 FROM users u
                 LEFT JOIN properties p ON u.id = p.owner_id
                 LEFT JOIN auctions a ON p.id = a.property_id
                 LEFT JOIN bids b ON u.id = b.user_id
                 LEFT JOIN favorites f ON u.id = f.user_id
                 WHERE u.id = ?`,
                [userId]
            );

            dashboard.stats = userStats[0];

            // Get recent activity
            const [recentActivity] = await db.execute(
                `SELECT 
                    'bid' as type, b.amount, b.created_at, p.title as property_title,
                    'Bid placed' as description
                 FROM bids b
                 JOIN auctions a ON b.auction_id = a.id
                 JOIN properties p ON a.property_id = p.id
                 WHERE b.user_id = ?
                 ORDER BY b.created_at DESC
                 LIMIT 5`,
                [userId]
            );

            dashboard.recentActivity = recentActivity;

            // Get active auctions user is participating in
            const [activeAuctions] = await db.execute(
                `SELECT 
                    a.id, a.title, p.address, a.end_time, a.current_price,
                    MAX(b.amount) as your_highest_bid
                 FROM auctions a
                 JOIN properties p ON a.property_id = p.id
                 JOIN bids b ON a.id = b.auction_id
                 WHERE b.user_id = ? AND a.status = 'live'
                 GROUP BY a.id
                 ORDER BY a.end_time ASC
                 LIMIT 5`,
                [userId]
            );

            dashboard.activeAuctions = activeAuctions;

            // Get user's properties
            const [userProperties] = await db.execute(
                `SELECT 
                    p.id, p.title, p.status, p.created_at, p.view_count,
                    COUNT(DISTINCT a.id) as auction_count
                 FROM properties p
                 LEFT JOIN auctions a ON p.id = a.property_id
                 WHERE p.owner_id = ?
                 GROUP BY p.id
                 ORDER BY p.created_at DESC
                 LIMIT 5`,
                [userId]
            );

            dashboard.properties = userProperties;

            return dashboard;

        } catch (error) {
            throw error;
        }
    }

    async getUserNotifications(userId, filters = {}, pagination = {}) {
        try {
            const { type, isRead } = filters;
            const { page = 1, limit = 20 } = pagination;
            const offset = (page - 1) * limit;

            let query = `
                SELECT 
                    id, type, title, message, data, is_read, created_at
                 FROM notifications
                 WHERE user_id = ?
            `;

            const params = [userId];

            if (type) {
                query += ' AND type = ?';
                params.push(type);
            }

            if (isRead !== undefined) {
                query += ' AND is_read = ?';
                params.push(isRead);
            }

            query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            const [notifications] = await db.execute(query, params);

            // Parse JSON data
            const parsedNotifications = notifications.map(notification => ({
                ...notification,
                data: JSON.parse(notification.data || '{}')
            }));

            // Get total count
            const [countRows] = await db.execute(
                'SELECT COUNT(*) as total FROM notifications WHERE user_id = ?',
                [userId]
            );

            return {
                notifications: parsedNotifications,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countRows[0].total,
                    pages: Math.ceil(countRows[0].total / limit)
                }
            };

        } catch (error) {
            throw error;
        }
    }

    async markNotificationAsRead(notificationId, userId) {
        try {
            const [result] = await db.execute(
                'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
                [notificationId, userId]
            );

            if (result.affectedRows === 0) {
                throw new Error('Notification not found or not owned by user');
            }

            return {
                success: true,
                message: 'Notification marked as read'
            };

        } catch (error) {
            throw error;
        }
    }

    async markAllNotificationsAsRead(userId) {
        try {
            await db.execute(
                'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
                [userId]
            );

            return {
                success: true,
                message: 'All notifications marked as read'
            };

        } catch (error) {
            throw error;
        }
    }

    async getUnreadNotificationCount(userId) {
        try {
            const [rows] = await db.execute(
                'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
                [userId]
            );

            return rows[0].count;

        } catch (error) {
            throw error;
        }
    }

    async updateLastLogin(userId) {
        try {
            await db.execute(
                'UPDATE users SET last_login = NOW() WHERE id = ?',
                [userId]
            );

            return {
                success: true,
                message: 'Last login updated'
            };

        } catch (error) {
            throw error;
        }
    }

    async searchUsers(searchTerm, filters = {}) {
        try {
            const { accountType, status, limit = 20 } = filters;

            let query = `
                SELECT 
                    id, username, email, first_name, last_name, phone,
                    account_type, status, created_at, email_verified,
                    phone_verified, identity_verified
                FROM users
                WHERE (username LIKE ? OR email LIKE ? OR first_name LIKE ? OR last_name LIKE ?)
            `;

            const searchParam = `%${searchTerm}%`;
            const params = [searchParam, searchParam, searchParam, searchParam];

            if (accountType) {
                query += ' AND account_type = ?';
                params.push(accountType);
            }

            if (status) {
                query += ' AND status = ?';
                params.push(status);
            }

            query += ' ORDER BY created_at DESC LIMIT ?';
            params.push(parseInt(limit));

            const [users] = await db.execute(query, params);

            return users;

        } catch (error) {
            throw error;
        }
    }

    async updateUserStatus(userId, status, adminId) {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            await connection.execute(
                'UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?',
                [status, userId]
            );

            // Create admin action log
            await connection.execute(
                'INSERT INTO admin_action_logs (admin_id, action, target_user_id, details, created_at) VALUES (?, ?, ?, ?, NOW())',
                [adminId, 'user_status_change', userId, JSON.stringify({ new_status: status })]
            );

            await connection.commit();
            connection.release();

            return {
                success: true,
                message: `User status updated to ${status}`
            };

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    }

    async generatePasswordResetToken(userId) {
        try {
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 3600000); // 1 hour

            await db.execute(
                'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
                [userId, token, expiresAt]
            );

            return token;

        } catch (error) {
            throw error;
        }
    }

    async validatePasswordResetToken(token) {
        try {
            const [rows] = await db.execute(
                'SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ? AND used = FALSE',
                [token]
            );

            if (rows.length === 0) {
                throw new Error('Invalid or expired token');
            }

            const tokenData = rows[0];
            
            if (new Date(tokenData.expires_at) < new Date()) {
                throw new Error('Token has expired');
            }

            return tokenData.user_id;

        } catch (error) {
            throw error;
        }
    }

    async markPasswordResetTokenAsUsed(token) {
        try {
            await db.execute(
                'UPDATE password_reset_tokens SET used = TRUE WHERE token = ?',
                [token]
            );

            return {
                success: true,
                message: 'Token marked as used'
            };

        } catch (error) {
            throw error;
        }
    }
}

module.exports = UserService;