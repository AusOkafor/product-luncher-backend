import { prisma } from '../db.js';
import { logger } from '../utils/logger.js';

async function monitorWebhooks() {
    try {
        logger.info('🔍 Monitoring webhook activity...');
        logger.info('📋 This will show you real-time data from Shopify webhooks');
        logger.info('');

        // Check current data
        const cartCount = await prisma.cart.count();
        const customerCount = await prisma.customer.count();
        const orderCount = await prisma.order.count();
        const productCount = await prisma.product.count();

        logger.info('📊 Current Database Status:');
        logger.info(`   - Products: ${productCount}`);
        logger.info(`   - Customers: ${customerCount}`);
        logger.info(`   - Orders: ${orderCount}`);
        logger.info(`   - Carts: ${cartCount}`);

        // Get recent activity
        const recentCarts = await prisma.cart.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                customer: true,
                store: true
            }
        });

        if (recentCarts.length > 0) {
            logger.info('');
            logger.info('🛒 Recent Cart Activity:');
            recentCarts.forEach((cart, index) => {
                logger.info(`   ${index + 1}. Cart ${cart.id.slice(-8)}`);
                logger.info(`      Customer: ${cart.customer ? cart.customer.firstName : 'Guest'}`);
                logger.info(`      Items: ${cart.items.length} items`);
                logger.info(`      Total: $${cart.subtotal}`);
                logger.info(`      Status: ${cart.status}`);
                logger.info(`      Created: ${cart.createdAt.toLocaleString()}`);
                logger.info('');
            });
        }

        // Get recent orders
        const recentOrders = await prisma.order.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: {
                customer: true,
                store: true
            }
        });

        if (recentOrders.length > 0) {
            logger.info('📦 Recent Order Activity:');
            recentOrders.forEach((order, index) => {
                logger.info(`   ${index + 1}. Order ${order.id.slice(-8)}`);
                logger.info(`      Customer: ${order.customer ? order.customer.firstName : 'Guest'}`);
                logger.info(`      Total: $${order.total}`);
                logger.info(`      Status: ${order.status}`);
                logger.info(`      Created: ${order.createdAt.toLocaleString()}`);
                logger.info('');
            });
        }

        logger.info('🎯 To test webhooks:');
        logger.info('   1. Add products to cart on your Shopify store');
        logger.info('   2. Complete checkout (or abandon cart)');
        logger.info('   3. Run this script again to see new data');
        logger.info('');
        logger.info('🔗 Test Cart Recovery AI Agent:');
        logger.info('   - npm run test:cart-sync');
        logger.info('   - npm run populate:carts (for test data)');

    } catch (error) {
        logger.error('❌ Error monitoring webhooks:', error);
    }
}

monitorWebhooks();
