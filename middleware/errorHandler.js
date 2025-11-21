// Error handling middleware
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error
    console.error('Error Stack:', err.stack);

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = { message, statusCode: 404 };
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = { message, statusCode: 400 };
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message);
        error = { message, statusCode: 400 };
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token';
        error = { message, statusCode: 401 };
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired';
        error = { message, statusCode: 401 };
    }

    // Multer errors
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            const message = 'File too large';
            error = { message, statusCode: 400 };
        } else if (err.code === 'LIMIT_FILE_COUNT') {
            const message = 'Too many files';
            error = { message, statusCode: 400 };
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            const message = 'Unexpected file field';
            error = { message, statusCode: 400 };
        }
    }

    // MySQL errors
    if (err.code === 'ER_DUP_ENTRY') {
        const message = 'Duplicate entry found';
        error = { message, statusCode: 400 };
    }

    if (err.code === 'ER_NO_REFERENCED_ROW' || err.code === 'ER_NO_REFERENCED_ROW_2') {
        const message = 'Referenced resource not found';
        error = { message, statusCode: 404 };
    }

    // Default to 500 server error
    res.status(error.statusCode || 500).json({
        success: false,
        error: {
            message: error.message || 'Server Error',
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }
    });
};

module.exports = errorHandler;