const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');
const db = require('./db');
const fs = require('fs');
const multer = require('multer');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Try loading from parent directory explicitly
require('dotenv').config({ path: path.join(__dirname, '../.env') });
// Fallback to default
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Email Configuration
const transporter = nodemailer.createTransport({
    host: 'mail.milanpathak.com.np',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// ... [middle of file] ...

// Encryption Configuration
const ENCRYPTION_KEY = crypto.scryptSync('matrimony-nepal-secure-key', 'salt', 32);
const IV_LENGTH = 16;

function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    if (!text) return text;
    try {
        const textParts = text.split(':');
        if (textParts.length !== 2) return text; // Not encrypted
        const iv = Buffer.from(textParts[0], 'hex');
        const encryptedText = Buffer.from(textParts[1], 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        // Return original if decryption fails (backward compatibility)
        return text;
    }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Configure Multer (Memory Storage for Encryption)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Secure Image Access Endpoint
app.get('/api/images/:filename', (req, res) => {
    const { filename } = req.params;
    // Prevent directory traversal
    const safeName = path.basename(filename);
    const encPath = path.join(__dirname, '../public/uploads', safeName + '.enc');

    if (!fs.existsSync(encPath)) {
        return res.status(404).send('Image not found');
    }

    try {
        const encryptedData = fs.readFileSync(encPath);
        // Split IV and Content. We used simple crypto.createCipheriv format earlier.
        // But for Files, let's use a simpler approach or reuse the same `encrypt`/`decrypt` helpers if buffer compatible?
        // Actually, our helpers work on text strings (hex).
        // Let's create specific BUFFER helpers for file efficiency.

        // BUFFER DECRYPTION
        // We will store as: IV (16 bytes) + EncryptedContent
        const iv = encryptedData.subarray(0, 16);
        const content = encryptedData.subarray(16);

        const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);

        res.setHeader('Content-Type', 'image/jpeg'); // Assumes JPEG/PNG
        res.send(decrypted);
    } catch (e) {
        console.error("Decryption Error:", e);
        res.status(500).send('Error loading image');
    }
});

// Encrypted Upload Endpoint
app.post('/api/upload', upload.single('photo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const filename = uniqueSuffix + path.extname(req.file.originalname); // e.g. 123.jpg
        const savePath = path.join(__dirname, '../public/uploads', filename + '.enc');

        // BUFFER ENCRYPTION
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        const encrypted = Buffer.concat([iv, cipher.update(req.file.buffer), cipher.final()]);

        // Ensure directory exists
        if (!fs.existsSync(path.join(__dirname, '../public/uploads'))) {
            fs.mkdirSync(path.join(__dirname, '../public/uploads'), { recursive: true });
        }

        fs.writeFileSync(savePath, encrypted);

        // Return the API URL, not the file path
        res.json({ url: '/api/images/' + filename });
    } catch (e) {
        console.error("Upload Error:", e);
        res.status(500).json({ error: 'Encryption failed' });
    }
});


// API Routes
app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// DEBUG EMAIL ROUTE (Remove later)
app.get('/api/test-email', async (req, res) => {
    try {
        console.log("Attempting to send test email...");
        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER, // Send to self
            subject: 'Test Email - SMTP Check',
            text: 'If you see this, SMTP is working!',
        });
        res.json({ message: 'Email Sent Successfully!', info: info });
    } catch (err) {
        console.error("SMTP Error:", err);
        res.status(500).json({ error: 'SMTP Failed', details: err.message, stack: err.stack });
    }
});

// Helper to calculate age
function calculateAge(dob) {
    if (!dob) return null;
    const diff = Date.now() - new Date(dob).getTime();
    const ageDate = new Date(diff);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}

