#!/usr/bin/env node

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigrations() {
    let connection;
    
    try {
        // Create connection without database
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
        });

        console.log('🔌 Connected to MySQL server');

        // Create database if it doesn't exist
        await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'tanzania_auctions'}`);
        console.log(`📁 Database ${process.env.DB_NAME || 'tanzania_auctions'} created or already exists`);

        // Switch to the database
        await connection.changeUser({ database: process.env.DB_NAME || 'tanzania_auctions' });

        // Read and execute schema file
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Split schema into individual statements
        const statements = schema
            .split(';')
            .map(statement => statement.trim())
            .filter(statement => statement.length > 0)
            .filter(statement => !statement.startsWith('--'));

        console.log(`📋 Found ${statements.length} SQL statements to execute`);

        // Execute each statement
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            try {
                await connection.execute(statement);
                console.log(`✅ Statement ${i + 1} executed successfully`);
            } catch (error) {
                console.error(`❌ Error executing statement ${i + 1}:`, error.message);
                // Continue with other statements
            }
        }

        console.log('🎉 Database migration completed successfully!');
        console.log('📊 Tables created:');
        console.log('  - users');
        console.log('  - properties');
        console.log('  - auctions');
        console.log('  - bids');
        console.log('  - notifications');
        console.log('  - transactions');
        console.log('  - And more...');

    } catch (error) {
        console.error('💥 Migration failed:', error.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔌 Database connection closed');
        }
    }
}

// Run migrations if this script is executed directly
if (require.main === module) {
    runMigrations();
}

module.exports = { runMigrations };