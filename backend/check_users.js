const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'hospital.db');
const db = new sqlite3.Database(dbPath);

console.log("--- Checking User Data ---");
db.all("SELECT id, username, phone, status FROM users", [], (err, rows) => {
    if (err) {
        console.error("Error fetching users:", err.message);
    } else {
        console.table(rows);
    }
    db.close();
});
