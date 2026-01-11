const mysql = require('mysql2');
const path = require('path');

// Load environment variables if not already loaded
// (Usually index.js loads them, but safe to reload)
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();

// Create Connection Pool
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASS, // Support both names
    database: process.env.DB_NAME
};

console.log("DB Config Check:", {
    host: dbConfig.host,
    user: dbConfig.user,
    database: dbConfig.database,
    hasPassword: !!dbConfig.password, // Log true/false only
    envLoaded: process.env.DB_USER ? "YES" : "NO"
});

const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Helper to convert SQLite style params (?) to MySQL style (?)
// Luckily, mysql2 supports '?' placeholders, so largely compatible!

// Wrapper to mimic SQLite API
const db = {
    // Run: EXECUTE (INSERT, UPDATE, DELETE)
    // Returns: { lastID, changes } via `this` context is hard to mimic perfectly in async/callback mix.
    // We will change the callback signature to (err) and attach props to a context object if possible,
    // OR we just patch the index.js usage. 
    // BETTER STRATEGY: Patch `run` to execute callback with `this` context shim.
    run: function (sql, params, callback) {
        // Handle optional params
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }

        pool.execute(sql, params, function (err, results) {
            if (err) {
                if (callback) callback(err);
                return;
            }
            // MySQL returns `insertId` and `affectedRows`
            // SQLite expects `this.lastID` and `this.changes`
            const context = {
                lastID: results.insertId,
                changes: results.affectedRows
            };
            if (callback) callback.call(context, null);
        });
    },

    // Get: SELECT SINGLE ROW
    get: function (sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        pool.execute(sql, params, function (err, results) {
            if (err) return callback(err);
            // Return first row or undefined
            callback(null, results[0]);
        });
    },

    // All: SELECT MULTIPLE ROWS
    all: function (sql, params, callback) {
        if (typeof params === 'function') {
            callback = params;
            params = [];
        }
        pool.execute(sql, params, function (err, results) {
            if (err) return callback(err);
            callback(null, results);
        });
    }
};

// INITIALIZATION: Create Tables
function initDb() {
    console.log("Initializing MySQL Database...");

    // Users Table
    const createUsers = `
        CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255),
            email VARCHAR(255) UNIQUE,
            password VARCHAR(255),
            location VARCHAR(255),
            profession VARCHAR(255),
            about TEXT,
            qualities TEXT,
            lookingFor TEXT,
            joined VARCHAR(255),
            photo VARCHAR(255),
            dob VARCHAR(255),
            showAge TINYINT DEFAULT 1,
            showPhoto TINYINT DEFAULT 1,
            is_verified TINYINT DEFAULT 0,
            verification_code VARCHAR(255)
        )
    `;

    // Messages Table
    const createMessages = `
        CREATE TABLE IF NOT EXISTS messages (
            id INT AUTO_INCREMENT PRIMARY KEY,
            sender_id VARCHAR(255),
            receiver_id VARCHAR(255),
            content TEXT,
            timestamp VARCHAR(255),
            is_read TINYINT DEFAULT 0,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `;

    db.run(createUsers, (err) => {
        if (err) console.error("Error creating users table:", err);
        else {
            // Migration for MySQL (Add Columns if missing)
            // MySQL doesn't have "IF NOT EXIST COLUMN" easily in one line like SQLite might allow with quirks.
            // We use a try-catch style approach or stored procedure, but for this simple app,
            // we will just run the ALTER commands and ignore "Duplicate column" errors.
            const migrations = [
                "ALTER TABLE users ADD COLUMN showPhoto TINYINT DEFAULT 1",
                "ALTER TABLE users ADD COLUMN is_verified TINYINT DEFAULT 0",
                "ALTER TABLE users ADD COLUMN verification_code VARCHAR(255)"
            ];
            migrations.forEach(sql => {
                db.run(sql, (e) => { /* ignore duplicate col error */ });
            });
            console.log("Users table ready.");
        }
    });

    db.run(createMessages, (err) => {
        if (err) console.error("Error creating messages table:", err);
        else console.log("Messages table ready.");
    });
}

// Start Init
initDb();

module.exports = db;
