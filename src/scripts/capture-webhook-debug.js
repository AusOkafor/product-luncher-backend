import { logger } from '../utils/logger.js';

logger.info('🔍 Webhook Debug Capture Script');
logger.info('📋 Instructions to see webhook debugging:');
logger.info('');
logger.info('1. Keep the server running: npm run dev');
logger.info('');
logger.info('2. Create a test order in your Shopify store:');
logger.info('   - Go to: https://austus-themes.myshopify.com');
logger.info('   - Add a product to cart');
logger.info('   - Complete checkout');
logger.info('');
logger.info('3. Watch the server console for these debug messages:');
logger.info('   🔍 Webhook: Order created - [ORDER_ID]');
logger.info('   📋 Webhook payload keys: [LIST_OF_KEYS]');
logger.info('   🏪 Shop domain from webhook: [DOMAIN]');
logger.info('   ✅ Using fallback store: [STORE_DOMAIN]');
logger.info('   ✅ Synced new order: [LOCAL_ORDER_ID]');
logger.info('');
logger.info('4. If you see errors, they will show:');
logger.info('   ❌ Store not found for domain: [DOMAIN]');
logger.info('   ❌ Error handling order creation webhook: [ERROR]');
logger.info('');
logger.info('5. The webhook payload will show exactly what Shopify sends');
logger.info('   This will help us understand why the second order isn\'t syncing');
logger.info('');
logger.info('💡 Keep this terminal open and watch for the debug output!');

// Also show current store info
import { prisma } from '../db.js';

async function showStoreInfo() {
    try {
        const stores = await prisma.store.findMany({
            where: { platform: 'SHOPIFY' }
        });

        logger.info('📦 Current stores in database:');
        stores.forEach(store => {
            logger.info(`   - ${store.name}: ${store.domain}`);
        });

        logger.info('');
        logger.info('🎯 Ready to capture webhook debugging!');
    } catch (error) {
        logger.error('Error showing store info:', error);
    }
}

showStoreInfo();