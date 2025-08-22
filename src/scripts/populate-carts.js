import { prisma } from '../db.js';
import { logger } from '../utils/logger.js';

async function populateCarts() {
    try {
        logger.info('🛒 Populating cart table with test data...');

        // Get the store with products (austus-themes)
        const store = await prisma.store.findFirst({
            where: {
                platform: 'SHOPIFY',
                domain: 'austus-themes.myshopify.com'
            }
        });

        if (!store) {
            logger.error('❌ No store found. Please run setup:shopify first.');
            return;
        }

        const products = await prisma.product.findMany({
            where: { storeId: store.id },
            take: 5
        });

        if (products.length === 0) {
            logger.error('❌ No products found. Please sync products first.');
            return;
        }

        // Create test customers
        const customers = await Promise.all([
            prisma.customer.create({
                data: {
                    storeId: store.id,
                    email: 'john.doe@example.com',
                    firstName: 'John',
                    lastName: 'Doe',
                    phone: '+1234567890'
                }
            }),
            prisma.customer.create({
                data: {
                    storeId: store.id,
                    email: 'jane.smith@example.com',
                    firstName: 'Jane',
                    lastName: 'Smith',
                    phone: '+1987654321'
                }
            }),
            prisma.customer.create({
                data: {
                    storeId: store.id,
                    email: 'mike.wilson@example.com',
                    firstName: 'Mike',
                    lastName: 'Wilson',
                    phone: '+1555123456'
                }
            })
        ]);

        // Create test carts with different abandonment times
        const now = new Date();
        const cartData = [{
                customerId: customers[0].id,
                items: [
                    { productId: products[0].id, quantity: 1, price: parseFloat(products[0].price) },
                    { productId: products[1].id, quantity: 2, price: parseFloat(products[1].price) }
                ],
                total: parseFloat(products[0].price) + (parseFloat(products[1].price) * 2),
                status: 'ABANDONED',
                createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
                updatedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000)
            },
            {
                customerId: customers[1].id,
                items: [
                    { productId: products[2].id, quantity: 1, price: parseFloat(products[2].price) }
                ],
                total: parseFloat(products[2].price),
                status: 'ABANDONED',
                createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000), // 4 hours ago
                updatedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000)
            },
            {
                customerId: customers[2].id,
                items: [
                    { productId: products[3].id, quantity: 3, price: parseFloat(products[3].price) },
                    { productId: products[4].id, quantity: 1, price: parseFloat(products[4].price) }
                ],
                total: (parseFloat(products[3].price) * 3) + parseFloat(products[4].price),
                status: 'ABANDONED',
                createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000), // 6 hours ago
                updatedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000)
            },
            {
                customerId: customers[0].id,
                items: [
                    { productId: products[1].id, quantity: 1, price: parseFloat(products[1].price) }
                ],
                total: parseFloat(products[1].price),
                status: 'ACTIVE',
                createdAt: new Date(now.getTime() - 30 * 60 * 1000), // 30 minutes ago
                updatedAt: new Date(now.getTime() - 30 * 60 * 1000)
            }
        ];

        // Create carts
        const createdCarts = [];
        for (const cartInfo of cartData) {
            const cart = await prisma.cart.create({
                data: {
                    storeId: store.id,
                    customerId: cartInfo.customerId,
                    items: cartInfo.items,
                    subtotal: cartInfo.total,
                    status: cartInfo.status,
                    createdAt: cartInfo.createdAt,
                    updatedAt: cartInfo.updatedAt
                }
            });
            createdCarts.push(cart);
        }

        logger.info(`✅ Created ${createdCarts.length} test carts`);
        logger.info('');
        logger.info('📊 Cart Summary:');
        logger.info(`   - Store: ${store.name}`);
        logger.info(`   - Customers: ${customers.length}`);
        logger.info(`   - Products used: ${products.length}`);
        logger.info(`   - Abandoned carts: 3`);
        logger.info(`   - Active cart: 1`);
        logger.info('');
        logger.info('🎯 Now you can test Cart Recovery AI Agent:');
        logger.info('   - GET /api/cart-recovery/stores/{storeId}/abandoned-carts');
        logger.info('   - POST /api/cart-recovery/carts/{cartId}/recovery-message');
        logger.info('   - POST /api/cart-recovery/stores/{storeId}/process-abandoned-carts');

    } catch (error) {
        logger.error('❌ Failed to populate carts:', error);
        process.exit(1);
    }
}

populateCarts();