import { prisma } from '../db.js';
import { shopifyService } from '../services/shopify.js';
import { logger } from '../utils/logger.js';

async function setupShopifyStore() {
    try {
        console.log('🚀 Setting up Shopify Store Integration...\n');

        // Step 1: Create a demo user and workspace
        console.log('1. Creating demo user and workspace...');

        // Create a demo user first
        const user = await prisma.user.upsert({
            where: { email: 'demo@productluncher.com' },
            update: {},
            create: {
                email: 'demo@productluncher.com',
                passwordHash: 'demo-password-hash', // This is just for demo purposes
                firstName: 'Demo',
                lastName: 'User',
                role: 'ADMIN'
            }
        });

        // Create workspace with the user as owner
        const workspace = await prisma.workspace.upsert({
            where: { slug: 'demo-shopify-workspace' },
            update: {},
            create: {
                name: 'Demo Shopify Workspace',
                slug: 'demo-shopify-workspace',
                ownerId: user.id
            }
        });

        // Add user as workspace member
        await prisma.workspaceMember.upsert({
            where: {
                workspaceId_userId: {
                    workspaceId: workspace.id,
                    userId: user.id
                }
            },
            update: {},
            create: {
                workspaceId: workspace.id,
                userId: user.id,
                role: 'OWNER'
            }
        });

        // Get the actual store domain from environment or use a placeholder
        const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || 'your-store.myshopify.com';

        // Check if store already exists
        let store = await prisma.store.findFirst({
            where: {
                workspaceId: workspace.id,
                domain: storeDomain
            }
        });

        if (!store) {
            store = await prisma.store.create({
                data: {
                    workspaceId: workspace.id,
                    name: 'Your Shopify Store',
                    domain: storeDomain,
                    platform: 'SHOPIFY',
                    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || 'your-access-token-here',
                    metadata: {
                        syncProducts: true,
                        syncOrders: true,
                        syncCustomers: true
                    }
                }
            });
        } else {
            // Update existing store with new access token
            store = await prisma.store.update({
                where: { id: store.id },
                data: {
                    accessToken: process.env.SHOPIFY_ACCESS_TOKEN || 'your-access-token-here',
                    metadata: {
                        syncProducts: true,
                        syncOrders: true,
                        syncCustomers: true
                    }
                }
            });
        }

        console.log(`✅ Created store: ${store.name} (${store.domain})`);

        // Step 2: Test connection
        console.log('\n2. Testing Shopify connection...');

        if (store.accessToken === 'your-access-token-here') {
            console.log('⚠️  Please set your Shopify access token in the .env file');
            console.log('   SHOPIFY_ACCESS_TOKEN=your-actual-access-token');
            console.log('\n   To get your access token:');
            console.log('   1. Go to your Shopify admin');
            console.log('   2. Apps > Develop apps > Create an app');
            console.log('   3. Configure Admin API access scopes');
            console.log('   4. Install the app and copy the access token');
            return;
        }

        try {
            const connectionTest = await shopifyService.testConnection(store.id);

            if (connectionTest.connected) {
                console.log(`✅ Connected to Shopify store: ${connectionTest.shopName}`);
                console.log(`   Domain: ${connectionTest.shopDomain}`);
                console.log(`   Currency: ${connectionTest.currency}`);
            } else {
                console.log(`❌ Connection failed: ${connectionTest.error}`);
                return;
            }
        } catch (error) {
            console.log(`❌ Connection test failed: ${error.message}`);
            return;
        }

        // Step 3: Sync products
        console.log('\n3. Syncing products from Shopify...');

        try {
            const products = await shopifyService.syncProducts(store.id, 10);
            console.log(`✅ Synced ${products.length} products`);

            if (products.length > 0) {
                console.log('   Sample products:');
                products.slice(0, 3).forEach(product => {
                    console.log(`   - ${product.title} ($${product.price})`);
                });
            }
        } catch (error) {
            console.log(`❌ Product sync failed: ${error.message}`);
        }

        // Step 4: Sync orders
        console.log('\n4. Syncing orders from Shopify...');

        try {
            const orders = await shopifyService.syncOrders(store.id, 10);
            console.log(`✅ Synced ${orders.length} orders`);

            if (orders.length > 0) {
                console.log('   Sample orders:');
                orders.slice(0, 3).forEach(order => {
                    console.log(`   - Order #${order.metadata && order.metadata.orderNumber} ($${order.total})`);
                });
            }
        } catch (error) {
            console.log(`❌ Order sync failed: ${error.message}`);
        }

        // Step 5: Get store stats
        console.log('\n5. Getting store statistics...');

        try {
            const stats = await shopifyService.getStoreStats(store.id);
            console.log(`✅ Store stats:`);
            console.log(`   Total products: ${stats.products}`);
            console.log(`   Total orders: ${stats.orders}`);
            console.log(`   Last sync: ${stats.lastSync}`);
        } catch (error) {
            console.log(`❌ Stats failed: ${error.message}`);
        }

        console.log('\n🎉 Shopify integration setup complete!');
        console.log('\nNext steps:');
        console.log('1. Set up webhooks for real-time updates');
        console.log('2. Configure AI agents for product launches');
        console.log('3. Set up analytics and monitoring');

    } catch (error) {
        console.error('❌ Setup failed:', error);
        logger.error('Shopify setup failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the setup
setupShopifyStore();