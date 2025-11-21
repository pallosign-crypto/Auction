const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
require('dotenv').config();

// Import database connection
const db = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const propertyRoutes = require('./routes/properties');
const auctionRoutes = require('./routes/auctions');
const adminRoutes = require('./routes/admin');
const bidRoutes = require('./routes/bids');

// Import middleware
const authMiddleware = require('./middleware/auth');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');

// Import services
const AuctionService = require('./services/auctionService');
const NotificationService = require('./services/notificationService');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Set port
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
        error: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'http://localhost:3000',
            'http://localhost:3001',
            'https://kjoctizvea2v4.ok.kimi.link'
        ];
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined'));
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
        version: require('./package.json').version
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/admin', authMiddleware, adminRoutes);

// Socket.IO for real-time auction updates
const auctionService = new AuctionService(io);
const notificationService = new NotificationService(io);

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    
    // Join auction room
    socket.on('join_auction', (auctionId) => {
        socket.join(`auction_${auctionId}`);
        console.log(`User ${socket.id} joined auction ${auctionId}`);
    });
    
    // Leave auction room
    socket.on('leave_auction', (auctionId) => {
        socket.leave(`auction_${auctionId}`);
        console.log(`User ${socket.id} left auction ${auctionId}`);
    });
    
    // Place bid
    socket.on('place_bid', async (data) => {
        try {
            const result = await auctionService.placeBid(data);
            io.to(`auction_${data.auctionId}`).emit('bid_update', result);
        } catch (error) {
            socket.emit('bid_error', { error: error.message });
        }
    });
    
    // Auto-bid setup
    socket.on('setup_auto_bid', async (data) => {
        try {
            const result = await auctionService.setupAutoBid(data);
            socket.emit('auto_bid_confirmed', result);
        } catch (error) {
            socket.emit('auto_bid_error', { error: error.message });
        }
    });
    
    // Disconnect
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔄 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    console.log(`🔌 Socket.IO listening on port ${PORT}`);
    
    // Initialize auction monitoring
    auctionService.startAuctionMonitoring();
    
    // Initialize notification service
    notificationService.start();
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

module.exports = app;