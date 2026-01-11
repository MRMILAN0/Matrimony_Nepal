const fs = require('fs');
const path = require('path');

const logPath = path.join(__dirname, 'startup_log.txt');

function log(msg) {
    const time = new Date().toISOString();
    fs.appendFileSync(logPath, `[${time}] ${msg}\n`);
}

log("Starting application...");

try {
    // Try to load the main server file
    log("Requiring ./server/index.js...");
    require('./server/index');
    log("Successfully required ./server/index.js");
} catch (error) {
    log("CRITICAL ERROR: " + error.message);
    log(error.stack);

    // Create a fallback server so cPanel doesn't just 503
    const http = require('http');
    http.createServer((req, res) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server Startup Failed. Check startup_log.txt.\n\nError: ' + error.message);
    }).listen(process.env.PORT || 3000);
}
