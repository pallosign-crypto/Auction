# Tanzania Real Estate Auctions - Deployment Guide

## Quick Start

### 1. Prerequisites
- Node.js 16+ installed
- MySQL 8.0+ running
- npm or yarn package manager

### 2. Installation
```bash
# Clone and enter the project directory
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
# DB_HOST, DB_USER, DB_PASSWORD, DB_NAME
# JWT_SECRET, SMTP credentials, etc.
```

### 3. Database Setup
```bash
# Create database and run migrations
npm run db:migrate

# Seed with sample data (optional)
npm run db:seed
```

### 4. Start Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## Production Deployment

### Using PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start server.js --name "tanzania-auctions"

# Setup auto-start on system reboot
pm2 startup
pm2 save

# Monitor application
pm2 monit
pm2 logs
```

### Using Docker
```bash
# Build Docker image
docker build -t tanzania-auctions .

# Run container
docker run -p 3000:3000 --env-file .env tanzania-auctions
```

### Using Systemd (Linux)
```bash
# Create service file
sudo nano /etc/systemd/system/tanzania-auctions.service

# Add content:
[Unit]
Description=Tanzania Real Estate Auctions
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/project
ExecStart=/usr/bin/node server.js
Restart=on-failure
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

# Enable and start service
sudo systemctl enable tanzania-auctions
sudo systemctl start tanzania-auctions
```

## Environment Configuration

### Required Variables
```env
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com

# Database
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=tanzania_auctions

# JWT Secrets (Generate strong random strings)
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Email (Gmail SMTP example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### Security Best Practices
1. **Generate strong JWT secrets**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **Use environment variables** for all sensitive data
3. **Enable HTTPS** in production
4. **Configure firewall** to restrict access
5. **Regular security updates**:
   ```bash
   npm audit
   npm update
   ```

## Database Management

### Backup Database
```bash
# Daily backup
mysqldump -u your_user -p tanzania_auctions > backup_$(date +%Y%m%d).sql

# Automated backup script
#!/bin/bash
BACKUP_DIR="/path/to/backups"
mysqldump -u your_user -pYourPass tanzania_auctions > "$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql"
find "$BACKUP_DIR" -name "backup_*.sql" -mtime +7 -delete
```

### Database Optimization
```sql
-- Optimize tables
OPTIMIZE TABLE users, properties, auctions, bids;

-- Update statistics
ANALYZE TABLE users, properties, auctions, bids;
```

### Monitoring Queries
```sql
-- Check slow queries
SHOW PROCESSLIST;

-- Database size
SELECT 
    table_schema AS 'Database',
    ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS 'Size (MB)'
FROM information_schema.tables 
GROUP BY table_schema;
```

## Monitoring and Logging

### Application Logs
```bash
# PM2 logs
pm2 logs
pm2 logs --lines 100

# System logs
journalctl -u tanzania-auctions -f

# Custom application logs
tail -f logs/app.log
```

### Health Checks
```bash
# Application health
curl http://localhost:3000/health

# Database connection
curl http://localhost:3000/health/db

# System resources
htop
df -h
```

### Performance Monitoring
```bash
# Install monitoring tools
npm install -g clinic
npm install -g 0x

# Profile application
clinic doctor -- node server.js
```

## SSL Certificate Setup

### Using Let's Encrypt
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Manual SSL Configuration
```bash
# Generate private key
openssl genrsa -out private.key 2048

# Generate certificate signing request
openssl req -new -key private.key -out certificate.csr

# Generate self-signed certificate (for testing)
openssl x509 -req -days 365 -in certificate.csr -signkey private.key -out certificate.crt
```

## Load Balancing (Optional)

### Using Nginx
```nginx
upstream tanzania_auctions {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://tanzania_auctions;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Using PM2 Cluster Mode
```bash
# Start with cluster mode
pm2 start server.js -i max --name "tanzania-auctions"

# Scale up/down
pm2 scale tanzania-auctions 4
pm2 scale tanzania-auctions 2
```

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   lsof -i :3000
   kill -9 <PID>
   ```

2. **Database connection failed**
   ```bash
   # Check MySQL status
   sudo systemctl status mysql
   
   # Test connection
   mysql -u your_user -p
   ```

3. **High memory usage**
   ```bash
   # Check memory
   free -h
   
   # Check Node.js memory
   pm2 monit
   
   # Optimize Node.js
   node --max-old-space-size=4096 server.js
   ```

4. **Slow queries**
   ```sql
   -- Enable slow query log
   SET GLOBAL slow_query_log = 'ON';
   SET GLOBAL long_query_time = 1;
   ```

### Log Analysis
```bash
# Search for errors
grep -i "error" logs/app.log

# Monitor real-time
tail -f logs/app.log | grep ERROR

# Count errors by type
grep -c "error" logs/app.log
grep -c "warning" logs/app.log
```

## Maintenance Schedule

### Daily
- [ ] Check application logs for errors
- [ ] Monitor server resources
- [ ] Verify database connectivity
- [ ] Check backup completion

### Weekly
- [ ] Review security logs
- [ ] Update dependencies
- [ ] Optimize database tables
- [ ] Review performance metrics

### Monthly
- [ ] Security audit
- [ ] SSL certificate renewal check
- [ ] Database performance review
- [ ] Update documentation

### Quarterly
- [ ] Disaster recovery test
- [ ] Security penetration test
- [ ] Capacity planning review
- [ ] Backup strategy review

## Support Contacts

- **Technical Support**: support@tanzaniaauctions.com
- **Emergency Hotline**: +255-XXX-XXX-XXX
- **Documentation**: https://docs.tanzaniaauctions.com
- **Status Page**: https://status.tanzaniaauctions.com

---

**Note**: This deployment guide provides comprehensive instructions for setting up the Tanzania Real Estate Auctions backend in production. Always test in a staging environment first and follow security best practices.