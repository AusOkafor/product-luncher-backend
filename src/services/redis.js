import Redis from 'ioredis';
import { logger } from '../utils/logger.js';

class RedisService {
    constructor() {
        this.client = null;
        this.subscriber = null;
        this.publisher = null;
    }

    async connect() {
        try {
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

            this.client = new Redis(redisUrl, {
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                retryDelayOnClusterDown: 300,
                maxRetriesPerRequest: 1,
                connectTimeout: 5000,
            });

            this.subscriber = new Redis(redisUrl, {
                lazyConnect: true,
                retryDelayOnClusterDown: 300,
                maxRetriesPerRequest: 1,
                connectTimeout: 5000,
            });

            this.publisher = new Redis(redisUrl, {
                lazyConnect: true,
                retryDelayOnClusterDown: 300,
                maxRetriesPerRequest: 1,
                connectTimeout: 5000,
            });

            // Event listeners
            this.client.on('connect', () => {
                logger.info('Redis client connected');
            });

            this.client.on('error', (error) => {
                logger.warn('Redis client error (continuing without Redis):', error.message);
            });

            this.client.on('close', () => {
                logger.warn('Redis client connection closed');
            });

            await this.client.connect();
            await this.subscriber.connect();
            await this.publisher.connect();

            logger.info('Redis service initialized successfully');
        } catch (error) {
            logger.warn('Redis not available, continuing without Redis:', error.message);
            this.client = null;
            this.subscriber = null;
            this.publisher = null;
        }
    }

    async disconnect() {
        try {
            if (this.client) {
                await this.client.disconnect();
            }
            if (this.subscriber) {
                await this.subscriber.disconnect();
            }
            if (this.publisher) {
                await this.publisher.disconnect();
            }
            logger.info('Redis connections closed');
        } catch (error) {
            logger.warn('Error disconnecting from Redis:', error.message);
        }
    }

    // Cache methods
    async get(key) {
        try {
            if (!this.client) {
                return null; // Redis not available
            }
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.warn('Redis get error (continuing without cache):', error.message);
            return null;
        }
    }

    async set(key, value, ttl = 3600) {
        try {
            if (!this.client) {
                return true; // Redis not available, pretend it worked
            }
            const serialized = JSON.stringify(value);
            await this.client.setex(key, ttl, serialized);
            return true;
        } catch (error) {
            logger.warn('Redis set error (continuing without cache):', error.message);
            return true; // Pretend it worked
        }
    }

    async del(key) {
        try {
            if (!this.client) {
                return true; // Redis not available, pretend it worked
            }
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.warn('Redis del error (continuing without cache):', error.message);
            return true; // Pretend it worked
        }
    }

    async exists(key) {
        try {
            return await this.client.exists(key);
        } catch (error) {
            logger.error('Redis exists error:', error);
            return false;
        }
    }

    // Pub/Sub methods
    async publish(channel, message) {
        try {
            const serialized = JSON.stringify(message);
            await this.publisher.publish(channel, serialized);
            return true;
        } catch (error) {
            logger.error('Redis publish error:', error);
            return false;
        }
    }

    async subscribe(channel, callback) {
        try {
            await this.subscriber.subscribe(channel);
            this.subscriber.on('message', (ch, message) => {
                if (ch === channel) {
                    try {
                        const parsed = JSON.parse(message);
                        callback(parsed);
                    } catch (error) {
                        logger.error('Error parsing Redis message:', error);
                    }
                }
            });
            return true;
        } catch (error) {
            logger.error('Redis subscribe error:', error);
            return false;
        }
    }

    // Queue methods (for BullMQ)
    getQueueConnection() {
        return this.client;
    }
}

export const redisService = new RedisService();