import { prisma } from '../db.js';
import { analyticsService } from '../services/analytics.js';
import { logger } from '../utils/logger.js';

async function testAnalytics() {
    try {
        console.log('📊 Testing Analytics System...\n');

        // Get a real product from the database
        const product = await prisma.product.findFirst({
            where: {
                store: {
                    domain: 'austus-themes.myshopify.com'
                }
            },
            include: {
                store: true,
                variants: true
            }
        });

        if (!product) {
            console.log('❌ No products found. Run sync:products first.');
            return;
        }

        console.log(`📦 Selected Product: ${product.title}`);
        console.log(`   Price: $${product.price}`);
        console.log(`   Category: ${product.category || 'N/A'}`);
        console.log(`   Brand: ${product.brand || 'N/A'}`);
        console.log(`   Variants: ${product.variants.length}`);
        console.log('');

        // Test analytics tracking
        console.log('📊 Testing Analytics...\n');

        // Track a product view
        await analyticsService.trackProductView(product.id, 'test-user-123', 'test-session-456');
        console.log('✅ Product view tracked');

        // Track another view
        await analyticsService.trackProductView(product.id, 'test-user-456', 'test-session-789');
        console.log('✅ Second product view tracked');

        // Get product analytics
        const analytics = await analyticsService.getProductAnalytics(product.id, '7d');
        console.log('✅ Product analytics retrieved');
        console.log(`   Views: ${analytics.views}`);
        console.log(`   Launches: ${analytics.launches}`);
        console.log(`   Conversions: ${analytics.conversions}`);
        console.log(`   Revenue: $${analytics.revenue}`);
        console.log('');

        // Get store analytics
        const storeAnalytics = await analyticsService.getStoreAnalytics(product.store.id, '7d');
        console.log('✅ Store analytics retrieved');
        console.log(`   Total Products: ${storeAnalytics.totalProducts}`);
        console.log(`   Total Launches: ${storeAnalytics.totalLaunches}`);
        console.log(`   Total Views: ${storeAnalytics.totalViews}`);
        console.log(`   Total Revenue: $${storeAnalytics.totalRevenue}`);
        console.log('');

        // Show top products
        if (storeAnalytics.topProducts.length > 0) {
            console.log('🏆 Top Performing Products:');
            storeAnalytics.topProducts.slice(0, 5).forEach((product, index) => {
                console.log(`   ${index + 1}. ${product.title} - $${product.revenue} revenue`);
            });
            console.log('');
        }

        // Test API endpoints
        console.log('🌐 Testing API Endpoints...\n');

        const baseUrl = 'http://localhost:3000/api';

        console.log('Available Analytics Endpoints:');
        console.log(`   POST ${baseUrl}/analytics/track/product-view`);
        console.log(`   POST ${baseUrl}/analytics/track/launch-performance`);
        console.log(`   GET  ${baseUrl}/analytics/product/${product.id}`);
        console.log(`   GET  ${baseUrl}/analytics/store/${product.store.id}`);
        console.log(`   GET  ${baseUrl}/analytics/top-products/${product.store.id}`);
        console.log('');

        console.log('Available AI Launch Endpoints:');
        console.log(`   POST ${baseUrl}/ai-launches/generate/${product.id}`);
        console.log(`   GET  ${baseUrl}/ai-launches/product/${product.id}`);
        console.log(`   GET  ${baseUrl}/ai-launches/types/available`);
        console.log(`   POST ${baseUrl}/ai-launches/generate-multiple/${product.id}`);
        console.log('');

        console.log('🎉 Analytics Testing Complete!');
        console.log('');
        console.log('📋 Next Steps:');
        console.log('   1. Set up AI API keys in .env for AI launches');
        console.log('   2. View analytics in Prisma Studio: npm run db:studio');
        console.log('   3. Test API endpoints with curl or Postman');
        console.log('   4. Build frontend dashboard to display analytics');

    } catch (error) {
        console.error('❌ Test failed:', error);
        logger.error('Analytics test failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the test
testAnalytics();