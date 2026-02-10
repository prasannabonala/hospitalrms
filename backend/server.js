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
        // Notify others that this user is online (optional, not implementing full presence yet)
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

    const finalRole = ['dept_head', 'staff'].includes(role) ? role : 'staff';

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

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
