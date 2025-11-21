-- Tanzania Real Estate Auctions Database Schema
-- MySQL Database Schema for Real Estate Auction Platform

CREATE DATABASE IF NOT EXISTS tanzania_auctions;
USE tanzania_auctions;

-- Users Table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    nationality VARCHAR(50),
    account_type ENUM('bidder', 'seller', 'both') DEFAULT 'bidder',
    avatar_url VARCHAR(255),
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    identity_verified BOOLEAN DEFAULT FALSE,
    status ENUM('active', 'suspended', 'banned', 'pending') DEFAULT 'pending',
    preferred_locations JSON,
    preferred_property_types JSON,
    budget_range_min BIGINT DEFAULT 0,
    budget_range_max BIGINT DEFAULT 0,
    referral_code VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_username (username),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Verification Documents Table
CREATE TABLE user_documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    document_type ENUM('national_id', 'passport', 'drivers_license', 'utility_bill', 'bank_statement') NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    reviewed_by INT NULL,
    review_notes TEXT,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Categories Table
CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    parent_id INT NULL,
    icon VARCHAR(100),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_parent_id (parent_id),
    INDEX idx_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Locations Table
CREATE TABLE locations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    type ENUM('country', 'region', 'city', 'area') NOT NULL,
    parent_id INT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES locations(id) ON DELETE SET NULL,
    INDEX idx_parent_id (parent_id),
    INDEX idx_slug (slug),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Properties Table