// Get all users (except passwords)
app.get('/api/users', (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        const safeUsers = rows.map(u => {
            const { password, ...user } = u;
            // Parse qualities if string
            if (typeof user.qualities === 'string') {
                try { user.qualities = JSON.parse(user.qualities); } catch (e) { user.qualities = []; }
            }
            // Age Privacy Logic
            if (user.showAge && user.dob) {
                user.age = calculateAge(user.dob);
            } else {
                user.age = null;
            }

            // Photo Privacy Logic
            if (user.showPhoto === 0) {
                user.photo = null;
            }

            return user;
        });
        res.json(safeUsers);
    });
});

// Signup
app.post('/api/signup', (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    // Check if user exists
    db.get("SELECT email FROM users WHERE email = ?", [email], async (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (row) return res.status(409).json({ error: 'User already exists' });

        try {
            const hashedPassword = await bcrypt.hash(password, 10);
            const id = Date.now().toString();
            const joined = new Date().toISOString();

            // Verification Code
            const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

            // Handle optional fields
            const location = req.body.location || '';
            const profession = req.body.profession || '';
            const about = req.body.about || '';
            const lookingFor = req.body.lookingFor || '';
            const photo = req.body.photo || null;
            const dob = req.body.dob || null;
            const showAge = req.body.showAge !== undefined ? req.body.showAge : 1;
            const showPhoto = req.body.showPhoto !== undefined ? req.body.showPhoto : 1;

            // Ensure qualities is stored as string
            const qualities = JSON.stringify(req.body.qualities || []);

            // Insert
            db.run(`INSERT INTO users (id, name, email, password, location, profession, about, qualities, lookingFor, joined, photo, dob, showAge, showPhoto, is_verified, verification_code) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
                [id, name, email, hashedPassword, location, profession, about, qualities, lookingFor, joined, photo, dob, showAge, showPhoto, verificationCode],
                async function (err) {
                    // ... [No changes to email logic] ...

                    // ... [Inside Update API] ...
                    // Allowed fields to update
                    const allowed = ['name', 'location', 'profession', 'about', 'qualities', 'lookingFor', 'photo', 'dob', 'showAge', 'showPhoto'];
                    if (err) {
                        if (err.message.includes('has no column')) {
                            return res.status(500).json({ error: 'Database Schema Error: Please run migration.' });
                        }
                        return res.status(500).json({ error: err.message });
                    }

                    // Send Email
                    try {
                        await sendVerificationEmail(email, verificationCode);
                        res.json({ message: 'Signup successful. Please verify email.', id: id, email: email });
                    } catch (emailErr) {
                        console.error('Email Error:', emailErr);
                        res.json({ message: 'Signup successful but failed to send email.', id: id, email: email, debug_code: verificationCode });
                    }
                }
            );
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
});

// Resend Code API
app.post('/api/resend-code', (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.is_verified === 1) return res.status(400).json({ error: 'Already verified' });

        const newCode = Math.floor(100000 + Math.random() * 900000).toString();

        db.run("UPDATE users SET verification_code = ? WHERE email = ?", [newCode, email], async (err) => {
            if (err) return res.status(500).json({ error: err.message });
            try {
                await sendVerificationEmail(email, newCode);
                res.json({ message: 'Code sent' });
            } catch (e) {
                res.status(500).json({ error: 'Failed to send email' });
            }
        });
    });
});

// Helper: Send Verification Email
async function sendVerificationEmail(email, code) {
    const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background: #dc143c; padding: 20px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Matrimony Nepal</h1>
        </div>
        <div style="padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #003893; margin-top: 0;">Namaste! 🙏</h2>
            <p>Welcome to <strong>Matrimony Nepal</strong>. You are one step away from finding your life partner.</p>
            
            <div style="background: #f9f9f9; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
                <p style="margin: 0; font-size: 14px; color: #666;">Your Verification Code</p>
                <div style="font-size: 32px; font-weight: bold; color: #dc143c; letter-spacing: 5px; margin-top: 5px;">${code}</div>
            </div>

            <h3 style="color: #003893;">Our Community Promise</h3>
            <p>At Matrimony Nepal, we cherish our culture and values. By verifying your account, you agree to:</p>
            <ul style="color: #555; line-height: 1.6;">
                <li>Respect all members and their privacy.</li>
                <li>Uphold the dignity of our Nepalese traditions.</li>
                <li>Be honest in your profile and interactions.</li>
                <li>Report any suspicious or harmful behavior immediately.</li>
            </ul>

            <p style="margin-top: 30px; font-size: 13px; color: #888;">If you did not create this account, please ignore this email.</p>
        </div>
    </div>
    `;

    await transporter.sendMail({
        from: '"Matrimony Nepal" <authenticate@milanpathak.com.np>',
        to: email,
        subject: 'Verify Your Identity - Matrimony Nepal',
        text: `Your code is ${code}. Please respect our community guidelines.`,
        html: html
    });
}

// Verify API
app.post('/api/verify', (req, res) => {
    const { email, code } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (user.verification_code === code) {
            db.run("UPDATE users SET is_verified = 1, verification_code = NULL WHERE email = ?", [email], (err) => {
                if (err) return res.status(500).json({ error: err.message });

                // Return user object for immediate login
                const { password: _, ...userNoPass } = user;
                if (typeof userNoPass.qualities === 'string') {
                    try { userNoPass.qualities = JSON.parse(userNoPass.qualities); } catch (e) { userNoPass.qualities = []; }
                }
                userNoPass.is_verified = 1;
                res.json(userNoPass);
            });
        } else {
            res.status(400).json({ error: 'Invalid Code' });
        }
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        // Check Verification
        if (user.is_verified === 0) {
            return res.status(403).json({ error: 'Email not verified', email: email });
        }

        try {
            const match = await bcrypt.compare(password, user.password);
            if (match) {
                const { password: _, ...userNoPass } = user;
                if (typeof userNoPass.qualities === 'string') {
                    try { userNoPass.qualities = JSON.parse(userNoPass.qualities); } catch (e) { userNoPass.qualities = []; }
                }
                res.json(userNoPass);
            } else {
                res.status(401).json({ error: 'Invalid credentials' });
            }
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
});

// Update Profile
app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    // Allowed fields to update
    const allowed = ['name', 'location', 'profession', 'about', 'qualities', 'lookingFor', 'photo', 'dob', 'showAge', 'showPhoto'];
    const fields = [];
    const values = [];

    for (const key of allowed) {
        if (updates[key] !== undefined) {
            fields.push(`${key} = ?`);
            let val = updates[key];
            if (key === 'qualities' && Array.isArray(val)) {
                val = JSON.stringify(val);
            }
            values.push(val);
        }
    }

    if (fields.length === 0) return res.json({}); // Nothing to update

    values.push(id);

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;

    db.run(sql, values, function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'User not found' });

        // Return updated user
        db.get("SELECT * FROM users WHERE id = ?", [id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'User not found' });

            const { password: _, ...userNoPass } = row;
            if (typeof userNoPass.qualities === 'string') {
                try { userNoPass.qualities = JSON.parse(userNoPass.qualities); } catch (e) { userNoPass.qualities = []; }
            }
            res.json(userNoPass);
        });
    });
});

