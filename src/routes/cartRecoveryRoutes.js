import express from 'express';
import { cartRecoveryService } from '../services/cartRecoveryService.js';
import { prisma } from '../db.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Get abandoned carts for a store
router.get('/stores/:storeId/abandoned-carts', async(req, res) => {
    try {
        const { storeId } = req.params;
        const { threshold = 30 } = req.query;

        const abandonedCarts = await cartRecoveryService.detectAbandonedCarts(storeId, parseInt(threshold));

        res.json({
            success: true,
            data: {
                abandonedCarts,
                count: abandonedCarts.length,
                threshold: parseInt(threshold)
            }
        });
    } catch (error) {
        logger.error('Error getting abandoned carts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get abandoned carts'
        });
    }
});

// Generate recovery message for a cart
router.post('/carts/:cartId/recovery-message', async(req, res) => {
    try {
        const { cartId } = req.params;
        const { platform = 'whatsapp', options = {} } = req.body;

        // Get cart with customer and store info
        const cart = await prisma.cart.findUnique({
            where: { id: cartId },
            include: {
                customer: true,
                store: {
                    include: {
                        workspace: true
                    }
                }
            }
        });

        if (!cart) {
            return res.status(404).json({
                success: false,
                error: 'Cart not found'
            });
        }

        const recoveryMessage = await cartRecoveryService.generateRecoveryMessage(cart, {
            platform,
            ...options
        });

        res.json({
            success: true,
            data: recoveryMessage
        });
    } catch (error) {
        logger.error('Error generating recovery message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate recovery message'
        });
    }
});

// Generate incentive for a cart
router.post('/carts/:cartId/incentive', async(req, res) => {
    try {
        const { cartId } = req.params;
        const { options = {} } = req.body;

        const cart = await prisma.cart.findUnique({
            where: { id: cartId },
            include: {
                customer: true,
                store: {
                    include: {
                        workspace: true
                    }
                }
            }
        });

        if (!cart) {
            return res.status(404).json({
                success: false,
                error: 'Cart not found'
            });
        }

        const incentive = await cartRecoveryService.generateIncentive(cart, options);

        res.json({
            success: true,
            data: incentive
        });
    } catch (error) {
        logger.error('Error generating incentive:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate incentive'
        });
    }
});

// Send recovery message
router.post('/carts/:cartId/send-recovery', async(req, res) => {
    try {
        const { cartId } = req.params;
        const { platform = 'whatsapp', options = {} } = req.body;

        const cart = await prisma.cart.findUnique({
            where: { id: cartId },
            include: {
                customer: true,
                store: {
                    include: {
                        workspace: true
                    }
                }
            }
        });

        if (!cart) {
            return res.status(404).json({
                success: false,
                error: 'Cart not found'
            });
        }

        const result = await cartRecoveryService.processAbandonedCart(cart, {
            platform,
            ...options
        });

        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Error sending recovery message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to send recovery message'
        });
    }
});

// Get recovery statistics
router.get('/stores/:storeId/recovery-stats', async(req, res) => {
    try {
        const { storeId } = req.params;
        const { days = 30 } = req.query;

        const stats = await cartRecoveryService.getRecoveryStats(storeId, parseInt(days));

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        logger.error('Error getting recovery stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get recovery stats'
        });
    }
});

// Mark cart as recovered
router.post('/carts/:cartId/mark-recovered', async(req, res) => {
    try {
        const { cartId } = req.params;
        const { orderId } = req.body;

        await cartRecoveryService.markCartRecovered(cartId, orderId);

        res.json({
            success: true,
            message: 'Cart marked as recovered'
        });
    } catch (error) {
        logger.error('Error marking cart as recovered:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to mark cart as recovered'
        });
    }
});

// Bulk process abandoned carts
router.post('/stores/:storeId/process-abandoned-carts', async(req, res) => {
    try {
        const { storeId } = req.params;
        const { threshold = 30, platform = 'whatsapp', limit = 10 } = req.body;

        const abandonedCarts = await cartRecoveryService.detectAbandonedCarts(storeId, threshold);
        const cartsToProcess = abandonedCarts.slice(0, limit);

        const results = [];
        for (const cart of cartsToProcess) {
            try {
                const result = await cartRecoveryService.processAbandonedCart(cart, { platform });
                results.push({
                    cartId: cart.id,
                    success: result.success,
                    messageId: result.messageId
                });
            } catch (error) {
                results.push({
                    cartId: cart.id,
                    success: false,
                    error: error.message
                });
            }
        }

        res.json({
            success: true,
            data: {
                processed: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                results
            }
        });
    } catch (error) {
        logger.error('Error processing abandoned carts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process abandoned carts'
        });
    }
});

export default router;