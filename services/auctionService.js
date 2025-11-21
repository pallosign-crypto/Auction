const db = require('../config/database');
const { generateToken } = require('../middleware/auth');
const crypto = require('crypto');

class AuctionService {
    constructor(io) {
        this.io = io;
        this.activeAuctions = new Map();
        this.userBids = new Map();
        this.autoBids = new Map();
        this.startMonitoring();
    }

    // Start auction monitoring
    startMonitoring() {
        setInterval(() => {
            this.checkAuctionStatus();
        }, 1000); // Check every second
    }

    // Check auction status and handle time-based events
    async checkAuctionStatus() {
        try {
            const now = new Date();
            
            // Get active auctions that need checking
            const activeAuctions = await db.query(`
                SELECT id, property_id, start_time, end_time, status, current_price, 
                       reserve_price, extended_end_time, auto_extend_enabled
                FROM auctions 
                WHERE status IN ('scheduled', 'live')
            `);

            for (const auction of activeAuctions) {
                const startTime = new Date(auction.start_time);
                const endTime = new Date(auction.extended_end_time || auction.end_time);

                // Check if auction should start
                if (auction.status === 'scheduled' && now >= startTime) {
                    await this.startAuction(auction.id);
                }

                // Check if auction should end
                if (auction.status === 'live' && now >= endTime) {
                    await this.endAuction(auction.id);
                }
            }
        } catch (error) {
            console.error('Auction monitoring error:', error);
        }
    }

    // Start an auction
    async startAuction(auctionId) {
        try {
            await db.query(
                'UPDATE auctions SET status = ?, start_time = NOW() WHERE id = ?',
                ['live', auctionId]
            );

            const auction = await this.getAuctionDetails(auctionId);
            
            // Notify all users in the auction room
            this.io.to(`auction_${auctionId}`).emit('auction_started', {
                auctionId,
                startTime: new Date(),
                auction
            });

            // Send notifications to watchers
            await this.notifyAuctionStart(auctionId);

            console.log(`🏁 Auction ${auctionId} started`);

        } catch (error) {
            console.error('Start auction error:', error);
        }
    }

    // End an auction
    async endAuction(auctionId) {
        try {
            const auction = await this.getAuctionDetails(auctionId);
            
            let result = 'no_bids';
            let winningBidId = null;

            if (auction.current_bid_count > 0) {
                const winningBid = await this.getWinningBid(auctionId);
                
                if (winningBid && winningBid.amount >= auction.reserve_price) {
                    result = 'sold';
                    winningBidId = winningBid.id;
                } else {
                    result = 'reserve_not_met';
                }
            }

            // Update auction status
            await db.query(
                'UPDATE auctions SET status = ?, result = ?, winning_bid_id = ?, ended_at = NOW() WHERE id = ?',
                ['ended', result, winningBidId, auctionId]
            );

            // Notify all users
            this.io.to(`auction_${auctionId}`).emit('auction_ended', {
                auctionId,
                result,
                winningBidId,
                winningAmount: auction.current_price,
                endTime: new Date()
            });

            // Send notifications
            await this.notifyAuctionEnd(auctionId, result, winningBidId);

            // Create transaction if sold
            if (result === 'sold' && winningBidId) {
                await this.createTransaction(auctionId, winningBidId);
            }

            console.log(`🏁 Auction ${auctionId} ended with result: ${result}`);

        } catch (error) {
            console.error('End auction error:', error);
        }
    }

