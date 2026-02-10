const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'hospital.db');
const db = new sqlite3.Database(dbPath);

console.log("--- Detailed User Data Check ---");
db.all("SELECT * FROM users", [], (err, rows) => {
    if (err) {
        console.error("Error:", err.message);
    } else {
        rows.forEach(user => {
            console.log(`ID: ${user.id} | User: ${user.username} | Phone: [${user.phone}] | Status: ${user.status}`);
        });
    }
    db.close();
});
