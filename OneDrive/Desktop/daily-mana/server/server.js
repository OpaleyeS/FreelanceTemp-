const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();

// ===== CONFIGURATION =====
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_DEVELOPMENT = !IS_PRODUCTION;
const PORT = process.env.PORT || 5000;

// ===== MIDDLEWARE =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (IS_DEVELOPMENT) {
    app.use((req, res, next) => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
        next();
    });
}

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    if (IS_PRODUCTION) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
});

// ===== STATIC FILES =====
const staticOptions = {
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
        if (IS_PRODUCTION) {
            res.setHeader('Cache-Control', 'public, max-age=86400');
        }
    }
};

app.use(express.static(path.join(__dirname, 'public'), staticOptions));

// ===== DATABASE =====
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/spellbook';

const mongooseOptions = {
    autoIndex: IS_DEVELOPMENT,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4,
    maxPoolSize: 10,
    minPoolSize: 2,
    connectTimeoutMS: 10000,
    retryWrites: true,
    retryReads: true
};

const connectWithRetry = async () => {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI, mongooseOptions);
        console.log(' MongoDB connected');
    } catch (err) {
        console.error('MongoDB failed:', err.message);
    }
};

// ===== ROUTES =====
const spellRoutes = require('./routes/spellRoutes');
app.use('/api', spellRoutes);

// ===== HEALTH =====
app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        uptime: Math.floor(process.uptime())
    });
});

// ===== FRONTEND =====
const indexPath = path.join(__dirname, 'public', 'index.html');
const hasIndexFile = fs.existsSync(indexPath);

app.get('/', (req, res) => {
    if (hasIndexFile) return res.sendFile(indexPath);
    res.send('API is running');
});

// CLEAN EXPRESS 5 CATCH-ALL (NO WILDCARDS)
app.use((req, res, next) => {
    if (req.url.startsWith('/api/') || req.url.startsWith('/health')) {
        return next();
    }

    if (hasIndexFile) {
        return res.sendFile(indexPath);
    }

    res.status(404).json({
        success: false,
        message: 'Not found',
        path: req.url
    });
});

// ===== API 404 =====
app.use('/api', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found',
        path: req.originalUrl
    });
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
    console.error('Error:', err.message);

    res.status(500).json({
        success: false,
        message: err.message || 'Server error'
    });
});

// ===== START =====
async function startServer() {
    await connectWithRetry();

    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
}

startServer();

module.exports = app;