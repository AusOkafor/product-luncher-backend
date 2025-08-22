import { prisma } from '../db.js';
import { shopifyService } from '../services/shopify.js';
import { logger } from '../utils/logger.js';

async function syncRealCarts() {
    try {
        logger.info('🛒 Syncing real cart data from Shopify...');

        // Get the store (prefer austus-themes)
        const store = await prisma.store.findFirst({
            where: {
                platform: 'SHOPIFY',
                accessToken: { not: null },
                domain: 'austus-themes.myshopify.com'
            }
        });

        if (!store) {
            logger.error('❌ No Shopify store found with access token');
            return;
        }

        logger.info(`📦 Found store: ${store.name} (${store.domain})`);

        // Get recent orders (these represent completed carts)
        logger.info('📋 Fetching recent orders from Shopify...');
        const shopify = shopifyService.getClient(store.id);

        try {
            const orders = await shopify.order.list({ limit: 10, status: 'any' });
            logger.info(`✅ Found ${orders.length} recent orders`);

            // Convert orders to cart-like data for testing
            for (const order of orders) {
                if (order.line_items && order.line_items.length > 0) {
                    // Create customer if doesn't exist
                    let customer = null;
                    if (order.customer) {
                        customer = await prisma.customer.upsert({
                            where: {
                                email: order.customer.email
                            },
                            update: {},
                            create: {
                                storeId: store.id,
                                email: order.customer.email,
                                firstName: order.customer.first_name || 'Unknown',
                                lastName: order.customer.last_name || 'Customer',
                                phone: order.customer.phone || null
                            }
                        });
                    }

                    // Create cart data from order
                    const cartItems = order.line_items.map(item => ({
                        productId: item.product_id ? item.product_id.toString() : null,
                        quantity: item.quantity,
                        price: parseFloat(item.price)
                    }));

                    const subtotal = order.line_items.reduce((sum, item) =>
                        sum + (parseFloat(item.price) * item.quantity), 0
                    );

                    // Check if cart already exists
                    const existingCart = await prisma.cart.findFirst({
                        where: {
                            storeId: store.id,
                            customerId: customer ? customer.id : null,
                            subtotal: subtotal
                        }
                    });

                    if (!existingCart && customer) {
                        const cart = await prisma.cart.create({
                            data: {
                                storeId: store.id,
                                customerId: customer.id,
                                items: cartItems,
                                subtotal: subtotal,
                                status: 'ABANDONED', // Treat as abandoned for testing
                                createdAt: new Date(order.created_at),
                                updatedAt: new Date(order.updated_at)
                            }
                        });

                        logger.info(`✅ Created cart from order ${order.id}: $${subtotal}`);
                    }
                }
            }

            logger.info('🎉 Real cart data synced successfully!');
            logger.info('');
            logger.info('📊 Now you have real customer data for testing Cart Recovery AI Agent');
            logger.info('🔗 Test with: npm run test:cart-sync');

        } catch (error) {
            logger.error('❌ Error fetching orders from Shopify:', error.message);
            logger.info('💡 This might be due to API permissions or no orders exist yet');
        }

    } catch (error) {
        logger.error('❌ Error syncing real carts:', error);
        logger.error('Stack trace:', error.stack);
    }
}

syncRealCarts();