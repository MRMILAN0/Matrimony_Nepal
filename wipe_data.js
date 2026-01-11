const db = require('./server/db');

console.log('Wiping all data for a fresh start...');

db.serialize(() => {
    db.run("DELETE FROM messages", function (err) {
        if (err) console.error("Error clearing messages:", err.message);
        else console.log(`Deleted ${this.changes} messages.`);
    });

    db.run("DELETE FROM users", function (err) {
        if (err) console.error("Error clearing users:", err.message);
        else console.log(`Deleted ${this.changes} users.`);
    });
});
