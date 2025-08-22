import { prisma } from '../db.js';
import { shopifyService } from '../services/shopify.js';
import { logger } from '../utils/logger.js';

async function testShopifyAPI() {
    try {
        console.log('🧪 Testing Shopify API directly...\n');

        // Get the store
        const store = await prisma.store.findFirst({
            where: {
                platform: 'SHOPIFY',
                domain: 'austus-themes.myshopify.com'
            }
        });

        if (!store) {
            console.log('❌ Store not found');
            return;
        }

        console.log(`📦 Store: ${store.name} (${store.domain})`);

        // Test connection
        console.log('\n1. Testing connection...');
        const connectionTest = await shopifyService.testConnection(store.id);
        console.log('Connection result:', connectionTest);

        // Test getting products directly
        console.log('\n2. Testing product list...');
        const client = await shopifyService.getClient(store.id);

        // Try different approaches
        console.log('\n   Trying with default parameters...');
        const products1 = await client.product.list();
        console.log(`   Found ${products1.length} products`);

        console.log('\n   Trying with limit 100...');
        const products2 = await client.product.list({ limit: 100 });
        console.log(`   Found ${products2.length} products`);

        console.log('\n   Trying with status any...');
        const products3 = await client.product.list({ status: 'any' });
        console.log(`   Found ${products3.length} products`);

        console.log('\n   Trying with status active...');
        const products4 = await client.product.list({ status: 'active' });
        console.log(`   Found ${products4.length} products`);

        // Show sample products if any
        if (products1.length > 0) {
            console.log('\n📋 Sample products:');
            products1.slice(0, 5).forEach((product, index) => {
                console.log(`   ${index + 1}. ${product.title} ($${product.variants[0] && product.variants[0].price || 'N/A'})`);
            });
        }

        // Get store stats
        console.log('\n3. Getting store stats...');
        const stats = await shopifyService.getStoreStats(store.id);
        console.log('Store stats:', stats);

    } catch (error) {
        console.error('❌ Error testing API:', error);
        logger.error('Shopify API test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testShopifyAPI();