const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Email transporter configuration
const transporter = nodemailer.createTransporter({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false // For development only
    }
});

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('Email transporter error:', error);
    } else {
        console.log('✅ Email transporter is ready to send messages');
    }
});

// Load email templates
const templates = {
    'welcome': loadTemplate('welcome.html'),
    'email-verification': loadTemplate('email-verification.html'),
    'password-reset': loadTemplate('password-reset.html'),
    'auction-start': loadTemplate('auction-start.html'),
    'auction-end': loadTemplate('auction-end.html'),
    'outbid': loadTemplate('outbid.html'),
    'won-auction': loadTemplate('won-auction.html'),
    'property-sold': loadTemplate('property-sold.html'),
    'verification-approved': loadTemplate('verification-approved.html'),
    'verification-rejected': loadTemplate('verification-rejected.html')
};

function loadTemplate(templateName) {
    try {
        const templatePath = path.join(__dirname, '..', 'email-templates', templateName);
        return fs.readFileSync(templatePath, 'utf8');
    } catch (error) {
        console.error(`Failed to load email template: ${templateName}`, error);
        return null;
    }
}

// Render template with data
function renderTemplate(template, data) {
    if (!template) {
        return 'Email template not found';
    }

    let rendered = template;
    
    // Replace variables
    Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        rendered = rendered.replace(regex, data[key]);
    });

    // Replace common variables
    rendered = rendered.replace(/{{siteName}}/g, process.env.SITE_NAME || 'Tanzania Real Estate Auctions');
    rendered = rendered.replace(/{{siteUrl}}/g, process.env.FRONTEND_URL || 'http://localhost:3000');
    rendered = rendered.replace(/{{currentYear}}/g, new Date().getFullYear().toString());

    return rendered;
}

// Send email function
async function sendEmail({ to, subject, template, data, attachments = [] }) {
    try {
        // Get email template
        const emailTemplate = templates[template];
        if (!emailTemplate) {
            throw new Error(`Email template not found: ${template}`);
        }

        // Render template
        const html = renderTemplate(emailTemplate, data);

        // Email options
        const mailOptions = {
            from: process.env.EMAIL_FROM || 'Tanzania Auctions <noreply@tanzaniaauctions.com>',
            to: Array.isArray(to) ? to.join(', ') : to,
            subject: subject,
            html: html,
            attachments: attachments
        };

        // Send email
        const info = await transporter.sendMail(mailOptions);
        
        console.log('📧 Email sent:', {
            messageId: info.messageId,
            to: to,
            subject: subject,
            template: template
        });

        return {
            success: true,
            messageId: info.messageId,
            previewUrl: nodemailer.getTestMessageUrl(info)
        };

    } catch (error) {
        console.error('❌ Email sending failed:', error);
        throw error;
    }
}

// Send bulk emails
async function sendBulkEmail(emails) {
    const results = [];
    
    for (const email of emails) {
        try {
            const result = await sendEmail(email);
            results.push({ ...email, success: true, result });
        } catch (error) {
            results.push({ ...email, success: false, error: error.message });
        }
    }

    return results;
}

// Queue email for later sending (using database)
async function queueEmail({ to, subject, template, data, scheduledFor = null }) {
    try {
        const db = require('../config/database');
        
        const query = `
            INSERT INTO email_queue 
            (recipient_email, subject, template, template_data, scheduled_for, status) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        const result = await db.query(query, [
            Array.isArray(to) ? to.join(', ') : to,
            subject,
            template,
            JSON.stringify(data),
            scheduledFor,
            'pending'
        ]);

        return {
            success: true,
            queueId: result.insertId
        };

    } catch (error) {
        console.error('Email queuing failed:', error);
        throw error;
    }
}

// Process email queue
async function processEmailQueue(limit = 10) {
    try {
        const db = require('../config/database');
        
        // Get pending emails
        const pendingEmails = await db.query(`
            SELECT id, recipient_email, subject, template, template_data 
            FROM email_queue 
            WHERE status = 'pending' 
            AND (scheduled_for IS NULL OR scheduled_for <= NOW())
            ORDER BY created_at ASC
            LIMIT ?
        `, [limit]);

        const results = [];

        for (const email of pendingEmails) {
            try {
                // Send email
                await sendEmail({
                    to: email.recipient_email,
                    subject: email.subject,
                    template: email.template,
                    data: JSON.parse(email.template_data)
                });

                // Mark as sent
                await db.query(
                    'UPDATE email_queue SET status = ?, sent_at = NOW() WHERE id = ?',
                    ['sent', email.id]
                );

                results.push({ id: email.id, status: 'sent' });

            } catch (error) {
                console.error(`Failed to send email ${email.id}:`, error);
                
                // Mark as failed
                await db.query(
                    'UPDATE email_queue SET status = ?, error_message = ? WHERE id = ?',
                    ['failed', error.message, email.id]
                );

                results.push({ id: email.id, status: 'failed', error: error.message });
            }
        }

        return results;

    } catch (error) {
        console.error('Email queue processing failed:', error);
        throw error;
    }
}

module.exports = {
    transporter,
    sendEmail,
    sendBulkEmail,
    queueEmail,
    processEmailQueue,
    renderTemplate,
    templates
};