// Delete Account
app.delete('/api/me', (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    db.get("SELECT photo FROM users WHERE id = ?", [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'User not found' });

        // 1. Delete Photo File
        if (row.photo && row.photo.includes('/api/images/')) {
            const filename = row.photo.split('/').pop();
            const photoPath = path.join(__dirname, '../public/uploads', filename + '.enc');
            if (fs.existsSync(photoPath)) {
                try {
                    fs.unlinkSync(photoPath);
                } catch (e) {
                    console.error("Failed to delete photo:", e);
                }
            }
        } else if (row.photo && row.photo.startsWith('/uploads/')) {
            // Legacy support for non-encrypted files
            const photoPath = path.join(__dirname, '../public' + row.photo);
            if (fs.existsSync(photoPath)) {
                try { fs.unlinkSync(photoPath); } catch (e) { }
            }
        }

        // 2. Delete All Messages (Sent OR Received)
        db.run("DELETE FROM messages WHERE sender_id = ? OR receiver_id = ?", [userId, userId], (err) => {
            if (err) console.error("Message deletion error:", err);

            // 3. Delete User
            db.run("DELETE FROM users WHERE id = ?", [userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Account deleted successfully' });
            });
        });
    });
});

// Messages API

// Get Unread Count
app.get('/api/notifications/unread-count', (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    db.get("SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND is_read = 0", [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ count: row.count });
    });
});

