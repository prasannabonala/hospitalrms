const db = require('./database');

db.all("SELECT id, username, certificate_path FROM users ORDER BY id DESC LIMIT 5", [], (err, rows) => {
    if (err) {
        console.error(err);
    } else {
        console.log(rows);
    }
});
