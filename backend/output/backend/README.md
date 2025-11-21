# Tanzania Real Estate Auctions - Backend

A comprehensive Node.js backend for an online real estate auction platform specifically designed for the Tanzanian market.

## Features

- 🔐 **Secure Authentication & Authorization**
  - JWT-based authentication
  - Role-based access control (User, Seller, Admin)
  - Email verification and password reset
  - Two-factor authentication ready

- 🏠 **Property Management**
  - Complete property CRUD operations
  - Image and document uploads
  - Advanced search and filtering
  - Property categorization and location management

- 💰 **Real-time Auction System**
  - Live bidding with WebSocket integration
  - Auto-bidding and proxy bidding
  - Auction monitoring and automatic start/end
  - Reserve price and bid increment management

- 📧 **Comprehensive Notifications**
  - Email notifications for all events
  - Real-time in-app notifications
  - SMS notifications (ready for integration)
  - Push notifications ready

- 👨‍💼 **Admin Dashboard**
  - User management
  - Property approval system
  - System monitoring and analytics
  - Admin action logging

- 🔒 **Security Features**
  - Rate limiting
  - Input validation and sanitization
  - SQL injection prevention
  - XSS protection
  - File upload security

## Technology Stack

- **Runtime**: Node.js (>= 16.0.0)
- **Framework**: Express.js
- **Database**: MySQL 8.0+
- **Real-time**: Socket.IO
- **Authentication**: JWT (jsonwebtoken)
- **File Upload**: Multer
- **Email**: Nodemailer
- **Security**: Helmet, express-validator, bcryptjs
- **Testing**: Jest

## Prerequisites

- Node.js (>= 16.0.0)
- MySQL (>= 8.0)
- npm or yarn

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tanzania-auctions/real-estate-platform.git
   cd real-estate-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` file with your configuration:
   - Database credentials
   - JWT secrets
   - Email configuration
   - Other settings

4. **Set up the database**
   ```bash
   # Create database
   mysql -u root -p
   CREATE DATABASE tanzania_auctions;
   EXIT;

   # Run migrations
   npm run db:migrate

   # Seed with sample data (optional)
   npm run db:seed
   ```

5. **Start the server**
   ```bash
   # Development mode
   npm run dev

   # Production mode
   npm start
   ```

## Database Schema

The system uses a comprehensive MySQL database with the following main tables:

- **users**: User accounts and profiles
- **properties**: Property listings
- **auctions**: Auction management
- **bids**: Bid tracking
- **notifications**: User notifications
- **transactions**: Payment processing
- **admin_action_logs**: Admin activity tracking

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Token refresh
- `POST /api/auth/forgot-password` - Password reset
- `POST /api/auth/reset-password` - Reset password

### Properties
- `GET /api/properties` - List properties with filtering
- `GET /api/properties/:id` - Get property details
- `POST /api/properties` - Create new property
- `PUT /api/properties/:id` - Update property
- `POST /api/properties/:id/favorite` - Toggle favorite

### Auctions
- `GET /api/auctions` - List auctions
- `GET /api/auctions/:id` - Get auction details
- `POST /api/auctions` - Create auction
- `PUT /api/auctions/:id` - Update auction

### Bidding
- `POST /api/bids` - Place a bid
- `GET /api/bids/my-bids` - Get user's bids
- `POST /api/bids/auto-bid` - Set up auto-bidding
- `DELETE /api/bids/auto-bid/:auctionId` - Cancel auto-bidding

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile
- `PUT /api/users/password` - Change password
- `GET /api/users/dashboard` - User dashboard
- `GET /api/users/notifications` - Get notifications

### Admin
- `GET /api/admin/dashboard` - Admin dashboard
- `GET /api/admin/users` - List users
- `PUT /api/admin/users/:id/status` - Update user status
- `GET /api/admin/properties` - List all properties
- `PUT /api/admin/properties/:id/status` - Approve/reject property

## WebSocket Events

The system uses Socket.IO for real-time functionality:

### Client to Server
- `join_auction` - Join auction room
- `place_bid` - Place a bid
- `setup_auto_bid` - Set up auto-bidding

### Server to Client
- `bid_update` - New bid placed
- `bid_error` - Bid error
- `auto_bid_confirmed` - Auto-bid confirmed
- `auction_ended` - Auction ended
- `notification` - New notification

## File Upload

The system supports uploading:
- Property images (JPEG, PNG, WebP) - up to 10MB each
- Property documents (PDF, Word, Excel) - up to 50MB each
- User avatars (JPEG, PNG, WebP) - up to 5MB each

## Security Features

- **Rate Limiting**: Prevents brute force attacks
- **Input Validation**: All inputs are validated and sanitized
- **SQL Injection Protection**: Using parameterized queries
- **JWT Security**: Secure token management
- **File Upload Security**: File type and size validation
- **CORS Protection**: Cross-origin request protection

## Testing

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

## Deployment

### Using PM2 (Recommended for production)
```bash
npm install -g pm2
pm2 start server.js --name "tanzania-auctions"
pm2 startup
pm2 save
```

### Using Docker
```bash
docker build -t tanzania-auctions .
docker run -p 3000:3000 --env-file .env tanzania-auctions
```

### Environment Variables

Ensure these environment variables are set in production:
- `NODE_ENV=production`
- `JWT_SECRET` - Strong random string
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `SMTP_USER`, `SMTP_PASS` - Email credentials
- `FRONTEND_URL` - Your frontend URL

## Monitoring

The system includes:
- Morgan for HTTP request logging
- Winston for application logging
- Health check endpoint at `/health`
- Database connection monitoring

## Maintenance

Regular maintenance tasks:
1. **Database Backups**: Daily automated backups
2. **Log Rotation**: Weekly log cleanup
3. **Security Updates**: Monthly dependency updates
4. **Performance Monitoring**: Weekly performance checks
5. **User Cleanup**: Remove inactive accounts (optional)

## Support

For issues and feature requests:
- Create an issue in the GitHub repository
- Contact support at support@tanzaniaauctions.com
- Check the documentation in the `/docs` folder

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Changelog

### Version 1.0.0
- Initial release
- Complete auction platform
- Real-time bidding
- Admin dashboard
- Email notifications
- File upload system
- Security features

---

Built with ❤️ for the Tanzanian real estate market.