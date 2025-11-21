const nodemailer = require('nodemailer');
const db = require('../config/database');
const { formatCurrency } = require('../utils/currency');

class NotificationService {
    constructor(io) {
        this.io = io;
        this.emailTransporter = this.createEmailTransporter();
        this.templates = this.loadEmailTemplates();
    }

    createEmailTransporter() {
        return nodemailer.createTransporter({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    loadEmailTemplates() {
        return {
            welcome: {
                subject: 'Welcome to Tanzania Real Estate Auctions',
                template: 'welcome'
            },
            emailVerification: {
                subject: 'Verify Your Email Address',
                template: 'email-verification'
            },
            passwordReset: {
                subject: 'Password Reset Request',
                template: 'password-reset'
            },
            auctionStarted: {
                subject: 'Auction Started - {propertyTitle}',
                template: 'auction-started'
            },
            auctionEndingSoon: {
                subject: 'Auction Ending Soon - {propertyTitle}',
                template: 'auction-ending-soon'
            },
            outbidNotification: {
                subject: 'You Have Been Outbid - {propertyTitle}',
                template: 'outbid-notification'
            },
            bidWon: {
                subject: 'Congratulations! You Won the Auction - {propertyTitle}',
                template: 'bid-won'
            },
            auctionCancelled: {
                subject: 'Auction Cancelled - {propertyTitle}',
                template: 'auction-cancelled'
            },
            paymentReminder: {
                subject: 'Payment Reminder - {propertyTitle}',
                template: 'payment-reminder'
            },
            verificationApproved: {
                subject: 'Account Verification Approved',
                template: 'verification-approved'
            },
            newMessage: {
                subject: 'New Message Received',
                template: 'new-message'
            }
        };
    }

    async sendEmail(options) {
        try {
            const { to, subject, template, data, attachments = [] } = options;
            
            const mailOptions = {
                from: process.env.SMTP_FROM || 'Tanzania Real Estate Auctions <noreply@tanzaniaauctions.com>',
                to: Array.isArray(to) ? to.join(', ') : to,
                subject: this.renderTemplate(subject, data),
                html: this.generateEmailHTML(template, data),
                attachments
            };

            const result = await this.emailTransporter.sendMail(mailOptions);
            
            // Log email in database
            await this.logEmail(to, subject, template, result.messageId);
            
            return result;
        } catch (error) {
            console.error('Email sending error:', error);
            throw error;
        }
    }

    generateEmailHTML(template, data) {
        const baseHTML = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${data.subject || 'Tanzania Real Estate Auctions'}</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%); color: white; padding: 30px 20px; text-align: center; }
                .content { background: #ffffff; padding: 30px 20px; }
                .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; }
                .button { display: inline-block; padding: 12px 30px; background: #2a5298; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
                .property-card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin: 20px 0; }
                .price { font-size: 24px; font-weight: bold; color: #2a5298; }
                .highlight { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Tanzania Real Estate Auctions</h1>
                </div>
                <div class="content">
                    ${this.getTemplateContent(template, data)}
                </div>
                <div class="footer">
                    <p>© 2024 Tanzania Real Estate Auctions. All rights reserved.</p>
                    <p>This email was sent to you because you have an account with us.</p>
                </div>
            </div>
        </body>
        </html>
        `;

        return baseHTML;
    }

    getTemplateContent(template, data) {
        switch (template) {
            case 'welcome':
                return `
                    <h2>Welcome to Tanzania Real Estate Auctions, ${data.firstName}!</h2>
                    <p>Thank you for joining our platform. We're excited to have you as part of our community.</p>
                    <p>Here's what you can do:</p>
                    <ul>
                        <li>Browse and bid on premium properties across Tanzania</li>
                        <li>List your own properties for auction</li>
                        <li>Receive real-time notifications about auctions</li>
                        <li>Access detailed property information and documents</li>
                    </ul>
                    <p>Start exploring our available auctions today!</p>
                    <a href="${process.env.FRONTEND_URL}/auctions" class="button">Browse Auctions</a>
                `;

            case 'email-verification':
                return `
                    <h2>Verify Your Email Address</h2>
                    <p>Hello ${data.firstName},</p>
                    <p>Please click the button below to verify your email address and complete your registration.</p>
                    <div class="highlight">
                        <p><strong>Important:</strong> This verification link will expire in 24 hours.</p>
                    </div>
                    <a href="${data.verificationUrl}" class="button">Verify Email Address</a>
                    <p>If the button doesn't work, copy and paste this link into your browser:</p>
                    <p><a href="${data.verificationUrl}">${data.verificationUrl}</a></p>
                `;

            case 'password-reset':
                return `
                    <h2>Password Reset Request</h2>
                    <p>Hello ${data.firstName},</p>
                    <p>We received a request to reset your password. Click the button below to create a new password.</p>
                    <div class="highlight">
                        <p><strong>Security Notice:</strong> This link will expire in 1 hour for your security.</p>
                    </div>
                    <a href="${data.resetUrl}" class="button">Reset Password</a>
                    <p>If you didn't request this password reset, please ignore this email.</p>
                `;

            case 'auction-started':
                return `
                    <h2>Auction Now Live!</h2>
                    <div class="property-card">
                        <h3>${data.propertyTitle}</h3>
                        <p><strong>Location:</strong> ${data.propertyLocation}</p>
                        <p><strong>Starting Price:</strong> <span class="price">${formatCurrency(data.startingPrice)}</span></p>
                        <p><strong>Auction Ends:</strong> ${new Date(data.endTime).toLocaleString()}</p>
                        <p>${data.propertyDescription}</p>
                    </div>
                    <p>The auction for this property has started! Place your bid now to secure this opportunity.</p>
                    <a href="${data.auctionUrl}" class="button">Place Bid Now</a>
                `;

            case 'auction-ending-soon':
                return `
                    <h2>Auction Ending Soon!</h2>
                    <div class="property-card">
                        <h3>${data.propertyTitle}</h3>
                        <p><strong>Current Price:</strong> <span class="price">${formatCurrency(data.currentPrice)}</span></p>
                        <p><strong>Auction Ends:</strong> ${new Date(data.endTime).toLocaleString()}</p>
                        <p><strong>Time Remaining:</strong> ${data.timeRemaining}</p>
                    </div>
                    <div class="highlight">
                        <p><strong>⚠️ Don't Miss Out!</strong> This auction is ending soon. Place your final bid now!</p>
                    </div>
                    <a href="${data.auctionUrl}" class="button">Place Final Bid</a>
                `;

            case 'outbid-notification':
                return `
                    <h2>You've Been Outbid!</h2>
                    <div class="property-card">
                        <h3>${data.propertyTitle}</h3>
                        <p><strong>Your Last Bid:</strong> ${formatCurrency(data.yourBid)}</p>
                        <p><strong>New Highest Bid:</strong> <span class="price">${formatCurrency(data.currentPrice)}</span></p>
                        <p><strong>Auction Ends:</strong> ${new Date(data.endTime).toLocaleString()}</p>
                    </div>
                    <p>Don't let this property slip away! Place a higher bid to stay in the game.</p>
                    <div class="highlight">
                        <p><strong>Tip:</strong> Consider setting up auto-bidding to automatically place bids up to your maximum amount.</p>
                    </div>
                    <a href="${data.auctionUrl}" class="button">Place Higher Bid</a>
                `;

            case 'bid-won':
                return `
                    <h2>🎉 Congratulations! You Won!</h2>
                    <div class="property-card">
                        <h3>${data.propertyTitle}</h3>
                        <p><strong>Winning Bid:</strong> <span class="price">${formatCurrency(data.winningBid)}</span></p>
                        <p><strong>Property Location:</strong> ${data.propertyLocation}</p>
                    </div>
                    <div class="highlight">
                        <p><strong>Next Steps:</strong></p>
                        <ol>
                            <li>Complete payment within 48 hours</li>
                            <li>Schedule property inspection</li>
                            <li>Begin transfer process</li>
                        </ol>
                    </div>
                    <p>Our team will contact you within 24 hours to guide you through the next steps.</p>
                    <a href="${data.dashboardUrl}" class="button">View My Auctions</a>
                `;

            case 'auction-cancelled':
                return `
                    <h2>Auction Cancelled</h2>
                    <div class="property-card">
                        <h3>${data.propertyTitle}</h3>
                        <p><strong>Reason:</strong> ${data.cancellationReason}</p>
                    </div>
                    <p>We regret to inform you that this auction has been cancelled.</p>
                    <p>If you placed any bids, all amounts will be refunded to your account within 3-5 business days.</p>
                    <a href="${process.env.FRONTEND_URL}/auctions" class="button">Browse Other Auctions</a>
                `;

            case 'payment-reminder':
                return `
                    <h2>Payment Reminder</h2>
                    <div class="property-card">
                        <h3>${data.propertyTitle}</h3>
                        <p><strong>Amount Due:</strong> <span class="price">${formatCurrency(data.amountDue)}</span></p>
                        <p><strong>Due Date:</strong> ${new Date(data.dueDate).toLocaleString()}</p>
                    </div>
                    <div class="highlight">
                        <p><strong>⚠️ Important:</strong> Payment is due within 48 hours of winning the auction.</p>
                    </div>
                    <p>Please complete your payment to proceed with the property transfer process.</p>
                    <a href="${data.paymentUrl}" class="button">Make Payment</a>
                `;

            case 'verification-approved':
                return `
                    <h2>Account Verification Approved!</h2>
                    <p>Congratulations ${data.firstName}!</p>
                    <p>Your account verification has been approved. You now have full access to all features including:</p>
                    <ul>
                        <li>✅ Place bids on premium properties</li>
                        <li>✅ List your own properties for auction</li>
                        <li>✅ Access to exclusive member-only auctions</li>
                        <li>✅ Priority customer support</li>
                    </ul>
                    <a href="${process.env.FRONTEND_URL}/dashboard" class="button">Access Your Dashboard</a>
                `;

            case 'new-message':
                return `
                    <h2>New Message Received</h2>
                    <p>You have received a new message from ${data.senderName}.</p>
                    <div class="property-card">
                        <p><strong>Subject:</strong> ${data.messageSubject}</p>
                        <p><strong>Message:</strong></p>
                        <p>"${data.messagePreview}"</p>
                    </div>
                    <a href="${data.messageUrl}" class="button">View Message</a>
                `;

            default:
                return `<p>${data.message || 'Notification from Tanzania Real Estate Auctions'}</p>`;
        }
    }

    renderTemplate(template, data) {
        return template.replace(/\{([^}]+)\}/g, (match, key) => {
            return data[key] || match;
        });
    }

    async logEmail(recipient, subject, template, messageId) {
        try {
            await db.execute(
                'INSERT INTO email_logs (recipient, subject, template, message_id, sent_at) VALUES (?, ?, ?, ?, NOW())',
                [Array.isArray(recipient) ? recipient.join(', ') : recipient, subject, template, messageId]
            );
        } catch (error) {
            console.error('Failed to log email:', error);
        }
    }

    async sendNotification(userId, type, title, message, data = {}) {
        try {
            // Save notification to database
            const [result] = await db.execute(
                'INSERT INTO notifications (user_id, type, title, message, data, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
                [userId, type, title, message, JSON.stringify(data)]
            );

            const notificationId = result.insertId;

            // Send real-time notification if user is online
            this.io.to(`user_${userId}`).emit('notification', {
                id: notificationId,
                type,
                title,
                message,
                data,
                timestamp: new Date()
            });

            return notificationId;
        } catch (error) {
            console.error('Failed to send notification:', error);
            throw error;
        }
    }

    async notifyOutbid(auctionId, outbidUserId, newBidAmount) {
        try {
            // Get user details
            const [userRows] = await db.execute(
                'SELECT id, email, first_name FROM users WHERE id = ?',
                [outbidUserId]
            );

            if (userRows.length === 0) return;

            const user = userRows[0];

            // Get auction details
            const [auctionRows] = await db.execute(
                `SELECT a.id, a.title, p.address, a.end_time, a.current_price 
                 FROM auctions a 
                 JOIN properties p ON a.property_id = p.id 
                 WHERE a.id = ?`,
                [auctionId]
            );

            if (auctionRows.length === 0) return;

            const auction = auctionRows[0];

            // Send email notification
            await this.sendEmail({
                to: user.email,
                subject: `You've Been Outbid - ${auction.title}`,
                template: 'outbid-notification',
                data: {
                    firstName: user.first_name,
                    propertyTitle: auction.title,
                    propertyLocation: auction.address,
                    yourBid: auction.current_price - 1000000, // Assuming 1M increment
                    currentPrice: auction.current_price,
                    endTime: auction.end_time,
                    auctionUrl: `${process.env.FRONTEND_URL}/auction/${auctionId}`
                }
            });

            // Send in-app notification
            await this.sendNotification(
                user.id,
                'outbid',
                `Outbid on ${auction.title}`,
                `You've been outbid on "${auction.title}". Current highest bid: ${formatCurrency(auction.current_price)}`,
                {
                    auctionId,
                    propertyTitle: auction.title,
                    currentPrice: auction.current_price
                }
            );

        } catch (error) {
            console.error('Failed to send outbid notification:', error);
        }
    }

