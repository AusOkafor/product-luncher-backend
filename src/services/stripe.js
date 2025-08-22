import Stripe from 'stripe';
import { logger } from '../utils/logger.js';
import { prisma } from '../db.js';

class StripeService {
    constructor() {
        this.stripe = null;
        this.webhookSecret = null;
    }

    async initialize() {
        try {
            const secretKey = process.env.STRIPE_SECRET_KEY;
            this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

            if (!secretKey) {
                logger.warn('Stripe secret key not found, Stripe service disabled');
                return;
            }

            this.stripe = new Stripe(secretKey, {
                apiVersion: '2024-06-20',
            });

            logger.info('Stripe service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize Stripe service:', error);
            throw error;
        }
    }

    // Create a customer
    async createCustomer(userData) {
        try {
            const customer = await this.stripe.customers.create({
                email: userData.email,
                name: `${userData.firstName} ${userData.lastName}`.trim(),
                metadata: {
                    userId: userData.id,
                    workspaceId: userData.workspaceId,
                },
            });

            // Store Stripe customer ID in database
            await prisma.billingCustomer.create({
                data: {
                    workspaceId: userData.workspaceId,
                    stripeCustomerId: customer.id,
                    email: userData.email,
                },
            });

            logger.info(`Stripe customer created: ${customer.id}`);
            return customer;
        } catch (error) {
            logger.error('Error creating Stripe customer:', error);
            throw error;
        }
    }

    // Create a subscription
    async createSubscription(customerId, priceId, metadata = {}) {
        try {
            const subscription = await this.stripe.subscriptions.create({
                customer: customerId,
                items: [{ price: priceId }],
                payment_behavior: 'default_incomplete',
                payment_settings: { save_default_payment_method: 'on_subscription' },
                expand: ['latest_invoice.payment_intent'],
                metadata,
            });

            logger.info(`Stripe subscription created: ${subscription.id}`);
            return subscription;
        } catch (error) {
            logger.error('Error creating Stripe subscription:', error);
            throw error;
        }
    }

    // Create a checkout session
    async createCheckoutSession(customerId, priceId, successUrl, cancelUrl, metadata = {}) {
        try {
            const session = await this.stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                line_items: [{
                    price: priceId,
                    quantity: 1,
                }, ],
                mode: 'subscription',
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata,
            });

