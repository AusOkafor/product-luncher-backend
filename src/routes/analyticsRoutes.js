import express from 'express';
import { analyticsService } from '../services/analytics.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Track product view
router.post('/track/product-view', async(req, res) => {
    try {
        const { productId, userId, sessionId } = req.body;

        if (!productId) {
            return res.status(400).json({ error: 'Product ID is required' });
        }

        await analyticsService.trackProductView(productId, userId, sessionId);

        res.json({ success: true, message: 'Product view tracked' });
    } catch (error) {
        logger.error('Error tracking product view:', error);
        res.status(500).json({ error: 'Failed to track product view' });
    }
});

// Track launch performance
router.post('/track/launch-performance', async(req, res) => {
    try {
        const { launchId, metrics } = req.body;

        if (!launchId || !metrics) {
            return res.status(400).json({ error: 'Launch ID and metrics are required' });
        }

        await analyticsService.trackLaunchPerformance(launchId, metrics);

        res.json({ success: true, message: 'Launch performance tracked' });
    } catch (error) {
        logger.error('Error tracking launch performance:', error);
        res.status(500).json({ error: 'Failed to track launch performance' });
    }
});

// Get product analytics
router.get('/product/:productId', async(req, res) => {
    try {
        const { productId } = req.params;
        const { timeRange = '30d' } = req.query;

        const analytics = await analyticsService.getProductAnalytics(productId, timeRange);

        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        logger.error('Error getting product analytics:', error);
        res.status(500).json({ error: 'Failed to get product analytics' });
    }
});

// Get store analytics
router.get('/store/:storeId', async(req, res) => {
    try {
        const { storeId } = req.params;
        const { timeRange = '30d' } = req.query;

        const analytics = await analyticsService.getStoreAnalytics(storeId, timeRange);

        res.json({
            success: true,
            data: analytics
        });
    } catch (error) {
        logger.error('Error getting store analytics:', error);
        res.status(500).json({ error: 'Failed to get store analytics' });
    }
});

// Get top performing products
router.get('/top-products/:storeId', async(req, res) => {
    try {
        const { storeId } = req.params;
        const { timeRange = '30d', limit = 10 } = req.query;

        const analytics = await analyticsService.getStoreAnalytics(storeId, timeRange);
        const topProducts = analytics.topProducts.slice(0, parseInt(limit));

        res.json({
            success: true,
            data: topProducts
        });
    } catch (error) {
        logger.error('Error getting top products:', error);
        res.status(500).json({ error: 'Failed to get top products' });
    }
});

export { router as analyticsRoutes };