    async notifyAuctionEnd(auctionId, winnerId, winningBid) {
        try {
            // Notify winner
            const [winnerRows] = await db.execute(
                'SELECT id, email, first_name FROM users WHERE id = ?',
                [winnerId]
            );

            if (winnerRows.length > 0) {
                const winner = winnerRows[0];

                // Get auction and property details
                const [auctionRows] = await db.execute(
                    `SELECT a.id, a.title, p.address, a.end_time, a.current_price 
                     FROM auctions a 
                     JOIN properties p ON a.property_id = p.id 
                     WHERE a.id = ?`,
                    [auctionId]
                );

                if (auctionRows.length > 0) {
                    const auction = auctionRows[0];

                    // Send winner email
                    await this.sendEmail({
                        to: winner.email,
                        subject: `Congratulations! You Won - ${auction.title}`,
                        template: 'bid-won',
                        data: {
                            firstName: winner.first_name,
                            propertyTitle: auction.title,
                            propertyLocation: auction.address,
                            winningBid: winningBid,
                            dashboardUrl: `${process.env.FRONTEND_URL}/dashboard`
                        }
                    });

                    // Send winner notification
                    await this.sendNotification(
                        winner.id,
                        'auction_won',
                        `You won ${auction.title}!`,
                        `Congratulations! You won the auction for "${auction.title}" with a bid of ${formatCurrency(winningBid)}`,
                        {
                            auctionId,
                            propertyTitle: auction.title,
                            winningBid
                        }
                    );
                }
            }

        } catch (error) {
            console.error('Failed to send auction end notifications:', error);
        }
    }