            logger.info(`Stripe checkout session created: ${session.id}`);
            return session;
        } catch (error) {
            logger.error('Error creating Stripe checkout session:', error);
            throw error;
        }
    }

    // Create a payment intent
    async createPaymentIntent(amount, currency = 'usd', customerId = null, metadata = {}) {
        try {
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount,
                currency,
                customer: customerId,
                metadata,
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            logger.info(`Stripe payment intent created: ${paymentIntent.id}`);
            return paymentIntent;
        } catch (error) {
            logger.error('Error creating Stripe payment intent:', error);
            throw error;
        }
    }

    // Get customer
    async getCustomer(customerId) {
        try {
            const customer = await this.stripe.customers.retrieve(customerId);
            return customer;
        } catch (error) {
            logger.error('Error retrieving Stripe customer:', error);
            throw error;
        }
    }

    // Get subscription
    async getSubscription(subscriptionId) {
        try {
            const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
            return subscription;
        } catch (error) {
            logger.error('Error retrieving Stripe subscription:', error);
            throw error;
        }
    }

    // Cancel subscription
    async cancelSubscription(subscriptionId, cancelAtPeriodEnd = true) {
        try {
            const subscription = await this.stripe.subscriptions.update(subscriptionId, {
                cancel_at_period_end: cancelAtPeriodEnd,
            });

            logger.info(`Stripe subscription ${cancelAtPeriodEnd ? 'scheduled for cancellation' : 'cancelled'}: ${subscriptionId}`);
            return subscription;
        } catch (error) {
            logger.error('Error cancelling Stripe subscription:', error);
            throw error;
        }
    }

    // Update subscription
    async updateSubscription(subscriptionId, updates) {
        try {
            const subscription = await this.stripe.subscriptions.update(subscriptionId, updates);
            logger.info(`Stripe subscription updated: ${subscriptionId}`);
            return subscription;
        } catch (error) {
            logger.error('Error updating Stripe subscription:', error);
            throw error;
        }
    }

    // Create invoice
    async createInvoice(customerId, items, metadata = {}) {
        try {
            const invoice = await this.stripe.invoices.create({
                customer: customerId,
                items,
                metadata,
            });

            logger.info(`Stripe invoice created: ${invoice.id}`);
            return invoice;
        } catch (error) {
            logger.error('Error creating Stripe invoice:', error);
            throw error;
        }
    }

    // Send invoice
    async sendInvoice(invoiceId) {
        try {
            const invoice = await this.stripe.invoices.sendInvoice(invoiceId);
            logger.info(`Stripe invoice sent: ${invoiceId}`);
            return invoice;
        } catch (error) {
            logger.error('Error sending Stripe invoice:', error);
            throw error;
        }
    }

    // Handle webhook events
    async handleWebhook(payload, signature) {
        try {
            if (!this.webhookSecret) {
                throw new Error('Stripe webhook secret not configured');
            }

            const event = this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
            logger.info(`Stripe webhook received: ${event.type}`);

            switch (event.type) {
                case 'customer.subscription.created':
                    await this._handleSubscriptionCreated(event.data.object);
                    break;

                case 'customer.subscription.updated':
                    await this._handleSubscriptionUpdated(event.data.object);
                    break;

                case 'customer.subscription.deleted':
                    await this._handleSubscriptionDeleted(event.data.object);
                    break;

                case 'invoice.payment_succeeded':
                    await this._handleInvoicePaymentSucceeded(event.data.object);
                    break;

                case 'invoice.payment_failed':
                    await this._handleInvoicePaymentFailed(event.data.object);
                    break;

                case 'payment_intent.succeeded':
                    await this._handlePaymentIntentSucceeded(event.data.object);
                    break;

                case 'payment_intent.payment_failed':
                    await this._handlePaymentIntentFailed(event.data.object);
                    break;

                default:
                    logger.info(`Unhandled Stripe webhook event: ${event.type}`);
            }

            return event;
        } catch (error) {
            logger.error('Error handling Stripe webhook:', error);
            throw error;
        }
    }

    // Webhook handlers
    async _handleSubscriptionCreated(subscription) {
        try {
            await prisma.subscription.create({
                data: {
                    workspaceId: subscription.metadata.workspaceId,
                    plan: this._mapStripePriceToPlan(subscription.items.data[0].price.id),
                    status: subscription.status.toUpperCase(),
                    stripeSubscriptionId: subscription.id,
                    currentPeriodStart: new Date(subscription.current_period_start * 1000),
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                },
            });

            logger.info(`Subscription created in database: ${subscription.id}`);
        } catch (error) {
            logger.error('Error handling subscription created:', error);
        }
    }

    async _handleSubscriptionUpdated(subscription) {
        try {
            await prisma.subscription.update({
                where: { stripeSubscriptionId: subscription.id },
                data: {
                    status: subscription.status.toUpperCase(),
                    currentPeriodStart: new Date(subscription.current_period_start * 1000),
                    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
                },
            });

            logger.info(`Subscription updated in database: ${subscription.id}`);
        } catch (error) {
            logger.error('Error handling subscription updated:', error);
        }
    }

    async _handleSubscriptionDeleted(subscription) {
        try {
            await prisma.subscription.update({
                where: { stripeSubscriptionId: subscription.id },
                data: {
                    status: 'CANCELLED',
                },
            });

            logger.info(`Subscription cancelled in database: ${subscription.id}`);
        } catch (error) {
            logger.error('Error handling subscription deleted:', error);
        }
    }

    async _handleInvoicePaymentSucceeded(invoice) {
        try {
            logger.info(`Invoice payment succeeded: ${invoice.id}`);
            // Add any additional logic for successful payments
        } catch (error) {
            logger.error('Error handling invoice payment succeeded:', error);
        }
    }

    async _handleInvoicePaymentFailed(invoice) {
        try {
            logger.warn(`Invoice payment failed: ${invoice.id}`);
            // Add any additional logic for failed payments
        } catch (error) {
            logger.error('Error handling invoice payment failed:', error);
        }
    }

    async _handlePaymentIntentSucceeded(paymentIntent) {
        try {
            logger.info(`Payment intent succeeded: ${paymentIntent.id}`);
            // Add any additional logic for successful payments
        } catch (error) {
            logger.error('Error handling payment intent succeeded:', error);
        }
    }

    async _handlePaymentIntentFailed(paymentIntent) {
        try {
            logger.warn(`Payment intent failed: ${paymentIntent.id}`);
            // Add any additional logic for failed payments
        } catch (error) {
            logger.error('Error handling payment intent failed:', error);
        }
    }

    // Helper method to map Stripe price IDs to plan types
    _mapStripePriceToPlan(priceId) {
        // This mapping should be configured based on your Stripe price IDs
        const priceMapping = {
            'price_starter': 'STARTER',
            'price_growth': 'GROWTH',
            'price_pro': 'PRO',
        };

        return priceMapping[priceId] || 'STARTER';
    }

    // Get available plans
    async getPlans() {
        try {
            const prices = await this.stripe.prices.list({
                active: true,
                expand: ['data.product'],
            });

            return prices.data.map(price => ({
                id: price.id,
                name: price.product.name,
                description: price.product.description,
                price: price.unit_amount / 100,
                currency: price.currency,
                interval: price.recurring && price.recurring.interval,
                intervalCount: price.recurring && price.recurring.interval_count,
            }));
        } catch (error) {
            logger.error('Error retrieving Stripe plans:', error);
            throw error;
        }
    }
}

export const stripeService = new StripeService();