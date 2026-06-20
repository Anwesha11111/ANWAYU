// Mock environment variables before any module loads
process.env.NODE_ENV            = 'test';
process.env.DATABASE_URL        = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_URL           = 'redis://localhost:6379';
process.env.NEBIUS_API_BASE_URL = 'https://api.tokenfactory.nebius.com/v1/';
process.env.NEBIUS_API_KEY      = 'test-api-key';
process.env.JWT_SECRET          = 'test-jwt-secret-256bit-aaaa-bbbb-cccc';
process.env.COMPETENCY_HASH_SECRET = 'test-hash-secret';
process.env.DOMAIN_BLOCKLIST    = 'gmail.com,yahoo.com,hotmail.com';
process.env.LOG_LEVEL           = 'silent';