CREATE TABLE properties (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description LONGTEXT,
    property_type ENUM('residential', 'commercial', 'land', 'mixed_use') NOT NULL,
    category_id INT,
    location_id INT,
    address TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Property Details
    bedrooms INT DEFAULT 0,
    bathrooms INT DEFAULT 0,
    parking_spaces INT DEFAULT 0,
    total_area_sqm DECIMAL(10, 2) DEFAULT 0,
    built_area_sqm DECIMAL(10, 2) DEFAULT 0,
    year_built YEAR,
    floor_number INT DEFAULT 0,
    total_floors INT DEFAULT 0,
    
    -- Pricing
    starting_price BIGINT NOT NULL,
    reserve_price BIGINT DEFAULT 0,
    current_price BIGINT DEFAULT 0,
    price_currency ENUM('TZS', 'USD', 'EUR', 'GBP') DEFAULT 'TZS',
    
    -- Ownership
    owner_id INT NOT NULL,
    agent_id INT,
    
    -- Property Features
    features JSON,
    amenities JSON,
    images JSON,
    documents JSON,
    video_url VARCHAR(500),
    virtual_tour_url VARCHAR(500),
    
    -- Status
    status ENUM('draft', 'pending', 'approved', 'rejected', 'active', 'sold', 'withdrawn') DEFAULT 'draft',
    is_featured BOOLEAN DEFAULT FALSE,
    view_count INT DEFAULT 0,
    
    -- Metadata
    meta_title VARCHAR(255),
    meta_description TEXT,
    meta_keywords TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    approved_at TIMESTAMP NULL,
    approved_by INT NULL,
    
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    
    INDEX idx_owner_id (owner_id),
    INDEX idx_category_id (category_id),
    INDEX idx_location_id (location_id),
    INDEX idx_status (status),
    INDEX idx_property_type (property_type),
    INDEX idx_created_at (created_at),
    INDEX idx_is_featured (is_featured),
    FULLTEXT idx_title_description (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Auctions Table
CREATE TABLE auctions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    property_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Timing
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    duration_minutes INT NOT NULL,
    extended_end_time TIMESTAMP NULL,
    
    -- Pricing
    starting_price BIGINT NOT NULL,
    reserve_price BIGINT DEFAULT 0,
    current_price BIGINT DEFAULT 0,
    bid_increment_percentage DECIMAL(5, 2) DEFAULT 5.00,
    current_bid_count INT DEFAULT 0,
    
    -- Status
    status ENUM('scheduled', 'live', 'ended', 'cancelled', 'suspended') DEFAULT 'scheduled',
    result ENUM('no_bids', 'reserve_not_met', 'sold', 'withdrawn') NULL,
    winning_bid_id INT NULL,
    
    -- Settings
    auto_extend_enabled BOOLEAN DEFAULT TRUE,
    auto_extend_minutes INT DEFAULT 5,
    allow_proxy_bidding BOOLEAN DEFAULT TRUE,
    allow_auto_bidding BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    terms_conditions TEXT,
    notes TEXT,
    
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ended_at TIMESTAMP NULL,
    
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (winning_bid_id) REFERENCES bids(id) ON DELETE SET NULL,
    
    INDEX idx_property_id (property_id),
    INDEX idx_status (status),
    INDEX idx_start_time (start_time),
    INDEX idx_end_time (end_time),
    INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bids Table
CREATE TABLE bids (
    id INT PRIMARY KEY AUTO_INCREMENT,
    auction_id INT NOT NULL,
    user_id INT NOT NULL,
    amount BIGINT NOT NULL,
    max_amount BIGINT DEFAULT 0, -- For proxy bidding
    bid_type ENUM('normal', 'proxy', 'auto') DEFAULT 'normal',
    is_winning BOOLEAN DEFAULT FALSE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_auction_id (auction_id),
    INDEX idx_user_id (user_id),
    INDEX idx_amount (amount),
    INDEX idx_created_at (created_at),
    UNIQUE KEY unique_winning_bid (auction_id, is_winning)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Watchlists Table
CREATE TABLE watchlists (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    property_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_user_property (user_id, property_id),
    INDEX idx_user_id (user_id),
    INDEX idx_property_id (property_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications Table
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('auction_start', 'auction_end', 'outbid', 'won', 'property_sold', 'verification_approved', 'verification_rejected') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSON,
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_is_read (is_read),
    INDEX idx_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Transactions Table
CREATE TABLE transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    auction_id INT NOT NULL,
    bid_id INT NOT NULL,
    amount BIGINT NOT NULL,
    commission_amount BIGINT NOT NULL,
    total_amount BIGINT NOT NULL,
    currency ENUM('TZS', 'USD', 'EUR', 'GBP') DEFAULT 'TZS',
    status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    payment_method ENUM('bank_transfer', 'card', 'mobile_money') NULL,
    payment_reference VARCHAR(255),
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (auction_id) REFERENCES auctions(id) ON DELETE CASCADE,
    FOREIGN KEY (bid_id) REFERENCES bids(id) ON DELETE CASCADE,
    
    INDEX idx_user_id (user_id),
    INDEX idx_auction_id (auction_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Audit Logs Table
CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Settings Table
CREATE TABLE settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    key_name VARCHAR(100) UNIQUE NOT NULL,
    value TEXT,
    type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_key_name (key_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert Default Settings
INSERT INTO settings (key_name, value, type, description, is_system) VALUES
('site_name', 'Tanzania Real Estate Auctions', 'string', 'Website name', TRUE),
('site_description', 'Premium real estate auction platform in Tanzania', 'string', 'Site description', TRUE),
('auction_duration_hours', '8', 'number', 'Default auction duration in hours', FALSE),
('bid_increment_percentage', '5', 'number', 'Default bid increment percentage', FALSE),
('auto_extend_enabled', '1', 'boolean', 'Enable automatic auction extension', FALSE),
('auto_extend_minutes', '5', 'number', 'Auto extend time in minutes', FALSE),
('commission_percentage', '5', 'number', 'Platform commission percentage', FALSE),
('stripe_fee_percentage', '2.9', 'number', 'Stripe payment processing fee', FALSE),
('min_withdrawal_amount', '10000', 'number', 'Minimum withdrawal amount in TZS', FALSE),
('max_file_size', '10485760', 'number', 'Maximum file upload size in bytes', FALSE),
('allowed_image_types', '["image/jpeg", "image/png", "image/jpg"]', 'json', 'Allowed image MIME types', FALSE),
('allowed_document_types', '["application/pdf", "image/jpeg", "image/png"]', 'json', 'Allowed document MIME types', FALSE);

-- Insert Default Categories
INSERT INTO categories (name, slug, description, sort_order) VALUES
('Luxury Villas', 'luxury-villas', 'Premium luxury villas and mansions', 1),
('Apartments', 'apartments', 'Residential apartments and flats', 2),
('Safari Lodges', 'safari-lodges', 'Eco-tourism and safari properties', 3),
('Commercial Properties', 'commercial-properties', 'Office buildings and commercial spaces', 4),
('Land Plots', 'land-plots', 'Development land and agricultural land', 5),
('Beach Properties', 'beach-properties', 'Oceanfront and beachfront properties', 6);

-- Insert Default Locations
INSERT INTO locations (name, slug, type, latitude, longitude) VALUES
('Tanzania', 'tanzania', 'country', -6.3690, 34.8888),
('Dar es Salaam', 'dar-es-salaam', 'city', -6.7924, 39.2083),
('Arusha', 'arusha', 'city', -3.3869, 36.6830),
('Mwanza', 'mwanza', 'city', -2.5164, 32.9175),
('Zanzibar', 'zanzibar', 'city', -6.1659, 39.2026),
('Serengeti', 'serengeti', 'area', -2.3333, 34.8333),
('Masaki', 'masaki', 'area', -6.7924, 39.2083),
('Oyster Bay', 'oyster-bay', 'area', -6.7924, 39.2083),
('Upanga', 'upanga', 'area', -6.7924, 39.2083),
('Mikocheni', 'mikocheni', 'area', -6.7924, 39.2083);