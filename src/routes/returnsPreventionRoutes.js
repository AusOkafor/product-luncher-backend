import express from 'express';
import { returnsPreventionService } from '../services/returnsPreventionService.js';
import { prisma } from '../db.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Predict return risk for an order
router.post('/predict-risk/:orderId', async(req, res) => {
    try {
        const { orderId } = req.params;

        const riskPrediction = await returnsPreventionService.predictReturnRisk(orderId);

        res.json({
            success: true,
            data: riskPrediction
        });
    } catch (error) {
        logger.error('Error predicting return risk:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to predict return risk'
        });
    }
});

// Generate pre-shipment advice
router.post('/pre-shipment-advice/:orderId', async(req, res) => {
    try {
        const { orderId } = req.params;

        const advice = await returnsPreventionService.generatePreShipmentAdvice(orderId);

        res.json({
            success: true,
            data: advice
        });
    } catch (error) {
        logger.error('Error generating pre-shipment advice:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate pre-shipment advice'
        });
    }
});

// Generate alternative recommendations
router.get('/alternatives/:orderId', async(req, res) => {
    try {
        const { orderId } = req.params;

        const alternatives = await returnsPreventionService.generateAlternativeRecommendations(orderId);

        res.json({
            success: true,
            data: alternatives
        });
    } catch (error) {
        logger.error('Error generating alternative recommendations:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate alternative recommendations'
        });
    }
});

// Optimize customer satisfaction
router.post('/optimize-satisfaction/:customerId', async(req, res) => {
    try {
        const { customerId } = req.params;

        const optimization = await returnsPreventionService.optimizeCustomerSatisfaction(customerId);

        res.json({
            success: true,
            data: optimization
        });
    } catch (error) {
        logger.error('Error optimizing customer satisfaction:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to optimize customer satisfaction'
        });
    }
});

// Get return risk statistics
router.get('/risk-stats/:storeId', async(req, res) => {
    try {
        const { storeId } = req.params;
        const { days = 30 } = req.query;

        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const riskStats = await prisma.returnRisk.groupBy({
            by: ['riskLevel'],
            where: {
                storeId,
                predictedAt: {
                    gte: startDate
                }
            },
            _count: {
                id: true
            }
        });

        const totalPredictions = riskStats.reduce((sum, stat) => sum + stat._count.id, 0);
        const highRiskStat = riskStats.find(s => s.riskLevel === 'HIGH');
        const mediumRiskStat = riskStats.find(s => s.riskLevel === 'MEDIUM');
        const lowRiskStat = riskStats.find(s => s.riskLevel === 'LOW');

        const highRiskCount = highRiskStat && highRiskStat._count.id || 0;
        const mediumRiskCount = mediumRiskStat && mediumRiskStat._count.id || 0;
        const lowRiskCount = lowRiskStat && lowRiskStat._count.id || 0;

        res.json({
            success: true,
            data: {
                totalPredictions,
                highRiskCount,
                mediumRiskCount,
                lowRiskCount,
                highRiskPercentage: totalPredictions > 0 ? (highRiskCount / totalPredictions) * 100 : 0,
                dateRange: `${days} days`
            }
        });
    } catch (error) {
        logger.error('Error getting return risk stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get return risk stats'
        });
    }
});

// Get pre-shipment advice history
router.get('/advice-history/:storeId', async(req, res) => {
    try {
        const { storeId } = req.params;
        const { days = 30 } = req.query;

        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const adviceHistory = await prisma.preShipmentAdvice.findMany({
            where: {
                storeId,
                generatedAt: {
                    gte: startDate
                }
            },
            include: {
                order: {
                    include: {
                        customer: true
                    }
                }
            },
            orderBy: {
                generatedAt: 'desc'
            }
        });

        res.json({
            success: true,
            data: {
                adviceHistory,
                totalAdvice: adviceHistory.length,
                dateRange: `${days} days`
            }
        });
    } catch (error) {
        logger.error('Error getting advice history:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get advice history'
        });
    }
});

