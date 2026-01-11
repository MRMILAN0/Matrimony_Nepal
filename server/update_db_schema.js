const db = require('./db');

db.serialize(() => {
    db.run("ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 0", (err) => {
        if (err && !err.message.includes('duplicate column')) console.error(err.message);
        else console.log("Added is_verified column.");
    });
    db.run("ALTER TABLE users ADD COLUMN verification_code TEXT", (err) => {
        if (err && !err.message.includes('duplicate column')) console.error(err.message);
        else console.log("Added verification_code column.");
    });
});
