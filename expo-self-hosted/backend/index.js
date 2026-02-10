const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Sample API Endpoints
app.get('/api/status', (req, res) => {
    res.json({
        status: "Online",
        message: "Backend is running on Windows Self-Hosted Server",
        timestamp: new Date().toISOString()
    });
});

app.get('/api/data', (req, res) => {
    res.json({
        items: [
            { id: 1, name: "System Check", value: "Optimal" },
            { id: 2, name: "Memory Usage", value: "Normal" },
            { id: 3, name: "Connectivity", value: "Secure via Tunnel" }
        ]
    });
});

app.listen(PORT, () => {
    console.log(`-----------------------------------------`);
    console.log(`Backend Server running on port ${PORT}`);
    console.log(`Local Access: http://localhost:${PORT}`);
    console.log(`-----------------------------------------`);
});
