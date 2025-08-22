import { shopifyService } from '../services/shopify.js';
import { prisma } from '../db.js';
import { logger } from '../utils/logger.js';

async function setupWebhooks() {
    try {
        logger.info('🔗 Setting up Shopify webhooks for real-time sync...');

        // Get the first Shopify store with access token
        const store = await prisma.store.findFirst({
            where: {
                platform: 'SHOPIFY',
                accessToken: { not: null }
            }
        });

        if (!store) {
            logger.error('❌ No Shopify store found. Please run setup:shopify first.');
            return;
        }

        logger.info(`📦 Found store: ${store.name} (${store.domain})`);

        // Set up webhooks with your server URL
        const webhookUrl = 'http://localhost:3000/api/shopify';

        await shopifyService.setupWebhooks(store.id, webhookUrl);

        logger.info('✅ Webhooks set up successfully!');
        logger.info('');
        logger.info('🎯 Now when you checkout an order in Shopify:');
        logger.info('   1. Shopify will send a webhook to your server');
        logger.info('   2. Your server will automatically sync the order');
        logger.info('   3. The order will appear in your database instantly');
        logger.info('');
        logger.info('📋 Webhook endpoints created:');
        logger.info(`   - ${webhookUrl}/webhooks/orders/create`);
        logger.info(`   - ${webhookUrl}/webhooks/orders/updated`);
        logger.info(`   - ${webhookUrl}/webhooks/products/create`);
        logger.info(`   - ${webhookUrl}/webhooks/products/update`);
        logger.info('');
        logger.info('🚀 Your server is ready for real-time order syncing!');

    } catch (error) {
        logger.error('❌ Failed to set up webhooks:', error);
        process.exit(1);
    }
}

setupWebhooks();