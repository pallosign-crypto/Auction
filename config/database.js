const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tanzania_auctions',
    connectionLimit: process.env.DB_CONNECTION_LIMIT || 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    multipleStatements: true,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        return false;
    }
}

// Execute query with error handling
async function query(sql, params = []) {
    let connection;
    try {
        connection = await pool.getConnection();
        const [results] = await connection.execute(sql, params);
        return results;
    } catch (error) {
        console.error('Database query error:', error.message);
        console.error('SQL:', sql);
        console.error('Params:', params);
        throw error;
    } finally {
        if (connection) {
            connection.release();
        }
    }
}

// Transaction support
async function transaction(queries) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        const results = [];
        for (const { sql, params } of queries) {
            const [result] = await connection.execute(sql, params);
            results.push(result);
        }
        
        await connection.commit();
        return results;
    } catch (error) {
        await connection.rollback();
        console.error('Transaction error:', error.message);
        throw error;
    } finally {
        connection.release();
    }
}

// Get connection for raw queries
async function getConnection() {
    return await pool.getConnection();
}

// Escape values for raw queries
function escape(value) {
    return mysql.escape(value);
}

// Format date for MySQL
function formatDate(date) {
    return date.toISOString().slice(0, 19).replace('T', ' ');
}

// Close pool
async function closePool() {
    await pool.end();
}

// Export database functions
module.exports = {
    pool,
    query,
    transaction,
    testConnection,
    getConnection,
    escape,
    formatDate,
    closePool
};