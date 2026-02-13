const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
const db = require('./database');

const app = express();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Multer Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname)
    }
})
const upload = multer({ storage: storage });

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

// Socket.io connection
const userSockets = new Map(); // userId -> socketId

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('register_user', (userId) => {
        userSockets.set(userId, socket.id);
        console.log(`User ${userId} associated with socket ${socket.id}`);

        // Join rooms based on role and department
        db.get('SELECT role, department FROM users WHERE id = ?', [userId], (err, user) => {
            if (user) {
                if (user.role === 'admin') {
                    socket.join('admin_room');
                    console.log(`Socket ${socket.id} joined admin_room`);
                }
                if (user.role === 'dept_head') {
                    socket.join(`dept_head_${user.department}`);
                    console.log(`Socket ${socket.id} joined dept_head_${user.department}`);
                }
                // Also join a personal room for targeted notifications
                socket.join(`user_${userId}`);
            }
        });
    });

    socket.on('private_message', ({ to, content, from }) => {
        // Save to DB
        db.run(`INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)`,
            [from, to, content], function (err) {
                if (err) return console.error(err.message);

                const message = {
                    id: this.lastID,
                    sender_id: from,
                    receiver_id: to,
                    content: content,
                    timestamp: new Date().toISOString()
                };

                // Emit to sender
                socket.emit('new_message', message);

                // Emit to receiver if online
                const receiverSocketId = userSockets.get(to);
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('new_message', message);
                }
            });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
        // Remove from userSockets map
        for (const [userId, socketId] of userSockets.entries()) {
            if (socketId === socket.id) {
                userSockets.delete(userId);
                break;
            }
        }
    });
});

// Routes
// GET all resources
app.get('/api/resources', (req, res) => {
    db.all("SELECT * FROM resources", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST update resource
app.post('/api/updateResourceStatus', (req, res) => {
    const { id, available_count, userId } = req.body;
    if (!id || available_count === undefined) {
        return res.status(400).json({ error: "Missing id or available_count" });
    }

    // Blocked check
    if (userId) {
        db.get('SELECT status FROM users WHERE id = ?', [userId], (err, user) => {
            if (user && user.status === 'blocked') {
                return res.status(403).json({ error: "Your account is blocked" });
            }
            proceedWithUpdate();
        });
    } else {
        proceedWithUpdate();
    }

    function proceedWithUpdate() {
        db.get('SELECT total_count FROM resources WHERE id = ?', [id], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: "Resource not found" });

            if (available_count > row.total_count) {
                return res.status(400).json({ error: "Available count exceeds total count" });
            }

            db.run(`UPDATE resources SET available_count = ? WHERE id = ?`, [available_count, id], function (err) {
                if (err) return res.status(500).json({ error: err.message });

                // Fetch full updated resource for socket emission
                db.get('SELECT * FROM resources WHERE id = ?', [id], (err, updatedResource) => {
                    if (!err && updatedResource) {
                        io.emit('resource_update', updatedResource);
                    }
                });

                res.json({ message: "Resource updated successfully" });
            });
        });
    }
});

const PORT = 3000;

// --- User Management Routes ---

// Register
app.post('/api/register', upload.single('certificate'), (req, res) => {
    const { username, password, department, phone, role } = req.body; // role: 'dept_head' or 'staff'
    console.log(`Registration attempt: ${username}, Phone: ${phone}, Role: ${role}`);
    const certificatePath = req.file ? req.file.path : null;

    const validRoles = ['dept_head', 'staff', 'nurse', 'head_nurse'];
    const finalRole = validRoles.includes(role) ? role : 'staff';

    db.run(`INSERT INTO users (username, password, department, phone, certificate_path, status, role) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [username, password, department, phone, certificatePath, finalRole], function (err) {
            if (err) return res.status(400).json({ error: "Username likely exists" });
            res.json({ message: "Registration successful. Pending approval." });
        });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ? AND password = ?`, [username, password], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: "Invalid credentials" });

        if (user.status === 'blocked') {
            return res.status(403).json({ error: "Your account has been blocked by an administrator." });
        }

        if (user.status !== 'approved') {
            return res.status(403).json({ error: `Account is ${user.status}` });
        }

        res.json({
            message: "Login successful",
            user: { id: user.id, username: user.username, role: user.role, department: user.department }
        });
    });
});

