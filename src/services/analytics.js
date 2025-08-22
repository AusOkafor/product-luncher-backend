import { prisma } from '../db.js';
import { logger } from '../utils/logger.js';
import { monitoringService } from './monitoring.js';

class AnalyticsService {
    constructor() {
        this.metrics = new Map();
    }

    // Track product views
    async trackProductView(productId, userId = null, sessionId = null) {
        try {
            // Get the product to find its workspace
            const product = await prisma.product.findUnique({
                where: { id: productId },
                include: { store: true }
            });

            if (!product) {
                throw new Error(`Product not found: ${productId}`);
            }

            await prisma.event.create({
                data: {
                    workspaceId: product.store.workspaceId,
                    type: 'PRODUCT_VIEW',
                    payload: {
                        productId,
                        userId,
                        sessionId,
                        timestamp: new Date().toISOString(),
                        source: 'web'
                    }
                }
            });

            // Track in PostHog (if available)
            if (userId && monitoringService.track) {
                try {
                    await monitoringService.track('product_viewed', {
                        product_id: productId,
                        user_id: userId
                    });
                } catch (error) {
                    // PostHog tracking failed, but don't fail the main operation
                    logger.warn('PostHog tracking failed:', error.message);
                }
            }

            logger.info(`Product view tracked: ${productId}`);
        } catch (error) {
            logger.error('Error tracking product view:', error);
        }
    }

    // Track launch performance
    async trackLaunchPerformance(launchId, metrics) {
        try {
            const { views, clicks, conversions, revenue } = metrics;

            // Get the launch to find its workspace
            const launch = await prisma.launch.findUnique({
                where: { id: launchId }
            });

            if (!launch) {
                throw new Error(`Launch not found: ${launchId}`);
            }

            await prisma.event.create({
                data: {
                    workspaceId: launch.workspaceId,
                    type: 'LAUNCH_PERFORMANCE',
                    payload: {
                        launchId,
                        views,
                        clicks,
                        conversions,
                        revenue,
                        ctr: clicks / views,
                        conversion_rate: conversions / clicks,
                        timestamp: new Date().toISOString()
                    }
                }
            });

            // Track in PostHog (if available)
            if (monitoringService.track) {
                try {
                    await monitoringService.track('launch_performance', {
                        launch_id: launchId,
                        views,
                        clicks,
                        conversions,
                        revenue,
                        ctr: clicks / views,
                        conversion_rate: conversions / clicks
                    });
                } catch (error) {
                    logger.warn('PostHog tracking failed:', error.message);
                }
            }

            logger.info(`Launch performance tracked: ${launchId}`);
        } catch (error) {
            logger.error('Error tracking launch performance:', error);
        }
    }

    // Get product analytics
    async getProductAnalytics(productId, timeRange = '30d') {
        try {
            // Get the product to find its workspace
            const product = await prisma.product.findUnique({
                where: { id: productId },
                include: { store: true }
            });

            if (!product) {
                throw new Error(`Product not found: ${productId}`);
            }

            const events = await prisma.event.findMany({
                where: {
                    workspaceId: product.store.workspaceId,
                    type: { in: ['PRODUCT_VIEW', 'LAUNCH_CREATED', 'CONVERSION'] },
                    payload: {
                        path: ['productId'],
                        equals: productId
                    },
                    ts: {
                        gte: this._getDateFromRange(timeRange)
                    }
                },
                orderBy: { ts: 'desc' }
            });

            const analytics = {
                views: events.filter(e => e.type === 'PRODUCT_VIEW').length,
                launches: events.filter(e => e.type === 'LAUNCH_CREATED').length,
                conversions: events.filter(e => e.type === 'CONVERSION').length,
                revenue: events
                    .filter(e => e.type === 'CONVERSION')
                    .reduce((sum, e) => sum + (e.payload && e.payload.revenue || 0), 0),
                events: events.slice(0, 10) // Last 10 events
            };

            return analytics;
        } catch (error) {
            logger.error('Error getting product analytics:', error);
            throw error;
        }
    }

