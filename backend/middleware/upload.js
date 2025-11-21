const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage for property images and documents
const propertyStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const propertyDir = path.join(uploadsDir, 'properties');
        if (!fs.existsSync(propertyDir)) {
            fs.mkdirSync(propertyDir, { recursive: true });
        }
        cb(null, propertyDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Configure storage for user avatars
const avatarStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const avatarDir = path.join(uploadsDir, 'avatars');
        if (!fs.existsSync(avatarDir)) {
            fs.mkdirSync(avatarDir, { recursive: true });
        }
        cb(null, avatarDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter for property images
const imageFilter = function (req, file, cb) {
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedImageTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, JPG, PNG, and WebP images are allowed'), false);
    }
};

// File filter for property documents
const documentFilter = function (req, file, cb) {
    const allowedDocumentTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    if (allowedDocumentTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only PDF, Word, and Excel documents are allowed'), false);
    }
};

// File filter for avatars
const avatarFilter = function (req, file, cb) {
    const allowedAvatarTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedAvatarTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, JPG, PNG, and WebP images are allowed for avatars'), false);
    }
};

// Create multer instances
const propertyImageUpload = multer({
    storage: propertyStorage,
    fileFilter: imageFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

const propertyDocumentUpload = multer({
    storage: propertyStorage,
    fileFilter: documentFilter,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    }
});

const avatarUpload = multer({
    storage: avatarStorage,
    fileFilter: avatarFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Middleware to handle multiple file uploads
const handlePropertyFiles = (req, res, next) => {
    // Handle images
    propertyImageUpload.array('images', 10)(req, res, function (err) {
        if (err) {
            return res.status(400).json({
                success: false,
                error: err.message
            });
        }

        // Handle documents
        propertyDocumentUpload.array('documents', 5)(req, res, function (err) {
            if (err) {
                return res.status(400).json({
                    success: false,
                    error: err.message
                });
            }
            next();
        });
    });
};

// Error handling middleware for file uploads
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(400).json({
                    success: false,
                    error: 'File size too large'
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    success: false,
                    error: 'Too many files'
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    success: false,
                    error: 'Unexpected file field'
                });
            default:
                return res.status(400).json({
                    success: false,
                    error: 'File upload error'
                });
        }
    }
    next(err);
};

module.exports = {
    propertyImageUpload,
    propertyDocumentUpload,
    avatarUpload,
    handlePropertyFiles,
    handleUploadError
};