    // Place a bid
    async placeBid(bidData) {
        const { auctionId, userId, amount, bidType = 'normal', maxAmount = 0 } = bidData;

        try {
            // Get auction details
            const auction = await this.getAuctionDetails(auctionId);
            if (!auction || auction.status !== 'live') {
                throw new Error('Auction is not active');
            }

            // Validate bid amount
            const minBid = this.calculateMinBid(auction.current_price, auction.bid_increment_percentage);
            if (amount < minBid) {
                throw new Error(`Bid must be at least ${minBid}`);
            }

            // Check if user has sufficient balance (for future implementation)
            const user = await this.getUserDetails(userId);
            if (!user) {
                throw new Error('User not found');
            }

            // Start transaction
            const connection = await db.getConnection();
            await connection.beginTransaction();

            try {
                // Insert bid
                const bidQuery = `
                    INSERT INTO bids (auction_id, user_id, amount, max_amount, bid_type, ip_address) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `;
                
                const [bidResult] = await connection.execute(bidQuery, [
                    auctionId,
                    userId,
                    amount,
                    maxAmount,
                    bidType,
                    bidData.ipAddress || null
                ]);

                const bidId = bidResult.insertId;

                // Update auction current price and bid count
                await connection.execute(
                    'UPDATE auctions SET current_price = ?, current_bid_count = current_bid_count + 1 WHERE id = ?',
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
                );

                // Handle auto-extend if enabled
                if (auction.auto_extend_enabled) {
                    const timeRemaining = new Date(auction.extended_end_time || auction.end_time) - new Date();
                    const extendThreshold = auction.auto_extend_minutes * 60 * 1000; // Convert to milliseconds

                    if (timeRemaining < extendThreshold) {
                        const newEndTime = new Date(Date.now() + extendThreshold);
                        await connection.execute(
                            'UPDATE auctions SET extended_end_time = ? WHERE id = ?',
                            [newEndTime, auctionId]
                        );

                        // Notify about extension
                        this.io.to(`auction_${auctionId}`).emit('auction_extended', {
                            auctionId,
                            newEndTime,
                            extendedBy: auction.auto_extend_minutes
                        });
                    }
                }

                await connection.commit();
                connection.release();

                // Get updated auction details
                const updatedAuction = await this.getAuctionDetails(auctionId);

                // Emit bid update to all users in auction room
                this.io.to(`auction_${auctionId}`).emit('bid_update', {
                    auctionId,
                    bid: {
                        id: bidId,
                        userId,
                        amount,
                        bidType,
                        timestamp: new Date()
                    },
                    auction: updatedAuction
                });

                // Notify previous highest bidder
                await this.notifyOutbid(auctionId, userId, amount);

                // Create audit log
                await db.query(
                    'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, data) VALUES (?, ?, ?, ?, ?)',
                    [userId, 'bid_placed', 'auction', auctionId, JSON.stringify({ amount, bidType })]
                );

                return {
                    success: true,
                    bidId,
                    auction: updatedAuction
                };

            } catch (error) {
                await connection.rollback();
                connection.release();
                throw error;
            }

        } catch (error) {
            console.error('Place bid error:', error);
            throw error;
        }
    }

    // Setup auto bidding
    async setupAutoBid(data) {
        const { auctionId, userId, maxAmount } = data;

        try {
            // Validate max amount
            if (maxAmount <= 0) {
                throw new Error('Maximum amount must be greater than 0');
            }

            // Store auto bid configuration
            const autoBidKey = `auto_${auctionId}_${userId}`;
            this.autoBids.set(autoBidKey, {
                auctionId,
                userId,
                maxAmount,
                currentBid: 0,
                active: true
            });

            return {
                success: true,
                message: 'Auto bidding configured successfully'
            };

        } catch (error) {
            console.error('Setup auto bid error:', error);
            throw error;
        }
    }

    // Process auto bids
    async processAutoBids(auctionId, newBidAmount) {
        try {
            const autoBids = Array.from(this.autoBids.entries())
                .filter(([key, bid]) => 
                    key.startsWith(`auto_${auctionId}_`) && 
                    bid.active && 
                    bid.maxAmount > newBidAmount
                )
                .sort((a, b) => b[1].maxAmount - a[1].maxAmount); // Highest max amount first

            for (const [key, autoBid] of autoBids) {
                const nextBidAmount = this.calculateNextBid(newBidAmount);
                
                if (nextBidAmount <= autoBid.maxAmount) {
                    // Place auto bid
                    await this.placeBid({
                        auctionId,
                        userId: autoBid.userId,
                        amount: nextBidAmount,
                        bidType: 'auto'
                    });

                    // Update auto bid current amount
                    autoBid.currentBid = nextBidAmount;
                    this.autoBids.set(key, autoBid);

                    newBidAmount = nextBidAmount; // Update for next iteration
                }
            }

        } catch (error) {
            console.error('Process auto bids error:', error);
        }
    }

    // Calculate minimum bid
    calculateMinBid(currentPrice, incrementPercentage) {
        const increment = Math.ceil(currentPrice * (incrementPercentage / 100));
        return currentPrice + increment;
    }

    // Calculate next bid amount
    calculateNextBid(currentPrice) {
        // Simple increment logic - can be enhanced
        return currentPrice + Math.ceil(currentPrice * 0.05);
    }

    // Get auction details
    async getAuctionDetails(auctionId) {
        try {
            const query = `
                SELECT a.*, p.title as property_title, p.address, p.images, p.total_area_sqm,
                       u.first_name, u.last_name, u.username as owner_username
                FROM auctions a
                JOIN properties p ON a.property_id = p.id
                JOIN users u ON p.owner_id = u.id
                WHERE a.id = ?
            `;

            const results = await db.query(query, [auctionId]);
            return results.length > 0 ? results[0] : null;

        } catch (error) {
            console.error('Get auction details error:', error);
            return null;
        }
    }

    // Get winning bid
    async getWinningBid(auctionId) {
        try {
            const query = `
                SELECT b.*, u.first_name, u.last_name, u.username
                FROM bids b
                JOIN users u ON b.user_id = u.id
                WHERE b.auction_id = ? AND b.is_winning = TRUE
                ORDER BY b.created_at DESC
                LIMIT 1
            `;

            const results = await db.query(query, [auctionId]);
            return results.length > 0 ? results[0] : null;

        } catch (error) {
            console.error('Get winning bid error:', error);
            return null;
        }
    }

