import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import dotenv from 'dotenv'

import { errorHandler } from './middlewares/errorHandler.js'
import { logger } from './utils/logger.js'

// Import services
import { redisService } from './services/redis.js'
import { aiService } from './services/ai.js'
import { stripeService } from './services/stripe.js'
import { messagingService } from './services/messaging.js'
import { monitoringService } from './services/monitoring.js'
import { shopifyService } from './services/shopify.js'

// Import routes
import { authRoutes } from './routes/authRoutes.js'
import { launchRoutes } from './routes/launchRoutes.js'
import { productRoutes } from './routes/productRoutes.js'
import { storeRoutes } from './routes/storeRoutes.js'
import { analyticsRoutes } from './routes/analyticsRoutes.js'
import shopifyRoutes from './routes/shopifyRoutes.js'
import aiLaunchRoutes from './routes/aiLaunchRoutes.js'
import cartRecoveryRoutes from './routes/cartRecoveryRoutes.js'
import adCreativeRoutes from './routes/adCreativeRoutes.js'
import returnsPreventionRoutes from './routes/returnsPreventionRoutes.js'
import ugcTrendRoutes from './routes/ugcTrendRoutes.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

// Vercel compatibility
app.set('trust proxy', 1)

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:']
        }
    }
}))

// CORS configuration
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true
}))

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false
})
app.use('/api/', limiter)

// Body parsing middleware
app.use(compression())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV
    })
})

// API routes
app.use('/api/auth', authRoutes)
app.use('/api/launches', launchRoutes)
app.use('/api/products', productRoutes)
app.use('/api/stores', storeRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/shopify', shopifyRoutes)
app.use('/api/ai-launches', aiLaunchRoutes)
app.use('/api/cart-recovery', cartRecoveryRoutes)
app.use('/api/ad-creatives', adCreativeRoutes)
app.use('/api/returns-prevention', returnsPreventionRoutes)
app.use('/api/ugc-trends', ugcTrendRoutes)

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`
    })
})

// Global error handler
app.use(errorHandler)

// Initialize services
async function initializeServices() {
    try {
        logger.info('Initializing external services...')

        // Initialize Redis
        await redisService.connect()

        // Initialize AI service
        await aiService.initialize()

        // Initialize Stripe
        await stripeService.initialize()

        // Initialize messaging service
        await messagingService.initialize()

        // Initialize monitoring service
        await monitoringService.initialize()

        logger.info('All external services initialized successfully')
    } catch (error) {
        logger.error('Error initializing services:', error)
            // Don't exit, continue with server startup
    }
}

// Start server only if not running on Vercel
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, async() => {
        logger.info(`🚀 Server running on port ${PORT}`)
        logger.info(`📊 Health check: http://localhost:${PORT}/health`)
        logger.info(`🔗 API base URL: http://localhost:${PORT}/api`)

        // Initialize services after server starts
        await initializeServices()
    })
} else {
    // Initialize services for Vercel
    initializeServices().catch(error => {
        logger.error('Error initializing services on Vercel:', error)
    })
}

// Graceful shutdown
async function gracefulShutdown(signal) {
    logger.info(`${signal} received, shutting down gracefully`)

    try {
        // Disconnect Redis
        await redisService.disconnect()
        logger.info('Redis disconnected')

        // Close any other connections here
        logger.info('All services disconnected')
    } catch (error) {
        logger.error('Error during graceful shutdown:', error)
    }

    process.exit(0)
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))

export default app