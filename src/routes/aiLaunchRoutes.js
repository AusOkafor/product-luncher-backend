import express from 'express';
import { aiLaunchService } from '../services/aiLaunchService.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Generate AI launch for a product
router.post('/generate/:productId', async(req, res) => {
    try {
        const { productId } = req.params;
        const { launchType, options = {} } = req.body;

        if (!launchType) {
            return res.status(400).json({
                error: 'Launch type is required',
                availableTypes: Object.values(aiLaunchService.launchTypes)
            });
        }

        // Validate launch type
        if (!Object.values(aiLaunchService.launchTypes).includes(launchType)) {
            return res.status(400).json({
                error: 'Invalid launch type',
                availableTypes: Object.values(aiLaunchService.launchTypes)
            });
        }

        logger.info(`Generating ${launchType} launch for product: ${productId}`);

        const launch = await aiLaunchService.generateLaunch(productId, launchType, options);

        res.json({
            success: true,
            message: `AI ${launchType} launch generated successfully`,
            data: launch
        });
    } catch (error) {
        logger.error('Error generating AI launch:', error);
        res.status(500).json({
            error: 'Failed to generate AI launch',
            details: error.message
        });
    }
});

// Get all launches for a product
router.get('/product/:productId', async(req, res) => {
    try {
        const { productId } = req.params;

        const launches = await aiLaunchService.getProductLaunches(productId);

        res.json({
            success: true,
            data: launches
        });
    } catch (error) {
        logger.error('Error getting product launches:', error);
        res.status(500).json({ error: 'Failed to get product launches' });
    }
});

// Get specific launch by ID
router.get('/:launchId', async(req, res) => {
    try {
        const { launchId } = req.params;

        const launch = await aiLaunchService.getLaunch(launchId);

        if (!launch) {
            return res.status(404).json({ error: 'Launch not found' });
        }

        res.json({
            success: true,
            data: launch
        });
    } catch (error) {
        logger.error('Error getting launch:', error);
        res.status(500).json({ error: 'Failed to get launch' });
    }
});

// Get available launch types
router.get('/types/available', (req, res) => {
    res.json({
        success: true,
        data: {
            types: aiLaunchService.launchTypes,
            descriptions: {
                social_media: 'Generate social media posts and content',
                email_campaign: 'Create email marketing campaigns',
                landing_page: 'Generate landing page content',
                ad_creative: 'Create ad copy and creative content',
                product_description: 'Enhance product descriptions'
            }
        }
    });
});

// Generate multiple launch types for a product
router.post('/generate-multiple/:productId', async(req, res) => {
    try {
        const { productId } = req.params;
        const { launchTypes = [], options = {} } = req.body;

        if (!launchTypes.length) {
            return res.status(400).json({
                error: 'At least one launch type is required',
                availableTypes: Object.values(aiLaunchService.launchTypes)
            });
        }

        // Validate all launch types
        const invalidTypes = launchTypes.filter(type =>
            !Object.values(aiLaunchService.launchTypes).includes(type)
        );

        if (invalidTypes.length > 0) {
            return res.status(400).json({
                error: 'Invalid launch types',
                invalidTypes,
                availableTypes: Object.values(aiLaunchService.launchTypes)
            });
        }

        logger.info(`Generating multiple launches for product: ${productId}`, { launchTypes });

        const launches = [];
        const errors = [];

        // Generate launches in parallel
        const launchPromises = launchTypes.map(async(launchType) => {
            try {
                const launch = await aiLaunchService.generateLaunch(productId, launchType, options);
                launches.push(launch);
            } catch (error) {
                logger.error(`Error generating ${launchType} launch:`, error);
                errors.push({ type: launchType, error: error.message });
            }
        });

        await Promise.all(launchPromises);

        res.json({
            success: true,
            message: `Generated ${launches.length} out of ${launchTypes.length} launches`,
            data: {
                launches,
                errors: errors.length > 0 ? errors : undefined
            }
        });
    } catch (error) {
        logger.error('Error generating multiple launches:', error);
        res.status(500).json({
            error: 'Failed to generate multiple launches',
            details: error.message
        });
    }
});

export default router;