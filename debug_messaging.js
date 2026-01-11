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

async function debugMessaging() {
    console.log("Debugging Messaging Flow...");

    try {
        // 1. Create User X and User Y
        const userX = JSON.parse((await request({
            hostname: 'localhost', port: 3000, path: '/api/signup', method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { name: "UserX", email: `x_${Date.now()}@test.com`, password: "password" })).body);

        const userY = JSON.parse((await request({
            hostname: 'localhost', port: 3000, path: '/api/signup', method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { name: "UserY", email: `y_${Date.now()}@test.com`, password: "password" })).body);

        console.log(`Created Users: X(${userX.id}), Y(${userY.id})`);

        // 2. X sends message to Y
        const sendRes = await request({
            hostname: 'localhost', port: 3000, path: '/api/messages', method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { sender_id: userX.id, receiver_id: userY.id, content: "Hello Y from X" });
        console.log("X sent message:", sendRes.status);

        // 3. Y checks inbox (conversations)
        // Simulate Inbox polling: GET /api/conversations
        const convRes = await request({
            hostname: 'localhost', port: 3000, path: '/api/conversations', method: 'GET',
        }, null, { 'x-user-id': userY.id });
        console.log("Y Inbox (Conversations):", convRes.body);

        // 4. Y fetches messages with X
        // Simulate clicking chat: GET /api/messages/:otherId
        const chatRes = await request({
            hostname: 'localhost', port: 3000, path: `/api/messages/${userX.id}`, method: 'GET',
        }, null, { 'x-user-id': userY.id });

        console.log("Y fetching chat with X:", chatRes.status);
        const messages = JSON.parse(chatRes.body);
        console.log("Messages found:", messages.length);
        if (messages.length > 0) {
            console.log("First Message:", messages[0].content);
        } else {
            console.error("FAIL: No messages received!");
        }

    } catch (e) {
        console.error("Debug Failed", e);
    }
}

debugMessaging();