// Admin: List Users
app.get('/api/admin/users', (req, res) => {
    db.all(`SELECT id, username, department, phone, status, role, certificate_path FROM users ORDER BY id DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        console.log(`Sending ${rows.length} users to admin. Sample phone: ${rows[0] ? rows[0].phone : 'none'}`);
        res.json(rows);
    });
});

// --- Human Resources Routes ---

app.get('/api/hr/doctors', (req, res) => {
    db.all("SELECT * FROM doctors", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.get('/api/hr/nurses', (req, res) => {
    db.all("SELECT * FROM nurses", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Update Nurse Status (Availability/Ratio)
app.post('/api/hr/nurse/update', (req, res) => {
    const { id, availability, ratio } = req.body;

    db.run(`UPDATE nurses SET availability = ?, ratio = ? WHERE id = ?`,
        [availability, ratio, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Emit update for real-time
            db.get('SELECT * FROM nurses WHERE id = ?', [id], (err, row) => {
                if (!err && row) {
                    io.emit('hr_update', { type: 'nurse', data: row });
                }
            });

            res.json({ message: "Nurse updated successfully" });
        }
    );
});

// Allocate Patient to Nurse
app.post('/api/hr/nurse/allocate', (req, res) => {
    const { id } = req.body;
    db.get('SELECT * FROM nurses WHERE id = ?', [id], (err, nurse) => {
        if (err || !nurse) return res.status(404).json({ error: "Nurse not found" });

        // Parse Ratio to get Capacity (e.g., "1:8" -> 8)
        const capacity = parseInt(nurse.ratio.split(':')[1]) || 1;

        if (nurse.current_load >= capacity) {
            return res.status(400).json({ error: "Nurse is fully occupied" });
        }

        db.run('UPDATE nurses SET current_load = current_load + 1 WHERE id = ?', [id], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Emit update
            nurse.current_load += 1;
            io.emit('hr_update', { type: 'nurse', data: nurse });
            res.json({ message: "Patient allocated", nurse });
        });
    });
});

// Release Patient from Nurse
app.post('/api/hr/nurse/release', (req, res) => {
    const { id } = req.body;
    db.get('SELECT * FROM nurses WHERE id = ?', [id], (err, nurse) => {
        if (err || !nurse) return res.status(404).json({ error: "Nurse not found" });

        if (nurse.current_load <= 0) {
            return res.status(400).json({ error: "No patients to release" });
        }

        db.run('UPDATE nurses SET current_load = current_load - 1 WHERE id = ?', [id], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Emit update
            nurse.current_load -= 1;
            io.emit('hr_update', { type: 'nurse', data: nurse });
            res.json({ message: "Patient released", nurse });
        });
    });
});



// Update Doctor Status (Availability/Max Load)
app.post('/api/hr/doctor/update', (req, res) => {
    const { id, availability, max_load } = req.body;

    db.run(`UPDATE doctors SET availability = ?, max_load = ? WHERE id = ?`,
        [availability, max_load, id],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Emit update for real-time
            db.get('SELECT * FROM doctors WHERE id = ?', [id], (err, row) => {
                if (!err && row) {
                    io.emit('hr_update', { type: 'doctor', data: row });
                }
            });

            res.json({ message: "Doctor updated successfully" });
        }
    );
});

// Allocate Patient to Doctor
app.post('/api/hr/doctor/allocate', (req, res) => {
    const { id } = req.body;
    db.get('SELECT * FROM doctors WHERE id = ?', [id], (err, doc) => {
        if (err || !doc) return res.status(404).json({ error: "Doctor not found" });

        if (doc.current_load >= doc.max_load) {
            return res.status(400).json({ error: "Doctor is fully occupied" });
        }

        db.run('UPDATE doctors SET current_load = current_load + 1 WHERE id = ?', [id], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Emit update
            doc.current_load += 1;
            io.emit('hr_update', { type: 'doctor', data: doc });
            res.json({ message: "Patient allocated", doc });
        });
    });
});

// Release Patient from Doctor
app.post('/api/hr/doctor/release', (req, res) => {
    const { id } = req.body;
    db.get('SELECT * FROM doctors WHERE id = ?', [id], (err, doc) => {
        if (err || !doc) return res.status(404).json({ error: "Doctor not found" });

        if (doc.current_load <= 0) {
            return res.status(400).json({ error: "No patients to release" });
        }

        db.run('UPDATE doctors SET current_load = current_load - 1 WHERE id = ?', [id], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Emit update
            doc.current_load -= 1;
            io.emit('hr_update', { type: 'doctor', data: doc });
            res.json({ message: "Patient released", doc });
        });
    });
});

// Admins/Dept Heads: Verify User
app.post('/api/admin/verify', (req, res) => {
    const { userId, status, verifierId } = req.body;
    console.log(`Verify attempt: Verifier=${verifierId}, TargetUser=${userId}, Status=${status}`);

    // Auth Check
    db.get('SELECT id, role, department FROM users WHERE id = ?', [verifierId], (err, verifier) => {
        if (err) {
            console.error("DB Error fetching verifier:", err);
            return res.status(500).json({ error: "Database error" });
        }
        if (!verifier) {
            console.warn(`Verifier not found for ID: ${verifierId}`);
            return res.status(401).json({ error: "Unauthorized: Admin session not found" });
        }

        console.log(`Verifier role: ${verifier.role}`);
        if (verifier.role !== 'admin') {
            return res.status(403).json({ error: `Permission denied. Your role is ${verifier.role}. Only Admins can verify users.` });
        }

        db.get('SELECT department FROM users WHERE id = ?', [userId], (err, userToVerify) => {
            if (err || !userToVerify) return res.status(404).json({ error: "User not found" });

            if (!['approved', 'rejected', 'blocked'].includes(status)) {
                return res.status(400).json({ error: "Invalid status" });
            }

            db.run(`UPDATE users SET status = ? WHERE id = ?`, [status, userId], function (err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: `User ${status}` });
            });
        });
    });
});

// Admin: Remove User
app.post('/api/admin/remove', (req, res) => {
    const { userId, verifierId } = req.body;
    console.log(`Remove attempt: Verifier=${verifierId}, TargetUser=${userId}`);

    db.get('SELECT id, role FROM users WHERE id = ?', [verifierId], (err, verifier) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (!verifier || verifier.role !== 'admin') {
            console.warn(`Removal denied. Verifier role: ${verifier ? verifier.role : 'None'}`);
            return res.status(403).json({ error: "Permission denied. Only Admins can remove users." });
        }

        db.run(`DELETE FROM users WHERE id = ?`, [userId], function (err) {
            if (err) {
                console.error("Delete error:", err);
                return res.status(500).json({ error: err.message });
            }
            console.log(`User ${userId} removed successfully`);
            res.json({ message: "User removed successfully" });
        });
    });
});

// --- Alert System Routes ---

// 1. Create Alert (Staff)
app.post('/api/alerts/create', (req, res) => {
    const { resourceId, resourceName, alertType, severity, message, thresholdValue, userId, userName, userDept } = req.body;

    db.run(`INSERT INTO alerts (
        resource_id, resource_name, alert_type, severity, message, threshold_value,
        raised_by, raised_by_name, raised_by_dept
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [resourceId, resourceName, alertType, severity, message, thresholdValue, userId, userName, userDept],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            const alertId = this.lastID;

            // Fetch full alert to emit
            db.get('SELECT * FROM alerts WHERE id = ?', [alertId], (err, alert) => {
                if (!err && alert) {
                    // Notify Dept Heads of that department
                    io.to(`dept_head_${userDept}`).emit('new_alert', alert);
                }
            });

            res.json({ message: "Alert raised successfully", alertId });
        });
});

