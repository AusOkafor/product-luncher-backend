import twilio from 'twilio';
import sgMail from '@sendgrid/mail';
import { logger } from '../utils/logger.js';
import { prisma } from '../db.js';

class MessagingService {
    constructor() {
        this.twilioClient = null;
        this.sendGridInitialized = false;
    }

    async initialize() {
        try {
            // Initialize Twilio
            if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
                this.twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
                logger.info('Twilio client initialized');
            } else {
                logger.warn('Twilio credentials not found, SMS/WhatsApp disabled');
            }

            // Initialize SendGrid
            if (process.env.SENDGRID_API_KEY) {
                sgMail.setApiKey(process.env.SENDGRID_API_KEY);
                this.sendGridInitialized = true;
                logger.info('SendGrid initialized');
            } else {
                logger.warn('SendGrid API key not found, email disabled');
            }

            logger.info('Messaging service initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize messaging service:', error);
            throw error;
        }
    }

    // ========================================
    // SMS METHODS (Twilio)
    // ========================================

    async sendSMS(to, message, from = null) {
        try {
            if (!this.twilioClient) {
                throw new Error('Twilio client not initialized');
            }

            const fromNumber = from || process.env.TWILIO_PHONE_NUMBER;
            if (!fromNumber) {
                throw new Error('Twilio phone number not configured');
            }

            const result = await this.twilioClient.messages.create({
                body: message,
                from: fromNumber,
                to: to,
            });

            // Log message to database
            await this._logMessage({
                workspaceId: 'system', // This should be passed from the calling context
                channel: 'SMS',
                to: to,
                from: fromNumber,
                direction: 'OUTBOUND',
                body: message,
                status: 'SENT',
                metadata: { twilioSid: result.sid },
            });

            logger.info(`SMS sent successfully: ${result.sid}`);
            return result;
        } catch (error) {
            logger.error('Error sending SMS:', error);

            // Log failed message
            await this._logMessage({
                workspaceId: 'system',
                channel: 'SMS',
                to: to,
                from: from || process.env.TWILIO_PHONE_NUMBER,
                direction: 'OUTBOUND',
                body: message,
                status: 'FAILED',
                metadata: { error: error.message },
            });

            throw error;
        }
    }

    // ========================================
    // WHATSAPP METHODS (Twilio)
    // ========================================

    async sendWhatsApp(to, message, from = null) {
        try {
            if (!this.twilioClient) {
                throw new Error('Twilio client not initialized');
            }

            const fromNumber = from || process.env.TWILIO_WHATSAPP_NUMBER;
            if (!fromNumber) {
                throw new Error('Twilio WhatsApp number not configured');
            }

            // Format WhatsApp numbers
            const formattedTo = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
            const formattedFrom = fromNumber.startsWith('whatsapp:') ? fromNumber : `whatsapp:${fromNumber}`;

            const result = await this.twilioClient.messages.create({
                body: message,
                from: formattedFrom,
                to: formattedTo,
            });

            // Log message to database
            await this._logMessage({
                workspaceId: 'system',
                channel: 'WHATSAPP',
                to: to,
                from: fromNumber,
                direction: 'OUTBOUND',
                body: message,
                status: 'SENT',
                metadata: { twilioSid: result.sid },
            });

            logger.info(`WhatsApp message sent successfully: ${result.sid}`);
            return result;
        } catch (error) {
            logger.error('Error sending WhatsApp message:', error);

            // Log failed message
            await this._logMessage({
                workspaceId: 'system',
                channel: 'WHATSAPP',
                to: to,
                from: from || process.env.TWILIO_WHATSAPP_NUMBER,
                direction: 'OUTBOUND',
                body: message,
                status: 'FAILED',
                metadata: { error: error.message },
            });

            throw error;
        }
    }

    // ========================================
    // EMAIL METHODS (SendGrid)
    // ========================================

    async sendEmail(to, subject, content, options = {}) {
        try {
            if (!this.sendGridInitialized) {
                throw new Error('SendGrid not initialized');
            }

            const {
                from = process.env.SENDGRID_FROM_EMAIL,
                    fromName = process.env.SENDGRID_FROM_NAME,
                    html = null,
                    text = null,
                    attachments = [],
                    templateId = null,
                    templateData = {},
                    workspaceId = 'system',
            } = options;

            const msg = {
                to: to,
                from: {
                    email: from,
                    name: fromName,
                },
                subject: subject,
                ...(html && { html }),
                ...(text && { text }),
                ...(content && !html && !text && { text: content }),
                ...(attachments.length > 0 && { attachments }),
                ...(templateId && { templateId }),
                ...(templateData && Object.keys(templateData).length > 0 && { dynamicTemplateData: templateData }),
            };

            const result = await sgMail.send(msg);

            // Log message to database
            await this._logMessage({
                workspaceId,
                channel: 'EMAIL',
                to: to,
                from: from,
                direction: 'OUTBOUND',
                body: subject,
                status: 'SENT',
                metadata: { sendGridResult: result },
            });

            logger.info(`Email sent successfully to: ${to}`);
            return result;
        } catch (error) {
            logger.error('Error sending email:', error);

            // Log failed message
            await this._logMessage({
                workspaceId: options.workspaceId || 'system',
                channel: 'EMAIL',
                to: to,
                from: options.from || process.env.SENDGRID_FROM_EMAIL,
                direction: 'OUTBOUND',
                body: subject,
                status: 'FAILED',
                metadata: { error: error.message },
            });

            throw error;
        }
    }

    // ========================================
    // TEMPLATE EMAILS
    // ========================================

    async sendWelcomeEmail(user, workspace) {
        const subject = `Welcome to Product Luncher, ${user.firstName}!`;
        const content = `
            Hi ${user.firstName},
            
            Welcome to Product Luncher! Your workspace "${workspace.name}" has been created successfully.
            
            Get started by:
            1. Connecting your first store
            2. Creating your first product launch
            3. Setting up your AI agents
            
            If you have any questions, don't hesitate to reach out to our support team.
            
            Best regards,
            The Product Luncher Team
        `;

        return await this.sendEmail(user.email, subject, content, {
            workspaceId: workspace.id,
        });
    }

    async sendLaunchNotification(user, launch, workspace) {
        const subject = `Your product launch "${launch.name}" is ready!`;
        const content = `
            Hi ${user.firstName},
            
            Great news! Your product launch "${launch.name}" has been completed successfully.
            
            Launch Details:
            - Product: ${launch.productId}
            - Status: ${launch.status}
            - Created: ${new Date(launch.createdAt).toLocaleDateString()}
            
            You can now review and export your launch assets to your connected platforms.
            
            Best regards,
            The Product Luncher Team
        `;

        return await this.sendEmail(user.email, subject, content, {
            workspaceId: workspace.id,
        });
    }

    async sendCartRecoveryMessage(customer, cart, store) {
        const subject = `Complete your purchase - ${store.name}`;
        const content = `
            Hi ${customer.firstName || 'there'},
            
            We noticed you left some items in your cart at ${store.name}:
            
            Cart Total: $${cart.subtotal}
            
            Don't miss out! Complete your purchase now and enjoy your new products.
            
            Best regards,
            ${store.name} Team
        `;

        // Send via email if available
        if (customer.email) {
            await this.sendEmail(customer.email, subject, content, {
                workspaceId: store.workspaceId,
            });
        }

        // Send via SMS if available
        if (customer.phone) {
            await this.sendSMS(customer.phone, content, null, {
                workspaceId: store.workspaceId,
            });
        }

        // Send via WhatsApp if available
        if (customer.phone) {
            await this.sendWhatsApp(customer.phone, content, null, {
                workspaceId: store.workspaceId,
            });
        }
    }

    async sendOrderConfirmation(customer, order, store) {
        const subject = `Order Confirmation - ${store.name}`;
        const content = `
            Hi ${customer.firstName || 'there'},
            
            Thank you for your order! Here are your order details:
            
            Order ID: ${order.id}
            Total: $${order.total}
            Status: ${order.status}
            
            We'll send you tracking information once your order ships.
            
            Best regards,
            ${store.name} Team
        `;

        return await this.sendEmail(customer.email, subject, content, {
            workspaceId: store.workspaceId,
        });
    }

    // ========================================
    // WEBHOOK HANDLERS
    // ========================================

    async handleTwilioWebhook(req, res) {
        try {
            const { From, To, Body, MessageSid, MessageStatus } = req.body;

            // Log incoming message
            await this._logMessage({
                workspaceId: 'system', // This should be determined from the phone number mapping
                channel: 'SMS',
                to: To,
                from: From,
                direction: 'INBOUND',
                body: Body,
                status: MessageStatus.toUpperCase(),
                metadata: { twilioSid: MessageSid },
            });

            // Process the message (e.g., AI response, cart recovery logic)
            await this._processIncomingMessage(From, Body);

            res.status(200).send('OK');
        } catch (error) {
            logger.error('Error handling Twilio webhook:', error);
            res.status(500).send('Error');
        }
    }

    async handleWhatsAppWebhook(req, res) {
        try {
            const { From, To, Body, MessageSid, MessageStatus } = req.body;

            // Log incoming WhatsApp message
            await this._logMessage({
                workspaceId: 'system',
                channel: 'WHATSAPP',
                to: To,
                from: From,
                direction: 'INBOUND',
                body: Body,
                status: MessageStatus.toUpperCase(),
                metadata: { twilioSid: MessageSid },
            });

            // Process the message
            await this._processIncomingMessage(From, Body);

            res.status(200).send('OK');
        } catch (error) {
            logger.error('Error handling WhatsApp webhook:', error);
            res.status(500).send('Error');
        }
    }

    // ========================================
    // PRIVATE METHODS
    // ========================================

    async _logMessage(messageData) {
        try {
            await prisma.message.create({
                data: messageData,
            });
        } catch (error) {
            logger.error('Error logging message to database:', error);
        }
    }

    async _processIncomingMessage(from, body) {
        try {
            // This is where you'd implement AI-powered responses
            // For now, just log the incoming message
            logger.info(`Processing incoming message from ${from}: ${body}`);

            // TODO: Implement AI response logic
            // TODO: Implement cart recovery logic
            // TODO: Implement customer support logic
        } catch (error) {
            logger.error('Error processing incoming message:', error);
        }
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    async getMessageHistory(workspaceId, limit = 50) {
        try {
            return await prisma.message.findMany({
                where: { workspaceId },
                orderBy: { createdAt: 'desc' },
                take: limit,
            });
        } catch (error) {
            logger.error('Error fetching message history:', error);
            throw error;
        }
    }

    async getMessageStats(workspaceId) {
        try {
            const stats = await prisma.message.groupBy({
                by: ['channel', 'status'],
                where: { workspaceId },
                _count: {
                    id: true,
                },
            });

            return stats.reduce((acc, stat) => {
                if (!acc[stat.channel]) {
                    acc[stat.channel] = {};
                }
                acc[stat.channel][stat.status] = stat._count.id;
                return acc;
            }, {});
        } catch (error) {
            logger.error('Error fetching message stats:', error);
            throw error;
        }
    }
}

export const messagingService = new MessagingService();