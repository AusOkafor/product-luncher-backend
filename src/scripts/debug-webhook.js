import { logger } from '../utils/logger.js';

// This will help us see what Shopify is sending in webhooks
logger.info('🔍 Webhook Debug Script');
logger.info('📋 To debug webhook issues:');
logger.info('');
logger.info('1. Add this to your webhook handlers:');
logger.info('   console.log("Webhook payload:", JSON.stringify(req.body, null, 2));');
logger.info('');
logger.info('2. Check the server logs when webhooks are received');
logger.info('');
logger.info('3. Common issues:');
logger.info('   - shop_domain field might be named differently');
logger.info('   - Store not found due to domain mismatch');
logger.info('   - Missing required fields in webhook payload');
logger.info('');
logger.info('4. To test webhook manually:');
logger.info('   - Create a test order in Shopify');
logger.info('   - Check server logs for webhook payload');
logger.info('   - Verify store domain matches your database');

// Let's also check what stores we have
import { prisma } from '../db.js';

async function checkStores() {
    try {
        const stores = await prisma.store.findMany({
            where: { platform: 'SHOPIFY' }
        });

        logger.info('📦 Available stores in database:');
        stores.forEach(store => {
            logger.info(`   - ${store.name}: ${store.domain}`);
        });

        logger.info('');
        logger.info('💡 Make sure the webhook payload shop_domain matches one of these domains');
    } catch (error) {
        logger.error('Error checking stores:', error);
    }
}

checkStores();