import express from 'express';
import { ugcTrendSpotterService } from '../services/ugcTrendSpotterService.js';
import { prisma } from '../db.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Ingest UGC from social platforms
router.post('/ingest/:platform', async(req, res) => {
    try {
        const { platform } = req.params;
        const { hashtags = [], keywords = [], limit = 100 } = req.body;

        const ugcData = await ugcTrendSpotterService.ingestUGC(platform, {
            hashtags,
            keywords,
            limit
        });

        res.json({
            success: true,
            data: {
                platform,
                ingestedItems: ugcData.length,
                hashtags,
                keywords
            }
        });
    } catch (error) {
        logger.error(`Error ingesting UGC from ${req.params.platform}:`, error);
        res.status(500).json({
            success: false,
            error: `Failed to ingest UGC from ${req.params.platform}`
        });
    }
});

// Detect trending topics
router.get('/trends', async(req, res) => {
    try {
        const { days = 7, platform } = req.query;

        const trendingTopics = await ugcTrendSpotterService.detectTrendingTopics(parseInt(days), platform);

        res.json({
            success: true,
            data: {
                trendingTopics,
                totalTrends: trendingTopics.length,
                dateRange: `${days} days`,
                platform: platform || 'all'
            }
        });
    } catch (error) {
        logger.error('Error detecting trending topics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to detect trending topics'
        });
    }
});

// Generate content hook suggestions
router.post('/content-hooks/:productId', async(req, res) => {
    try {
        const { productId } = req.params;
        const { platform = 'instagram' } = req.body;

        const contentHooks = await ugcTrendSpotterService.generateContentHookSuggestions(productId, platform);

        res.json({
            success: true,
            data: contentHooks
        });
    } catch (error) {
        logger.error('Error generating content hook suggestions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate content hook suggestions'
        });
    }
});

// Search similar content using embeddings
router.post('/search-similar', async(req, res) => {
    try {
        const { query, platform, limit = 10 } = req.body;

        if (!query) {
            return res.status(400).json({
                success: false,
                error: 'Query is required'
            });
        }

        const similarContent = await ugcTrendSpotterService.searchSimilarContent(query, platform, limit);

        res.json({
            success: true,
            data: {
                similarContent,
                totalResults: similarContent.length,
                query,
                platform: platform || 'all'
            }
        });
    } catch (error) {
        logger.error('Error searching similar content:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search similar content'
        });
    }
});

// Get UGC insights and analytics
router.get('/insights', async(req, res) => {
    try {
        const { days = 30, platform } = req.query;

        const insights = await ugcTrendSpotterService.getUGCInsights(parseInt(days), platform);

        res.json({
            success: true,
            data: {
                insights,
                dateRange: `${days} days`,
                platform: platform || 'all'
            }
        });
    } catch (error) {
        logger.error('Error getting UGC insights:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get UGC insights'
        });
    }
});

// Get UGC content by platform
router.get('/content/:platform', async(req, res) => {
    try {
        const { platform } = req.params;
        const { days = 30, limit = 50 } = req.query;

        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const ugcContent = await prisma.ugcContent.findMany({
            where: {
                platform,
                publishedAt: {
                    gte: startDate
                }
            },
            orderBy: {
                engagementScore: 'desc'
            },
            take: parseInt(limit)
        });

        res.json({
            success: true,
            data: {
                ugcContent,
                totalContent: ugcContent.length,
                platform,
                dateRange: `${days} days`
            }
        });
    } catch (error) {
        logger.error('Error getting UGC content:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get UGC content'
        });
    }
});