// Get Conversations (users chatted with)
app.get('/api/conversations', (req, res) => {
    // This is a simplified auth check. In real app, rely on session/token
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const sql = `
        SELECT 
            t.other_id,
            SUM(CASE WHEN m.receiver_id = ? AND m.is_read = 0 THEN 1 ELSE 0 END) as unread_count
        FROM (
            SELECT DISTINCT 
                CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as other_id
            FROM messages 
            WHERE sender_id = ? OR receiver_id = ?
        ) t
        JOIN messages m ON (m.sender_id = t.other_id AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = t.other_id)
        GROUP BY t.other_id
    `;

    db.all(sql, [userId, userId, userId, userId, userId, userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });

        if (rows.length === 0) return res.json([]);

        // Fetch details for these users
        const placeholders = rows.map(() => '?').join(',');
        const ids = rows.map(r => r.other_id);
        const unreadMap = rows.reduce((acc, r) => {
            acc[r.other_id] = r.unread_count;
            return acc;
        }, {});

        db.all(`SELECT id, name, photo FROM users WHERE id IN (${placeholders})`, ids, (err, users) => {
            if (err) return res.status(500).json({ error: err.message });

            // Attach unread counts
            const usersWithCount = users.map(u => ({
                ...u,
                unread_count: unreadMap[u.id] || 0
            }));

            res.json(usersWithCount);
        });
    });
});

// Get Messages with specific user
app.get('/api/messages/:otherId', (req, res) => {
    const userId = req.headers['x-user-id'];
    const { otherId } = req.params;

    console.log(`[MSG] Fetching messages between ${userId} and ${otherId}`);

    if (!userId) {
        console.error("[MSG] Unauthorized fetch attempt");
        return res.status(401).json({ error: 'Unauthorized' });
    }

    db.all(`
        SELECT * FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        ORDER BY timestamp ASC
    `, [userId, otherId, otherId, userId], (err, rows) => {
        if (err) {
            console.error("[MSG] Access Error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        console.log(`[MSG] Found ${rows.length} messages`);

        // Decrypt messages
        const decryptedRows = rows.map(msg => ({
            ...msg,
            content: decrypt(msg.content)
        }));

        // Mark as read
        db.run("UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0",
            [otherId, userId],
            (err) => {
                if (err) console.error("[MSG] Update Read Error:", err);
            }
        );

        res.json(decryptedRows);
    });
});


// Logging Messages API
app.post('/api/messages', (req, res) => {
    const { sender_id, receiver_id, content } = req.body;
    console.log(`[MSG] Sending from ${sender_id} to ${receiver_id}: ${content}`);

    if (!sender_id || !receiver_id || !content) {
        console.error("[MSG] Missing fields");
        return res.status(400).json({ error: 'Missing fields' });
    }

    const timestamp = new Date().toISOString();
    const encryptedContent = encrypt(content);

    db.run(`INSERT INTO messages (sender_id, receiver_id, content, timestamp) VALUES (?, ?, ?, ?)`,
        [sender_id, receiver_id, encryptedContent, timestamp],
        function (err) {
            if (err) {
                console.error("[MSG] Insert Error:", err.message);
                return res.status(500).json({ error: err.message });
            }
            console.log(`[MSG] Saved. ID: ${this.lastID}`);
            res.json({ id: this.lastID, sender_id, receiver_id, content, timestamp });
        }
    );
});

// API 404 Handler
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API Endpoint Not Found' });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});