    async notifyAuctionStart(auctionId) {
        try {
            // Get auction and property details
            const [auctionRows] = await db.execute(
                `SELECT a.id, a.title, p.address, a.start_time, a.end_time, p.starting_price 
                 FROM auctions a 
                 JOIN properties p ON a.property_id = p.id 
                 WHERE a.id = ?`,
                [auctionId]
            );

            if (auctionRows.length === 0) return;

            const auction = auctionRows[0];

            // Get users who are watching this auction or similar properties
            const [userRows] = await db.execute(
                `SELECT DISTINCT u.id, u.email, u.first_name 
                 FROM users u 
                 LEFT JOIN watchlists w ON u.id = w.user_id 
                 LEFT JOIN notifications n ON u.id = n.user_id 
                 WHERE (w.auction_id = ? OR n.type IN ('similar_property', 'price_alert')) 
                 AND u.email_verified = TRUE 
                 AND u.status = 'active'`,
                [auctionId]
            );

            // Send notifications to interested users
            for (const user of userRows) {
                await this.sendEmail({
                    to: user.email,
                    subject: `Auction Started - ${auction.title}`,
                    template: 'auction-started',
                    data: {
                        firstName: user.first_name,
                        propertyTitle: auction.title,
                        propertyLocation: auction.address,
                        startingPrice: auction.starting_price,
                        endTime: auction.end_time,
                        auctionUrl: `${process.env.FRONTEND_URL}/auction/${auctionId}`
                    }
                });

                await this.sendNotification(
                    user.id,
                    'auction_started',
                    `Auction started: ${auction.title}`,
                    `The auction for "${auction.title}" has started. Starting price: ${formatCurrency(auction.starting_price)}`,
                    {
                        auctionId,
                        propertyTitle: auction.title,
                        startingPrice: auction.starting_price
                    }
                );
            }

        } catch (error) {
            console.error('Failed to send auction start notifications:', error);
        }
    }

