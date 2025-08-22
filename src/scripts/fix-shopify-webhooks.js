import { prisma } from '../db.js';
import { shopifyService } from '../services/shopify.js';
import { logger } from '../utils/logger.js';

async function fixShopifyWebhooks() {
    try {
        logger.info('🔧 Fixing Shopify webhook redirect issue...');

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

        const ngrokUrl = 'https://6168d803cd2d.ngrok-free.app';

        logger.info('📋 Steps to fix webhook redirect issue:');
        logger.info('');
        logger.info('1️⃣ First, verify ngrok URL in Shopify:');
        logger.info(`   Visit: ${ngrokUrl}`);
        logger.info('   Accept the ngrok warning page');
        logger.info('');
        logger.info('2️⃣ Add webhook URL to Shopify manually:');
        logger.info('   Go to: https://austus-themes.myshopify.com/admin/settings/notifications');
        logger.info('   Scroll down to "Webhooks" section');
        logger.info('   Click "Create webhook"');
        logger.info('');
        logger.info('3️⃣ Add these webhook endpoints:');
        logger.info(`   - Event: Order creation`);
        logger.info(`   - URL: ${ngrokUrl}/api/shopify/webhooks/orders/create`);
        logger.info(`   - Format: JSON`);
        logger.info('');
        logger.info(`   - Event: Order updates`);
        logger.info(`   - URL: ${ngrokUrl}/api/shopify/webhooks/orders/updated`);
        logger.info(`   - Format: JSON`);
        logger.info('');
        logger.info(`   - Event: Product creation`);
        logger.info(`   - URL: ${ngrokUrl}/api/shopify/webhooks/products/create`);
        logger.info(`   - Format: JSON`);
        logger.info('');
        logger.info(`   - Event: Product updates`);
        logger.info(`   - URL: ${ngrokUrl}/api/shopify/webhooks/products/update`);
        logger.info(`   - Format: JSON`);
        logger.info('');
        logger.info('4️⃣ Test webhook by creating a test order');
        logger.info('');
        logger.info('💡 Alternative: Use a permanent domain instead of ngrok');
        logger.info('   - Deploy to Vercel, Railway, or Heroku');
        logger.info('   - Use a custom domain');
        logger.info('   - This will eliminate redirect issues');

        // Test if ngrok URL is accessible
        try {
            const response = await fetch(ngrokUrl);
            logger.info(`✅ ngrok URL is accessible (Status: ${response.status})`);
        } catch (error) {
            logger.warn(`⚠️ ngrok URL test failed: ${error.message}`);
        }

    } catch (error) {
        logger.error('❌ Error fixing webhooks:', error);
        logger.error('Stack trace:', error.stack);
    }
}

fixShopifyWebhooks();