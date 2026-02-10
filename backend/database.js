const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'hospital.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeTables();
    }
});

function initializeTables() {
    db.serialize(() => {
        // Hospitals Table
        db.run(`CREATE TABLE IF NOT EXISTS hospitals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            location TEXT
        )`);

        // Resources Table (Beds, Equipment)
        db.run(`CREATE TABLE IF NOT EXISTS resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hospital_id INTEGER,
            name TEXT NOT NULL, 
            type TEXT NOT NULL, -- 'BED', 'ICU', 'VENTILATOR'
            floor TEXT,
            ward TEXT,
            department TEXT,
            total_count INTEGER DEFAULT 0,
            available_count INTEGER DEFAULT 0,
            FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
        )`);

        // Users Table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            department TEXT,
            phone TEXT,
            certificate_path TEXT,
            status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
            role TEXT DEFAULT 'user', -- 'admin', 'user'
            hospital_id INTEGER,
            FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
        )`);

        // Messages Table
        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (sender_id) REFERENCES users(id),
            FOREIGN KEY (receiver_id) REFERENCES users(id)
        )`);

        // Seed Initial Data if empty
        db.get("SELECT count(*) as count FROM hospitals", (err, row) => {
            if (row.count === 0) {
                console.log("Seeding initial data...");
                db.run(`INSERT INTO hospitals (name, location) VALUES ('General Hospital', 'Downtown')`, function (err) {
                    if (!err) {
                        const hospId = this.lastID;

                        const resources = [
                            // Floor 1 - General Medicine & Orthopedics
                            { name: 'Gen Med Bed', type: 'BED', floor: 'Floor 1', ward: 'Ward A', dept: 'General Medicine', total: 20, available: 5 },
                            { name: 'Ortho Bed', type: 'BED', floor: 'Floor 1', ward: 'Ward B', dept: 'Orthopedics', total: 15, available: 8 },

                            // Floor 2 - ICU
                            { name: 'Cardiac ICU', type: 'ICU', floor: 'Floor 2', ward: 'ICU-1', dept: 'Cardiology', total: 6, available: 1 },
                            { name: 'Neuro ICU', type: 'ICU', floor: 'Floor 2', ward: 'ICU-2', dept: 'Neurology', total: 4, available: 1 },

                            // Floor 3 - Pediatrics
                            { name: 'Peds Bed', type: 'BED', floor: 'Floor 3', ward: 'Ward C', dept: 'Pediatrics', total: 15, available: 7 },

                            // Ventilators (Mobile/Department specific)
                            { name: 'ER Ventilator', type: 'VENTILATOR', floor: 'Ground', ward: 'ER', dept: 'Emergency', total: 2, available: 1 },
                            { name: 'ICU Ventilator', type: 'VENTILATOR', floor: 'Floor 2', ward: 'ICU', dept: 'Intensive Care', total: 3, available: 0 }
                        ];
                        const stmt = db.prepare(`INSERT INTO resources (hospital_id, name, type, floor, ward, department, total_count, available_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
                        resources.forEach(r => stmt.run(hospId, r.name, r.type, r.floor, r.ward, r.dept, r.total, r.available));
                        stmt.finalize();

                        // Default admin user
                        db.run(`INSERT INTO users (username, password, role, status, hospital_id) VALUES ('admin', 'admin123', 'admin', 'approved', ?)`, [hospId]);
                    }
                });
            }
        });
    });
}

module.exports = db;