// 2. Get Alerts for Department Head
app.get('/api/alerts/department/:department', (req, res) => {
    const department = req.params.department;
    db.all(`SELECT * FROM alerts WHERE raised_by_dept = ? ORDER BY raised_at DESC`, [department], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 3. Verify Alert (Department Head)
app.post('/api/alerts/verify', (req, res) => {
    const { alertId, deptHeadId, verificationNotes, action } = req.body; // action: 'escalate' | 'dismiss'
    const status = action === 'escalate' ? 'escalated' : 'dismissed';
    const now = new Date().toISOString();

    db.run(`UPDATE alerts SET 
        status = ?, 
        dept_head_id = ?, 
        verification_notes = ?, 
        verified_at = ? 
        WHERE id = ?`,
        [status, deptHeadId, verificationNotes, now, alertId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            if (action === 'escalate') {
                db.get('SELECT * FROM alerts WHERE id = ?', [alertId], (err, alert) => {
                    if (!err && alert) {
                        // Notify Admins
                        io.to('admin_room').emit('alert_verified', alert);
                    }
                });
            }

            res.json({ message: `Alert ${status}` });
        });
});

// 4. Get Escalated Alerts (Admin)
app.get('/api/alerts/escalated', (req, res) => {
    db.all(`SELECT * FROM alerts WHERE status = 'escalated' ORDER BY verified_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 5. Resolve Alert (Admin)
app.post('/api/alerts/resolve', (req, res) => {
    const { alertId, adminId, action, notes } = req.body; // action: 'approved' | 'rejected'
    const status = 'resolved'; // Final status is resolved, but we track the decision in admin_action
    const now = new Date().toISOString();

    db.run(`UPDATE alerts SET 
        status = ?, 
        admin_id = ?, 
        admin_action = ?, 
        admin_notes = ?, 
        resolved_at = ? 
        WHERE id = ?`,
        [status, adminId, action, notes, now, alertId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });

            db.get('SELECT * FROM alerts WHERE id = ?', [alertId], (err, alert) => {
                if (!err && alert) {
                    // Notify Dept Head ONLY (as per user request)
                    if (alert.dept_head_id) {
                        io.to(`user_${alert.dept_head_id}`).emit('alert_resolved', alert);
                    }
                }
            });

            res.json({ message: "Alert resolved" });
        });
});

// 6. Get Alert History (Generic search/filter)
app.get('/api/alerts/history', (req, res) => {
    // Simple all alerts fetch for now, can be filtered by frontend
    db.all(`SELECT * FROM alerts ORDER BY raised_at DESC`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// --- Chat Routes ---

// Get all approved users for chat list (excluding self potentially, managed by frontend)
app.get('/api/users/approved', (req, res) => {
    db.all(`SELECT id, username, department FROM users WHERE status = 'approved'`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Get chat history
app.get('/api/messages/:contactId', (req, res) => {
    const userId = req.headers['x-user-id']; // Simple auth for now
    const contactId = req.params.contactId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    db.all(`SELECT * FROM messages 
            WHERE (sender_id = ? AND receiver_id = ?) 
               OR (sender_id = ? AND receiver_id = ?)
            ORDER BY timestamp ASC`,
        [userId, contactId, contactId, userId],
        (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(rows);
        });
});

// --- Detailed Resource Routes ---

// 1. Beds
app.get('/api/beds', (req, res) => {
    db.all("SELECT * FROM beds", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/beds/update', (req, res) => {
    const { id, status } = req.body;
    db.run("UPDATE beds SET status = ? WHERE id = ?", [status, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Fetch updated row to broadcast
        db.get("SELECT * FROM beds WHERE id = ?", [id], (err, row) => {
            if (row) io.emit('bed_updated', row);
        });

        res.json({ message: "Bed status updated" });
    });
});

// 2. Equipment
app.get('/api/equipment', (req, res) => {
    db.all("SELECT * FROM equipment", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/equipment/update', (req, res) => {
    const { id, status, assignment } = req.body; // assignment could be patient ID etc.
    // Simple status update for now, can extend
    db.run("UPDATE equipment SET status = ?, assigned_to = ? WHERE id = ?", [status, assignment || 'None', id], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        // Fetch updated row to broadcast
        db.get("SELECT * FROM equipment WHERE id = ?", [id], (err, row) => {
            if (row) io.emit('equipment_updated', row);
        });

        res.json({ message: "Equipment status updated" });
    });
});

// 3. Operation Theatres
app.get('/api/ots', (req, res) => {
    db.all("SELECT * FROM operation_theatres", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/ots/update', (req, res) => {
    const { id, status, next_surgery } = req.body;
    db.run("UPDATE operation_theatres SET status = ?, next_scheduled_surgery = ? WHERE id = ?", [status, next_surgery, id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "OT status updated" });
    });
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