// Get content hooks for a product
router.get('/content-hooks/:productId', async(req, res) => {
    try {
        const { productId } = req.params;
        const { platform } = req.query;

        const whereClause = { productId };
        if (platform) {
            whereClause.platform = platform;
        }

        const contentHooks = await prisma.contentHook.findMany({
            where: whereClause,
            orderBy: {
                generatedAt: 'desc'
            }
        });

        res.json({
            success: true,
            data: {
                contentHooks,
                totalHooks: contentHooks.length,
                productId,
                platform: platform || 'all'
            }
        });
    } catch (error) {
        logger.error('Error getting content hooks:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get content hooks'
        });
    }
});

// Get trending hashtags
router.get('/trending-hashtags', async(req, res) => {
    try {
        const { days = 7, platform } = req.query;

        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const whereClause = {
            publishedAt: {
                gte: startDate
            }
        };

        if (platform) {
            whereClause.platform = platform;
        }

        const ugcData = await prisma.ugcContent.findMany({
            where: whereClause,
            select: {
                hashtags: true,
                engagementScore: true
            }
        });

        // Aggregate hashtag usage and engagement
        const hashtagStats = new Map();

        ugcData.forEach(item => {
            if (item.hashtags) {
                item.hashtags.forEach(hashtag => {
                    if (!hashtagStats.has(hashtag)) {
                        hashtagStats.set(hashtag, {
                            count: 0,
                            totalEngagement: 0,
                            averageEngagement: 0
                        });
                    }
                    const stats = hashtagStats.get(hashtag);
                    stats.count += 1;
                    stats.totalEngagement += item.engagementScore;
                });
            }
        });

        // Calculate averages and sort by engagement
        const trendingHashtags = Array.from(hashtagStats.entries())
            .map(([hashtag, stats]) => ({
                hashtag,
                count: stats.count,
                totalEngagement: stats.totalEngagement,
                averageEngagement: stats.totalEngagement / stats.count
            }))
            .sort((a, b) => b.averageEngagement - a.averageEngagement)
            .slice(0, 20);

        res.json({
            success: true,
            data: {
                trendingHashtags,
                totalHashtags: trendingHashtags.length,
                dateRange: `${days} days`,
                platform: platform || 'all'
            }
        });
    } catch (error) {
        logger.error('Error getting trending hashtags:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get trending hashtags'
        });
    }
});

// Get platform comparison
router.get('/platform-comparison', async(req, res) => {
    try {
        const { days = 30 } = req.query;

        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const platformStats = await prisma.ugcContent.groupBy({
            by: ['platform'],
            where: {
                publishedAt: {
                    gte: startDate
                }
            },
            _count: {
                id: true
            },
            _avg: {
                engagementScore: true,
                likes: true,
                comments: true,
                shares: true
            }
        });

        const comparison = platformStats.map(stat => ({
            platform: stat.platform,
            totalContent: stat._count.id,
            averageEngagement: stat._avg.engagementScore,
            averageLikes: stat._avg.likes,
            averageComments: stat._avg.comments,
            averageShares: stat._avg.shares
        }));

        res.json({
            success: true,
            data: {
                platformComparison: comparison,
                dateRange: `${days} days`
            }
        });
    } catch (error) {
        logger.error('Error getting platform comparison:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get platform comparison'
        });
    }
});

// Bulk UGC ingestion
router.post('/bulk-ingest', async(req, res) => {
    try {
        const { platforms = ['instagram', 'tiktok', 'twitter'] } = req.body;

        const results = [];
        const errors = [];

        for (const platform of platforms) {
            try {
                const ugcData = await ugcTrendSpotterService.ingestUGC(platform, {
                    limit: 50
                });
                results.push({
                    platform,
                    ingestedItems: ugcData.length,
                    success: true
                });
            } catch (error) {
                errors.push({
                    platform,
                    error: error.message,
                    success: false
                });
            }
        }

        res.json({
            success: true,
            data: {
                results,
                errors,
                totalPlatforms: platforms.length,
                successful: results.length,
                failed: errors.length
            }
        });
    } catch (error) {
        logger.error('Error in bulk UGC ingestion:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process bulk UGC ingestion'
        });
    }
});

export default router;