const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// In-memory data store
let users = [];

const fs = require('fs');

// Configure Multer for file uploads
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads'));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Serve Uploads
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Upload Endpoint
app.post('/api/upload', upload.single('photo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return the URL relative to the public folder
    res.json({ url: '/uploads/' + req.file.filename });
});

// Seed initial data if empty
if (users.length === 0) {
    users = [
        { id: '1', name: 'Aarav', email: 'aarav@example.com', password: 'password', location: 'Berlin', profession: 'Software Engineer', about: 'Loves hiking and coding.', qualities: ['Honest', 'Adventurous'], lookingFor: 'Kindness', photo: null },
        { id: '2', name: 'Zara', email: 'zara@example.com', password: 'password', location: 'Munich', profession: 'Student', about: 'Enjoying art and music.', qualities: ['Creative', 'Calm'], lookingFor: 'Intellectual connection', photo: null }
    ];
}

// API Routes
app.get('/api/users', (req, res) => {
    // Return all users except passwords
    const safeUsers = users.map(u => {
        const { password, ...safeRequest } = u;
        return safeRequest;
    });
    res.json(safeUsers);
});

app.post('/api/signup', (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password || !name) {
        return res.status(400).json({ error: 'Missing fields' });
    }

    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
    }

    const newUser = {
        id: Date.now().toString(),
        ...req.body,
        joined: new Date().toISOString(),
        qualities: []
    };

    users.push(newUser);
    const { password: _, ...userNoPass } = newUser;
    res.json(userNoPass);
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
        const { password: _, ...userNoPass } = user;
        res.json(userNoPass);
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const updates = req.body;

    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
        users[index] = { ...users[index], ...updates };
        const { password: _, ...userNoPass } = users[index];
        res.json(userNoPass);
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
