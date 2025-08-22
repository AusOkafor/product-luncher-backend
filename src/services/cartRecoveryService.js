import { prisma } from '../db.js';
import { aiService } from './ai.js';
import { logger } from '../utils/logger.js';
import twilio from 'twilio';

class CartRecoveryService {
    constructor() {
        this.twilioClient = null;
        this.initializeTwilio();
        this.initializeAI();
    }

    async initializeAI() {
        try {
            await aiService.initialize();
            logger.info('AI service initialized for Cart Recovery');
        } catch (error) {
            logger.error('Error initializing AI service for Cart Recovery:', error);
        }
    }

    async initializeTwilio() {
        try {
            if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
                this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                logger.info('Twilio client initialized');
            } else {
                logger.warn('Twilio credentials not found. SMS/WhatsApp features will be disabled.');
            }
        } catch (error) {
            logger.error('Error initializing Twilio:', error);
        }
    }

    // Detect abandoned carts
    async detectAbandonedCarts(storeId, abandonmentThreshold = 30) {
        try {
            const abandonedCarts = await prisma.cart.findMany({
                where: {
                    storeId,
                    status: 'ACTIVE',
                    updatedAt: {
                        lt: new Date(Date.now() - abandonmentThreshold * 60 * 1000) // minutes ago
                    }
                },
                include: {
                    customer: true,
                    store: {
                        include: {
                            workspace: true
                        }
                    }
                }
            });

            logger.info(`Detected ${abandonedCarts.length} abandoned carts for store: ${storeId}`);
            return abandonedCarts;
        } catch (error) {
            logger.error('Error detecting abandoned carts:', error);
            throw error;
        }
    }

    // Generate conversational recovery message
    async generateRecoveryMessage(cart, options = {}) {
            try {
                const cartItems = Array.isArray(cart.items) ? cart.items : JSON.parse(cart.items);
                const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
                const totalValue = parseFloat(cart.subtotal);

                const prompt = `
Generate a conversational cart recovery message for this abandoned cart:

Cart Details:
- Total Items: ${totalItems}
- Cart Value: $${totalValue}
- Items: ${cartItems.map(item => `Product (${item.quantity}x - $${item.price})`).join(', ')}

Customer: ${cart.customer ? `${cart.customer.firstName} ${cart.customer.lastName}` : 'Guest'}
Store: ${cart.store ? cart.store.name : 'Our Store'}

Generate:
1. A friendly, conversational opening (personalized if possible)
2. Reminder about their cart items
3. Urgency/limited time offer
4. Incentive suggestion (discount, free shipping, etc.)
5. Clear call-to-action
6. Closing with appreciation

Tone: Friendly, helpful, not pushy
Platform: ${options.platform || 'WhatsApp'}
Message Length: ${options.platform === 'SMS' ? '160 characters max' : '280 characters max'}

Make it feel personal and conversational, not like a generic marketing message.
            `;

            const response = await aiService.generateText(prompt, {
                model: 'mistralai/Mistral-7B-Instruct-v0.1',
                maxTokens: 300,
                temperature: 0.8
            });

            return {
                message: response.text,
                cartId: cart.id,
                customerId: cart.customerId,
                storeId: cart.storeId,
                totalValue,
                totalItems,
                items: cartItems
            };
        } catch (error) {
            logger.error('Error generating recovery message:', error);
            throw error;
        }
    }

    // Generate incentive offer
    async generateIncentive(cart, options = {}) {
        try {
            const totalValue = parseFloat(cart.subtotal);
            
            // Smart incentive logic based on cart value
            let incentive;
            if (totalValue >= 100) {
                incentive = {
                    type: 'PERCENTAGE_DISCOUNT',
                    value: 15,
                    code: `SAVE15${Date.now().toString().slice(-4)}`,
                    description: '15% off your order'
                };
            } else if (totalValue >= 50) {
                incentive = {
                    type: 'PERCENTAGE_DISCOUNT',
                    value: 10,
                    code: `SAVE10${Date.now().toString().slice(-4)}`,
                    description: '10% off your order'
                };
            } else {
                incentive = {
                    type: 'FREE_SHIPPING',
                    value: 0,
                    code: `FREESHIP${Date.now().toString().slice(-4)}`,
                    description: 'Free shipping on your order'
                };
            }

            // Add urgency
            incentive.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            incentive.cartId = cart.id;

            return incentive;
        } catch (error) {
            logger.error('Error generating incentive:', error);
            throw error;
        }
    }

    // Send recovery message via WhatsApp/SMS
    async sendRecoveryMessage(cart, message, incentive = null, platform = 'whatsapp') {
        try {
            if (!this.twilioClient) {
                logger.warn('Twilio not configured. Message would be sent in production.');
                return { success: true, message: 'Message queued (Twilio not configured)' };
            }

            if (!cart.customer || !cart.customer.phone) {
                logger.warn('No phone number for customer');
                return { success: false, message: 'No phone number available' };
            }

            let fullMessage = message;
            if (incentive) {
                fullMessage += `\n\n🎉 Special Offer: ${incentive.description}`;
                fullMessage += `\nUse code: ${incentive.code}`;
                fullMessage += `\nExpires: ${incentive.expiresAt.toLocaleString()}`;
            }

            const messageData = {
                body: fullMessage,
                from: platform === 'whatsapp' 
                    ? `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`
                    : process.env.TWILIO_PHONE_NUMBER,
                to: platform === 'whatsapp'
                    ? `whatsapp:${cart.customer.phone}`
                    : cart.customer.phone
            };

            const twilioResponse = await this.twilioClient.messages.create(messageData);

            // Log the recovery attempt
            await prisma.abandonedCart.create({
                data: {
                    cartId: cart.id,
                    customerId: cart.customerId,
                    storeId: cart.storeId,
                    message: fullMessage,
                    incentive: incentive,
                    platform,
                    status: 'SENT',
                    twilioMessageId: twilioResponse.sid,
                    sentAt: new Date()
                }
            });

            logger.info(`Recovery message sent via ${platform}: ${twilioResponse.sid}`);
            return { success: true, messageId: twilioResponse.sid };
        } catch (error) {
            logger.error('Error sending recovery message:', error);
            throw error;
        }
    }

    // Process abandoned cart recovery
    async processAbandonedCart(cart, options = {}) {
        try {
            // Generate recovery message
            const recoveryMessage = await this.generateRecoveryMessage(cart, options);
            
            // Generate incentive
            const incentive = await this.generateIncentive(cart, options);
            
            // Send message
            const result = await this.sendRecoveryMessage(
                cart, 
                recoveryMessage.message, 
                incentive, 
                options.platform || 'whatsapp'
            );

            return {
                success: result.success,
                recoveryMessage,
                incentive,
                messageId: result.messageId
            };
        } catch (error) {
            logger.error('Error processing abandoned cart:', error);
            throw error;
        }
    }

    // Get recovery statistics
    async getRecoveryStats(storeId, days = 30) {
        try {
            const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            
            const stats = await prisma.abandonedCart.groupBy({
                by: ['status'],
                where: {
                    storeId,
                    sentAt: {
                        gte: startDate
                    }
                },
                _count: {
                    id: true
                }
            });

            const totalSent = stats.reduce((sum, stat) => sum + stat._count.id, 0);
            const recoveredStat = stats.find(s => s.status === 'RECOVERED');
        const totalRecovered = recoveredStat && recoveredStat._count.id || 0;
            const recoveryRate = totalSent > 0 ? (totalRecovered / totalSent) * 100 : 0;

            return {
                totalSent,
                totalRecovered,
                recoveryRate: Math.round(recoveryRate * 100) / 100,
                breakdown: stats
            };
        } catch (error) {
            logger.error('Error getting recovery stats:', error);
            throw error;
        }
    }

    // Mark cart as recovered
    async markCartRecovered(cartId, orderId = null) {
        try {
            await prisma.abandonedCart.updateMany({
                where: { cartId },
                data: {
                    status: 'RECOVERED',
                    recoveredAt: new Date(),
                    orderId
                }
            });

            // Update cart status
            await prisma.cart.update({
                where: { id: cartId },
                data: { status: 'RECOVERED' }
            });

            logger.info(`Cart ${cartId} marked as recovered`);
        } catch (error) {
            logger.error('Error marking cart as recovered:', error);
            throw error;
        }
    }
}

export const cartRecoveryService = new CartRecoveryService();