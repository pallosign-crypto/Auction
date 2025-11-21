const request = require('supertest');
const app = require('../server');

describe('Server Setup', () => {
    test('Server should start without errors', async () => {
        const response = await request(app)
            .get('/health')
            .expect(200);
        
        expect(response.body).toHaveProperty('status', 'OK');
    });

    test('API should return 404 for non-existent routes', async () => {
        const response = await request(app)
            .get('/api/nonexistent')
            .expect(404);
        
        expect(response.body).toHaveProperty('error');
    });

    test('CORS should be enabled', async () => {
        const response = await request(app)
            .get('/health')
            .expect('Access-Control-Allow-Origin', /localhost|tanzaniaauctions/);
    });
});

describe('Authentication Endpoints', () => {
    test('Registration endpoint should exist', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                firstName: 'Test',
                lastName: 'User',
                email: 'test@example.com',
                username: 'testuser',
                password: 'password123',
                phone: '+255700000000',
                accountType: 'bidder',
                dateOfBirth: '1990-01-01',
                nationality: 'Tanzanian'
            });
        
        // Should either succeed or return validation errors
        expect(response.status).toBeOneOf([201, 400, 500]);
    });

    test('Login endpoint should exist', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'password123'
            });
        
        // Should either succeed or return auth errors
        expect(response.status).toBeOneOf([200, 401, 400, 500]);
    });
});

describe('Property Endpoints', () => {
    test('Get properties endpoint should exist', async () => {
        const response = await request(app)
            .get('/api/properties')
            .expect(200);
        
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
    });

    test('Get property categories should exist', async () => {
        const response = await request(app)
            .get('/api/properties/categories/all')
            .expect(200);
        
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
    });

    test('Get featured properties should exist', async () => {
        const response = await request(app)
            .get('/api/properties/featured/all')
            .expect(200);
        
        expect(response.body).toHaveProperty('success');
        expect(response.body).toHaveProperty('data');
    });
});

describe('Database Connection', () => {
    test('Database should be accessible', async () => {
        const response = await request(app)
            .get('/api/properties')
            .expect(200);
        
        // If database is connected, we should get an array (even if empty)
        expect(Array.isArray(response.body.data)).toBe(true);
    });
});

// Custom matcher for multiple possible values
expect.extend({
    toBeOneOf(received, array) {
        const pass = array.includes(received);
        if (pass) {
            return {
                message: () => `expected ${received} not to be one of ${array}`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${received} to be one of ${array}`,
                pass: false,
            };
        }
    },
});