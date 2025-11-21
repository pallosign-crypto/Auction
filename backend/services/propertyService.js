const db = require('../config/database');
const { formatCurrency } = require('../utils/currency');
const fs = require('fs').promises;
const path = require('path');

class PropertyService {
    constructor() {
        this.allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        this.allowedDocumentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        this.maxImageSize = 10 * 1024 * 1024; // 10MB
        this.maxDocumentSize = 50 * 1024 * 1024; // 50MB
    }

    async createProperty(propertyData, files = {}) {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            // Validate required fields
            const requiredFields = ['title', 'propertyType', 'categoryId', 'locationId', 'address', 'startingPrice', 'ownerId'];
            for (const field of requiredFields) {
                if (!propertyData[field]) {
                    throw new Error(`Missing required field: ${field}`);
                }
            }

            // Generate unique slug
            const slug = await this.generateUniqueSlug(propertyData.title);

            // Process uploaded files
            const processedFiles = await this.processPropertyFiles(files, slug);

            // Insert property
            const insertQuery = `
                INSERT INTO properties (
                    title, slug, description, property_type, category_id, location_id,
                    address, latitude, longitude, bedrooms, bathrooms, parking_spaces,
                    total_area_sqm, built_area_sqm, year_built, floor_number, total_floors,
                    starting_price, reserve_price, current_price, price_currency,
                    owner_id, agent_id, features, amenities, images, documents,
                    video_url, virtual_tour_url, status, is_featured,
                    meta_title, meta_description, meta_keywords
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const [result] = await connection.execute(insertQuery, [
                propertyData.title,
                slug,
                propertyData.description || '',
                propertyData.propertyType,
                propertyData.categoryId,
                propertyData.locationId,
                propertyData.address,
                propertyData.latitude || null,
                propertyData.longitude || null,
                propertyData.bedrooms || 0,
                propertyData.bathrooms || 0,
                propertyData.parkingSpaces || 0,
                propertyData.totalAreaSqm || 0,
                propertyData.builtAreaSqm || 0,
                propertyData.yearBuilt || null,
                propertyData.floorNumber || 0,
                propertyData.totalFloors || 0,
                propertyData.startingPrice,
                propertyData.reservePrice || 0,
                propertyData.startingPrice,
                propertyData.priceCurrency || 'TZS',
                propertyData.ownerId,
                propertyData.agentId || null,
                JSON.stringify(propertyData.features || []),
                JSON.stringify(propertyData.amenities || []),
                JSON.stringify(processedFiles.images || []),
                JSON.stringify(processedFiles.documents || []),
                propertyData.videoUrl || '',
                propertyData.virtualTourUrl || '',
                'draft',
                false,
                propertyData.metaTitle || propertyData.title,
                propertyData.metaDescription || propertyData.description || '',
                propertyData.metaKeywords || ''
            ]);

            const propertyId = result.insertId;

            // Create initial property history entry
            await connection.execute(
                'INSERT INTO property_history (property_id, action, changed_by, changed_at, changes) VALUES (?, ?, ?, NOW(), ?)',
                [propertyId, 'created', propertyData.ownerId, JSON.stringify({ status: 'draft' })]
            );

            await connection.commit();
            connection.release();

            return {
                success: true,
                propertyId,
                slug
            };

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    }

    async updateProperty(propertyId, propertyData, files = {}, userId) {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            // Verify property exists and user has permission
            const [existingProperty] = await connection.execute(
                'SELECT id, owner_id, agent_id, slug, status FROM properties WHERE id = ?',
                [propertyId]
            );

            if (existingProperty.length === 0) {
                throw new Error('Property not found');
            }

            const property = existingProperty[0];
            
            // Check permissions
            if (property.owner_id !== userId && property.agent_id !== userId) {
                throw new Error('Unauthorized to update this property');
            }

            // Process new files if provided
            let processedFiles = {};
            if (files && Object.keys(files).length > 0) {
                processedFiles = await this.processPropertyFiles(files, property.slug);
            }

            // Build update query dynamically
            const updateFields = [];
            const updateValues = [];

            const allowedFields = [
                'title', 'description', 'property_type', 'category_id', 'location_id',
                'address', 'latitude', 'longitude', 'bedrooms', 'bathrooms', 'parking_spaces',
                'total_area_sqm', 'built_area_sqm', 'year_built', 'floor_number', 'total_floors',
                'starting_price', 'reserve_price', 'price_currency', 'features', 'amenities',
                'video_url', 'virtual_tour_url', 'meta_title', 'meta_description', 'meta_keywords'
            ];

            // Map propertyData fields to database fields
            const fieldMapping = {
                'propertyType': 'property_type',
                'categoryId': 'category_id',
                'locationId': 'location_id',
                'parkingSpaces': 'parking_spaces',
                'totalAreaSqm': 'total_area_sqm',
                'builtAreaSqm': 'built_area_sqm',
                'yearBuilt': 'year_built',
                'floorNumber': 'floor_number',
                'totalFloors': 'total_floors',
                'startingPrice': 'starting_price',
                'reservePrice': 'reserve_price',
                'priceCurrency': 'price_currency',
                'agentId': 'agent_id',
                'videoUrl': 'video_url',
                'virtualTourUrl': 'virtual_tour_url'
            };

            // Add fields from propertyData
            Object.keys(propertyData).forEach(key => {
                const dbField = fieldMapping[key] || key;
                if (allowedFields.includes(dbField) && propertyData[key] !== undefined) {
                    updateFields.push(`${dbField} = ?`);
                    updateValues.push(propertyData[key]);
                }
            });

            // Add JSON fields
            if (propertyData.features) {
                updateFields.push('features = ?');
                updateValues.push(JSON.stringify(propertyData.features));
            }

            if (propertyData.amenities) {
                updateFields.push('amenities = ?');
                updateValues.push(JSON.stringify(propertyData.amenities));
            }

            // Add files if provided
            if (processedFiles.images) {
                updateFields.push('images = ?');
                updateValues.push(JSON.stringify(processedFiles.images));
            }

            if (processedFiles.documents) {
                updateFields.push('documents = ?');
                updateValues.push(JSON.stringify(processedFiles.documents));
            }

            if (updateFields.length === 0) {
                throw new Error('No valid fields to update');
            }

            // Add updated_at
            updateFields.push('updated_at = NOW()');
            updateValues.push(propertyId); // For WHERE clause

            const updateQuery = `UPDATE properties SET ${updateFields.join(', ')} WHERE id = ?`;

            await connection.execute(updateQuery, updateValues);

            // Create property history entry
            const changes = Object.keys(propertyData).reduce((acc, key) => {
                acc[key] = propertyData[key];
                return acc;
            }, {});

            await connection.execute(
                'INSERT INTO property_history (property_id, action, changed_by, changed_at, changes) VALUES (?, ?, ?, NOW(), ?)',
                [propertyId, 'updated', userId, JSON.stringify(changes)]
            );

            await connection.commit();
            connection.release();

            return {
                success: true,
                message: 'Property updated successfully'
            };

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }
    }

    async getProperty(propertyId, userId = null) {
        try {
            const [rows] = await db.execute(
                `SELECT 
                    p.*,
                    l.name as location_name,
                    c.name as category_name,
                    owner.first_name as owner_first_name,
                    owner.last_name as owner_last_name,
                    agent.first_name as agent_first_name,
                    agent.last_name as agent_last_name,
                    COUNT(DISTINCT b.id) as bid_count,
                    MAX(b.amount) as highest_bid
                 FROM properties p
                 LEFT JOIN locations l ON p.location_id = l.id
                 LEFT JOIN categories c ON p.category_id = c.id
                 LEFT JOIN users owner ON p.owner_id = owner.id
                 LEFT JOIN users agent ON p.agent_id = agent.id
                 LEFT JOIN auctions a ON p.id = a.property_id AND a.status IN ('live', 'ended')
                 LEFT JOIN bids b ON a.id = b.auction_id
                 WHERE p.id = ?
                 GROUP BY p.id`,
                [propertyId]
            );

            if (rows.length === 0) {
                throw new Error('Property not found');
            }

            const property = rows[0];

            // Parse JSON fields
            property.features = JSON.parse(property.features || '[]');
            property.amenities = JSON.parse(property.amenities || '[]');
            property.images = JSON.parse(property.images || '[]');
            property.documents = JSON.parse(property.documents || '[]');

            // Check if user has favorited this property
            if (userId) {
                const [favoriteRows] = await db.execute(
                    'SELECT id FROM favorites WHERE user_id = ? AND property_id = ?',
                    [userId, propertyId]
                );
                property.is_favorited = favoriteRows.length > 0;
            }

            // Increment view count
            await db.execute(
                'UPDATE properties SET view_count = view_count + 1 WHERE id = ?',
                [propertyId]
            );

            return property;

        } catch (error) {
            throw error;
        }
    }

    async getProperties(filters = {}, pagination = {}) {
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
                status = 'approved',
                featured = false,
                userId
            } = filters;

            const {
                page = 1,
                limit = 20,
                sortBy = 'created_at',
                sortOrder = 'desc'
            } = pagination;

            let query = `
                SELECT 
                    p.id, p.title, p.slug, p.description, p.property_type, p.address,
                    p.bedrooms, p.bathrooms, p.parking_spaces, p.total_area_sqm,
                    p.starting_price, p.current_price, p.price_currency,
                    p.images, p.is_featured, p.view_count, p.created_at,
                    l.name as location_name, c.name as category_name,
                    owner.first_name as owner_first_name, owner.last_name as owner_last_name
                FROM properties p
                LEFT JOIN locations l ON p.location_id = l.id
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN users owner ON p.owner_id = owner.id
                WHERE 1=1
            `;

            const params = [];

            // Apply filters
            if (propertyType) {
                query += ' AND p.property_type = ?';
                params.push(propertyType);
            }

            if (categoryId) {
                query += ' AND p.category_id = ?';
                params.push(categoryId);
            }

            if (locationId) {
                query += ' AND p.location_id = ?';
                params.push(locationId);
            }

            if (minPrice) {
                query += ' AND p.starting_price >= ?';
                params.push(minPrice);
            }

            if (maxPrice) {
                query += ' AND p.starting_price <= ?';
                params.push(maxPrice);
            }

            if (bedrooms) {
                query += ' AND p.bedrooms >= ?';
                params.push(bedrooms);
            }

            if (bathrooms) {
                query += ' AND p.bathrooms >= ?';
                params.push(bathrooms);
            }

            if (status) {
                query += ' AND p.status = ?';
                params.push(status);
            }

            if (featured) {
                query += ' AND p.is_featured = TRUE';
            }

            if (search) {
                query += ' AND (p.title LIKE ? OR p.description LIKE ? OR p.address LIKE ?)';
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm, searchTerm);
            }

            // Add sorting
            const allowedSortFields = ['created_at', 'starting_price', 'view_count', 'title'];
            if (allowedSortFields.includes(sortBy)) {
                query += ` ORDER BY p.${sortBy} ${sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'}`;
            }

            // Add pagination
            const offset = (page - 1) * limit;
            query += ` LIMIT ? OFFSET ?`;
            params.push(parseInt(limit), parseInt(offset));

            const [rows] = await db.execute(query, params);

            // Process results
            const properties = rows.map(property => ({
                ...property,
                images: JSON.parse(property.images || '[]'),
                features: JSON.parse(property.features || '[]'),
                amenities: JSON.parse(property.amenities || '[]')
            }));

            // Get total count for pagination
            const [countRows] = await db.execute(
                `SELECT COUNT(*) as total FROM properties p WHERE 1=1 ${query.split('WHERE 1=1')[1]?.split('ORDER BY')[0] || ''}`,
                params.slice(0, -2) // Remove LIMIT params
            );

            return {
                properties,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countRows[0].total,
                    pages: Math.ceil(countRows[0].total / limit)
                }
            };

        } catch (error) {
            throw error;
        }
    }

    async generateUniqueSlug(title) {
        const baseSlug = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');

        let slug = baseSlug;
        let counter = 1;

        while (true) {
            const [rows] = await db.execute(
                'SELECT id FROM properties WHERE slug = ?',
                [slug]
            );

            if (rows.length === 0) {
                break;
            }

            slug = `${baseSlug}-${counter}`;
            counter++;
        }

        return slug;
    }

    async processPropertyFiles(files, slug) {
        const processedFiles = {
            images: [],
            documents: []
        };

        try {
            // Create property directory
            const propertyDir = path.join(process.env.UPLOAD_DIR || 'uploads', 'properties', slug);
            await fs.mkdir(propertyDir, { recursive: true });

            // Process images
            if (files.images) {
                const images = Array.isArray(files.images) ? files.images : [files.images];
                
                for (const image of images) {
                    if (this.allowedImageTypes.includes(image.mimetype) && image.size <= this.maxImageSize) {
                        const filename = `image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${path.extname(image.originalname)}`;
                        const filepath = path.join(propertyDir, filename);
                        
                        await fs.writeFile(filepath, image.buffer);
                        
                        processedFiles.images.push({
                            filename,
                            originalName: image.originalname,
                            size: image.size,
                            mimetype: image.mimetype,
                            path: filepath.replace(process.env.UPLOAD_DIR || 'uploads', '/uploads')
                        });
                    }
                }
            }

            // Process documents
            if (files.documents) {
                const documents = Array.isArray(files.documents) ? files.documents : [files.documents];
                
                for (const doc of documents) {
                    if (this.allowedDocumentTypes.includes(doc.mimetype) && doc.size <= this.maxDocumentSize) {
                        const filename = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${path.extname(doc.originalname)}`;
                        const filepath = path.join(propertyDir, filename);
                        
                        await fs.writeFile(filepath, doc.buffer);
                        
                        processedFiles.documents.push({
                            filename,
                            originalName: doc.originalname,
                            size: doc.size,
                            mimetype: doc.mimetype,
                            path: filepath.replace(process.env.UPLOAD_DIR || 'uploads', '/uploads')
                        });
                    }
                }
            }

            return processedFiles;

        } catch (error) {
            console.error('Error processing property files:', error);
            throw error;
        }
    }

    async toggleFavorite(propertyId, userId) {
        try {
            // Check if already favorited
            const [existing] = await db.execute(
                'SELECT id FROM favorites WHERE user_id = ? AND property_id = ?',
                [userId, propertyId]
            );

            if (existing.length > 0) {
                // Remove from favorites
                await db.execute(
                    'DELETE FROM favorites WHERE user_id = ? AND property_id = ?',
                    [userId, propertyId]
                );
                return { favorited: false, message: 'Removed from favorites' };
            } else {
                // Add to favorites
                await db.execute(
                    'INSERT INTO favorites (user_id, property_id, created_at) VALUES (?, ?, NOW())',
                    [userId, propertyId]
                );
                return { favorited: true, message: 'Added to favorites' };
            }

        } catch (error) {
            throw error;
        }
    }

    async getUserFavorites(userId, pagination = {}) {
        try {
            const { page = 1, limit = 20 } = pagination;
            const offset = (page - 1) * limit;

            const [rows] = await db.execute(
                `SELECT 
                    p.id, p.title, p.slug, p.description, p.property_type, p.address,
                    p.bedrooms, p.bathrooms, p.starting_price, p.current_price,
                    p.images, p.created_at, l.name as location_name
                 FROM favorites f
                 JOIN properties p ON f.property_id = p.id
                 LEFT JOIN locations l ON p.location_id = l.id
                 WHERE f.user_id = ?
                 ORDER BY f.created_at DESC
                 LIMIT ? OFFSET ?`,
                [userId, parseInt(limit), parseInt(offset)]
            );

            const favorites = rows.map(property => ({
                ...property,
                images: JSON.parse(property.images || '[]')
            }));

            const [countRows] = await db.execute(
                'SELECT COUNT(*) as total FROM favorites WHERE user_id = ?',
                [userId]
            );

            return {
                favorites,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: countRows[0].total,
                    pages: Math.ceil(countRows[0].total / limit)
                }
            };

        } catch (error) {
            throw error;
        }
    }
}

module.exports = PropertyService;