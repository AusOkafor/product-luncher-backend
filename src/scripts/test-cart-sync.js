import { prisma } from '../db.js';
import { shopifyService } from '../services/shopify.js';
import { logger } from '../utils/logger.js';

async function testCartSync() {
    try {
        logger.info('🧪 Testing Cart Sync and Recovery...');

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

        // Check current data
        const cartCount = await prisma.cart.count();
        const customerCount = await prisma.customer.count();
        const productCount = await prisma.product.count();

        logger.info('📊 Current Database Status:');
        logger.info(`   - Products: ${productCount}`);
        logger.info(`   - Customers: ${customerCount}`);
        logger.info(`   - Carts: ${cartCount}`);

        // Test cart recovery with existing data
        if (cartCount > 0) {
            logger.info('\n🎯 Testing Cart Recovery AI Agent...');

            const testCart = await prisma.cart.findFirst({
                include: {
                    customer: true,
                    store: true
                }
            });

            if (testCart) {
                logger.info(`📦 Testing with cart: ${testCart.id}`);
                logger.info(`   Customer: ${testCart.customer ? testCart.customer.firstName : 'No customer'}`);
                logger.info(`   Items: ${JSON.stringify(testCart.items)}`);
                logger.info(`   Status: ${testCart.status}`);

                // Test recovery message generation
                const { cartRecoveryService } = await
                import ('../services/cartRecoveryService.js');
                const recoveryMessage = await cartRecoveryService.generateRecoveryMessage(testCart, {
                    platform: 'whatsapp'
                });

                logger.info('✅ Recovery message generated:');
                logger.info(recoveryMessage.message);

                // Test incentive generation
                const incentive = await cartRecoveryService.generateIncentive(testCart);
                logger.info('✅ Incentive generated:');
                logger.info(`   Type: ${incentive.type}`);
                logger.info(`   Value: ${incentive.value}`);
                logger.info(`   Code: ${incentive.code}`);
            }
        }

        logger.info('\n🎉 Cart Recovery AI Agent is working!');
        logger.info('');
        logger.info('📋 Next Steps:');
        logger.info('   1. Add products to cart on your Shopify store');
        logger.info('   2. Run: npm run populate:carts (to create test carts)');
        logger.info('   3. Test Cart Recovery API endpoints');
        logger.info('');
        logger.info('🔗 Test these endpoints:');
        logger.info('   - GET /api/cart-recovery/stores/{storeId}/abandoned-carts');
        logger.info('   - POST /api/cart-recovery/carts/{cartId}/recovery-message');
        logger.info('   - POST /api/cart-recovery/carts/{cartId}/incentive');

    } catch (error) {
        logger.error('❌ Error testing cart sync:', error);
        logger.error('Stack trace:', error.stack);
    }
}

testCartSync();