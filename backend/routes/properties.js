const express = require('express');
const router = express.Router();
const PropertyService = require('../services/propertyService');
const authMiddleware = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const propertyService = new PropertyService();

// Get all properties with filtering and pagination
router.get('/', async (req, res) => {
    try {
        const {
            propertyType,
            categoryId,
            locationId,
            minPrice,
            maxPrice,
            bedrooms,
            bathrooms,
            search,
            status,
            featured,
            page,
            limit,
            sortBy,
            sortOrder
        } = req.query;

        const filters = {
            propertyType,
            categoryId: categoryId ? parseInt(categoryId) : undefined,
            locationId: locationId ? parseInt(locationId) : undefined,
            minPrice: minPrice ? parseInt(minPrice) : undefined,
            maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
            bedrooms: bedrooms ? parseInt(bedrooms) : undefined,
            bathrooms: bathrooms ? parseInt(bathrooms) : undefined,
            search,
            status,
            featured: featured === 'true'
        };

        const pagination = {
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20,
            sortBy: sortBy || 'created_at',
            sortOrder: sortOrder || 'desc'
        };

        const result = await propertyService.getProperties(filters, pagination);

        res.json({
            success: true,
            data: result.properties,
            pagination: result.pagination
        });

    } catch (error) {
        console.error('Get properties error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch properties'
        });
    }
});

// Get single property
router.get('/:id', async (req, res) => {
    try {
        const propertyId = parseInt(req.params.id);
        const userId = req.user ? req.user.id : null;

        if (isNaN(propertyId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid property ID'
            });
        }

        const property = await propertyService.getProperty(propertyId, userId);

        res.json({
            success: true,
            data: property
        });

    } catch (error) {
        console.error('Get property error:', error);
        res.status(error.message === 'Property not found' ? 404 : 500).json({
            success: false,
            error: error.message || 'Failed to fetch property'
        });
    }
});

// Create new property
router.post('/', authMiddleware, [
    body('title').trim().isLength({ min: 5 }).withMessage('Title must be at least 5 characters'),
    body('propertyType').isIn(['residential', 'commercial', 'land', 'mixed_use']).withMessage('Invalid property type'),
    body('categoryId').isInt({ min: 1 }).withMessage('Invalid category ID'),
    body('locationId').isInt({ min: 1 }).withMessage('Invalid location ID'),
    body('address').trim().isLength({ min: 10 }).withMessage('Address must be at least 10 characters'),
    body('startingPrice').isInt({ min: 100000 }).withMessage('Starting price must be at least 100,000 TZS'),
    body('bedrooms').optional().isInt({ min: 0 }).withMessage('Bedrooms must be a positive number'),
    body('bathrooms').optional().isInt({ min: 0 }).withMessage('Bathrooms must be a positive number'),
    body('totalAreaSqm').optional().isFloat({ min: 0 }).withMessage('Total area must be a positive number'),
    body('builtAreaSqm').optional().isFloat({ min: 0 }).withMessage('Built area must be a positive number')
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const propertyData = {
            ...req.body,
            ownerId: req.user.id
        };

        const result = await propertyService.createProperty(propertyData, req.files);

        res.status(201).json({
            success: true,
            message: 'Property created successfully',
            data: result
        });

    } catch (error) {
        console.error('Create property error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create property'
        });
    }
});

// Update property
router.put('/:id', authMiddleware, [
    body('title').optional().trim().isLength({ min: 5 }).withMessage('Title must be at least 5 characters'),
    body('propertyType').optional().isIn(['residential', 'commercial', 'land', 'mixed_use']).withMessage('Invalid property type'),
    body('categoryId').optional().isInt({ min: 1 }).withMessage('Invalid category ID'),
    body('locationId').optional().isInt({ min: 1 }).withMessage('Invalid location ID'),
    body('address').optional().trim().isLength({ min: 10 }).withMessage('Address must be at least 10 characters'),
    body('startingPrice').optional().isInt({ min: 100000 }).withMessage('Starting price must be at least 100,000 TZS'),
    body('bedrooms').optional().isInt({ min: 0 }).withMessage('Bedrooms must be a positive number'),
    body('bathrooms').optional().isInt({ min: 0 }).withMessage('Bathrooms must be a positive number'),
    body('totalAreaSqm').optional().isFloat({ min: 0 }).withMessage('Total area must be a positive number'),
    body('builtAreaSqm').optional().isFloat({ min: 0 }).withMessage('Built area must be a positive number')
], async (req, res) => {
    try {
        // Check validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const propertyId = parseInt(req.params.id);
        const userId = req.user.id;

        if (isNaN(propertyId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid property ID'
            });
        }

        const result = await propertyService.updateProperty(propertyId, req.body, req.files, userId);

        res.json({
            success: true,
            message: result.message
        });

    } catch (error) {
        console.error('Update property error:', error);
        res.status(error.message.includes('not found') ? 404 : 500).json({
            success: false,
            error: error.message || 'Failed to update property'
        });
    }
});

// Toggle favorite property
router.post('/:id/favorite', authMiddleware, async (req, res) => {
    try {
        const propertyId = parseInt(req.params.id);
        const userId = req.user.id;

        if (isNaN(propertyId)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid property ID'
            });
        }

        const result = await propertyService.toggleFavorite(propertyId, userId);

        res.json({
            success: true,
            message: result.message,
            favorited: result.favorited
        });

    } catch (error) {
        console.error('Toggle favorite error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to toggle favorite'
        });
    }
});

// Get user's favorite properties
router.get('/favorites/mine', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.id;
        const { page, limit } = req.query;

        const pagination = {
            page: page ? parseInt(page) : 1,
            limit: limit ? parseInt(limit) : 20
        };

        const result = await propertyService.getUserFavorites(userId, pagination);

        res.json({
            success: true,
            data: result.favorites,
            pagination: result.pagination
        });

    } catch (error) {
        console.error('Get favorites error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch favorites'
        });
    }
});

// Get property categories
router.get('/categories/all', async (req, res) => {
    try {
        const [categories] = await db.execute(
            'SELECT id, name, description, icon FROM categories ORDER BY name'
        );

        res.json({
            success: true,
            data: categories
        });

    } catch (error) {
        console.error('Get categories error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch categories'
        });
    }
});

// Get property locations
router.get('/locations/all', async (req, res) => {
    try {
        const [locations] = await db.execute(
            'SELECT id, name, region, country FROM locations ORDER BY name'
        );

        res.json({
            success: true,
            data: locations
        });

    } catch (error) {
        console.error('Get locations error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch locations'
        });
    }
});

// Get featured properties
router.get('/featured/all', async (req, res) => {
    try {
        const { limit = 6 } = req.query;

        const [properties] = await db.execute(
            `SELECT 
                p.id, p.title, p.slug, p.description, p.address,
                p.bedrooms, p.bathrooms, p.starting_price, p.current_price,
                p.images, p.created_at, l.name as location_name
             FROM properties p
             LEFT JOIN locations l ON p.location_id = l.id
             WHERE p.is_featured = TRUE AND p.status = 'approved'
             ORDER BY p.created_at DESC
             LIMIT ?`,
            [parseInt(limit)]
        );

        const featuredProperties = properties.map(property => ({
            ...property,
            images: JSON.parse(property.images || '[]')
        }));

        res.json({
            success: true,
            data: featuredProperties
        });

    } catch (error) {
        console.error('Get featured properties error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch featured properties'
        });
    }
});

module.exports = router;