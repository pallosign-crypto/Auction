const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// Place a bid on an auction
router.post('/', [
    body('auctionId').isInt({ min: 1 }).withMessage('Invalid auction ID'),
    body('amount').isInt({ min: 100000 }).withMessage('Bid amount must be at least 100,000 TZS'),
    body('bidType').optional().isIn(['normal', 'auto', 'proxy']).withMessage('Invalid bid type')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { auctionId, amount, bidType = 'normal', maxAmount = 0 } = req.body;
        const userId = req.user.id;

        // Validate auction exists and is active
        const [auctionRows] = await db.execute(
            `SELECT a.*, p.title, p.reserve_price, p.starting_price
             FROM auctions a
             JOIN properties p ON a.property_id = p.id
             WHERE a.id = ? AND a.status = 'live'`,
            [auctionId]
        );

        if (auctionRows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Auction not found or not active'
            });
        }

        const auction = auctionRows[0];

        // Check if auction has ended
        if (new Date(auction.end_time) < new Date()) {
            return res.status(400).json({
                success: false,
                error: 'Auction has already ended'
            });
        }

        // Calculate minimum bid amount
        const currentPrice = auction.current_price || auction.starting_price;
        const minBidIncrement = Math.max(100000, Math.floor(currentPrice * 0.05)); // 5% of current price or 100k TZS minimum
        const minBidAmount = currentPrice + minBidIncrement;

        if (amount < minBidAmount) {
            return res.status(400).json({
                success: false,
                error: `Bid amount must be at least ${minBidAmount.toLocaleString()} TZS`
            });
        }

        // Check user's bidding eligibility
        const [userRows] = await db.execute(
            'SELECT status, identity_verified FROM users WHERE id = ?',
            [userId]
        );

        if (userRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        const user = userRows[0];
        if (user.status !== 'active') {
            return res.status(400).json({
                success: false,
                error: 'Your account is not active. Please contact support.'
            });
        }

        if (!user.identity_verified) {
            return res.status(400).json({
                success: false,
                error: 'You must verify your identity before placing bids'
            });
        }

        // Check if user has already placed the highest bid
        const [highestBidRows] = await db.execute(
            'SELECT user_id, amount FROM bids WHERE auction_id = ? ORDER BY amount DESC LIMIT 1',
            [auctionId]
        );

        if (highestBidRows.length > 0 && highestBidRows[0].user_id === userId) {
            return res.status(400).json({
                success: false,
                error: 'You already have the highest bid'
            });
        }

        // Start transaction
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            // Insert bid
            const bidQuery = `
                INSERT INTO bids (auction_id, user_id, amount, max_amount, bid_type, ip_address, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, NOW())
            `;
            
            const [bidResult] = await connection.execute(bidQuery, [
                auctionId,
                userId,
                amount,
                maxAmount || amount,
                bidType,
                req.ip || null
            ]);

            const bidId = bidResult.insertId;

            // Update auction current price and bid count
            await connection.execute(
                'UPDATE auctions SET current_price = ?, current_bid_count = current_bid_count + 1, updated_at = NOW() WHERE id = ?',
                [amount, auctionId]
            );

            // Mark previous bids as not winning
            await connection.execute(
                'UPDATE bids SET is_winning = FALSE WHERE auction_id = ? AND id != ?',
                [auctionId, bidId]
            );

            // Mark new bid as winning
            await connection.execute(
                'UPDATE bids SET is_winning = TRUE WHERE id = ?',
                [bidId]
            )

            // Create notification for previous highest bidder
            if (highestBidRows.length > 0) {
                const previousHighestBidder = highestBidRows[0].user_id;
                await connection.execute(
                    'INSERT INTO notifications (user_id, type, title, message, data, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                    [
                        previousHighestBidder,
                        'outbid',
                        `Outbid on ${auction.title}`,
                        `You have been outbid on "${auction.title}". New highest bid: ${amount.toLocaleString()} TZS`,
                        JSON.stringify({ auctionId, newAmount: amount, propertyTitle: auction.title })
                    ]
                );
            }

            await connection.commit();
            connection.release();

            // Get updated auction details
            const [updatedAuctionRows] = await db.execute(
                `SELECT 
                    a.*, p.title, p.address,
                    COUNT(DISTINCT b.id) as bid_count
                 FROM auctions a
                 JOIN properties p ON a.property_id = p.id
                 LEFT JOIN bids b ON a.id = b.auction_id
                 WHERE a.id = ?
                 GROUP BY a.id`,
                [auctionId]
            );

            res.json({
                success: true,
                message: 'Bid placed successfully',
                data: {
                    bidId,
                    auction: updatedAuctionRows[0]
                }
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Place bid error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to place bid'
        });
    }
});