    async start() {
        console.log('🔔 Notification Service started');
        
        // Set up scheduled notifications (auction reminders, etc.)
        this.startScheduledNotifications();
    }

    startScheduledNotifications() {
        // Check every minute for auctions ending soon
        setInterval(async () => {
            await this.checkAuctionsEndingSoon();
        }, 60000); // 1 minute

        // Check every hour for payment reminders
        setInterval(async () => {
            await this.checkPaymentReminders();
        }, 3600000); // 1 hour
    }

    async checkAuctionsEndingSoon() {
        try {
            const [auctions] = await db.execute(
                `SELECT a.id, a.title, p.address, a.end_time, a.current_price 
                 FROM auctions a 
                 JOIN properties p ON a.property_id = p.id 
                 WHERE a.status = 'live' 
                 AND a.end_time BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 1 HOUR)`,
                []
            );

            for (const auction of auctions) {
                const timeRemaining = new Date(auction.end_time) - new Date();
                const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
                const minutesRemaining = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));

                // Get bidders who need to be notified
                const [bidders] = await db.execute(
                    `SELECT DISTINCT u.id, u.email, u.first_name, MAX(b.amount) as last_bid
                     FROM users u 
                     JOIN bids b ON u.id = b.user_id 
                     WHERE b.auction_id = ? 
                     GROUP BY u.id`,
                    [auction.id]
                );

                for (const bidder of bidders) {
                    await this.sendEmail({
                        to: bidder.email,
                        subject: `Auction Ending Soon - ${auction.title}`,
                        template: 'auction-ending-soon',
                        data: {
                            firstName: bidder.first_name,
                            propertyTitle: auction.title,
                            propertyLocation: auction.address,
                            currentPrice: auction.current_price,
                            endTime: auction.end_time,
                            timeRemaining: `${hoursRemaining}h ${minutesRemaining}m`,
                            auctionUrl: `${process.env.FRONTEND_URL}/auction/${auction.id}`
                        }
                    });
                }
            }

        } catch (error) {
            console.error('Failed to check auctions ending soon:', error);
        }
    }

    async checkPaymentReminders() {
        try {
            // Get auctions that ended but payment is pending
            const [auctions] = await db.execute(
                `SELECT a.id, a.title, p.address, t.amount, t.due_date, u.email, u.first_name
                 FROM auctions a 
                 JOIN properties p ON a.property_id = p.id 
                 JOIN transactions t ON a.id = t.auction_id 
                 JOIN users u ON t.buyer_id = u.id 
                 WHERE a.status = 'ended' 
                 AND t.status = 'pending' 
                 AND t.due_date > NOW()`,
                []
            );

            for (const auction of auctions) {
                const hoursUntilDue = Math.floor((new Date(auction.due_date) - new Date()) / (1000 * 60 * 60));

                if (hoursUntilDue <= 24) { // Send reminder if less than 24 hours
                    await this.sendEmail({
                        to: auction.email,
                        subject: `Payment Reminder - ${auction.title}`,
                        template: 'payment-reminder',
                        data: {
                            firstName: auction.first_name,
                            propertyTitle: auction.title,
                            amountDue: auction.amount,
                            dueDate: auction.due_date,
                            paymentUrl: `${process.env.FRONTEND_URL}/payment/${auction.id}`
                        }
                    });
                }
            }

        } catch (error) {
            console.error('Failed to check payment reminders:', error);
        }
    }
}

module.exports = NotificationService;