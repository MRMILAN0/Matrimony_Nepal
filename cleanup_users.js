const db = require('./server/db');

// Ids 1 and 2 were the hardcoded Aarav and Zara
const idsToDelete = ['1', '2'];

console.log('Cleaning up default users...');

idsToDelete.forEach(id => {
    db.run("DELETE FROM users WHERE id = ?", [id], function (err) {
        if (err) return console.error(err.message);
        console.log(`Deleted user ${id}, changes: ${this.changes}`);
    });
});

// Also clean up messages involving them?
// db.run("DELETE FROM messages WHERE sender_id IN ('1','2') OR receiver_id IN ('1','2')");
