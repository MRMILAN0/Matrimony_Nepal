const http = require('http');

function request(options, data, headers = {}) {
    return new Promise((resolve, reject) => {
        const reqOptions = { ...options, headers: { ...headers, ...options.headers } };
        const req = http.request(reqOptions, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function testChat() {
    console.log("Testing Chat System...");

    // 1. Create two users
    async function createUser(name, email) {
        const res = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/signup',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { name, email, password: "password123" });
        return JSON.parse(res.body);
    }

    try {
        const userA = await createUser("UserA", `a_${Date.now()}@test.com`);
        const userB = await createUser("UserB", `b_${Date.now()}@test.com`);
        console.log("Created Users:", userA.id, userB.id);

        // 2. User A sends message to User B
        const msgRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/messages',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            sender_id: userA.id,
            receiver_id: userB.id,
            content: "Hello from A!"
        });
        console.log("User A sent message:", msgRes.status);

        await sleep(1000);

        // 3. User B checks inbox (conversations)
        const convRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: '/api/conversations',
            method: 'GET',
        }, null, { 'x-user-id': userB.id });
        console.log("User B Inbox:", convRes.status, convRes.body);

        // 4. User B gets details of chat with User A
        const chatRes = await request({
            hostname: 'localhost',
            port: 3000,
            path: `/api/messages/${userA.id}`,
            method: 'GET',
        }, null, { 'x-user-id': userB.id });
        const messages = JSON.parse(chatRes.body);
        console.log("User B viewing chat:", messages.length, "messages");
        console.log("Content:", messages[0].content);

    } catch (e) {
        console.error("Test Failed", e);
    }
}

testChat();
