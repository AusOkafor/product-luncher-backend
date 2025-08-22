import { prisma } from '../db.js';
import { shopifyService } from '../services/shopify.js';
import { logger } from '../utils/logger.js';

async function setupNgrokWebhooks() {
    try {
        logger.info('🚀 Setting up Shopify webhooks with ngrok...');

        // Get the store
        const store = await prisma.store.findFirst({
            where: {
                platform: 'SHOPIFY',
                accessToken: { not: null }
            }
        });

        if (!store) {
            logger.error('❌ No Shopify store found with access token');
            return;
        }

        logger.info(`📦 Found store: ${store.name} (${store.domain})`);

        // Your ngrok URL
        const ngrokUrl = 'https://6168d803cd2d.ngrok-free.app';
        const webhookBaseUrl = `${ngrokUrl}/api/shopify`;

        logger.info(`🌐 Using ngrok URL: ${webhookBaseUrl}`);

        // Set up webhooks
        await shopifyService.setupWebhooks(store.id, webhookBaseUrl);

        logger.info('✅ Webhooks set up successfully!');
        logger.info('');
        logger.info('📋 Webhook endpoints created:');
        logger.info(`   - Orders Create: ${webhookBaseUrl}/webhooks/orders/create`);
        logger.info(`   - Orders Update: ${webhookBaseUrl}/webhooks/orders/updated`);
        logger.info(`   - Products Create: ${webhookBaseUrl}/webhooks/products/create`);
        logger.info(`   - Products Update: ${webhookBaseUrl}/webhooks/products/update`);
        logger.info('');
        logger.info('🎯 Now when customers:');
        logger.info('   - Add products to cart → Cart data will be captured');
        logger.info('   - Complete checkout → Order will be synced automatically');
        logger.info('   - Update products → Product data will be synced');
        logger.info('');
        logger.info('💡 Keep ngrok running to receive webhook events!');

    } catch (error) {
        logger.error('❌ Error setting up webhooks:', error);
        logger.error('Stack trace:', error.stack);
    }
}

setupNgrokWebhooks();