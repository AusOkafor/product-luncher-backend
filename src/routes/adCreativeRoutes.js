import express from 'express';
import { adCreativeOptimizerService } from '../services/adCreativeOptimizerService.js';
import { prisma } from '../db.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Ingest performance data from Meta Ads API
router.post('/ingest-performance/:adAccountId', async(req, res) => {
    try {
        const { adAccountId } = req.params;
        const { dateRange = 'last_30d' } = req.body;

        const performanceData = await adCreativeOptimizerService.ingestPerformanceData(adAccountId, dateRange);

        res.json({
            success: true,
            data: {
                ingestedRecords: performanceData.length,
                adAccountId,
                dateRange
            }
        });
    } catch (error) {
        logger.error('Error ingesting performance data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to ingest performance data'
        });
    }
});

// Optimize ad creative using multi-armed bandit
router.post('/optimize/:adSetId', async(req, res) => {
    try {
        const { adSetId } = req.params;
        const { explorationRate = 0.2, learningRate = 0.1 } = req.body;

        const optimizationResult = await adCreativeOptimizerService.optimizeAdCreative(adSetId, {
            explorationRate,
            learningRate
        });

        res.json({
            success: true,
            data: optimizationResult
        });
    } catch (error) {
        logger.error('Error optimizing ad creative:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to optimize ad creative'
        });
    }
});

// Generate new ad variation
router.post('/generate-variation/:adSetId', async(req, res) => {
    try {
        const { adSetId } = req.params;
        const { mode = 'exploration' } = req.body;

        const variation = await adCreativeOptimizerService.generateNewAdVariation(adSetId, mode);

        res.json({
            success: true,
            data: variation
        });
    } catch (error) {
        logger.error('Error generating ad variation:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate ad variation'
        });
    }
});

// Setup A/B test
router.post('/setup-ab-test/:adSetId', async(req, res) => {
    try {
        const { adSetId } = req.params;
        const { testName, duration, budget, metrics } = req.body;

        const abTest = await adCreativeOptimizerService.setupABTest(adSetId, {
            testName,
            duration,
            budget,
            metrics
        });

        res.json({
            success: true,
            data: abTest
        });
    } catch (error) {
        logger.error('Error setting up A/B test:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to setup A/B test'
        });
    }
});

// Get optimization recommendations
router.get('/recommendations/:adSetId', async(req, res) => {
    try {
        const { adSetId } = req.params;

        const recommendations = await adCreativeOptimizerService.getOptimizationRecommendations(adSetId);

        res.json({
            success: true,
            data: recommendations
        });
    } catch (error) {
        logger.error('Error getting optimization recommendations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get optimization recommendations'
        });
    }
});

// Get performance data for ad set
router.get('/performance/:adSetId', async(req, res) => {
    try {
        const { adSetId } = req.params;
        const { days = 30 } = req.query;

        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const performanceData = await prisma.adPerformance.findMany({
            where: {
                adName: {
                    contains: adSetId
                },
                recordedAt: {
                    gte: startDate
                }
            },
            orderBy: {
                recordedAt: 'desc'
            }
        });

        res.json({
            success: true,
            data: {
                performanceData,
                totalRecords: performanceData.length,
                dateRange: `${days} days`
            }
        });
    } catch (error) {
        logger.error('Error getting performance data:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get performance data'
        });
    }
});

// Get all ad creatives for ad set
router.get('/creatives/:adSetId', async(req, res) => {
    try {
        const { adSetId } = req.params;

        const creatives = await prisma.adCreative.findMany({
            where: {
                adSetId
            },
            orderBy: {
                generatedAt: 'desc'
            }
        });

        res.json({
            success: true,
            data: {
                creatives,
                totalCreatives: creatives.length
            }
        });
    } catch (error) {
        logger.error('Error getting ad creatives:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get ad creatives'
        });
    }
});

// Get A/B test results
router.get('/ab-tests/:adSetId', async(req, res) => {
    try {
        const { adSetId } = req.params;

        const abTests = await prisma.abTest.findMany({
            where: {
                adSetId
            },
            include: {
                variationA: true,
                variationB: true
            },
            orderBy: {
                startDate: 'desc'
            }
        });

        res.json({
            success: true,
            data: {
                abTests,
                totalTests: abTests.length
            }
        });
    } catch (error) {
        logger.error('Error getting A/B tests:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get A/B tests'
        });
    }
});

export default router;