// Get customer satisfaction scores
router.get('/satisfaction-scores/:storeId', async(req, res) => {
    try {
        const { storeId } = req.params;
        const { days = 30 } = req.query;

        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Get all customers for the store
        const customers = await prisma.customer.findMany({
            where: {
                orders: {
                    some: {
                        storeId,
                        createdAt: {
                            gte: startDate
                        }
                    }
                }
            },
            include: {
                orders: {
                    where: {
                        storeId,
                        createdAt: {
                            gte: startDate
                        }
                    },
                    include: {
                        items: true
                    }
                }
            }
        });

        const satisfactionScores = [];
        for (const customer of customers) {
            const satisfactionScore = await returnsPreventionService.calculateSatisfactionScore(customer);
            satisfactionScores.push({
                customerId: customer.id,
                customerName: `${customer.firstName} ${customer.lastName}`,
                satisfactionScore,
                orderCount: customer.orders.length
            });
        }

        const averageSatisfaction = satisfactionScores.length > 0 ?
            satisfactionScores.reduce((sum, score) => sum + score.satisfactionScore, 0) / satisfactionScores.length : 0;

        res.json({
            success: true,
            data: {
                satisfactionScores,
                averageSatisfaction,
                totalCustomers: satisfactionScores.length,
                dateRange: `${days} days`
            }
        });
    } catch (error) {
        logger.error('Error getting satisfaction scores:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get satisfaction scores'
        });
    }
});

// Bulk risk prediction for multiple orders
router.post('/bulk-risk-prediction', async(req, res) => {
    try {
        const { orderIds } = req.body;

        if (!Array.isArray(orderIds) || orderIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'orderIds array is required'
            });
        }

        const predictions = [];
        const errors = [];

        for (const orderId of orderIds) {
            try {
                const prediction = await returnsPreventionService.predictReturnRisk(orderId);
                predictions.push(prediction);
            } catch (error) {
                errors.push({
                    orderId,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            data: {
                predictions,
                errors,
                totalProcessed: orderIds.length,
                successful: predictions.length,
                failed: errors.length
            }
        });
    } catch (error) {
        logger.error('Error in bulk risk prediction:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process bulk risk prediction'
        });
    }
});

// Get return prevention insights
router.get('/insights/:storeId', async(req, res) => {
    try {
        const { storeId } = req.params;
        const { days = 30 } = req.query;

        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        // Get various insights
        const riskStats = await prisma.returnRisk.groupBy({
            by: ['riskLevel'],
            where: {
                storeId,
                predictedAt: {
                    gte: startDate
                }
            },
            _count: {
                id: true
            }
        });

        const adviceCount = await prisma.preShipmentAdvice.count({
            where: {
                storeId,
                generatedAt: {
                    gte: startDate
                }
            }
        });

        const totalOrders = await prisma.order.count({
            where: {
                storeId,
                createdAt: {
                    gte: startDate
                }
            }
        });

        const returnedOrders = await prisma.order.count({
            where: {
                storeId,
                status: 'RETURNED',
                createdAt: {
                    gte: startDate
                }
            }
        });

        const returnRate = totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0;
        const highRiskStat = riskStats.find(s => s.riskLevel === 'HIGH');

        res.json({
            success: true,
            data: {
                riskDistribution: riskStats,
                adviceGenerated: adviceCount,
                totalOrders,
                returnedOrders,
                returnRate,
                dateRange: `${days} days`,
                insights: {
                    highRiskOrders: highRiskStat && highRiskStat._count.id || 0,
                    preventionOpportunities: totalOrders - adviceCount,
                    potentialSavings: `${returnRate.toFixed(1)}% return rate`
                }
            }
        });
    } catch (error) {
        logger.error('Error getting return prevention insights:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get return prevention insights'
        });
    }
});

export default router;