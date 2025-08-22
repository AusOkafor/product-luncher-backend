import { prisma } from '../db.js';
import { shopifyService } from '../services/shopify.js';
import { logger } from '../utils/logger.js';

async function syncAllProducts() {
    try {
        console.log('🔄 Syncing all products from Shopify...\n');

        // Get the store with access token - specifically austus-themes
        const store = await prisma.store.findFirst({
            where: {
                platform: 'SHOPIFY',
                domain: 'austus-themes.myshopify.com',
                accessToken: { not: null }
            }
        });

        if (!store) {
            console.log('❌ No Shopify store found. Run setup:shopify first.');
            return;
        }

        console.log(`📦 Syncing products for store: ${store.name} (${store.domain})`);

        // Sync all products (no limit)
        const products = await shopifyService.syncProducts(store.id, 250); // Increased limit to get all products

        console.log(`✅ Successfully synced ${products.length} products!`);

        if (products.length > 0) {
            console.log('\n📋 Sample products:');
            products.slice(0, 10).forEach((product, index) => {
                console.log(`   ${index + 1}. ${product.title} ($${product.price})`);
            });

            if (products.length > 10) {
                console.log(`   ... and ${products.length - 10} more products`);
            }
        }

        // Get updated store stats
        const stats = await shopifyService.getStoreStats(store.id);
        console.log(`\n📊 Store Statistics:`);
        console.log(`   Total products in Shopify: ${stats.products}`);
        console.log(`   Products synced to database: ${products.length}`);
        console.log(`   Total orders: ${stats.orders}`);

        // Check database count
        const dbProductCount = await prisma.product.count({
            where: { storeId: store.id }
        });

        console.log(`   Products in database: ${dbProductCount}`);

        if (dbProductCount < stats.products) {
            console.log(`\n⚠️  Note: Only ${dbProductCount} products synced out of ${stats.products} total products.`);
            console.log('   This might be due to API rate limits or pagination limits.');
        }

    } catch (error) {
        console.error('❌ Sync failed:', error);
        logger.error('Product sync failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the sync
syncAllProducts();