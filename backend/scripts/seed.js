#!/usr/bin/env node

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedDatabase() {
    let connection;
    
    try {
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'tanzania_auctions'
        });

        console.log('🔌 Connected to database');
        console.log('🌱 Seeding database with sample data...');

        // Hash passwords
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const adminPassword = await bcrypt.hash('admin123', saltRounds);
        const userPassword = await bcrypt.hash('user123', saltRounds);

        // Insert sample users
        const users = [
            {
                username: 'admin',
                email: 'admin@tanzaniaauctions.com',
                password_hash: adminPassword,
                first_name: 'System',
                last_name: 'Administrator',
                phone: '+255700000000',
                account_type: 'admin',
                status: 'active',
                email_verified: true,
                phone_verified: true,
                identity_verified: true
            },
            {
                username: 'johndoe',
                email: 'john.doe@example.com',
                password_hash: userPassword,
                first_name: 'John',
                last_name: 'Doe',
                phone: '+255700000001',
                account_type: 'both',
                status: 'active',
                email_verified: true,
                phone_verified: true,
                identity_verified: true,
                nationality: 'Tanzanian',
                budget_range_min: 50000000,
                budget_range_max: 500000000
            },
            {
                username: 'janedoe',
                email: 'jane.doe@example.com',
                password_hash: userPassword,
                first_name: 'Jane',
                last_name: 'Doe',
                phone: '+255700000002',
                account_type: 'bidder',
                status: 'active',
                email_verified: true,
                phone_verified: true,
                identity_verified: true,
                nationality: 'Tanzanian',
                budget_range_min: 20000000,
                budget_range_max: 200000000
            }
        ];

        for (const user of users) {
            await connection.execute(
                `INSERT INTO users (username, email, password_hash, first_name, last_name, phone, 
                account_type, status, email_verified, phone_verified, identity_verified, 
                nationality, budget_range_min, budget_range_max, created_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    user.username, user.email, user.password_hash, user.first_name,
                    user.last_name, user.phone, user.account_type, user.status,
                    user.email_verified, user.phone_verified, user.identity_verified,
                    user.nationality || null, user.budget_range_min || 0, user.budget_range_max || 0
                ]
            );
        }

        console.log('✅ Sample users created');

        // Insert sample locations
        const locations = [
            { name: 'Dar es Salaam', region: 'Dar es Salaam', country: 'Tanzania' },
            { name: 'Arusha', region: 'Arusha', country: 'Tanzania' },
            { name: 'Mwanza', region: 'Mwanza', country: 'Tanzania' },
            { name: 'Dodoma', region: 'Dodoma', country: 'Tanzania' },
            { name: 'Mbeya', region: 'Mbeya', country: 'Tanzania' },
            { name: 'Morogoro', region: 'Morogoro', country: 'Tanzania' },
            { name: 'Tanga', region: 'Tanga', country: 'Tanzania' },
            { name: 'Kilimanjaro', region: 'Kilimanjaro', country: 'Tanzania' }
        ];

        for (const location of locations) {
            await connection.execute(
                'INSERT INTO locations (name, region, country) VALUES (?, ?, ?)',
                [location.name, location.region, location.country]
            );
        }

        console.log('✅ Sample locations created');

        // Insert sample categories
        const categories = [
            { name: 'Apartment', description: 'Residential apartment units', icon: 'apartment' },
            { name: 'House', description: 'Standalone residential houses', icon: 'house' },
            { name: 'Villa', description: 'Luxury villas and mansions', icon: 'villa' },
            { name: 'Commercial', description: 'Commercial buildings and spaces', icon: 'building' },
            { name: 'Land', description: 'Vacant land for development', icon: 'landscape' },
            { name: 'Farm', description: 'Agricultural land and farms', icon: 'agriculture' }
        ];

        for (const category of categories) {
            await connection.execute(
                'INSERT INTO categories (name, description, icon) VALUES (?, ?, ?)',
                [category.name, category.description, category.icon]
            );
        }

        console.log('✅ Sample categories created');

        // Insert sample properties
        const properties = [
            {
                title: 'Modern Apartment in Masaki',
                description: 'Beautiful modern apartment with ocean views, located in the heart of Masaki. Features 3 bedrooms, 2 bathrooms, and a spacious balcony.',
                property_type: 'residential',
                category_id: 1,
                location_id: 1,
                address: 'Masaki Peninsula, Dar es Salaam',
                bedrooms: 3,
                bathrooms: 2,
                parking_spaces: 2,
                total_area_sqm: 150,
                built_area_sqm: 120,
                starting_price: 350000000,
                reserve_price: 320000000,
                current_price: 350000000,
                owner_id: 2,
                features: JSON.stringify(['Ocean View', 'Modern Kitchen', 'Balcony', 'Security']),
                amenities: JSON.stringify(['Swimming Pool', 'Gym', 'Parking', '24/7 Security']),
                status: 'approved',
                is_featured: true
            },
            {
                title: 'Luxury Villa in Oyster Bay',
                description: 'Stunning luxury villa with private pool and garden. Perfect for families seeking comfort and privacy.',
                property_type: 'residential',
                category_id: 3,
                location_id: 1,
                address: 'Oyster Bay, Dar es Salaam',
                bedrooms: 5,
                bathrooms: 4,
                parking_spaces: 4,
                total_area_sqm: 800,
                built_area_sqm: 400,
                starting_price: 1200000000,
                reserve_price: 1100000000,
                current_price: 1200000000,
                owner_id: 3,
                features: JSON.stringify(['Private Pool', 'Garden', 'Garage', 'Staff Quarters']),
                amenities: JSON.stringify(['Swimming Pool', 'Garden', 'Garage', 'Security System']),
                status: 'approved',
                is_featured: true
            },
            {
                title: 'Commercial Building in City Center',
                description: 'Prime commercial property ideal for office space or retail business. High traffic location.',
                property_type: 'commercial',
                category_id: 4,
                location_id: 1,
                address: 'City Center, Dar es Salaam',
                bedrooms: 0,
                bathrooms: 4,
                parking_spaces: 20,
                total_area_sqm: 500,
                built_area_sqm: 450,
                starting_price: 800000000,
                reserve_price: 750000000,
                current_price: 800000000,
                owner_id: 2,
                features: JSON.stringify(['Prime Location', 'High Traffic', 'Parking', 'Elevator']),
                amenities: JSON.stringify(['Parking', 'Elevator', 'Security', 'Backup Generator']),
                status: 'pending',
                is_featured: false
            }
        ];

        for (const property of properties) {
            await connection.execute(
                `INSERT INTO properties (
                    title, description, property_type, category_id, location_id, address,
                    bedrooms, bathrooms, parking_spaces, total_area_sqm, built_area_sqm,
                    starting_price, reserve_price, current_price, owner_id, features, amenities,
                    status, is_featured, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    property.title, property.description, property.property_type,
                    property.category_id, property.location_id, property.address,
                    property.bedrooms, property.bathrooms, property.parking_spaces,
                    property.total_area_sqm, property.built_area_sqm,
                    property.starting_price, property.reserve_price, property.current_price,
                    property.owner_id, property.features, property.amenities,
                    property.status, property.is_featured
                ]
            );
        }

        console.log('✅ Sample properties created');

        // Insert sample auctions
        const auctions = [
            {
                property_id: 1,
                title: 'Auction for Modern Apartment in Masaki',
                description: 'Live auction for this beautiful modern apartment. Bidding starts at 350M TZS.',
                starting_price: 350000000,
                reserve_price: 320000000,
                current_price: 350000000,
                start_time: new Date(Date.now() + 3600000), // 1 hour from now
                end_time: new Date(Date.now() + 7 * 24 * 3600000), // 7 days from now
                status: 'scheduled',
                bid_increment_percentage: 5
            },
            {
                property_id: 2,
                title: 'Premium Villa Auction - Oyster Bay',
                description: 'Exclusive auction for luxury villa in prime location.',
                starting_price: 1200000000,
                reserve_price: 1100000000,
                current_price: 1200000000,
                start_time: new Date(Date.now() - 3600000), // Started 1 hour ago
                end_time: new Date(Date.now() + 6 * 24 * 3600000), // 6 days remaining
                status: 'live',
                bid_increment_percentage: 3
            }
        ];

        for (const auction of auctions) {
            await connection.execute(
                `INSERT INTO auctions (
                    property_id, title, description, starting_price, reserve_price,
                    current_price, start_time, end_time, status, bid_increment_percentage, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    auction.property_id, auction.title, auction.description,
                    auction.starting_price, auction.reserve_price, auction.current_price,
                    auction.start_time, auction.end_time, auction.status,
                    auction.bid_increment_percentage
                ]
            );
        }

        console.log('✅ Sample auctions created');

        // Insert sample bids
        const bids = [
            {
                auction_id: 2,
                user_id: 2,
                amount: 121000000,
                max_amount: 1300000000,
                bid_type: 'normal',
                is_winning: false
            },
            {
                auction_id: 2,
                user_id: 3,
                amount: 122000000,
                max_amount: 1400000000,
                bid_type: 'normal',
                is_winning: true
            }
        ];

        for (const bid of bids) {
            await connection.execute(
                `INSERT INTO bids (
                    auction_id, user_id, amount, max_amount, bid_type, is_winning, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                [
                    bid.auction_id, bid.user_id, bid.amount,
                    bid.max_amount, bid.bid_type, bid.is_winning
                ]
            );
        }

        console.log('✅ Sample bids created');

        // Insert sample notifications
        const notifications = [
            {
                user_id: 2,
                type: 'auction_started',
                title: 'Auction Started',
                message: 'The auction for Luxury Villa in Oyster Bay has started!',
                data: JSON.stringify({ auctionId: 2, propertyTitle: 'Luxury Villa in Oyster Bay' })
            },
            {
                user_id: 3,
                type: 'outbid',
                title: 'You Have Been Outbid',
                message: 'You have been outbid on the Luxury Villa auction.',
                data: JSON.stringify({ auctionId: 2, newAmount: 122000000 })
            }
        ];

        for (const notification of notifications) {
            await connection.execute(
                `INSERT INTO notifications (
                    user_id, type, title, message, data, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                    notification.user_id, notification.type,
                    notification.title, notification.message, notification.data
                ]
            );
        }

        console.log('✅ Sample notifications created');

        // Insert system settings
        const settings = [
            { category: 'general', key_name: 'site_name', value: 'Tanzania Real Estate Auctions', type: 'string', description: 'Website name' },
            { category: 'general', key_name: 'site_description', value: 'Premium real estate auction platform in Tanzania', type: 'string', description: 'Site description' },
            { category: 'auction', key_name: 'min_bid_increment', value: '100000', type: 'number', description: 'Minimum bid increment in TZS' },
            { category: 'auction', key_name: 'auto_extend_time', value: '300', type: 'number', description: 'Auto extend auction by seconds if bid in last minutes' },
            { category: 'email', key_name: 'notifications_enabled', value: 'true', type: 'boolean', description: 'Enable email notifications' },
            { category: 'security', key_name: 'max_login_attempts', value: '5', type: 'number', description: 'Maximum failed login attempts before lockout' }
        ];

        for (const setting of settings) {
            await connection.execute(
                `INSERT INTO system_settings (
                    category, key_name, value, type, description, created_at
                ) VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                    setting.category, setting.key_name, setting.value,
                    setting.type, setting.description
                ]
            );
        }

        console.log('✅ System settings created');

        console.log('🎉 Database seeding completed successfully!');
        console.log('📋 Sample data includes:');
        console.log('  - Admin user: admin@tanzaniaauctions.com / admin123');
        console.log('  - Regular users: john.doe@example.com / user123');
        console.log('  - Properties, auctions, bids, and notifications');
        console.log('  - System settings and configurations');

    } catch (error) {
        console.error('💥 Seeding failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Run seeding if this script is executed directly
if (require.main === module) {
    seedDatabase();
}

module.exports = { seedDatabase };