    // Get user details
    async getUserDetails(userId) {
        try {
            const query = `
                SELECT id, first_name, last_name, email, username, account_type, status
                FROM users 
                WHERE id = ? AND status = 'active'
            `;

            const results = await db.query(query, [userId]);
            return results.length > 0 ? results[0] : null;

        } catch (error) {
            console.error('Get user details error:', error);
            return null;
        }
    }

    // Notify auction start
    async notifyAuctionStart(auctionId) {
        try {
            // Get watchers and interested users
            const watchers = await db.query(`
                SELECT DISTINCT u.id, u.email, u.first_name
                FROM watchlists w
                JOIN users u ON w.user_id = u.id
                WHERE w.property_id = (SELECT property_id FROM auctions WHERE id = ?)
            `, [auctionId]);

            // Send notifications
            for (const watcher of watchers) {
                await this.createNotification(watcher.id, 'auction_start', {
                    auctionId,
                    title: 'Auction Started',
                    message: 'An auction you\'re watching has started!'
                });
            }

        } catch (error) {
            console.error('Notify auction start error:', error);
        }
    }

    // Notify auction end
    async notifyAuctionEnd(auctionId, result, winningBidId) {
        try {
            // Get all bidders
            const bidders = await db.query(`
                SELECT DISTINCT u.id, u.email, u.first_name
                FROM bids b
                JOIN users u ON b.user_id = u.id
                WHERE b.auction_id = ?
            `, [auctionId]);

            for (const bidder of bidders) {
                let notificationType, title, message;

                if (result === 'sold' && winningBidId) {
                    const winningBid = await this.getWinningBid(auctionId);
                    if (winningBid && winningBid.user_id === bidder.id) {
                        notificationType = 'won';
                        title = 'Congratulations! You Won!';
                        message = 'You are the winning bidder!';
                    } else {
                        notificationType = 'property_sold';
                        title = 'Auction Ended';
                        message = 'The auction has ended with a winner.';
                    }
                } else if (result === 'reserve_not_met') {
                    notificationType = 'auction_end';
                    title = 'Auction Ended';
                    message = 'The auction ended but reserve price was not met.';
                } else {
                    notificationType = 'auction_end';
                    title = 'Auction Ended';
                    message = 'The auction ended with no bids.';
                }

                await this.createNotification(bidder.id, notificationType, {
                    auctionId,
                    title,
                    message
                });
            }

        } catch (error) {
            console.error('Notify auction end error:', error);
        }
    }

    // Notify outbid
    async notifyOutbid(auctionId, newBidderId, newAmount) {
        try {
            // Get previous highest bidder
            const previousHighestBidder = await db.query(`
                SELECT u.id, u.email, u.first_name
                FROM bids b
                JOIN users u ON b.user_id = u.id
                WHERE b.auction_id = ? 
                AND b.user_id != ? 
                AND b.is_winning = FALSE
                ORDER BY b.amount DESC
                LIMIT 1
            `, [auctionId, newBidderId]);

            if (previousHighestBidder.length > 0) {
                const user = previousHighestBidder[0];
                await this.createNotification(user.id, 'outbid', {
                    auctionId,
                    title: 'You Have Been Outbid',
                    message: `Your bid has been exceeded by ₦${newAmount.toLocaleString()}`
                });
            }

        } catch (error) {
            console.error('Notify outbid error:', error);
        }
    }

    // Create notification
    async createNotification(userId, type, data) {
        try {
            await db.query(
                'INSERT INTO notifications (user_id, type, title, message, data) VALUES (?, ?, ?, ?, ?)',
                [userId, type, data.title, data.message, JSON.stringify(data)]
            );

            // Emit real-time notification
            this.io.to(`user_${userId}`).emit('notification', {
                type,
                title: data.title,
                message: data.message,
                data,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('Create notification error:', error);
        }
    }

    // Create transaction
    async createTransaction(auctionId, bidId) {
        try {
            const auction = await this.getAuctionDetails(auctionId);
            const bid = await this.getBidDetails(bidId);

            if (!auction || !bid) {
                throw new Error('Auction or bid not found');
            }

            const commissionPercentage = parseFloat(process.env.COMMISSION_PERCENTAGE) || 5;
            const commissionAmount = Math.ceil(auction.current_price * (commissionPercentage / 100));
            const totalAmount = auction.current_price + commissionAmount;

            await db.query(
                'INSERT INTO transactions (user_id, auction_id, bid_id, amount, commission_amount, total_amount) VALUES (?, ?, ?, ?, ?, ?)',
                [bid.user_id, auctionId, bidId, auction.current_price, commissionAmount, totalAmount]
            );

        } catch (error) {
            console.error('Create transaction error:', error);
        }
    }

    // Get bid details
    async getBidDetails(bidId) {
        try {
            const query = 'SELECT * FROM bids WHERE id = ?';
            const results = await db.query(query, [bidId]);
            return results.length > 0 ? results[0] : null;

        } catch (error) {
            console.error('Get bid details error:', error);
            return null;
        }
    }
}

module.exports = AuctionService;