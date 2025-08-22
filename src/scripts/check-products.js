import { prisma } from '../db.js';

async function checkProducts() {
    try {
        console.log('📦 Checking products in database...\n');

        // Check stores
        const stores = await prisma.store.findMany({
            where: { platform: 'SHOPIFY' }
        });

        console.log(`Found ${stores.length} Shopify stores:`);
        for (const store of stores) {
            console.log(`  - ${store.name} (${store.domain}) - ID: ${store.id}`);
            console.log(`    Access Token: ${store.accessToken ? 'Yes' : 'No'}`);
        }

        console.log('\n📊 Product counts by store:');
        for (const store of stores) {
            const productCount = await prisma.product.count({
                where: { storeId: store.id }
            });
            console.log(`  - ${store.name}: ${productCount} products`);
        }

        // Show some sample products
        const products = await prisma.product.findMany({
            take: 5,
            include: { store: true }
        });

        if (products.length > 0) {
            console.log('\n🎯 Sample products:');
            for (const product of products) {
                console.log(`  - ${product.title} ($${product.price}) - Store: ${product.store.name}`);
            }
        } else {
            console.log('\n❌ No products found in database');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkProducts();