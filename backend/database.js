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

        // Resources Table (Legacy/Aggregate - Keeping for now or can be deprecated)
        db.run(`CREATE TABLE IF NOT EXISTS resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hospital_id INTEGER,
            name TEXT NOT NULL, 
            type TEXT NOT NULL, 
            floor TEXT,
            ward TEXT,
            department TEXT,
            total_count INTEGER DEFAULT 0,
            available_count INTEGER DEFAULT 0,
            FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
        )`);

        // --- NEW DETAILED TABLES ---

        // Beds Table
        db.run(`CREATE TABLE IF NOT EXISTS beds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL, -- 'General Ward', 'Private Room', 'Isolation', 'Emergency', 'Pediatrics'
            department TEXT,
            floor TEXT,
            status TEXT DEFAULT 'available', -- 'available', 'occupied', 'maintenance'
            hospital_id INTEGER,
            FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
        )`);

        // Equipment Table
        db.run(`CREATE TABLE IF NOT EXISTS equipment (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL, -- 'Ventilator', 'ECG', 'MRI', etc.
            department TEXT,
            status TEXT DEFAULT 'available', -- 'available', 'in_use', 'maintenance'
            last_service_date DATE,
            assigned_to TEXT, -- Patient ID, OT ID, or 'None'
            hospital_id INTEGER,
            FOREIGN KEY (hospital_id) REFERENCES hospitals(id)
        )`);

        // Operation Theatres Table
        db.run(`CREATE TABLE IF NOT EXISTS operation_theatres (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            specialty TEXT, -- 'Cardio', 'Neuro', 'Ortho', etc.
            status TEXT DEFAULT 'available', -- 'available', 'in_use', 'cleaning'
            next_scheduled_surgery DATETIME,
            equipment_assigned TEXT, -- Comma separated IDs or JSON
            hospital_id INTEGER,
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
            status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'blocked'
            role TEXT DEFAULT 'user', -- 'admin', 'user', 'dept_head', 'staff'
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

        // Alerts Table
        db.run(`CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resource_id INTEGER, -- Can link to beds/equipment tables now logically
            resource_name TEXT,
            alert_type TEXT NOT NULL, 
            severity TEXT NOT NULL, 
            message TEXT NOT NULL,
            threshold_value INTEGER,
            
            status TEXT DEFAULT 'pending',
            
            raised_by INTEGER NOT NULL,
            raised_by_name TEXT,
            raised_by_dept TEXT,
            raised_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            dept_head_id INTEGER,
            verified_at DATETIME,
            verification_notes TEXT,
            
            admin_id INTEGER,
            admin_action TEXT,
            admin_notes TEXT,
            resolved_at DATETIME,
            
            FOREIGN KEY (raised_by) REFERENCES users(id),
            FOREIGN KEY (dept_head_id) REFERENCES users(id),
            FOREIGN KEY (admin_id) REFERENCES users(id)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS doctors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        dr_id TEXT,
        category TEXT,
        department TEXT,
        shift TEXT,
        availability TEXT,
        max_load INTEGER,
        current_load INTEGER DEFAULT 0
    )`);

        db.run(`CREATE TABLE IF NOT EXISTS nurses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        emp_id TEXT,
        category TEXT,
        department TEXT,
        availability TEXT,
        ratio TEXT,
        current_load INTEGER DEFAULT 0
    )`);

        // Seed Initial Data if empty
        db.get("SELECT count(*) as count FROM hospitals", (err, row) => {
            if (row.count === 0) {
                console.log("Seeding initial data...");
                db.run(`INSERT INTO hospitals (name, location) VALUES ('General Hospital', 'Downtown')`, function (err) {
                    if (!err) {
                        const hospId = this.lastID;

                        // Seed Beds
                        const bedTypes = [
                            { type: 'General Ward', dept: 'General Medicine', count: 20, floor: '1st Floor', prefix: 'BED-GM' },
                            { type: 'Private Room', dept: 'General Medicine', count: 5, floor: '2nd Floor', prefix: 'BED-GM-PVT' },
                            { type: 'General Ward', dept: 'Orthopedics', count: 15, floor: '3rd Floor', prefix: 'BED-ORTHO' },
                            { type: 'General Ward', dept: 'Cardiology', count: 15, floor: '4th Floor', prefix: 'BED-CARDIO' },
                            { type: 'ICU Bed', dept: 'Intensive Care', count: 10, floor: '5th Floor', prefix: 'BED-ICU' },
                            { type: 'General Ward', dept: 'Neurology', count: 10, floor: '5th Floor', prefix: 'BED-NEURO' },
                            { type: 'Pediatric Bed', dept: 'Pediatrics', count: 10, floor: '2nd Floor', prefix: 'BED-PED' },
                            { type: 'Emergency Bed', dept: 'Emergency', count: 15, floor: 'Ground Floor', prefix: 'BED-EMG' },
                            { type: 'Isolation Bed', dept: 'Infectious Diseases', count: 5, floor: 'Isolated Wing', prefix: 'BED-ISO' }
                        ];

                        const bedStmt = db.prepare(`INSERT INTO beds (name, type, department, floor, status, hospital_id) VALUES (?, ?, ?, ?, ?, ?)`);
                        bedTypes.forEach(b => {
                            for (let i = 1; i <= b.count; i++) {
                                bedStmt.run(`${b.prefix}-${String(i).padStart(3, '0')}`, b.type, b.dept, b.floor, 'available', hospId);
                            }
                        });
                        bedStmt.finalize();

                        // Seed Equipment
                        const equipTypes = [
                            { type: 'Ventilator', dept: 'Intensive Care', count: 10, prefix: 'VENT' },
                            { type: 'Ventilator', dept: 'Emergency', count: 5, prefix: 'VENT-EMG' },
                            { type: 'ECG Machine', dept: 'Cardiology', count: 5, prefix: 'ECG' },
                            { type: 'ECG Machine', dept: 'Emergency', count: 3, prefix: 'ECG-EMG' },
                            { type: 'Infusion Pump', dept: 'Intensive Care', count: 15, prefix: 'INF' },
                            { type: 'Infusion Pump', dept: 'Surgery', count: 10, prefix: 'INF-SURG' },
                            { type: 'Defibrillator', dept: 'Emergency', count: 5, prefix: 'DEFIB' },
                            { type: 'Defibrillator', dept: 'Cardiology', count: 3, prefix: 'DEFIB-CARD' },
                            { type: 'Oxygen Cylinder', dept: 'General Storage', count: 50, prefix: 'O2' },
                            { type: 'Patient Monitor', dept: 'Intensive Care', count: 20, prefix: 'PM-ICU' },
                            { type: 'Patient Monitor', dept: 'Emergency', count: 10, prefix: 'PM-EMG' },
                            { type: 'MRI Machine', dept: 'Radiology', count: 2, prefix: 'MRI' },
                            { type: 'CT Scanner', dept: 'Radiology', count: 1, prefix: 'CT' },
                            { type: 'Dialysis Machine', dept: 'Nephrology', count: 6, prefix: 'DIAL' },
                            { type: 'Ultrasound Machine', dept: 'Radiology', count: 3, prefix: 'USG' },
                            { type: 'Ultrasound Machine', dept: 'Gynecology', count: 2, prefix: 'USG-GYN' }
                        ];

                        const equipStmt = db.prepare(`INSERT INTO equipment (name, type, department, status, last_service_date, assigned_to, hospital_id) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                        equipTypes.forEach(e => {
                            for (let i = 1; i <= e.count; i++) {
                                equipStmt.run(`${e.prefix}-${String(i).padStart(3, '0')}`, e.type, e.dept, 'available', '2025-01-15', 'None', hospId);
                            }
                        });
                        equipStmt.finalize();

                        // Seed OTs
                        const otTypes = [
                            { name: 'OT-1', specialty: 'Cardio' },
                            { name: 'OT-2', specialty: 'Neuro' },
                            { name: 'OT-3', specialty: 'Ortho' },
                            { name: 'OT-4', specialty: 'General' }
                        ];

                        const otStmt = db.prepare(`INSERT INTO operation_theatres (name, specialty, status, hospital_id) VALUES (?, ?, ?, ?)`);
                        otTypes.forEach(o => {
                            otStmt.run(o.name, o.specialty, 'available', hospId);
                        });
                        otStmt.finalize();

                        // Seed Doctors
                        // Categories: General, Surgeon, Specialist, Emergency
                        // Shifts: Morning (8-4), Evening (4-12), Night (12-8)
                        const docTypes = [
                            { name: 'Dr. Smith', category: 'General', dept: 'General Medicine', shift: 'Morning (8am-4pm)' },
                            { name: 'Dr. Jones', category: 'General', dept: 'General Medicine', shift: 'Evening (4pm-12am)' },
                            { name: 'Dr. Emily', category: 'Surgeon', dept: 'Surgery', shift: 'Morning (8am-4pm)' },
                            { name: 'Dr. Brown', category: 'Surgeon', dept: 'Surgery', shift: 'Night (12am-8am)' },
                            { name: 'Dr. Wilson', category: 'Specialist', dept: 'Cardiology', shift: 'Morning (8am-4pm)' },
                            { name: 'Dr. Taylor', category: 'Specialist', dept: 'Neurology', shift: 'Evening (4pm-12am)' },
                            { name: 'Dr. House', category: 'Emergency', dept: 'Emergency', shift: 'Night (12am-8am)' },
                            { name: 'Dr. Grey', category: 'Emergency', dept: 'Emergency', shift: 'Morning (8am-4pm)' }
                        ];

                        const docStmt = db.prepare(`INSERT INTO doctors (name, dr_id, category, department, shift, availability, max_load, current_load) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`);
                        docTypes.forEach((d, index) => {
                            const drId = `DR-${d.category.substring(0, 3).toUpperCase()}-${String(index + 1).padStart(3, '0')}`;
                            docStmt.run(d.name, drId, d.category, d.dept, d.shift, 'Yes', 10);
                        });
                        docStmt.finalize();

                        // Seed Nurses
                        // Categories: ICU, Ward, OT
                        // Ratios: ICU 1:2, Ward 1:8, OT 1:1
                        const nurseTypes = [
                            { name: 'Nurse Joy', category: 'ICU Nurse', dept: 'Intensive Care', ratio: '1:2' },
                            { name: 'Nurse Ann', category: 'ICU Nurse', dept: 'Intensive Care', ratio: '1:2' },
                            { name: 'Nurse Sarah', category: 'Ward Nurse', dept: 'General Medicine', ratio: '1:8' },
                            { name: 'Nurse Mike', category: 'Ward Nurse', dept: 'Orthopedics', ratio: '1:8' },
                            { name: 'Nurse Lisa', category: 'OT Nurse', dept: 'Surgery', ratio: '1:1' },
                            { name: 'Nurse Tom', category: 'OT Nurse', dept: 'Surgery', ratio: '1:1' }
                        ];

                        const nurseStmt = db.prepare(`INSERT INTO nurses (name, emp_id, category, department, availability, ratio, current_load) VALUES (?, ?, ?, ?, ?, ?, 0)`);
                        nurseTypes.forEach((n, index) => {
                            const empId = `NS-${n.category.substring(0, 3).toUpperCase()}-${String(index + 1).padStart(3, '0')}`;
                            nurseStmt.run(n.name, empId, n.category, n.dept, 'Yes', n.ratio);
                        });
                        nurseStmt.finalize();

                        // Seed Admin
                        db.run(`INSERT INTO users (username, password, role, status, hospital_id, department) VALUES ('admin', 'admin123', 'admin', 'approved', ?, 'Administration')`, [hospId]);
                    }
                });
            }
        });
    });
}

module.exports = db;
