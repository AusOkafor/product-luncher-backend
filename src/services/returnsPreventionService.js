import { prisma } from '../db.js';
import { aiService } from './ai.js';
import { logger } from '../utils/logger.js';

class ReturnsPreventionService {
    constructor() {
        this.riskFactors = {
            SIZE_MISMATCH: 0.3,
            COLOR_DISCREPANCY: 0.25,
            QUALITY_ISSUES: 0.2,
            EXPECTATION_GAP: 0.15,
            DELIVERY_DELAY: 0.1
        };
    }

    // Predict return risk for an order
    async predictReturnRisk(orderId) {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    items: true,
                    customer: true,
                    store: true
                }
            });

            if (!order) {
                throw new Error('Order not found');
            }

            // Calculate risk score based on multiple factors
            const riskFactors = await this.analyzeRiskFactors(order);
            const riskScore = this.calculateRiskScore(riskFactors);
            const riskLevel = this.categorizeRiskLevel(riskScore);

            // Store risk prediction
            const riskPrediction = await prisma.returnRisk.create({
                data: {
                    orderId: order.id,
                    customerId: order.customerId,
                    storeId: order.storeId,
                    riskScore,
                    riskLevel,
                    riskFactors,
                    predictedAt: new Date(),
                    status: 'PREDICTED'
                }
            });

            logger.info(`Return risk predicted for order ${orderId}: ${riskLevel} (${riskScore.toFixed(2)})`);
            return {
                riskPrediction,
                riskScore,
                riskLevel,
                riskFactors,
                recommendations: await this.generateSpecificRecommendations(order, { riskLevel, riskFactors })
            };
        } catch (error) {
            logger.error('Error predicting return risk:', error);
            throw error;
        }
    }

    // Analyze risk factors for an order
    async analyzeRiskFactors(order) {
        const factors = {};

        // Customer history analysis
        const customerHistory = await this.analyzeCustomerHistory(order.customerId);
        factors.customerReturnRate = customerHistory.returnRate;
        factors.customerOrderCount = customerHistory.orderCount;

        // Product-specific risk factors
        const productRisks = await this.analyzeProductRisks(order.items);
        factors.productRisk = productRisks.averageRisk;
        factors.sizeRisk = productRisks.sizeRisk;
        factors.colorRisk = productRisks.colorRisk;

        // Order characteristics
        factors.orderValue = parseFloat(order.total);
        factors.itemCount = order.items.length;
        factors.isFirstTimeCustomer = customerHistory.orderCount === 1;

        // Seasonal and timing factors
        factors.seasonalRisk = this.calculateSeasonalRisk();
        factors.deliveryRisk = this.calculateDeliveryRisk(order);

        return factors;
    }

    // Analyze customer return history
    async analyzeCustomerHistory(customerId) {
        try {
            const customerOrders = await prisma.order.findMany({
                where: { customerId },
                include: {
                    items: true
                }
            });

            const totalOrders = customerOrders.length;
            const returnedOrders = customerOrders.filter(order =>
                order.status === 'RETURNED' || (order.metadata && order.metadata.returned)
            ).length;

            const returnRate = totalOrders > 0 ? returnedOrders / totalOrders : 0;

            return {
                orderCount: totalOrders,
                returnRate,
                averageOrderValue: customerOrders.reduce((sum, order) =>
                    sum + parseFloat(order.total), 0) / totalOrders || 0
            };
        } catch (error) {
            logger.error('Error analyzing customer history:', error);
            return { orderCount: 0, returnRate: 0, averageOrderValue: 0 };
        }
    }

    // Analyze product-specific risks
    async analyzeProductRisks(items) {
        const risks = {
            sizeRisk: 0,
            colorRisk: 0,
            qualityRisk: 0,
            averageRisk: 0
        };

        for (const item of items) {
            // Size risk for clothing items
            if ((item.category && item.category.toLowerCase().includes('clothing')) ||
                (item.title && item.title.toLowerCase().includes('shirt')) ||
                (item.title && item.title.toLowerCase().includes('dress'))) {
                risks.sizeRisk += 0.3;
            }

            // Color risk for items with specific colors
            if ((item.title && item.title.toLowerCase().includes('teal')) ||
                (item.title && item.title.toLowerCase().includes('blue')) ||
                (item.title && item.title.toLowerCase().includes('red'))) {
                risks.colorRisk += 0.2;
            }

            // Quality risk based on price point
            const price = parseFloat(item.price);
            if (price < 20) {
                risks.qualityRisk += 0.1;
            } else if (price > 100) {
                risks.qualityRisk += 0.2;
            }
        }

        risks.averageRisk = (risks.sizeRisk + risks.colorRisk + risks.qualityRisk) / items.length;
        return risks;
    }

    // Calculate seasonal risk
    calculateSeasonalRisk() {
        const month = new Date().getMonth();
        const seasonalFactors = {
            11: 0.3, // December - holiday returns
            0: 0.25, // January - post-holiday returns
            8: 0.2, // September - back to school
            5: 0.15 // June - summer returns
        };

        return seasonalFactors[month] || 0.1;
    }

    // Calculate delivery risk
    calculateDeliveryRisk(order) {
        // Simulate delivery risk based on order characteristics
        const baseRisk = 0.1;
        const valueRisk = parseFloat(order.total) > 100 ? 0.2 : 0;
        const itemCountRisk = order.items.length > 3 ? 0.15 : 0;

        return baseRisk + valueRisk + itemCountRisk;
    }

    // Calculate overall risk score
    calculateRiskScore(factors) {
        let score = 0;

        // Customer factors (30% weight)
        score += factors.customerReturnRate * 0.3;
        score += (factors.isFirstTimeCustomer ? 0.1 : 0) * 0.3;

        // Product factors (40% weight)
        score += factors.productRisk * 0.4;
        score += factors.sizeRisk * 0.4;
        score += factors.colorRisk * 0.4;

        // Order factors (20% weight)
        score += (factors.orderValue > 100 ? 0.2 : 0) * 0.2;
        score += (factors.itemCount > 3 ? 0.15 : 0) * 0.2;

        // Environmental factors (10% weight)
        score += factors.seasonalRisk * 0.1;
        score += factors.deliveryRisk * 0.1;

        return Math.min(score, 1.0); // Cap at 1.0
    }

    // Categorize risk level
    categorizeRiskLevel(riskScore) {
        if (riskScore >= 0.7) return 'HIGH';
        if (riskScore >= 0.4) return 'MEDIUM';
        return 'LOW';
    }

    // Generate pre-shipment advice
    async generatePreShipmentAdvice(orderId) {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    items: true,
                    customer: true
                }
            });

            if (!order) {
                throw new Error('Order not found');
            }

            const riskPrediction = await this.predictReturnRisk(orderId);
            const advice = await this.generateAdviceContent(order, riskPrediction);

            // Store advice
            const storedAdvice = await prisma.preShipmentAdvice.create({
                data: {
                    orderId: order.id,
                    customerId: order.customerId,
                    riskLevel: riskPrediction.riskLevel,
                    advice: advice.content,
                    recommendations: advice.recommendations,
                    generatedAt: new Date(),
                    status: 'GENERATED'
                }
            });

            return {
                advice: storedAdvice,
                riskPrediction,
                content: advice.content,
                recommendations: advice.recommendations
            };
        } catch (error) {
            logger.error('Error generating pre-shipment advice:', error);
            throw error;
        }
    }

    // Generate advice content using AI
    async generateAdviceContent(order, riskPrediction) {
            try {
                const items = order.items.map(item =>
                    `${item.title} (${item.quantity}x) - $${item.price}`
                ).join(', ');

                const prompt = `
Generate pre-shipment advice for this order to reduce return risk:

Order Details:
- Customer: ${order.customer && order.customer.firstName || 'Guest'}
- Items: ${items}
- Total: $${order.total}
- Risk Level: ${riskPrediction.riskLevel} (${(riskPrediction.riskScore * 100).toFixed(1)}%)

Risk Factors:
${Object.entries(riskPrediction.riskFactors).map(([factor, value]) => 
    `- ${factor}: ${typeof value === 'number' ? (value * 100).toFixed(1) + '%' : value}`
).join('\n')}

Generate:
1. Personalized pre-shipment message
2. Size/fit recommendations
3. Care instructions
4. What to expect
5. Contact information for questions
6. Return policy reminder

Tone: Helpful, reassuring, professional
Goal: Reduce returns by setting proper expectations
            `;

            const response = await aiService.generateText(prompt, {
                model: 'mistralai/Mistral-7B-Instruct-v0.1',
                maxTokens: 500,
                temperature: 0.7
            });

            const recommendations = await this.generateSpecificRecommendations(order, riskPrediction);

            return {
                content: response.text,
                recommendations
            };
        } catch (error) {
            logger.error('Error generating advice content:', error);
            throw error;
        }
    }

    // Generate specific recommendations
    async generateSpecificRecommendations(order, riskPrediction) {
        const recommendations = [];

        // Size recommendations for clothing
        const clothingItems = order.items.filter(item => 
            (item.category && item.category.toLowerCase().includes('clothing')) ||
            (item.title && item.title.toLowerCase().includes('shirt')) ||
            (item.title && item.title.toLowerCase().includes('dress'))
        );

        if (clothingItems.length > 0) {
            recommendations.push({
                type: 'SIZE_GUIDE',
                title: 'Size Guide',
                description: 'Check our size guide for accurate measurements',
                priority: 'HIGH'
            });
        }

        // Color recommendations
        const coloredItems = order.items.filter(item =>
            (item.title && item.title.toLowerCase().includes('teal')) ||
            (item.title && item.title.toLowerCase().includes('blue')) ||
            (item.title && item.title.toLowerCase().includes('red'))
        );

        if (coloredItems.length > 0) {
            recommendations.push({
                type: 'COLOR_INFO',
                title: 'Color Information',
                description: 'Colors may vary slightly due to monitor settings',
                priority: 'MEDIUM'
            });
        }

        // First-time customer recommendations
        if (riskPrediction.riskFactors.isFirstTimeCustomer) {
            recommendations.push({
                type: 'WELCOME',
                title: 'Welcome Gift',
                description: 'Consider adding a welcome note or small gift',
                priority: 'HIGH'
            });
        }

        // High-value order recommendations
        if (parseFloat(order.total) > 100) {
            recommendations.push({
                type: 'PREMIUM_SERVICE',
                title: 'Premium Service',
                description: 'Offer expedited shipping or premium packaging',
                priority: 'MEDIUM'
            });
        }

        return recommendations;
    }

    // Generate alternative recommendations
    async generateAlternativeRecommendations(orderId) {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    items: true,
                    customer: true
                }
            });

            if (!order) {
                throw new Error('Order not found');
            }

            const alternatives = [];

            for (const item of order.items) {
                const itemAlternatives = await this.findProductAlternatives(item);
                alternatives.push({
                    originalItem: item,
                    alternatives: itemAlternatives
                });
            }

            return alternatives;
        } catch (error) {
            logger.error('Error generating alternative recommendations:', error);
            throw error;
        }
    }

    // Find product alternatives
    async findProductAlternatives(item) {
        try {
            // Find similar products in the same category
            const alternatives = await prisma.product.findMany({
                where: {
                    category: item.category,
                    id: { not: item.id },
                    status: 'ACTIVE'
                },
                take: 3,
                orderBy: {
                    price: 'asc'
                }
            });

            return alternatives.map(alt => ({
                id: alt.id,
                title: alt.title,
                price: alt.price,
                image: alt.images && alt.images[0],
                reason: this.generateAlternativeReason(item, alt)
            }));
        } catch (error) {
            logger.error('Error finding product alternatives:', error);
            return [];
        }
    }

    // Generate reason for alternative recommendation
    generateAlternativeReason(originalItem, alternative) {
        const originalPrice = parseFloat(originalItem.price);
        const altPrice = parseFloat(alternative.price);

        if (altPrice < originalPrice * 0.8) {
            return 'More affordable option';
        } else if (altPrice > originalPrice * 1.2) {
            return 'Premium alternative';
        } else {
            return 'Similar style, different option';
        }
    }

    // Optimize customer satisfaction
    async optimizeCustomerSatisfaction(customerId) {
        try {
            const customer = await prisma.customer.findUnique({
                where: { id: customerId },
                include: {
                    orders: {
                        include: {
                            items: true
                        }
                    }
                }
            });

            if (!customer) {
                throw new Error('Customer not found');
            }

            const satisfactionScore = await this.calculateSatisfactionScore(customer);
            const optimizationStrategies = await this.generateOptimizationStrategies(customer, satisfactionScore);

            return {
                customerId,
                satisfactionScore,
                strategies: optimizationStrategies,
                recommendations: await this.generateSatisfactionRecommendations(customer, satisfactionScore)
            };
        } catch (error) {
            logger.error('Error optimizing customer satisfaction:', error);
            throw error;
        }
    }

    // Calculate customer satisfaction score
    async calculateSatisfactionScore(customer) {
        const orders = customer.orders;
        if (orders.length === 0) return 0.5; // Neutral for new customers

        let score = 0;
        let totalWeight = 0;

        for (const order of orders) {
            const orderAge = (Date.now() - new Date(order.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 365); // years
            const weight = Math.exp(-orderAge); // Recent orders weighted more

            // Calculate order satisfaction based on various factors
            const orderSatisfaction = this.calculateOrderSatisfaction(order);
            score += orderSatisfaction * weight;
            totalWeight += weight;
        }

        return totalWeight > 0 ? score / totalWeight : 0.5;
    }

    // Calculate order satisfaction
    calculateOrderSatisfaction(order) {
        let satisfaction = 0.7; // Base satisfaction

        // Adjust based on order status
        if (order.status === 'COMPLETED') satisfaction += 0.2;
        if (order.status === 'RETURNED') satisfaction -= 0.3;

        // Adjust based on order value
        const orderValue = parseFloat(order.total);
        if (orderValue > 100) satisfaction += 0.1;
        if (orderValue < 20) satisfaction -= 0.1;

        // Adjust based on item count
        if (order.items.length > 3) satisfaction += 0.05;

        return Math.max(0, Math.min(1, satisfaction));
    }

    // Generate optimization strategies
    async generateOptimizationStrategies(customer, satisfactionScore) {
        const strategies = [];

        if (satisfactionScore < 0.6) {
            strategies.push({
                type: 'RETENTION',
                title: 'Customer Retention Program',
                description: 'Implement loyalty program and personalized offers',
                priority: 'HIGH'
            });
        }

        if (customer.orders.length === 1) {
            strategies.push({
                type: 'SECOND_PURCHASE',
                title: 'Second Purchase Incentive',
                description: 'Offer discount on next purchase',
                priority: 'HIGH'
            });
        }

        if (satisfactionScore > 0.8) {
            strategies.push({
                type: 'REFERRAL',
                title: 'Referral Program',
                description: 'Encourage customer to refer friends',
                priority: 'MEDIUM'
            });
        }

        return strategies;
    }

    // Generate satisfaction recommendations
    async generateSatisfactionRecommendations(customer, satisfactionScore) {
        try {
            const prompt = `
Generate customer satisfaction recommendations for:

Customer: ${customer.firstName} ${customer.lastName}
Satisfaction Score: ${(satisfactionScore * 100).toFixed(1)}%
Order Count: ${customer.orders.length}
Average Order Value: $${customer.orders.reduce((sum, order) => sum + parseFloat(order.total), 0) / customer.orders.length || 0}

Generate 3-5 specific recommendations to improve customer satisfaction and reduce return likelihood.
            `;

            const response = await aiService.generateText(prompt, {
                model: 'mistralai/Mistral-7B-Instruct-v0.1',
                maxTokens: 300,
                temperature: 0.7
            });

            return response.text;
        } catch (error) {
            logger.error('Error generating satisfaction recommendations:', error);
            return 'Focus on personalized communication and quality assurance.';
        }
    }
}

export const returnsPreventionService = new ReturnsPreventionService();