    // Get store analytics
    async getStoreAnalytics(storeId, timeRange = '30d') {
        try {
            const products = await prisma.product.findMany({
                where: { storeId },
                include: {
                    _count: {
                        select: { launches: true }
                    }
                }
            });

            const events = await prisma.event.findMany({
                where: {
                    workspaceId: storeId,
                    type: { in: ['PRODUCT_VIEW', 'LAUNCH_CREATED', 'CONVERSION'] },
                    ts: {
                        gte: this._getDateFromRange(timeRange)
                    }
                }
            });

            const analytics = {
                totalProducts: products.length,
                totalLaunches: products.reduce((sum, p) => sum + p._count.launches, 0),
                totalViews: events.filter(e => e.type === 'PRODUCT_VIEW').length,
                totalConversions: events.filter(e => e.type === 'CONVERSION').length,
                totalRevenue: events
                    .filter(e => e.type === 'CONVERSION')
                    .reduce((sum, e) => sum + (e.payload && e.payload.revenue || 0), 0),
                topProducts: await this._getTopProducts(storeId, timeRange)
            };

            return analytics;
        } catch (error) {
            logger.error('Error getting store analytics:', error);
            throw error;
        }
    }

    // Get top performing products
    async _getTopProducts(storeId, timeRange = '30d') {
        try {
            const products = await prisma.product.findMany({
                where: { storeId },
                include: {
                    launches: true
                }
            });

            const productStats = await Promise.all(
                products.map(async(product) => {
                    const events = await prisma.event.findMany({
                        where: {
                            workspaceId: storeId,
                            type: { in: ['PRODUCT_VIEW', 'LAUNCH_CREATED', 'CONVERSION'] },
                            payload: {
                                path: ['productId'],
                                equals: product.id
                            },
                            ts: {
                                gte: this._getDateFromRange(timeRange)
                            }
                        }
                    });

                    return {
                        id: product.id,
                        title: product.title,
                        price: product.price,
                        views: events.filter(e => e.type === 'PRODUCT_VIEW').length,
                        launches: product.launches.length,
                        conversions: events.filter(e => e.type === 'CONVERSION').length,
                        revenue: events
                            .filter(e => e.type === 'CONVERSION')
                            .reduce((sum, e) => sum + (e.payload && e.payload.revenue || 0), 0)
                    };
                })
            );

            return productStats
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 10);
        } catch (error) {
            logger.error('Error getting top products:', error);
            return [];
        }
    }

    // Track AI launch creation
    async trackAILaunchCreation(productId, launchData) {
        try {
            // Get the product to find its workspace
            const product = await prisma.product.findUnique({
                where: { id: productId },
                include: { store: true }
            });

            if (!product) {
                throw new Error(`Product not found: ${productId}`);
            }

            await prisma.event.create({
                data: {
                    workspaceId: product.store.workspaceId,
                    type: 'AI_LAUNCH_CREATED',
                    payload: {
                        productId,
                        launch_type: launchData.type,
                        ai_model: launchData.aiModel,
                        generation_time: launchData.generationTime,
                        timestamp: new Date().toISOString()
                    }
                }
            });

            // Track in PostHog (if available)
            if (monitoringService.track) {
                try {
                    await monitoringService.track('ai_launch_created', {
                        product_id: productId,
                        launch_type: launchData.type,
                        ai_model: launchData.aiModel,
                        generation_time: launchData.generationTime
                    });
                } catch (error) {
                    logger.warn('PostHog tracking failed:', error.message);
                }
            }

            logger.info(`AI launch creation tracked: ${productId}`);
        } catch (error) {
            logger.error('Error tracking AI launch creation:', error);
        }
    }

    // Helper method to get date from time range
    _getDateFromRange(timeRange) {
        const now = new Date();
        switch (timeRange) {
            case '7d':
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            case '30d':
                return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            case '90d':
                return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            default:
                return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
    }
}

export const analyticsService = new AnalyticsService();