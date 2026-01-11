const http = require('http');

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

async function test() {
    console.log("Testing API...");

    // 1. Get Users
    try {
        const users = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/users',
            method: 'GET'
        });
        console.log("GET /users:", users.status);
    } catch (e) { console.error("GET /users failed", e); }

    // 2. Signup
    try {
        const signup = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/signup',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            name: "Script User",
            email: `script_${Date.now()}@test.com`,
            password: "password123"
        });
        console.log("POST /signup:", signup.status, signup.body);
    } catch (e) { console.error("POST /signup failed", e); }

    // 3. Login
    try {
        const login = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            email: "aarav@example.com", // Seed user
            password: "password"
        });
        console.log("POST /login:", login.status);
        if (login.status !== 200) console.log("Login body:", login.body);
    } catch (e) { console.error("POST /login failed", e); }
}

test();
