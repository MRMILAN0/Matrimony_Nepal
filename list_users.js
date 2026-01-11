const db = require('./server/db');

db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) {
        console.error(err.message);
        return;
    }
    console.log("Current Users in DB:", rows.length);
    console.log(JSON.stringify(rows, null, 2));
});
