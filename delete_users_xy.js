const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const namesToDelete = ['UserX', 'UserY'];

db.serialize(() => {
    const placeholders = namesToDelete.map(() => '?').join(',');
    db.run(`DELETE FROM users WHERE name IN (${placeholders})`, namesToDelete, function (err) {
        if (err) {
            console.error(err.message);
        } else {
            console.log(`Deleted ${this.changes} users.`);
        }
    });
});

db.close();