// Get user's bids
router.get('/my-bids', async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, page = 1, limit = 20 } = req.query;

        let query = `
            SELECT 
                b.id, b.amount, b.max_amount, b.bid_type, b.is_winning, b.created_at,
                a.id as auction_id, a.title as auction_title, a.status as auction_status,
                a.end_time, a.current_price,
                p.id as property_id, p.title as property_title, p.address,
                p.images, p.property_type
            FROM bids b
            JOIN auctions a ON b.auction_id = a.id
            JOIN properties p ON a.property_id = p.id
            WHERE b.user_id = ?
        `;

        const params = [userId];

        if (status) {
            query += ' AND a.status = ?';
            params.push(status);
        }

        query += ' ORDER BY b.created_at DESC';

        // Add pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [bids] = await db.execute(query, params);

        // Process results
        const processedBids = bids.map(bid => ({
            ...bid,
            images: JSON.parse(bid.images || '[]')
        }));

        // Get total count
        const [countRows] = await db.execute(
            'SELECT COUNT(*) as total FROM bids WHERE user_id = ?',
            [userId]
        );

        res.json({
            success: true,
            data: processedBids,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countRows[0].total,
                pages: Math.ceil(countRows[0].total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Get user bids error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch bids'
        });
    }
});

// Get auction bids
router.get('/auction/:auctionId', async (req, res) => {
    try {
        const auctionId = parseInt(req.params.auctionId);

        if (isNaN(auctionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid auction ID'
            });
        }

        // Verify auction exists and user has access
        const [auctionRows] = await db.execute(
            `SELECT a.*, p.owner_id 
             FROM auctions a
             JOIN properties p ON a.property_id = p.id
             WHERE a.id = ?`,
            [auctionId]
        );

        if (auctionRows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Auction not found'
            });
        }

        const auction = auctionRows[0];
        const userId = req.user.id;

        // Check if user is owner or admin
        const isOwner = auction.owner_id === userId;
        const isAdmin = req.user.account_type === 'admin';

        if (!isOwner && !isAdmin) {
            return res.status(403).json({
                success: false,
                error: 'Access denied'
            });
        }

        const [bids] = await db.execute(
            `SELECT 
                b.id, b.amount, b.max_amount, b.bid_type, b.is_winning,
                b.created_at, b.ip_address,
                u.first_name, u.last_name, u.username, u.email
            FROM bids b
            JOIN users u ON b.user_id = u.id
            WHERE b.auction_id = ?
            ORDER BY b.amount DESC, b.created_at ASC`,
            [auctionId]
        );

        res.json({
            success: true,
            data: bids
        });

    } catch (error) {
        console.error('Get auction bids error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch auction bids'
        });
    }
});

// Set up auto-bidding
router.post('/auto-bid', [
    body('auctionId').isInt({ min: 1 }).withMessage('Invalid auction ID'),
    body('maxAmount').isInt({ min: 100000 }).withMessage('Maximum amount must be at least 100,000 TZS'),
    body('bidIncrement').optional().isInt({ min: 100000 }).withMessage('Bid increment must be at least 100,000 TZS')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { auctionId, maxAmount, bidIncrement = 1000000 } = req.body; // Default 1M TZS increment
        const userId = req.user.id;

        // Validate auction exists and is active
        const [auctionRows] = await db.execute(
            `SELECT a.*, p.title
             FROM auctions a
             JOIN properties p ON a.property_id = p.id
             WHERE a.id = ? AND a.status = 'live'`,
            [auctionId]
        );

        if (auctionRows.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Auction not found or not active'
            });
        }

        const auction = auctionRows[0];

        // Check if user has sufficient bidding eligibility
        const currentPrice = auction.current_price;
        if (maxAmount <= currentPrice) {
            return res.status(400).json({
                success: false,
                error: 'Maximum amount must be higher than current price'
            });
        }

        // Set up auto-bidding
        const [result] = await db.execute(
            `INSERT INTO auto_bids (user_id, auction_id, max_amount, bid_increment, created_at, updated_at) 
             VALUES (?, ?, ?, ?, NOW(), NOW())
             ON DUPLICATE KEY UPDATE 
             max_amount = VALUES(max_amount), 
             bid_increment = VALUES(bid_increment), 
             updated_at = NOW()`,
            [userId, auctionId, maxAmount, bidIncrement]
        );

        res.json({
            success: true,
            message: 'Auto-bidding set up successfully',
            data: {
                autoBidId: result.insertId,
                maxAmount,
                bidIncrement
            }
        });

    } catch (error) {
        console.error('Set up auto-bid error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to set up auto-bidding'
        });
    }
});

// Cancel auto-bidding
router.delete('/auto-bid/:auctionId', async (req, res) => {
    try {
        const auctionId = parseInt(req.params.auctionId);
        const userId = req.user.id;

        if (isNaN(auctionId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid auction ID'
            });
        }

        const [result] = await db.execute(
            'DELETE FROM auto_bids WHERE user_id = ? AND auction_id = ?',
            [userId, auctionId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Auto-bidding not found'
            });
        }

        res.json({
            success: true,
            message: 'Auto-bidding cancelled successfully'
        });

    } catch (error) {
        console.error('Cancel auto-bid error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to cancel auto-bidding'
        });
    }
});

// Get user's auto-bids
router.get('/auto-bids', async (req, res) => {
    try {
        const userId = req.user.id;

        const [autoBids] = await db.execute(
            `SELECT 
                ab.*, a.title as auction_title, a.status as auction_status,
                a.end_time, p.title as property_title, p.address
            FROM auto_bids ab
            JOIN auctions a ON ab.auction_id = a.id
            JOIN properties p ON a.property_id = p.id
            WHERE ab.user_id = ?
            ORDER BY ab.created_at DESC`,
            [userId]
        );

        res.json({
            success: true,
            data: autoBids
        });

    } catch (error) {
        console.error('Get auto-bids error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch auto-bids'
        });
    }
});

module.exports = router;